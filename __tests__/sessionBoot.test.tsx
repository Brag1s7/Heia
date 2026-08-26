/**
 * @format
 *
 * BOOT-KJEDEN OVER KONTEKST-RPC-EN (S2) — wiring-beviset.
 *
 * Orkestratoren er mocket (dens egne garantier fryses i
 * sessionContext.test.tsx); her fryses at KONTEKSTENE faktisk bruker den:
 *
 *   1. BOOT MED DEKKET KANDIDAT = NULL ENKELTKALL: TeamContext tar
 *      memberships + membercount fra kontekst-svaret (aldri
 *      getUserMemberships/getTeamMemberCount), NotificationsContext tar
 *      telleren via peek (aldri getUnreadCount) — og boot-prefetchen av
 *      feed/events er bestilt (bootPrefetchUserId).
 *   2. FALLBACK: kontekst-svar null (RPC mangler/feiler) → NØYAKTIG
 *      dagens enkeltkall, og appen booter som før S2.
 *   3. FOREGROUND-RESUME: begge AppState-lytterne går via
 *      refreshSessionContext (single-flight gjør dem til ett HTTP-kall i
 *      prod), og badgen tar telleren fra svaret — fortsatt uten HEAD-kall.
 */

import React from 'react';
import {AppState} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

const mockRefreshSessionContext = jest.fn();
const mockPeekSessionContext = jest.fn();
jest.mock('../src/lib/queries/sessionContext', () => ({
  refreshSessionContext: (...a: unknown[]) => mockRefreshSessionContext(...a),
  peekSessionContext: (...a: unknown[]) => mockPeekSessionContext(...a),
  abandonSessionContext: jest.fn(),
}));

const mockGetUserMemberships = jest.fn();
const mockGetTeamMemberCount = jest.fn();
jest.mock('../src/lib/api/teams', () => ({
  getUserMemberships: (...a: unknown[]) => mockGetUserMemberships(...a),
  getTeamMemberCount: (...a: unknown[]) => mockGetTeamMemberCount(...a),
}));

const mockGetUnreadCount = jest.fn();
jest.mock('../src/lib/api/notifications', () => ({
  getUnreadCount: (...a: unknown[]) => mockGetUnreadCount(...a),
  markAsRead: jest.fn(() => Promise.resolve()),
  markAllAsRead: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/context/UserContext', () => ({
  useAuth: () => ({session: {user: {id: 'user-1'}}}),
}));

jest.mock('../src/navigation/deepLink', () => ({
  registerTeamSwitcher: jest.fn(),
}));

jest.mock('../src/lib/media/resolver', () => ({
  purgeMediaCacheByPrefix: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/lib/supabase', () => {
  const channelObj: any = {
    on: jest.fn(() => channelObj),
    subscribe: jest.fn(() => channelObj),
  };
  return {
    supabase: {channel: jest.fn(() => channelObj), removeChannel: jest.fn()},
  };
});

import {TeamProvider, useActiveTeam} from '../src/context/TeamContext';
import {
  NotificationsProvider,
  useNotifications,
} from '../src/context/NotificationsContext';

const membership = {
  id: 'm1',
  userId: 'user-1',
  teamSpaceId: 'ts-1',
  role: 'trener',
  status: 'active',
  joinedAt: '2026-08-01T10:00:00+00:00',
  managedChildId: null,
  managedChildName: null,
  teamSpace: {
    id: 'ts-1',
    teamId: 't-1',
    displayName: 'Heia G12',
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

function ctxResult(overrides: Record<string, unknown> = {}) {
  return {
    profile: {id: 'user-1', displayName: 'Brage'},
    memberships: [membership],
    coveredTeamSpaceId: 'ts-1',
    memberCount: 12,
    unreadCount: 3,
    liveMatch: null,
    supportSummary: null,
    runtimeFlags: {
      realtimeTransport: {match: 'pgc', feed: 'pgc', notif: 'pgc'},
      liveFallbackPollS: 0,
      minBuild: 0,
    },
    ...overrides,
  };
}

let team: ReturnType<typeof useActiveTeam>;
let notif: ReturnType<typeof useNotifications>;
function Probe() {
  team = useActiveTeam();
  notif = useNotifications();
  return null;
}

let appStateListeners: Array<(s: string) => void>;

async function mountApp() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <TeamProvider>
        <NotificationsProvider>
          <Probe />
        </NotificationsProvider>
      </TeamProvider>,
    );
  });
  // AsyncStorage-lesingen (husket lag) og kontekst-promisene får sette seg.
  await act(async () => {});
  await act(async () => {});
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    fn: (s: string) => void,
  ) => {
    appStateListeners.push(fn);
    return {remove: jest.fn()};
  }) as any);
});

