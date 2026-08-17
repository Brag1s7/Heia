/**
 * netMetrics — lag 1 i målemodellen (P9): JS-HTTP-instrumentering.
 *
 * Alle Supabase-kall (REST/RPC/Auth/Storage-signering) går gjennom ÉN fetch
 * (koblet inn via `global.fetch` i supabase.ts), og her telles de: antall,
 * bytes (kun content-length — se under), varighet og status, attribuert til
 * skjermen som var synlig da kallet gikk.
 *
 * To driftsmoduser, samme kode:
 *  - Dev: hvert kall logges kompakt til konsollen, og hvert skjermbytte
 *    oppsummerer besøket («TeamHome: 9 kall, 187 kB»). Det er dette
 *    baseline-protokollen i docs/audit-observability.md leser.
 *  - Prod: ingen logging — kun aggregater i minnet, klare for rapportering
 *    (Sentry kobles på i fase B). Aggregatene inneholder ALDRI hele URL-er
 *    eller tokens: query strippes før noe lagres, og id-segmenter
 *    normaliseres. `netMetrics.test.ts` vokter akkurat det.
 *
 * ⚠️ Grenser (F27): bildebytes kan IKKE måles herfra — native Image laster
 * utenom JS-fetch, og content-length mangler på komprimerte/chunkede svar.
 * Bytes her er «kjent minimum»; fasiten for bytes er serverloggene (P9 lag 3).
 * Realtime går over websocket og synes heller ikke her.
 */

/** Ett normalisert endepunkt, f.eks. `POST /rest/v1/rpc/get_team_feed`. */
interface EndpointAgg {
  calls: number;
  /** Statuskode >= 400 eller nettverksfeil. */
  errors: number;
  /** Sum av content-length der headeren fantes. */
  bytesKnown: number;
  /** Antall kall uten content-length (bytes ukjent — ikke null). */
  bytesUnknownCalls: number;
  durationMs: number;
}

interface ScreenAgg extends EndpointAgg {
  /** Antall ganger skjermen har vært i fokus (for «kall per skjermåpning»). */
  visits: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Opplastede objektnavn er `${Date.now()}-${random}.jpg` (se feed.ts) —
// uten denne ville hvert bilde blitt sitt eget «endepunkt» i aggregatet.
const OBJECT_RE = /^\d{10,}-[a-z0-9]+\.[a-z0-9]+$/i;

// Skulle normaliseringen likevel slippe gjennom ubegrenset variasjon, skal
// minnet ikke vokse i takt: overskytende endepunkter samles i én bøtte.
const MAX_ENDPOINTS = 300;
const OVERFLOW_KEY = '(andre endepunkter)';

// Konsoll-logging kun i dev-appen. I jest er __DEV__ også true, men der er
// loggen bare støy i testutskriften (røyktesten monterer ekte supabase.ts,
// og dens fetch mot localhost feiler alltid i Node) — aggregatene telles
// uansett, det er bare utskriften som gates.
const IS_DEV =
  typeof __DEV__ !== 'undefined' && __DEV__ && typeof jest === 'undefined';

const endpoints = new Map<string, EndpointAgg>();
const screens = new Map<string, ScreenAgg>();
let totals: EndpointAgg = emptyAgg();
let startedAt = Date.now();

// Skjermen kallene attribueres til. Før NavigationContainer er klar hører
// alt til oppstarten (memberships, profil, session) — det er et interessant
// tall i seg selv, ikke støy.
let currentScreen = '(oppstart)';
let visitCalls = 0;
let visitBytes = 0;
let visitStartedAt = Date.now();

function emptyAgg(): EndpointAgg {
  return {calls: 0, errors: 0, bytesKnown: 0, bytesUnknownCalls: 0, durationMs: 0};
}

/**
 * URL → normalisert path for aggregering. Query strippes ALLTID (der bor
 * signerings-tokenet), UUID-er blir `:id` og opplastede objektnavn `:fil`.
 */
export function normalizePath(rawUrl: string): string {
  let path: string;
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    // Relativ eller uvanlig URL — stripp query manuelt og bruk resten.
    path = rawUrl.split('?')[0].split('#')[0];
  }
  return path
    .split('/')
    .map(seg =>
      UUID_RE.test(seg) ? ':id' : OBJECT_RE.test(seg) ? ':fil' : seg,
    )
    .join('/');
}

function record(
  method: string,
  path: string,
  status: number,
  bytes: number | null,
  durationMs: number,
): void {
  let key = `${method} ${path}`;
  if (!endpoints.has(key) && endpoints.size >= MAX_ENDPOINTS) {
    key = OVERFLOW_KEY;
  }
  const isError = status === 0 || status >= 400;

  for (const agg of [bump(endpoints, key, emptyAgg), bumpScreen()]) {
    agg.calls += 1;
    agg.durationMs += durationMs;
    if (isError) agg.errors += 1;
    if (bytes === null) {
      agg.bytesUnknownCalls += 1;
    } else {
      agg.bytesKnown += bytes;
    }
  }
  totals.calls += 1;
  totals.durationMs += durationMs;
  if (isError) totals.errors += 1;
  if (bytes === null) totals.bytesUnknownCalls += 1;
  else totals.bytesKnown += bytes;

  visitCalls += 1;
  visitBytes += bytes ?? 0;

  if (IS_DEV) {
    const kb = bytes === null ? '? kB' : `${(bytes / 1024).toFixed(1)} kB`;
    console.log(
      `[net] ${method} ${path} ${status || 'FEIL'} ${kb} ${Math.round(
        durationMs,
      )}ms (${currentScreen})`,
    );
  }
}

