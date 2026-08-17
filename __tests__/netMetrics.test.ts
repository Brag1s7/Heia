/**
 * netMetrics — vakten for at aggregatene ALDRI inneholder tokens eller
 * ubegrenset variasjon (P9: «prod: aggregater, aldri URL-er/tokens»).
 *
 * To lag, og BEGGE må voktes:
 *  1. Normalisereren (`normalizePath`): query strippes, UUID-er og
 *     objektnavn normaliseres så aggregatnøklene er endelige i antall.
 *  2. KOBLINGEN: at `trackedFetch` faktisk sender URL-en gjennom
 *     normalisereren før noe lagres. Uten den siste testen ville et bytte
 *     til rå `url` i record()-kallet bestått hele suiten — og sendt
 *     signerings-JWT-er inn i telemetrien den dagen Sentry kobles på (B).
 *     (Funnet ved mutasjonstest 2026-08-07.)
 */

import {
  getNetMetricsSnapshot,
  normalizePath,
  resetNetMetrics,
  trackedFetch,
} from '../src/lib/netMetrics';

const BASE = 'https://abc123.supabase.co';

test('query-strengen (der tokenet bor) strippes alltid', () => {
  const signed = `${BASE}/storage/v1/object/sign/feed-media/x.jpg?token=SECRET.JWT.HER`;
  expect(normalizePath(signed)).not.toContain('SECRET');
  expect(normalizePath(signed)).not.toContain('?');
});

test('UUID-segmenter blir :id — ett lagrom er ikke ett endepunkt', () => {
  expect(
    normalizePath(
      `${BASE}/rest/v1/events?team_space_id=eq.7f3e8a9b-1c2d-4e5f-8a9b-0c1d2e3f4a5b`,
    ),
  ).toBe('/rest/v1/events');
  expect(
    normalizePath(
      `${BASE}/storage/v1/object/sign/feed-media/7f3e8a9b-1c2d-4e5f-8a9b-0c1d2e3f4a5b/1722900000000-ab12cd34.jpg`,
    ),
  ).toBe('/storage/v1/object/sign/feed-media/:id/:fil');
});

test('RPC-endepunkter beholder navnet sitt — det er dimensjonen vi måler på', () => {
  expect(normalizePath(`${BASE}/rest/v1/rpc/get_team_feed`)).toBe(
    '/rest/v1/rpc/get_team_feed',
  );
});

test('uparsbar URL faller tilbake til manuell stripping, uten å kaste', () => {
  expect(normalizePath('ikke-en-url?token=SECRET#frag')).toBe('ikke-en-url');
});

test('trackedFetch ende til ende: snapshotet inneholder aldri token eller query', async () => {
  resetNetMetrics();
  const original = global.fetch;
  // Rent objekt, ikke whatwg-Response (finnes ikke i RN-jestmiljøet) —
  // trackedFetch leser kun .status og .headers.get.
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: {get: () => null},
  }) as unknown as typeof fetch;
  try {
    await trackedFetch(
      `${BASE}/storage/v1/object/sign/feed-media/7f3e8a9b-1c2d-4e5f-8a9b-0c1d2e3f4a5b/1722900000000-ab12cd34.jpg?token=SECRET.JWT.HER`,
    );
  } finally {
    global.fetch = original;
  }

  const snap = getNetMetricsSnapshot();
  expect(Object.keys(snap.endpoints)).toEqual([
    'GET /storage/v1/object/sign/feed-media/:id/:fil',
  ]);
  const serialized = JSON.stringify(snap);
  expect(serialized).not.toContain('SECRET');
  expect(serialized).not.toContain('?');
});
