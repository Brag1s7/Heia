/**
 * @format
 *
 * KAMPSKJERMEN MONTERER — og den er grønn hele veien ned.
 *
 * Skive 2 flyttet kampen ut av `EventDetailScreen` og ned på grunnen. Det som
 * kan gå galt uten at noen ser det i en enhetstest av en enkeltkomponent, er
 * nettopp SAMMENSETNINGEN: en flate som fortsatt tegner seg selv hvit, eller
 * en variant som ikke ble sendt videre.
 *
 * Derfor tester denne fila ÉN ting grundig: at ingen flate i kampverdenen
 * bærer appens lyse farger.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

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

import {LiveMatch} from '../src/components/match/LiveMatch';
import {colors} from '../src/theme';
import type {HeiaEventDetail, MatchEvent} from '../src/shared/types';

const EVENTS: MatchEvent[] = [
  {id: 'e1', matchId: 'm1', type: 'avspark', minute: 0, description: 'I gang'},
  {
    id: 'e2',
    matchId: 'm1',
    type: 'mål',
    minute: 12,
    description: 'Mål for oss',
    player: 'Erlend Hagen',
    teamSide: 'home',
  },
  {
    id: 'e3',
    matchId: 'm1',
    type: 'melding',
    minute: 31,
    description: 'Vi presser høyt nå.',
    reportedBy: 'u-jarle',
  },
];

const EVENT = {
  id: 'ev1',
  teamSpaceId: 't1',
  type: 'kamp',
  title: 'Ham-Kam – Ridabu',
  startTime: new Date(2026, 7, 20, 18, 0),
  location: 'Briskeby kunstgress 2',
  rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'venter'},
  score: {home: 2, away: 1},
  opponent: 'Ridabu G14',
  matchStatus: 'live',
  matchEvents: EVENTS,
  matchSessionId: 'ms1',
  startedAt: new Date(2026, 7, 20, 18, 0),
  attendees: {coming: [], notComing: [], pending: []},
} as unknown as HeiaEventDetail;

const REPORTER = {id: 'u-jarle', name: 'Jarle Vestli', avatarColor: '#1E7A46'};

/** Pulsen (skive 5) leser HEIA herfra. Tom = ingen glød, ingen kurveendring. */
const NO_ENGAGEMENT = {byMatchEvent: new Map(), byPost: new Map()};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(props: Partial<React.ComponentProps<typeof LiveMatch>> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <LiveMatch
        event={EVENT}
        matchEvents={EVENTS}
        teamName="Ham-Kam G14"
        teamColor="#D92B2B"
        minute={40}
        reporter={REPORTER}
        isAdmin
        isReporter={false}
        photos={[]}
        authorFor={id => (id === 'u-jarle' ? REPORTER : undefined)}
        engagement={NO_ENGAGEMENT}
        onChangeReporter={jest.fn()}
        onReporterAction={jest.fn()}
        onPickPhoto={jest.fn()}
        onPressPhoto={jest.fn()}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/**
 * Fargene som FAKTISK VINNER i treet.
 *
 * ⚠️ Stilarrayer må flates ut først. En variant som overstyrer
 * `backgroundColor: colors.surface` med `'transparent'` har fortsatt den
 * hvite verdien liggende i arrayet — leser man rått, «finner» man hvite kort
 * som ikke finnes. Derfor `StyleSheet.flatten`.
 */
function usedColors(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const {StyleSheet} = require('react-native');
  const out: string[] = [];

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as {props?: Record<string, unknown>; children?: unknown};
    const props = n.props ?? {};

    const flat = StyleSheet.flatten(props.style) ?? {};
    for (const key of ['backgroundColor', 'color', 'borderColor']) {
      const v = flat[key];
      if (typeof v === 'string') out.push(v.toUpperCase());
    }
    // Ikoner og svg bærer fargen som prop, ikke som stil.
    for (const key of ['color', 'stopColor', 'stroke', 'fill']) {
      const v = props[key];
      if (typeof v === 'string' && v.startsWith('#')) out.push(v.toUpperCase());
    }

    visit(n.children);
  };

  visit(tree.toJSON());
  return out;
}

