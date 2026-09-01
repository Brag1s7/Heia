/**
 * @format
 *
 * S3c: transportbryteren i `subscribeToFeed` + kampknappens
 * `subscribeToTeamLive` — fryser kontrakten fra
 * docs/S3C-BROADCAST-FEED-NOTIF.md §1, §2, §4 og §6:
 *
 *   1. Default (runtime_config = pgc) gir NØYAKTIG dagens sti: topic
 *      `feed:{id}`, postgres_changes-handlere, ingen params; teamLive er
 *      en ren no-op.
 *   2. 'broadcast' gir privat kanal `team:{id}` med de fire 00080-eventene.
 *   3. Første rene SUBSCRIBED → INGEN emit (pgc-paritet, ulikt kampens
 *      fallback); rejoin etter frafall → `{kind:'resync'}`.
 *   4. Join-feil → én retry, deretter terminal: feed → pgc-stien under
 *      `feed:{id}` + resync; teamLive → onDegraded.
 *   5. teamLive: `live`-event → onLive (dedupet); READY → onReady.
 */

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

import {
  subscribeToFeed,
  subscribeToTeamLive,
  HEIA_EMOJI,
} from '../src/lib/api/feed';
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
    feed: 'broadcast' as const,
  },
};

const TEAM_EVENTS = ['feed_post', 'reaction', 'comment', 'live'];

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function findChannel(topic: string) {
  return __channels.find((c: any) => c.topic === topic);
}

