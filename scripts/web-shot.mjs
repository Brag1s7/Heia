#!/usr/bin/env node
// Skjermbilder av nettsiden via Chrome DevTools Protocol — venter til
// innholdet FAKTISK er lastet (ingen «Henter …»/«Sjekker …» igjen), kan
// seede innloggingssesjon i localStorage, scrolle og klikke før bildet.
//
//   node scripts/web-shot.mjs shots.json
//
// shots.json: {"base":"http://localhost:4321","session":{...}|null,
//   "shots":[{"name":"ops","path":"/ops/","width":1280,"height":900,
//             "waitGone":["Henter","Sjekker"],"scroll":0,"click":"#menu-btn",
//             "fullPage":false,"mobile":true}]}
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outDir = cfg.outDir ?? '.';
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'heia-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
], {stdio: 'ignore'});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitPort() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome svarte ikke på CDP');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; this.listeners = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { const {res, rej} = this.pending.get(d.id); this.pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method) { this.listeners.forEach((l) => l(d)); } };
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({id, method, params})); return new Promise((res, rej) => this.pending.set(id, {res, rej})); }
  waitEvent(name, timeout = 15000) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + name)), timeout); const l = (d) => { if (d.method === name) { clearTimeout(t); this.listeners = this.listeners.filter((x) => x !== l); res(d.params); } }; this.listeners.push(l); }); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); return r.result?.value; }
}

await waitPort();
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const cdp = new CDP(ws);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
const consoleErrors = [];
cdp.listeners.push((d) => { if (d.method === 'Runtime.exceptionThrown') consoleErrors.push(d.params.exceptionDetails?.exception?.description ?? 'exception'); });

// Seed sesjon på origin FØR flatene lastes.
if (cfg.session) {
  await cdp.send('Page.navigate', {url: cfg.base + '/favicon.svg'});
  await cdp.waitEvent('Page.loadEventFired');
  await cdp.eval(`localStorage.setItem('heia-web-auth', ${JSON.stringify(JSON.stringify(cfg.session))}); 'ok'`);
}

const report = [];
for (const s of cfg.shots) {
  const w = s.width ?? 1280, h = s.height ?? 900;
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: s.scale ?? 1, mobile: !!s.mobile});
  await cdp.send('Page.navigate', {url: cfg.base + s.path});
  await cdp.waitEvent('Page.loadEventFired');
  const gone = s.waitGone ?? ['Henter', 'Sjekker', 'Laster', 'Vent …'];
  let ready = false;
  for (let i = 0; i < 80; i++) {
    // Øyene (client:only) hydrerer ETTER load — vent til hver astro-island har
    // innhold, og deretter til ingen lastetekster står igjen.
    const hydrated = await cdp.eval("Array.from(document.querySelectorAll('astro-island')).every((el) => el.children.length > 0)");
    const txt = await cdp.eval('document.body.innerText');
    const waitFor = s.waitFor ? txt.includes(s.waitFor) : true;
    if (hydrated && waitFor && !gone.some((g) => txt.includes(g))) { ready = true; break; }
    await sleep(250);
  }
  await sleep(s.settle ?? 400);
  if (s.scroll) { await cdp.eval(`window.scrollTo(0, ${s.scroll}); 'ok'`); await sleep(400); }
  if (s.click) { await cdp.eval(`document.querySelector(${JSON.stringify(s.click)})?.click(); 'ok'`); await sleep(400); }
  if (s.eval) { await cdp.eval(s.eval); await sleep(300); }
  const params = {format: 'png'};
  if (s.fullPage) {
    const {contentSize} = await cdp.send('Page.getLayoutMetrics');
    await cdp.send('Emulation.setDeviceMetricsOverride', {width: w, height: Math.min(Math.ceil(contentSize.height), 6000), deviceScaleFactor: s.scale ?? 1, mobile: !!s.mobile});
    await sleep(300);
    params.captureBeyondViewport = true;
  }
  const {data} = await cdp.send('Page.captureScreenshot', params);
  const file = join(outDir, `${s.name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  const text = (await cdp.eval('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 220);
  const probe = s.probe ? await cdp.eval(s.probe) : undefined;
  report.push({name: s.name, ready, file, text, probe});
}
console.table(report.map((r) => ({name: r.name, ready: r.ready, text: r.text.slice(0, 90), probe: r.probe})));
if (consoleErrors.length) console.log('JS-feil:', consoleErrors);
ws.close();
chrome.kill();
process.exit(0);
