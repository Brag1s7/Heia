import {useQuery} from '@tanstack/react-query';
import {useIsFocused} from '@react-navigation/native';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
import {pendingSessionContext} from './sessionContext';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som eventDetail.ts.
import {getLiveMatch} from '../api/events';
import type {HeiaEvent} from '../../shared/types';

/**
 * LAGETS PÅGÅENDE KAMP — kilden til kampknappen i tab-baren (skive 10).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DETTE ER IKKE EN NY KAMPSTATUSMODELL.
 *
 * Den kaller `getLiveMatch()`, den samme spørringen `TeamHomeScreen` og
 * `InboxScreen` alltid har brukt, med den samme `MATCH_STATUS_MAP` og den
 * samme regelen om at `pause` også er «pågående». Det eneste nye er at
 * svaret nå ligger i query-cachen, slik at en alltid montert tab-bar kan lese
 * det uten å eie en henting.
 *
 * Fra S1-b leser også `TeamHomeScreen` og `InboxScreen` den SAMME nøkkelen
 * (via `useLiveMatchValue` under) i stedet for egne `useState`-hentinger —
 * ÉN kilde for livekampen, og kallbudsjettet i `feedRefetch.test.tsx` er
 * oppdatert bevisst. Intervallet eies fortsatt KUN av MatchButtonContext.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DEN HAR ET EKTE INTERVALL, OG IKKE BARE `staleTime`
 *
 * Det raske sporet er `matchNonce` i `NotificationsContext`: hvert
 * kampvarsel bumper den, og provideren invaliderer denne nøkkelen. MEN
 * varselradene er GATET på brukerens egne innstillinger — triggerne spør
 * `inbox_enabled(user_id, team_space_id, 'match_live')` (00023:104,
 * 00051:137). Slår noen av kampvarsler, får de ingen rad, ingen realtime, og
 * dermed ingen nonce. Reporteren får dem heller aldri om sine EGNE
 * handlinger (triggeren hopper over forfatteren).
 *
 * `staleTime` løser ikke det: den TILLATER en refetch, den utløser ingen. Uten
 * et intervall ville en bruker som står stille på samme skjerm blitt stående
 * med gammel stilling på ubestemt tid. Derfor `refetchInterval` — av inne i
 * kampen (der realtime leverer alt) og av i bakgrunnen (ingen polling på en
 * telefon i lomma).
 */

/** Nøkkelen provideren invaliderer og skjermene refetcher mot. */
export function liveMatchKey(teamSpaceId: string) {
  return queryKeys.liveMatch(teamSpaceId);
}

/**
 * S7b: ved frø-boot monterer observerne FØR kontekst-kallet (som seeder
 * denne nøkkelen) har landet — da blir henting et hopp på det pågående
 * kallet i stedet for et duplikat enkeltkall (bootbudsjettet ≤7, §0.1-3).
 * Dekker svaret ikke laget, eller feiler kallet (null), tas dagens
 * enkeltkall ETTER at forsøket er ferdig — spørringen er aldri disabled,
 * og promiset resolver alltid (ingen deadlock). Utenom boot/foreground er
 * det ingen inflight, og dette er en ren passthrough til getLiveMatch.
 */
async function fetchLiveMatch(teamSpaceId: string): Promise<HeiaEvent | null> {
  const pending = pendingSessionContext();
  if (pending) {
    const ctx = await pending;
    if (ctx && ctx.coveredTeamSpaceId === teamSpaceId) {
      return ctx.liveMatch;
    }
  }
  return getLiveMatch(teamSpaceId);
}

/** Hvor ofte knappen henter fasit når ingenting annet skjer. */
export const LIVE_MATCH_POLL_MS = 60_000;

