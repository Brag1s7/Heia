import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-importer (ikke api-barrelen) — samme sirkelvern som members.ts,
// events.ts og feed.ts.
import {
  getEventDetail,
  mapMatchEventRow,
  MATCH_STATUS_MAP,
} from '../api/events';
import {getMatchFeed, getMatchPhotos} from '../api/feed';
import type {MatchFeedPost} from '../../shared/matchEngagement';
import type {HeiaEventDetail} from '../../shared/types';

/**
 * Event-detaljen i query-cachen (B2, P7-nøklene ['event', id] og
 * ['matchPhotos', id]). Skjermen står i tre stacks — cachen gjør at et
 * gjenbesøk innen staleTime ikke koster et nytt get_event_with_rsvp-kall,
 * der den gamle skjermen refetchet ved HVERT fokus.
 *
 * Mutasjonene i api-laget (RSVP/rediger/avlys) invaliderer ['event', id]
 * selv via invalidateEventQueries — de trenger ingenting herfra.
 */

/** Nøklene skjermen fokus-resyncer mot (useScreenFocusRefetch). */
export function eventDetailKey(eventId: string) {
  return queryKeys.event(eventId);
}
export function matchPhotosKey(eventId: string) {
  return queryKeys.matchPhotos(eventId);
}
export function matchEngagementKey(eventId: string) {
  return queryKeys.matchEngagement(eventId);
}

/** Hendelsen med RSVP, oppmøte og kampforløp. teamSpaceId stemples inn i
 *  resultatet (RPC-en returnerer det ikke) men står IKKE i nøkkelen —
 *  event-id-er er globalt unike. */
export function useEventDetail(
  eventId: string,
  teamSpaceId: string | null | undefined,
) {
  return useQuery({
    queryKey: eventDetailKey(eventId),
    queryFn: () => getEventDetail(eventId, teamSpaceId as string),
    enabled: !!teamSpaceId,
  });
}

/** Kampbildene — egen sti (P6-splitten): et mål skal aldri re-laste bildene.
 *  `enabled` gates på at hendelsen faktisk er en kamp, så en trening ikke
 *  koster et get_match_photos-kall. */
export function useMatchPhotos(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: matchPhotosKey(eventId),
    queryFn: () => getMatchPhotos(eventId),
    enabled,
  });
}

/**
 * Kampens engasjement (00071). Fjerde RPC-en på kampskjermen, og det er et
 * BEVISST valg: koblingen mellom øyeblikket og posten er hele skiva, og den
 * kan ikke leses ut av `get_event_with_rsvp` uten å utvide en RPC som alle
 * hendelsestyper deler. Egen sti betyr også at et HEIA aldri koster en
 * re-lasting av kampforløpet, og at et mål aldri re-laster tellerne.
 *
 * `enabled` gates på at hendelsen er en kamp — en trening skal ikke betale.
 */
export function useMatchEngagement(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: matchEngagementKey(eventId),
    queryFn: () => getMatchFeed(eventId),
    enabled,
  });
}

/**
 * Justerer tellerne på ÉN post i kampens engasjement — optimistisk trykk,
 * realtime fra andre, og patchene `CommentsScreen` sender tilbake hit.
 *
 * Funksjonelt samme mønster som `adjustFeedItemCounts`, og med samme
 * egenskap: er posten ikke i cachen (kampen er ikke lastet, eller tråden hører
 * til en helt annen post), er kallet en stille no-op.
 *
 * `heia` er en delta, `iReacted` en absolutt tilstand — telleren kan bevege
 * seg uten at MIN tilstand gjør det (en annen som heier), og min tilstand kan
 * settes uten å gjette hva telleren står på.
 */
export function adjustMatchEngagement(
  eventId: string | undefined,
  postId: string,
  deltas: {heia?: number; comments?: number; iReacted?: boolean},
): void {
  if (!eventId) {
    return;
  }
  queryClient.setQueryData<MatchFeedPost[]>(
    matchEngagementKey(eventId),
    posts =>
      posts?.map(post =>
        post.postId === postId
          ? {
              ...post,
              ...(deltas.heia !== undefined && {
                heiaCount: Math.max(0, post.heiaCount + deltas.heia),
              }),
              ...(deltas.comments !== undefined && {
                commentCount: Math.max(0, post.commentCount + deltas.comments),
              }),
              ...(deltas.iReacted !== undefined && {
                iReacted: deltas.iReacted,
              }),
            }
          : post,
      ),
  );
}

/**
 * Optimistisk oppdatering av detaljen i cachen (RSVP-svar, reporterbytte) —
 * samme funksjonelle mønster som patchFeedItem. Kalleren reverterer ved feil
 * med en ny patch; refetchen etterpå henter serverens fasit.
 */
export function patchEventDetail(
  eventId: string,
  patch: (detail: HeiaEventDetail) => HeiaEventDetail,
): void {
  queryClient.setQueryData<HeiaEventDetail>(
    eventDetailKey(eventId),
    detail => detail && patch(detail),
  );
}

/**
 * match_events-INSERT fra payload (B3, P6: «append til tidslinjen, ingen
 * refetch»). Mapper raden med SAMME logikk som getEventDetail
 * (mapMatchEventRow) og appender — payloadene kommer i commit-rekkefølge
 * (= sequence-rekkefølge, som RPC-en sorterer på), så append bevarer den.
 * Dedupe på id: reporterens egen skriving refetcher eksplisitt (fasit fra
 * server), og ekkoet hennes skal ikke gi dobbel rad.
 *
 * Returnerer false når cachen ikke kan ta imot (ingen detalj lastet ennå)
 * — kalleren faller da tilbake til debounced refetch (P6s sikkerhetsnett).
 */
