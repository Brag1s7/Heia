import type {NavigatorScreenParams} from '@react-navigation/native';
import type {ProfilStackParamList} from '../shared/types';

/**
 * Inngangen til en Profil-skjerm FRA et varsel, en push eller en e-postlenke.
 *
 * Den naive veien (`navigate('ProfilStack', {screen})`) legger målskjermen som
 * ENESTE rad i fanen når fanen ikke er montert fra før: ingen Profil under,
 * ingen vei tilbake, og fanetrykket (som betyr «gå til toppen») er en no-op.
 * Brukeren er innelåst til appen drepes.
 *
 * `initial: false` løser innelåsingen, men gir to bevegelser: fanen monteres
 * på Profil, og målet skyves inn oppå. Det leses som et hopp — og det er
 * bibliotekets egen oppførsel, ikke noe vi kan animere oss ut av
 * (useNavigationBuilder bygger startstaten først og påfører navigate-handlingen
 * etterpå).
 *
 * `state` setter hele fanens innhold i ÉN operasjon i stedet: Profil ligger
 * under fra første bilde, målskjermen er øverst fra første bilde, og det er
 * fanebyttet — ikke en innskyving — som er den synlige overgangen. Er fanen
 * allerede montert, blir det samme staten via en reset, og da animerer
 * stacken som vanlig.
 */
export function profilEntry<T extends keyof ProfilStackParamList>(
  screen: T,
  params?: ProfilStackParamList[T],
): NavigatorScreenParams<ProfilStackParamList> {
  // Casten er bevisst: PartialState krever at `params` matcher `name` for hver
  // rad, og den koblingen kan TypeScript ikke se gjennom en generisk T.
  return {
    state: {
      index: 1,
      routes: [{name: 'Profil'}, {name: screen, params}],
    },
  } as NavigatorScreenParams<ProfilStackParamList>;
}
