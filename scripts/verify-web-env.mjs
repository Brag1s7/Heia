#!/usr/bin/env node
// Bevisfil for punkt 108 — nettsidens miljøseparasjon.
//
//   cd web && npm run build           # bygg først, med et eksplisitt miljø
//   node scripts/verify-web-env.mjs   # så bevis
//
// Kontrollerer fire ting, alle mot ARTEFAKTEN (web/dist) og kilden, ikke
// mot hva koden er ment å gjøre:
//
//   A  ingen hardkodet prosjektadresse eller anon-nøkkel i web/src
//   B  det som ligger i bygget er nøyaktig det miljøet vi ba om
//   C  hver side bærer miljømerket
//   D  merket viser seg på feil vert og tier på riktig vert
//
// Exit 0 = alt grønt. Exit 1 = første brudd forklares.
import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const DIST = join(WEB, 'dist');

let feil = 0;
const ok = (t) => console.log(`  ✓ ${t}`);
const nei = (t, detalj) => {
  feil++;
  console.log(`  ✗ ${t}`);
  if (detalj) console.log(`      ${detalj}`);
};

function filerUnder(dir, pred) {
  const ut = [];
  for (const navn of readdirSync(dir)) {
    const p = join(dir, navn);
    if (statSync(p).isDirectory()) ut.push(...filerUnder(p, pred));
    else if (pred(p)) ut.push(p);
  }
  return ut;
}

// ── A. Ingen reserveverdi i kilden ───────────────────────────────────────
// Reserveverdien var nettopp en hardkodet prosjektadresse og en anon-nøkkel
// i `web/src/lib/env.ts`. Kommer de tilbake, feiler denne.
console.log('\nA. Kilden (web/src) har ingen hardkodet database');
{
  const PROSJEKT = /https:\/\/[a-z0-9]{15,}\.supabase\.co/;
  const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/;
  const kilder = filerUnder(join(WEB, 'src'), (p) => /\.(ts|tsx|astro|mjs|js)$/.test(p));
  const treff = [];
  for (const f of kilder) {
    const t = readFileSync(f, 'utf8');
    if (PROSJEKT.test(t)) treff.push(`${relative(ROOT, f)}: prosjektadresse`);
    if (JWT.test(t)) treff.push(`${relative(ROOT, f)}: nøkkel som ser ut som en JWT`);
  }
  if (treff.length) nei(`${kilder.length} kildefiler`, treff.join('\n      '));
  else ok(`${kilder.length} kildefiler, ingen innebygd prosjektadresse eller nøkkel`);
}

if (!existsSync(DIST)) {
  console.log('\nweb/dist finnes ikke — bygg først (cd web && npm run build).');
  process.exit(1);
}

const sider = filerUnder(DIST, (p) => p.endsWith('.html'));
const forside = readFileSync(join(DIST, 'index.html'), 'utf8');

// ── B. Bygget bærer det miljøet vi ba om ─────────────────────────────────
// Kjøres bare når miljøvariablene er satt i skallet (som i CI). Lokalt, der
// verdiene kommer fra web/.env, hoppes den over med en tydelig linje.
console.log('\nB. Bygget bærer nøyaktig det miljøet byggingen fikk');
{
  const url = process.env.PUBLIC_SUPABASE_URL;
  const env = process.env.PUBLIC_HEIA_ENV;
  if (!url || !env) {
    console.log('  – hoppet over: PUBLIC_SUPABASE_URL/PUBLIC_HEIA_ENV ikke satt i skallet');
  } else {
    const ref = url.replace(/^https:\/\/([^.]+)\..*$/, '$1');
    const bunter = filerUnder(DIST, (p) => p.endsWith('.js'));
    const alt = [...sider, ...bunter].map((f) => readFileSync(f, 'utf8')).join('\n');
    const andre = [...alt.matchAll(/https:\/\/([a-z0-9]{15,})\.supabase\.co/g)]
      .map((m) => m[1])
      .filter((r) => r !== ref);
    if (andre.length) nei('bygget peker på flere prosjekter', `uventet: ${[...new Set(andre)].join(', ')}`);
    else ok(`bare ${ref} i ${sider.length} sider og ${bunter.length} bunter`);
    if (!forside.includes(`data-env="${env}"`)) nei(`forsiden mangler data-env="${env}"`);
    else ok(`forsiden er merket data-env="${env}"`);
  }
}

// ── C. Merket står på hver side ──────────────────────────────────────────
console.log('\nC. Miljømerket står i HTML-en på hver side');
{
  const uten = sider.filter((f) => !readFileSync(f, 'utf8').includes('id="env-badge"'));
  if (uten.length) nei(`${uten.length} av ${sider.length} sider mangler merket`, uten.map((f) => relative(DIST, f)).join(', '));
  else ok(`${sider.length} sider`);
}

// ── D. Merket viser seg på feil vert og tier på riktig ───────────────────
// Selve skriptet fra artefakten kjøres, mot en liten DOM-stubb.
console.log('\nD. Merket avsløres etter vertsadressen, ikke etter byggingen');
{
  const skript = [...forside.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .find((t) => t.includes("getElementById('env-badge')"));
  if (!skript) {
    nei('fant ikke merkets skript i dist/index.html');
  } else {
    const attr = (navn) => (forside.match(new RegExp(`id="env-badge"[^>]*${navn}="([^"]*)"`)) || [])[1];
    const dataset = {env: attr('data-env'), prodHost: attr('data-prod-host')};
    const kjor = (hostname) => {
      const el = {
        hidden: true,
        dataset,
        title: '',
        addEventListener() {},
        querySelector: () => ({textContent: ''}),
      };
      const sandkasse = {
        document: {getElementById: (id) => (id === 'env-badge' ? el : null)},
        location: {hostname},
        sessionStorage: {getItem: () => null, setItem: () => {}},
      };
      new Function('document', 'location', 'sessionStorage', skript)(
        sandkasse.document,
        sandkasse.location,
        sandkasse.sessionStorage,
      );
      return !el.hidden;
    };
    const vert = dataset.prodHost;
    const env = dataset.env;
    const forventet = [
      [vert, env !== 'production', `produksjonsverten ${vert}`],
      [`www.${vert}`, env !== 'production', `www.${vert}`],
      ['localhost', true, 'localhost'],
      ['heia-web-git-brage.vercel.app', true, 'en Vercel-forhåndsvisning'],
      [`${vert}.angriper.example`, true, 'en vert som bare ligner'],
    ];
    for (const [host, skalVises, tekst] of forventet) {
      const vises = kjor(host);
      if (vises === skalVises) ok(`${tekst}: merket ${vises ? 'vises' : 'er skjult'}`);
      else nei(`${tekst}: merket ${vises ? 'vises' : 'er skjult'}, forventet det motsatte`);
    }
  }
}

console.log(feil === 0 ? '\nAlt grønt.\n' : `\n${feil} brudd.\n`);
process.exit(feil === 0 ? 0 : 1);
