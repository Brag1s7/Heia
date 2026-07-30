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
};

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
    });
  }

  return [...byUser.values()];
}
