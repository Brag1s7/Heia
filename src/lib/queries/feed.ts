import {useInfiniteQuery, type InfiniteData} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som members.ts
// og events.ts.
import {getTeamFeed} from '../api/feed';
import {
  FEED_PAGE_SIZE,
  flattenFeedPages,
  nextFeedCursor,
} from '../../shared/feedPaging';
import type {FeedItem} from '../../shared/types';

/**
 * Feeden i query-cachen (B2): useInfiniteQuery over cursor-parameteren
 * get_team_feed har hatt siden 00029 — til nå har appen alltid bare hentet
 * første side. Cursor-/pinned-logikken er ren og bor i `shared/feedPaging`.
 *
 * Nøkkelen er den LÅSTE P7-formen `['feed', teamSpaceId]` — ingen side- eller
 * bruker-parametre: B3-realtime skal setQueryData mot nøyaktig denne, og
 * bruker-id-en trengs ikke i nøkkelen fordi `queryClient.clear()` kjøres i
 * clearLocalCaches ved utlogging (én bruker per cache-livsløp).
 */

type FeedData = InfiniteData<FeedItem[], string | null>;

/** Nøkkelen skjermene fokus-resyncer mot (useScreenFocusRefetch). */
export function teamFeedKey(teamSpaceId: string) {
  return queryKeys.feed(teamSpaceId);
}

// Stabil referanse: TanStack memoiserer select-resultatet på (data, select) —
// en inline-arrow ville bygget ny flat liste hver render.
const selectFeedItems = (data: FeedData): FeedItem[] =>
  flattenFeedPages(data.pages);

/**
 * `myUserId` kommer fra kallerens context (P5) og går rett videre til
 * iReacted-oppslaget i getTeamFeed — ingen auth-rundtur på varmeste lesesti.
 * `data` er den FLATE, dedupede visningslista (select), mens cachen under
 * beholder sidestrukturen som patch-hjelperne og B3 muterer.
 */
export function useTeamFeed(
  teamSpaceId: string | null | undefined,
  myUserId: string | undefined,
) {
  return useInfiniteQuery({
    queryKey: teamFeedKey(teamSpaceId ?? ''),
    queryFn: ({pageParam}) =>
      getTeamFeed(
        teamSpaceId as string,
        myUserId,
        FEED_PAGE_SIZE,
        pageParam ?? undefined,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => nextFeedCursor(lastPage),
    enabled: !!teamSpaceId,
    select: selectFeedItems,
  });
}

/**
 * Optimistisk oppdatering av ÉN post over sidestrukturen (👏-toggle,
 * løsne-markør). Kalleren reverterer ved feil med en ny patch — samme
 * funksjonelle mønster som setFeed-map-en den erstatter.
 */
export function patchFeedItem(
  teamSpaceId: string,
  postId: string,
  patch: (item: FeedItem) => FeedItem,
): void {
  queryClient.setQueryData<FeedData>(
    queryKeys.feed(teamSpaceId),
    data =>
      data && {
        ...data,
        pages: data.pages.map(page =>
          page.some(p => p.id === postId)
            ? page.map(p => (p.id === postId ? patch(p) : p))
            : page,
        ),
      },
  );
}

/** Optimistisk fjerning (slett): posten forsvinner med én gang, refetch
 *  healer sidene etterpå. */
export function removeFeedItem(teamSpaceId: string, postId: string): void {
  queryClient.setQueryData<FeedData>(
    queryKeys.feed(teamSpaceId),
    data =>
      data && {
        ...data,
        pages: data.pages.map(page => page.filter(p => p.id !== postId)),
      },
  );
}

/**
 * Refetch via cachen (realtime-debounce og mutasjoner): alle LASTEDE sider
 * hentes på nytt i rekkefølge, med cursorene regnet FERSKT per side — så
 * lista er konsistent også når nye poster har flyttet sidegrensene. Uten
 * aktive observere (skjermen forlatt) koster kallet ingenting.
 */
export function invalidateFeed(teamSpaceId: string): void {
  queryClient.invalidateQueries({queryKey: queryKeys.feed(teamSpaceId)});
}

/**
 * Marker stale UTEN å hente (refetchType 'none') — for blur midt i
 * debounce-vinduet: appen VET det kom en hendelse, men F19 forbyr henting
 * mens skjermen er ubevoktet (observeren står montert bak fanen, så en
 * vanlig invalidering ville fetchet der og da). useScreenFocusRefetch ser
 * `isInvalidated` ved neste fokus og resyncer straks — uavhengig av
 * 60 s-regelen.
 */
export function markFeedStale(teamSpaceId: string): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.feed(teamSpaceId),
    refetchType: 'none',
  });
}
