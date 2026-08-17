import {useQuery, keepPreviousData} from '@tanstack/react-query';
import {queryKeys} from './keys';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som members.ts.
import {getTeamEvents} from '../api/events';

/**
 * ETT kanonisk hentevindu delt av Hjem og Kalender (P7: samme queryKey =
 * én henting for begge faner, dublett-kallet er borte).
 *
 * 12 mnd bakover dekker ALL eksisterende data (appen er yngre) — ingen
 * synlig endring i dag, kun et tak på veksten (P10 #7). Kalenderens
 * historikkvindu vokser bakover uten grense i UI-et; den dagen et lag
 * faktisk har mer enn 12 mnd historikk, er «hent eldre ved behov» en
 * bevisst utvidelse her — ikke fjern taket i stillhet.
 *
 * Taggen står i queryKey-en, IKKE datoene: en nøkkel med `new Date()`
 * ville gitt ny cache-post ved hver mount.
 */
const WINDOW_TAG = 'w12b18f';
const MONTHS_BACK = 12;
const MONTHS_FORWARD = 18;

function computeWindow(): {from: Date; to: Date} {
  const from = new Date();
  from.setMonth(from.getMonth() - MONTHS_BACK);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setMonth(to.getMonth() + MONTHS_FORWARD);
  to.setHours(23, 59, 59, 999);
  return {from, to};
}

/** Nøkkelen skjermene fokus-resyncer mot (useScreenFocusRefetch). */
export function teamEventsKey(teamSpaceId: string) {
  return queryKeys.events(teamSpaceId, WINDOW_TAG);
}

/**
 * Lagets hendelser via query-cachen. `keepPreviousData` speiler dagens
 * oppførsel ved lagbytte: gamle rader står til de nye er hentet, i stedet
 * for et tomt blaff (begge skjermene beholdt state-en sin under lasting).
 */
export function useTeamEvents(teamSpaceId: string | null | undefined) {
  return useQuery({
    queryKey: teamEventsKey(teamSpaceId ?? ''),
    queryFn: () => getTeamEvents(teamSpaceId as string, computeWindow()),
    enabled: !!teamSpaceId,
    placeholderData: keepPreviousData,
  });
}