it('boot med dekket kandidat: null enkeltkall, alt fra kontekst-svaret', async () => {
  mockRefreshSessionContext.mockResolvedValue(ctxResult());
  const fetchedAt = Date.now();
  mockPeekSessionContext.mockImplementation((id: string) =>
    id === 'ts-1' ? {ctx: ctxResult(), fetchedAt} : null,
  );

  const renderer = await mountApp();

  // TeamContext bestilte boot-varianten: kandidat ukjent (null → lagret
  // valg leses i orkestratoren) + prefetch av feed/events-trioen.
  expect(mockRefreshSessionContext).toHaveBeenCalledWith(null, {
    bootPrefetchUserId: 'user-1',
  });

  expect(team.activeTeamSpaceId).toBe('ts-1');
  expect(team.userMemberships).toHaveLength(1);
  expect(team.activeMemberCount).toBe(12);
  expect(notif.unreadCount).toBe(3);

  // Budsjett-beviset: kontekst-kallet erstattet alle tre enkeltkallene.
  expect(mockGetUserMemberships).not.toHaveBeenCalled();
  expect(mockGetTeamMemberCount).not.toHaveBeenCalled();
  expect(mockGetUnreadCount).not.toHaveBeenCalled();

  await act(async () => renderer.unmount());
});

it('fallback: kontekst null → nøyaktig dagens enkeltkall', async () => {
  mockRefreshSessionContext.mockResolvedValue(null);
  mockPeekSessionContext.mockReturnValue(null);
  mockGetUserMemberships.mockResolvedValue([membership]);
  mockGetTeamMemberCount.mockResolvedValue(7);
  mockGetUnreadCount.mockResolvedValue(2);

  const renderer = await mountApp();
  await act(async () => {});

  expect(team.activeTeamSpaceId).toBe('ts-1');
  expect(mockGetUserMemberships).toHaveBeenCalledWith('user-1');
  expect(team.activeMemberCount).toBe(7);
  expect(mockGetTeamMemberCount).toHaveBeenCalledWith('ts-1');
  expect(notif.unreadCount).toBe(2);
  expect(mockGetUnreadCount).toHaveBeenCalled();

  await act(async () => renderer.unmount());
});

it('foreground-resume: lytterne deler kontekst-kallet, badgen uten HEAD', async () => {
  mockRefreshSessionContext.mockResolvedValue(ctxResult());
  const fetchedAt = Date.now();
  mockPeekSessionContext.mockImplementation((id: string) =>
    id === 'ts-1' ? {ctx: ctxResult(), fetchedAt} : null,
  );
  const renderer = await mountApp();
  expect(notif.unreadCount).toBe(3);

  // Nye varsler kom i bakgrunnen: neste kontekst-svar bærer 5 uleste.
  mockRefreshSessionContext.mockClear();
  mockRefreshSessionContext.mockResolvedValue(ctxResult({unreadCount: 5}));

  await act(async () => {
    for (const l of appStateListeners) {
      l('active');
    }
  });
  await act(async () => {});

  // Begge lytterne (memberships-resync + badgen) gikk via orkestratoren —
  // i prod er dét ETT HTTP-kall (single-flight, fryst i sessionContext-
  // testen). Badgen tok telleren fra svaret, aldri fra et HEAD-kall.
  expect(mockRefreshSessionContext).toHaveBeenCalledTimes(2);
  expect(mockRefreshSessionContext.mock.calls.some(c => c[0] === 'ts-1')).toBe(
    true,
  );
  expect(notif.unreadCount).toBe(5);
  expect(mockGetUnreadCount).not.toHaveBeenCalled();

  await act(async () => renderer.unmount());
});
