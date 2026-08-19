import {supabase} from '../supabase';
import type {User, UserRole} from '../../shared/types';

/** Et lagmedlem slik appen bruker det: en person med en rolle i lagrommet. */
export type TeamMember = User & {
  role: UserRole;
  /** `invited` = koden er delt, men personen har ikke åpnet appen ennå. */
  status: 'active' | 'invited';
  joinedAt?: Date;
  /**
   * Barna denne personen administrerer i laget. En forelder med to barn har
   * to medlemskap, og begge navnene havner her.
   */
  childNames: string[];
  /**
   * Bare satt for deg selv, og for andre voksne når du er trener/lagleder —
   * `get_team_members` nuller det ut ellers (00027). Spillerkontoer (barna)
   * eksponerer aldri nummer.
   */
  phone?: string;
  /**
   * Stående rolleforespørsel fra join-flyten (§5 i FORLAT-LAG-DORMANT):
   * «Jeg er trener» gir aktivt medlemskap som supporter + 'trener' her.
   * Lagadmin godkjenner (setMemberRole) eller avslår (declineRoleRequest).
   */
  requestedRole?: 'trener';
};

/** Forfatter-oppslag som overlever utmelding (00067): navn/avatar/rolle
 *  for alle som NOEN GANG har hatt en medlemsrad i laget. */
export interface TeamAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
}

/**
 * Lagets medlemmer via `get_team_members` (SECURITY DEFINER). RPC-en er
 * nødvendig fordi profiles-RLS kun lar deg lese din egen profil — en direkte
 * join gir ikke lagkameraters navn.
 *
 * RPC-en returnerer én rad per *medlemskap*, så en forelder som administrerer
 * to barn dukker opp to ganger. Her vil vi ha personene, ikke medlemskapene,
 * så radene slås sammen per bruker (barnenavnene samles opp). Radene kommer
 * sortert med trener først, og duplikat-id-er ville uansett brutt
 * `keyExtractor` i lister.
 */
export async function getTeamMembers(
  teamSpaceId: string,
): Promise<TeamMember[]> {
  const {data, error} = await supabase.rpc('get_team_members', {
    ts_id: teamSpaceId,
  });

  if (error) {
    throw error;
  }

  const byUser = new Map<string, TeamMember>();
  for (const row of (data || []) as any[]) {
    const existing = byUser.get(row.user_id);
    if (existing) {
      // Flere medlemskap for samme person: det eneste nye er barnet.
      if (row.child_name) existing.childNames.push(row.child_name);
      continue;
    }
    byUser.set(row.user_id, {
      id: row.user_id,
      name: row.display_name ?? 'Medlem',
      avatarUrl: row.avatar_url ?? undefined,
      role: row.role as UserRole,
      status: row.status === 'invited' ? 'invited' : 'active',
      joinedAt: row.joined_at ? new Date(row.joined_at) : undefined,
      childNames: row.child_name ? [row.child_name] : [],
      phone: row.phone ?? undefined,
      requestedRole: row.requested_role === 'trener' ? 'trener' : undefined,
    });
  }

  return [...byUser.values()];
}

/**
 * Forfattere i laget — ALLE som noen gang har hatt en medlemsrad, ikke
 * bare de levende (00067). Kommentarer og innlegg består når noen
 * forlater laget (frysdokumentets §2), og da må navnet og avataren
 * deres også bestå. Kun navn/avatar/rolle — aldri telefon eller status.
 */
export async function getTeamAuthors(
  teamSpaceId: string,
): Promise<TeamAuthor[]> {
  const {data, error} = await supabase.rpc('get_team_authors', {
    ts_id: teamSpaceId,
  });

  if (error) {
    throw error;
  }
  return ((data || []) as any[]).map(row => ({
    id: row.user_id,
    name: row.display_name ?? 'Medlem',
    avatarUrl: row.avatar_url ?? undefined,
    role: row.role as UserRole,
  }));
}

/**
 * Setter et medlems rolle (00067). Vaktene bor i databasen: kun
 * lagadmin, kun personlige rader, aldri spillere, og laget kan aldri
 * etterlates uten aktiv trener/lagleder. Godkjenning av en stående
 * trenerforespørsel er samme kall med role='trener'.
 */
export async function setMemberRole(
  teamSpaceId: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  const {error} = await supabase.rpc('set_member_role', {
    p_team_space_id: teamSpaceId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) {
    throw error;
  }
}

/** Avslår en stående trenerforespørsel (00067) — personen består som
 *  supporter og får rolig beskjed via varsel. */
export async function declineRoleRequest(
  teamSpaceId: string,
  userId: string,
): Promise<void> {
  const {error} = await supabase.rpc('decline_role_request', {
    p_team_space_id: teamSpaceId,
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
}

/**
 * Fjerner et medlem fra laget (kun trener/lagleder — «block abusive
 * users»-kravet i lukket lag-kontekst, Apple 1.2). RPC-en `remove_team_member`
 * (00041) setter status='removed' på ALLE personens medlemskap i laget (en
 * forelder med to barn har to rader), sletter RSVP-ene deres på fremtidige
 * hendelser, og avviser fjerning av deg selv og av andre admins — vaktene bor
 * i databasen, ikke her.
 */
export async function removeTeamMember(
  teamSpaceId: string,
  userId: string,
): Promise<void> {
  const {error} = await supabase.rpc('remove_team_member', {
    p_team_space_id: teamSpaceId,
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
}
