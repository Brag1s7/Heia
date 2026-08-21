/**
 * @format
 *
 * KAMPENS PULS PÅ FLATEN.
 *
 * Modellen er bevist i `matchPulse.test.ts`. Her voktes det som bare kan gå
 * galt i sammensetningen:
 *
 *   1. **Minutt-tickeren tegner ikke kurven på nytt.** Skjermen re-rendrer
 *      hvert 30. sekund; kurven skal stå bom stille til noe faktisk skjer.
 *   2. **Hele pulsen er ÉTT justerbart tilgjengelighetselement** — ikke et
 *      dusin markørstopp rett før den samme tidslinjen.
 *   3. **«Vis i historien» er en SYNLIG handling**, ikke en skjult gest.
 *   4. **Ingen prosenter i svg** (3.1): alt tegnes i punkter etter måling.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

// Hooken selv testes ikke her, og dens asynkrone systemoppslag lander
// utenfor `act` og støyer.
let mockReducedMotion = false;
jest.mock('../src/components/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

import {MatchPulse} from '../src/components/match/MatchPulse';
import {PULSE_MID} from '../src/shared/matchPulse';
import type {MatchEvent} from '../src/shared/types';

const STARTED = new Date('2026-08-21T18:00:00Z');

const EVENTS: MatchEvent[] = [
  {id: 'e1', matchId: 'm1', type: 'avspark', minute: 0, description: ''},
  {
    id: 'e2',
    matchId: 'm1',
    type: 'mål',
    minute: 12,
    description: '',
    player: 'Jarle Vestli',
    teamSide: 'home',
  },
  {
    id: 'e3',
    matchId: 'm1',
    type: 'mål',
    minute: 27,
    description: '',
    teamSide: 'away',
  },
  {
    id: 'e4',
    matchId: 'm1',
    type: 'melding',
    minute: 31,
    description: 'Vi presser',
  },
];

const NO_ENGAGEMENT = {byMatchEvent: new Map(), byPost: new Map()};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  mockReducedMotion = false;
  jest.restoreAllMocks();
});

type Props = Partial<React.ComponentProps<typeof MatchPulse>>;

function element(props: Props = {}) {
  return (
    <MatchPulse
      matchEvents={EVENTS}
      photos={[]}
      startedAt={STARTED}
      engagement={NO_ENGAGEMENT}
      phase="live"
      minute={40}
      {...props}
    />
  );
}

function render(props: Props = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(element(props));
  });
  mounted.push(tree);
  layout(tree);
  return tree;
}

/** Fyrer målingen — uten den tegnes ingen flate i det hele tatt (3.1). */
function layout(tree: ReactTestRenderer.ReactTestRenderer) {
  const RNView = require('react-native').View;
  act(() => {
    for (const n of tree.root
      .findAllByType(RNView)
      .filter(v => typeof v.props.onLayout === 'function')) {
      n.props.onLayout({nativeEvent: {layout: {width: 393, height: 139}}});
    }
  });
}

function paths(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll(n => typeof n.props.d === 'string')
    .map(n => String(n.props.d));
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const RNText = require('react-native').Text;
  return tree.root
    .findAllByType(RNText)
    .map(n => n.props.children)
    .filter((c): c is string => typeof c === 'string');
}

/**
 * De trykkbare elementene, med `onPress` i behold — samme metode som
 * `matchEngagementRow.test.tsx`: `Pressable` er en memo/forwardRef-komponent
 * og lar seg ikke finne med `findAllByType`.
 */
function pressables(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(node => typeof node.props?.onPress === 'function', {
    deep: false,
  });
}

/** Trykkflatene i båndet — de har en målt bredde. */
function touchTargets(tree: ReactTestRenderer.ReactTestRenderer) {
  const {StyleSheet} = require('react-native');
  return pressables(tree)
    .map(p => StyleSheet.flatten(p.props.style))
    .filter(
      s => s && typeof s.left === 'number' && typeof s.width === 'number',
    );
}

function root(tree: ReactTestRenderer.ReactTestRenderer) {
  const RNView = require('react-native').View;
  return tree.root
    .findAllByType(RNView)
    .find(v => v.props.accessibilityRole === 'adjustable')!;
}

