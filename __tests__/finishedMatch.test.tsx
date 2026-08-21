/**
 * @format
 *
 * KAMPRAPPORTEN MONTERER — og den er den SAMME grønne verdenen som kampen.
 *
 * Skive 3 flyttet den spilte kampen ned på grunnen. Det som kan gå galt uten
 * at noen ser det i en enhetstest av en enkeltkomponent, er sammensetningen:
 * en flate som fortsatt tegner seg selv hvit, en variant som ikke ble sendt
 * videre, eller en inngang som ble borte i flyttingen.
 *
 * ⚠️ MØNSTERET FRA SKIVE 2.2 ER GRUNNEN TIL AT DENNE FILA FINNES: kode som
 * var riktig i skive 1 ble feil av at flaten under endret seg. Alt som ligger
 * her, lå på en annen flate i går.
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

import {FinishedMatch} from '../src/components/match/FinishedMatch';
import {colors} from '../src/theme';
import type {MatchPhoto} from '../src/lib/api/feed';
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
  {id: 'e4', matchId: 'm1', type: 'slutt', minute: 50, description: 'Slutt'},
];

const ATTENDEES = [
  {id: 'u1', name: 'Erlend Hagen'},
  {id: 'u2', name: 'Jonas Lie'},
  {id: 'u3', name: 'Mathias Øen'},
  {id: 'u4', name: 'Ada Berg'},
  {id: 'u5', name: 'Sara Nilsen'},
  {id: 'u6', name: 'Kari Lie', childName: 'Noah Lie'},
];

const EVENT = {
  id: 'ev1',
  teamSpaceId: 't1',
  type: 'kamp',
  title: 'Kamp mot Ridabu G14',
  startTime: new Date(2026, 7, 20, 18, 0),
  location: 'Briskeby kunstgress 2',
  rsvp: {coming: 6, notComing: 0, pending: 0, myStatus: 'kommer'},
  score: {home: 3, away: 2},
  opponent: 'Ridabu G14',
  matchStatus: 'finished',
  matchEvents: EVENTS,
  matchSessionId: 'ms1',
  startedAt: new Date(2026, 7, 20, 18, 0),
  attendees: {coming: ATTENDEES, notComing: [], pending: []},
} as unknown as HeiaEventDetail;

const REPORTER = {id: 'u-jarle', name: 'Jarle Vestli', avatarColor: '#1E7A46'};

/**
 * ⚠️ BILDER MÅ VÆRE MED I FIXTUREN. Både bildestripa og bilderadene i
 * forløpet rendres kun når det FINNES bilder — og begge to var lyse flater
 * frem til denne skiva. En tom `photos`-liste ville gjort «ingen hvite
 * flater»-testen under blind for nettopp de to.
 */
const PHOTOS = [
  {
    id: 'p1',
    media: {bucket: 'match-photos', path: 'a.jpg'},
    caption: 'Jubel etter 2–1',
    authorName: 'Jarle Vestli',
    createdAt: new Date(2026, 7, 20, 18, 13),
    matchEventId: 'e2',
  },
  {
    id: 'p2',
    media: {bucket: 'match-photos', path: 'b.jpg'},
    authorName: 'Kari Lie',
    createdAt: new Date(2026, 7, 20, 18, 40),
  },
] as unknown as MatchPhoto[];

/** Pulsen (skive 5) leser HEIA herfra. Tom = ingen glød, ingen kurveendring. */
const NO_ENGAGEMENT = {byMatchEvent: new Map(), byPost: new Map()};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(
  props: Partial<React.ComponentProps<typeof FinishedMatch>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FinishedMatch
        event={EVENT}
        matchEvents={EVENTS}
        teamName="Ham-Kam G14"
        teamColor="#D92B2B"
        photos={PHOTOS}
        reporter={REPORTER}
        isAdmin
        authorFor={id => (id === 'u-jarle' ? REPORTER : undefined)}
        engagement={NO_ENGAGEMENT}
        onPressPhoto={jest.fn()}
        onEdit={jest.fn()}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Fargene som FAKTISK VINNER i treet — se `liveMatch.test.tsx` for hvorfor. */
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
    for (const key of ['color', 'stopColor', 'stroke', 'fill']) {
      const v = props[key];
      if (typeof v === 'string' && v.startsWith('#')) out.push(v.toUpperCase());
    }

    visit(n.children);
  };

  visit(tree.toJSON());
  return out;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const {Text} = require('react-native');
  return tree.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return (Array.isArray(c) ? c : [c])
      .filter((x: unknown) => typeof x === 'string' || typeof x === 'number')
      .join('');
  });
}

