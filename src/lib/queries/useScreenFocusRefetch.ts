import {useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {queryClient} from './queryClient';

/**
 * Broen mellom react-navigation og TanStack: fane-/skjermfokus er IKKE
 * «window focus» (focusManager ser bare AppState), så uten denne ville
 * en fane som står montert bak en annen aldri resynce ved fanebytte.
 *
 * P6-regelen implementert bokstavelig: resync ved fokus KUN hvis > 60 s
 * siden forrige vellykkede henting. Et raskt fanebytte frem og tilbake
 * skal ikke koste et nettverkskall — det var halve poenget med B2.
 *
 * `invalidateQueries` (ikke refetch): treffer alle aktive observere av
 * nøkkelen med inflight-dedupe, så Hjem og Kalender deler også resyncen.
 */
export function useScreenFocusRefetch(
  queryKey: readonly unknown[],
  staleMs = 60_000,
): void {
  // Nøkkel-arrayet er nytt per render; strengen er stabil for samme nøkkel.
  const keyHash = JSON.stringify(queryKey);
  useFocusEffect(
    useCallback(() => {
      const key = JSON.parse(keyHash) as readonly unknown[];
      const state = queryClient.getQueryState(key);
      // Første fokus kommer i SAMME commit som useQuery-mounten: hentingen
      // er alt i gang, og invalidateQueries (cancelRefetch) ville avbrutt
      // og STARTET DEN PÅ NYTT — to kall for én skjermåpning.
      if (state?.fetchStatus === 'fetching') {
        return;
      }
      // `isInvalidated` = noen har markert queryen stale uten å hente
      // (refetchType 'none' — f.eks. en realtime-hendelse som traff i
      // blur-øyeblikket). Da vet appen at data ER utdatert, og 60 s-regelen
      // skal ikke utsette resyncen.
      if (
        state?.isInvalidated ||
        !state?.dataUpdatedAt ||
        Date.now() - state.dataUpdatedAt > staleMs
      ) {
        queryClient.invalidateQueries({queryKey: key});
      }
    }, [keyHash, staleMs]),
  );
}
