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
    const t = texts(
      render({newestFirst: true, nowMinute: 40, authorFor: undefined}),
    );
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
      Object.assign(
        {},
        ...(Array.isArray(s) ? s.flat(9) : [s]).filter(Boolean),
      );

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

describe('MatchTimeline — bildene står i innholdskolonnen', () => {
  /**
   * ⚠️ TELEFONTEST 2026-08-20. Den frosne retningen sa «bildet ER flaten,
   * kant til kant». Med ekte data på grunnen kuttet et fullbredt lyst
   * rektangel den grønne verdenen i to, og Brage ba om at bildene «passer
   * inn på samme måte som resten av innholdet i tidslinjen».
   *
   * Det er ikke en smakssak man kan skli tilbake fra ved neste redigering:
   * hele poenget med griddet er at ALT innhold står i samme kolonne.
   */
  const {width, fontScale} = require('react-native').Dimensions.get('window');
  const g = matchGrid(width, fontScale);
  const RNView = require('react-native').View;

  const flat = (s: unknown) =>
    Object.assign({}, ...(Array.isArray(s) ? s.flat(9) : [s]).filter(Boolean));

  /** Bildene i treet — mocket MediaImage arver stilen den fikk. */
  function images(tree: ReactTestRenderer.ReactTestRenderer) {
    return tree.root
      .findAllByType(RNView)
      .filter(n => flat(n.props.style).aspectRatio !== undefined);
  }

  /** Nærmeste forelder som faktisk setter en venstremarg. */
  function columnLeftOf(node: ReactTestRenderer.ReactTestInstance): number {
    let cur: ReactTestRenderer.ReactTestInstance | null = node;
    while (cur) {
      const style = flat(
        typeof cur.props.style === 'function' ? undefined : cur.props.style,
      );
      if (typeof style.paddingLeft === 'number') return style.paddingLeft;
      cur = cur.parent;
    }
    return -1;
  }

  const PHOTO = {
    id: 'p1',
    media: {bucket: 'feed-media', path: 'a.jpg'},
    caption: 'Full jubel',
    authorName: 'Kari Nordbø',
    createdAt: new Date(2026, 7, 20, 18, 34),
  } as never;

  it('gir et generelt kampbilde samme venstremarg som teksten', () => {
    const tree = render({
      matchEvents: [],
      photos: [PHOTO],
      startedAt: new Date(2026, 7, 20, 18, 0),
    });
    const found = images(tree);
    expect(found).toHaveLength(1);
    expect(columnLeftOf(found[0])).toBe(g.contentLeft);
  });

  it('gir et bilde PÅ en hendelse den samme margen', () => {
    const tree = render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      photos: [{...(PHOTO as object), matchEventId: 'g1'} as never],
      startedAt: new Date(2026, 7, 20, 18, 0),
    });
    const found = images(tree);
    expect(found).toHaveLength(1);
    expect(columnLeftOf(found[0])).toBe(g.contentLeft);
  });

  it('gir bilderaden node og minutt i skinna, som alle andre rader', () => {
    const tree = render({
      matchEvents: [],
      photos: [PHOTO],
      startedAt: new Date(2026, 7, 20, 18, 0),
    });
    const minutes = minuteLabels(tree);
    expect(minutes).toHaveLength(1);
    const style = flat(minutes[0].props.style);
    expect(style.left).toBe(g.minuteLeft);
    expect(style.width).toBe(g.minuteWidth);
  });
});

