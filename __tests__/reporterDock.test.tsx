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
import {
  ReporterDock,
  shouldDismissDock,
} from '../src/components/match/ReporterDock';
import {ReporterActions} from '../src/components/ReporterActions';
import type {HeiaEventDetail, MatchEvent} from '../src/shared/types';

/**
 * REPORTERDOKKEN (P4, skive 10).
 *
 * Fram til nå lå `ReporterActions` FAST midt i kampskjermen — altså et sted
 * man måtte scrolle for å nå kampens mest tidskritiske handling, mens den
 * grønne «+» i baren gjorde noe helt annet. Verktøyet bor nå i dokken, som
 * RAPPORTER-knappen åpner, der tommelen allerede er.
 *
 * ⚠️ Denne fila vokter to ting som er lette å ødelegge:
 *   · at panelet finnes ÉN gang, ikke to (dokken skulle ERSTATTE det faste)
 *   · at publikum aldri har det i treet i det hele tatt
 */

const EVENTS: MatchEvent[] = [
  {
    id: 'm1',
    matchId: 'ms1',
    type: 'avspark',
    minute: 0,
    description: 'Avspark',
  } as MatchEvent,
];

const EVENT = {
  id: 'e1',
  teamSpaceId: 't1',
  type: 'kamp',
  title: 'Ham-Kam – Ridabu',
  startTime: new Date(2026, 7, 20, 18, 0),
  rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'venter'},
  score: {home: 2, away: 1},
  opponent: 'Ridabu G14',
  matchStatus: 'live',
  matchEvents: EVENTS,
  matchSessionId: 'ms1',
  startedAt: new Date(2026, 7, 20, 18, 0),
  attendees: {coming: [], notComing: [], pending: []},
} as unknown as HeiaEventDetail;

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
        isAdmin
        isReporter={false}
        photos={[]}
        authorFor={() => undefined}
        engagement={NO_ENGAGEMENT}
        onChangeReporter={jest.fn()}
        onReporterAction={jest.fn()}
        onPickPhoto={jest.fn()}
        onPressPhoto={jest.fn()}
        onCloseReporterDock={jest.fn()}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/**
 * Hvor mange reporterpaneler som står i treet.
 *
 * ⚠️ Telles på KOMPONENTTYPE, ikke på a11y-label: `Pressable` og dens
 * host-`View` bærer den samme labelen, så en rå nodetelling ville sagt tre
 * paneler der det står ett.
 */
function antallPaneler(tree: ReactTestRenderer.ReactTestRenderer): number {
  return tree.root.findAllByType(ReporterActions).length;
}

it('PUBLIKUM ser aldri verktøyet — det er ikke engang i treet', () => {
  const tree = render({isReporter: false, reporterDockOpen: true});
  expect(antallPaneler(tree)).toBe(0);
});

it('publikum beholder linja som forklarer hvorfor det ikke finnes en oppdater-knapp', () => {
  const tekster = render({isReporter: false})
    .root.findAllByType(require('react-native').Text)
    .flatMap(n =>
      Array.isArray(n.props.children) ? n.props.children : [n.props.children],
    )
    .filter(c => typeof c === 'string');
  expect(tekster).toContain(
    'Stillingen og kampforløpet oppdaterer seg av seg selv.',
  );
});

/**
 * ⚠️ REPORTEREN FÅR INGEN HINTETEKST. Prototypens `renderRep()` er hele
 * reporterflaten, og den har ingen — den sentrale RAPPORTER-knappen
 * forklarer seg selv. Å skrive «bruk knappen nederst» ville vært å finne
 * opp produktspråk, som autoritetsregelen forbyr.
 */
it('reporteren får INGEN forklarende linje i stedet for panelet', () => {
  const tekster = render({isReporter: true})
    .root.findAllByType(require('react-native').Text)
    .flatMap(n =>
      Array.isArray(n.props.children) ? n.props.children : [n.props.children],
    )
    .filter((c): c is string => typeof c === 'string');
  expect(tekster.some(t => /RAPPORTER-knappen|knappen nederst/i.test(t))).toBe(
    false,
  );
  // Og publikums linje er ikke hennes.
  expect(tekster).not.toContain(
    'Stillingen og kampforløpet oppdaterer seg av seg selv.',
  );
});

it('reporteren har verktøyet ÉN gang, ikke to — dokken ERSTATTET panelet', () => {
  expect(
    antallPaneler(render({isReporter: true, reporterDockOpen: true})),
  ).toBe(1);
});

/** Dokkens ytre flate — den som bærer glidet og trykkvakten. */
function dockFlate(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findByType(ReporterDock)
    .findAll(n => typeof n.props?.pointerEvents === 'string', {deep: true})[0];
}