describe('pulsen på grunnen', () => {
  it('tegner først etter måling — og da i punkter, aldri prosent', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(element());
    });
    mounted.push(tree);
    expect(paths(tree)).toHaveLength(0);

    layout(tree);
    expect(paths(tree).length).toBeGreaterThan(0);

    // ⚠️ SKIVE 3.1: en prosenthøyde inne i svg regnes mot lerretets EGEN
    // oppmålte størrelse og blir stående på verdien fra første layout.
    for (const n of tree.root.findAll(
      v => v.props.width !== undefined || v.props.height !== undefined,
    )) {
      for (const v of [n.props.width, n.props.height]) {
        expect(String(v)).not.toContain('%');
      }
    }
  });

  it('samme minutt om igjen tegner IKKE kurven på nytt — memoen holder', () => {
    const tree = render({minute: 31});
    const før = paths(tree);
    act(() => {
      tree.update(element({minute: 31}));
    });
    expect(paths(tree)).toEqual(før);
  });

  it('en FERDIG kamp rører seg ikke uansett hva klokka sier', () => {
    // Tidsaksen er låst til kampens egen SLUTT, så tickeren er irrelevant.
    const ferdig = [
      ...EVENTS,
      {
        id: 'e5',
        matchId: 'm1',
        type: 'slutt' as const,
        minute: 60,
        description: '',
        createdAt: new Date(STARTED.getTime() + 60 * 60_000),
      },
    ];
    const tree = render({matchEvents: ferdig, phase: 'finished'});
    const før = paths(tree);
    act(() => {
      tree.update(
        element({matchEvents: ferdig, phase: 'finished', minute: 99}),
      );
    });
    expect(paths(tree)).toEqual(før);
  });

  it('LIVE: tickeren flytter NÅ-kanten, men hendelsene beholder forholdet', () => {
    // ⚠️ INGEN KVANTISERING (Brage). Høyre kant ER nå, så kurven strekkes —
    // men hendelsenes innbyrdes avstand er den samme, og det er dét som
    // gjør tidsaksen til EKTE tid.
    const forhold = (tree: ReactTestRenderer.ReactTestRenderer) => {
      const kurve = paths(tree).find(d => !d.endsWith('Z'))!;
      const x = [...kurve.matchAll(/([\d.]+) [\d.]+/g)].map(m => Number(m[1]));
      return (x[x.length - 1] - x[0]).toFixed(1);
    };
    const tree = render({minute: 31});
    const a = forhold(tree);
    act(() => {
      tree.update(element({minute: 32}));
    });
    // Kurven fyller fortsatt nøyaktig hele bredden.
    expect(forhold(tree)).toBe(a);
    expect(texts(tree)).toContain('NÅ 32′');
  });

  it('en NY HENDELSE tegner den derimot på nytt — også med samme antall', () => {
    const tree = render();
    const før = paths(tree);

    act(() => {
      tree.update(
        element({
          matchEvents: EVENTS.map(e =>
            e.id === 'e2' ? {...e, teamSide: 'away' as const} : e,
          ),
        }),
      );
    });

    expect(paths(tree)).not.toEqual(før);
  });

  it('sier aldri et nakent minutt, og aldri et minutt i pause', () => {
    expect(texts(render())).toContain('NÅ 40′');
    // Arenaen rett over skjuler tallet i pause (P2) — pulsen skal ikke
    // motsi den.
    expect(texts(render({phase: 'paused'}))).toContain('PAUSE');
    expect(texts(render({phase: 'finished'}))).toContain('SLUTT');
  });
});

describe('trykkflatene', () => {
  it('overlapper aldri, og er minst 44 pt brede', () => {
    const flater = touchTargets(render()).sort((a, b) => a.left - b.left);
    expect(flater.length).toBeGreaterThan(0);
    for (let i = 0; i < flater.length; i++) {
      expect(flater[i].width).toBeGreaterThanOrEqual(44);
      if (i > 0) {
        expect(flater[i].left).toBeGreaterThanOrEqual(
          flater[i - 1].left + flater[i - 1].width,
        );
      }
    }
  });

  it('DIN 10–4 i minutt 0 gir ÉN flate, ikke fjorten', () => {
    const alt: MatchEvent[] = [
      {id: 'k', matchId: 'm', type: 'avspark', minute: 0, description: ''},
      ...Array.from({length: 14}, (_, i) => ({
        id: `g${i}`,
        matchId: 'm',
        type: 'mål' as const,
        minute: 0,
        description: '',
        teamSide: (i < 10 ? 'home' : 'away') as 'home' | 'away',
      })),
    ];
    expect(touchTargets(render({matchEvents: alt, minute: 0}))).toHaveLength(1);
  });
});

describe('valget og «Vis i historien»', () => {
  it('et trykk velger øyeblikket og viser det som tekst', () => {
    const tree = render();
    act(() => pressables(tree)[0].props.onPress());
    expect(
      texts(tree).some(t => t.startsWith('12′ · Mål — Jarle Vestli')),
    ).toBe(true);
    expect(texts(tree)).toContain('Ingen heier eller kommentarer ennå');
    // ⚠️ SYNLIG HANDLING, ikke en skjult «trykk en gang til».
    expect(texts(tree)).toContain('Vis i historien');
  });

  it('«Vis i historien» melder fra om riktig hendelse', () => {
    const onShowInHistory = jest.fn();
    const tree = render({onShowInHistory});
    const {Text} = require('react-native');
    act(() => pressables(tree)[0].props.onPress());
    const knapp = pressables(tree).find(p =>
      p.findAllByType(Text).some(t => t.props.children === 'Vis i historien'),
    )!;
    act(() => knapp.props.onPress());
    expect(onShowInHistory).toHaveBeenCalledWith({
      eventId: 'e2',
      photoId: undefined,
    });
  });

  it('uten valg står fasene der i stedet — og de er aldri «press»', () => {
    const travel: MatchEvent[] = [
      {
        id: 'a',
        matchId: 'm',
        type: 'mål',
        minute: 2,
        description: '',
        teamSide: 'home',
      },
      {
        id: 'b',
        matchId: 'm',
        type: 'mål',
        minute: 4,
        description: '',
        teamSide: 'home',
      },
      {
        id: 'c',
        matchId: 'm',
        type: 'mål',
        minute: 6,
        description: '',
        teamSide: 'home',
      },
      {
        id: 'd',
        matchId: 'm',
        type: 'mål',
        minute: 48,
        description: '',
        teamSide: 'away',
      },
      {id: 'e', matchId: 'm', type: 'slutt', minute: 60, description: ''},
    ];
    const t = texts(render({matchEvents: travel, phase: 'finished'}));
    expect(t.some(x => x.startsWith('MEST LIV · '))).toBe(true);
    expect(t.some(x => x.startsWith('ROLIG · '))).toBe(true);
    expect(t.join(' ')).not.toMatch(/press|dominans/i);
  });
});

