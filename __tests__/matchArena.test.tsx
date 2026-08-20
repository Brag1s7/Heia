/**
 * @format
 *
 * ARENAEN — kampens hode.
 *
 * Tre ting her kan ikke ses i en skjermdump, og det er derfor de står her:
 *
 *   1. KLOKKA ER EN PROP. «Alt som viser kampminuttet må oppdateres fra samme
 *      kilde i samme tick.» Prototypens ene ekte bug var at hodet viste 40′
 *      mens pulsen sto på 37′. Arenaen skal derfor ALDRI ha en egen klokke.
 *   2. DET STORE TALLET MÅ OVERLEVE DYNAMIC TYPE. 62 px score i tre kolonner
 *      sprenger på 430 pt med XXL — da skal tallet legge seg på egen linje,
 *      ikke klippe lagnavnene.
 *   3. INGEN NUMMER I PAUSE. Klokka i appen teller fortsatt under pause
 *      (serveren regner `now() - started_at`, se P2), så et tall der ville
 *      vært feil. «Etter 1. omgang» er sant uansett.
 */
import React from 'react';
import {Dimensions, Text} from 'react-native';
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

import {MatchArena} from '../src/components/match/MatchArena';

const BASE = {
  homeTeam: 'Ham-Kam G14',
  awayTeam: 'Ridabu G14',
  homeScore: 2,
  awayScore: 1,
  teamColor: '#D92B2B',
  paused: false,
  minute: 40,
};

function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  const c = node.props.children;
  return (Array.isArray(c) ? c : [c])
    .filter(x => typeof x === 'string' || typeof x === 'number')
    .join('');
}

// ⚠️ LIVE-MERKET PULSERER I EVIGHET (`Animated.loop` i LiveBadge). Uten
// opprydding holder løkken jest-prosessen i live etter siste test — den ryddes
// i komponentens useEffect-cleanup, altså ved unmount.
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(props: Partial<React.ComponentProps<typeof MatchArena>> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<MatchArena {...BASE} {...props} />);
  });
  mounted.push(tree);
  return tree;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(textOf);
}

/**
 * Stillingsgruppa — det ENE stoppet som bærer lagene og tallet. Velges på
 * labelen, ikke på «første accessible»: LIVE-merket og metalinja er også
 * egne stopp, og det er meningen.
 */
function scoreGroup(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.find(
    n =>
      typeof n.type === 'string' &&
      n.props.accessible === true &&
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Ham-Kam G14'),
  );
}

describe('arenaen viser kampen', () => {
  it('setter stillingen sammen av propene, ikke av en egen telling', () => {
    expect(texts(render())).toContain('2–1');
  });

  it('leser stillingen som én setning for skjermleser', () => {
    const group = scoreGroup(render());
    expect(group.props.accessibilityLabel).toBe('Ham-Kam G14 2, Ridabu G14 1.');
  });

  it('sier hvilken omgang det er, utledet av forløpet', () => {
    expect(texts(render())).toContain('1. omgang · 40′');
    expect(texts(render({secondHalf: true}))).toContain('2. omgang · 40′');
  });

  it('viser sted og reporter som type på flaten, ikke som chips', () => {
    const t = texts(
      render({location: 'Briskeby kunstgress 2', reporterName: 'Jarle Vestli'}),
    );
    expect(t).toContain('Briskeby kunstgress 2');
    expect(t).toContain('Jarle rapporterer');
  });
});

describe('klokka er en prop, aldri en egen utregning', () => {
  it('har ingen egen klokke i kampverdenen — hverken tid eller ticker', () => {
    // Kildesjekk, ikke render-sjekk, og det er med vilje: en spion på
    // `Date.now` fanger også LiveBadges animasjonsløkke, og ville dermed
    // slått ut på noe som er helt i orden. Regelen er at kampens flater
    // ARVER minuttet — den er en egenskap ved koden, ikke ved én render.
    const fs = require('fs');
    for (const file of [
      'src/components/match/MatchArena.tsx',
      'src/components/match/LiveMatch.tsx',
      'src/components/MatchTimeline.tsx',
    ]) {
      const src: string = fs.readFileSync(file, 'utf8');
      // Kommentarene i filene NEVNER `Date.now()` — de skal ikke telle.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      expect(code).not.toMatch(/Date\.now\(/);
      expect(code).not.toMatch(/setInterval\(/);
    }
  });

  it('følger propen når minuttet tikker', () => {
    expect(texts(render({minute: 37}))).toContain('1. omgang · 37′');
    expect(texts(render({minute: 40}))).toContain('1. omgang · 40′');
  });

  it('viser INGEN minutt i pause — tallet ville vært feil før kampuret', () => {
    const t = texts(render({paused: true, minute: 25}));
    expect(t).toContain('Etter 1. omgang');
    expect(t.some(x => x.includes('25′'))).toBe(false);
  });
});

describe('det store tallet overlever Dynamic Type', () => {
  const real = Dimensions.get;
  afterEach(() => {
    (Dimensions as unknown as {get: typeof real}).get = real;
  });

  const fake = (width: number, fontScale: number) => {
    (Dimensions as unknown as {get: unknown}).get = (dim: string) =>
      dim === 'window'
        ? {width, height: 932, scale: 3, fontScale}
        : {width, height: 932, scale: 3, fontScale};
  };

  /** Antall lag-kolonner som deler rad med tallet. */
  function scoreSharesRowWithTeams(
    tree: ReactTestRenderer.ReactTestRenderer,
  ): boolean {
    const group = scoreGroup(tree);
    const style = Object.assign(
      {},
      ...(Array.isArray(group.props.style)
        ? group.props.style.flat(9)
        : [group.props.style]
      ).filter(Boolean),
    );
    return style.flexDirection === 'row';
  }

  it('står i tre kolonner ved vanlig tekststørrelse', () => {
    fake(430, 1);
    expect(scoreSharesRowWithTeams(render())).toBe(true);
  });

  it('legger seg på EGEN LINJE ved XXL — lagnavnene skal ikke klippes', () => {
    fake(430, 1.6);
    const tree = render();
    expect(scoreSharesRowWithTeams(tree)).toBe(false);
    // Og tallet er fortsatt der — fallbacken skjuler ingenting.
    expect(texts(tree)).toContain('2–1');
  });

  it('krymper tallet på smal telefon i stedet for å presse kolonnene', () => {
    fake(430, 1);
    const wide = render().root.findAll(
      n => typeof n.type === 'string' && textOf(n) === '2–1',
    )[0];
    fake(320, 1);
    const narrow = render().root.findAll(
      n => typeof n.type === 'string' && textOf(n) === '2–1',
    )[0];

    const size = (n: ReactTestRenderer.ReactTestInstance) =>
      Object.assign(
        {},
        ...(Array.isArray(n.props.style)
          ? n.props.style.flat(9)
          : [n.props.style]
        ).filter(Boolean),
      ).fontSize;

    expect(size(narrow)).toBeLessThan(size(wide));
  });
});
