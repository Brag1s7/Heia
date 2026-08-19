// ---------------------------------------------------------------------------
// Supabase-aligned types — matcher DB-skjemaet og RPC-responser.
// Gamle typer i src/shared/types.ts beholdes midlertidig for
// skjermer som ikke er migrert ennå.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth & Profil
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  displayName: string;
  /**
   * PATH i den private `avatars`-bucketen (00068) — ALDRI en URL. Signerte
   * URL-er utløper, så en URL kan ikke lagres. Bruk `avatarRef()` for å
   * gjøre den om til noe `Avatar` kan tegne. DB-kolonnen heter fortsatt
   * `avatar_url` (begrunnelsen står i migrasjonen).
   */
  avatarPath: string | null;
  /**
   * Selvvalgt avatarfarge (#RRGGBB, 00070). NULL = navne-hashen gjelder.
   * Vises bare når det ikke er noe profilbilde over den.
   */
  avatarColor: string | null;
  phone: string | null;
  locale: string;
  onboardingCompleted: boolean;
  /**
   * §3d (FORLAT-LAG-DORMANT): første fullførte join/create, stemplet
   * server-side (00067-triggeren). Navigator-porten: satt → hovedappen
   * (Profil-rotet ved null aktive lag); null → den låste onboardingen.
   */
  onboardingCompletedAt: string | null;
  householdId: string | null;
}

// ---------------------------------------------------------------------------
// Sports & Clubs
// ---------------------------------------------------------------------------

export interface Sport {
  id: string;
  slug: string;
  displayName: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  gender: 'male' | 'female' | 'mixed';
  level: 'recreational' | 'competitive';
  club: Club;
  sport: Sport;
}

// ---------------------------------------------------------------------------
// Team Spaces
// ---------------------------------------------------------------------------

export interface TeamSpace {
  id: string;
  teamId: string;
  displayName: string;
  color: string;
  logoUrl: string | null;
  inviteCode: string;
  isActivated: boolean;
  activatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export type MemberRole =
  | 'trener'
  | 'lagleder'
  | 'admin'
  | 'forelder'
  | 'spiller'
  | 'supporter';

export type MemberStatus = 'invited' | 'active' | 'inactive' | 'removed';

export interface Membership {
  id: string;
  userId: string;
  teamSpaceId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  managedChildId: string | null;
}

export interface EnrichedMembership extends Membership {
  teamSpace: TeamSpace;
  team: Team;
  /** Barnets navn når raden er en barne-rad — «Forlat laget» navngir alle
   *  berørte (frysdokumentets §7-krav), så navnet må følge raden. */
  managedChildName: string | null;
}

// ---------------------------------------------------------------------------
// RPC response types
// ---------------------------------------------------------------------------

export interface InviteCodeResult {
  id: string;
  displayName: string;
  color: string;
  /** Laglogo, ellers klubbens — falt sammen i SQL (00050). null = ingen. */
  logoUrl: string | null;
  clubName: string;
  sport: string;
  memberCount: number;
  /**
   * §3a (FORLAT-LAG-DORMANT): false = laget har ingen aktiv lagadmin og
   * er låst for ukjente kodebrukere. Eldre bygg mot ny DB tåler feltet;
   * nye bygg mot gammel DB får undefined → behandles som åpent (porten
   * håndheves uansett server-side).
   */
  hasActiveAdmin?: boolean;
}

export interface JoinResult {
  membershipId: string;
  teamSpaceId: string;
  displayName: string;
  /** 'joined' (vanlig) eller 'reopened' (§3f-2 — gammel adminrolle
   *  gjeninnsatt). Eldre DB uten 00067 gir undefined → 'joined'. */
  outcome?: 'joined' | 'reopened';
  /** Rollen raden faktisk fikk («trener» via koden blir 'supporter'). */
  role?: MemberRole;
  /** 'trener' når forespørselen står og venter på godkjenning (§5). */
  pendingRole?: 'trener' | null;
}

/** Utfallet av leave_team (00067) — utfall som data, aldri exceptions
 *  for de forventede stoppene (00064-kontrakten). */
export interface LeaveTeamResult {
  outcome: 'left' | 'last_admin' | 'not_member';
  /** Ble laget stående uten aktive medlemmer? (informasjon, ikke alarm) */
  teamDormant?: boolean;
}

export interface ActivateResult {
  teamSpaceId: string;
  inviteCode: string;
  membershipId: string;
}

// ---------------------------------------------------------------------------
// Create team from scratch (team-first / invite-first onboarding)
// ---------------------------------------------------------------------------

/** Klient → create_team_from_scratch() RPC. Enten clubId eller clubName. */
export interface CreateTeamPayload {
  teamName: string;
  sport: string; // sport-slug (f.eks. 'fotball')
  ageGroup: string;
  clubId?: string;
  clubName?: string;
  gender?: 'male' | 'female' | 'mixed';
  level?: 'recreational' | 'competitive';
  color?: string;
}

export interface CreateResult {
  teamSpaceId: string;
  inviteCode: string;
  membershipId: string;
}

/** Klubb-autocomplete-treff. Logoen er dedup-incentivet i dropdownen. */
export interface ClubSearchResult {
  id: string;
  name: string;
  logoUrl: string | null;
}
