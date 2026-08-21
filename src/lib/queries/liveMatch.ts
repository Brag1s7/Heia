import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som eventDetail.ts.
import {getLiveMatch} from '../api/events';

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
 * De to skjermene beholder sine egne `useState`-hentinger. Å skrive dem om
 * ville endret to MÅLTE kallbudsjetter (`feedRefetch.test.tsx`) i en skive
 * som ikke handler om det. Samme funksjon, samme mapping ⇒ samme modell.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DEN HAR ET EKTE INTERVALL, OG IKKE BARE `staleTime`
 *
 * Det raske sporet er `liveNonce` i `NotificationsContext`: hvert
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
    queryFn: () => getLiveMatch(teamSpaceId as string),
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
