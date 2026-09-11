#!/usr/bin/env node
// Innloggingsreisen i ekte nettleser (headless Chrome via DevTools Protocol):
// forsiden → «Logg inn» i headeren → /konto → skjema → «Min konto»-menyen
// med rollestyrte innganger → Heia-admin (/ops) → omlasting → Klubbetalinger
// (/klubb) → «Logg ut» → tilbake på forsiden, uinnlogget. Gjentas på mobil
// (hamburgermenyen). Kjøres mot en lokal preview av nettsiden, men med
// prod-Supabase og fixturene fra verify-web-flows.mjs --keep.
//
//   node scripts/verify-web-flows.mjs --keep --sessions=/tmp/s.json
//   node scripts/verify-web-login-journey.mjs --base=http://localhost:4399 \
//        --sessions=/tmp/s.json --out=/tmp/shots
//   node scripts/verify-web-flows.mjs --cleanup
import {execSync, spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '../web/node_modules/@supabase/supabase-js/dist/index.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg('base', 'http://localhost:4399');
const OUT = arg('out', '.');
const sessions = JSON.parse(readFileSync(arg('sessions'), 'utf8'));
mkdirSync(OUT, {recursive: true});

const REF = 'sswncdrbsrfieudkdmhj';
const URL_ = `https://${REF}.supabase.co`;
function mgmtToken() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -w', {encoding: 'utf8'}).trim();
  const prefix = 'go-keyring-base64:';
  return raw.startsWith(prefix) ? Buffer.from(raw.slice(prefix.length), 'base64').toString('utf8') : raw;
}
const TOKEN = mgmtToken();
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: {Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify({query}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}
const keys = JSON.parse(execSync(`supabase projects api-keys --project-ref ${REF} -o json`, {encoding: 'utf8'}));
const serviceKey = keys.find((k) => k.name === 'service_role').api_key;
const admin = createClient(URL_, serviceKey, {auth: {persistSession: false}});

// Fixturene: ops-brukeren har KUN ops-rollen; betalingsansvarlig («claimant»)
// får i tillegg ops-rollen her, så «begge roller» kan sjekkes. Passord settes
// på nytt så reisen kan gå gjennom det ekte skjemaet.
const PW = 'Journey-' + Math.random().toString(36).slice(2, 10) + 'x';
const opsUser = sessions.ops.user;
const bothUser = sessions.manager.user;
for (const u of [opsUser, bothUser]) {
  const {error} = await admin.auth.admin.updateUserById(u.id, {password: PW});
  if (error) throw error;
}
await sql(`INSERT INTO public.ops_admins (user_id, note) VALUES ('${bothUser.id}', 'verify-web-flows fixtur (journey, begge roller)') ON CONFLICT DO NOTHING;`);

const results = [];
const check = (name, pass, detail = '') => { results.push({name, pass: !!pass, detail: String(detail).slice(0, 100)}); if (!pass) console.log('FEIL:', name, detail); };

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'heia-journey-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { const {res, rej} = this.pending.get(d.id); this.pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method) { this.listeners.forEach((l) => l(d)); } };
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({id, method, params})); return new Promise((res, rej) => this.pending.set(id, {res, rej})); }
  waitEvent(name, timeout = 15000) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + name)), timeout); const l = (d) => { if (d.method === name) { clearTimeout(t); this.listeners = this.listeners.filter((x) => x !== l); res(d.params); } }; this.listeners.push(l); }); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval-feil'); return r.result?.value; }
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const cdp = new CDP(ws);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
const jsErrors = [];
cdp.listeners.push((d) => { if (d.method === 'Runtime.exceptionThrown') jsErrors.push(d.params.exceptionDetails?.exception?.description ?? 'exception'); });

