import {createNavigationContainerRef} from '@react-navigation/native';
import {profilEntry} from './profilEntry';
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
let pendingOpsClaimId: string | null = null;
let pendingLagkassa = false;
let pendingNotificationData: Record<string, unknown> | null = null;

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
      initial: false,
    });
  } catch {
    // Skjer når onboarding-stacken står fremme: HjemStack finnes ikke ennå.
    // Da venter målet til fanene er montert.
    pendingEventId = eventId;
  }
}

/**
 * «Heia Ops»-søknaden fra e-postens deep-link (heia://ops/claims/<id>).
 * Detaljskjermen bor i Profil-stacken; er ikke fanene montert (kaldstart,
 * utlogget) parkeres målet — skjermen er uansett DB-gatet på ops_admins,
 * så en feilnavigering viser bare en tom flate for andre.
 */
export function openOpsClaim(claimId: string): void {
  if (!claimId) return;

  if (!navigationRef.isReady()) {
    pendingOpsClaimId = claimId;
    return;
  }

  try {
    navigationRef.navigate(
      'ProfilStack',
      profilEntry('OpsClaimDetail', {claimId}),
    );
  } catch {
    pendingOpsClaimId = claimId;
  }
}

/**
 * Lagkassa fra web-knappen på heiaapp.no/betaling (heia://lagkassa) — den som
 * nettopp har betalt i Safari lander rett på pengesiden. Skjermen er
 * activeTeamSpaceId-drevet og tar ingen params; betaleren kommer fra en
 * checkout startet i nettopp det aktive laget, så konteksten stemmer.
 */
export function openLagkassa(): void {
  if (!navigationRef.isReady()) {
    pendingLagkassa = true;
    return;
  }

  try {
    navigationRef.navigate('HjemStack', {screen: 'Lagkassa', initial: false});
  } catch {
    pendingLagkassa = true;
  }
}

/**
 * Lagbytte utenfra React-treet — registrert av TeamProvider (samme idiom som
 * navigationRef). Push-innhold bor i ETT lag, og push omgår inboxens
 * lag-scoping: står appen i et annet lag, må aktivt lag byttes FØR
 * navigasjonen, ellers rendres målskjermen med feil lagkontekst —
 * EventDetail henter ALT via activeTeamSpaceId (telefonfunn 2026-08-03:
 * Stange-navnet på Ridabu-kampen).
 *
 * Tre svar, fordi kaldstart er et kappløp: 'pending' = medlemslisten er ikke
 * lastet ennå (getInitialNotification resolver før fetchen — målet må
 * PARKERES, ikke droppes), 'not_member' = listen er lastet og laget er ikke
 * der (da finnes det heller ingenting å vise — RLS), 'switched' = aktivt lag
 * er byttet/allerede riktig.
 */
export type TeamSwitchOutcome = 'switched' | 'pending' | 'not_member';

let teamSwitcher: ((teamSpaceId: string) => TeamSwitchOutcome) | null = null;

export function registerTeamSwitcher(
  fn: ((teamSpaceId: string) => TeamSwitchOutcome) | null,
): void {
  teamSwitcher = fn;
}

/** 'pending' også når broen ikke er registrert ennå — da parkeres målet. */
function switchTeamFor(teamSpaceId: string | null): TeamSwitchOutcome {
  if (!teamSpaceId) return 'switched';
  if (!teamSwitcher) return 'pending';
  return teamSwitcher(teamSpaceId);
}

/**
 * Målet i et push-trykk — SAMME avgjørelse som Varsler-sidens handlePress,
 * bare fra rå varseldata: klubbdør-varsler bærer `screen` og peker inn i
 * Profil-stacken, kampvarsler bærer `event_id`, vanlige poster/kommentarer
 * bare `feed_post_id`. Nøklene ligger flatt i APNs-payloaden, nøyaktig slik
 * notifications.data ble skrevet (push-fanout sender data-feltet som det
 * står). Uten gjenkjent mål gjør trykket ingenting utover å åpne appen —
 * samme «uten mål»-gren som i inboxen.
 */
export function openNotificationTarget(data: Record<string, unknown>): void {
  const teamSpaceId =
    typeof data.team_space_id === 'string' && data.team_space_id.length > 0
      ? data.team_space_id
      : null;

  const screen = data.screen;
  if (screen === 'club_payments' || screen === 'support_setup') {
    // club_payments er KLUBBNIVÅ — betalingsansvarlig er ikke nødvendigvis
    // medlem av laget som spør (varselet er globalt), så der byttes aldri
    // lag. support_setup er lagets egen flate → bytt dit først.
    if (screen === 'support_setup') {
      const outcome = switchTeamFor(teamSpaceId);
      if (outcome === 'pending') {
        pendingNotificationData = data;
        return;
      }
      if (outcome === 'not_member') {
        return;
      }
    }
    if (!navigationRef.isReady()) {
      pendingNotificationData = data;
      return;
    }
    try {
      navigationRef.navigate(
        'ProfilStack',
        profilEntry(
          screen === 'club_payments' ? 'ClubPayments' : 'SupportSetup',
        ),
      );
    } catch {
      pendingNotificationData = data;
    }
    return;
  }

  const eventId = data.event_id;
  const postId = data.feed_post_id;
  const hasEvent = typeof eventId === 'string' && eventId.length > 0;
  const hasPost = typeof postId === 'string' && postId.length > 0;
  if (!hasEvent && !hasPost) {
    return;
  }

  const outcome = switchTeamFor(teamSpaceId);
  if (outcome === 'pending') {
    pendingNotificationData = data;
    return;
  }
  if (outcome === 'not_member') {
    return;
  }

  if (hasEvent) {
    openEvent(eventId as string);
    return;
  }

  if (teamSpaceId) {
    if (!navigationRef.isReady()) {
      pendingNotificationData = data;
      return;
    }
    try {
      navigationRef.navigate('HjemStack', {
        screen: 'Comments',
        params: {postId: postId as string, teamSpaceId},
        initial: false,
      });
    } catch {
      pendingNotificationData = data;
    }
  }
}

/**
 * heia://-URL-er fra Linking (kaldstart + mens appen kjører). Kjenner kun
 * rutene vi faktisk har — alt annet ignoreres stille.
 */
export function handleDeepLinkUrl(url: string | null): void {
  if (!url) return;
  const ops = url.match(/^heia:\/\/ops\/claims\/([0-9a-f-]{36})/i);
  if (ops) {
    openOpsClaim(ops[1]);
    return;
  }
  if (/^heia:\/\/lagkassa\/?$/i.test(url)) {
    openLagkassa();
  }
}

/**
 * Prøver på nytt på et parkert mål. Kalles når navigatoren er klar og når
 * fanene monteres — altså i det øyeblikket en innlogging faktisk gir oss et
 * sted å navigere til.
 */
export function flushPendingDeepLink(): void {
  if (!navigationRef.isReady()) return;

  if (pendingEventId !== null) {
    const eventId = pendingEventId;
    // Nulles FØR forsøket, ellers kan openEvent parkere det på nytt og vi
    // sitter med et mål som prøver seg i det uendelige.
    pendingEventId = null;
    openEvent(eventId);
  }

  if (pendingOpsClaimId !== null) {
    const claimId = pendingOpsClaimId;
    pendingOpsClaimId = null;
    openOpsClaim(claimId);
  }

  if (pendingLagkassa) {
    pendingLagkassa = false;
    openLagkassa();
  }

  if (pendingNotificationData !== null) {
    const data = pendingNotificationData;
    pendingNotificationData = null;
    openNotificationTarget(data);
  }
}
