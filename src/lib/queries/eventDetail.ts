import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-importer (ikke api-barrelen) — samme sirkelvern som members.ts,
// events.ts og feed.ts.
import {getEventDetail} from '../api/events';
import {getMatchPhotos} from '../api/feed';
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

/** Refetch via cachen — realtime-debouncen på kampskjermen. Aktiv observer
 *  (skjermen i fokus, som realtime-abonnementet garanterer) refetcher straks. */
export function invalidateEventDetail(eventId: string): void {
  queryClient.invalidateQueries({queryKey: eventDetailKey(eventId)});
}
export function invalidateMatchPhotos(eventId: string): void {
  queryClient.invalidateQueries({queryKey: matchPhotosKey(eventId)});
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