describe('MatchTimeline — måltenningen maler aldri over krittlinja', () => {
  /**
   * ⚠️ TELEFONTEST 2026-08-20: «tidslinjen kuttes».
   *
   * Målswellens kuppel ble laget ved å male GRUNNFARGEN (#123325) tilbake
   * over de firkantede hjørnene. Det var usynlig så lenge målraden lå på en
   * flat, mørk egen flate — men fra skive 2 ligger den på grunnen, og da var
   * overmalingen en ugjennomsiktig plate i FEIL farge som kuttet krittlinja
   * i de øverste 34 punktene av hver målrad.
   *
   * Regelen som erstattet den: swellen KLIPPES til formen sin. Ingenting i
   * kampforløpet får legge en dekkende flate over skinna.
   */
  it('bruker bare gradienter og kritt — ingen dekkende fyllfarge', () => {
    const tree = render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      newestFirst: true,
      nowMinute: 40,
    });

    const fills = tree.root
      .findAll(n => typeof n.props.fill === 'string')
      .map(n => String(n.props.fill));

    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) {
      // `none` = bare strek (lyskanten). `url(#…)` = gradient, altså noe som
      // slipper linja gjennom. Alt annet er en plate.
      expect(fill === 'none' || fill.startsWith('url(')).toBe(true);
    }
  });

  it('tenner den samme linja i mint — samme x og bredde som kritt', () => {
    const tree = render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      newestFirst: true,
      nowMinute: 40,
    });
    const {width, fontScale} = require('react-native').Dimensions.get('window');
    const g = matchGrid(width, fontScale);
    const flat = (s: unknown) =>
      Object.assign(
        {},
        ...(Array.isArray(s) ? s.flat(9) : [s]).filter(Boolean),
      );

    const RNView = require('react-native').View;
    const ignition = tree.root
      .findAllByType(RNView)
      .map(n => flat(n.props.style))
      .filter(
        st => st.backgroundColor === '#02FFAB' && st.width === g.threadWidth,
      );

    expect(ignition).toHaveLength(1);
    expect(ignition[0].left).toBe(g.threadLeft);
  });
});

describe('MatchTimeline — målswellen dekker HELE målet, også bildet', () => {
  /**
   * ⚠️ TELEFONTEST 2026-08-20 (skive 3): «en feil med hvordan bilder lastes
   * inn». Lagets lys stoppet rett over bildet, så målet sluttet visuelt
   * midtveis og bildet hang løsrevet under.
   *
   * Skive 2.2 rettet gradientens ROTASJON, og det var riktig — men det var
   * ikke hele årsaken. Flatene var svg-er med `height="100%"`, og en prosent
   * inne i svg regnes mot lerretets oppmålte størrelse, ikke mot RNs layout.
   * En målrad uten bilde er ~83 pt; med bilde tre ganger så høy.
   *
   * BEVISET LÅ I SAMME SKJERMBILDE: måltenningen er en vanlig `View` med
   * `top: 0, bottom: 0` og gikk hele veien ned. Samme rad, samme beholder —
   * bare den ene brukte prosent, og bare den ene var feil.
   *
   * Regelen nå: flatene måles og tegnes i PUNKTER. Ingen prosenthøyde.
   */

  /** Alt som tegner en flate i en rad måler seg selv — fyr av målingen. */
  function layout(tree: ReactTestRenderer.ReactTestRenderer, height: number) {
    const RNView = require('react-native').View;
    const measured = tree.root
      .findAllByType(RNView)
      .filter(n => typeof n.props.onLayout === 'function');
    act(() => {
      for (const n of measured) {
        n.props.onLayout({nativeEvent: {layout: {width: 393, height}}});
      }
    });
    return measured.length;
  }

  const goalWithPhoto = () =>
    render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      newestFirst: true,
      nowMinute: 40,
    });

  it('måler BEGGE radflatene — mål for oss og mål imot', () => {
    // Skiferstripa på et mål imot hadde nøyaktig samme prosenthøyde, og en
    // målrad imot MED bilde er like høy. Rettes bare den ene, er feilen
    // fortsatt der — den er bare vanskeligere å få øye på.
    const tree = render({
      matchEvents: [
        ev('g1', 'mål', 34, {teamSide: 'home'}),
        ev('g2', 'mål', 41, {teamSide: 'away', description: 'Mål til Ridabu'}),
      ],
      newestFirst: true,
      nowMinute: 45,
    });
    layout(tree, 420);

    const RNSvg = require('react-native-svg').default;
    const measured = tree.root
      .findAllByType(RNSvg)
      .filter(x => x.props.height === 420);

    expect(measured).toHaveLength(2);
  });

  it('arver radens FAKTISKE høyde, ikke høyden uten bilde', () => {
    const tree = goalWithPhoto();
    const n = layout(tree, 431);
    expect(n).toBeGreaterThan(0);

    const RNSvg = require('react-native-svg').default;
    const heights = tree.root
      .findAllByType(RNSvg)
      .map(x => x.props.height)
      .filter(h => typeof h === 'number');

    // Swellen skal ha nøyaktig den høyden raden meldte — vokser raden når
    // bildet legger seg inn, følger flaten etter.
    expect(heights).toContain(431);
  });

  it('holder seg til gradienter og kritt også når flaten faktisk tegnes', () => {
    // Den gamle vakten («ingen dekkende fyllfarge») ble blind da swellen
    // begynte å vente på en måling: uten onLayout tegnes den ikke i det hele
    // tatt, og testen «bestod» på ingenting.
    const tree = goalWithPhoto();
    layout(tree, 431);

    const fills = tree.root
      .findAll(n => typeof n.props.fill === 'string')
      .map(n => String(n.props.fill));

    expect(fills.some(f => f.startsWith('url('))).toBe(true);
    for (const fill of fills) {
      expect(fill === 'none' || fill.startsWith('url(')).toBe(true);
    }
  });
});

