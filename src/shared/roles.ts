import type {UserRole} from './types';

/**
 * Rollene DB-funksjonen `is_team_admin()` godtar. Holdes i synk med
 * supabase/migrations/00008_rls_helpers.sql — sprik her betyr at appen
 * enten skjuler knapper RLS tillater, eller viser knapper som feiler.
 */
const ADMIN_ROLES: readonly UserRole[] = ['trener', 'lagleder', 'admin'];

export function isTeamAdmin(role: UserRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

/** Rollenavn slik de vises for brukeren. */
export const ROLE_LABELS: Record<UserRole, string> = {
  trener: 'Trener',
  lagleder: 'Lagleder',
  admin: 'Admin',
  forelder: 'Forelder',
  spiller: 'Spiller',
};
