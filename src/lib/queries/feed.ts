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

/**
 * Realtime-tellerne (B3, P6): andres 👏 og kommentarer justerer posten rett
 * i cachen — null refetch. Klemmes i 0: et DELETE-ekko som treffer en post
 * hentet ETTER slettingen skal ikke gi −1. No-op når posten ikke er i
 * cachen (annet lag, eldre enn lastede sider).
 */
export function adjustFeedItemCounts(
  teamSpaceId: string,
  postId: string,
  deltas: {heia?: number; comments?: number},
): void {
  patchFeedItem(teamSpaceId, postId, item => ({
    ...item,
    ...(deltas.heia !== undefined && {
      heiaCount: Math.max(0, (item.heiaCount ?? 0) + deltas.heia),
    }),
    ...(deltas.comments !== undefined && {
      commentCount: Math.max(0, (item.commentCount ?? 0) + deltas.comments),
    }),
  }));
}

/**
 * feed_posts-UPDATE fra payload (B3): soft-delete fjerner posten, ellers
 * patches feltene payloaden faktisk eier (innhold + pin). Returnerer
 * 'pinChanged' når pin-status flippet — DA må kalleren refetche side 1,
 * for pinnede poster resorteres øverst (00029) og en patch-in-place kan
 * ikke flytte raden.
 */
export function applyFeedPostUpdate(
  teamSpaceId: string,
  row: any,
): 'removed' | 'patched' | 'pinChanged' | 'miss' {
  if (row.deleted_at) {
    removeFeedItem(teamSpaceId, row.id);
    return 'removed';
  }
  let result: 'patched' | 'pinChanged' | 'miss' = 'miss';
  patchFeedItem(teamSpaceId, row.id, item => {
    const isPinned = !!row.is_pinned;
    result = isPinned !== !!item.isPinned ? 'pinChanged' : 'patched';
    return {
      ...item,
      content: typeof row.content === 'string' ? row.content : item.content,
      isPinned,
    };
  });
  return result;
}

/**
 * Nytt innlegg (B3): hent KUN side 1 og skjøt den inn — de dype sidene står
 * urørt (dedupe i flattenFeedPages svelger overlapp når sidegrensene har
 * flyttet seg). Dette erstatter full invalidering per INSERT, som refetchet
 * ALLE lastede sider (B2s aksepterte grense — nå kun ved reconnect/fokus).
 *
 * Vern: pågår det alt en henting (åpningsfetch, fokus-resync) leverer den
 * ferskere data enn oss — ikke skriv oppå. Uten cache finnes ingen sider å
 * skjøte i — da vanlig invalidering (henter kun med aktiv observer).
 */
export async function refetchFeedFirstPage(
  teamSpaceId: string,
  myUserId: string | undefined,
): Promise<void> {
  const key = queryKeys.feed(teamSpaceId);
  if (queryClient.isFetching({queryKey: key}) > 0) {
    return;
  }
  if (!queryClient.getQueryData<FeedData>(key)) {
    invalidateFeed(teamSpaceId);
    return;
  }
  try {
    const page = await getTeamFeed(
      teamSpaceId,
      myUserId,
      FEED_PAGE_SIZE,
      undefined,
    );
    queryClient.setQueryData<FeedData>(
      key,
      data => data && {...data, pages: [page, ...data.pages.slice(1)]},
    );
  } catch {
    // Nettglipp: marker stale i stedet for å prøve igjen her — fokus-broen
    // (isInvalidated) resyncer, og neste realtime-hendelse gir nytt forsøk.
    markFeedStale(teamSpaceId);
  }
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
