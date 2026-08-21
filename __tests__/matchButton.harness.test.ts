/**
 * @format
 *
 * DESIGNRIGG FOR KAMPKNAPPEN — ikke en vanlig test.
 *
 * Den tegner den EKTE geometrien (`src/shared/matchButtonGeometry`) og de
 * EKTE tilstandene (`src/shared/matchButton`) til en HTML-side som headless
 * Chrome kan fotografere, slik at baren kan SES før den bygges ferdig.
 *
 * ⚠️ Grunnen til at den finnes: pillen får lov å tegne noen punkter utenfor
 * faneelementet sitt når ordet er langt. En talltest kan bevise at
 * overflyten holder budsjettet — den kan IKKE se om «RAPPORTER» likevel
 * leses som om den ligger oppå Kalender.
 *
 * ⚠️ HOPPES OVER I VANLIG KJØRING. Den kjører bare med `TABBAR_OUT` satt:
 *
 *   TABBAR_OUT=/tmp/tab.html npx jest __tests__/matchButton.harness.test.ts
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
 *     --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
 *     --screenshot=/tmp/tab.png --window-size=460,1180 file:///tmp/tab.html
 */
import * as fs from 'fs';
import {matchButtonGeometry} from '../src/shared/matchButtonGeometry';
import {
  matchButtonHasGlyph,
  matchButtonState,
  type LiveMatchSummary,
  type MatchPresence,
} from '../src/shared/matchButton';

const OUT = process.env.TABBAR_OUT;

const LIVE: LiveMatchSummary = {
  eventId: 'e1',
  status: 'live',
  home: 2,
  away: 1,
  teamName: 'Ham-Kam G14',
  opponent: 'Ridabu G14',
};

function presence(over: Partial<MatchPresence>): MatchPresence {
  return {
    eventId: 'e1',
    isReporter: false,
    dockOpen: false,
    heiaTarget: {postId: 'p1', iReacted: false, what: 'målet på 34 minutter'},
    onPress: () => {},
    ...over,
  };
}

const SCENER = [
  ['Ingen livekamp', {presence: null, liveMatch: null}],
  ['Live, utenfor kampen', {presence: null, liveMatch: LIVE}],
  [
    'Pause, utenfor kampen',
    {presence: null, liveMatch: {...LIVE, status: 'halfTime' as const}},
  ],
  ['Inne, publikum', {presence: presence({}), liveMatch: LIVE}],
  [
    'Inne, alt heiet',
    {
      presence: presence({
        heiaTarget: {postId: 'p1', iReacted: true, what: 'målet'},
      }),
      liveMatch: LIVE,
    },
  ],
  [
    'Inne, ingenting skjedd',
    {presence: presence({heiaTarget: null}), liveMatch: LIVE},
  ],
  ['Inne, reporter', {presence: presence({isReporter: true}), liveMatch: LIVE}],
  [
    'Inne, reporter, dokk åpen',
    {
      presence: presence({isReporter: true, dockOpen: true}),
      liveMatch: LIVE,
    },
  ],
] as const;

const SKIN: Record<string, [string, string]> = {
  idle: ['#08392E', '#02FFAB'],
  live: ['#FF5A5F', '#FFFFFF'],
  pause: ['#FFC53D', '#5C4A00'],
  heia: ['#02FFAB', '#08392E'],
  'heia-tom': ['#C6FFE9', '#087A5A'],
  heiet: ['#C6FFE9', '#08392E'],
  rapporter: ['#08392E', '#02FFAB'],
  lukk: ['#02FFAB', '#08392E'],
};

const BREDDER = [430, 390, 320];

const maybe = OUT ? it : it.skip;

maybe('tegner tab-baren i alle tilstander', () => {
  const blokker = BREDDER.map(width => {
    const rader = SCENER.map(([navn, input]) => {
      const s = matchButtonState(input as never);
      const g = matchButtonGeometry(
        width,
        1,
        s.label,
        s.shortLabel,
        matchButtonHasGlyph(s.kind),
      );
      const [bg, ink] = SKIN[s.kind];
      const naboer = ['Hjem', 'Kalender', 'Varsler', 'Profil'];

      // Faneelementene tegnes som ekte celler, og pillen får lov å flyte ut
      // av sin — nøyaktig som i appen. Kanten på cellene er stiplet så
      // overflyten er SYNLIG.
      const celler = [
        `<div class="cell"><div class="ico"></div><div class="lab">${naboer[0]}</div></div>`,
        `<div class="cell"><div class="ico"></div><div class="lab">${naboer[1]}</div></div>`,
        `<div class="cell mid"><div class="pill" style="background:${bg};color:${ink};font-size:${g.fontSize.toFixed(
          2,
        )}px;padding:0 ${g.paddingH}px;letter-spacing:${g.letterSpacing.toFixed(
          2,
        )}px;height:${g.height}px">${
          g.hasGlyph ? '<span class="gl"></span>' : ''
        }${s.label}</div><div class="lab">${s.tabLabel}</div></div>`,
        `<div class="cell"><div class="ico"></div><div class="lab">${naboer[2]}</div></div>`,
        `<div class="cell"><div class="ico"></div><div class="lab">${naboer[3]}</div></div>`,
      ].join('');

      return `<div class="scene">
        <div class="name">${navn} · ${
        s.kind
      } · overflyt ${g.overflowPerSide.toFixed(1)} pt${
        g.overflowPerSide > 0 ? '' : ' (ingen)'
      }</div>
        <div class="bar" style="width:${width}px">${celler}</div>
      </div>`;
    }).join('');
    return `<h2>${width} pt</h2>${rader}`;
  }).join('');

  fs.writeFileSync(
    OUT as string,
    `<!doctype html><meta charset="utf-8"><style>
      body{background:#0B1911;color:#EAFFF6;font:13px -apple-system,system-ui;padding:20px;margin:0}
      h2{font-size:15px;margin:26px 0 10px;color:#C8E6D8}
      .name{font-size:11px;color:#7FB79C;margin:12px 0 4px}
      .bar{background:#FCFDF8;border-top:1px solid #E3E8DF;height:88px;
           display:grid;grid-template-columns:repeat(5,1fr);padding-top:9px;
           align-items:start;border-radius:4px}
      .cell{display:flex;flex-direction:column;align-items:center;gap:4px;
            outline:1px dashed rgba(255,90,95,.35);outline-offset:-1px;min-width:0}
      .ico{width:56px;height:30px;border-radius:15px;background:#EDF3EC}
      .lab{font-size:11px;font-weight:700;color:#6B7A70}
      .mid{overflow:visible}
      .pill{display:inline-flex;align-items:center;gap:7px;border-radius:99px;
            font-weight:900;white-space:nowrap;margin-top:-10px;
            font-family:Avenir Next,system-ui}
      .gl{width:14px;height:14px;border-radius:50%;background:currentColor;opacity:.9}
    </style>${blokker}`,
  );
});