const go = async (path) => { const p = cdp.waitEvent('Page.loadEventFired'); await cdp.send('Page.navigate', {url: BASE + path}); await p; await sleep(150); };
const clickNav = async (sel) => { const p = cdp.waitEvent('Page.loadEventFired'); await cdp.eval(`document.querySelector(${JSON.stringify(sel)}).click(); 'ok'`); await p; await sleep(150); };
const visible = (sel) => cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const r = el.getBoundingClientRect(); return !el.hidden && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })()`);
const waitFor = async (expr, timeout = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await cdp.eval(expr)) return true; await sleep(200); } return false; };
const text = () => cdp.eval('document.body.innerText');
const path = () => cdp.eval('location.pathname');
const shot = async (name, full = false) => { const {data} = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: full}); writeFileSync(join(OUT, name + '.png'), Buffer.from(data, 'base64')); };
const setDesktop = () => cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
const setMobile = () => cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 2, mobile: true});
const clearAuth = () => cdp.eval(`localStorage.clear(); 'ok'`);

// Fyll React-kontrollerte felt med native setter + input-event.
async function loginViaForm(email, password) {
  const ok = await waitFor(`document.querySelector('form.auth input[type=email]') != null`);
  check('konto: skjemaet er hydrert', ok);
  await cdp.eval(`(() => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', {bubbles: true})); };
    set(document.querySelector('form.auth input[type=email]'), ${JSON.stringify(email)});
    set(document.querySelector('form.auth input[type=password]'), ${JSON.stringify(password)});
    document.querySelector('form.auth').requestSubmit(); return 'ok';
  })()`);
}

// ─── PC: full reise med brukeren som har begge roller ───
await setDesktop();
await go('/');
await clearAuth();
await go('/');
check('forsiden: «Logg inn» synlig i toppmenyen', await visible('.site-header nav .nav-login'));
check('forsiden: kontomenyen skjult uinnlogget', !(await visible('.site-header nav details.acct')));
check('forsiden: «Få laget ditt med» står som hovedknapp', await visible('.site-header nav .btn-primary'));
await shot('pc-1-forsiden-uinnlogget');
await clickNav('.site-header nav .nav-login');
check('«Logg inn» fører til /konto/', (await path()) === '/konto/', await path());
await loginViaForm(bothUser.email, PW);
check('konto: innlogget (Kontoen din)', await waitFor(`document.body.innerText.includes('Kontoen din')`, 20000));
check('konto: headeren byttet til «Min konto» uten omlasting', await waitFor(`!document.querySelector('.site-header nav details.acct').hidden`, 5000));
check('konto: «Logg inn» borte fra headeren', !(await visible('.site-header nav .nav-login')));
check('header: Heia-admin-inngang (ops-rolle) vises', await waitFor(`!document.querySelector('.site-header nav .acct-menu a[data-role=ops]').hidden`, 10000));
check('header: Klubbetalinger-inngang (betalingsansvarlig) vises', await waitFor(`!document.querySelector('.site-header nav .acct-menu a[data-role=manager]').hidden`, 10000));
check('konto: begge flatene listet på /konto', await waitFor(`document.body.innerText.includes('Heia-admin') && document.body.innerText.includes('Klubbetalinger')`, 10000));
await cdp.eval(`document.querySelector('.site-header nav details.acct summary').click(); 'ok'`);
await sleep(300);
check('header: menyen åpner med navn og e-post', (await cdp.eval(`document.querySelector('.site-header nav .acct-who').innerText`)).includes(bothUser.email));
check('header: menyen viser Min konto', await visible('.site-header nav .acct-menu a[href="/konto/"]'));
check('header: menyen viser Heia-admin', await visible('.site-header nav .acct-menu a[data-role=ops]'));
check('header: menyen viser Klubbetalinger', await visible('.site-header nav .acct-menu a[data-role=manager]'));
check('header: menyen viser Logg ut', await visible('.site-header nav .acct-menu button[data-signout]'));
await shot('pc-2-konto-meny-aapen');
await clickNav('.site-header nav .acct-menu a[data-role=ops]');
check('Heia-admin fører til /ops/', (await path()) === '/ops/', await path());
check('ops: køen er lastet', await waitFor(`document.body.innerText.includes('Søknader') && !document.body.innerText.includes('Sjekker') && !document.body.innerText.includes('Henter')`, 20000));
check('ops: headeren viser Min konto', await visible('.site-header nav details.acct'));
check('ops: «Forsiden» finnes i headeren (vei tilbake til nettsiden)', await visible('.site-header nav a[href="/"]'));
await shot('pc-3-ops');
{ const p = cdp.waitEvent('Page.loadEventFired'); await cdp.send('Page.reload'); await p; await sleep(150); }
check('ops: omlasting beholder innloggingen', await waitFor(`document.body.innerText.includes('Søknader') && !document.body.innerText.includes('Sjekker')`, 20000));
check('ops: headeren logget inn etter omlasting', await waitFor(`!document.querySelector('.site-header nav details.acct').hidden`, 5000));
check('ops: rolleinnganger etter omlasting (cache + fersk)', await waitFor(`!document.querySelector('.site-header nav .acct-menu a[data-role=ops]').hidden && !document.querySelector('.site-header nav .acct-menu a[data-role=manager]').hidden`, 10000));
await cdp.eval(`document.querySelector('.site-header nav details.acct').open = true; 'ok'`);
await clickNav('.site-header nav .acct-menu a[data-role=manager]');
check('Klubbetalinger fører til /klubb/', (await path()) === '/klubb/', await path());
check('klubb: oversikten er lastet', await waitFor(`document.body.innerText.includes('VERIFY WEB IL') && !document.body.innerText.includes('Henter')`, 20000));
await shot('pc-4-klubb');
await cdp.eval(`document.querySelector('.site-header nav details.acct').open = true; 'ok'`);
await clickNav('.site-header nav .acct-menu button[data-signout]');
check('logg ut: lander på forsiden', (await path()) === '/', await path());
check('logg ut: «Logg inn» er tilbake i headeren', await visible('.site-header nav .nav-login'));
check('logg ut: sesjonen er borte fra localStorage', (await cdp.eval(`localStorage.getItem('heia-web-auth')`)) === null);
check('logg ut: rollecache er borte', (await cdp.eval(`localStorage.getItem('heia-web-roles')`)) === null);
await go('/ops/');
check('logg ut: /ops/ krever innlogging igjen', await waitFor(`document.body.innerText.includes('Logg inn')`, 10000));
await shot('pc-5-ops-utlogget');

// ─── PC: ops-bruker med KUN ops-rollen ser ikke Klubbetalinger ───
await go('/konto/');
await loginViaForm(opsUser.email, PW);
check('ops-only: innlogget', await waitFor(`document.body.innerText.includes('Kontoen din')`, 20000));
check('ops-only: Heia-admin vises', await waitFor(`!document.querySelector('.site-header nav .acct-menu a[data-role=ops]').hidden`, 10000));
await sleep(800);
check('ops-only: Klubbetalinger vises IKKE', await cdp.eval(`document.querySelector('.site-header nav .acct-menu a[data-role=manager]').hidden`));
// Utlogging fra øyas egen knapp skal også oppdatere headeren.
await cdp.eval(`Array.from(document.querySelectorAll('main button')).find((b) => b.textContent.trim() === 'Logg ut').click(); 'ok'`);
check('øyas «Logg ut» → headeren viser «Logg inn» igjen', await waitFor(`!document.querySelector('.site-header nav .nav-login').hidden`, 8000));

// ─── Mobil: hamburgermenyen ───
await setMobile();
await go('/');
check('mobil: «Logg inn» ikke i baren (kun logo + meny)', !(await visible('.site-header nav .nav-login')));
await cdp.eval(`document.getElementById('menu-btn').click(); 'ok'`);
await sleep(300);
check('mobil: «Logg inn» tydelig i hamburgermenyen', await visible('.site-header .mobile-menu .menu-cta a[data-auth=out]'));
check('mobil: hovedknappen står i menyen', await visible('.site-header .mobile-menu .menu-cta .btn-primary'));
check('mobil: kontoblokken skjult uinnlogget', !(await visible('.site-header .mobile-menu .menu-account')));
await shot('mobil-1-meny-uinnlogget');
await clickNav('.site-header .mobile-menu .menu-cta a[data-auth=out]');
check('mobil: «Logg inn» fører til /konto/', (await path()) === '/konto/', await path());
await loginViaForm(bothUser.email, PW);
check('mobil: innlogget', await waitFor(`document.body.innerText.includes('Kontoen din')`, 20000));
await cdp.eval(`document.getElementById('menu-btn').click(); 'ok'`);
check('mobil: kontoblokk med navn', await waitFor(`!document.querySelector('.site-header .mobile-menu .menu-account').hidden && document.querySelector('.site-header .mobile-menu .menu-who').innerText.includes(${JSON.stringify(bothUser.user_metadata?.display_name ?? '')})`, 5000));
check('mobil: Heia-admin i menyen', await waitFor(`!document.querySelector('.site-header .mobile-menu a[data-role=ops]').hidden`, 10000));
check('mobil: Klubbetalinger i menyen', await waitFor(`!document.querySelector('.site-header .mobile-menu a[data-role=manager]').hidden`, 10000));
check('mobil: «Logg inn»-knappen borte', !(await visible('.site-header .mobile-menu .menu-cta a[data-auth=out]')));
await shot('mobil-2-meny-innlogget');
await clickNav('.site-header .mobile-menu a[data-role=ops]');
check('mobil: Heia-admin → /ops/', (await path()) === '/ops/', await path());
check('mobil: ops lastet', await waitFor(`document.body.innerText.includes('Søknader') && !document.body.innerText.includes('Sjekker')`, 20000));
await shot('mobil-3-ops');
await cdp.eval(`document.getElementById('menu-btn').click(); 'ok'`);
await sleep(300);
await shot('mobil-4-ops-meny');
await clickNav('.site-header .mobile-menu .menu-account button[data-signout]');
check('mobil: logg ut → forsiden', (await path()) === '/', await path());
await cdp.eval(`document.getElementById('menu-btn').click(); 'ok'`);
await sleep(200);
check('mobil: «Logg inn» tilbake i menyen', await visible('.site-header .mobile-menu .menu-cta a[data-auth=out]'));

check('ingen JS-feil i nettleseren', jsErrors.length === 0, jsErrors.join(' | '));
ws.close();
chrome.kill();
const ok = results.filter((r) => r.pass).length;
console.table(results);
console.log(`verify-web-login-journey: ${ok}/${results.length} grønne`);
process.exit(ok === results.length ? 0 : 1);
