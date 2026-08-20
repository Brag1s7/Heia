/**
 * @format
 *
 * HENDELSESGRIDDET RENDRER — alle radvariantene, begge retningene.
 *
 * Griddet er nesten bare geometri og flater, og geometrien er alt voktet i
 * `matchGrid.test.ts`. Denne fila vokter det tallene ikke kan: at hver
 * variant faktisk MONTERER, og de tre tingene i den frosne retningen som
 * ellers kunne endret seg helt stille —
 *
 *   1. Minuttet står i SAMME kolonne for alle rader. Det er hele grunnen til
 *      at man kan sveipe nedover og bare lese 34′ · 31′ · 29′ · 25′.
 *   2. Retningsmarkøren sier NÅ i live og SLUTT i rapporten — og INGENTING
 *      mer. Den permanente hjelpeteksten ble fjernet etter telefontesten;
 *      minuttet og minuttkolonnen forklarer retningen selv.
 *   3. Retningsmarkøren leser minuttet fra PROPEN, aldri fra en egen klokke.
 *      Prototypen hadde nettopp den bugen: hodet viste 40′ mens pulsen sto
 *      igjen på 37′.
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
import {matchGrid} from '../src/shared/matchGridGeometry';
import type {MatchEvent} from '../src/shared/types';

const MATCH_ID = 'm1';

function ev(
  id: string,
  type: MatchEvent['type'],
  minute: number,
  extra: Partial<MatchEvent> = {},
): MatchEvent {
  return {
    id,
    matchId: MATCH_ID,
    type,
    minute,
    description: `${type} ${minute}`,
    ...extra,
  };
}

// Én av hver variant griddet må tegne.
const EVENTS: MatchEvent[] = [
  ev('e1', 'avspark', 0, {description: 'Kampen er i gang'}),
  ev('e2', 'mål', 12, {teamSide: 'home', player: 'Erlend Hagen'}),
  ev('e3', 'mål', 23, {teamSide: 'away', description: 'Mål til Ridabu'}),
  ev('e4', 'pause', 25),
  ev('e5', 'andre_omgang', 25),
  ev('e6', 'melding', 31, {
    description: 'Vi presser høyt nå.',
    reportedBy: 'u-jarle',
  }),
  ev('e7', 'bytte', 33),
  ev('e8', 'kort', 36),
  ev('e9', 'slutt', 50),
];

const AUTHORS = {
  'u-jarle': {id: 'u-jarle', name: 'Jarle Vestli', avatarColor: '#1E7A46'},
};

function render(props: Partial<React.ComponentProps<typeof MatchTimeline>>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <MatchTimeline
        matchEvents={EVENTS}
        photos={[]}
        authorFor={id => AUTHORS[id as keyof typeof AUTHORS]}
        {...props}
      />,
    );
  });
  return tree;
}

/**
 * Teksten i én <Text>, satt sammen. `{event.minute}′` gir children som
 * [12, '′'] — et tall OG en streng — så en ren streng-filter ville mistet
 * nøyaktig de etikettene denne fila handler om.
 */
function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  const c = node.props.children;
  return (Array.isArray(c) ? c : [c])
    .filter(x => typeof x === 'string' || typeof x === 'number')
    .join('');
}

const RNText = require('react-native').Text;

/** Alle synlige tekstbiter. */
function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(RNText).map(textOf);
}

/** Minuttetikettene — de som er nøyaktig «<tall>′». */
function minuteLabels(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(RNText).filter(n => /^\d+′$/.test(textOf(n)));
}

