/**
 * S3c: Broadcast-konvolutt → `FeedRealtimeEvent` — RENE FUNKSJONER.
 *
 * FASIT: docs/S3C-BROADCAST-FEED-NOTIF.md. Avvik herfra er en bug her.
 *
 * Dekoderen speiler pgc-stiens vakter i `subscribeToFeed` (feed.ts) —
 * samme klassifisering, samme ekko-filter, samme fallback-disiplin — slik
 * at TeamHomeScreen ikke kan merke transportbyttet. `myUserId` og
 * `heiaEmoji` kommer som parametre fra feed.ts (verdi-import herfra til
 * feed.ts ville gitt en modulsirkel; type-importen under er visket ut ved
 * kompilering, samme mønster som matchBroadcastDecode ↔ events).
 */
import type {FeedRealtimeEvent} from './feed';
import {
  createBroadcastDedupe,
  openBroadcastEnvelope,
  type BroadcastDedupe,
} from './broadcastEnvelope';

/** Feeden har ingen seq/vannmerker — tilstanden er kun dedupe-LRU-en. */
export type FeedDecodeState = BroadcastDedupe;

export const createFeedDecodeState = createBroadcastDedupe;

const FALLBACK: FeedRealtimeEvent[] = [{kind: 'fallback'}];

/**
 * Dekoder ÉN broadcast-melding fra team-kanalen. Returnerer null eller
 * flere events å levere til skjermen. Muterer `state` (LRU).
 */
export function decodeFeedBroadcast(
  eventName: string,
  envelope: unknown,
  myUserId: string | undefined,
  heiaEmoji: string,
  state: FeedDecodeState,
): FeedRealtimeEvent[] {
  const opened = openBroadcastEnvelope(envelope, state);
  if (opened.outcome === 'invalid') return FALLBACK;
  if (opened.outcome === 'duplicate') return [];
  const {row} = opened;
  const op = row.op;

  switch (eventName) {
    case 'feed_post': {
      if (op === 'INSERT') {
        // En INSERT som alt er soft-slettet finnes ikke i praksis — men den
        // skal i så fall ikke koste en refetch (pgc-paritet).
        return row.deleted_at ? [] : [{kind: 'postNew'}];
      }
      if (op === 'UPDATE') {
        return row.id ? [{kind: 'postUpdate', row}] : FALLBACK;
      }
      // Triggeren er AFTER INSERT OR UPDATE — andre op-er er skjemadrift.
      return FALLBACK;
    }

    case 'reaction': {
      if (op !== 'INSERT' && op !== 'DELETE') return [];
      if (typeof row.feed_post_id !== 'string') return FALLBACK;
      // Eget ekko (alt applisert optimistisk) / annen emoji enn 👏-telleren.
      if (row.user_id === myUserId || row.emoji !== heiaEmoji) return [];
      return [
        {
          kind: 'reaction',
          postId: row.feed_post_id,
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

    case 'live':
      // Kampknappens signal — konsumeres av `subscribeToTeamLive`-lytteren
      // (egen dekodetilstand), aldri av feeden.
      return [];

    default:
      // Fremoverkompatibilitet: nye serverevents knekker ikke gamle klienter.
      return [];
  }
}
