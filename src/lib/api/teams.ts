import {supabase} from '../supabase';
import {uploadFileToBucket} from '../media/upload';
import type {
  EnrichedMembership,
  InviteCodeResult,
  JoinResult,
  ActivateResult,
  CreateTeamPayload,
  CreateResult,
  Club,
  ClubSearchResult,
  Sport,
} from '../types';

// Offentlig bucket for klubb- og laglogoer (00034). Offentlig fordi en logo
// ikke er persondata, og signerte URL-er utløper — headeren og klubbsøket
// trenger stabile URL-er.
export const CLUB_LOGOS_BUCKET = 'club-logos';

/** Bilde fra logo-pickeren, klart for opplasting (PickedImage passer). */
export interface LogoImageInput {
  /** Lokal fil-URI til 512-masteren fra logo-pickeren. */
  fileUri: string;
  mimeType: string;
  fileName: string;
}

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
        logoUrl: t.club.logo_url,
      },
      sport: {
        id: t.sport.id,
        slug: t.sport.slug,
        displayName: t.sport.display_name,
      },
    },
  };
}

/**
 * `userId` kommer fra kalleren (TeamContext eier sesjonen — P5): dette er
 * boot-kjedens tyngste kall, og RLS på memberships gjelder uansett —
 * `.eq` er korrekthets-, ikke sikkerhetsfilter.
 */
export async function getUserMemberships(
  userId: string,
): Promise<EnrichedMembership[]> {
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
    .eq('user_id', userId)
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
    // Eldre bygg mot ny DB (og omvendt) skal ikke krasje: feltet kom i 00050.
    logoUrl: data.logo_url ?? null,
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
 * Antall aktive medlemskap i lagrommet — samme telling som lookup_invite_code
 * (memberships-rader, ikke unike personer). Head-request: ingen rader over
 * nettet. RLS teller kun rader man selv kan se, så kall den bare for lag man
 * er medlem i — ellers blir svaret 0, ikke en feil.
 */
export async function getTeamMemberCount(teamSpaceId: string): Promise<number> {
  const {count, error} = await supabase
    .from('memberships')
    .select('id', {count: 'exact', head: true})
    .eq('team_space_id', teamSpaceId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }
  return count ?? 0;
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
// Logoer (P4) — klubblogo (write-once via RPC) + laglogo (fri override)
// ---------------------------------------------------------------------------

/**
 * Laster opp en logo og returnerer offentlig URL. Nytt filnavn per opplasting
 * (timestamp): RN-Image cacher per URL, så en byttet logo MÅ få ny URL for å
 * vises uten app-restart. Første path-segment er det storage-policyene gates
 * på (club_id eller team_space_id).
 */
async function uploadLogo(
  folderId: string,
  image: LogoImageInput,
): Promise<string> {
  const ext = image.fileName.includes('.')
    ? image.fileName.split('.').pop()
    : 'jpg';
  const path = `${folderId}/logo-${Date.now()}.${ext}`;

  // 1 år (P1): filnavnet er unikt per opplasting (immutable), og bucketen
  // er public — dette er den ene flaten der CDN-en skal få jobbe. Uten
  // den revalideres hver logo hver time (F3, hovedkilde til cached
  // egress).
  await uploadFileToBucket({
    bucket: CLUB_LOGOS_BUCKET,
    path,
    fileUri: image.fileUri,
    contentType: image.mimeType,
    cacheControlS: 31536000,
  });
  return supabase.storage.from(CLUB_LOGOS_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * Legger til klubblogoen — write-once (LÅST modell): RPC-en nekter når
 * klubben allerede har en. Feiler DB-skrivingen står filen igjen i bucketen —
 * ufarlig (aldri referert) og samme aksepterte v1-hull som feed-bildene.
 */
export async function setClubLogo(
  clubId: string,
  image: LogoImageInput,
): Promise<void> {
  const url = await uploadLogo(clubId, image);
  const {error} = await supabase.rpc('set_club_logo', {
    p_club_id: clubId,
    p_url: url,
  });
  if (error) {
    throw error;
  }
}

/**
 * Setter/bytter/fjerner lagets egen logo (override over klubblogoen).
 * `image: null` = fjern. Samme RLS-mønster som updateTeamColor
 * (`.select('id')`-vakta). Den gamle filen ryddes best-effort — feiler
 * slettingen står den bare ubrukt igjen.
 */
export async function updateTeamLogo(
  teamSpaceId: string,
  image: LogoImageInput | null,
  previousUrl?: string | null,
): Promise<void> {
  const url = image ? await uploadLogo(teamSpaceId, image) : null;

  const {data, error} = await supabase
    .from('team_spaces')
    .update({logo_url: url})
    .eq('id', teamSpaceId)
    .select('id');

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Bare trenere og lagledere kan endre laglogoen.');
  }

  const oldPath = previousUrl?.split(`/${CLUB_LOGOS_BUCKET}/`)[1];
  if (oldPath) {
    supabase.storage
      .from(CLUB_LOGOS_BUCKET)
      .remove([oldPath])
      .catch(() => {});
  }
}

/**
 * Endrer lagnavnet (team_spaces.display_name — visningsnavnet overalt i
 * appen). Samme policy og `.select('id')`-vakt som updateTeamColor.
 */
export async function updateTeamName(
  teamSpaceId: string,
  displayName: string,
): Promise<void> {
  const {data, error} = await supabase
    .from('team_spaces')
    .update({display_name: displayName})
    .eq('id', teamSpaceId)
    .select('id');

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Bare trenere og lagledere kan endre lagnavnet.');
  }
}

/** Klubben et lagrom hører til — for logo-flyten når context ikke er fersk. */
export async function getClubForTeamSpace(
  teamSpaceId: string,
): Promise<Club | null> {
  const {data, error} = await supabase
    .from('team_spaces')
    .select('team:teams!inner(club:clubs(id, name, short_name, logo_url))')
    .eq('id', teamSpaceId)
    .single();

  if (error) {
    throw error;
  }
  const club = (data as any)?.team?.club;
  if (!club) {
    return null;
  }
  return {
    id: club.id,
    name: club.name,
    shortName: club.short_name,
    logoUrl: club.logo_url,
  };
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
    .select('id, name, logo_url')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10);

  if (error) {
    throw error;
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
  }));
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
