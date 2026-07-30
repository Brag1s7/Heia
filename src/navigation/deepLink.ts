import {createNavigationContainerRef} from '@react-navigation/native';
import type {RootTabParamList} from '../shared/types';

/**
 * Navigasjon utenfra React-treet. Push-lytteren bor i `lib/push` og har ingen
 * `useNavigation` å bruke — den trenger en referanse den kan nå fra en
 * callback som fyrer når som helst, også før noe er montert.
 */
export const navigationRef = createNavigationContainerRef<RootTabParamList>();

/**
 * Et trykk kan komme lenge før appen kan gjøre noe med det: ved kaldstart
 * finnes hverken navigator eller session ennå, og er brukeren logget ut
 * finnes ikke engang fanene. Målet parkeres derfor til noen kan åpne det.
 */
let pendingEventId: string | null = null;

/**
 * Åpner kampen hvis mulig, ellers parkerer den til `flushPendingDeepLink`.
 *
 * `EventDetail` bor i Hjem-stacken, så vi navigerer inn i den — da ligger
 * Hjem-fanen igjen under, og tilbake-knappen fører dit brukeren forventer.
 */
export function openEvent(eventId: string): void {
  if (!eventId) return;

  if (!navigationRef.isReady()) {
    pendingEventId = eventId;
    return;
  }

  try {
    navigationRef.navigate('HjemStack', {
      screen: 'EventDetail',
      params: {eventId},
    });
  } catch {
    // Skjer når onboarding-stacken står fremme: HjemStack finnes ikke ennå.
    // Da venter målet til fanene er montert.
    pendingEventId = eventId;
  }
}

/**
 * Prøver på nytt på et parkert mål. Kalles når navigatoren er klar og når
 * fanene monteres — altså i det øyeblikket en innlogging faktisk gir oss et
 * sted å navigere til.
 */
export function flushPendingDeepLink(): void {
  if (pendingEventId === null || !navigationRef.isReady()) return;

  const eventId = pendingEventId;
  // Nulles FØR forsøket, ellers kan openEvent parkere det på nytt og vi
  // sitter med et mål som prøver seg i det uendelige.
  pendingEventId = null;
  openEvent(eventId);
}
