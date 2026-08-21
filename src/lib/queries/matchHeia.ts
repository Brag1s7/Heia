import {addReaction} from '../api/feed';
import {adjustMatchEngagement} from './eventDetail';
import {patchFeedItem} from './feed';

/**
 * 👏 FRA KAMPKNAPPEN — EN JUBEL, IKKE EN BRYTER (skive 10).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DEN IKKE ER `handleMatchHeia` MED ANDRE ARGUMENTER
 *
 * Engasjementslinja i forløpet er en AV/PÅ-knapp, og der er `toggleReaction`
 * riktig: brukeren ser sin egen tilstand rett foran seg og trykker bevisst
 * på nytt for å ta den bort.
 *
 * Kampknappen i tab-baren er noe annet. Den er stor, den sitter under
 * tommelen, og den blir hamret på i det et mål går inn. Med toggle-semantikk
 * ville det andre trykket SLETTET heiaen det første ga — brukeren ville sett
 * telleren gå opp og så ned igjen, uten å ha bedt om noe slikt.
 *
 * ---------------------------------------------------------------------------
 * TRE LAG, OG DE DEKKER HVERT SITT VINDU
 *
 *   1. `addReaction` har ingen delete-gren i det hele tatt, og svelger
 *      unique-bruddet (`23505`) som suksess. Serveren kan ikke ende opp med
 *      færre rader enn den startet med, uansett hva klienten tror.
 *   2. Låsen under stenger vinduet FØR den optimistiske patchen har rukket å
 *      rendre. Det er der et raskt andretrykk ellers ville sneket seg inn
 *      mens knappen fortsatt sto i «HEIA!».
 *   3. `matchButtonState` gir aldri `heia` når `iReacted` er sann.
 *
 * ⚠️ LÅSEN ER PÅ MODULNIVÅ, IKKE I EN KOMPONENT. Den skal overleve at
 * skjermen rendrer på nytt midt i kallet — og det gjør den garantert, siden
 * det første vi gjør er å patche cachen.
 */
const pending = new Set<string>();

/** Kun for tester: en hengende forespørsel skal ikke lekke mellom dem. */
export function resetHeiaPending(): void {
  pending.clear();
}

export async function cheerOnMoment(input: {
  eventId: string;
  teamSpaceId: string | null | undefined;
  postId: string;
}): Promise<void> {
  const {eventId, teamSpaceId, postId} = input;

  if (pending.has(postId)) return;
  pending.add(postId);

  // Optimistisk rett i cachen — et HEIA skal kjennes i samme sekund som
  // fingeren treffer, ikke etter en rundtur.
  adjustMatchEngagement(eventId, postId, {heia: 1, iReacted: true});

  // ⚠️ FEEDEN VISER DEN SAMME POSTEN. Uten denne patchen ville et HEIA gitt
  // i kampen stått ureagert i feeden til neste refetch — samme post, to tall.
  const patchFeed = (reacted: boolean, d: 1 | -1) => {
    if (!teamSpaceId) return;
    patchFeedItem(teamSpaceId, postId, p => ({
      ...p,
      iReacted: reacted,
      heiaCount: Math.max(0, (p.heiaCount ?? 0) + d),
    }));
  };
  patchFeed(true, 1);

  try {
    await addReaction(postId);
  } catch {
    // ⚠️ KUN EKTE FEIL RULLER TILBAKE. `23505` kastes ikke av `addReaction`
    // i det hele tatt — hadde den gjort det, ville telleren gått ned selv om
    // serveren har raden.
    adjustMatchEngagement(eventId, postId, {heia: -1, iReacted: false});
    patchFeed(false, -1);
  } finally {
    pending.delete(postId);
  }
}
