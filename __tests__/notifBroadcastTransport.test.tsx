/**
 * @format
 *
 * S3c: notif-transportbryteren i NotificationsContext — fryser kontrakten
 * fra docs/S3C-BROADCAST-FEED-NOTIF.md §1, §5 og §6:
 *
 *   1. Default (pgc) gir NØYAKTIG dagens sti: direktekanal
 *      `notifications:{userId}` med postgres_changes, ingen params.
 *   2. 'broadcast' gir privat registry-kanal `user:{userId}` med
 *      `notif`-eventet; raden i konvolutten går til SAMME handler
 *      (badge +1, nonce-splitten, banner).
 *   3. Dedupe på message_id (statement-triggeren + redelivery); ugyldig
 *      konvolutt → resync-stien (hent fasit-telleren).
 *   4. Join-feil → én retry, deretter terminal: pgc-kanalen + resync.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/supabase', () => {
  const channels: any[] = [];
  const removeQueue: Array<{ch: any; resolve: () => void}> = [];
  const supabase = {
    channel: jest.fn((topic: string, params?: any) => {
      const existing = channels.find(c => c.topic === topic);
      if (existing) return existing;
      const ch: any = {
        topic,
        params,
        statusCallbacks: [] as Array<(s: string) => void>,
        on: jest.fn(() => ch),
        subscribe: jest.fn((cb?: (s: string) => void) => {
          if (cb) ch.statusCallbacks.push(cb);
          return ch;
        }),
      };
      channels.push(ch);
      return ch;
    }),
    removeChannel: jest.fn(
      (ch: any) =>
        new Promise<string>(resolve => {
          removeQueue.push({
            ch,
            resolve: () => {
              const i = channels.indexOf(ch);
              if (i >= 0) channels.splice(i, 1);
              resolve('ok');
            },
          });
        }),
    ),
    getChannels: jest.fn(() => [...channels]),
  };
  return {
    supabase,
    __flushRemove: () => {
      const next = removeQueue.shift();
      if (next) next.resolve();
    },
    __channels: channels,
    __pendingRemovals: removeQueue,
  };
});

const mockGetUnreadCount = jest.fn();
jest.mock('../src/lib/api/notifications', () => ({
  getUnreadCount: (...a: unknown[]) => mockGetUnreadCount(...a),
  markAsRead: jest.fn(() => Promise.resolve()),
  markAllAsRead: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/context/UserContext', () => ({
  useAuth: () => ({session: {user: {id: 'user-1'}}}),
}));

jest.mock('../src/context/TeamContext', () => ({
  useActiveTeam: () => ({activeTeamSpaceId: 'ts-1'}),
}));

import {
  NotificationsProvider,
  useNotifications,
} from '../src/context/NotificationsContext';
import {
  DEFAULT_RUNTIME_FLAGS,
  resetRuntimeConfig,
  setRuntimeConfig,
} from '../src/lib/runtimeConfig';

const {supabase, __flushRemove, __channels, __pendingRemovals} =
  jest.requireMock('../src/lib/supabase');

const BROADCAST_FLAGS = {
  ...DEFAULT_RUNTIME_FLAGS,
  realtimeTransport: {
    ...DEFAULT_RUNTIME_FLAGS.realtimeTransport,
    notif: 'broadcast' as const,
  },
};

let ctx: ReturnType<typeof useNotifications>;
function Probe() {
  ctx = useNotifications();
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function mount() {
  await act(async () => {
    mounted.push(
      ReactTestRenderer.create(
        <NotificationsProvider>
          <Probe />
        </NotificationsProvider>,
      ),
    );
  });
}

function findChannel(topic: string) {
  return __channels.find((c: any) => c.topic === topic);
}

let idCounter = 0;
function notifEnvelope(row: Record<string, unknown>, messageId?: string) {
  idCounter += 1;
  return {
    v: 1,
    message_id:
      messageId ??
      `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    entity_id: '00000000-0000-4000-8000-0000000000aa',
    seq: {id: row.id, created_at: '2026-01-01T12:00:00+00:00'},
    emitted_at: '2026-01-01T12:00:00+00:00',
    data: row,
  };
}

function fireNotif(envelope: unknown) {
  const ch = findChannel('user:user-1');
  const call = ch.on.mock.calls.find((c: any[]) => c[1]?.event === 'notif');
  act(() => {
    call[2]({event: 'notif', payload: envelope});
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUnreadCount.mockResolvedValue(2);
});

afterEach(async () => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  resetRuntimeConfig();
  while (__pendingRemovals.length > 0) __flushRemove();
  await act(async () => {});
  __channels.length = 0;
});

test('default (pgc): dagens direktekanal notifications:{userId}, postgres_changes, ingen params', async () => {
  await mount();
  const ch = findChannel('notifications:user-1');
  expect(ch).toBeDefined();
  expect(ch.params).toBeUndefined();
  expect(ch.on.mock.calls.map((c: any[]) => c[0])).toEqual([
    'postgres_changes',
  ]);
  expect(findChannel('user:user-1')).toBeUndefined();
});

test('broadcast: privat user-kanal; raden går til samme handler (badge, nonces, banner)', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  await mount();
  expect(findChannel('notifications:user-1')).toBeUndefined();
  const ch = findChannel('user:user-1');
  expect(ch.params).toEqual({config: {private: true}});
  expect(ch.on.mock.calls.map((c: any[]) => c[1].event)).toEqual(['notif']);
  expect(ctx.unreadCount).toBe(2); // mount-hentingen — READY emittet ingenting

  fireNotif(
    notifEnvelope({
      id: 'n1',
      team_space_id: 'ts-1',
      category: 'match_live',
      title: 'Måål!',
      body: '1–0',
    }),
  );
  expect(ctx.unreadCount).toBe(3);
  expect(ctx.inboxNonce).toBe(1);
  expect(ctx.matchNonce).toBe(1);
  expect(ctx.banner).toEqual({id: 'n1', title: 'Måål!', body: '1–0'});
});

test('broadcast: redelivery (samme message_id) teller aldri dobbelt; ugyldig konvolutt → fasit-telleren', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  await mount();
  const env = notifEnvelope({
    id: 'n1',
    team_space_id: 'ts-1',
    category: 'heia',
    title: 't',
  });

  fireNotif(env);
  fireNotif(env);
  expect(ctx.unreadCount).toBe(3);
  expect(ctx.inboxNonce).toBe(1);

  mockGetUnreadCount.mockClear();
  fireNotif({søppel: true}); // skjemadrift — vi vet et varsel kom, ikke hva
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
  expect(ctx.inboxNonce).toBe(2);
  expect(ctx.matchNonce).toBe(1); // resync dytter begge noncene
});

test('broadcast: join-feil → én retry med frisk kanal, deretter terminal → pgc-kanalen + resync', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  await mount();
  const ch1 = findChannel('user:user-1');

  mockGetUnreadCount.mockClear();
  act(() => {
    ch1.statusCallbacks[0]('CHANNEL_ERROR');
  });
  expect(supabase.removeChannel).toHaveBeenCalledWith(ch1);
  __flushRemove();
  await act(async () => {});

  const ch2 = findChannel('user:user-1');
  expect(ch2).toBeDefined();
  expect(ch2).not.toBe(ch1);
  expect(ch2.params).toEqual({config: {private: true}});

  act(() => {
    ch2.statusCallbacks[0]('CHANNEL_ERROR');
  });
  const pgc = findChannel('notifications:user-1');
  expect(pgc).toBeDefined();
  expect(pgc.params).toBeUndefined();
  expect(pgc.on.mock.calls.map((c: any[]) => c[0])).toEqual([
    'postgres_changes',
  ]);
  // Terminal nedgradering henter fasit (broadcast kan ha mistet varsler).
  expect(mockGetUnreadCount).toHaveBeenCalled();
  expect(ctx.inboxNonce).toBeGreaterThan(0);
});
