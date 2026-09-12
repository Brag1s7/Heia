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
  FUNCTION_TIMEOUT_MS,
  getNetMetricsSnapshot,
  normalizePath,
  REQUEST_TIMEOUT_MS,
  resetNetMetrics,
  TIMEOUT_MARKER,
  trackedFetch,
} from '../src/lib/netMetrics';
import {
  errorMessage,
  isNetworkError,
  uncertainWriteMessage,
} from '../src/shared/errorMessage';

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

// ---------------------------------------------------------------------------
// TIDSGRENSA (punkt 40)
// ---------------------------------------------------------------------------

test('et kall som aldri svarer avbrytes — og får merket errorMessage kjenner', async () => {
  resetNetMetrics();
  const original = global.fetch;
  // Serveren som aldri svarer: den løser først når signalet avbryter den.
  global.fetch = jest.fn(
    (_input: unknown, init?: {signal?: AbortSignal}) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () =>
          rej(new Error('Aborted')),
        );
      }),
  ) as unknown as typeof fetch;
  jest.useFakeTimers({doNotFake: ['setImmediate', 'clearImmediate']});
  try {
    const pending = trackedFetch(`${BASE}/rest/v1/rpc/get_team_feed`, {
      method: 'POST',
    }).then(
      () => 'svarte',
      (e: unknown) => (e as Error).message,
    );
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBe(TIMEOUT_MARKER);
  } finally {
    jest.useRealTimers();
    global.fetch = original;
  }

  // Kallet er talt som en feil (status 0) — ikke svelget.
  expect(getNetMetricsSnapshot().totals.errors).toBe(1);
});

test('kallerens eget avbrudd overlever innpakningen', async () => {
  resetNetMetrics();
  const original = global.fetch;
  global.fetch = jest.fn(
    (_input: unknown, init?: {signal?: AbortSignal}) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () =>
          rej(new Error('Aborted av kalleren')),
        );
      }),
  ) as unknown as typeof fetch;
  try {
    const ctrl = new AbortController();
    const pending = trackedFetch(`${BASE}/rest/v1/events`, {
      signal: ctrl.signal,
    }).then(
      () => 'svarte',
      (e: unknown) => (e as Error).message,
    );
    ctrl.abort();
    // Kallerens avbrudd skal IKKE maskeres som vårt tidsavbrudd.
    await expect(pending).resolves.toBe('Aborted av kalleren');
  } finally {
    global.fetch = original;
  }
});

test('Edge Functions får lengre snor enn spørringene', () => {
  expect(FUNCTION_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// VEIEN VIDERE (punkt 40): feilen brukeren faktisk leser
// ---------------------------------------------------------------------------

test('nettverksfeil oversettes — brukeren får aldri rå transportprat', () => {
  // Slik supabase-js pakker den inn på vei opp (`${navn}: ${melding}`).
  const timeout = {message: `Error: ${TIMEOUT_MARKER}`};
  expect(errorMessage(timeout)).toBe(
    'Nettet svarte ikke. Prøv igjen når du har bedre dekning.',
  );

  const offline = {message: 'TypeError: Network request failed'};
  expect(errorMessage(offline)).toBe(
    'Ingen kontakt med Heia. Sjekk nettet, og prøv igjen.',
  );

  expect(isNetworkError(timeout)).toBe(true);
  expect(isNetworkError(offline)).toBe(true);
});

test('databasens egne vaktmeldinger står urørt — de er skrevet for å bli lest', () => {
  const guard = {
    message:
      'Kan ikke fjerne den siste aktive betalingsansvarlige — suspender kontoen eller få en erstatter på plass først.',
  };
  expect(errorMessage(guard)).toBe(guard.message);
  expect(isNetworkError(guard)).toBe(false);
});

test('en skriving som ikke fikk svar påstår ALDRI at den feilet', () => {
  const timeout = {message: `Error: ${TIMEOUT_MARKER}`};
  expect(uncertainWriteMessage(timeout, 'målet')).toBe(
    'Nettet svarte ikke i tide. Vi vet ikke om målet ble lagret — sjekk før du prøver på nytt.',
  );
  // En ekte avvisning fra serveren er noe annet: da SKAL beskjeden stå.
  const denied = {message: 'Access denied'};
  expect(uncertainWriteMessage(denied, 'målet')).toBe('Access denied');
});
