/**
 * @format
 *
 * S3b-2: transportbryteren i `subscribeToMatch` — fryser kontrakten fra
 * docs/S3B2-BROADCAST-DECODE.md §5 og §7:
 *
 *   1. Default (runtime_config = pgc) gir NØYAKTIG dagens sti: topic
 *      `match:{id}`, postgres_changes-handlere, ingen params.
 *   2. 'broadcast' gir privat kanal på samme topic med broadcast-handlere
 *      for de seks 00080-eventene.
 *   3. Første rene SUBSCRIBED → ett `{kind:'fallback'}` (fetch→subscribe-
 *      vinduet); rejoin etter frafall → `{kind:'resync'}` (aldri begge).
 *   4. CHANNEL_ERROR før join → én retry med FRISK kanal; andre → terminal:
 *      pgc-nødkanalen under `pgc:match:{id}` + én resync.
 *   5. Dev-overriden tvinger broadcast uten å røre server-flaggene.
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

import {subscribeToMatch} from '../src/lib/api/events';
import {
  DEFAULT_RUNTIME_FLAGS,
  resetRuntimeConfig,
  setDevRealtimeTransportOverride,
  setRuntimeConfig,
} from '../src/lib/runtimeConfig';

const {supabase, __flushRemove, __channels, __pendingRemovals} =
  jest.requireMock('../src/lib/supabase');

const BROADCAST_FLAGS = {
  ...DEFAULT_RUNTIME_FLAGS,
  realtimeTransport: {
    ...DEFAULT_RUNTIME_FLAGS.realtimeTransport,
    match: 'broadcast' as const,
  },
};

const MATCH_EVENTS = [
  'match_event',
  'session',
  'photo',
  'engagement',
  'reaction',
  'comment',
];

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function findChannel(topic: string) {
  return __channels.find((c: any) => c.topic === topic);
}

function matchEventEnvelope(seq: number) {
  return {
    v: 1,
    message_id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    entity_id: '00000000-0000-4000-8000-0000000000aa',
    seq,
    emitted_at: '2026-01-01T12:00:00+00:00',
    data: {
      id: `00000000-0000-4000-8000-9990000000${String(seq).padStart(2, '0')}`,
      match_session_id: 's1',
      type: 'mål',
      minute: 12,
      sequence: seq,
      op: 'INSERT',
    },
  };
}

afterEach(async () => {
  resetRuntimeConfig();
  while (__pendingRemovals.length > 0) __flushRemove();
  await flush();
  __channels.length = 0;
  jest.clearAllMocks();
});

test('default (pgc): dagens sti — topic match:{id}, postgres_changes, ingen params', () => {
  const unsubscribe = subscribeToMatch('s1', 'e1', () => {});
  const ch = findChannel('match:s1');
  expect(ch).toBeDefined();
  expect(ch.params).toBeUndefined();
  const kinds = ch.on.mock.calls.map((c: any[]) => c[0]);
  expect(kinds.length).toBeGreaterThan(0);
  expect(kinds.every((k: string) => k === 'postgres_changes')).toBe(true);
  unsubscribe();
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
});

test('broadcast-flagget: privat kanal på samme topic med de seks 00080-eventene', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const unsubscribe = subscribeToMatch('s1', 'e1', () => {});
  const ch = findChannel('match:s1');
  expect(ch.params).toEqual({config: {private: true}});
  expect(ch.on.mock.calls.map((c: any[]) => c[0])).toEqual(
    MATCH_EVENTS.map(() => 'broadcast'),
  );
  expect(ch.on.mock.calls.map((c: any[]) => c[1].event)).toEqual(MATCH_EVENTS);
  unsubscribe();
});

test('første SUBSCRIBED → ett fallback; dekodede events når skjermen; rejoin → resync', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const got: any[] = [];
  const unsubscribe = subscribeToMatch('s1', 'e1', evt => got.push(evt));
  const ch = findChannel('match:s1');
  const status = ch.statusCallbacks[0];

  status('SUBSCRIBED');
  expect(got).toEqual([{kind: 'fallback'}]);

  const handler = ch.on.mock.calls.find(
    (c: any[]) => c[1].event === 'match_event',
  )[2];
  handler({event: 'match_event', payload: matchEventEnvelope(1)});
  expect(got[1]).toEqual({
    kind: 'matchEvent',
    row: expect.objectContaining({sequence: 1}),
  });

  status('CHANNEL_ERROR'); // frafall ETTER join — ikke join-feil
  status('SUBSCRIBED'); // rejoin → resync, aldri nytt fallback
  expect(got[2]).toEqual({kind: 'resync'});
  expect(got.filter(e => e.kind === 'fallback')).toHaveLength(1);
  unsubscribe();
});

test('join-feil: én retry med frisk kanal, deretter terminal → pgc:match:{id} + resync', async () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const got: any[] = [];
  const unsubscribe = subscribeToMatch('s1', 'e1', evt => got.push(evt));
  const ch1 = findChannel('match:s1');

  // Første CHANNEL_ERROR i join-fasen → slipp + re-acquire (venter på riving).
  ch1.statusCallbacks[0]('CHANNEL_ERROR');
  expect(supabase.removeChannel).toHaveBeenCalledWith(ch1);
  __flushRemove();
  await flush();

  // Frisk kanal nummer to, fortsatt privat broadcast — aldri ch1 igjen.
  const ch2 = findChannel('match:s1');
  expect(ch2).toBeDefined();
  expect(ch2).not.toBe(ch1);
  expect(ch2.params).toEqual({config: {private: true}});

  // Også retry-kanalen nektes → terminal: pgc-nødkanalen + én resync.
  ch2.statusCallbacks[0]('CHANNEL_ERROR');
  const pgc = findChannel('pgc:match:s1');
  expect(pgc).toBeDefined();
  expect(pgc.params).toBeUndefined();
  const kinds = pgc.on.mock.calls.map((c: any[]) => c[0]);
  expect(kinds.every((k: string) => k === 'postgres_changes')).toBe(true);
  expect(got).toEqual([{kind: 'resync'}]);

  // Flere join-feil på den døde broadcast-kanalen endrer ingenting.
  ch2.statusCallbacks[0]('CHANNEL_ERROR');
  expect(got).toEqual([{kind: 'resync'}]);

  unsubscribe();
  expect(supabase.removeChannel).toHaveBeenCalledWith(pgc);
});

test('TIMED_OUT i join-fasen er transient: ingen retry-dans, ingen nedgradering', () => {
  setRuntimeConfig(BROADCAST_FLAGS);
  const got: any[] = [];
  const unsubscribe = subscribeToMatch('s1', 'e1', evt => got.push(evt));
  const ch = findChannel('match:s1');

  ch.statusCallbacks[0]('TIMED_OUT');
  expect(supabase.removeChannel).not.toHaveBeenCalled();
  expect(findChannel('pgc:match:s1')).toBeUndefined();

  // Joinen som til slutt lykkes etter frafallet → resync (ikke fallback).
  ch.statusCallbacks[0]('SUBSCRIBED');
  expect(got).toEqual([{kind: 'resync'}]);
  unsubscribe();
});

test('dev-overriden tvinger broadcast uten å røre flaggene; reset rydder', () => {
  // Server-flagg = pgc (default). Overriden er det som flipper stien.
  setDevRealtimeTransportOverride({match: 'broadcast'});
  const unsubscribe = subscribeToMatch('s1', 'e1', () => {});
  expect(findChannel('match:s1').params).toEqual({config: {private: true}});
  unsubscribe();
});
