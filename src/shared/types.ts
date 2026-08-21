import type {NavigatorScreenParams} from '@react-navigation/native';
import type {MediaRef} from '../lib/media/types';

// ---------------------------------------------------------------------------
// Sport & Event-typer — skalerbar via enum-utvidelse
// ---------------------------------------------------------------------------
export type SportType =
  | 'fotball'
  | 'handball'
  | 'basket'
  | 'ishockey'
  | 'annet';

export type EventType = 'trening' | 'kamp' | 'turnering' | 'sosialt' | 'annet';

export type RSVPStatus = 'kommer' | 'kan_ikke' | 'venter';

/** Speiler memberships.role i databasen. Se isTeamAdmin() i shared/roles.ts. */
export type UserRole =
  | 'trener'
  | 'lagleder'
  | 'admin'
  | 'forelder'
  | 'spiller'
  | 'supporter';

export type MatchStatus =
  | 'upcoming'
  | 'live'
  | 'halfTime'
  | 'finished'
  | 'cancelled';

export type MatchEventType =
  | 'avspark'
  | 'mål'
  | 'pause'
  | 'andre_omgang'
  | 'slutt'
  | 'bytte'
  | 'kort'
  | 'melding';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  minute: number;
  player?: string;
  description: string;
  /**
   * ⚠️ MÅLETS FRIE BESKRIVELSE — og KUN når den er noe annet enn målscoreren.
   *
   * `report_match_event` har historisk hatt ÉTT tekstfelt, og det havnet i
   * `match_events.description` og ble vist som målscorer. «Korriger mål»
   * (skive 8) skriver de to fra hverandre: scoreren i `player_name`,
   * beskrivelsen i `description`. `note` settes derfor bare når `player_name`
   * finnes — ellers ville en gammel målpost vist samme navn to ganger.
   * Se `mapMatchEventRow`.
   */
  note?: string;
  /**
   * ⚠️ `match_events.description` RÅ — den ENESTE riktige kilden når feltet
   * skal REDIGERES, og den er en annen enn både `description` og `note`.
   *
   *   · `description` er SYNTETISK på mål («Mål for oss»), ikke kolonnen.
   *   · `note` er kolonnen, men KUN når den er noe annet enn målscoreren —
   *     riktig for visning, feil for redigering: på et mål der reporteren
   *     skrev fritekst ved rapportering ligger teksten i `description` og
   *     `note` er `undefined`. Prefylte korrigeringsarket fra `note`, ville
   *     feltet stått tomt, og et lagre hadde SLETTET teksten.
   */
  descriptionRaw?: string;
  /** `home` = oss, `away` = motstander. Satt for mål. */
  teamSide?: 'home' | 'away';
  reportedBy?: string;
  createdAt?: Date;
}

// ---------------------------------------------------------------------------
// Datamodeller
// ---------------------------------------------------------------------------

/** Kanonisk lag — representerer et virkelig lag i den virkelige verden */
export interface Team {
  id: string;
  club: string;
  teamName: string;
  sport: SportType;
  ageGroup: string;
}

/** Heia-rom — opprettes når noen aktiverer laget i Heia */
export interface TeamSpace {
  id: string;
  teamId: string;
  displayName: string;
  color: string;
  logoUrl?: string;
  inviteCode: string;
  isActivated: boolean;
  activatedAt?: Date;
  createdAt: Date;
}

/** Kobling mellom bruker og lagrom */
export interface Membership {
  id: string;
  userId: string;
  teamSpaceId: string;
  role: UserRole;
  joinedAt: Date;
}

export interface User {
  id: string;
  name: string;
  role?: UserRole; // deprecated — bruk Membership.role per lag
  /** Path i `avatars`-bucketen (00068), ikke URL. Se avatarRef(). */
  avatarPath?: string;
  /** Selvvalgt avatarfarge (00070). Utelatt = navne-hashen. */
  avatarColor?: string;
}