describe('rapporten monterer som én grønn verden', () => {
  it('tegner uten å kaste — med og uten trenerrettigheter', () => {
    expect(render().toJSON()).toBeTruthy();
    expect(render({isAdmin: false}).toJSON()).toBeTruthy();
  });

  it('bruker INGEN av appens lyse flater', () => {
    // Samme regel som kampen, og den gjelder nettopp fordi rapporten arvet
    // tre flater som VAR lyse i går: bildestripa, påmeldtlisten og
    // «Rediger»-knappen.
    const forbidden = [
      colors.background,
      colors.surfaceMuted,
      colors.sun,
      colors.border,
      colors.borderSubtle,
      colors.textSecondary,
      colors.textTertiary,
    ].map(c => c.toUpperCase());

    for (const variant of [{}, {isAdmin: false}]) {
      const used = usedColors(render(variant));
      for (const bad of forbidden) {
        expect(used).not.toContain(bad);
      }
    }
  });

  it('bruker ALDRI coral — den betyr LIVE, og kampen er over', () => {
    expect(usedColors(render())).not.toContain(colors.live.toUpperCase());
  });

  it('gir bildestripa kampvarianten — også lasteplaten under thumben', () => {
    // Stripa vises KUN på ferdig kamp, så skive 3 er første gang varianten
    // faktisk brukes. Uten den blinker den krem mens thumbene dekodes.
    const t = texts(render());
    expect(t).toContain('Kampbilder');
    expect(t).toContain('2 bilder');
  });
});

describe('rapporten leses forfra', () => {
  it('snur forløpet: «Kampens historie», ikke «Det som skjer»', () => {
    const t = texts(render());
    expect(t).toContain('Kampens historie');
    expect(t).not.toContain('Det som skjer');
  });

  it('setter markøren til SLUTT i stedet for et levende minutt', () => {
    const t = texts(render());
    expect(t).toContain('SLUTT');
    expect(t.some(x => x.startsWith('NÅ ·'))).toBe(false);
  });

  it('åpner med avspark og ender med slutt', () => {
    const t = texts(render());
    expect(t.indexOf('0′')).toBeLessThan(t.indexOf('50′'));
  });
});

describe('det som fulgte med ned på grunnen', () => {
  it('lar treneren fortsatt rette kampen — ellers finnes ingen vei dit', () => {
    const onEdit = jest.fn();
    const tree = render({onEdit});
    const button = tree.root.find(
      n => n.props.accessibilityLabel === 'Rediger kampen',
    );
    act(() => button.props.onPress());
    expect(onEdit).toHaveBeenCalled();
    // Og den finnes ikke for et vanlig medlem.
    expect(
      render({isAdmin: false}).root.findAll(
        n => n.props.accessibilityLabel === 'Rediger kampen',
      ),
    ).toHaveLength(0);
  });

  it('viser de påmeldte som ÉTT stopp, med barnets navn og ikke forelderens', () => {
    const group = render().root.find(
      n =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Påmeldt'),
    );
    expect(group.props.accessible).toBe(true);
    expect(group.props.accessibilityLabel).toContain('Påmeldt, 6.');
    expect(group.props.accessibilityLabel).toContain('Noah Lie');
    expect(group.props.accessibilityLabel).not.toContain('Kari Lie');
  });

  it('teller resten bak «+N» i stedet for å tegne hele stallen', () => {
    expect(texts(render())).toContain('+1');
  });
});

describe('arenaen bærer «når» — resten er stille', () => {
  it('viser datoen og stedet, ikke en egen «hvor og når»-linje', () => {
    const t = texts(render());
    expect(t).toContain('20. aug · 18:00');
    expect(t).toContain('Briskeby kunstgress 2');
    // Den gamle rapportens undertekst skal ikke ha overlevd flyttingen.
    expect(t.some(x => x.includes('torsdag 20. august'))).toBe(false);
  });

  it('lar standardtittelen være — arenaen sier allerede hvem det var mot', () => {
    expect(texts(render())).not.toContain('Kamp mot Ridabu G14');
  });

  it('gir en EGEN tittel plassen den fortjener', () => {
    const t = texts(
      render({event: {...EVENT, title: 'Cupfinalen'} as HeiaEventDetail}),
    );
    expect(t).toContain('Cupfinalen');
  });
});
