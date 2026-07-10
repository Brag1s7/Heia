import type {NavigatorScreenParams} from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Sport & Event-typer — skalerbar via enum-utvidelse
// ---------------------------------------------------------------------------
export type SportType =
  | 'fotball'
  | 'handball'
  | 'basket'
  | 'ishockey'
  | 'annet';

export type EventType = 'trening' | 'kamp' | 'sosialt' | 'annet';

export type RSVPStatus = 'kommer' | 'kan_ikke' | 'venter';

/** Speiler memberships.role i databasen. Se isTeamAdmin() i shared/roles.ts. */
export type UserRole =
  | 'trener'
  | 'lagleder'
  | 'admin'
  | 'forelder'
  | 'spiller';

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
  avatarUrl?: string;
}

export interface HeiaEvent {
  id: string;
  teamSpaceId: string;
  type: EventType;
  title: string;
  startTime: Date;
  /** Valgfri i databasen — en hendelse trenger ikke sluttidspunkt. */
  endTime?: Date;
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
  /** Satt når kampen er startet. Kampminuttet regnes ut fra denne. */
  startedAt?: Date;
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
  avatarUrl?: string;
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
  imageUrl?: string;
  matchEvent?: MatchEvent;
  eventId?: string;
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
  KalenderStack: undefined;
  Opprett: undefined;
  Inbox: undefined;
  ProfilStack: undefined;
};

export type HomeStackParamList = {
  /** composeNonce settes av «Del med laget» for å fokusere compose-boksen. */
  TeamHome: {composeNonce?: number} | undefined;
  EventDetail: {eventId: string};
  NewEvent: undefined;
  Support: undefined;
  Invite: {firstTime?: boolean} | undefined;
  Comments: {postId: string; teamSpaceId: string};
};

export type OnboardingStackParamList = {
  WelcomeIntent: undefined;
  Auth: {mode?: 'login' | 'register'} | undefined;
  JoinTeamCode: {prefillCode?: string} | undefined;
  CreateTeam: undefined;
};

export type KalenderStackParamList = {
  KalenderList: undefined;
  EventDetail: {eventId: string};
};

export type ProfilStackParamList = {
  Profil: undefined;
  Invite: {firstTime?: boolean} | undefined;
  // Samme skjermer som i onboarding — her for å legge til lag nr. 2.
  JoinTeamCode: {prefillCode?: string} | undefined;
  CreateTeam: undefined;
};
