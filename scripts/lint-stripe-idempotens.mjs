#!/usr/bin/env node
// Vakt mot at en Stripe-skriving mister idempotensnøkkelen sin.
//
//   node scripts/lint-stripe-idempotens.mjs
//
// BAKGRUNN (punkt 87). `stripe-checkout` laget Checkout-sesjonen UTEN
// nøkkel, i motsetning til de tre andre Stripe-POST-ene i samme fil. To
// parallelle kall — dobbelttrykk, to faner, en retry i nettlaget — fant
// begge samme `checkout_pending`-rad uten sesjons-id og laget hver sin
// BETALBARE sesjon. Betalte brukeren i begge, ble det to abonnementer,
// og det andre kunne aldri knyttes til raden (unik-indexen
// `idx_support_subscriptions_one_live`): et månedlig trekk usynlig både
// for oss og for «Min støtte».
//
// REGELEN: hvert `stripePost(...)`-kall må ha et tredje argument
// (idempotensnøkkelen), ELLER en linje rett over seg som sier hvorfor
// ikke:  // stripe:ingen-nokkel — <grunn>
//
// Kall som er idempotente av natur (å utløpe en bestemt sesjon, å sette
// samme felt på en bestemt subscription) er lovlige unntak — men de skal
// være SKREVET NED, ikke glemt.
//
// Exit 0 = grønt. Exit 1 = første brudd forklares.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIR = join(ROOT, 'supabase', 'functions');

function filer(dir) {
  const ut = [];
  for (const navn of readdirSync(dir)) {
    const p = join(dir, navn);
    if (statSync(p).isDirectory()) ut.push(...filer(p));
    else if (p.endsWith('.ts') && !p.endsWith(join('_shared', 'stripe.ts'))) ut.push(p);
  }
  return ut;
}

/**
 * Antall argumenter på toppnivå i kallet som starter ved `(` på pos.
 * Teller SEGMENTER, ikke kommaer: `f(a, b,)` har to argumenter, ikke tre.
 * Etterfølgende komma er husstil i denne kodebasen, så en kommatelling
 * ville sagt «3 argumenter» om et `/expire`-kall med to.
 */
function argumenter(src, pos) {
  let dybde = 0;
  let i = pos;
  let streng = null;
  let segStart = pos + 1;
  const segmenter = [];
  while (i < src.length) {
    const c = src[i];
    if (streng) {
      if (c === '\\') i++;
      else if (c === streng) streng = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      streng = c;
      i++;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') dybde++;
    else if (c === ')' || c === ']' || c === '}') {
      dybde--;
      if (dybde === 0) {
        segmenter.push(src.slice(segStart, i));
        const ekte = segmenter.filter(t => t.replace(/\s|\/\/[^\n]*/g, '') !== '');
        return {antall: ekte.length, slutt: i};
      }
    } else if (c === ',' && dybde === 1) {
      segmenter.push(src.slice(segStart, i));
      segStart = i + 1;
    }
    i++;
  }
  return {antall: -1, slutt: -1};
}

let brudd = 0;
let sett = 0;

for (const f of filer(DIR)) {
  const src = readFileSync(f, 'utf8');
  let i = 0;
  while ((i = src.indexOf('stripePost(', i)) !== -1) {
    const start = i + 'stripePost'.length;
    const {antall, slutt} = argumenter(src, start);
    i = slutt === -1 ? i + 1 : slutt;
    if (antall === -1) continue;
    sett++;
    if (antall >= 3) continue;

    const linje = src.slice(0, start).split('\n').length;
    // Let bakover gjennom den SAMMENHENGENDE kommentarblokka rett over
    // kallet — ikke et fast antall linjer, så en lang begrunnelse ikke
    // faller utenfor vinduet.
    const forran = src.slice(0, start).split('\n');
    forran.pop();                       // linja kallet selv står på
    const blokk = [];
    for (let k = forran.length - 1; k >= 0; k--) {
      const l = forran[k].trim();
      if (l.startsWith('//') || l.startsWith('*') || l.startsWith('/*')) blokk.push(l);
      else if (l === '') continue;
      else break;
    }
    if (blokk.some(l => /stripe:ingen-nokkel/.test(l))) continue;

    brudd++;
    console.log(`✗ ${relative(ROOT, f)}:${linje} — stripePost uten idempotensnøkkel`);
    console.log('    To parallelle kall kan lage to Stripe-objekter (punkt 87).');
    console.log('    Legg til en nøkkel som er STABIL for samme forsøk og NY for et');
    console.log('    lovlig nytt forsøk, f.eks. `heia-<ting>-${rad.id}-${forrige ?? "first"}`.');
    console.log('    Er kallet idempotent av natur, skriv grunnen rett over:');
    console.log('      // stripe:ingen-nokkel — <grunn>');
  }
}

const hva = `${sett} stripePost-kall i supabase/functions`;
if (brudd === 0) {
  console.log(`✓ ${hva}: alle har nøkkel eller en skreven grunn.`);
  process.exit(0);
}
console.log(`\n${brudd} brudd. ${hva}.`);
process.exit(1);
