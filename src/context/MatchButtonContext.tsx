import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {useActiveTeam} from './TeamContext';
import {useNotifications} from './NotificationsContext';
import {invalidateLiveMatch, useLiveMatch} from '../lib/queries/liveMatch';
import {
  matchButtonState,
  type MatchButtonState,
  type MatchPresence,
} from '../shared/matchButton';

/**
 * KAMPKNAPPENS TILSTAND — delt mellom kampskjermen og tab-baren (skive 10).
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DEN FINNES
 *
 * Knappen står i tab-baren, som alltid er montert. Den skal vise fire ting
 * den ikke selv kan vite: om laget har en kamp i gang, om DU står inne i den,
 * om du er kampens reporter, og hva som er det nyeste øyeblikket å heie på.
 *
 * De tre siste vet `EventDetailScreen` allerede. Derfor MELDER kampskjermen
 * seg på her ved fokus, i stedet for at tab-baren begynner å regne ut
 * kampstatus på egen hånd. Tab-baren blir en dum tegner; all kampkunnskap
 * blir liggende der den hører hjemme.
 *
 * Mønsteret er `watchEvent` i `NotificationsContext`: registrer ved fokus,
 * slipp ved blur, og slipp KUN hvis det fortsatt er din registrering som
 * står — blur- og fokusrekkefølgen ved navigasjon er ikke garantert.
 */

interface MatchButtonContextValue {
  state: MatchButtonState;
  /**
   * Kampknappen VET hva den skal vise, og appen kan trygt tegnes.
   *
   * ⚠️ Brages egen løsning etter tredje telefonrunde: «Hva om den først må ha
   * fått på plass knappen før den kan vise appen?» Alt annet vi prøvde —
   * en nøytral mellomtilstand, ingen sprett — gjorde bare hoppet mindre
   * synlig. Det ENESTE som fjerner det er å ikke tegne baren før svaret er
   * der. `BootScreen` står allerede der i de hundredelene det tar.
   */
  bootReady: boolean;
  enterMatch: (presence: MatchPresence) => void;
  leaveMatch: (eventId: string) => void;
  /**
   * Utløser kampskjermens egen handling (HEIA, eller dokken av/på).
   * Ingenting skjer om vi ikke står inne i en kamp.
   */
  press: () => void;
  /** Fanefokus henter fasit — settings-uavhengig, se `useLiveMatch`. */
  refreshLiveMatch: () => void;
}

/** Hvor lenge oppstarten får vente på kampsvaret før appen vises uansett. */
const BOOT_MAX_MS = 1500;

const MatchButtonContext = createContext<MatchButtonContextValue | null>(null);

export function MatchButtonProvider({children}: {children: ReactNode}) {
  const {activeTeamSpaceId, activeTeamSpace} = useActiveTeam();
  const {liveNonce} = useNotifications();
  const [presence, setPresence] = useState<MatchPresence | null>(null);
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  /**
   * ⚠️ TAKET ER IKKE VALGFRITT. Uten det ville en treg forbindelse — eller
   * en telefon uten nett — holdt HELE appen på oppstartsflaten. En knapp som
   * ikke vet er en liten feil; en app som ikke starter er en stor en.
   */
  const [bootTimedOut, setBootTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setBootTimedOut(true), BOOT_MAX_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      const active = s === 'active';
      setAppActive(active);
      // Hent straks ved retur, i stedet for å vente på neste intervall: en
      // kamp kan ha startet mens telefonen lå i lomma.
      if (active) invalidateLiveMatch(activeTeamSpaceId);
    });
    return () => sub.remove();
  }, [activeTeamSpaceId]);

  // Det raske sporet. Bumper på hvert varsel jeg faktisk mottar — som er
  // grunnen til at det ikke kan stå alene (se `useLiveMatch`).
  useEffect(() => {
    if (liveNonce > 0) invalidateLiveMatch(activeTeamSpaceId);
  }, [liveNonce, activeTeamSpaceId]);

  const {data: liveMatch, isPending} = useLiveMatch(activeTeamSpaceId, {
    appActive,
    inMatch: presence !== null,
  });

  // ⚠️ HANDLINGEN I EN REF, IKKE I STATE. `onPress` er en ny closure hver
  // gang kampskjermen rendrer (den fanger stillingen, engasjementet og
  // dokkens tilstand). Lå den i sammenligningen under, ville hver render av
  // kampen rendret hele fanetreet; ble den utelatt fra en state-verdi, ville
  // knappen sittet igjen med en foreldet closure og heiet på feil øyeblikk.
  // Refen er alltid fersk, og state bærer bare det som TEGNES.
  const actionRef = useRef<(() => void) | null>(null);

  const enterMatch = useCallback((next: MatchPresence) => {
    actionRef.current = next.onPress;
    setPresence(prev =>
      prev !== null &&
      prev.eventId === next.eventId &&
      prev.isReporter === next.isReporter &&
      prev.dockOpen === next.dockOpen &&
      prev.heiaTarget?.postId === next.heiaTarget?.postId &&
      prev.heiaTarget?.iReacted === next.heiaTarget?.iReacted
        ? prev
        : next,
    );
  }, []);

  const leaveMatch = useCallback((eventId: string) => {
    // ⚠️ Bare nullstill hvis ingen andre har tatt over i mellomtiden. Samme
    // rekkefølge-felle som `watchEvent` løser: går du fra én kamp rett til en
    // annen, kan den nyes fokus komme FØR den gamles blur.
    setPresence(prev => {
      if (prev !== null && prev.eventId !== eventId) return prev;
      actionRef.current = null;
      return null;
    });
  }, []);

  const press = useCallback(() => {
    actionRef.current?.();
  }, []);

  const refreshLiveMatch = useCallback(() => {
    invalidateLiveMatch(activeTeamSpaceId);
  }, [activeTeamSpaceId]);

  // Vet vi det ennå? Står du INNE i kampen er spørringen slått av og
  // `isPending` sann for alltid — men da vet presence alt vi trenger.
  const known = presence !== null || !isPending;

  const state = useMemo(
    () =>
      matchButtonState({
        // ⚠️ «VET VI DET ENNÅ?» Uten dette sa knappen `KAMP` — altså «ingen
        // kamp pågår» — i det halve sekundet før første henting landet, og
        // hoppet så til stillingen (Brage 2026-08-21). Det var ikke en
        // animasjonsfeil: flaten påsto noe den ikke hadde dekning for.
        //
        // Står du INNE i kampen er spørringen slått av og `isPending` er
        // sann for alltid — men da vet presence alt vi trenger.
        known,
        presence,
        liveMatch: liveMatch
          ? {
              eventId: liveMatch.id,
              status: liveMatch.matchStatus ?? 'upcoming',
              // `score.home` ER alltid oss — `mapEventRow` normaliserer
              // hjemme/borte, så «2–1» betyr det samme her som i banneret.
              home: liveMatch.score?.home ?? 0,
              away: liveMatch.score?.away ?? 0,
              teamName: activeTeamSpace?.displayName ?? 'Oss',
              opponent: liveMatch.opponent ?? '',
            }
          : null,
      }),
    [presence, liveMatch, known, activeTeamSpace?.displayName],
  );

  const value = useMemo(
    () => ({
      state,
      // Uten lagrom finnes det ingen kamp å vente på — da er vi klare med
      // én gang, og onboarding/dormant-flatene slipper å vente på et kall
      // som aldri kommer.
      bootReady: !activeTeamSpaceId || known || bootTimedOut,
      enterMatch,
      leaveMatch,
      press,
      refreshLiveMatch,
    }),
    [
      state,
      activeTeamSpaceId,
      known,
      bootTimedOut,
      enterMatch,
      leaveMatch,
      press,
      refreshLiveMatch,
    ],
  );

  return (
    <MatchButtonContext.Provider value={value}>
      {children}
    </MatchButtonContext.Provider>
  );
}

