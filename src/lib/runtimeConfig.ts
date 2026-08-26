/**
 * SERVERSTYRT RUNTIME-CONFIG (S2, skaleringsplan §1.5) — klientsiden av
 * kill-switchen.
 *
 * Én rad i `runtime_config` (00079) styrer transportvalget for Broadcast-
 * overgangen og fallback-pollingen. Klienten LESER den ved boot/foreground
 * (servert i `get_session_context`-payloaden) og lagrer den her; `subscribeTo*`-
 * seamene velger transport per domene ved neste subscribe — fra S3. I S2
 * konsumerer ingenting flaggene ennå: modulen finnes så flagget ER der før
 * transportbyttet, og rollback for flåten alt nå er én UPDATE på serverraden.
 *
 * ⚠️ FEILER ALLTID TIL DAGENS ATFERD. Mangler raden, feiler kallet, kjører
 * appen mot en base uten 00079, eller kommer det søppel i payloaden
 * (skjemadrift), er svaret `DEFAULT_RUNTIME_FLAGS` = postgres_changes
 * overalt og klientens egen 60 s-polling. `getRuntimeConfig()` returnerer
 * ALLTID et komplett objekt — konsumenter skal aldri trenge null-vern.
 * Sanitiseringen er per felt: ett ukjent transportord smitter ikke over på
 * de andre feltene.
 */

export type RealtimeTransport = 'broadcast' | 'pgc';

export interface RuntimeFlags {
  realtimeTransport: {
    match: RealtimeTransport;
    feed: RealtimeTransport;
    notif: RealtimeTransport;
  };
  /** Sekunder mellom fallback-poll under broadcast; 0 = av. Konsumeres i S3c. */
  liveFallbackPollS: number;
  /** Laveste buildnummer serveren støtter. Konsumeres av en senere skive. */
  minBuild: number;
}

export const DEFAULT_RUNTIME_FLAGS: RuntimeFlags = Object.freeze({
  realtimeTransport: Object.freeze({
    match: 'pgc' as const,
    feed: 'pgc' as const,
    notif: 'pgc' as const,
  }),
  liveFallbackPollS: 0,
  minBuild: 0,
});

function sanitizeTransport(value: unknown): RealtimeTransport {
  return value === 'broadcast' ? 'broadcast' : 'pgc';
}

/**
 * Rå `runtime_flags`-jsonb → komplett, gyldig RuntimeFlags. Tåler hva som
 * helst: null, feil typer, manglende felter, negative tall.
 */
export function sanitizeRuntimeFlags(raw: unknown): RuntimeFlags {
  if (raw === null || typeof raw !== 'object') {
    return DEFAULT_RUNTIME_FLAGS;
  }
  const obj = raw as Record<string, unknown>;
  const transport = (obj.realtime_transport ?? {}) as Record<string, unknown>;
  const poll = obj.live_fallback_poll_s;
  const minBuild = obj.min_build;
  return {
    realtimeTransport: {
      match: sanitizeTransport(transport.match),
      feed: sanitizeTransport(transport.feed),
      notif: sanitizeTransport(transport.notif),
    },
    liveFallbackPollS:
      typeof poll === 'number' && Number.isFinite(poll) && poll >= 0
        ? Math.floor(poll)
        : DEFAULT_RUNTIME_FLAGS.liveFallbackPollS,
    minBuild:
      typeof minBuild === 'number' && Number.isFinite(minBuild) && minBuild >= 0
        ? Math.floor(minBuild)
        : DEFAULT_RUNTIME_FLAGS.minBuild,
  };
}

let current: RuntimeFlags = DEFAULT_RUNTIME_FLAGS;

/** Gjeldende flagg — alltid komplette (server-verdi hvis hentet, ellers defaults). */
export function getRuntimeConfig(): RuntimeFlags {
  return current;
}

/** Kalles av kontekst-hentingen med FERDIG SANITISERTE flagg. */
export function setRuntimeConfig(flags: RuntimeFlags): void {
  current = flags;
}

/** Tilbake til defaults (tester; utlogging trenger det ikke — configen er global). */
export function resetRuntimeConfig(): void {
  current = DEFAULT_RUNTIME_FLAGS;
}