export interface HeiaEvent {
  id: string;
  teamSpaceId: string;
  type: EventType;
  title: string;
  startTime: Date;
  /** Valgfri i databasen — en hendelse trenger ikke sluttidspunkt. */
  endTime?: Date;
  /**
   * Frivillig oppmøtetid (00053). Når den finnes er DET klokka foreldre
   * planlegger etter, og påminnelsen én time før bruker den i stedet for
   * starttiden (00055) — aldri begge.
   */
  meetingTime?: Date;
  location?: string;
  description?: string;
  rsvp: RSVPSummary;
  score?: {home: number; away: number};
  opponent?: string;
  matchStatus?: MatchStatus;
  matchEvents?: MatchEvent[];
  reporterId?: string;
  /** Satt for kamper. Nøkkelen skriving mot match_sessions/match_events går på. */
  matchSessionId?: string;
  /**
   * ⚠️ HISTORIKK, IKKE KLOKKE (P2/00073). Når kampen faktisk begynte.
   * Skrives ALDRI om. Kampminuttet regnes IKKE av denne lenger — den teller
   * gjennom pausen. Se `playedSeconds`/`clockStartedAt` og
   * `src/shared/matchClock.ts`.
   */
  startedAt?: Date;
  /**
   * Akkumulert FAKTISK SPILT TID fram til forrige stopp (00073).
   * `undefined` = serveren er eldre enn 00073; da faller `matchClock` tilbake
   * på den gamle oppførselen. Se `matchPlayedSeconds`.
   */
  playedSeconds?: number;
  /** Når kampuret sist ble startet. `undefined` = uret står. (00073) */
  clockStartedAt?: Date;
  /**
   * Turneringen kampen hører til (00032). En turneringskamp er en HELT
   * VANLIG kamp — samme kampmotor, samme live-rapportering, samme kort —
   * som bare peker oppover. Det finnes ingen egen «turneringskamp»-type,
   * og kampen skal aldri dupliseres som et eget kalenderobjekt.
   */
  parentEventId?: string;
}

export interface RSVPSummary {
  coming: number;
  notComing: number;
  pending: number;
  myStatus: RSVPStatus;
}

/** Én rad i oppmøtelisten. Foreldre kan svare på vegne av et barn. */
export interface EventAttendee {
  id: string;
  name: string;
  /** Path i `avatars`-bucketen (00068), ikke URL. Ikke tegnet i dag —
   *  oppmøtelisten viser initialer, og barn har uansett ingen konto. */
  avatarPath?: string;
  childName?: string;
}

/** Event med oppmøtelister — kun tilgjengelig på detaljskjermen. */
export interface HeiaEventDetail extends HeiaEvent {
  attendees: {
    coming: EventAttendee[];
    notComing: EventAttendee[];
    pending: EventAttendee[];
  };
}

export interface FeedItem {
  id: string;
  teamSpaceId: string;
  type:
    | 'melding'
    | 'bilde'
    | 'paaminnelse'
    | 'resultat'
    | 'match_event'
    | 'match_start'
    | 'match_end';
  author: User & {role?: UserRole};
  createdAt: Date;
  content: string;
  /** Bildet som path + variant (P4) — aldri en ferdig URL. `MediaImage` viser den. */
  media?: MediaRef;
  /**
   * Kampkontekst fra `get_team_feed` (00029). Satt på poster som hører til en
   * kamp. `home`/`away` er kampens stilling NÅ (ferdig kamp: sluttresultatet);
   * `minute` er minuttet for akkurat denne kamphendelsen.
   */
  match?: {
    minute?: number;
    status: MatchStatus;
    home: number;
    away: number;
  };
  /**
   * ⚠️ P1: HVA KAMPØYEBLIKKET ER — satt kun når posten ER en kamphendelse
   * (00072). Feeden kunne før ikke se forskjell på et baklengsmål og en
   * beskjed fra treneren, og tegnet HEIA på begge.
   *
   * `undefined` betyr «vanlig post» ELLER «serveren har ikke 00072 ennå».
   * Begge skal oppføre seg som før — feeden har HEIA på alt annet.
   */
  matchEvent?: {
    type: MatchEventType;
    teamSide?: 'home' | 'away';
  };
  eventId?: string;
  /** «Varsle hele laget» — festet øverst i feeden, varslet alle (00024). */
  isPinned?: boolean;
  // Engasjement (Fase 2B) — 👏 «Heia»-reaksjoner + kommentarer
  heiaCount?: number;
  iReacted?: boolean;
  commentCount?: number;
}

