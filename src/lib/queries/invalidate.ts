import {queryClient} from './queryClient';
import {queryKeys} from './keys';

/**
 * Invalidering etter hendelses-mutasjoner (opprett/endre/avlys/RSVP).
 *
 * Bor i egen modul UTEN api-import: api-laget (events.ts) kaller hit
 * etter vellykket skriv, og en modul som også importerte api-fetchere
 * ville gitt importsirkel api ↔ queries.
 *
 * Prefikset `['events']` treffer alle lags event-lister uansett
 * vindus-tag — mutasjoner er sjeldne, så presisjonen er ikke verdt
 * å måtte trekke team_space_id gjennom alle mutasjonssignaturene.
 */
export function invalidateEventQueries(eventId?: string): void {
  queryClient.invalidateQueries({queryKey: ['events']});
  if (eventId) {
    queryClient.invalidateQueries({queryKey: queryKeys.event(eventId)});
  }
}