describe('MatchTimeline — alle radvariantene monterer', () => {
  it('tegner hele kampforløpet uten å kaste', () => {
    const tree = render({newestFirst: true, nowMinute: 40});
    expect(tree.toJSON()).toBeTruthy();
  });

  it('viser hvert minutt nøyaktig én gang', () => {
    const t = texts(render({newestFirst: true, nowMinute: 40}));
    // Ett minutt per hendelse. 25 to ganger (pause + 2. omgang).
    expect(t.filter(x => x === '12′')).toHaveLength(1);
    expect(t.filter(x => x === '25′')).toHaveLength(2);
    expect(t.filter(x => x === '50′')).toHaveLength(1);
  });

  it('feirer kun mål for oss — MÅL! står én gang, ikke to', () => {
    const t = texts(render({newestFirst: true, nowMinute: 40}));
    expect(t.filter(x => x === 'MÅL!')).toHaveLength(1);
  });

  it('skriver ALDRI den syntetiske «Mål for oss» under MÅL!', () => {
    // describeMatchEvent (lib/api/events.ts) stempler alltid en beskrivelse
    // på et mål og legger brukerens egen tekst i `player`. Rendres begge,
    // står det «Mål for oss» under hvert mål uten at noen skrev det.
    const t = texts(
      render({
        newestFirst: true,
        nowMinute: 40,
        matchEvents: [
          ev('g1', 'mål', 12, {
            teamSide: 'home',
            player: 'Erlend Hagen',
            description: 'Mål for oss',
          }),
        ],
      }),
    );
    expect(t).toContain('MÅL!');
    expect(t).toContain('Erlend Hagen'); // brukerens egen tekst
    expect(t).not.toContain('Mål for oss'); // maskinens etikett
  });

  it('beholder etiketten på mål IMOT — der ER den innholdet', () => {
    const t = texts(
      render({
        newestFirst: true,
        nowMinute: 40,
        matchEvents: [
          ev('g2', 'mål', 23, {
            teamSide: 'away',
            description: 'Mål for Ridabu',
          }),
        ],
      }),
    );
    expect(t).toContain('Mål for Ridabu');
  });

  it('gir reporterens stemme et navn, ikke bare en node', () => {
    expect(texts(render({newestFirst: true, nowMinute: 40}))).toContain(
      'Jarle oppdaterer',
    );
  });

  it('faller tilbake på «Oppdatering» når forfatteren ikke er lastet', () => {
    const t = texts(render({newestFirst: true, nowMinute: 40, authorFor: undefined}));
    expect(t).toContain('Oppdatering');
    expect(t).not.toContain('Jarle oppdaterer');
  });
});

describe('MatchTimeline — minuttet står i samme kolonne', () => {
  it('gir hver minuttetikett identisk left og width', () => {
    const tree = render({newestFirst: true, nowMinute: 40});
    // Samme kilde komponenten selv leser (useWindowDimensions går til
    // Dimensions), så testen ikke duplisererer regnestykket sitt.
    const {width, fontScale} = require('react-native').Dimensions.get('window');
    const g = matchGrid(width, fontScale);
    const minutes = minuteLabels(tree);

    expect(minutes.length).toBe(EVENTS.length);
    const flat = (s: unknown) =>
      Object.assign({}, ...(Array.isArray(s) ? s.flat(9) : [s]).filter(Boolean));

    for (const m of minutes) {
      const style = flat(m.props.style);
      // Kolonnen er identisk for ALLE rader — uansett hvilken flate raden er.
      expect(style.left).toBe(g.minuteLeft);
      expect(style.width).toBe(g.minuteWidth);
      expect(style.textAlign).toBe('right');
      expect(style.position).toBe('absolute');
    }
  });

  it('klemmer hver minuttetikett til appens tekst-tak', () => {
    const minutes = minuteLabels(render({newestFirst: true, nowMinute: 40}));
    // Klemmes geometrien men ikke teksten, åpner det seg et gap som vokser
    // til iOS' ×3.571 — og da klippes noe.
    for (const m of minutes) {
      expect(m.props.maxFontSizeMultiplier).toBe(1.6);
    }
  });
});

describe('MatchTimeline — retningsmarkøren', () => {
  it('sier «NÅ» i live — og ingen bruksanvisning', () => {
    const t = texts(render({newestFirst: true, nowMinute: 40}));
    expect(t).toContain('NÅ · 40′');
    expect(t).toContain('Det som skjer');
    // Kampflaten er kampen, ikke en bruksanvisning. Kommer denne tilbake,
    // er det en regresjon — ikke en forbedring.
    expect(t).not.toContain('Nyeste øverst — bla nedover i kampen');
  });

  it('snur i kamprapporten', () => {
    const t = texts(render({newestFirst: false}));
    expect(t).toContain('SLUTT');
    expect(t).toContain('Kampens historie');
    expect(t).not.toContain('Kampen leses forfra');
  });

  it('leser minuttet fra propen — aldri fra en egen klokke', () => {
    // Kilden er `matchMinute` i EventDetailScreen. Begynner noen å regne
    // minuttet lokalt her inne, gjenskapes 40′/37′-bugen fra prototypen.
    expect(texts(render({newestFirst: true, nowMinute: 40}))).toContain(
      'NÅ · 40′',
    );
    expect(texts(render({newestFirst: true, nowMinute: 7}))).toContain(
      'NÅ · 7′',
    );
    // Ingen prop → 0, ikke «NaN′» og ikke dagens klokkeslett.
    expect(texts(render({newestFirst: true}))).toContain('NÅ · 0′');
  });
});
