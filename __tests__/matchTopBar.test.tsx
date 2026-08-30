/**
 * @format
 *
 * KAMPENS TOPPFLATE (skive 6) — vaktene, og den ene som koster en telefonrunde.
 *
 * ⚠️ DEN VIKTIGSTE TESTEN HER ER `toppflaten er ikke i scroll-flaten`.
 * Runde 1 brukte `stickyHeaderIndices`, og telefonen avviste den: RN fester
 * et sticky barn til en posisjon i INNHOLDET, så baren hoppet ned til
 * arenaens underkant i det man blar tilbake, og fadet spilte av der. Flytter
 * noen baren inn i `ScrollView`-en igjen, kommer nøyaktig samme feil tilbake
 * — og den er usynlig i alt annet enn en telefon.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Animated, ScrollView} from 'react-native';

jest.mock('../src/lib/media/MediaImage', () => {
  const {View} = require('react-native');
  return {MediaImage: (props: object) => <View {...props} />};
});

jest.mock('../src/context', () => ({
  useActiveTeam: () => ({
    activeTeamSpace: {id: 't1', color: '#D92B2B', displayName: 'Ham-Kam G14'},
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useIsFocused: () => true,
}));

import {
  MatchTopBar,
  matchTopBarThreshold,
  useMatchTopBar,
} from '../src/components/match/MatchTopBar';
import {LiveMatch} from '../src/components/match/LiveMatch';
import {FinishedMatch} from '../src/components/match/FinishedMatch';
import {LiveBadge} from '../src/components/LiveBadge';
import {useGoalMoment} from '../src/components/useGoalMoment';
import {matchPulseClock} from '../src/shared/matchCopy';
import {matchColors} from '../src/theme';
import type {HeiaEventDetail, MatchEvent} from '../src/shared/types';

const BAR = {
  homeTeam: 'Ham-Kam G14',
  awayTeam: 'Ridabu G14',
  homeScore: 2,
  awayScore: 1,
} as const;

const NO_ENGAGEMENT = {byMatchEvent: new Map(), byPost: new Map()};

/** En ekte, men inaktiv, interpolasjon — nok for alt som ikke ruller. */
const stillProgress = () =>
  new Animated.Value(0).interpolate({inputRange: [0, 1], outputRange: [0, 1]});

// ⚠️ SEIER-SPRINGEN HAR EN 250 ms-LUNTE (ScoreBoard/MatchArena: delay: 250,
// kamprapport-fixturen her er 2–1). Uten unmount kjører aldri effect-
// cleanupen som stopper den, og timeren DETONERER I NESTE TESTSUITE på
// samme worker (funnet 2026-08-27: tilfeldig suite feilet med
// `getNativeTagFromPublicInstance is not a function`). Samme mønster som
// matchArena/finishedMatch.
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  // `useReducedMotion` spør gjennom et løfte — uten `async act` løses det
  // etter testen og React Native laster en native modul i et revet miljø.
  await act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  mounted.push(tree);
  return tree;
}

/** Alle host-nodene i utskriften, flatet ut. */
function nodes(node: unknown, out: {type: string; props: never}[] = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach(n => nodes(n, out));
    return out;
  }
  out.push(node as never);
  nodes((node as {children?: unknown}).children, out);
  return out;
}

