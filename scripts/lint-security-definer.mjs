#!/usr/bin/env node
// Vakt mot at en NY SECURITY DEFINER-funksjon fødes anon-åpen.
//
//   node scripts/lint-security-definer.mjs
//
// BAKGRUNN. En PostgreSQL-funksjon fødes med EXECUTE til PUBLIC, og
// `anon` er medlem av PUBLIC. `GRANT ... TO authenticated` stenger
// derfor ingenting — bare REVOKE gjør det. Det kostet 00076 og 00077,
// og per 00084 gjaldt det 25 funksjoner på én gang.
//
// Denne lintet leser MIGRASJONSFILENE, ikke databasen, så den kan kjøre
// i CI uten tilgang til noe. Sannheten ligger i prod og måles av
// `scripts/verify-00084.sql` (test A1) — dette er det tidlige varselet.
//
// REGELEN, som bare gjelder migrasjoner ETTER 00084:
//   Oppretter en migrasjon en SECURITY DEFINER-funksjon som ikke er en
//   trigger, må SAMME fil enten
//     a) ha en REVOKE ... FROM PUBLIC (eller anon) som nevner funksjonen, eller
//     b) merkes bevisst med en linje:  -- lint:anon-ok <navn> — <hvorfor>
//
// Exit 0 = grønt. Exit 1 = første brudd forklares.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIR = join(ROOT, 'supabase', 'migrations');

// 00084 er skillelinjen: alt til og med den er ryddet av 00084 selv.
const FRA = 84;

const filer = readdirSync(DIR)
  .filter(f => f.endsWith('.sql'))
  .filter(f => {
    const n = Number.parseInt(f.slice(0, 5), 10);
    return Number.isFinite(n) && n > FRA;
  })
  .sort();

/**
 * Deler en SQL-fil i setninger. Må respektere dollar-sitering ($$ … $$,
 * $function$ … $function$), ellers kuttes en funksjonskropp ved første
 * semikolon inne i den. Kommentarer strippes underveis, så en funksjon
 * som bare er NEVNT i en forklaring ikke teller som opprettet.
 */
function setninger(sql) {
  const ut = [];
  let buf = '';
  let i = 0;
  while (i < sql.length) {
    // linjekommentar
    if (sql.startsWith('--', i)) {
      const n = sql.indexOf('\n', i);
      i = n === -1 ? sql.length : n;
      continue;
    }
    // blokkommentar
    if (sql.startsWith('/*', i)) {
      const n = sql.indexOf('*/', i + 2);
      i = n === -1 ? sql.length : n + 2;
      continue;
    }
    // enkeltfnutt
    if (sql[i] === "'") {
      const j = sql.indexOf("'", i + 1);
      const slutt = j === -1 ? sql.length : j + 1;
      buf += sql.slice(i, slutt);
      i = slutt;
      continue;
    }
    // dollar-sitering: $tag$ … $tag$
    const d = /^\$[a-z_]*\$/i.exec(sql.slice(i));
    if (d) {
      const tag = d[0];
      const j = sql.indexOf(tag, i + tag.length);
      const slutt = j === -1 ? sql.length : j + tag.length;
      buf += sql.slice(i, slutt);
      i = slutt;
      continue;
    }
    if (sql[i] === ';') {
      ut.push(buf);
      buf = '';
      i++;
      continue;
    }
    buf += sql[i];
    i++;
  }
  if (buf.trim()) ut.push(buf);
  return ut;
}

let brudd = 0;
let sett = 0;

for (const fil of filer) {
  const sql = readFileSync(join(DIR, fil), 'utf8');

  for (const st of setninger(sql)) {
    const hode = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/i.exec(st);
    if (!hode) continue;
    if (!/\bsecurity\s+definer\b/i.test(st)) continue;      // security invoker: uaktuelt
    const navn = hode[1];
    // Bare FØRSTE ord etter RETURNS: «returns trigger AS $$» må gi
    // «trigger», ikke «trigger as».
    const ret = /\breturns\s+(?:setof\s+)?([a-z0-9_]+)/i.exec(st);
    if (ret && ret[1].toLowerCase() === 'trigger') continue;  // triggere kalles ikke av roller
    sett++;

    // REVOKE kan stå hvor som helst i SAMME migrasjon, og både
    // «FROM PUBLIC, anon» og «FROM public» teller.
    const revokeRe = new RegExp(
      `revoke[\\s\\S]{0,400}?\\b${navn}\\b[\\s\\S]{0,200}?\\bfrom\\b[\\s\\S]{0,120}?\\b(public|anon)\\b`,
      'i',
    );
    const harRevoke = revokeRe.test(sql);
    const erMerket = new RegExp(`--\\s*lint:anon-ok\\s+${navn}\\b`, 'i').test(sql);

    if (!harRevoke && !erMerket) {
      brudd++;
      console.log(`✗ ${fil}: public.${navn}() er SECURITY DEFINER uten REVOKE`);
      console.log('    En funksjon fødes kallbar av PUBLIC, altså av anon.');
      console.log('    Legg til i samme migrasjon:');
      console.log(`      GRANT EXECUTE ON FUNCTION public.${navn}(...) TO authenticated;`);
      console.log(`      REVOKE ALL ON FUNCTION public.${navn}(...) FROM PUBLIC, anon;`);
      console.log('    Er anon-tilgang MENINGEN, skriv i fila:');
      console.log(`      -- lint:anon-ok ${navn} — <hvorfor>`);
    }
  }
}

const hva = `${sett} SECURITY DEFINER-funksjon(er) i ${filer.length} migrasjon(er) etter 00084`;
if (brudd === 0) {
  console.log(`✓ ${hva}: alle stenger PUBLIC/anon eller er bevisst merket.`);
  process.exit(0);
}
console.log(`\n${brudd} brudd. ${hva}.`);
process.exit(1);
