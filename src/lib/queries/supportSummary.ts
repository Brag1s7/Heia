import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som liveMatch.ts.
import {getTeamSupportSummary} from '../api/payments';

/**
 * LAGKASSA-AGGREGATET I QUERY-CACHEN (S1-c).
 *
 * Før dette bodde tallet i to `useState`-hentinger: TeamHomes `loadHeroes`
 * (som i tillegg red på feed-realtime — en 👏-burst refetchet lagkassa) og
 * SeasonScreens `loadStats`. Én nøkkel, delt av begge skjermene, gjør at et
 * fanebytte Hjem → Sesongen ikke koster et nytt kall innenfor staleTime.
 *
 * staleTime 60 s er en bevisst justering av P7-grensen: dette er en varm
 * LESE-sti. Mutasjonene (checkout, oppsigelse) forblir imperative kall —
 * de invaliderer i stedet denne nøkkelen ved behov.
 *
 * Feil svelges ikke her: `useQuery` bærer error-tilstanden, og skjermene
 * leser `data ?? null` — samme «sekundært, blokkerer aldri hovedflaten»-
 * oppførsel som de gamle `.catch(() => null)`-hentingene.
 */

/** Nøkkelen skjermene leser og mutasjoner invaliderer. */
export function supportSummaryKey(teamSpaceId: string) {
  return queryKeys.supportSummary(teamSpaceId);
}

export function useSupportSummary(teamSpaceId: string | null | undefined) {
  return useQuery({
    queryKey: supportSummaryKey(teamSpaceId ?? ''),
    queryFn: () => getTeamSupportSummary(teamSpaceId as string),
    staleTime: 60_000,
    enabled: !!teamSpaceId,
  });
}

/** Etter en støtte-mutasjon (eller feed-resync): marker som utdatert. */
export function invalidateSupportSummary(
  teamSpaceId: string | null | undefined,
): void {
  if (!teamSpaceId) return;
  queryClient.invalidateQueries({queryKey: supportSummaryKey(teamSpaceId)});
}
