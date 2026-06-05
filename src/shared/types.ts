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

export type UserRole = 'trener' | 'forelder' | 'spiller';

export type MatchStatus = 'upcoming' | 'live' | 'halfTime' | 'finished';

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
  reportedBy: string;
  createdAt: Date;
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
  endTime: Date;
  location: string;
  description?: string;
  rsvp: RSVPSummary;
  score?: {home: number; away: number};
  opponent?: string;
  matchStatus?: MatchStatus;
  matchEvents?: MatchEvent[];
  reporterId?: string;
}

export interface RSVPSummary {
  coming: number;
  notComing: number;
  pending: number;
  myStatus: RSVPStatus;
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
}

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
export type RootTabParamList = {
  HjemStack: undefined;
  KalenderStack: undefined;
  Opprett: undefined;
  Inbox: undefined;
  ProfilStack: undefined;
};

export type HomeStackParamList = {
  TeamHome: undefined;
  EventDetail: {eventId: string};
  Support: undefined;
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
};
