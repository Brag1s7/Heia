import {supabase} from '../supabase';

// ---------------------------------------------------------------------------
// KLUBBDØREN (00047, PAYMENTS.md §«KLUBBDØREN») — betalingsansvarlig-flaten
// «Klubbbetalinger» + lagets «Be om godkjenning». Alle vakter bor i
// databasen (RPC-ene returnerer NULL/kaster for andre); UI-et speiler bare.
// Betalingsansvarlig ser ALDRI pris — laget arver klubbens standardtilbud
// server-side ved godkjenning.
// ---------------------------------------------------------------------------

export type TeamSupportState =
  | 'collecting'
  | 'pending'
  | 'paused'
  | 'deactivated'
  | 'none';

export interface ClubPaymentRequest {
  id: string;
  teamSpaceId: string;
  teamName: string;
  ageGroup: string | null;
  gender: string | null;
  memberCount: number;
  requestedBy: string;
  requestedAt: string;
}

export interface ClubPaymentTeam {
  teamSpaceId: string;
  teamName: string;
  ageGroup: string | null;
  state: TeamSupportState;
  liveSubscriptions: number;
}

export interface ClubPaymentLogEntry {
  action: 'request' | 'approve' | 'reject' | 'pause' | 'deactivate';
  teamName: string;
  actor: string;
  note: string | null;
  affectedSubscriptions: number | null;
  createdAt: string;
}

export interface ClubPaymentsClub {
  club: {id: string; name: string};
  entity: {legalName: string; orgNumber: string} | null;
  account: {status: string; chargesEnabled: boolean} | null;
  requests: ClubPaymentRequest[];
  teams: ClubPaymentTeam[];
  log: ClubPaymentLogEntry[];
}

/** Billig «er jeg betalingsansvarlig et sted?» for Profil-raden.
 *  Cache per sesjon i modulen — samme mønster som isOpsAdmin. */
let managerCache: boolean | null = null;

export async function isPaymentManager(): Promise<boolean> {
  if (managerCache !== null) return managerCache;
  const {data, error} = await supabase.rpc('is_payment_manager_anywhere');
  if (error) return false;
  managerCache = !!data;
  return managerCache;
}

export function clearPaymentManagerCache(): void {
  managerCache = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClub(raw: any): ClubPaymentsClub {
  return {
    club: {id: raw.club.id, name: raw.club.name},
    entity: raw.entity
      ? {legalName: raw.entity.legal_name, orgNumber: raw.entity.org_number}
      : null,
    account: raw.account
      ? {
          status: raw.account.status,
          chargesEnabled: !!raw.account.charges_enabled,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requests: ((raw.requests ?? []) as any[]).map((r) => ({
      id: r.id,
      teamSpaceId: r.team_space_id,
      teamName: r.team_name,
      ageGroup: r.age_group ?? null,
      gender: r.gender ?? null,
      memberCount: r.member_count ?? 0,
      requestedBy: r.requested_by,
      requestedAt: r.requested_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teams: ((raw.teams ?? []) as any[]).map((t) => ({
      teamSpaceId: t.team_space_id,
      teamName: t.team_name,
      ageGroup: t.age_group ?? null,
      state: t.state as TeamSupportState,
      liveSubscriptions: t.live_subscriptions ?? 0,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log: ((raw.log ?? []) as any[]).map((l) => ({
      action: l.action,
      teamName: l.team_name,
      actor: l.actor,
      note: l.note ?? null,
      affectedSubscriptions: l.affected_subscriptions ?? null,
      createdAt: l.created_at,
    })),
  };
}

/** NULL for ikke-ansvarlige (probe-vernet) — skjermen viser da ingenting. */
export async function getClubPaymentsOverview(): Promise<
  ClubPaymentsClub[] | null
> {
  const {data, error} = await supabase.rpc('get_club_payments_overview');
  if (error) throw error;
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(mapClub);
}

/** Lagadmin ber om godkjenning — ingenting nytt å fylle ut. */
export async function requestTeamSupportApproval(
  teamSpaceId: string,
): Promise<void> {
  const {error} = await supabase.rpc('request_team_support_approval', {
    ts_id: teamSpaceId,
  });
  if (error) throw error;
}

/** Ett trykk «Godkjenn» — laget arver klubbens standardtilbud server-side. */
export async function approveTeamSupport(approvalId: string): Promise<void> {
  const {error} = await supabase.rpc('approve_team_support', {
    p_approval_id: approvalId,
  });
  if (error) throw error;
}

/** Avslag KREVER begrunnelse — treneren ser den i appen. */
export async function rejectTeamSupport(
  approvalId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('reject_team_support', {
    p_approval_id: approvalId,
    p_note: note,
  });
  if (error) throw error;
}

/** «Pause nye støttespillere» — eksisterende abonnementer fortsetter. */
export async function pauseTeamSupport(
  teamSpaceId: string,
  note?: string,
): Promise<{liveSubscriptions: number}> {
  const {data, error} = await supabase.rpc('pause_team_support', {
    ts_id: teamSpaceId,
    p_note: note ?? null,
  });
  if (error) throw error;
  return {liveSubscriptions: data?.live_subscriptions ?? 0};
}

/**
 * «Deaktiver støtte for laget» — nye stoppes + eksisterende settes til
 * kansellering ved periodeslutt (Stripe-kall i Edge Function). Ingen
 * refusjon av betalt periode. Feiler noen Stripe-kall er det trygt å
 * trykke igjen (idempotent).
 */
export async function deactivateTeamSupport(
  teamSpaceId: string,
  note?: string,
): Promise<{count: number}> {
  const {data, error} = await supabase.functions.invoke(
    'club-support-deactivate',
    {body: {team_space_id: teamSpaceId, note: note ?? null}},
  );
  if (error) {
    let message = 'Noe gikk galt — prøv igjen om litt.';
    try {
      const ctx = (error as {context?: Response}).context;
      if (ctx) {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // behold standardmeldingen
    }
    throw new Error(message);
  }
  return {count: data?.count ?? 0};
}
