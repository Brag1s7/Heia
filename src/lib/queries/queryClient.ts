import {QueryClient} from '@tanstack/react-query';

/**
 * Én delt QueryClient for hele appen (P7). Modulnivå, ikke useState:
 * realtime-handlerne (B3) og api-laget må kunne nå cachen imperativt
 * utenfor React-treet (`setQueryData`/`ensureQueryData`), og App har
 * allerede AppState-koblingen sin på modulvis samme måte.
 *
 * Defaults speiler P6-kontrakten:
 * - `staleTime` 60 s = «resync ved fokus hvis > 60 s siden sist» —
 *   fokus-refetch skjer bare når data faktisk er gamle. Varme stier
 *   som endrer seg sjeldnere (members) setter høyere staleTime selv.
 * - `retry: 1` — nettfeil skal synes raskt (P13: ingen stille
 *   retry-løkker), og realtime/fokus gir uansett nye forsøk.
 * - `gcTime` default (5 min) beholdes: lagbytte frem og tilbake
 *   treffer cache, men gamle lag holdes ikke i minnet evig.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