let idCounter = 0;
function teamEnvelope(data: Record<string, unknown>, messageId?: string) {
  idCounter += 1;
  return {
    v: 1,
    message_id:
      messageId ??
      `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    entity_id: '00000000-0000-4000-8000-0000000000aa',
    seq: {created_at: '2026-01-01T12:00:00+00:00'},
    emitted_at: '2026-01-01T12:00:00+00:00',
    data,
  };
}

function fire(ch: any, event: string, envelope: unknown) {
  const call = ch.on.mock.calls.find((c: any[]) => c[1]?.event === event);
  call[2]({event, payload: envelope});
}

afterEach(async () => {
  resetRuntimeConfig();
  while (__pendingRemovals.length > 0) __flushRemove();
  await flush();
  __channels.length = 0;
  jest.clearAllMocks();
});

test('default (pgc): dagens sti — topic feed:{id}, postgres_changes, ingen params', () => {
  const unsubscribe = subscribeToFeed('ts1', 'me', () => {});
  const ch = findChannel('feed:ts1');
  expect(ch).toBeDefined();
  expect(ch.params).toBeUndefined();
  const kinds = ch.on.mock.calls.map((c: any[]) => c[0]);
  expect(kinds.length).toBeGreaterThan(0);
  expect(kinds.every((k: string) => k === 'postgres_changes')).toBe(true);
  unsubscribe();
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
});

test('broadcast-flagget: privat kanal team:{id} med de fire 00080-eventene', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const unsubscribe = subscribeToFeed('ts1', 'me', () => {});
  const ch = findChannel('team:ts1');
  expect(ch.params).toEqual({config: {private: true}});
  expect(ch.on.mock.calls.map((c: any[]) => c[0])).toEqual(
    TEAM_EVENTS.map(() => 'broadcast'),
  );
  expect(ch.on.mock.calls.map((c: any[]) => c[1].event)).toEqual(TEAM_EVENTS);
  unsubscribe();
});

test('første SUBSCRIBED → INGEN emit (pgc-paritet); dekodede events når skjermen; rejoin → resync', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const got: any[] = [];
  const unsubscribe = subscribeToFeed('ts1', 'me', evt => got.push(evt));
  const ch = findChannel('team:ts1');
  const status = ch.statusCallbacks[0];

  status('SUBSCRIBED');
  expect(got).toEqual([]); // ulikt kampens fallback-emit — se fasiten §2

  fire(ch, 'feed_post', teamEnvelope({op: 'INSERT', id: 'p1'}));
  fire(
    ch,
    'reaction',
    teamEnvelope({
      op: 'INSERT',
      feed_post_id: 'p1',
      user_id: 'u2',
      emoji: HEIA_EMOJI,
    }),
  );
  fire(ch, 'live', teamEnvelope({op: 'UPDATE', status: 'live'}));
  expect(got).toEqual([
    {kind: 'postNew'},
    {kind: 'reaction', postId: 'p1', delta: 1},
    // 'live' emitter ingenting i feeden — kampknappens lytter eier den.
  ]);

  status('CHANNEL_ERROR'); // frafall ETTER join — ikke join-feil
  status('SUBSCRIBED'); // rejoin → resync
  expect(got[2]).toEqual({kind: 'resync'});
  unsubscribe();
});

test('join-feil: én retry med frisk kanal, deretter terminal → pgc under feed:{id} + resync', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const got: any[] = [];
  const unsubscribe = subscribeToFeed('ts1', 'me', evt => got.push(evt));
  const ch1 = findChannel('team:ts1');

  ch1.statusCallbacks[0]('CHANNEL_ERROR');
  expect(supabase.removeChannel).toHaveBeenCalledWith(ch1);
  __flushRemove();
  await flush();

  const ch2 = findChannel('team:ts1');
  expect(ch2).toBeDefined();
  expect(ch2).not.toBe(ch1);
  expect(ch2.params).toEqual({config: {private: true}});

  // Også retry-kanalen nektes → terminal: pgc-stien + én resync.
  ch2.statusCallbacks[0]('CHANNEL_ERROR');
  const pgc = findChannel('feed:ts1');
  expect(pgc).toBeDefined();
  expect(pgc.params).toBeUndefined();
  const kinds = pgc.on.mock.calls.map((c: any[]) => c[0]);
  expect(kinds.every((k: string) => k === 'postgres_changes')).toBe(true);
  expect(got).toEqual([{kind: 'resync'}]);

  unsubscribe();
  expect(supabase.removeChannel).toHaveBeenCalledWith(pgc);
});

test('teamLive på pgc: ren no-op — ingen kanal, pollingen består', () => {
  const unsubscribe = subscribeToTeamLive('ts1', {
    onLive: () => {},
    onResync: () => {},
    onReady: () => {},
    onDegraded: () => {},
  });
  expect(supabase.channel).not.toHaveBeenCalled();
  unsubscribe();
});

test('teamLive på broadcast: live → onLive (dedupet); READY → onReady; resync → onResync', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const calls: string[] = [];
  const unsubscribe = subscribeToTeamLive('ts1', {
    onLive: () => calls.push('live'),
    onResync: () => calls.push('resync'),
    onReady: () => calls.push('ready'),
    onDegraded: () => calls.push('degraded'),
  });
  const ch = findChannel('team:ts1');
  expect(ch.params).toEqual({config: {private: true}});

  ch.statusCallbacks[0]('SUBSCRIBED');
  expect(calls).toEqual(['ready']);

  const env = teamEnvelope({op: 'UPDATE', status: 'live'});
  fire(ch, 'live', env);
  fire(ch, 'live', env); // redelivery — samme message_id, aldri to onLive
  fire(ch, 'feed_post', teamEnvelope({op: 'INSERT', id: 'p1'})); // ikke vår
  expect(calls).toEqual(['ready', 'live']);

  ch.statusCallbacks[0]('CHANNEL_ERROR');
  ch.statusCallbacks[0]('SUBSCRIBED');
  expect(calls).toEqual(['ready', 'live', 'resync']);
  unsubscribe();
});

test('teamLive: terminal join-nekt → onDegraded (pollingen må gjenopptas)', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const calls: string[] = [];
  const unsubscribe = subscribeToTeamLive('ts1', {
    onLive: () => calls.push('live'),
    onResync: () => calls.push('resync'),
    onReady: () => calls.push('ready'),
    onDegraded: () => calls.push('degraded'),
  });
  const ch1 = findChannel('team:ts1');

  ch1.statusCallbacks[0]('CHANNEL_ERROR');
  __flushRemove();
  await flush();

  const ch2 = findChannel('team:ts1');
  expect(ch2).not.toBe(ch1);
  ch2.statusCallbacks[0]('CHANNEL_ERROR');
  expect(calls).toEqual(['degraded']);
  // Ingen nødkanal for live — pollingen er fallbacken.
  expect(findChannel('feed:ts1')).toBeUndefined();
  unsubscribe();
});

test('feed- og live-lytteren deler den fysiske team-kanalen (registry-dedupe)', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const feedGot: any[] = [];
  const liveCalls: string[] = [];
  const unsubFeed = subscribeToFeed('ts1', 'me', evt => feedGot.push(evt));
  const unsubLive = subscribeToTeamLive('ts1', {
    onLive: () => liveCalls.push('live'),
    onResync: () => {},
    onReady: () => {},
    onDegraded: () => {},
  });
  expect(supabase.channel).toHaveBeenCalledTimes(1);

  const ch = findChannel('team:ts1');
  fire(ch, 'live', teamEnvelope({op: 'UPDATE', status: 'live'}));
  expect(liveCalls).toEqual(['live']);
  expect(feedGot).toEqual([]); // hver lytter dekoder uavhengig

  unsubFeed();
  unsubLive();
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
});