describe('kampen monterer som én grønn verden', () => {
  it('tegner uten å kaste — tilskuer og reporter', () => {
    expect(render().toJSON()).toBeTruthy();
    expect(render({isReporter: true}).toJSON()).toBeTruthy();
  });

  it('bruker INGEN av appens lyse flater', () => {
    // «Hele skjermen er grønn, statuslinje til tab-bar. Ingen hvit eller
    // creamfarget flate.» Dette er den regelen, som test.
    //
    // ⚠️ RENT HVITT ER IKKE PÅ LISTA, og det er med vilje: den frosne
    // retningen har selv to hvite ting i kampverdenen — platen bak lagets
    // logo, og typen på den korale LIVE-pillen. Det som ikke får finnes er
    // KREMFAMILIEN og det mørke blekket som hører til den lyse verdenen.
    const forbidden = [
      colors.background,
      colors.surfaceMuted,
      colors.sun,
      colors.border,
      colors.borderSubtle,
      colors.textSecondary,
      colors.textTertiary,
    ].map(c => c.toUpperCase());

    for (const variant of [{}, {isReporter: true}]) {
      const used = usedColors(render(variant));
      for (const bad of forbidden) {
        expect(used).not.toContain(bad);
      }
    }
  });

  it('gir reporterpanelet kampvarianten, ikke de hvite knappene', () => {
    // Panelet bor i dokken fra skive 10 — den må åpnes for å bli tegnet.
    const tree = render({isReporter: true, reporterDockOpen: true});
    // «Mål oss» beholder mintfyllet med heiaDeep-blekk — mint ER feiringen,
    // og den er lovlig på stadionmørkt. Alt annet er krittkant.
    const used = usedColors(tree);
    expect(used).toContain(colors.heia.toUpperCase());
    expect(used).toContain(colors.heiaDeep.toUpperCase());
  });

  it('erstatter det hvite «du følger kampen»-kortet med én linje', () => {
    const {Text} = require('react-native');
    const texts = render()
      .root.findAllByType(Text)
      .map(n => {
        const c = n.props.children;
        return (Array.isArray(c) ? c : [c])
          .filter(
            (x: unknown) => typeof x === 'string' || typeof x === 'number',
          )
          .join('');
      });
    expect(texts).toContain(
      'Stillingen og kampforløpet oppdaterer seg av seg selv.',
    );
    expect(texts).not.toContain('Du følger kampen direkte');
  });

  /**
   * ⚠️ ENDRET I SKIVE 10. Verktøyene lå FAST midt på siden; nå bor de i
   * `ReporterDock`, som RAPPORTER-knappen i tab-baren åpner. Følge-linja er
   * fortsatt publikums og bare publikums.
   */
  it('lar reporteren se verktøyene — nå i dokken — i stedet for følge-linja', () => {
    const {Text} = require('react-native');
    const texts = render({isReporter: true, reporterDockOpen: true})
      .root.findAllByType(Text)
      .map(n => {
        const c = n.props.children;
        return (Array.isArray(c) ? c : [c])
          .filter(
            (x: unknown) => typeof x === 'string' || typeof x === 'number',
          )
          .join('');
      });
    expect(texts).toContain('Mål oss');
    expect(texts).not.toContain(
      'Stillingen og kampforløpet oppdaterer seg av seg selv.',
    );
  });

  it('arver kampminuttet ned i BÅDE arenaen og retningsmarkøren', () => {
    // Prototypens ene ekte bug: hodet viste 40′, pulsen sto på 37′.
    const {Text} = require('react-native');
    const texts = render({minute: 37})
      .root.findAllByType(Text)
      .map(n => {
        const c = n.props.children;
        return (Array.isArray(c) ? c : [c])
          .filter(
            (x: unknown) => typeof x === 'string' || typeof x === 'number',
          )
          .join('');
      });
    expect(texts).toContain('1. omgang · 37′');
    expect(texts).toContain('NÅ · 37′');
  });

  it('leser andre omgang av forløpet, ikke av klokka', () => {
    const {Text} = require('react-native');
    const second = [
      ...EVENTS,
      {
        id: 'e4',
        matchId: 'm1',
        type: 'andre_omgang',
        minute: 25,
        description: 'Andre omgang',
      } as MatchEvent,
    ];
    const texts = render({matchEvents: second})
      .root.findAllByType(Text)
      .map(n => {
        const c = n.props.children;
        return (Array.isArray(c) ? c : [c])
          .filter(
            (x: unknown) => typeof x === 'string' || typeof x === 'number',
          )
          .join('');
      });
    expect(texts).toContain('2. omgang · 40′');
  });
});