/** Alle strengene i treet, flatet ut. */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(n => texts(n, out));
    return out;
  }
  if (node && typeof node === 'object') {
    texts((node as {children?: unknown}).children, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DEN DYRE FEILEN FRA RUNDE 1
// ---------------------------------------------------------------------------

const EVENTS: MatchEvent[] = [
  {id: 'e1', matchId: 'm1', type: 'avspark', minute: 0, description: 'I gang'},
  {
    id: 'e2',
    matchId: 'm1',
    type: 'mål',
    minute: 12,
    description: 'Mål for oss',
    player: 'Nora',
    teamSide: 'home',
  },
];

const EVENT = {
  id: 'ev1',
  teamSpaceId: 't1',
  type: 'kamp',
  title: 'Ham-Kam – Ridabu',
  startTime: new Date(2026, 7, 20, 18, 0),
  location: 'Briskeby',
  rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'venter'},
  score: {home: 2, away: 1},
  opponent: 'Ridabu G14',
  matchStatus: 'live',
  matchEvents: EVENTS,
  matchSessionId: 'ms1',
  attendees: {coming: [], notComing: [], pending: []},
} as unknown as HeiaEventDetail;

const liveMatch = (
  <LiveMatch
    event={EVENT}
    teamName="Ham-Kam G14"
    teamColor="#D92B2B"
    minute={36}
    isAdmin={false}
    isReporter={false}
    matchEvents={EVENTS}
    photos={[]}
    authorFor={() => undefined}
    engagement={NO_ENGAGEMENT}
    onChangeReporter={() => {}}
    onReporterAction={() => {}}
    onPickPhoto={() => {}}
    onPressPhoto={() => {}}
  />
);

const finishedMatch = (
  <FinishedMatch
    event={{...EVENT, matchStatus: 'finished'} as never}
    teamName="Ham-Kam G14"
    teamColor="#D92B2B"
    matchEvents={EVENTS}
    photos={[]}
    isAdmin={false}
    authorFor={() => undefined}
    engagement={NO_ENGAGEMENT}
    onPressPhoto={() => {}}
    onEdit={() => {}}
  />
);

describe('toppflaten er ikke i scroll-flaten', () => {
  /**
   * ⚠️ FLYTTES BAREN INN HIT IGJEN, KOMMER RUNDE 1s FEIL TILBAKE.
   * `stickyHeaderIndices` fester til innholdet, ikke til skjermen: baren ville
   * hoppet ned til arenaens underkant i det man blar tilbake, og først festet
   * seg etter ~430 pt på vei ned.
   */
  const assertScreenAnchored = (tree: ReactTestRenderer.ReactTestRenderer) => {
    const scroll = tree.root.findByType(ScrollView);
    expect(scroll.props.stickyHeaderIndices).toBeUndefined();
    const children = React.Children.toArray(
      scroll.props.children,
    ) as React.ReactElement[];
    expect(children.some(c => c.type === MatchTopBar)).toBe(false);
    expect(tree.root.findAllByType(MatchTopBar)).toHaveLength(1);
  };

  it('i den live kampen', async () => {
    assertScreenAnchored(await render(liveMatch));
  });

  it('i kamprapporten', async () => {
    assertScreenAnchored(await render(finishedMatch));
  });

  it('har ÉN tilbakeknapp, og den blir aldri dekket av en annen', async () => {
    const tree = await render(liveMatch);
    const back = nodes(tree.toJSON()).filter(
      n =>
        (n.props as {accessibilityLabel?: string}).accessibilityLabel ===
        'Tilbake',
    );
    expect(back).toHaveLength(1);
  });

  it('⚠️ PLATEN MÅ ALDRI MALE OVER CHEVRONEN', async () => {
    // Runde 2s ene feil: platen sto ETTER `BackBar` i treet og dekket
    // tilbakeknappen fullstendig i det baren tonet inn. Rekkefølgen mellom
    // søsknene ER malerekkefølgen, og feilen er usynlig i alt annet enn på
    // en telefon.
    const tree = await render(
      <MatchTopBar
        {...BAR}
        phase="live"
        minute={36}
        progress={stillProgress()}
        shown
      />,
    );
    const children = (tree.toJSON() as {children: unknown[]}).children;
    const flat = (c: unknown) =>
      Object.assign(
        {},
        ...[(c as {props: {style: unknown}}).props.style]
          .flat(2)
          .filter(Boolean),
      );
    const plate = children.findIndex(
      c => flat(c).backgroundColor === matchColors.groundTop,
    );
    const back = children.findIndex(c =>
      nodes(c).some(
        n =>
          (n.props as {accessibilityLabel?: string}).accessibilityLabel ===
          'Tilbake',
      ),
    );
    expect(plate).toBeGreaterThanOrEqual(0);
    expect(back).toBeGreaterThan(plate);
  });

  it('lar chevronen forbli levende — begge lagene slipper trykk forbi', async () => {
    // Baren TRENGER ikke blokkere: `ScrollView`-en begynner under raden, så
    // det ruller aldri innhold under den. Ville lagene tatt trykk, hadde de
    // i stedet drept tilbakeknappen som ligger under dem.
    const tree = await render(
      <MatchTopBar
        {...BAR}
        phase="live"
        minute={36}
        progress={stillProgress()}
        shown
      />,
    );
    const overlays = nodes(tree.toJSON()).filter(
      n => (n.props as {pointerEvents?: string}).pointerEvents !== undefined,
    );
    expect(overlays.length).toBeGreaterThanOrEqual(2);
    overlays.forEach(n =>
      expect((n.props as {pointerEvents?: string}).pointerEvents).toBe('none'),
    );
  });
});

// ---------------------------------------------------------------------------
// TERSKELEN — målt bånd, ref-tilstand, én endring per kryssing
// ---------------------------------------------------------------------------

describe('terskelen', () => {
  /** Monterer hooken og gir tilbake den FØRSTE onScroll — altså den closuren
   *  en memoisert handler faktisk ville sittet fast i. */
  async function mount(arenaHeight: number) {
    const shownLog: boolean[] = [];
    let firstOnScroll!: (e: never) => void;

    function Probe() {
      const s = useMatchTopBar();
      if (!firstOnScroll) {
        firstOnScroll = s.onScroll as never;
      }
      shownLog.push(s.shown);
      React.useEffect(() => {
        s.onArenaLayout({
          nativeEvent: {layout: {height: arenaHeight}},
        } as never);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }

    await render(<Probe />);
    // ⚠️ `Animated.event` MED NATIVE DRIVER RETURNERER ET OBJEKT, IKKE EN
    // FUNKSJON — det er nettopp dét som lar `Animated.ScrollView` hekte
    // hendelsen på native side. JS-lytteren ligger bak `__getHandler()`, og
    // det er den som flytter tilgjengelighetsgrensen.
    const handler = (
      firstOnScroll as unknown as {__getHandler: () => (e: never) => void}
    ).__getHandler();
    const scrollTo = async (offset: number) => {
      await act(async () => {
        handler({nativeEvent: {contentOffset: {y: offset}}} as never);
      });
    };
    const flips = () =>
      shownLog.filter((v, i) => i > 0 && v !== shownLog[i - 1]);
    return {shownLog, scrollTo, flips};
  }

  it('krysser én gang opp og én gang ned — sakte scroll', async () => {
    const {scrollTo, flips} = await mount(420);
    for (let y = 0; y <= 400; y += 2) {
      await scrollTo(y);
    }
    for (let y = 400; y >= 0; y -= 2) {
      await scrollTo(y);
    }
    expect(flips()).toEqual([true, false]);
  });

  it('overlever en fling som lander nøyaktig på terskelen', async () => {
    const {scrollTo, flips, shownLog} = await mount(420);
    const midt = matchTopBarThreshold(420);
    for (const y of [
      0,
      900,
      midt,
      midt + 1,
      midt,
      midt - 0.5,
      midt,
      midt + 2,
    ]) {
      await scrollTo(y);
    }
    expect(flips()).toEqual([true]);
    expect(shownLog[shownLog.length - 1]).toBe(true);
  });

  it('toggler riktig gjennom ti runder — ingen utdatert closure', async () => {
    const {scrollTo, flips} = await mount(420);
    for (let i = 0; i < 10; i++) {
      await scrollTo(900);
      await scrollTo(0);
    }
    // Nøyaktig 20 skifter — ikke 10 (annenhver tapt på en gammel closure) og
    // ikke 40 (dobbelt sett fordi state og ref sa ulike ting).
    expect(flips()).toHaveLength(20);
    expect(flips().every((v, i) => v === (i % 2 === 0))).toBe(true);
  });

  it('⚠️ BÅNDET MÅLES — en høy arena flytter terskelen nedover', async () => {
    // Et fast tall (prototypens 190) ville truffet feil sted så snart arenaen
    // vokser: rapport vs. live kamp, stor tekst, langt lagnavn.
    expect(matchTopBarThreshold(200)).toBeLessThan(matchTopBarThreshold(700));

    const lav = await mount(200);
    await lav.scrollTo(matchTopBarThreshold(200) + 20);
    expect(lav.shownLog[lav.shownLog.length - 1]).toBe(true);

    // Samme scroll-posisjon, høyere arena: stillingen er IKKE i toppen ennå.
    const hoy = await mount(700);
    await hoy.scrollTo(matchTopBarThreshold(200) + 20);
    expect(hoy.shownLog[hoy.shownLog.length - 1]).toBe(false);
    await hoy.scrollTo(matchTopBarThreshold(700) + 20);
    expect(hoy.shownLog[hoy.shownLog.length - 1]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TILGJENGELIGHET OG KLOKKE
// ---------------------------------------------------------------------------

describe('tilgjengelighet og klokke', () => {
  const bar = (shown: boolean) => (
    <MatchTopBar
      {...BAR}
      phase="live"
      minute={36}
      progress={stillProgress()}
      shown={shown}
    />
  );

  it('usynlig betyr helt borte — også for skjermleseren', async () => {
    const tree = await render(bar(false));
    const row = nodes(tree.toJSON()).find(
      n =>
        (n.props as {accessibilityElementsHidden?: boolean})
          .accessibilityElementsHidden === true,
    );
    expect(row).toBeDefined();
    expect(
      (row!.props as {importantForAccessibility?: string})
        .importantForAccessibility,
    ).toBe('no-hide-descendants');
    expect(
      (row!.props as {accessibilityLabel?: string}).accessibilityLabel,
    ).toBeUndefined();
  });

  it('leser lag, stilling og status som ÉN setning når den er framme', async () => {
    const tree = await render(bar(true));
    const labels = nodes(tree.toJSON())
      .map(n => (n.props as {accessibilityLabel?: string}).accessibilityLabel)
      .filter(Boolean);
    expect(labels).toContain('Ham-Kam G14 2, Ridabu G14 1. 36 minutter spilt.');
  });

  it('skjuler «Kampen» for skjermleseren når den er tonet bort', async () => {
    const tree = await render(bar(true));
    const title = nodes(tree.toJSON()).find(
      n => texts(n).join('') === 'Kampen',
    );
    expect(
      (title!.props as {accessibilityElementsHidden?: boolean})
        .accessibilityElementsHidden,
    ).toBe(true);
  });

  it('annonserer ALDRI seg selv — ingen live-region noe sted', async () => {
    const json = JSON.stringify((await render(bar(true))).toJSON());
    expect(json).not.toContain('accessibilityLiveRegion');
    expect(json).not.toContain('aria-live');
  });

  it.each([
    ['live' as const, 36],
    ['paused' as const, undefined],
    ['finished' as const, undefined],
  ])('viser NØYAKTIG samme streng som pulsen (%s)', async (phase, minute) => {
    const tree = await render(
      <MatchTopBar
        {...BAR}
        phase={phase}
        minute={minute}
        progress={stillProgress()}
        shown
      />,
    );
    // P2: hodet, pulsen og toppflaten skal arve samme beregnede tid. Her er
    // det samme FUNKSJON, så de kan ikke drifte fra hverandre.
    expect(texts(tree.toJSON())).toContain(
      matchPulseClock({phase, minute}).text,
    );
  });

  it('viser aldri et minutt i pause', async () => {
    const tree = await render(
      <MatchTopBar
        {...BAR}
        phase="paused"
        minute={36}
        progress={stillProgress()}
        shown
      />,
    );
    expect(texts(tree.toJSON()).join(' ')).not.toContain('36');
  });

  it('lar lagnavn ellipseres, men aldri stillingen eller statusen', async () => {
    const tree = await render(
      <MatchTopBar
        homeTeam="Hamar IL Fotball G14 Elite"
        awayTeam="Ridabu Idrettslag G14 2"
        homeScore={12}
        awayScore={4}
        phase="live"
        minute={108}
        progress={stillProgress()}
        shown
      />,
    );
    const style = (label: string) => {
      const node = nodes(tree.toJSON()).find(
        n => n.type === 'Text' && texts(n).join('') === label,
      );
      return Object.assign(
        {},
        ...[(node!.props as {style: unknown}).style].flat(2).filter(Boolean),
      );
    };
    expect(style('Hamar IL Fotball G14 Elite').flexShrink).toBe(1);
    expect(style('12–4').flexShrink).toBe(0);
    expect(style('NÅ 108′').flexShrink).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// REDUCE MOTION — også når den slås på MENS noe animerer
// ---------------------------------------------------------------------------

describe('Reduce Motion', () => {
  let flip: ((v: boolean) => void) | undefined;

  beforeEach(() => {
    flip = undefined;
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation((event, handler) => {
        if (event === 'reduceMotionChanged') {
          flip = handler as (v: boolean) => void;
        }
        return {remove: jest.fn()} as never;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  const withReduceMotion = (on: boolean) =>
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(on);

  /**
   * ⚠️ `useReducedMotion` SVARER GJENNOM ET LØFTE. Første frame kjenner ikke
   * innstillingen, så en sløyfe REKKER å starte før svaret kommer. Det som
   * betyr noe er derfor ikke «ble det startet noe», men «står det noe igjen
   * og kjører». Spionen under holder på hver `stop` så nettopp det kan måles.
   */
  function spyOnLoops() {
    const real = Animated.loop.bind(Animated);
    const stops: jest.Mock[] = [];
    const spy = jest.spyOn(Animated, 'loop').mockImplementation(((
      anim: never,
      cfg: never,
    ) => {
      const inst = real(anim, cfg);
      const stop = jest.fn(() => inst.stop());
      stops.push(stop);
      return {...inst, stop};
    }) as never);
    return {spy, stops};
  }

  it('toppflaten kobler ikke krysstoningen til scroll i det hele tatt', async () => {
    withReduceMotion(true);
    // En krysstoning som følger fingeren ER bevegelse utløst av scroll.
    // Stubben avslører om noen interpolasjon i det hele tatt ble hektet på.
    const interpolate = jest.fn(() => 0);
    const bar = (shown: boolean) => (
      <MatchTopBar
        {...BAR}
        phase="live"
        minute={36}
        progress={{interpolate} as never}
        shown={shown}
      />
    );
    const tree = await render(bar(false));
    // Først NÅ er innstillingen kjent — den første framen svarer på et løfte
    // som ikke er kommet, og sier ingenting om oppførselen.
    interpolate.mockClear();

    await act(async () => tree.update(bar(true)));

    expect(interpolate).not.toHaveBeenCalled();
  });

  it('⚠️ DE TO LAGENE TONER IKKE I SAMME BÅND', async () => {
    withReduceMotion(false);
    // Runde 3s feil: «Tilbake · Kampen» og stillingen sto begge på 50 %
    // midtveis og var uleselige oppå hverandre. Det gamle må være HELT borte
    // før det nye begynner å komme.
    const ranges: {inputRange: number[]; outputRange: number[]}[] = [];
    const interpolate = jest.fn((cfg: never) => {
      ranges.push(cfg as never);
      return 0;
    });
    await render(
      <MatchTopBar
        {...BAR}
        phase="live"
        minute={36}
        progress={{interpolate} as never}
        shown={false}
      />,
    );

    const naarBorte = (r: {inputRange: number[]; outputRange: number[]}) =>
      r.inputRange[r.outputRange.indexOf(0)];
    const ut = ranges.find(r => r.outputRange[0] === 1)!;
    const inn = ranges.find(
      r =>
        r.outputRange[0] === 0 && r.outputRange[r.outputRange.length - 1] === 1,
    )!;

    // «Tilbake · Kampen» er nede på 0 før stillingen forlater 0.
    expect(naarBorte(ut)).toBeLessThanOrEqual(inn.inputRange[1]);
  });

  it('uten innstillingen ER den koblet til scroll', async () => {
    withReduceMotion(false);
    const interpolate = jest.fn(() => 0);
    const tree = await render(
      <MatchTopBar
        {...BAR}
        phase="live"
        minute={36}
        progress={{interpolate} as never}
        shown={false}
      />,
    );
    interpolate.mockClear();

    await act(async () =>
      tree.update(
        <MatchTopBar
          {...BAR}
          phase="live"
          minute={36}
          progress={{interpolate} as never}
          shown
        />,
      ),
    );

    expect(interpolate).toHaveBeenCalled();
  });

  it('LiveBadge: ingen sløyfe står igjen og kjører, men merket blir stående', async () => {
    withReduceMotion(true);
    const {stops} = spyOnLoops();
    const tree = await render(<LiveBadge />);

    expect(stops).not.toHaveLength(0);
    stops.forEach(stop => expect(stop).toHaveBeenCalled());
    // Bevegelsen fjernes, ikke innholdet.
    expect(texts(tree.toJSON())).toContain('LIVE');
  });

  it('LiveBadge: en løpende sløyfe DØR når innstillingen slås på midtveis', async () => {
    withReduceMotion(false);
    const {spy, stops} = spyOnLoops();
    await render(<LiveBadge />);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(stops[0]).not.toHaveBeenCalled();

    await act(async () => flip?.(true));

    // Ikke bare «starter ingen ny»: den gamle sløyfa skal være stoppet, og
    // prikken satt tilbake til 1 — ellers står den på en tilfeldig skala.
    expect(stops[0]).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('useGoalMoment: spretten uteblir, men lysresponsen blir', async () => {
    withReduceMotion(true);
    const sequence = jest.spyOn(Animated, 'sequence');
    let scale!: Animated.Value;

    function Probe({home}: {home: number}) {
      scale = useGoalMoment(home, 0).scoreScale;
      return null;
    }

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<Probe home={0} />);
    });
    mounted.push(tree);
    sequence.mockClear();
    await act(async () => {
      tree.update(<Probe home={1} />);
    });

    // Nøyaktig én sekvens: feiringen. Spretten er borte.
    expect(sequence).toHaveBeenCalledTimes(1);
    expect(scale.__getValue()).toBe(1);
  });

  it('useGoalMoment: uten innstillingen spretter tallet OG verdenen lyser', async () => {
    withReduceMotion(false);
    const sequence = jest.spyOn(Animated, 'sequence');

    function Probe({home}: {home: number}) {
      useGoalMoment(home, 0);
      return null;
    }
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<Probe home={0} />);
    });
    mounted.push(tree);
    sequence.mockClear();
    await act(async () => {
      tree.update(<Probe home={1} />);
    });

    expect(sequence).toHaveBeenCalledTimes(2);
  });
});
