/**
 * @format
 *
 * DESIGNRIGG FOR KAMPENS PULS — ikke en vanlig test.
 *
 * Den tegner den EKTE modellen (`src/shared/matchPulse`) til en HTML-side som
 * headless Chrome kan fotografere, slik at flaten kan SES før den bygges.
 * Riggen fant ni feil i modellen som ingen enhetstest ville tatt: markører
 * som ble klippet, ulike hendelsestyper stablet oppå hverandre, faser som
 * påsto to ting om samme minutt.
 *
 * ⚠️ HOPPES OVER I VANLIG KJØRING. Den kjører bare med `PULSE_OUT` satt:
 *
 *   PULSE_OUT=/tmp/p.html npx jest __tests__/pulseModel.harness.test.ts
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
 *     --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
 *     --screenshot=/tmp/p.png --window-size=393,1400 file:///tmp/p.html
 *
 * Se `docs/KAMPENS-PULS-MODELL.md`.
 */
import * as fs from 'fs';
import {
  buildPulseModel,
  buildPulseMoments,
  buildPulseTicks,
  matchPulseTimeline,
  PULSE_BAND,
  PULSE_MARK_R,
  PULSE_MID,
  PULSE_TICK_R,
  type PulseModel,
} from '../src/shared/matchPulse';
import {
  matchPulseMomentText,
  matchPulsePhaseText,
  matchPulseResponseText,
} from '../src/shared/matchCopy';
import type {MatchEngagement} from '../src/shared/matchEngagement';
import type {MatchEvent} from '../src/shared/types';

const OUT = process.env.PULSE_OUT;
const S = new Date('2026-08-21T18:00:00Z');
const PAD_H = 20;
const CURVE_PAD = 10;

/** Hendelse på et bestemt SEKUND etter avspark — som i prod. */
const stamp = (sek: number) => new Date(S.getTime() + sek * 1000);
const g = (id: string, m: number, us: boolean, player?: string): MatchEvent => ({
  id, matchId: 'm', type: 'mål', minute: m, description: '',
  teamSide: us ? 'home' : 'away', player, createdAt: stamp(m * 60),
});
const gS = (id: string, sek: number, us: boolean, player?: string): MatchEvent => ({
  id, matchId: 'm', type: 'mål', minute: Math.floor(sek / 60), description: '',
  teamSide: us ? 'home' : 'away', player, createdAt: stamp(sek),
});
const u = (id: string, m: number): MatchEvent =>
  ({id, matchId: 'm', type: 'melding', minute: m, description: 'Vi presser', createdAt: stamp(m * 60)});
const r = (id: string, m: number, t: MatchEvent['type']): MatchEvent =>
  ({id, matchId: 'm', type: t, minute: m, description: '', createdAt: stamp(m * 60)});
const rS = (id: string, sek: number, t: MatchEvent['type']): MatchEvent =>
  ({id, matchId: 'm', type: t, minute: Math.floor(sek / 60), description: '', createdAt: stamp(sek)});
const f = (id: string, m: number, author?: string) =>
  ({id, createdAt: new Date(S.getTime() + m * 60_000), authorName: author});

// Appens EGNE ikoner: Ball fra icons.tsx, resten fra samme Lucide-sett.
const BALL =
  '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.4 8.8 10.7l1.2 3.8h4l1.2-3.8z"/>' +
  '<path d="M12 3.5v4.9M4 9.8l4.8 1M20 9.8l-4.8 1M7.2 19.2l2.8-3.4M16.8 19.2l-2.8-3.4"/>';
const MSG =
  '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>';
const CAM =
  '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>';
const GLYPH = {goalUs: BALL, goalThem: BALL, update: MSG, photo: CAM};
const RANG = {goalUs: 3, goalThem: 3, update: 2, photo: 1};
const SKIN = {
  goalUs: {bg: '#02FFAB', ink: '#08392E'},
  goalThem: {bg: 'rgba(143,163,172,.26)', ink: '#C3D4DA', border: 'rgba(195,212,218,.5)'},
  update: {bg: '#FFC53D', ink: '#5C4A00'},
  photo: {bg: '#C6FFE9', ink: '#08392E'},
};

