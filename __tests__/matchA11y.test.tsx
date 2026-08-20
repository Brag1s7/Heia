/**
 * @format
 *
 * KAMPFLATEN ER LESBAR FOR SKJERMLESER — obligatorisk akseptansekriterium
 * (Brage 2026-08-20).
 *
 * «En kamptidslinje VoiceOver ikke kan lese, er en kamp en blind forelder
 * ikke kan følge.»
 *
 * Kravene denne fila vokter, ett for ett:
 *
 *   1. SAMLET LABEL PER HENDELSE. Én hendelse = ETT stopp, i rekkefølgen
 *      MINUTT → HVA → HVEM → DETALJ. Ikke fire stopp (node, minutt,
 *      overskrift, tekst).
 *   2. DEKORATIVE LAG ER SKJULT. Krittlinja, målswellen, skrimene og nodene
 *      er atmosfære, ikke innhold.
 *   3. HANDLINGER HAR ROLLE OG LABEL. Et bilde er en knapp, og labelen sier
 *      hva som skjer.
 *   4. ENGASJEMENT (skive 4) BLIR IKKE SVELGET. Det er grunnen til at labelen
 *      sitter på en inner-wrapper og ikke på hele raden — en `accessible`-
 *      beholder gjør alt inni seg uleselig OG utrykkbart.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/media/MediaImage', () => {
  const {View} = require('react-native');
  return {MediaImage: (props: object) => <View {...props} />};
});

jest.mock('../src/context', () => ({
  useActiveTeam: () => ({activeTeamSpace: {id: 't1', color: '#D92B2B'}}),
}));

import {MatchTimeline} from '../src/components/MatchTimeline';
import {
  matchEventA11yLabel,
  matchPhotoA11yLabel,
  matchScoreA11yLabel,
} from '../src/shared/matchCopy';
import type {MatchEvent} from '../src/shared/types';
import type {MatchPhoto} from '../src/lib/api/feed';

function ev(
  id: string,
  type: MatchEvent['type'],
  minute: number,
  extra: Partial<MatchEvent> = {},
): MatchEvent {
  return {
    id,
    matchId: 'm1',
    type,
    minute,
    description: `${type} ${minute}`,
    ...extra,
  };
}

const EVENTS: MatchEvent[] = [
  ev('e1', 'avspark', 0, {description: 'Kampen er i gang'}),
  ev('e2', 'mål', 12, {
    teamSide: 'home',
    player: 'Erlend Hagen',
    description: 'Mål for oss',
  }),
  ev('e3', 'mål', 23, {teamSide: 'away', description: 'Mål for Ridabu'}),
  ev('e4', 'pause', 25),
  ev('e5', 'melding', 31, {
    description: 'Vi presser høyt nå.',
    reportedBy: 'u-jarle',
  }),
  ev('e6', 'slutt', 50),
];

const AUTHORS = {
  'u-jarle': {id: 'u-jarle', name: 'Jarle Vestli', avatarColor: '#1E7A46'},
};

const PHOTO: MatchPhoto = {
  id: 'p1',
  media: {bucket: 'feed-media', path: 'x.jpg'},
  caption: 'Full jubel',
  authorName: 'Kari Nordbø',
  createdAt: new Date(2026, 7, 20, 18, 34),
} as unknown as MatchPhoto;

function render(
  props: Partial<React.ComponentProps<typeof MatchTimeline>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <MatchTimeline
        matchEvents={EVENTS}
        photos={[]}
        newestFirst
        nowMinute={40}
        authorFor={id => AUTHORS[id as keyof typeof AUTHORS]}
        {...props}
      />,
    );
  });
  return tree;
}

/** Alle noder som faktisk er ett stopp for skjermleseren. */
function stops(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(n => typeof n.type === 'string' && !!n.props.accessibilityLabel)
    .map(n => String(n.props.accessibilityLabel));
}

