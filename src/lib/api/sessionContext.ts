import {supabase} from '../supabase';
// Direkte fil-importer (ikke api-barrelen) — samme sirkelvern som
// liveMatch.ts/eventDetail.ts.
import {mapProfile} from './profile';
import {mapEnrichedMembership} from './teams';
import {mapLiveMatchRow} from './events';
import {sanitizeRuntimeFlags, type RuntimeFlags} from '../runtimeConfig';
import type {EnrichedMembership, Profile} from '../types';
import type {HeiaEvent} from '../../shared/types';
import type {TeamSupportSummary} from './payments';

/**
 * BOOT-/RESUME-KONTEKSTEN (S2, skaleringsplan §1.4) — det ENE kallet som
 * erstatter viften profil + memberships + membercount + unread + livekamp +
 * lagkassa ved kaldstart og foreground-resume.
 *
 * RPC-en (00079) former hver del NØYAKTIG som PostgREST-svaret de gamle
 * enkeltkallene fikk, så mappingen her er de SAMME funksjonene skjermene
 * alltid har brukt (mapProfile, mapEnrichedMembership, mapLiveMatchRow) —
 * ingen parallell tolkning som kan drifte.
 *
 * `coveredTeamSpaceId` er lagets id NÅR de lag-scopede feltene gjelder det
 * laget kalleren ba om — null betyr «RPC-en dekket ikke laget» (ingen
 * kandidat, eller kandidaten er ikke lenger et medlemskap), og da henter
 * konsumentene de feltene selv med dagens enkeltkall. Feed/events er BEVISST
 * ikke med (mega-RPC-en er forkastet) — de avfyres parallelt ved boot.
 */

export interface SessionContext {
  profile: Profile | null;
  memberships: EnrichedMembership[];
  /** Laget de fire feltene under gjelder — null = ikke dekket, hent selv. */
  coveredTeamSpaceId: string | null;
  memberCount: number | null;
  unreadCount: number | null;
  liveMatch: HeiaEvent | null;
  supportSummary: TeamSupportSummary | null;
  runtimeFlags: RuntimeFlags;
}

function mapSupportSummary(raw: any): TeamSupportSummary | null {
  if (!raw) {
    return null;
  }
  // Samme mapping som getTeamSupportSummary — payloaden ER 00040-jsonb-en.
  return {
    supporters: raw.supporters,
    monthlyToClubMinor: raw.monthly_to_club_minor,
    totalToClubMinor: raw.total_to_club_minor,
    currency: raw.currency,
    since: raw.since ?? null,
  };
}

/**
 * Ett kall, hele konteksten. Kaster ved nettverks-/RPC-feil (inkl. base uten
 * 00079) — fallback-ansvaret ligger hos orkestratoren i queries-laget, som
 * svarer null til konsumentene så de tar sine gamle enkeltkall.
 */
export async function getSessionContext(
  teamSpaceId: string | null,
): Promise<SessionContext> {
  const {data, error} = await supabase.rpc('get_session_context', {
    p_team_space_id: teamSpaceId,
  });

  if (error) {
    throw error;
  }

  const covered =
    typeof data?.team_space_id === 'string' ? data.team_space_id : null;

  return {
    profile: data?.profile ? mapProfile(data.profile) : null,
    memberships: Array.isArray(data?.memberships)
      ? data.memberships.map(mapEnrichedMembership)
      : [],
    coveredTeamSpaceId: covered,
    memberCount:
      covered && typeof data?.member_count === 'number'
        ? data.member_count
        : null,
    unreadCount:
      covered && typeof data?.unread_count === 'number'
        ? data.unread_count
        : null,
    // null er et EKTE svar når laget er dekket: «ingen pågående kamp».
    liveMatch:
      covered && data?.live_match
        ? mapLiveMatchRow(data.live_match, covered)
        : null,
    supportSummary: covered ? mapSupportSummary(data?.support_summary) : null,
    // Alltid komplette flagg — søppel/mangler feiler til dagens atferd.
    runtimeFlags: sanitizeRuntimeFlags(data?.runtime_flags),
  };
}
