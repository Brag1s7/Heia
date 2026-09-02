/**
 * @format
 *
 * S3c: poll-gaten `liveMatchPollMs` — fryser
 * docs/S3C-BROADCAST-FEED-NOTIF.md §4: på pgc (og ved terminal
 * broadcast-nekt) polles det som i dag; på broadcast styrer serverens
 * `live_fallback_poll_s` (0 = av — `live`-eventet bærer oppdateringen).
 */

jest.mock('../src/lib/api/events', () => ({
  getLiveMatch: jest.fn(),
}));

import {
  LIVE_MATCH_POLL_MS,
  liveMatchPollMs,
} from '../src/lib/queries/liveMatch';
import {
  DEFAULT_RUNTIME_FLAGS,
  resetRuntimeConfig,
  setRuntimeConfig,
} from '../src/lib/runtimeConfig';

function broadcastFlags(pollS: number) {
  return {
    ...DEFAULT_RUNTIME_FLAGS,
    realtimeTransport: {
      ...DEFAULT_RUNTIME_FLAGS.realtimeTransport,
      feed: 'broadcast' as const,
    },
    liveFallbackPollS: pollS,
  };
}

afterEach(() => {
  resetRuntimeConfig();
});

it('pgc (default): dagens 60 s — uendret adferd for hele flåten', () => {
  expect(liveMatchPollMs(false)).toBe(LIVE_MATCH_POLL_MS);
});

it('broadcast med live_fallback_poll_s=0 (dagens serververdi): pollingen er AV', () => {
  setRuntimeConfig(broadcastFlags(0));
  expect(liveMatchPollMs(false)).toBe(false);
});

it('broadcast med serverstyrt fallback-poll: sekunder → millisekunder', () => {
  setRuntimeConfig(broadcastFlags(300));
  expect(liveMatchPollMs(false)).toBe(300_000);
});

it('terminal broadcast-nekt (degraded): tilbake på dagens 60 s uansett flagg', () => {
  setRuntimeConfig(broadcastFlags(0));
  expect(liveMatchPollMs(true)).toBe(LIVE_MATCH_POLL_MS);
});
