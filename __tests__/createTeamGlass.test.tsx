/**
 * @format
 *
 * «OPPRETT LAG» PÅ ARKET (Brage 2026-09-04, runde 7: «når man trykker
 * opprett lag så kommer ikke idrettene opp, er bare et blankt mellomrom»).
 *
 * Skjemaet står på ETT glassark (LiquidGlassSurface). Idrettene lastes
 * asynkront og monteres ETTER at arket står — det er det ene innholdet på
 * siden som kommer sent. Denne testen monterer skjermen med idretter som
 * kommer etter første render, og krever at pillene faktisk står inne på
 * arket, og at ventetilstanden er synlig på perlen (bones i blekk-tint).
 *
 * Det den IKKE kan se: pikslene på telefonen. Den vokter strukturen.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {CreateTeamScreen} from '../src/screens/CreateTeamScreen';
import {LiquidGlassSurface} from '../src/components/LiquidGlassSurface';
import {Skeleton} from '../src/components/Skeleton';

let resolveSports: (s: unknown[]) => void = () => {};
jest.mock('../src/lib/api/teams', () => ({
  getCachedSports: () => null,
  getSports: () =>
    new Promise(resolve => {
      resolveSports = resolve;
    }),
  searchClubs: () => Promise.resolve([]),
}));
jest.mock('../src/context', () => ({
  useAuth: () => ({session: {user: {id: 'u1'}}}),
  useActiveTeam: () => ({userMemberships: [], activeTeamSpace: null}),
  useOnboarding: () => ({
    setPendingAction: jest.fn(),
    executeCreate: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useIsFocused: () => true,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({top: 59, bottom: 34, left: 0, right: 0}),
}));

const SPORTS = [
  {id: '1', slug: 'fotball', displayName: 'Fotball'},
  {id: '2', slug: 'handball', displayName: 'Håndball'},
];

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function mount() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<CreateTeamScreen />);
  });
  mounted.push(tree);
  return tree;
}

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map(t => String(t.props.children));

describe('Opprett lag: idrettene er der fra første render', () => {
  it('TeamContext varmer idrettscachen ved boot (kildesjekk)', () => {
    // Brage 2026-09-04: «hvorfor kan de ikke lastes inn som at de bare er
    // der når man går inn på siden første gangen». Svaret er at cachen
    // varmes ved boot, ikke først når siden åpnes. Forsvinner dette kallet,
    // kommer skjelettet tilbake på første besøk.
    //
    // ⚠️ FRA DISK, IKKE FRA NETT (punkt 103): oppvarmingen var et
    // `getSports()`, altså et HTTP-kall i hver kaldstart for en skjerm de
    // fleste aldri åpner. Kravet er det samme — pillene skal stå der — men
    // lista overlever nå på disk mellom øktene.
    const src = fs.readFileSync(
      path.join(__dirname, '../src/context/TeamContext.tsx'),
      'utf8',
    );
    expect(src).toMatch(
      /if \(!isRefresh\) \{\s*primeSportsFromDisk\(\)\.catch\(\(\) => \{\}\);\s*\}/,
    );
  });
});

describe('Opprett lag: idrettene på arket', () => {
  it('viser ventetilstanden SYNLIG på perlen mens idrettene lastes', () => {
    const tree = mount();
    const bones = tree.root
      .findAllByType(Skeleton)
      .filter(s => s.props.round && s.props.height === 36);
    expect(bones).toHaveLength(3);
    for (const b of bones) {
      const flat = StyleSheet.flatten(b.props.style);
      expect(flat.backgroundColor).toBe('rgba(8, 57, 46, 0.1)');
    }
  });

  it('idrettene som kommer sent monteres INNE på skjemaarket', async () => {
    const tree = mount();
    expect(texts(tree)).not.toContain('Fotball');
    await act(async () => {
      resolveSports(SPORTS);
    });
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['Fotball', 'Håndball']),
    );
    // Pillen står i arket: nærmeste LiquidGlassSurface-forelder finnes.
    const pill = tree.root.find(
      n => n.type === Text && n.props.children === 'Fotball',
    );
    let node = pill.parent;
    let inGlass = false;
    while (node) {
      if (node.type === LiquidGlassSurface) {
        inGlass = true;
        break;
      }
      node = node.parent;
    }
    expect(inGlass).toBe(true);
    // Ingen bones igjen, ingen feiltekst.
    expect(
      tree.root.findAllByType(Skeleton).filter(s => s.props.height === 36),
    ).toHaveLength(0);
    expect(texts(tree).join(' ')).not.toContain('Kunne ikke laste idretter');
  });

  it('arket får ny contentVersion når idrettene kommer — nudgen fyrer', async () => {
    // Fabric-interop: barn montert i en senere commit enn glasset vises
    // ikke før neste oppdatering under glasset. Versjonen må ENDRE seg
    // når idrettene kommer, ellers blir de stående usynlige til brukeren
    // tilfeldigvis rører noe annet (fargevalget, Brage 2026-09-04).
    const tree = mount();
    const before = tree.root.findByType(LiquidGlassSurface).props
      .contentVersion as string;
    expect(typeof before).toBe('string');
    await act(async () => {
      resolveSports(SPORTS);
    });
    const after = tree.root.findByType(LiquidGlassSurface).props
      .contentVersion as string;
    expect(after).not.toBe(before);
  });

  it('skjemaet er ett ark (sheet), felt og etiketter inni', () => {
    const tree = mount();
    const glass = tree.root.findAllByType(LiquidGlassSurface);
    expect(glass).toHaveLength(1);
    expect(glass[0].props.variant).toBe('sheet');
    // Skjemaet ligger UTENFOR native-viewet (glasset er bakgrunn bak det):
    // idrettspillene var usynlige inne i det (Brage 2026-09-04).
    expect(glass[0].props.detached).toBe(true);
    const labels = glass[0].findAllByType(Text).map(t => t.props.children);
    expect(labels).toEqual(
      expect.arrayContaining(['Lagnavn', 'Klubb', 'Idrett', 'Alder / kull']),
    );
  });
});
