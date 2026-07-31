import {supabase} from '../supabase';
import type {
  EnrichedMembership,
  InviteCodeResult,
  JoinResult,
  ActivateResult,
  CreateTeamPayload,
  CreateResult,
  ClubSearchResult,
  Sport,
} from '../types';

function mapEnrichedMembership(row: any): EnrichedMembership {
  const ts = row.team_space;
  const t = ts.team;
  return {
    id: row.id,
    userId: row.user_id,
    teamSpaceId: row.team_space_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    managedChildId: row.managed_child_id,
    teamSpace: {
      id: ts.id,
      teamId: ts.team_id,
      displayName: ts.display_name,
      color: ts.color,
      logoUrl: ts.logo_url,
      inviteCode: ts.invite_code,
      isActivated: ts.is_activated,
      activatedAt: ts.activated_at,
    },
    team: {
      id: t.id,
      name: t.name,
      ageGroup: t.age_group,
      gender: t.gender,
      level: t.level,
      club: {
        id: t.club.id,
        name: t.club.name,
        shortName: t.club.short_name,
      },
      sport: {
        id: t.sport.id,
        slug: t.sport.slug,
        displayName: t.sport.display_name,
      },
    },
  };
}

export async function getUserMemberships(): Promise<EnrichedMembership[]> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {data, error} = await supabase
    .from('memberships')
    .select(
      `
      *,
      team_space:team_spaces!inner(
        *,
        team:teams!inner(
          *,
          club:clubs(*),
          sport:sports(*)
        )
      )
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('team_space.deleted_at', null);

  if (error) {
    throw error;
  }
  return (data || []).map(mapEnrichedMembership);
}

export async function lookupInviteCode(
  code: string,
): Promise<InviteCodeResult | null> {
  const {data, error} = await supabase.rpc('lookup_invite_code', {
    code,
  });

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    displayName: data.display_name,
    color: data.color,
    clubName: data.club_name,
    sport: data.sport,
    memberCount: data.member_count,
  };
}

export async function joinTeamSpace(
  inviteCode: string,
  role: string,
): Promise<JoinResult> {
  const {data, error} = await supabase.rpc('join_team_space', {
    p_invite_code: inviteCode,
    p_role: role,
  });

  if (error) {
    throw error;
  }
  return {
    membershipId: data.membership_id,
    teamSpaceId: data.team_space_id,
    displayName: data.display_name,
  };
}

export async function activateTeamSpace(
  teamId: string,
  displayName: string,
  color: string = '#6366F1',
): Promise<ActivateResult> {
  const {data, error} = await supabase.rpc('activate_team_space', {
    p_team_id: teamId,
    p_display_name: displayName,
    p_color: color,
  });

  if (error) {
    throw error;
  }
  return {
    teamSpaceId: data.team_space_id,
    inviteCode: data.invite_code,
    membershipId: data.membership_id,
  };
}

/**
 * Endrer lagfargen. Direkte UPDATE — «Admins can update team space»-policyen
 * (00014) gjelder trener/lagleder/admin. Nekter RLS via USING får vi ingen
 * feil, bare null rader (samme felle som setMatchReporter) — derfor
 * `.select('id')` + egen throw.
 */
export async function updateTeamColor(
  teamSpaceId: string,
  color: string,
): Promise<void> {
  const {data, error} = await supabase
    .from('team_spaces')
    .update({color})
    .eq('id', teamSpaceId)
    .select('id');

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Bare trenere og lagledere kan endre lagfargen.');
  }
}

// ---------------------------------------------------------------------------
// Create-from-scratch onboarding (team-first / invite-first)
// ---------------------------------------------------------------------------

/** Klubb-autocomplete under lagopprettelse. Tom query → ingen treff. */
export async function searchClubs(query: string): Promise<ClubSearchResult[]> {
  const q = query.trim();
  if (q.length === 0) {
    return [];
  }

  const {data, error} = await supabase
    .from('clubs')
    .select('id, name')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10);

  if (error) {
    throw error;
  }
  return (data || []).map((row: any) => ({id: row.id, name: row.name}));
}

// Idretter er statisk referansedata — cache i minnet for hele app-økten,
// med dedup av samtidige kall, så CreateTeam-velgeren kan vises uten spinner.
let sportsCache: Sport[] | null = null;
let sportsInflight: Promise<Sport[]> | null = null;

/** Synkron lesing av cachede idretter (null hvis ikke lastet ennå). */
export function getCachedSports(): Sport[] | null {
  return sportsCache;
}

/** Idretts-picker. Cacher resultatet; kall den tidlig for å forhåndslaste. */
export async function getSports(): Promise<Sport[]> {
  if (sportsCache) {
    return sportsCache;
  }
  if (sportsInflight) {
    return sportsInflight;
  }
  sportsInflight = (async () => {
    try {
      const {data, error} = await supabase
        .from('sports')
        .select('id, slug, display_name')
        .order('display_name');
      if (error) {
        throw error;
      }
      sportsCache = (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
      }));
      return sportsCache;
    } finally {
      sportsInflight = null;
    }
  })();
  return sportsInflight;
}

/** Oppretter klubb (finn/opprett) + team + team_space + trener-membership i én RPC. */
export async function createTeamFromScratch(
  payload: CreateTeamPayload,
): Promise<CreateResult> {
  const {data, error} = await supabase.rpc('create_team_from_scratch', {
    p_team_name: payload.teamName,
    p_sport: payload.sport,
    p_age_group: payload.ageGroup,
    p_club_id: payload.clubId ?? null,
    p_club_name: payload.clubName ?? null,
    p_gender: payload.gender ?? null,
    p_level: payload.level ?? null,
    p_color: payload.color ?? '#6366F1',
  });

  if (error) {
    throw error;
  }
  return {
    teamSpaceId: data.team_space_id,
    inviteCode: data.invite_code,
    membershipId: data.membership_id,
  };
}
