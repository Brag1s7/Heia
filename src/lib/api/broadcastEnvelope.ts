/**
 * S3c: Konvoluttåpningen (§1) og message_id-dedupen (§2) fra
 * docs/S3B2-BROADCAST-DECODE.md, trukket ut av match-dekoderen — samme
 * regler gjelder ordrett for team- (feed/live) og user-kanalen (notif),
 * og reglene skal ha ETT hjem. Fasit for S3c-bruken:
 * docs/S3C-BROADCAST-FEED-NOTIF.md.
 */

/** LRU over message_id (§2): sett + innsettingsrekkefølge. Per lytter. */
export interface BroadcastDedupe {
  seenIds: Set<string>;
  seenOrder: string[];
}

const SEEN_LIMIT = 200;

export function createBroadcastDedupe(): BroadcastDedupe {
  return {seenIds: new Set(), seenOrder: []};
}

export type OpenedEnvelope =
  /** Gyldig og ny: `env` er hele konvolutten, `row` er `env.data`. */
  | {outcome: 'ok'; env: Record<string, unknown>; row: Record<string, unknown>}
  /** Ugyldig form eller ukjent v (skjemadrift) — behandles som fallback. */
  | {outcome: 'invalid'}
  /** Kjent message_id (transport-redelivery) — droppes stille. */
  | {outcome: 'duplicate'};

/**
 * Validerer konvolutten (§1) og deduper på message_id (§2). Muterer
 * `dedupe` KUN når meldingen er gyldig og ny — søppel skal ikke kunne
 * fylle LRU-en og kaste ut ekte id-er.
 */
export function openBroadcastEnvelope(
  envelope: unknown,
  dedupe: BroadcastDedupe,
): OpenedEnvelope {
  if (envelope === null || typeof envelope !== 'object') {
    return {outcome: 'invalid'};
  }
  const env = envelope as Record<string, unknown>;
  if (env.v !== 1 || typeof env.message_id !== 'string') {
    return {outcome: 'invalid'};
  }
  const data = env.data;
  if (data === null || typeof data !== 'object') {
    return {outcome: 'invalid'};
  }

  if (dedupe.seenIds.has(env.message_id)) {
    return {outcome: 'duplicate'};
  }
  dedupe.seenIds.add(env.message_id);
  dedupe.seenOrder.push(env.message_id);
  if (dedupe.seenOrder.length > SEEN_LIMIT) {
    const evicted = dedupe.seenOrder.shift();
    if (evicted !== undefined) dedupe.seenIds.delete(evicted);
  }

  return {outcome: 'ok', env, row: data as Record<string, unknown>};
}
