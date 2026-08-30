/**
 * @format
 *
 * BOOTFRØET I TEAMCONTEXT (S7b) — kaldstart uten å vente på nettet.
 *
 * persistedCache-modulen er mocket (frøformatet/ryddingen fryses i
 * persistedCache.test.tsx); her fryses KAPPLØPET og portene i TeamContext:
 *
 *   1. GJENTATT KALDSTART MED FRØ: navigator-porten (`loading`) slippes og
 *      sist aktive lag tegnes MENS kontekst-RPC-en fortsatt er uløst —
 *      fem sekunder tregt nett gir cached hjemskjerm, ikke BootScreen.
 *      Kontekst-kallet starter umiddelbart uansett (krav 4).
 *   2. OFFLINE GJENTATT KALDSTART: RPC null + fallback feiler → frølista
 *      blir stående (aldri tom-liste/onboarding-dump), fortsatt uten rolle.
 *   3. FØRSTE ÅPNING UTEN FRØ: dagens BootScreen-flyt — loading holder til
 *      nettet svarer.
 *   4. FERSKT VINNER: et nettsvar som lander før (eller mens) disken leser,
 *      kan aldri overskrives av frøet (krav 7).
 *   5. FERSK LISTE UTEN LAGET: aktivt lag korrigeres, query-cachen prunes
 *      og frøet omskrives uten laget (krav 6).
 *   6. CACHED ROLLE ER IKKE AUTORISASJON: activeRole er null helt til
 *      lista er ferskt verifisert (krav 9).
 */

import React, {useEffect} from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRefreshSessionContext = jest.fn();
jest.mock('../src/lib/queries/sessionContext', () => ({
  refreshSessionContext: (...a: unknown[]) => mockRefreshSessionContext(...a),
  peekSessionContext: jest.fn(),
  abandonSessionContext: jest.fn(),
}));

const mockGetUserMemberships = jest.fn();
jest.mock('../src/lib/api/teams', () => ({
  getUserMemberships: (...a: unknown[]) => mockGetUserMemberships(...a),
  getTeamMemberCount: jest.fn(() => Promise.resolve(12)),
}));

const mockReadBootSeed = jest.fn();
const mockWriteBootSeedMemberships = jest.fn();
const mockRestorePersistedQueries = jest.fn();
const mockPrunePersistedTeams = jest.fn();
jest.mock('../src/lib/queries/persistedCache', () => ({
  readBootSeed: (...a: unknown[]) => mockReadBootSeed(...a),
  writeBootSeedMemberships: (...a: unknown[]) =>
    mockWriteBootSeedMemberships(...a),
  restorePersistedQueries: (...a: unknown[]) =>
    mockRestorePersistedQueries(...a),
  prunePersistedTeams: (...a: unknown[]) => mockPrunePersistedTeams(...a),
}));

jest.mock('../src/context/UserContext', () => ({
  useAuth: () => ({session: {user: {id: 'user-a'}}}),
}));

jest.mock('../src/navigation/deepLink', () => ({
  registerTeamSwitcher: jest.fn(),
}));

const mockPurgeMediaCacheByPrefix = jest.fn(() => Promise.resolve());
jest.mock('../src/lib/media/resolver', () => ({
  purgeMediaCacheByPrefix: (...a: unknown[]) =>
    mockPurgeMediaCacheByPrefix(...a),
}));

import {TeamProvider, useActiveTeam} from '../src/context/TeamContext';

const ACTIVE_TEAM_KEY = 'heia:activeTeamSpace:v1';

function membership(teamSpaceId: string, role = 'trener', name = 'Heia G12') {
  return {
    id: `m-${teamSpaceId}`,
    userId: 'user-a',
    teamSpaceId,
    role,
    status: 'active',
    joinedAt: '2026-08-01T10:00:00+00:00',
    managedChildId: null,
    managedChildName: null,
    teamSpace: {
      id: teamSpaceId,
      teamId: 't-1',
      displayName: name,
      color: '#112233',
      logoUrl: null,
      inviteCode: 'ABCDEFGH',
      isActivated: false,
      activatedAt: null,
    },
    team: {
      id: 't-1',
      name: 'G12',
      ageGroup: '2014',
      gender: 'mixed',
      level: null,
      club: {id: 'c-1', name: 'Verify IL', shortName: 'VIL', logoUrl: null},
      sport: {id: 's-1', slug: 'fotball', displayName: 'Fotball'},
    },
  } as any;
}