/** Én kommentar på en feed-post. */
export interface FeedComment {
  id: string;
  author: User & {role?: UserRole};
  createdAt: Date;
  content: string;
}

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
export type RootTabParamList = {
  // NavigatorScreenParams gjør at «+»-valgarket kan navigere rett inn i
  // en skjerm i Hjem-stacken, typesikkert.
  HjemStack: NavigatorScreenParams<HomeStackParamList> | undefined;
  // Nested params: etter «Turneringen er opprettet» skal man lande i
  // Kalender PÅ turneringens startdato, ikke på toppen av lista.
  KalenderStack: NavigatorScreenParams<KalenderStackParamList> | undefined;
  Opprett: undefined;
  InboxStack: NavigatorScreenParams<InboxStackParamList> | undefined;
  // Push og e-postlenker (deepLink.ts) åpner Klubbetalinger/SupportSetup/
  // ops-flatene i Profil-fanen — derfor NavigatorScreenParams her også.
  // Varsel-TRYKK i appen går derimot i varselstacken, se InboxStackParamList.
  ProfilStack: NavigatorScreenParams<ProfilStackParamList> | undefined;
};

/**
 * Parametere til «Ny hendelse»-modalen. Samme type i alle tre stackene den
 * bor i (Hjem, Kalender, Varsler) — den var duplisert tre steder, og
 * turneringsperioden måtte da legges til tre steder.
 *
 * Modalen er TOSIDIG fra 2026-08-07: `eventId` gjør den til en
 * redigeringsskjerm for det arrangementet. Samme skjema, samme datovelger,
 * samme regnestykker — bare prefylt, og med `update_event` i den andre enden.
 */
export type NewEventParams =
  | {
      /**
       * Sett = REDIGERING av dette arrangementet. Skjemaet henter selv
       * verdiene (det trenger `is_home` og `meeting_time`, som kortene aldri
       * har båret), og typen og turneringstilknytningen låses.
       * De øvrige parameterne under gjelder kun opprettelse og ignoreres.
       */
      eventId?: string;
      parentEventId?: string;
      parentTitle?: string;
      /**
       * Turneringens periode som ISO-strenger. Ruteparametere må være
       * serialiserbare, så en Date kan ikke sendes direkte. Kampen åpner på
       * `parentFrom`, og varsler hvis datoen havner utenfor perioden.
       */
      parentFrom?: string;
      parentTo?: string;
      /** 'turnering' = «+ Ny turnering» fra sesongsiden: typen er låst. */
      presetType?: 'turnering';
      /**
       * Datoen skjemaet skal åpne på, som `dayKey` (samme format som
       * `focusDate`, ikke ISO — ISO ville vært UTC og bommet på kvelden).
       * Settes når «+» trykkes mens man står i Kalender: datoen man ser på er
       * datoen man vil planlegge. Ligger den utenfor det som er lov å
       * opprette, faller skjemaet tilbake til i dag.
       */
      presetDate?: string;
    }
  | undefined;