export function useMatchButton(): MatchButtonContextValue {
  const ctx = useContext(MatchButtonContext);
  if (!ctx) {
    throw new Error('useMatchButton må brukes inne i MatchButtonProvider');
  }
  return ctx;
}

/**
 * KAMPSKJERMENS PÅMELDING.
 *
 * Kalles med en memoisert payload mens kampen er i gang, og med `null` ellers.
 * Registreringen er FOKUS-bundet: går du videre til kommentarene, faller
 * knappen tilbake til live-stillingen — nøyaktig som prototypens `inMatch()`.
 */
export function useMatchPresence(presence: MatchPresence | null): void {
  const {enterMatch, leaveMatch} = useMatchButton();
  const isFocused = useIsFocused();
  const eventId = presence?.eventId;

  // Alltid ferskeste payload, uten å være en dependency: se under.
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  /**
   * ⚠️ DEN MÅ MELDE SEG PÅ IGJEN VED FOKUS. STOR FEIL, FUNNET AV BRAGE
   * 2026-08-21: «trykker man ut av kampen og inn igjen så blir ikke knappen
   * omgjort til rapporter knapp!»
   *
   * Første utkast slapp registreringen ved blur, men meldte seg bare på
   * igjen når payload-OBJEKTET endret seg. Kom du tilbake til en kamp der
   * ingenting hadde skjedd i mellomtiden, var objektet identisk (det er
   * memoisert med vilje) — og da fyrte aldri effekten. Knappen ble stående
   * på live-stillingen i stedet for RAPPORTER.
   *
   * Nå er FOKUS selve signalet: på ved fokus, av ved blur. Det er den samme
   * livssyklusen `watchEvent` bruker, og den er den eneste som er sann.
   */
  useFocusEffect(
    useCallback(() => {
      const current = presenceRef.current;
      // Refen kan ligge foran renderen. `eventId` er det renderen faktisk
      // meldte inn, og de to må være enige før vi registrerer.
      if (!current || current.eventId !== eventId) return;
      enterMatch(current);
      return () => leaveMatch(current.eventId);
    }, [eventId, enterMatch, leaveMatch]),
  );

  // Innholdet oppdateres utenfor fokus-effekten: et nytt mål endrer
  // `heiaTarget` mange ganger i løpet av en kamp, og å rive fokus-effekten
  // opp og ned for det ville slått registreringen av og på.
  //
  // ⚠️ `isFocused`-vakten er ikke pynt: uten den ville en kampskjerm som
  // ligger IGJEN i en annen fanes stack fortsatt kunne overskrevet
  // registreringen til kampen du faktisk ser på.
  useEffect(() => {
    if (presence && isFocused) enterMatch(presence);
  }, [presence, isFocused, enterMatch]);
}
