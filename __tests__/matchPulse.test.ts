/**
 * @format
 *
 * KAMPENS PULS — akseptansetestene Brage bestilte, pluss vaktene fra 5.1.
 *
 * Modellen er et komprimert kardiogram, ikke en bølge: ekte tidsakse, våre
 * mål opp og motstanderens ned, sosial respons som lys og aldri som et punkt
 * i tid. Hver test her svarer på ett av kravene i
 * `docs/KAMPENS-PULS-MODELL.md`.
 */
import {
  buildPulseModel,
  buildPulseMoments,
  buildPulseTicks,
  matchPhotoMinute,
  matchPulseTimeline,
  pulsePhases,
  pulseSignature,
  PULSE_BAND,
  PULSE_MID,
  type PulseInput,
  type PulseMoment,
} from '../src/shared/matchPulse';
import type {MatchEngagement} from '../src/shared/matchEngagement';
import type {MatchEvent} from '../src/shared/types';

const STARTED = new Date('2026-08-21T18:00:00Z');
const BOX = {width: 353, pad: 10};

/**
 * ⚠️ HENDELSENE HAR EKTE TIDSPUNKTER, som i prod. `minute` er avrundet;
 * posisjonen på tidsaksen kommer fra tidsstempelet. Fixturene setter det
 * på hendelsen (`createdAt`), som er der modellen leter først.
 */
function ev(over: Partial<MatchEvent> & {id: string}): MatchEvent {
  return {matchId: 'm1', type: 'mål', minute: 10, description: '', ...over};
}

/** Hendelse på et bestemt SEKUND etter avspark. */
function s(over: Partial<MatchEvent> & {id: string}, seconds: number) {
  return ev({
    ...over,
    minute: Math.floor(seconds / 60),
    createdAt: new Date(STARTED.getTime() + seconds * 1000),
  });
}

const mål = (
  id: string,
  minute: number,
  side: 'home' | 'away',
  player?: string,
) => s({id, teamSide: side, player}, minute * 60);
/** Mål registrert på et bestemt SEKUND. */
const målS = (id: string, seconds: number, side: 'home' | 'away') =>
  s({id, teamSide: side}, seconds);
const melding = (id: string, minute: number) =>
  s({id, type: 'melding', description: 'Vi presser'}, minute * 60);
const rytme = (id: string, minute: number, type: MatchEvent['type']) =>
  s({id, type}, minute * 60);
const rytmeS = (id: string, seconds: number, type: MatchEvent['type']) =>
  s({id, type}, seconds);
const bilde = (id: string, minute: number) => ({
  id,
  createdAt: new Date(STARTED.getTime() + minute * 60_000),
});

function eng(entries: [string, number, number?, boolean?][]) {
  return new Map<string, MatchEngagement>(
    entries.map(([postId, heiaCount, commentCount, iReacted]) => [
      postId,
      {
        postId,
        heiaCount,
        commentCount: commentCount ?? 0,
        iReacted: iReacted ?? false,
      },
    ]),
  );
}

function input(over: Partial<PulseInput> = {}): PulseInput {
  return {
    matchEvents: [],
    photos: [],
    startedAt: STARTED,
    byMatchEvent: new Map(),
    byPost: new Map(),
    ...over,
  };
}

function model(
  matchEvents: MatchEvent[],
  opts: {
    photos?: {id: string; createdAt: Date}[];
    now?: number;
    finished?: boolean;
    byMatchEvent?: Map<string, MatchEngagement>;
    byPost?: Map<string, MatchEngagement>;
  } = {},
) {
  const byMatchEvent = opts.byMatchEvent ?? new Map();
  const inn = input({
    matchEvents,
    photos: opts.photos ?? [],
    byMatchEvent,
    byPost: opts.byPost ?? new Map(),
  });
  // ⚠️ `now` i testene er MINUTTER etter avspark, mens tidslinja tar
  // KLOKKETID (00074). Oversettelsen er trygg her fordi ingen fixtur har
  // pause — i produksjon er de to aksene ikke lenger den samme.
  const timeline = matchPulseTimeline(
    matchEvents,
    byMatchEvent,
    STARTED,
    opts.now === undefined ? undefined : STARTED.getTime() + opts.now * 60_000,
    opts.finished ?? true,
  );
  return buildPulseModel(
    buildPulseMoments(inn, timeline),
    buildPulseTicks(matchEvents, byMatchEvent, STARTED, timeline),
    timeline,
    BOX,
  );
}