export function applyMatchEventInsert(eventId: string, row: any): boolean {
  const detail = queryClient.getQueryData<HeiaEventDetail>(
    eventDetailKey(eventId),
  );
  if (!detail) {
    return false;
  }
  if (detail.matchEvents?.some(e => e.id === row.id)) {
    return true; // alt applisert (eget ekko etter refetch)
  }
  const mapped = mapMatchEventRow(
    row,
    detail.matchSessionId ?? row.match_session_id,
    detail.opponent ?? 'motstanderen',
  );
  patchEventDetail(eventId, d => ({
    ...d,
    matchEvents: [...(d.matchEvents ?? []), mapped],
  }));
  return true;
}

/**
 * En RETTET kamphendelse fra payload (skive 8). Raden byttes ut PÅ PLASS.
 *
 * ⚠️ IKKE `applyMatchEventInsert` med en «finnes den fra før»-sjekk. Den
 * returnerer `true` og gjør INGENTING når id-en finnes — som er riktig for et
 * eget ekko, og helt galt for en rettelse: målet ville blitt stående med
 * gammel side og gammel målscorer til neste refetch.
 *
 * Kjenner vi ikke raden (kampen er ikke lastet, eller hendelsen kom mens
 * skjermen var borte), returneres false og kalleren refetcher.
 */
export function applyMatchEventUpdate(eventId: string, row: any): boolean {
  const detail = queryClient.getQueryData<HeiaEventDetail>(
    eventDetailKey(eventId),
  );
  if (!detail?.matchEvents?.some(e => e.id === row.id)) {
    return false;
  }
  const mapped = mapMatchEventRow(
    row,
    detail.matchSessionId ?? row.match_session_id,
    detail.opponent ?? 'motstanderen',
  );
  patchEventDetail(eventId, d => ({
    ...d,
    matchEvents: (d.matchEvents ?? []).map(e => (e.id === row.id ? mapped : e)),
  }));
  return true;
}

/**
 * En ANNULLERT kamphendelse (skive 8) — ut av forløpet.
 *
 * Stillingen røres ikke her: korrigeringen skriver `match_sessions` i samme
 * transaksjon, så den kommer som en egen `session`-payload med den ferdig
 * omregnede stillingen. To kilder til stillingen er nøyaktig det P2 forbød.
 */
export function applyMatchEventDelete(
  eventId: string,
  matchEventId: string,
): boolean {
  const detail = queryClient.getQueryData<HeiaEventDetail>(
    eventDetailKey(eventId),
  );
  if (!detail) {
    return false;
  }
  if (!detail.matchEvents?.some(e => e.id === matchEventId)) {
    return true; // alt borte (eget ekko etter refetch)
  }
  patchEventDetail(eventId, d => ({
    ...d,
    matchEvents: (d.matchEvents ?? []).filter(e => e.id !== matchEventId),
  }));
  return true;
}

/**
 * match_sessions-UPDATE fra payload (B3, P6: «scoreboard fra payload —
 * stillingen ligger komplett i raden»). Patcher stilling, status, reporter
 * og starttid; feltene mappes som i mapEventRow (home = oss, alltid).
 * Returnerer false uten cachet detalj — kalleren refetcher debounced.
 */
export function applyMatchSessionUpdate(eventId: string, row: any): boolean {
  const detail = queryClient.getQueryData<HeiaEventDetail>(
    eventDetailKey(eventId),
  );
  if (!detail) {
    return false;
  }
  patchEventDetail(eventId, d => ({
    ...d,
    score: {home: row.home_score, away: row.away_score},
    matchStatus: MATCH_STATUS_MAP[row.status as string] ?? d.matchStatus,
    reporterId: row.reporter_id ?? undefined,
    opponent: row.opponent ?? d.opponent,
    startedAt: row.started_at ? new Date(row.started_at) : d.startedAt,
  }));
  return true;
}

/** Refetch via cachen — realtime-debouncen på kampskjermen. Aktiv observer
 *  (skjermen i fokus, som realtime-abonnementet garanterer) refetcher straks. */
export function invalidateEventDetail(eventId: string): void {
  queryClient.invalidateQueries({queryKey: eventDetailKey(eventId)});
}
export function invalidateMatchPhotos(eventId: string): void {
  queryClient.invalidateQueries({queryKey: matchPhotosKey(eventId)});
}
export function invalidateMatchEngagement(eventId: string): void {
  queryClient.invalidateQueries({queryKey: matchEngagementKey(eventId)});
}

/**
 * Marker stale UTEN å hente (refetchType 'none') — samme bro som
 * markFeedStale: blur midt i realtime-debouncen skal ikke fetche (F19,
 * observeren står montert bak neste skjerm), men appen VET det kom en
 * hendelse. useScreenFocusRefetch ser `isInvalidated` ved retur og
 * resyncer straks.
 */
export function markEventDetailStale(eventId: string): void {
  queryClient.invalidateQueries({
    queryKey: eventDetailKey(eventId),
    refetchType: 'none',
  });
}
export function markMatchPhotosStale(eventId: string): void {
  queryClient.invalidateQueries({
    queryKey: matchPhotosKey(eventId),
    refetchType: 'none',
  });
}
export function markMatchEngagementStale(eventId: string): void {
  queryClient.invalidateQueries({
    queryKey: matchEngagementKey(eventId),
    refetchType: 'none',
  });
}