describe('MatchTimeline — engasjementet avslutter øyeblikket (skive 4)', () => {
  const PHOTO_ON_GOAL = {
    id: 'p1',
    media: {bucket: 'feed-media', path: 'a.jpg'},
    caption: 'Full jubel',
    authorName: 'Kari Nordbø',
    createdAt: new Date(2026, 7, 20, 18, 34),
    matchEventId: 'g1',
  } as never;

  function goalWithEngagement() {
    return render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      photos: [PHOTO_ON_GOAL],
      startedAt: new Date(2026, 7, 20, 18, 0),
      renderEngagement: () => <RNText>ENGASJEMENT</RNText>,
    });
  }

  it('legger HEIA/kommentarer ETTER bildet, ikke mellom teksten og bildet', () => {
    // ⚠️ Sloten sto opprinnelig mellom innholdet og bildet, fordi den var tom
    // da plassen ble reservert i skive 1. Med innhold i den ble rekkefølgen
    // «MÅL! → HEIA → bildet» — altså en handling midt inne i det den handler
    // om. Fasiten legger `engRow()` sist i hvert øyeblikk, og et bilde festet
    // til et mål er en del av målet.
    const t = texts(goalWithEngagement());
    expect(t.indexOf('Full jubel')).toBeGreaterThanOrEqual(0);
    expect(t.indexOf('ENGASJEMENT')).toBeGreaterThan(t.indexOf('Full jubel'));
  });

  it('holder sloten UTENFOR øyeblikkets samlede a11y-label', () => {
    // En `accessible`-beholder svelger alt inni seg. Havner HEIA der, slutter
    // knappene å være egne stopp i VoiceOver — altså umulige å trykke.
    const tree = goalWithEngagement();
    const node = tree.root
      .findAllByType(RNText)
      .find(n => textOf(n) === 'ENGASJEMENT')!;

    let cur: typeof node | null = node.parent;
    while (cur) {
      expect(cur.props.accessible).not.toBe(true);
      cur = cur.parent;
    }
  });

  it('tilbyr sloten på hver rad, også på bilderaden', () => {
    // Selve REGLENE (ingen linje på rytmemarkørene, ingen HEIA på mål imot)
    // bor i `shared/matchEngagement` og testes der — griddet skal bare tilby
    // plassen, ellers kunne en regel aldri gjelde en bilderad.
    const seen: string[] = [];
    render({
      matchEvents: [ev('g1', 'mål', 34, {teamSide: 'home'})],
      photos: [
        {
          id: 'p2',
          media: {bucket: 'feed-media', path: 'b.jpg'},
          authorName: 'Kari Nordbø',
          createdAt: new Date(2026, 7, 20, 18, 40),
        } as never,
      ],
      startedAt: new Date(2026, 7, 20, 18, 0),
      renderEngagement: entry => {
        seen.push(entry.event ? `event:${entry.event.id}` : `photo:${entry.photo!.id}`);
        return null;
      },
    });
    expect(seen).toEqual(['event:g1', 'photo:p2']);
  });
});
