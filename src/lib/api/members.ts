import {supabase} from '../supabase';
import type {User, UserRole} from '../../shared/types';

/** Et lagmedlem slik appen bruker det: en person med en rolle i lagrommet. */
export type TeamMember = User & {role: UserRole};

/**
 * Lagets medlemmer via `get_team_members` (SECURITY DEFINER). RPC-en er
 * nødvendig fordi profiles-RLS kun lar deg lese din egen profil — en direkte
 * join gir ikke lagkameraters navn.
 *
 * RPC-en returnerer én rad per *medlemskap*, så en forelder som administrerer
 * et barn dukker opp flere ganger. Her vil vi ha personene, ikke medlemskapene,
 * så vi beholder første rad per bruker. Radene kommer sortert med trener først,
 * og duplikat-id-er ville uansett brutt `keyExtractor` i lister.
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
    if (byUser.has(row.user_id)) continue;
    byUser.set(row.user_id, {
      id: row.user_id,
      name: row.display_name ?? 'Medlem',
      avatarUrl: row.avatar_url ?? undefined,
      role: row.role as UserRole,
    });
  }

  return [...byUser.values()];
}