/** Alle y-verdiene kurven faktisk tegnes med. */
const ys = (line: string) =>
  [...line.matchAll(/[\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
const xs = (line: string) =>
  [...line.matchAll(/([\d.]+) [\d.]+/g)].map(m => Number(m[1]));

// ---------------------------------------------------------------------------

describe('1 · ingen hendelser → helt rolig puls', () => {
  it('kurven ligger på midtlinja hele veien, uten noder', () => {
    const m = model([rytme('k', 0, 'avspark')], {now: 12, finished: false});
    for (const y of ys(m.line)) {
      expect(y).toBeCloseTo(PULSE_MID, 5);
    }
    expect(m.clusters).toHaveLength(0);
  });

  it('grunnlinjebølgen er BORTE — en rett strek betyr nå «ingenting rapportert»', () => {
    const y = ys(model([], {now: 20, finished: false}).line);
    expect(Math.max(...y) - Math.min(...y)).toBe(0);
  });
});

describe('2 · ett mål i 20′ av en 40-minutters kamp', () => {
  const m = model([
    rytme('k', 0, 'avspark'),
    mål('g', 20, 'home', 'Nora'),
    rytme('s', 40, 'slutt'),
  ]);

  it('markøren står omtrent midt på, fordi x er EKTE KAMPTID', () => {
    const inner = BOX.width - BOX.pad * 2;
    const midten = BOX.pad + (inner - BOX.pad * 2) / 2 + BOX.pad;
    expect(m.clusters).toHaveLength(1);
    expect(m.clusters[0].x).toBeCloseTo(midten, 0);
  });

  it('og toppen ligger der markøren ligger', () => {
    const punkter = [...m.line.matchAll(/([\d.]+) ([\d.]+)/g)].map(p => ({
      x: Number(p[1]),
      y: Number(p[2]),
    }));
    const høyest = punkter.reduce((a, b) => (b.y < a.y ? b : a));
    expect(høyest.x).toBeCloseTo(m.clusters[0].x, -1);
  });
});

describe('3 · mål for og mot går hver sin vei', () => {
  it('vårt mål løfter kurven over midtlinja, motstanderens senker den under', () => {
    const oss = model([mål('g', 20, 'home'), rytme('s', 40, 'slutt')]);
    const dem = model([mål('g', 20, 'away'), rytme('s', 40, 'slutt')]);
    expect(Math.min(...ys(oss.line))).toBeLessThan(PULSE_MID);
    expect(Math.max(...ys(oss.line))).toBeCloseTo(PULSE_MID, 5);
    expect(Math.max(...ys(dem.line))).toBeGreaterThan(PULSE_MID);
    expect(Math.min(...ys(dem.line))).toBeCloseTo(PULSE_MID, 5);
  });

  it('underlinja er RESERVERT for mål imot — oppdatering og bilde ligger over', () => {
    const m = model([melding('u', 20)], {
      photos: [bilde('p', 30)],
    });
    expect(Math.max(...ys(m.line))).toBeCloseTo(PULSE_MID, 5);
    expect(m.clusters.every(c => c.side === 1)).toBe(true);
  });

  it('nøytrale hendelser ligger LAVT, så de aldri forveksles med et mål', () => {
    const toppen = (m: ReturnType<typeof model>) =>
      PULSE_MID - Math.min(...ys(m.line));
    const målHøyde = toppen(
      model([mål('g', 20, 'home'), rytme('s', 40, 'slutt')]),
    );
    const meldingHøyde = toppen(
      model([melding('u', 20), rytme('s', 40, 'slutt')]),
    );
    expect(meldingHøyde).toBeLessThan(målHøyde * 0.45);
  });
});

describe('4 · lang periode uten hendelser blir en lang, flat strek', () => {
  it('avstanden mellom to markører er proporsjonal med minuttdifferansen', () => {
    const m = model([
      mål('a', 10, 'home'),
      mål('b', 20, 'home'),
      mål('c', 50, 'home'),
      rytme('s', 60, 'slutt'),
    ]);
    const [x1, x2, x3] = m.clusters.map(c => c.x);
    // 10→20 er 10 minutter, 20→50 er 30. Forholdet skal være 3.
    expect((x3 - x2) / (x2 - x1)).toBeCloseTo(3, 1);
  });

  it('og strekningen mellom dem ligger på midtlinja', () => {
    const m = model([
      mål('a', 5, 'home'),
      mål('b', 55, 'home'),
      rytme('s', 60, 'slutt'),
    ]);
    const punkter = [...m.line.matchAll(/([\d.]+) ([\d.]+)/g)]
      .map(p => ({x: Number(p[1]), y: Number(p[2])}))
      .filter(p => p.x > m.clusters[0].x + 40 && p.x < m.clusters[1].x - 40);
    expect(punkter.length).toBeGreaterThan(20);
    for (const p of punkter) {
      expect(Math.abs(p.y - PULSE_MID)).toBeLessThan(0.6);
    }
  });
});

describe('5 · flere hendelser tett i tid blir én intens periode', () => {
  it('amplituden er større enn for ett enkelt mål', () => {
    const ett = model([mål('a', 35, 'home'), rytme('s', 60, 'slutt')]);
    const tre = model([
      mål('a', 34, 'home'),
      mål('b', 35, 'home'),
      mål('c', 36, 'home'),
      rytme('s', 60, 'slutt'),
    ]);
    expect(PULSE_MID - Math.min(...ys(tre.line))).toBeGreaterThan(
      PULSE_MID - Math.min(...ys(ett.line)),
    );
  });

  it('men den sprenger ikke båndet, uansett hvor mange mål', () => {
    const massakre = model([
      ...Array.from({length: 14}, (_, i) => mål(`g${i}`, 30, 'home')),
      rytme('s', 60, 'slutt'),
    ]);
    for (const y of ys(massakre.line)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(PULSE_BAND);
    }
  });
});

describe('6 · hendelsestypene har hver sin markør', () => {
  it('mål, mål imot, oppdatering og bilde gir fire ulike markørtyper', () => {
    const m = model(
      [
        mål('a', 8, 'home'),
        mål('b', 20, 'away'),
        melding('c', 34),
        rytme('s', 60, 'slutt'),
      ],
      {photos: [bilde('p', 48)]},
    );
    expect(m.clusters.map(c => c.kind).sort()).toEqual([
      'goalThem',
      'goalUs',
      'photo',
      'update',
    ]);
  });

  it('et mål og et bilde NOEN SEKUNDER fra hverandre er to markører', () => {
    // ⚠️ IKKE gruppert bare fordi begge viser «25′». Ni sekunder av en
    // 50-minutters kamp er lite — men i en kort kamp er det halve bredden.
    const kort = model(
      [
        rytmeS('k', 0, 'avspark'),
        målS('a', 20, 'home'),
        rytmeS('s', 60, 'slutt'),
      ],
      {photos: [{id: 'p', createdAt: new Date(STARTED.getTime() + 40_000)}]},
    );
    expect(kort.clusters).toHaveLength(2);
    expect(new Set(kort.clusters.map(c => c.kind))).toEqual(
      new Set(['goalUs', 'photo']),
    );
  });

  it('men i SAMME øyeblikk blir de én markør med ×2 — de kan ikke overlappe', () => {
    const m = model([mål('a', 25, 'home'), rytme('s', 50, 'slutt')], {
      photos: [bilde('p', 25)],
    });
    expect(m.clusters).toHaveLength(1);
    // Målet vinner ikonet; valget forklarer hva flokken inneholder.
    expect(m.clusters[0].kind).toBe('goalUs');
    expect(m.clusters[0].moments).toHaveLength(2);
  });
});

describe('7 · HEIA og kommentarer forsterker, men flytter ingenting', () => {
  const events = [
    mål('a', 12, 'home'),
    melding('b', 40),
    rytme('s', 60, 'slutt'),
  ];
  const uten = model(events);
  const med = model(events, {
    byMatchEvent: eng([
      ['a', 40, 3, true],
      ['b', 5, 1],
    ]),
  });

  it('kurven er tegn for tegn den samme', () => {
    expect(med.line).toBe(uten.line);
    expect(med.ribbon).toBe(uten.ribbon);
  });

  it('markørene ligger på nøyaktig samme punkt', () => {
    expect(med.clusters.map(c => [c.x, c.y])).toEqual(
      uten.clusters.map(c => [c.x, c.y]),
    );
  });

  it('men gløden vokser, kommentaren telles, og «du har heiet» bæres', () => {
    const a = med.clusters.find(c => c.key === 'a')!;
    expect(a.glow).toBeGreaterThan(uten.clusters[0].glow);
    expect(a.comments).toBe(3);
    expect(a.iReacted).toBe(true);
  });

  it('gløden er klemt — 400 heier fyller ikke rommet', () => {
    const enorm = model(events, {byMatchEvent: eng([['a', 4000]])});
    expect(enorm.clusters[0].glow).toBeLessThanOrEqual(17);
  });

  it('de lager ALDRI et eget punkt på tidsaksen', () => {
    expect(med.moments).toHaveLength(uten.moments.length);
    expect(med.clusters).toHaveLength(uten.clusters.length);
  });
});

describe('8 · sletting fjerner riktig puls og lar resten stå', () => {
  it('en angret hendelse forsvinner, de andre beholder plassen sin', () => {
    const alle = [
      mål('a', 10, 'home'),
      mål('b', 30, 'home'),
      mål('c', 50, 'home'),
      rytme('s', 60, 'slutt'),
    ];
    const før = model(alle);
    const etter = model(alle.filter(e => e.id !== 'b'));
    expect(etter.clusters.map(c => c.key)).toEqual(['a', 'c']);
    expect(etter.clusters[0].x).toBeCloseTo(før.clusters[0].x, 5);
    expect(etter.clusters[1].x).toBeCloseTo(før.clusters[2].x, 5);
  });
});

describe('9 · samme minutt gir stabil, deterministisk gruppering', () => {
  const sammeMinutt = [
    mål('a', 30, 'home'),
    mål('b', 30, 'home'),
    mål('c', 30, 'away'),
    rytme('s', 60, 'slutt'),
  ];

  it('to mål for oss blir én markør med ×2, motstanderens står for seg', () => {
    const m = model(sammeMinutt);
    const opp = m.clusters.find(c => c.side === 1)!;
    const ned = m.clusters.find(c => c.side === -1)!;
    expect(opp.moments.map(x => x.key)).toEqual(['a', 'b']);
    expect(ned.moments.map(x => x.key)).toEqual(['c']);
  });

  it('grupperingen er den samme uansett hvor mange ganger den kjøres', () => {
    const a = model(sammeMinutt);
    const b = model(sammeMinutt.map(e => ({...e})));
    expect(b.clusters.map(c => c.moments.map(x => x.key))).toEqual(
      a.clusters.map(c => c.moments.map(x => x.key)),
    );
  });
});

describe('10 · minutt-tickeren og tidsaksen', () => {
  const events = [
    rytme('k', 0, 'avspark'),
    mål('a', 12, 'home'),
    mål('b', 28, 'home'),
  ];

  it('en FERDIG kamp henter lengden fra sin egen SLUTT', () => {
    const alt = [...events, rytme('s', 47, 'slutt')];
    const t = matchPulseTimeline(alt, new Map(), STARTED, undefined, true);
    expect(t.span).toBe(47 * 60);
  });

  it('og bruker HELE BREDDEN: avspark helt til venstre, slutt helt til høyre', () => {
    const alt = [...events, rytme('s', 47, 'slutt')];
    const m = model(alt);
    const punkter = [...m.line.matchAll(/([\d.]+) [\d.]+/g)].map(x =>
      Number(x[1]),
    );
    expect(Math.min(...punkter)).toBeCloseTo(BOX.pad, 1);
    expect(Math.max(...punkter)).toBeCloseTo(BOX.width - BOX.pad, 1);
  });

  it('INGEN 5-MINUTTERSKVANTISERING — lengden er sekundene, ikke et gulv', () => {
    const kort = [rytmeS('k', 0, 'avspark'), rytmeS('s', 56, 'slutt')];
    const t = matchPulseTimeline(kort, new Map(), STARTED, undefined, true);
    expect(t.span).toBe(56);
  });

  it('et tick fra 31′ til 32′ flytter NÅ-kanten, ikke hendelsene', () => {
    const a = model(events, {now: 31, finished: false});
    const b = model(events, {now: 32, finished: false});
    // Kurven strekkes fordi høyre kant ER nå — men hendelsene beholder sitt
    // innbyrdes forhold, og det er dét som er ekte tid.
    const forhold = (m: ReturnType<typeof model>) => {
      const [x1, x2] = m.clusters.map(c => c.x);
      return (x2 - BOX.pad) / (x1 - BOX.pad);
    };
    expect(forhold(b)).toBeCloseTo(forhold(a), 6);
  });

  it('tidsstemplene er med i memo-nøkkelen — de ER posisjonen', () => {
    const inn = input({matchEvents: events, byMatchEvent: new Map()});
    const t = matchPulseTimeline(
      events,
      new Map(),
      STARTED,
      STARTED.getTime() + 40 * 60_000,
      false,
    );
    expect(pulseSignature(inn, t)).toBe(pulseSignature(inn, t));
    expect(pulseSignature(inn, {origin: t.origin, span: t.span + 60})).not.toBe(
      pulseSignature(inn, t),
    );
  });
});

describe('⭐ 60-SEKUNDERSKAMPEN — Brages testkamp', () => {
  // Mål ved 5, 14, 23, 31, 44 og 56 sekunder. Alle viser «0′» eller «1′»,
  // men de skjedde med flere sekunders mellomrom og skal fordeles over hele
  // linjen. Det var nettopp dette som kollapset i venstre kant.
  const SEK = [5, 14, 23, 31, 44, 56];
  const kort = [
    rytmeS('k', 0, 'avspark'),
    ...SEK.map((sek, i) => målS(`g${i}`, sek, i === 2 ? 'away' : 'home')),
    rytmeS('s', 60, 'slutt'),
  ];
  const m = model(kort);

  it('alle seks viser samme minutt — det er ikke posisjonen', () => {
    expect(new Set(m.moments.map(x => x.minute)).size).toBe(1);
  });

  it('men de ligger på SEKUNDET sitt, spredt over hele bredden', () => {
    const inner = BOX.width - BOX.pad * 2;
    m.moments.forEach((mo, i) => {
      expect(mo.seconds).toBe(SEK[i]);
    });
    m.clusters.forEach(c => {
      const forventet = BOX.pad + (c.moments[0].seconds / 60) * inner;
      expect(c.x).toBeCloseTo(forventet, 1);
    });
  });

  it('HELE BREDDEN brukes — seks separate markører, ingen klump', () => {
    expect(m.clusters).toHaveLength(6);
    const x = m.clusters.map(c => c.x).sort((a, b) => a - b);
    expect(x[0]).toBeLessThan(BOX.width * 0.15);
    expect(x[x.length - 1]).toBeGreaterThan(BOX.width * 0.8);
  });

  it('og de grupperes IKKE bare fordi de viser samme 1′', () => {
    // 9 sekunder av 60 er 15 % av bredden — godt over markørbredden.
    for (let i = 1; i < m.clusters.length; i++) {
      expect(m.clusters[i].x - m.clusters[i - 1].x).toBeGreaterThan(30);
    }
  });
});

describe('PAUSE er én liten markør på en sammenhengende linje', () => {
  const events = [
    rytme('k', 0, 'avspark'),
    mål('a', 10, 'home'),
    rytme('p', 30, 'pause'),
    rytme('o', 30, 'andre_omgang'),
    mål('b', 50, 'home'),
    rytme('s', 60, 'slutt'),
  ];
  const m = model(events);

  it('gir ÉN markør — ikke to, og ikke én per rytmehendelse', () => {
    expect(m.ticks).toHaveLength(1);
    expect(m.ticks[0].kind).toBe('pause');
  });

  it('ligger på sitt eget tidspunkt, halvveis i kampen', () => {
    const inner = BOX.width - BOX.pad * 2;
    expect(m.ticks[0].x).toBeCloseTo(BOX.pad + inner / 2, 1);
  });

  it('deler ikke kurven og lager ikke tomrom — linja er sammenhengende', () => {
    const punkter = [...m.line.matchAll(/([\d.]+) ([\d.]+)/g)].map(p => ({
      x: Number(p[1]),
      y: Number(p[2]),
    }));
    for (let i = 1; i < punkter.length; i++) {
      expect(punkter[i].x).toBeGreaterThan(punkter[i - 1].x);
      expect(Number.isFinite(punkter[i].y)).toBe(true);
    }
  });

  it('nullstiller ikke tiden — målet i 50′ ligger etter pausen', () => {
    const pause = m.ticks[0].x;
    expect(m.clusters[0].x).toBeLessThan(pause);
    expect(m.clusters[1].x).toBeGreaterThan(pause);
  });

  it('og rytmehendelsene former ikke kurven', () => {
    expect(m.moments.map(x => x.key)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// ⚠️ BRAGES TO OBLIGATORISKE KORREKSJONER
// ---------------------------------------------------------------------------

describe('KORREKSJON 1 · MEST LIV og ROLIG skal faktisk finnes', () => {
  const moments = (minutter: number[]): PulseMoment[] =>
    minutter.map((minute, i) => ({
      key: `m${i}`,
      minute,
      sequence: i,
      kind: 'goalUs',
      heia: 0,
      comments: 0,
      iReacted: false,
    }));

  it('finner kampens mest aktive vindu', () => {
    const faser = pulsePhases(moments([4, 9, 34, 35, 37, 38, 56]), 60);
    const liv = faser.find(f => f.kind === 'busiest')!;
    expect(liv).toBeDefined();
    expect(liv.from).toBeLessThanOrEqual(34);
    expect(liv.to).toBeGreaterThanOrEqual(38);
  });

  it('finner kampens lengste meningsfulle stilleperiode', () => {
    const faser = pulsePhases(moments([5, 20, 22, 24, 55]), 60);
    const ro = faser.find(f => f.kind === 'quiet')!;
    expect(ro).toEqual({kind: 'quiet', from: 24, to: 55});
  });

  it('og BESKJÆRER den heller enn å skjule den når de to møtes', () => {
    // Alt skjer tidlig: mest liv 0′–10′, og den lange stillheten etterpå
    // starter der livet slutter — ikke midt oppi det.
    const faser = pulsePhases(moments([2, 4, 6, 48, 50]), 60);
    expect(faser.find(f => f.kind === 'busiest')).toBeDefined();
    expect(faser.find(f => f.kind === 'quiet')).toEqual({
      kind: 'quiet',
      from: 10,
      to: 48,
    });
  });

  it('TIER når datagrunnlaget er tynt — ingen falsk dramatikk', () => {
    expect(pulsePhases(moments([20]), 60)).toEqual([]);
    expect(pulsePhases([], 60)).toEqual([]);
    // Tre jevnt spredte hendelser er ikke et «mest liv».
    expect(
      pulsePhases(moments([10, 30, 50]), 60).some(f => f.kind === 'busiest'),
    ).toBe(false);
  });

  it('viser ALDRI mer enn to, og de påstår aldri noe om samme minutt', () => {
    for (const sett of [
      [33, 34, 35, 36, 37],
      [1, 2, 3, 4, 5, 6, 7, 40],
      [5, 25, 26, 27, 28, 55],
    ]) {
      const faser = pulsePhases(moments(sett), 60);
      expect(faser.length).toBeLessThanOrEqual(2);
      if (faser.length === 2) {
        const [a, b] = faser;
        expect(a.to <= b.from || b.to <= a.from).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// VAKTENE FRA 5.1 — feilene som brakk på telefonen
// ---------------------------------------------------------------------------

describe('5.1-vaktene', () => {
  it('x er strengt økende — kurven kan ikke folde seg over seg selv', () => {
    for (const events of [
      [],
      Array.from({length: 5}, (_, i) => mål(`g${i}`, 0, 'home')),
      [mål('a', 40, 'home'), mål('b', 3, 'home'), mål('c', 25, 'away')],
    ]) {
      const x = xs(model([...events, rytme('s', 60, 'slutt')]).line);
      for (let i = 1; i < x.length; i++) {
        expect(x[i]).toBeGreaterThan(x[i - 1]);
      }
    }
  });

  it('alt i minutt 0 SAMLES ved starten — det er sant, og det skal vises', () => {
    const m = model(
      Array.from({length: 5}, (_, i) => mål(`g${i}`, 0, 'home')),
      {now: 0, finished: false},
    );
    for (const c of m.clusters) {
      expect(c.x).toBeCloseTo(BOX.pad, 5);
    }
    // …og resten av kampen er rolig.
    const høyre = [...m.line.matchAll(/([\d.]+) ([\d.]+)/g)]
      .map(p => ({x: Number(p[1]), y: Number(p[2])}))
      .filter(p => p.x > BOX.width * 0.5);
    for (const p of høyre) {
      expect(Math.abs(p.y - PULSE_MID)).toBeLessThan(0.6);
    }
  });

  it('bilde uten kjent kampstart dropper ut i stedet for minutt uendelig', () => {
    const foto = {id: 'p', createdAt: new Date()};
    expect(matchPhotoMinute(foto, undefined)).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      buildPulseMoments(input({photos: [foto], startedAt: undefined})),
    ).toHaveLength(0);
  });

  it('rytmehendelsene former ikke pulsen — bare pausen blir en markør', () => {
    const events = [
      rytme('k', 0, 'avspark'),
      rytme('p', 30, 'pause'),
      rytme('a', 30, 'andre_omgang'),
      rytme('s', 60, 'slutt'),
    ];
    const m = model(events);
    expect(m.moments).toHaveLength(0);
    expect(m.ticks).toHaveLength(1);
  });
});

describe('memoiseringsnøkkelen — LÅST, og den er ikke `length`', () => {
  const EVENTS = [
    rytme('k', 0, 'avspark'),
    mål('e2', 12, 'home'),
    mål('e3', 27, 'away'),
    melding('e4', 31),
  ];
  const TL = {origin: STARTED.getTime(), span: 60 * 60};
  const basis = () => pulseSignature(input({matchEvents: EVENTS}), TL);
  const ulik = (over: Partial<PulseInput>) => {
    if (over.matchEvents) {
      expect(over.matchEvents.length).toBe(EVENTS.length);
    }
    expect(pulseSignature(input({matchEvents: EVENTS, ...over}), TL)).not.toBe(
      basis(),
    );
  };

  it('samme innhold i en ny array gir samme nøkkel', () => {
    expect(
      pulseSignature(input({matchEvents: EVENTS.map(e => ({...e}))}), TL),
    ).toBe(basis());
  });

  it('rettet minutt, side, type og rekkefølge endrer den — med samme antall', () => {
    ulik({
      matchEvents: EVENTS.map(e => (e.id === 'e2' ? {...e, minute: 14} : e)),
    });
    ulik({
      matchEvents: EVENTS.map(e =>
        e.id === 'e2' ? {...e, teamSide: 'away' as const} : e,
      ),
    });
    ulik({
      matchEvents: EVENTS.map(e =>
        e.id === 'e4' ? {...e, type: 'mål' as const} : e,
      ),
    });
    const byttet = [...EVENTS];
    [byttet[1], byttet[3]] = [byttet[3], byttet[1]];
    ulik({matchEvents: byttet});
  });

  it('⭐ ET RETTET SEKUND endrer den — samme minutt, ny posisjon', () => {
    ulik({
      matchEvents: EVENTS.map(e =>
        e.id === 'e2'
          ? {...e, createdAt: new Date(e.createdAt!.getTime() + 9_000)}
          : e,
      ),
    });
  });

  it('en angret hendelse endrer den — id-en er borte', () => {
    expect(
      pulseSignature(
        input({matchEvents: EVENTS.filter(e => e.id !== 'e2')}),
        TL,
      ),
    ).not.toBe(basis());
  });

  it('HEIA, kommentarer og «jeg har heiet» endrer den — de tegner lys', () => {
    ulik({byMatchEvent: eng([['e2', 1]])});
    ulik({byMatchEvent: eng([['e2', 0, 1]])});
    ulik({byMatchEvent: eng([['e2', 0, 0, true]])});
  });

  it('TIDSLINJA er med — den er hele skalaen', () => {
    const inn = input({matchEvents: EVENTS});
    expect(pulseSignature(inn, {...TL, span: TL.span + 60})).not.toBe(basis());
    expect(pulseSignature(inn, {...TL, origin: TL.origin + 1000})).not.toBe(
      basis(),
    );
  });

  it('kampstart er med — den avgjør hvilket minutt hvert bilde havner på', () => {
    ulik({startedAt: new Date(STARTED.getTime() + 60_000)});
  });
});

// ---------------------------------------------------------------------------
// 00074 — HENDELSEN SKAL LIGGE DER DEN SKJEDDE, MED EN GANG
// ---------------------------------------------------------------------------

describe('⭐ 00074: pulsens tidsakse er KLOKKETID', () => {
  /**
   * ⚠️ FEILEN BRAGE SÅ (2026-08-21): «når man legger til en hendelse så vises
   * de først helt til venstre på pulsskiva, deretter hopper den til høyre».
   *
   * `stampOf` hadde tre kilder, og kilde 1 (`event.createdAt`) ble ALDRI
   * mappet — så en fersk hendelse falt gjennom til kilde 3,
   * `startedAt + minute * 60_000`. Det var riktig helt til 00073 gjorde
   * `minute` til FAKTISK SPILT TID: da peker uttrykket en hel pause for
   * tidlig, mens resten av kurven ligger på klokketid.
   *
   * Fixturen under ER den situasjonen: en kamp med 20 minutters pause.
   */
  const KICKOFF = STARTED.getTime();
  const wall = (min: number): Date => new Date(KICKOFF + min * 60_000);

  // Klokketid: avspark 0′, mål 10′, pause 20′–40′, mål 45′ (= spilt 25′).
  const medPause: MatchEvent[] = [
    {
      id: 'k',
      matchId: 'm',
      type: 'avspark',
      minute: 0,
      description: '',
      createdAt: wall(0),
    },
    {
      id: 'g1',
      matchId: 'm',
      type: 'mål',
      minute: 10,
      description: '',
      teamSide: 'home',
      createdAt: wall(10),
    },
    {
      id: 'p',
      matchId: 'm',
      type: 'pause',
      minute: 20,
      description: '',
      createdAt: wall(20),
    },
    {
      id: 'a',
      matchId: 'm',
      type: 'andre_omgang',
      minute: 20,
      description: '',
      createdAt: wall(40),
    },
    // ⚠️ minute = 25 (SPILT tid), createdAt = 45′ (KLOKKETID). Det er hele saken.
    {
      id: 'g2',
      matchId: 'm',
      type: 'mål',
      minute: 25,
      description: '',
      teamSide: 'home',
      createdAt: wall(45),
    },
  ];

  it('bruker hendelsens eget createdAt, ikke startedAt + minute', () => {
    const t = matchPulseTimeline(
      medPause,
      new Map(),
      STARTED,
      KICKOFF + 45 * 60_000,
      false,
    );
    const m = buildPulseMoments(
      input({
        matchEvents: medPause,
        photos: [],
        byMatchEvent: new Map(),
        byPost: new Map(),
      }),
      t,
    );
    const siste = m.find(x => x.key.includes('g2'))!;

    // 45 av 45 minutter = helt til høyre. Gjettingen ville gitt 25/45 = 56 %,
    // altså midt på skiva — og så et hopp når feed-posten landet.
    expect(siste.seconds).toBeCloseTo(45 * 60, 3);
    expect(siste.seconds / t.span).toBeCloseTo(1, 3);
  });

  it('⚠️ REGRESJONSVAKT: spilt tid ville lagt målet mye lenger til venstre', () => {
    // Den gamle formelen, skrevet ut. Står den igjen noe sted, er avstanden
    // her beviset på hvor galt det blir.
    const gjettet = (25 * 60) / (45 * 60);
    expect(gjettet).toBeLessThan(0.6);
  });

  it('nå-kanten er klokketid, så en fersk hendelse aldri faller utenfor', () => {
    // Nå-tallet er 45′ i klokketid. Hadde tidslinja fått SPILT tid (25′),
    // ville den ferskeste hendelsen ligget UTENFOR høyre kant.
    const feil = matchPulseTimeline(
      medPause,
      new Map(),
      STARTED,
      KICKOFF + 25 * 60_000,
      false,
    );
    // `Math.max(now, last)` redder bredden uansett — vakten er der med vilje.
    expect(feil.span).toBeCloseTo(45 * 60, 3);
  });
});
