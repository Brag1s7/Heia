import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som liveMatch.ts.
import {getTournaments, type TournamentOption} from '../api/events';

/**
 * AKTUELLE TURNERINGER I QUERY-CACHEN.
 *
 * «Turnering»-feltet i kampskjemaet finnes bare når laget har en aktuell
 * turnering, og det ble avgjort av et kall som startet i det arket åpnet.
 * Resultatet kom et blunk etter at arket sto, feltet dukket opp og dyttet
 * Motstander ned (Brage 2026-09-09: «lastes ikke alt innholdet inn
 * samtidig … henger litt etter»). Nå bor listen her: sesongsiden varmer
 * nøkkelen når den monteres (lenge før noen rekker å trykke «Ny kamp»),
 * arket leser den synkront fra cachen, og feltet står der fra første ramme.
 *
 * staleTime 60 s som lagkassa: en varm lesesti. Opprettelse av en turnering
 * invaliderer nøkkelen.
 */
export function tournamentsKey(teamSpaceId: string) {
  return queryKeys.tournaments(teamSpaceId);
}

const STALE_MS = 60_000;

export function useTournaments(teamSpaceId: string | null | undefined) {
  return useQuery({
    queryKey: tournamentsKey(teamSpaceId ?? ''),
    queryFn: () => getTournaments(teamSpaceId as string),
    staleTime: STALE_MS,
    enabled: !!teamSpaceId,
  });
}

/** Varm cachen der inngangen til «Ny kamp» bor. Feil svelges: uten liste
 *  vises ikke feltet, og kampen blir en vanlig kamp — som før. */
export function prefetchTournaments(
  teamSpaceId: string | null | undefined,
): void {
  if (!teamSpaceId) return;
  // `prefetchQuery` svelger selv feil fra queryFn — ingen catch nødvendig.
  queryClient.prefetchQuery({
    queryKey: tournamentsKey(teamSpaceId),
    queryFn: () => getTournaments(teamSpaceId),
    staleTime: STALE_MS,
  });
}

export function invalidateTournaments(
  teamSpaceId: string | null | undefined,
): void {
  if (!teamSpaceId) return;
  queryClient.invalidateQueries({queryKey: tournamentsKey(teamSpaceId)});
}

export type {TournamentOption};