export function useLiveMatch(
  teamSpaceId: string | null | undefined,
  options: {
    /** Appen er fremme. I bakgrunnen skal ingenting polles. */
    appActive: boolean;
    /** Vi står INNE i en kamp: skjermen der eier realtime, vi tier. */
    inMatch: boolean;
  },
) {
  const enabled = !!teamSpaceId && !options.inMatch;
  return useQuery({
    queryKey: liveMatchKey(teamSpaceId ?? 'ingen'),
    queryFn: () => fetchLiveMatch(teamSpaceId as string),
    enabled,
    // Samme 60 s-regel som fokus-broen (`useScreenFocusRefetch`): raske
    // fanebytter skal ikke bli en kallstorm.
    staleTime: LIVE_MATCH_POLL_MS,
    refetchInterval:
      enabled && options.appActive ? LIVE_MATCH_POLL_MS : (false as const),
    refetchIntervalInBackground: false,
  });
}

/**
 * SKJERMENES LESEVINDU MOT SAMME NØKKEL (S1-b) — TeamHome (hero-banneret)
 * og Inbox (live-stripa) leser lagets pågående kamp HERFRA i stedet for å
 * eie hver sin `getLiveMatch`-henting.
 *
 * Ingen `refetchInterval`: intervallet eies KUN av `MatchButtonContext` —
 * to observere til på samme nøkkel skal ikke bety tre pollere. Denne
 * henter bare når cachen er kald eller noen har invalidert nøkkelen
 * (matchNonce, foreground, fokus-gaten i AppNavigator).
 *
 * ⚠️ FOKUS-GATET med vilje: skjermene står montert bak andre faner, og en
 * ufokusert observer ville ellers refetchet på hver invalidering — f.eks.
 * hvert kampvarsel mens man står INNE i kampen, der providerens spørring
 * bevisst er slått av. Ute av fokus tier vi; ved retur henter TanStack
 * selv hvis nøkkelen er stale/invalidert.
 */
export function useLiveMatchValue(teamSpaceId: string | null | undefined) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: liveMatchKey(teamSpaceId ?? 'ingen'),
    queryFn: () => fetchLiveMatch(teamSpaceId as string),
    enabled: !!teamSpaceId && isFocused,
    staleTime: LIVE_MATCH_POLL_MS,
  });
}

/**
 * Fanebytte-porten (S1-a): samme 60 s-regel som `useScreenFocusRefetch`,
 * for kallstedet som IKKE er en skjerm — tab-barens fokuslytter. Den gamle
 * ubetingede `invalidateQueries`-veien refetchet på HVERT fanebytte
 * (`staleTime` tillater en refetch, den stopper ingen invalidering).
 */
export function refreshLiveMatchIfStale(
  teamSpaceId: string | null | undefined,
  staleMs: number = LIVE_MATCH_POLL_MS,
): void {
  if (!teamSpaceId) return;
  const state = queryClient.getQueryState(liveMatchKey(teamSpaceId));
  // Allerede i flukt: en invalidering nå ville avbrutt og startet på nytt.
  if (state?.fetchStatus === 'fetching') return;
  if (
    state?.isInvalidated ||
    !state?.dataUpdatedAt ||
    Date.now() - state.dataUpdatedAt > staleMs
  ) {
    queryClient.invalidateQueries({queryKey: liveMatchKey(teamSpaceId)});
  }
}

/**
 * ⚠️ REPORTERENS EGEN KNAPP MÅ INVALIDERES LOKALT.
 *
 * Varseltriggeren skriver rader til alle aktive medlemmer UNNTATT
 * forfatteren (00023/00051). Reporteren får altså aldri et varsel om sitt
 * eget mål, sin egen pause eller sin egen «Slutt» — og uten dette kallet
 * ville knappen hennes stått med gammel stilling, eller påstått at det
 * fortsatt er en livekamp etter at hun avsluttet den.
 *
 * Står hun inne i kampen er spørringen slått AV, og da gjør invalideringen
 * nøyaktig det den skal: markerer fasiten som utdatert, slik at refetchen
 * skjer i samme øyeblikk spørringen slås på igjen — altså når hun går ut.
 */
export function invalidateLiveMatch(teamSpaceId: string | null | undefined) {
  if (!teamSpaceId) return;
  queryClient.invalidateQueries({queryKey: liveMatchKey(teamSpaceId)});
}