describe('ÉN justerbar enhet, ikke et dusin stopp', () => {
  it('hele pulsen er ett element med rolle «adjustable»', () => {
    const tree = render();
    const RNView = require('react-native').View;
    const adjustable = tree.root
      .findAllByType(RNView)
      .filter(v => v.props.accessibilityRole === 'adjustable');
    expect(adjustable).toHaveLength(1);
    expect(adjustable[0].props.accessible).toBe(true);
    // ⚠️ Markørene skal ALDRI bli parallelle stopp foran tidslinjen.
    expect(
      tree.root
        .findAllByType(RNView)
        .filter(v => v.props.accessibilityRole === 'button'),
    ).toHaveLength(0);
  });

  it('labelen oppsummerer kampen og periodene', () => {
    const label = root(render()).props.accessibilityLabel as string;
    expect(label).toContain('Kampens puls');
    expect(label).toContain('40 minutter spilt');
    expect(label).toContain('3 øyeblikk');
    expect(label).toContain('Sveip opp eller ned');
  });

  it('sveip opp/ned blar mellom øyeblikkene, og verdien leser det valgte', () => {
    const tree = render();
    const fyr = (actionName: string) =>
      act(() =>
        root(tree).props.onAccessibilityAction({nativeEvent: {actionName}}),
      );

    expect(root(tree).props.accessibilityValue).toBeUndefined();

    fyr('increment');
    expect(root(tree).props.accessibilityValue.text).toContain('1 av 3');
    expect(root(tree).props.accessibilityValue.text).toContain('Mål for oss');
    expect(root(tree).props.accessibilityValue.text).toContain('Jarle Vestli');

    fyr('increment');
    expect(root(tree).props.accessibilityValue.text).toContain('2 av 3');
    expect(root(tree).props.accessibilityValue.text).toContain('Mål imot');

    fyr('decrement');
    expect(root(tree).props.accessibilityValue.text).toContain('1 av 3');
  });

  it('aktivering viser det valgte i historien', () => {
    const onShowInHistory = jest.fn();
    const tree = render({onShowInHistory});
    const fyr = (actionName: string) =>
      act(() =>
        root(tree).props.onAccessibilityAction({nativeEvent: {actionName}}),
      );
    fyr('increment');
    fyr('activate');
    expect(onShowInHistory).toHaveBeenCalledWith({
      eventId: 'e2',
      photoId: undefined,
    });
  });

  it('en kamp uten øyeblikk sier det, og tilbyr ingen blaing', () => {
    const tom = render({matchEvents: [], minute: 8});
    expect(root(tom).props.accessibilityLabel).toContain(
      'Ingen rapporterte øyeblikk ennå',
    );
    expect(root(tom).props.accessibilityActions).toBeUndefined();
  });
});

describe('bevegelse', () => {
  it('tidsaksens omkvantisering er en MILD overgang, ikke et hopp', () => {
    const tree = render({minute: 31});
    const {Animated} = require('react-native');
    const band = tree.root.findAllByType(Animated.View)[0];
    expect(band).toBeDefined();

    // 31′ → 36′ flytter span fra 35 til 40.
    act(() => {
      tree.update(element({minute: 36}));
    });
    expect(paths(tree).length).toBeGreaterThan(0);
  });

  it('REDUCE MOTION bytter direkte — ingen animasjon', () => {
    const {Animated} = require('react-native');
    const timing = jest.spyOn(Animated, 'timing');
    mockReducedMotion = true;

    const tree = render({minute: 31});
    act(() => {
      tree.update(element({minute: 36}));
    });

    expect(timing).not.toHaveBeenCalled();
  });
});

describe('midtlinja', () => {
  it('en kamp uten hendelser er en rett strek på midtlinja', () => {
    const tree = render({matchEvents: [], minute: 12});
    const kurve = paths(tree).find(d => !d.endsWith('Z'))!;
    for (const m of kurve.matchAll(/[\d.]+ ([\d.]+)/g)) {
      expect(Number(m[1])).toBeCloseTo(PULSE_MID, 5);
    }
  });
});