it('dokken er LUKKET som utgangspunkt — også midt i en kamp', () => {
  const tree = render({isReporter: true});
  expect(tree.root.findByType(ReporterDock).props.open).toBe(false);
  // Montert (så glidet kan animeres), men uten trykk.
  expect(dockFlate(tree).props.pointerEvents).toBe('none');
});

it('lukket dokk stjeler ikke trykk fra forløpet under', () => {
  expect(
    dockFlate(render({isReporter: true, reporterDockOpen: false})).props
      .pointerEvents,
  ).toBe('none');
});

it('åpen dokk tar imot trykk', () => {
  expect(
    dockFlate(render({isReporter: true, reporterDockOpen: true})).props
      .pointerEvents,
  ).toBe('auto');
});

it('reporterhandlingen når helt fram fra dokken', () => {
  const onReporterAction = jest.fn();
  const tree = render({
    isReporter: true,
    reporterDockOpen: true,
    onReporterAction,
  });
  const maalOss = tree.root.find(
    n => n.props?.accessibilityLabel === 'Registrer mål for oss',
  );
  act(() => maalOss.props.onPress());
  expect(onReporterAction).toHaveBeenCalledWith('mål_oss');
});

// ---------------------------------------------------------------------------
// DRA NED FOR Å LUKKE (Brage 2026-08-21: «nesten som et kommentarfelt»)
//
// ⚠️ Tersklene er ARVET fra `CommentSheet`, som er telefontestet gjennom
// skive 4.2–4.4. Appen skal ha ÉN dra-følelse, ikke to som ligner.
// ---------------------------------------------------------------------------

/** Gripeflaten — håndtaket, ikke hele dokken. */
function grep(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.find(
    n => n.props?.accessibilityLabel === 'Lukk rapporteringsverktøyet',
  );
}

it.each([
  ['et LANGT drag nedover', 160, 0.1, true],
  ['et RASKT kast, selv om det er kort', 20, 1.2, true],
  ['et kort, rolig drag', 12, 0.05, false],
  ['et rent TRYKK (dy ≈ 0 er ingen gest)', 0, 0, false],
  ['et drag OPPOVER', -80, -1, false],
] as const)('%s ⇒ lukker: %s', (_navn, dy, vy, forventet) => {
  expect(shouldDismissDock(dy, vy)).toBe(forventet);
});

it('håndtaket bærer dra-gesten, ikke resten av dokken', () => {
  const h = grep(render({isReporter: true, reporterDockOpen: true})).props;
  // Uten disse er håndtaket bare en strek å se på.
  expect(typeof h.onStartShouldSetResponder).toBe('function');
  expect(typeof h.onResponderRelease).toBe('function');
  // ⚠️ Draget ligger IKKE på «Mål oss»: en gest som startet der ville
  // stjålet trykket i kampens mest tidskritiske øyeblikk.
  const maalOss = render({isReporter: true, reporterDockOpen: true}).root.find(
    n => n.props?.accessibilityLabel === 'Registrer mål for oss',
  );
  expect(maalOss.props.onResponderRelease).toBeUndefined();
});

it('håndtaket forteller VoiceOver at det kan dras', () => {
  const h = grep(render({isReporter: true, reporterDockOpen: true})).props;
  expect(h.accessibilityHint).toBe('Dra ned for å lukke');
});

// ---------------------------------------------------------------------------
// BEVEGELSEN (Brage 2026-08-21: «rapporter skjermen går stygt ned»)
// ---------------------------------------------------------------------------

/**
 * ⚠️ OPACITY-SNAPPET LAR SEG IKKE TESTE HER, OG DET SKAL STÅ SKREVET.
 *
 * Den faktiske feilen bak «rapporter skjermen går stygt ned» var
 * `opacity: open ? 1 : 0` — et tall som SNAPPET til 0 i samme øyeblikk
 * `open` ble false, mens `translateY` fortsatt animerte. Dokken forsvant
 * altså med et klipp i stedet for å gli. Rettelsen er at opacity nå er
 * AVLEDET av den samme animerte verdien.
 *
 * `react-test-renderer` løser Animated-verdier til TALL i utdata, så en
 * assert her ville sett nøyaktig likt ut før og etter rettelsen. Den er
 * derfor telefonverifisert, ikke testverifisert — og det er ærligere å
 * skrive det enn å ha en grønn test som ikke beviser noe.
 */

it('gesten tar berøringen i CAPTURE-fasen — ellers vinner den ikke', () => {
  const h = grep(render({isReporter: true, reporterDockOpen: true})).props;
  // Lærdommen fra CommentSheet 4.3: en terskel på onMove alene gjør
  // gesten upålitelig. Håndtaket må ta den allerede ved berøring.
  expect(typeof h.onStartShouldSetResponderCapture).toBe('function');
  expect(typeof h.onMoveShouldSetResponderCapture).toBe('function');
});