// ---------------------------------------------------------------------------
// 1 — SETNINGEN
// ---------------------------------------------------------------------------
describe('øyeblikket som én setning — MINUTT → HVA → HVEM → DETALJ', () => {
  it('leser et mål for oss med stilling og målscorer', () => {
    expect(
      matchEventA11yLabel(
        {type: 'mål', minute: 34, teamSide: 'home', player: 'Erlend Hagen'},
        {score: '2–1'},
      ),
    ).toBe('34 minutter. Mål for oss, 2–1. Erlend Hagen.');
  });

  it('leser en oppdatering med reporterens fornavn', () => {
    expect(
      matchEventA11yLabel(
        {type: 'melding', minute: 31, description: 'Vi presser høyt nå.'},
        {authorName: 'Jarle Vestli'},
      ),
    ).toBe('31 minutter. Jarle oppdaterer: Vi presser høyt nå.');
  });

  it('SIER hva som skjedde på et mål — noden kan ikke leses opp', () => {
    // Skjermen viser bare `player` under MÅL! (telefontesten fjernet den
    // syntetiske «Mål for oss»-linja). For øyet er noden nok; for øret er
    // den ingenting. Labelen må derfor si det den viser.
    const label = matchEventA11yLabel(
      {type: 'mål', minute: 34, teamSide: 'home', player: 'Erlend Hagen'},
      {score: '2–1'},
    );
    expect(label).toContain('Mål for oss');
  });

  it('feirer aldri motstanderens mål — bare rapporterer det', () => {
    const label = matchEventA11yLabel(
      {
        type: 'mål',
        minute: 23,
        teamSide: 'away',
        description: 'Mål for Ridabu',
      },
      {score: '1–1'},
    );
    expect(label).toBe('23 minutter. Mål for Ridabu, 1–1.');
    expect(label).not.toContain('for oss');
  });

  it('bøyer minuttet — «1 minutt», ikke «1 minutter»', () => {
    expect(matchEventA11yLabel({type: 'avspark', minute: 1})).toBe(
      '1 minutt. Avspark.',
    );
  });

  it('tåler at stillingen mangler', () => {
    expect(matchEventA11yLabel({type: 'slutt', minute: 50})).toBe(
      '50 minutter. Slutt.',
    );
  });

  it('leser et bilde uten kjent kampminutt uten å lyve om tiden', () => {
    expect(
      matchPhotoA11yLabel({authorName: 'Kari Nordbø', caption: 'Full jubel'}),
    ).toBe('Bilde fra Kari Nordbø. Full jubel.');
  });

  it('gjør stillingen til en setning — «2–1» leses ellers som tegn', () => {
    expect(
      matchScoreA11yLabel({
        homeTeam: 'Ham-Kam G14',
        awayTeam: 'Ridabu G14',
        homeScore: 2,
        awayScore: 1,
      }),
    ).toBe('Ham-Kam G14 2, Ridabu G14 1.');
  });
});

// ---------------------------------------------------------------------------
// 2 — ETT STOPP PER HENDELSE, PÅ EKTE
// ---------------------------------------------------------------------------
describe('kampforløpet gir ett stopp per øyeblikk', () => {
  it('har nøyaktig én label per hendelse, og hver starter med minuttet', () => {
    const labels = stops(render()).filter(l => /^\d+ minutt/.test(l));
    expect(labels).toHaveLength(EVENTS.length);
    for (const moment of EVENTS) {
      expect(labels.some(l => l.startsWith(`${moment.minute} minutt`))).toBe(
        true,
      );
    }
  });

  it('skjuler nodene — de sier HVA, men de sier det med form', () => {
    const tree = render();
    const hidden = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        n.props.importantForAccessibility === 'no-hide-descendants',
    );
    // Krittlinja, retningsprikken, eyebrow-prikken og hver node.
    expect(hidden.length).toBeGreaterThanOrEqual(EVENTS.length + 3);
  });

  it('sier hvilken vei lista går — «nyeste øverst» er usynlig for øret', () => {
    expect(stops(render())).toContain('Nå, 40 minutter spilt. Nyeste øverst.');
    expect(stops(render({newestFirst: false}))).toContain(
      'Kampen er slutt. Forløpet leses forfra.',
    );
  });
});

// ---------------------------------------------------------------------------
// 3 — HANDLINGER
// ---------------------------------------------------------------------------
describe('bilder er knapper med en label som sier hva de er', () => {
  it('gir et generelt kampbilde rolle og hele setningen', () => {
    const tree = render({
      matchEvents: [],
      photos: [PHOTO],
      startedAt: new Date(2026, 7, 20, 18, 0),
    });
    const buttons = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'imagebutton',
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.accessibilityLabel).toBe(
      '34 minutter. Bilde fra Kari Nordbø. Full jubel.',
    );
  });

  it('gir et bilde PÅ en hendelse sitt eget stopp, ved siden av hendelsen', () => {
    const tree = render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      photos: [{...PHOTO, matchEventId: 'g1'} as MatchPhoto],
      startedAt: new Date(2026, 7, 20, 18, 0),
    });
    const roles = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'imagebutton',
    );
    // Bildet henger på målet, men er et EGET element — ellers kunne det ikke
    // trykkes med VoiceOver.
    expect(roles).toHaveLength(1);
    expect(
      stops(tree).some(l => l.startsWith('34 minutter. Mål for oss')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4 — SLOTEN SOM SKIVE 4 SKAL BRUKE
// ---------------------------------------------------------------------------
describe('engasjement blir ikke svelget av den samlede labelen', () => {
  it('holder HEIA-knappen utenfor hendelsens accessible-gruppe', () => {
    const {Pressable} = require('react-native');
    const tree = render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      renderEngagement: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Heia" />
      ),
    });

    // Finn hendelsens accessible-wrapper, og se at knappen IKKE ligger inni.
    const group = tree.root.find(
      n =>
        typeof n.type === 'string' &&
        n.props.accessible === true &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('34 minutter'),
    );
    const inside = group.findAll(
      n => typeof n.type === 'string' && n.props.accessibilityLabel === 'Heia',
      {deep: true},
    );
    expect(inside).toHaveLength(0);
    expect(stops(tree)).toContain('Heia');
  });
});