interface Scene {
  navn: string;
  events: MatchEvent[];
  photos?: {id: string; createdAt: Date; authorName?: string}[];
  now?: number;
  finished?: boolean;
  heia?: [string, number, number?][];
  valgt?: string;
  width?: number;
}

function build(s: Scene): {model: PulseModel; width: number} {
  const width = s.width ?? 393;
  const byMatchEvent = new Map<string, MatchEngagement>(
    (s.heia ?? []).map(([id, h, k]) => [
      id, {postId: id, heiaCount: h, commentCount: k ?? 0, iReacted: false},
    ]),
  );
  const timeline = matchPulseTimeline(s.events, byMatchEvent, S, s.now, s.finished ?? true);
  const model = buildPulseModel(
    buildPulseMoments({
      matchEvents: s.events, photos: s.photos ?? [], startedAt: S,
      byMatchEvent, byPost: new Map(),
    }, timeline),
    buildPulseTicks(s.events, byMatchEvent, S, timeline),
    timeline,
    {width: width - PAD_H * 2, pad: CURVE_PAD},
  );
  return {model, width, timeline};
}

function marker(c: PulseModel['clusters'][number], valgt: boolean): string {
  const skin = SKIN[c.kind];
  const R = PULSE_MARK_R;
  const ikon = `<g transform="translate(${(c.x - R * 0.62).toFixed(1)} ${(c.y - R * 0.62).toFixed(1)}) scale(${((R * 1.24) / 24).toFixed(3)})" fill="none" stroke="${skin.ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${GLYPH[c.kind]}</g>`;
  const badge = c.moments.length > 1
    ? `<circle cx="${(c.x + R * 0.82).toFixed(1)}" cy="${(c.y - R * 0.82).toFixed(1)}" r="8.5" fill="#123325" stroke="rgba(234,255,246,.35)" stroke-width=".7"/><text x="${(c.x + R * 0.82).toFixed(1)}" y="${(c.y - R * 0.82 + 3.5).toFixed(1)}" font-size="10" font-weight="800" fill="#EAFFF6" text-anchor="middle">${c.moments.length}</text>` : '';
  const boble = c.comments > 0
    ? `<circle cx="${(c.x - R * 0.82).toFixed(1)}" cy="${(c.y + R * 0.82).toFixed(1)}" r="8" fill="rgba(14,41,29,.94)" stroke="rgba(234,255,246,.3)" stroke-width=".7"/><text x="${(c.x - R * 0.82).toFixed(1)}" y="${(c.y + R * 0.82 + 3.3).toFixed(1)}" font-size="9.5" font-weight="800" fill="#C8E6D8" text-anchor="middle">${c.comments}</text>` : '';
  return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${R}" fill="${skin.bg}" ${'border' in skin ? `stroke="${(skin as {border: string}).border}" stroke-width="1"` : ''}/>${ikon}${valgt ? `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${R + 1.4}" fill="none" stroke="#EAFFF6" stroke-width="1.6"/>` : ''}${badge}${boble}`;
}