function bump<K>(map: Map<K, EndpointAgg>, key: K, make: () => EndpointAgg) {
  let agg = map.get(key);
  if (!agg) {
    agg = make();
    map.set(key, agg);
  }
  return agg;
}

function bumpScreen(): ScreenAgg {
  let agg = screens.get(currentScreen);
  if (!agg) {
    agg = {...emptyAgg(), visits: 1};
    screens.set(currentScreen, agg);
  }
  return agg;
}

/**
 * Kalles fra NavigationContainer (onReady + onStateChange) med navnet på
 * fokusert rute. Gir «kall per skjermåpning» — og i dev en oppsummering av
 * besøket som nettopp ble forlatt.
 */
export function noteScreen(name: string | undefined): void {
  const next = name ?? '(ukjent)';
  if (next === currentScreen) return;

  if (IS_DEV && visitCalls > 0) {
    const sec = ((Date.now() - visitStartedAt) / 1000).toFixed(1);
    console.log(
      `[net] ── ${currentScreen}: ${visitCalls} kall, ${(
        visitBytes / 1024
      ).toFixed(0)} kB kjent, ${sec} s synlig`,
    );
  }

  currentScreen = next;
  visitCalls = 0;
  visitBytes = 0;
  visitStartedAt = Date.now();

  const agg = screens.get(next);
  if (agg) {
    agg.visits += 1;
  } else {
    screens.set(next, {...emptyAgg(), visits: 1});
  }
}

/**
 * Fetch-innpakningen supabase.ts kobler inn. Målingen skal ALDRI kunne
 * påvirke selve kallet: alt rundt `fetch` er beskyttet, og ved nettverksfeil
 * registreres status 0 før feilen kastes videre uendret.
 */
export const trackedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method =
    init?.method ??
    (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  const started = Date.now();

  try {
    const response = await fetch(input as RequestInfo, init);
    try {
      const len = response.headers.get('content-length');
      record(
        method.toUpperCase(),
        normalizePath(url),
        response.status,
        len === null ? null : parseInt(len, 10) || 0,
        Date.now() - started,
      );
    } catch {
      // Måling feilet — kallet skal likevel leveres urørt.
    }
    return response;
  } catch (error) {
    try {
      record(
        method.toUpperCase(),
        normalizePath(url),
        0,
        null,
        Date.now() - started,
      );
    } catch {
      // Som over: aldri la målingen skygge for den egentlige feilen.
    }
    throw error;
  }
};

/** Aggregert øyeblikksbilde — prod-rapportering (B) og dev-dump leser denne. */
export function getNetMetricsSnapshot() {
  return {
    sinceIso: new Date(startedAt).toISOString(),
    totals: {...totals},
    endpoints: Object.fromEntries(
      [...endpoints].map(([k, v]) => [k, {...v}]),
    ),
    screens: Object.fromEntries([...screens].map(([k, v]) => [k, {...v}])),
  };
}

export function resetNetMetrics(): void {
  endpoints.clear();
  screens.clear();
  totals = emptyAgg();
  startedAt = Date.now();
  visitCalls = 0;
  visitBytes = 0;
  visitStartedAt = Date.now();
}

// Dev-konsollen (Metro): `netMetrics.dump()` etter en brukerreise gir
// tabellen baseline-protokollen ber om. Bevisst kun i dev — i prod finnes
// ingen konsoll, og globalen skal ikke ligge åpen der.
if (IS_DEV) {
  (globalThis as Record<string, unknown>).netMetrics = {
    snapshot: getNetMetricsSnapshot,
    reset: resetNetMetrics,
    dump(): void {
      const snap = getNetMetricsSnapshot();
      console.log(`[net] === netMetrics siden ${snap.sinceIso} ===`);
      console.log(
        `[net] totalt: ${snap.totals.calls} kall, ${(
          snap.totals.bytesKnown / 1024
        ).toFixed(0)} kB kjent (${snap.totals.bytesUnknownCalls} uten ` +
          `content-length), ${snap.totals.errors} feil`,
      );
      for (const [screen, s] of Object.entries(snap.screens)) {
        console.log(
          `[net] skjerm ${screen}: ${s.visits} besøk, ${s.calls} kall, ` +
            `${(s.bytesKnown / 1024).toFixed(0)} kB kjent`,
        );
      }
      for (const [endpoint, e] of Object.entries(snap.endpoints)) {
        console.log(
          `[net] ${endpoint}: ${e.calls}×, ${(e.bytesKnown / 1024).toFixed(
            0,
          )} kB kjent, snitt ${Math.round(e.durationMs / e.calls)}ms` +
            (e.errors > 0 ? `, ${e.errors} FEIL` : ''),
        );
      }
    },
  };
}
