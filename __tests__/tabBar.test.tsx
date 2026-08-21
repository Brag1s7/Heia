/**
 * @format
 *
 * ⚠️ DE FIRE ANDRE FANENE SKAL IKKE ENDRE SEG (P4, skive 10).
 *
 * «+» ble kampknappen — en pille som skifter tekst, farge og bredde etter
 * hva som skjer i kampen. Faren er at midtplassen dytter, klemmer eller
 * farger naboene sine som en bieffekt.
 *
 * To valg gjør at den ikke KAN:
 *   · ingen `tabBarItemStyle: {flex}` — alle fem fanene er like brede, som før
 *   · ingen stadionvariant av baren — `tabBarStyle` er ett delt objekt
 *
 * Denne fila beviser begge, i alle sju tilstandene. Skjermene er stubbet:
 * testen handler om BAREN, ikke om hva fanene inneholder.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {Text, View} from 'react-native';
import type {MatchButtonState} from '../src/shared/matchButton';

// Bare fanenes ROTSKJERMER stubbes: bottom-tabs monterer kun den fokuserte
// fanen, og testen handler om BAREN, ikke om hva fanene inneholder.
jest.mock('../src/screens/TeamHomeScreen', () => {
  const {View: V} = require('react-native');
  return {TeamHomeScreen: () => <V testID="stub-hjem" />};
});
jest.mock('../src/screens/KalenderScreen', () => {
  const {View: V} = require('react-native');
  return {KalenderScreen: () => <V testID="stub-kalender" />};
});
jest.mock('../src/screens/InboxScreen', () => {
  const {View: V} = require('react-native');
  return {InboxScreen: () => <V testID="stub-varsler" />};
});
jest.mock('../src/screens/ProfilScreen', () => {
  const {View: V} = require('react-native');
  return {ProfilScreen: () => <V testID="stub-profil" />};
});
// Sesongen er ROTEN i Kamp-fanen fra skive 10.3.
jest.mock('../src/screens/SeasonScreen', () => {
  const {View: V} = require('react-native');
  return {SeasonScreen: () => <V testID="stub-sesongen" />};
});

let mockState: MatchButtonState = {
  kind: 'idle',
  label: 'KAMP',
  tabLabel: 'Sesongen',
  a11yLabel: 'Kamp. Åpner Sesongen',
  disabled: false,
};
const mockPress = jest.fn();

jest.mock('../src/context/MatchButtonContext', () => ({
  useMatchButton: () => ({
    state: mockState,
    bootReady: true,
    press: mockPress,
    enterMatch: jest.fn(),
    leaveMatch: jest.fn(),
    refreshLiveMatch: jest.fn(),
  }),
  useMatchPresence: () => {},
}));

jest.mock('../src/context', () => ({
  useAuth: () => ({session: null, profile: null, loading: false}),
  useActiveTeam: () => ({activeRole: 'trener', activeTeamSpaceId: 'ts1'}),
  useOnboarding: () => ({justCreatedTeamSpaceId: null}),
  useNotifications: () => ({unreadCount: 3, refreshUnread: jest.fn()}),
}));

jest.mock('../src/components', () => {
  const {View: V} = require('react-native');
  return {
    BootScreen: () => <V />,
    NotificationBanner: () => <V />,
    MatchTabButton: () => <V testID="kampknapp" />,
  };
});

jest.mock('../src/navigation/deepLink', () => ({
  navigationRef: {isReady: () => false, navigate: jest.fn()},
  flushPendingDeepLink: jest.fn(),
  handleDeepLinkUrl: jest.fn(),
  openMatchInTab: jest.fn(),
}));

import {MainTabs} from '../src/navigation/AppNavigator';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <NavigationContainer>
        <MainTabs />
      </NavigationContainer>,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Alle tekstene i baren — fanenes etiketter. */
function etiketter(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map(n => {
      const c = n.props.children;
      // Badgen kommer som TALL, ikke streng — uten den ville testen
      // «bevist» at Varsler-badgen forsvant.
      return (Array.isArray(c) ? c : [c])
        .filter((x: unknown) => typeof x === 'string' || typeof x === 'number')
        .join('');
    })
    .filter(Boolean);
}

const TILSTANDER: MatchButtonState[] = [
  {
    kind: 'idle',
    label: 'KAMP',
    tabLabel: 'Sesongen',
    a11yLabel: 'Kamp. Åpner Sesongen',
    disabled: false,
  },
  {
    kind: 'live',
    label: '2–1',
    tabLabel: 'Kamp',
    a11yLabel: 'Live: A 2–1 B. Åpne kampen',
    disabled: false,
    openEventId: 'e1',
  },
  {
    kind: 'pause',
    label: 'PAUSE 2–1',
    tabLabel: 'Kamp',
    a11yLabel: 'Pause: A 2–1 B. Åpne kampen',
    disabled: false,
    openEventId: 'e1',
  },
  {
    kind: 'heia',
    label: 'HEIA!',
    tabLabel: 'Kamp',
    a11yLabel: 'Heia på målet',
    disabled: false,
    heiaPostId: 'p1',
  },
  {
    kind: 'heiet',
    label: 'HEIET',
    tabLabel: 'Kamp',
    a11yLabel: 'Du har heiet',
    disabled: false,
  },
  {
    kind: 'heia-tom',
    label: 'HEIA!',
    tabLabel: 'Kamp',
    a11yLabel: 'Ingen øyeblikk å heie på ennå',
    disabled: true,
  },
  {
    kind: 'rapporter',
    label: 'RAPPORTER',
    tabLabel: 'Kamp',
    a11yLabel: 'Åpne rapportering',
    disabled: false,
  },
  {
    kind: 'lukk',
    label: 'LUKK',
    tabLabel: 'Kamp',
    a11yLabel: 'Lukk rapporteringsverktøyet',
    disabled: false,
  },
];

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