function ctxResult(memberships: unknown[]) {
  return {
    profile: {id: 'user-a', displayName: 'Brage'},
    memberships,
    coveredTeamSpaceId: null,
    memberCount: null,
    unreadCount: 0,
    liveMatch: null,
    supportSummary: null,
    runtimeFlags: {},
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

type TeamValue = ReturnType<typeof useActiveTeam>;

function Probe({onRender}: {onRender: (v: TeamValue) => void}) {
  const value = useActiveTeam();
  useEffect(() => {
    onRender(value);
  });
  return null;
}

async function renderTeamProvider(): Promise<{latest: () => TeamValue}> {
  let current: TeamValue | undefined;
  await act(async () => {
    ReactTestRenderer.create(
      <TeamProvider>
        <Probe onRender={v => (current = v)} />
      </TeamProvider>,
    );
  });
  return {latest: () => current as TeamValue};
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockRestorePersistedQueries.mockResolvedValue(undefined);
  mockReadBootSeed.mockResolvedValue(null);
  mockGetUserMemberships.mockRejectedValue(new Error('offline'));
});

test('cached hjemskjerm kan monteres mens kontekst-RPC-en holdes uløst', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, 'ts-1');
  mockReadBootSeed.mockResolvedValue({
    profile: null,
    memberships: [membership('ts-1')],
  });
  // Fem sekunder tregt nett = et kall som aldri løses i testen.
  mockRefreshSessionContext.mockReturnValue(deferred().promise);

  const probe = await renderTeamProvider();

  // Krav 4: kontekst-kallet startet umiddelbart, frøet ventet ikke på det.
  expect(mockRefreshSessionContext).toHaveBeenCalledTimes(1);
  // AppNavigator-porten `session && teamLoading` (AppNavigator:578) slipper:
  const v = probe.latest();
  expect(v.loading).toBe(false);
  expect(v.userMemberships).toHaveLength(1);
  expect(v.activeTeamSpaceId).toBe('ts-1');
  expect(v.activeTeamSpace?.displayName).toBe('Heia G12');
  // Krav 9: cached trener-rolle gir IKKE privilegert UI før verifisering.
  expect(v.activeRole).toBeNull();
});

test('offline gjentatt cold start kommer inn på cached hjemskjerm', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, 'ts-1');
  mockReadBootSeed.mockResolvedValue({
    profile: null,
    memberships: [membership('ts-1')],
  });
  // S2-degraderingen offline: kontekst null → fallback-kallet feiler.
  mockRefreshSessionContext.mockResolvedValue(null);
  mockGetUserMemberships.mockRejectedValue(new Error('Network request failed'));

  const probe = await renderTeamProvider();

  const v = probe.latest();
  // Frølista står — ALDRI tom liste (som hadde dumpet brukeren i
  // onboarding/lagløs-grenen) — og ingen ny myndighet (krav 10).
  expect(v.loading).toBe(false);
  expect(v.userMemberships).toHaveLength(1);
  expect(v.activeTeamSpaceId).toBe('ts-1');
  expect(v.activeRole).toBeNull();
});

