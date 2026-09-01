/**
 * S3b-2: Broadcast-konvolutt → `MatchRealtimeEvent` — RENE FUNKSJONER.
 *
 * FASIT: docs/S3B2-BROADCAST-DECODE.md. Avvik herfra er en bug her.
 *
 * Dekoderen speiler pgc-stiens vakter i `subscribeToMatch` (events.ts) —
 * samme radvalidering, samme fallback-disiplin — slik at skjermen ikke kan
 * merke transportbyttet. Tilstanden (seq-vannmerke, session-vannmerke,
 * message_id-LRU) er per registrering: to samtidige skjermer på samme kanal
 * dekoder uavhengig og får hver sin komplette strøm.
 */
import type {MatchRealtimeEvent} from './events';

export interface MatchDecodeState {
  /** Løpende maks av match_event-seq — KUN til gap-dom, aldri dedupe (§3). */
  lastSeq: number | null;
  /** Vannmerke for session.updated_at (ms) — stale-vernet (§6). */
  lastSessionTs: number | null;
  /** LRU over message_id (§2): sett + innsettingsrekkefølge. */
  seenIds: Set<string>;
  seenOrder: string[];
}

const SEEN_LIMIT = 200;

export function createMatchDecodeState(): MatchDecodeState {
  return {
    lastSeq: null,
    lastSessionTs: null,
    seenIds: new Set(),
    seenOrder: [],
  };
}

const FALLBACK: MatchRealtimeEvent[] = [{kind: 'fallback'}];

/**
 * Dekoder ÉN broadcast-melding. Returnerer null eller flere events å levere
 * til skjermen, i rekkefølge. Muterer `state` (vannmerker + LRU).
 */
export function decodeMatchBroadcast(
  eventName: string,
  envelope: unknown,
  state: MatchDecodeState,
): MatchRealtimeEvent[] {
  // §1: konvoluttvalidering. Ukjent v (skjemadrift) er også fallback.
  if (envelope === null || typeof envelope !== 'object') return FALLBACK;
  const env = envelope as Record<string, unknown>;
  if (env.v !== 1 || typeof env.message_id !== 'string') return FALLBACK;
  const data = env.data;
  if (data === null || typeof data !== 'object') return FALLBACK;

  // §2: dedupe KUN på message_id (seq gjenbrukes lovlig — aldri dedupe der).
  if (state.seenIds.has(env.message_id)) return [];
  state.seenIds.add(env.message_id);
  state.seenOrder.push(env.message_id);
  if (state.seenOrder.length > SEEN_LIMIT) {
    const evicted = state.seenOrder.shift();
    if (evicted !== undefined) state.seenIds.delete(evicted);
  }

  const row = data as Record<string, unknown>;
  const op = row.op;

  switch (eventName) {
    case 'match_event': {
      // §3: seq må være tallet fra match_events.sequence.
      const seq = env.seq;
      if (typeof seq !== 'number') return FALLBACK;
      const lastSeq = state.lastSeq;
      state.lastSeq = lastSeq === null ? seq : Math.max(lastSeq, seq);

      if (op === 'INSERT') {
        // Gap KUN her, og kun fremover: seq <= lastSeq er lovlig gjenbruk
        // (korrigering beholder seq; COALESCE(max)+1 over gjenværende rader
        // gir samme verdi på ny id etter annullering).
        if (lastSeq !== null && seq > lastSeq + 1) {
          return [{kind: 'resync'}];
        }
        return row.id && row.type && row.minute !== undefined
          ? [{kind: 'matchEvent', row}]
          : FALLBACK;
      }
      if (op === 'UPDATE') {
        return row.id && row.type && row.minute !== undefined
          ? [{kind: 'matchEventUpdate', row}]
          : FALLBACK;
      }
      if (op === 'DELETE') {
        return typeof row.id === 'string'
          ? [{kind: 'matchEventDelete', id: row.id}]
          : FALLBACK;
      }
      return FALLBACK;
    }

    case 'session': {
      if (
        row.home_score === undefined ||
        row.away_score === undefined ||
        !row.status
      ) {
        return FALLBACK;
      }
      // §6: stale-vern på updated_at — redelivery skal aldri rulle
      // stillingen tilbake. Uparserbar tid → appliser uten vannmerke
      // (fail-open, pgc-paritet).
      const ts =
        typeof row.updated_at === 'string' ? Date.parse(row.updated_at) : NaN;
      if (!Number.isNaN(ts)) {
        if (state.lastSessionTs !== null && ts < state.lastSessionTs) {
          return [];
        }
        state.lastSessionTs =
          state.lastSessionTs === null ? ts : Math.max(state.lastSessionTs, ts);
      }
      return [{kind: 'session', row}];
    }

    case 'photo': {
      // §4-fellen: pgc emitter BÅDE photo og engagementPost for et bilde
      // festet til et mål; 00080 sender kun 'photo'-eventet. Begge må ut,
      // ellers kan det ferskeste målet ikke heies på.
      const events: MatchRealtimeEvent[] = [{kind: 'photo'}];
      if (row.match_event_id) {
        events.push({kind: 'engagementPost'});
      }
      return events;
    }

    case 'engagement':
      return [{kind: 'engagementPost'}];

    case 'reaction': {
      if (op !== 'INSERT' && op !== 'DELETE') return [];
      if (typeof row.feed_post_id !== 'string') return FALLBACK;
      return [
        {
          kind: 'reaction',
          postId: row.feed_post_id,
          userId: typeof row.user_id === 'string' ? row.user_id : undefined,
          delta: op === 'INSERT' ? 1 : -1,
        },
      ];
    }

    case 'comment': {
      // Soft-delete er en UPDATE med deleted_at; redigering (UPDATE uten)
      // og hard DELETE emitter ingenting — pgc-paritet.
      const delta: 1 | -1 | null =
        op === 'INSERT' ? 1 : op === 'UPDATE' && row.deleted_at ? -1 : null;
      if (delta === null) return [];
      if (typeof row.feed_post_id !== 'string') return FALLBACK;
      return [{kind: 'commentDelta', postId: row.feed_post_id, delta}];
    }

    default:
      // Fremoverkompatibilitet: nye serverevents knekker ikke gamle klienter.
      return [];
  }
}