export type HomeStackParamList = {
  /** composeNonce settes av «Del med laget» for å fokusere compose-boksen. */
  TeamHome: {composeNonce?: number} | undefined;
  EventDetail: {eventId: string};
  /** parentEventId settes av «Ny kamp» på en turneringsside. */
  NewEvent: NewEventParams;
  /** Lagkassa (betalingsspor fase 5) — lagets støtteside for alle medlemmer,
   *  og eneste side før Stripe. «Støtt laget»-mellomskjermen er fjernet
   *  2026-08-19: den gjentok pris, fordeling og knappetekst ordrett. */
  Lagkassa: undefined;
  Invite: {firstTime?: boolean} | undefined;
  Comments: {postId: string; teamSpaceId: string};
  Season: undefined;
};

export type OnboardingStackParamList = {
  WelcomeIntent: undefined;
  Auth: {mode?: 'login' | 'register'} | undefined;
  // 6-sifret kode fra e-post: 'signup' = bekreft ny konto,
  // 'recovery' = kode + nytt passord. Ingen deep links — koden ER broen.
  VerifyEmail: {flow: 'signup' | 'recovery'; email: string};
  JoinTeamCode: {prefillCode?: string} | undefined;
  CreateTeam: undefined;
};

export type KalenderStackParamList = {
  // `focusDate` er en dayKey («2026-7-14»), ikke ISO: kalenderen rulles til
  // DAGEN, og ISO ville vært UTC og bommet på kvelden. Settes når man nettopp
  // har opprettet noe og skal lande på det, ikke på toppen av lista.
  KalenderList: {focusDate?: string} | undefined;
  EventDetail: {eventId: string};
  // Samme modal som i Hjem — «Ny kamp» på en turneringsside skal virke
  // uansett hvilken fane turneringen ble åpnet fra.
  NewEvent: NewEventParams;
};

// Varsler får egen stack så et trykk på et varsel kan åpne hendelsen eller
// kommentartråden UTEN å kaste deg over i Hjem-fanen (tilbake = inboxen).
export type InboxStackParamList = {
  InboxList: undefined;
  EventDetail: {eventId: string};
  Comments: {postId: string; teamSpaceId: string};
  NewEvent: NewEventParams;
  // Klubbdør-varslene (00047) åpner disse I varselstacken, slik at «Tilbake»
  // fører til varsellista — som for kamp- og kommentarvarsler.
  SupportSetup: undefined;
  ClubPayments: undefined;
  // Rollevarslene (00067: trenerforespørsel, rollebytte) åpner lagoversikten
  // her av samme grunn. Varslene er lag-scopet, så aktivt lag stemmer.
  // `Invite` følger med fordi lagoversikten navigerer dit.
  TeamMembers: undefined;
  Invite: {firstTime?: boolean} | undefined;
};

export type ProfilStackParamList = {
  Profil: undefined;
  /** «Passord og sikkerhet» — passordbytte med server-håndhevet
   *  current_password, og recovery-utveien for den som har glemt det. */
  ChangePassword: undefined;
  TeamMembers: undefined;
  TeamSettings: undefined;
  /** Aktivering av «Støtt laget» (betalingsspor fase 3) — kun lagadmin. */
  SupportSetup: undefined;
  Invite: {firstTime?: boolean} | undefined;
  // Samme skjermer som i onboarding — her for å legge til lag nr. 2.
  JoinTeamCode: {prefillCode?: string} | undefined;
  CreateTeam: undefined;
  /** «Heia Ops» — intern klubbsøknad-flate (00046). DB-gatet på ops_admins;
   *  raden på Profil vises kun for ops, og RPC-ene er vaktene. */
  OpsClaims: undefined;
  OpsClaimDetail: {claimId: string};
  /** «Klubber og roller» — ops-flaten for autoritetsmodellen v2 (00062):
   *  enheter, betalingsansvarlige, invitasjoner og avvikskontrollen. */
  OpsEntities: undefined;
  /** «Klubbetalinger» (klubbdøren, 00047) — kun betalingsansvarlige.
   *  DB-gatet på club_payment_managers; raden på Profil er speilet. */
  ClubPayments: undefined;
};