function section(s: Scene): string {
  const {model, width, timeline} = build(s);
  const inner = width - PAD_H * 2;
  const valgt = model.moments.find(m => m.key === s.valgt);
  const idx = model.moments.findIndex(m => m.key === s.valgt);
  const nowSek = ((s.now ?? 0) * 60_000 + S.getTime() - timeline.origin) / 1000;
  const nowX = CURVE_PAD +
    (Math.min(Math.max(nowSek, 0), model.span) / model.span) * (inner - CURVE_PAD * 2);

  const footer = valgt
    ? `<div class="sel"><div class="r"><b>${matchPulseMomentText(valgt)}</b><span class="step">‹ ${idx + 1}/${model.moments.length} ›</span></div>
       <div class="r"><span class="resp">${matchPulseResponseText(valgt)}</span><span class="show">Vis i historien ›</span></div></div>`
    : `<div class="fase">${model.phases.map(p => `<span class="ph ${p.kind}">${matchPulsePhaseText(p)}</span>`).join('')}</div>`;

  return `<div class="navn">${s.navn} <em>(${width} pt · ${model.span < 120 ? `${model.span.toFixed(0)} sek` : `${(model.span / 60).toFixed(0)}′`} · ${model.clusters.length} markører · ${model.touch.length} trykkflater)</em></div>
  <div class="phone" style="width:${width}px"><div class="sec">
    <div class="lab"><span>Kampens puls</span><span class="min">${s.finished === false ? `NÅ ${s.now ?? 0}′` : 'SLUTT'}</span></div>
    <svg width="${inner}" height="${PULSE_BAND}">
      <defs>
        <linearGradient id="us" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02FFAB" stop-opacity=".30"/><stop offset="1" stop-color="#02FFAB" stop-opacity=".02"/></linearGradient>
        <linearGradient id="them" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FA3AC" stop-opacity=".03"/><stop offset="1" stop-color="#8FA3AC" stop-opacity=".26"/></linearGradient>
        <radialGradient id="haloUs"><stop offset="0" stop-color="#02FFAB" stop-opacity=".5"/><stop offset="1" stop-color="#02FFAB" stop-opacity="0"/></radialGradient>
        <radialGradient id="haloThem"><stop offset="0" stop-color="#C3D4DA" stop-opacity=".3"/><stop offset="1" stop-color="#C3D4DA" stop-opacity="0"/></radialGradient>
        <clipPath id="up"><rect x="0" y="0" width="${inner}" height="${PULSE_MID}"/></clipPath>
        <clipPath id="down"><rect x="0" y="${PULSE_MID}" width="${inner}" height="${PULSE_BAND - PULSE_MID}"/></clipPath>
      </defs>
      <path d="${model.fill}" fill="url(#us)" clip-path="url(#up)"/>
      <path d="${model.fill}" fill="url(#them)" clip-path="url(#down)"/>
      ${model.ticks.map(t => `<circle cx="${t.x.toFixed(1)}" cy="${PULSE_MID}" r="${PULSE_TICK_R}" fill="#123325" stroke="rgba(234,255,246,.22)"/><rect x="${(t.x - 1.8).toFixed(1)}" y="${PULSE_MID - 3}" width="1.4" height="6" rx=".7" fill="#C8E6D8"/><rect x="${(t.x + 0.4).toFixed(1)}" y="${PULSE_MID - 3}" width="1.4" height="6" rx=".7" fill="#C8E6D8"/>`).join('')}
      <rect x="${CURVE_PAD}" y="${PULSE_MID - 0.5}" width="${inner - CURVE_PAD * 2}" height="1" fill="rgba(234,255,246,.20)"/>
      <path d="${model.ribbon}" fill="#02FFAB" opacity=".22"/>
      <path d="${model.line}" fill="none" stroke="#EAFFF6" stroke-opacity=".8" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
      ${model.clusters.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.glow.toFixed(1)}" fill="url(#halo${c.side === 1 ? 'Us' : 'Them'})"/>`).join('')}
      ${s.finished === false ? `<rect x="${nowX.toFixed(1)}" y="12" width="1" height="${PULSE_BAND - 24}" fill="rgba(2,255,171,.5)"/><circle cx="${nowX.toFixed(1)}" cy="${PULSE_MID}" r="4" fill="#EAFFF6"/>` : ''}
      ${[...model.clusters].sort((a, b) => RANG[a.kind] - RANG[b.kind]).map(c => marker(c, !!valgt && c.moments.some(m => m.key === valgt.key))).join('')}
      ${model.touch.map(t => `<rect x="${t.left.toFixed(1)}" y="0" width="${t.width}" height="${PULSE_BAND}" fill="none" stroke="rgba(255,90,95,.30)" stroke-dasharray="3 3"/>`).join('')}
    </svg>
    ${footer}
  </div></div>`;
}

const EKTE: MatchEvent[] = [
  r('k', 0, 'avspark'), g('e1', 4, true, 'Jarle'), u('e2', 9), g('e3', 12, false),
  g('e4', 20, true, 'Nora'), r('p', 30, 'pause'), r('a', 30, 'andre_omgang'),
  u('e6', 34), g('e7', 35, true, 'Jarle'), g('e8', 37, true, 'Nora'),
  g('e9', 38, false), g('e11', 56, true, 'Tuva'), r('s', 60, 'slutt'),
];
// Brages faktiske kamp: 10–4 på under ett minutt, rapportert i serie.
const DIN: MatchEvent[] = [
  rS('k', 0, 'avspark'),
  ...Array.from({length: 10}, (_, i) => gS(`h${i}`, 3 + i * 5, true)),
  ...Array.from({length: 4}, (_, i) => gS(`b${i}`, 8 + i * 12, false)),
];

const KORT: MatchEvent[] = [
  rS('k', 0, 'avspark'),
  gS('s1', 5, true, 'Jarle'), gS('s2', 14, true, 'Nora'), gS('s3', 23, false),
  gS('s4', 31, true, 'Jarle'), gS('s5', 44, true, 'Tuva'), gS('s6', 56, true, 'Nora'),
  rS('sl', 60, 'slutt'),
];

const SCENES: Scene[] = [
  {navn: '⭐ 60-SEKUNDERSKAMP: mål på 5, 14, 23, 31, 44, 56 sek (alle viser 0′)', events: KORT},
  {navn: 'A · DIN KAMP: 10–4, alt i minutt 0', events: DIN, now: 0, finished: false},
  {navn: 'B · Realistisk 60′ med pause og bilder', events: EKTE, photos: [f('p1', 16, 'Nora'), f('p2', 52, 'Tuva')]},
  {navn: 'C · Samme, med et mål VALGT', events: EKTE, photos: [f('p1', 16), f('p2', 52)], valgt: 'e7', heia: [['e7', 24, 3]]},
  {navn: 'D · Ingen hendelser, live på 12′', events: [r('k', 0, 'avspark')], now: 12, finished: false},
  {navn: 'E · Ett mål i 20′ av 40′', events: [r('k', 0, 'avspark'), g('x', 20, true, 'Nora'), r('s', 40, 'slutt')]},
  {navn: 'F · 0–3: kurven synker', events: [r('k', 0, 'avspark'), g('a', 12, false), g('b', 31, false), g('c', 55, false), r('s', 60, 'slutt')]},
  {navn: 'G · Tre mål på fire minutter', events: [r('k', 0, 'avspark'), g('a', 33, true), g('b', 35, true), g('c', 37, true), u('d', 50), r('s', 60, 'slutt')]},
  {navn: 'H · HEIA og kommentarer', events: [r('k', 0, 'avspark'), g('a', 8, true, 'Jarle'), u('b', 22), g('c', 41, false), g('d', 47, true, 'Nora'), r('s', 60, 'slutt')], heia: [['a', 24, 3], ['d', 61, 8], ['b', 4, 0]]},
  {navn: 'I · LITEN IPHONE (320 pt)', events: EKTE, photos: [f('p1', 16)], width: 320},
  {navn: 'J · Liten iPhone, din 10–4', events: DIN, now: 0, finished: false, width: 320},
];

(OUT ? it : it.skip)('modell', () => {
  fs.writeFileSync(OUT!, `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0E291D;font-family:-apple-system,system-ui,sans-serif;padding:8px 0;width:393px}
    .navn{color:#7FBFA3;font-size:11px;padding:0 20px 3px;font-weight:700}
    .navn em{color:#4E7F68;font-style:normal;font-weight:500}
    .phone{margin-bottom:12px}
    .sec{position:relative;padding:8px 20px 6px;background:linear-gradient(180deg,rgba(26,68,51,0) 0%,#1A4433 12%,#1A4433 88%,rgba(26,68,51,0) 100%)}
    .lab{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:4px}
    .lab span{font-size:11px;font-weight:800;letter-spacing:1.65px;text-transform:uppercase;color:#C8E6D8}
    .lab .min{color:#EAFFF6;letter-spacing:.5px;font-size:12.5px}
    svg{display:block}
    .fase,.sel{height:30px;display:flex;flex-direction:column;justify-content:center}
    .fase{flex-direction:row;align-items:center;gap:14px}
    .ph{font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:#02FFAB;opacity:.85}
    .ph.quiet{color:#C8E6D8;opacity:.6}
    .sel .r{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .sel b{font-size:12px;color:#EAFFF6;font-weight:700}
    .step{font-size:10.5px;color:#C8E6D8}
    .resp{font-size:11px;color:#C8E6D8}
    .show{font-size:11px;font-weight:800;color:#02FFAB}
  </style>${SCENES.map(section).join('')}`);
});
