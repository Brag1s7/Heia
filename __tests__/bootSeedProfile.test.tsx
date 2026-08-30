/**
 * @format
 *
 * BOOTFRØET I USERCONTEXT (S7b) — profil-porten uten nett.
 *
 * AppNavigator holder BootScreen på `session && !profile` — frøets minimale
 * profil skal slippe porten mens kontekst-kallet henger, og et ferskt svar
 * skal alltid vinne over disken (krav 7). Frøet leses kun for nøyaktig den
 * innloggede userId-en (krav 2).
 */

import React, {useEffect} from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({data: {session: {user: {id: 'user-a'}}}}),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: {subscription: {unsubscribe: jest.fn()}},
      })),
      signOut: jest.fn(() => Promise.resolve({error: null})),
    },
  },
}));

const mockRefreshSessionContext = jest.fn();
jest.mock('../src/lib/queries/sessionContext', () => ({
  refreshSessionContext: (...a: unknown[]) => mockRefreshSessionContext(...a),
}));

const mockGetProfile = jest.fn();
jest.mock('../src/lib/api/profile', () => ({
  getProfile: (...a: unknown[]) => mockGetProfile(...a),
}));

const mockReadBootSeed = jest.fn();
const mockWriteBootSeedProfile = jest.fn();
jest.mock('../src/lib/queries/persistedCache', () => ({
  readBootSeed: (...a: unknown[]) => mockReadBootSeed(...a),
  writeBootSeedProfile: (...a: unknown[]) => mockWriteBootSeedProfile(...a),
}));

jest.mock('../src/lib/account', () => ({
  clearLocalCaches: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/lib/push', () => ({
  stopPush: jest.fn(() => Promise.resolve()),
}));

import {AuthProvider, useAuth} from '../src/context/UserContext';

function profileFixture(displayName: string) {
  return {
    id: 'user-a',
    displayName,
    avatarPath: null,
    avatarColor: null,
    phone: null,
    locale: 'nb',
    onboardingCompleted: true,
    onboardingCompletedAt: '2026-08-01T10:00:00+00:00',
    householdId: null,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(res => (resolve = res));
  return {promise, resolve};
}

type AuthValue = ReturnType<typeof useAuth>;

function Probe({onRender}: {onRender: (v: AuthValue) => void}) {
  const value = useAuth();
  useEffect(() => {
    onRender(value);
  });
  return null;
}

async function renderAuthProvider(): Promise<{latest: () => AuthValue}> {
  let current: AuthValue | undefined;
  await act(async () => {
    ReactTestRenderer.create(
      <AuthProvider>
        <Probe onRender={v => (current = v)} />
      </AuthProvider>,
    );
  });
  return {latest: () => current as AuthValue};
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfile.mockRejectedValue(new Error('offline'));
});

test('frø-profilen slipper profil-porten mens kontekst-kallet henger', async () => {
  mockReadBootSeed.mockResolvedValue({
    profile: profileFixture('Frø-Brage'),
    memberships: null,
  });
  const rpc = deferred<any>();
  mockRefreshSessionContext.mockReturnValue(rpc.promise);

  const probe = await renderAuthProvider();

  // Porten `session && !profile` (AppNavigator:577) slipper på disk alene —
  // og frøet ble lest for nøyaktig den innloggede brukeren (krav 2).
  expect(probe.latest().session?.user?.id).toBe('user-a');
  expect(probe.latest().profile?.displayName).toBe('Frø-Brage');
  expect(mockReadBootSeed).toHaveBeenCalledWith('user-a');

  // Ferskt svar erstatter frøet og skrives tilbake som neste frø.
  await act(async () => {
    rpc.resolve({profile: profileFixture('Fersk-Brage')});
  });
  expect(probe.latest().profile?.displayName).toBe('Fersk-Brage');
  expect(mockWriteBootSeedProfile).toHaveBeenCalledWith(
    'user-a',
    expect.objectContaining({displayName: 'Fersk-Brage'}),
  );
});

test('offline: frø-profilen overlever at både kontekst og fallback feiler', async () => {
  mockReadBootSeed.mockResolvedValue({
    profile: profileFixture('Frø-Brage'),
    memberships: null,
  });
  mockRefreshSessionContext.mockResolvedValue(null);
  mockGetProfile.mockRejectedValue(new Error('Network request failed'));

  const probe = await renderAuthProvider();

  expect(probe.latest().profile?.displayName).toBe('Frø-Brage');
});

test('ferskt profilsvar vinner over treg diskrestore', async () => {
  const seed = deferred<any>();
  mockReadBootSeed.mockReturnValue(seed.promise);
  mockRefreshSessionContext.mockResolvedValue({
    profile: profileFixture('Fersk-Brage'),
  });

  const probe = await renderAuthProvider();
  expect(probe.latest().profile?.displayName).toBe('Fersk-Brage');

  // Disken lander sist — skal være en ren no-op (krav 7).
  await act(async () => {
    seed.resolve({profile: profileFixture('Frø-Brage'), memberships: null});
  });
  expect(probe.latest().profile?.displayName).toBe('Fersk-Brage');
});

test('frø for feil bruker brukes aldri', async () => {
  mockReadBootSeed.mockResolvedValue({
    profile: {...profileFixture('Feil bruker'), id: 'user-b'},
    memberships: null,
  });
  mockRefreshSessionContext.mockReturnValue(deferred().promise);

  const probe = await renderAuthProvider();

  // id-vakten i UserContext: et frø med annen eier setter aldri profilen.
  expect(probe.latest().profile).toBeNull();
});