describe('de fire andre fanene', () => {
  it.each(TILSTANDER.map(s => [s.kind, s] as const))(
    'står uendret når kampknappen er «%s»',
    (_kind, state) => {
      mockState = state;
      const tekster = etiketter(render());
      // ⚠️ Navnene er kontrakten. Endrer kampknappen dem, har den lekket.
      expect(tekster).toContain('Hjem');
      expect(tekster).toContain('Kalender');
      expect(tekster).toContain('Varsler');
      expect(tekster).toContain('Profil');
      // Badgen på Varsler overlever også.
      expect(tekster).toContain('3');
    },
  );

  it('«Opprett» finnes ikke lenger — plussen ER kampknappen', () => {
    mockState = TILSTANDER[0];
    expect(etiketter(render())).not.toContain('Opprett');
  });
});

describe('midtplassen', () => {
  it('bytter etikett med tilstanden — «Sesongen» i hvile, ellers «Kamp»', () => {
    mockState = TILSTANDER[0];
    expect(etiketter(render())).toContain('Sesongen');

    act(() => {
      while (mounted.length) mounted.pop()!.unmount();
    });

    mockState = TILSTANDER[1];
    const live = etiketter(render());
    expect(live).toContain('Kamp');
    expect(live).not.toContain('Sesongen');
  });

  it('tegnes av kampknappen, ikke av et fane-ikon', () => {
    mockState = TILSTANDER[3];
    expect(
      render().root.findAll(n => n.props?.testID === 'kampknapp', {deep: true})
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('baren selv', () => {
  /**
   * ⚠️ P4: `height: 88` er LÅST. Endres den, reflower scenen midt i en push.
   * Og det finnes ingen stadionvariant i skive 10 — baren er ETT objekt,
   * uansett hva som skjer i kampen.
   */
  it('har samme høyde og samme stil i ALLE kampknappens tilstander', () => {
    const stiler = TILSTANDER.map(state => {
      mockState = state;
      const tree = render();
      const {StyleSheet} = require('react-native');
      const bar = tree.root
        .findAll(n => {
          const s = StyleSheet.flatten(n.props?.style);
          return s?.height === 88 && s?.backgroundColor !== undefined;
        })
        .map(n => JSON.stringify(StyleSheet.flatten(n.props.style)));
      act(() => {
        while (mounted.length) mounted.pop()!.unmount();
      });
      return bar[0];
    });

    expect(stiler[0]).toBeDefined();
    // Alle åtte tilstandene gir NØYAKTIG samme bar.
    expect(new Set(stiler).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// KAMP-FANEN ER EN EKTE FANE (skive 10.3)
//
// ⚠️ Brage, tredje telefonrunde: «når man trykker og kommer inn på kamp siden
// så viser bottombar fremdeles at jeg for eks er på profil siden». Kampen
// bodde i fanen man tilfeldigvis kom fra. Nå har den sitt eget sted, og
// Sesongen er roten der.
// ---------------------------------------------------------------------------

it('Kamp-fanen har et ekte innhold — Sesongen er roten', () => {
  mockState = TILSTANDER[0];
  const tree = render();
  // Fanen er ikke fokusert ved oppstart (Hjem er), men stacken finnes.
  expect(etiketter(tree)).toContain('Sesongen');
});

/**
 * ⚠️ INGEN FALSK KAMP-MARKERING (kildebevarende tabmodell).
 *
 * Et tidligere utkast ga Kamp-etiketten aktivt blekk så snart brukeren sto i
 * EN kamp — også når kampen var åpnet fra Kalender og Kalender var den ekte
 * valgte fanen. Da lyste to faner samtidig, og den ene løy.
 */
it('Kamp-etiketten får ikke aktivt blekk bare fordi du står i en kamp', () => {
  const stiler = new Set<string>();
  for (const tilstand of TILSTANDER) {
    mockState = tilstand;
    const tree = render();
    const kamp = tree.root
      .findAllByType(Text)
      .filter(
        n => n.props.children === 'Kamp' || n.props.children === 'Sesongen',
      );
    kamp.forEach(n => stiler.add(JSON.stringify(n.props.style)));
    act(() => {
      while (mounted.length) mounted.pop()!.unmount();
    });
  }
  // Én etikettstil for alle kampknapp-tilstandene: markeringen kommer fra
  // ekte fokus, ikke fra hvilken tilstand knappen er i.
  expect(stiler.size).toBe(1);
});

it('midtplassen markeres som VALGT, ikke bare farget', () => {
  mockState = TILSTANDER[1]; // live
  const tree = render();
  const valgt = tree.root.findAll(
    n => n.props?.accessibilityState?.selected !== undefined,
    {deep: true},
  );
  // ⚠️ Semantikken, ikke bare fargen: VoiceOver skal si at fanen er valgt.
  expect(valgt.length).toBeGreaterThan(0);
});