test('første åpning uten frø beholder dagens BootScreen-flyt', async () => {
  mockReadBootSeed.mockResolvedValue(null);
  const rpc = deferred<any>();
  mockRefreshSessionContext.mockReturnValue(rpc.promise);

  const probe = await renderTeamProvider();

  // Uten frø: porten holder (BootScreen) til nettet svarer.
  expect(probe.latest().loading).toBe(true);
  expect(probe.latest().userMemberships).toHaveLength(0);

  await act(async () => {
    rpc.resolve(ctxResult([membership('ts-1')]));
  });
  const v = probe.latest();
  expect(v.loading).toBe(false);
  expect(v.userMemberships).toHaveLength(1);
  // Fersk liste = verifisert rolle, og frøet skrives for neste kaldstart.
  expect(v.activeRole).toBe('trener');
  expect(mockWriteBootSeedMemberships).toHaveBeenCalledWith('user-a', [
    expect.objectContaining({teamSpaceId: 'ts-1'}),
  ]);
});

test('ferskt nettverkssvar vinner over treg diskrestore', async () => {
  const seed = deferred<any>();
  mockReadBootSeed.mockReturnValue(seed.promise);
  mockRefreshSessionContext.mockResolvedValue(
    ctxResult([membership('ts-1', 'trener', 'Fersk G12')]),
  );

  const probe = await renderTeamProvider();

  // Nettet landet først: fersk liste, verifisert rolle.
  expect(probe.latest().loading).toBe(false);
  expect(probe.latest().activeRole).toBe('trener');
  expect(probe.latest().activeTeamSpace?.displayName).toBe('Fersk G12');

  // Så lander disken — med et ANNET lag. Skal være en ren no-op (krav 7).
  await act(async () => {
    seed.resolve({profile: null, memberships: [membership('ts-9', 'trener')]});
  });
  const v = probe.latest();
  expect(v.userMemberships).toHaveLength(1);
  expect(v.userMemberships[0].teamSpaceId).toBe('ts-1');
  expect(v.activeTeamSpaceId).toBe('ts-1');
  expect(v.activeTeamSpace?.displayName).toBe('Fersk G12');
});

test('fersk medlemsliste som mangler laget purger cache og korrigerer navigasjon', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, 'ts-2');
  mockReadBootSeed.mockResolvedValue({
    profile: null,
    memberships: [membership('ts-1'), membership('ts-2', 'trener', 'Gamle')],
  });
  const rpc = deferred<any>();
  mockRefreshSessionContext.mockReturnValue(rpc.promise);

  const probe = await renderTeamProvider();

  // Frøet booter på sist aktive lag (ts-2) mens nettet henger.
  expect(probe.latest().activeTeamSpaceId).toBe('ts-2');
  expect(probe.latest().loading).toBe(false);

  // Fersk liste: brukeren er ute av ts-2.
  await act(async () => {
    rpc.resolve(ctxResult([membership('ts-1')]));
  });
  const v = probe.latest();
  expect(v.activeTeamSpaceId).toBe('ts-1');
  expect(v.userMemberships).toHaveLength(1);
  // S7-cachen prunes til KUN ferske lag, frøet omskrives uten ts-2, og
  // lagets signerte medie-URL-er purges (P1-vakten).
  expect(mockPrunePersistedTeams).toHaveBeenCalledWith(['ts-1']);
  expect(mockWriteBootSeedMemberships).toHaveBeenCalledWith('user-a', [
    expect.objectContaining({teamSpaceId: 'ts-1'}),
  ]);
  expect(mockPurgeMediaCacheByPrefix).toHaveBeenCalledWith('ts-2');
});

test('cached adminrolle gir ikke privilegert UI før fersk verifisering', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, 'ts-1');
  mockReadBootSeed.mockResolvedValue({
    profile: null,
    memberships: [membership('ts-1', 'trener')],
  });
  const rpc = deferred<any>();
  mockRefreshSessionContext.mockReturnValue(rpc.promise);

  const probe = await renderTeamProvider();

  // Frø-booted: laget tegnes, men rollen (all isTeamAdmin-gating) er null.
  expect(probe.latest().activeTeamSpaceId).toBe('ts-1');
  expect(probe.latest().activeRole).toBeNull();

  await act(async () => {
    rpc.resolve(ctxResult([membership('ts-1', 'trener')]));
  });
  // Først etter fersk verifisering får treneren admin-flatene sine.
  expect(probe.latest().activeRole).toBe('trener');
});
