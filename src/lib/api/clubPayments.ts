import {supabase} from '../supabase';
import {edgeMessage} from './payments';

// ---------------------------------------------------------------------------
// KLUBBDØREN (00047, PAYMENTS.md §«KLUBBDØREN») — betalingsansvarlig-flaten
// «Klubbetalinger» + lagets «Be om godkjenning». Alle vakter bor i
// databasen (RPC-ene returnerer NULL/kaster for andre); UI-et speiler bare.
// Betalingsansvarlig ser ALDRI pris — laget arver klubbens standardtilbud
// server-side ved godkjenning.
//
// Autoritetsmodellen v2 (00062/00064): oversikten er ENHETS-gruppert
// (`legal_club_entities`, ikke `clubs.id`) — én myndighetskrets per
// organisasjon uansett antall klubbrader. Payloaden er additiv, så
// `club` (kanonisk/eldste lenkede rad) står igjen for utrullede klienter.
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
  /**
   * DELFEIL-FIKSEN (00062 §11): levende abonnementer UTEN `cancel_at` på et
   * lag som ER deaktivert = Stripe-kallet nådde ikke frem for alle. Tallet
   * er veien tilbake — «Fullfør deaktiveringen» kjører samme idempotente
   * Edge-funksjon på nytt. 0 for alt annet enn deaktiverte lag.
   */
  unresolvedCancellations: number;
}

/** Aktiv eller suspendert betalingsansvarlig for enheten. */
export interface ClubPaymentManager {
  userId: string;
  name: string;
  status: 'active' | 'suspended';
  source: string | null;
  isMe: boolean;
}

/** Åpne (og nylige) invitasjoner til rollen. E-posten vises ALDRI her —
 *  den er ops-/utsteder-data, ikke noe hele manager-kretsen skal lese. */
export interface ClubPaymentInvitation {
  id: string;
  invitedName: string;
  status: 'pending' | 'awaiting_review' | 'accepted' | 'declined' | 'revoked' | 'expired';
  source: 'claim' | 'ops' | 'manager';
  /** NULL = e-posten er ikke sendt (web-landingen finnes ikke ennå). */
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ClubPaymentLogEntry {
  action: 'request' | 'approve' | 'reject' | 'pause' | 'deactivate';
  teamName: string;
  actor: string;
  note: string | null;
  affectedSubscriptions: number | null;
  createdAt: string;
}

/** Én juridisk enhet = én myndighetskrets. `club` er den kanoniske
 *  (eldste aktivt lenkede) klubbraden; `clubs` er alle sammen. */
export interface ClubPaymentsClub {
  entity: {id: string; legalName: string; orgNumber: string} | null;
  club: {id: string; name: string} | null;
  clubs: {id: string; name: string}[];
  account: {status: string; chargesEnabled: boolean} | null;
  requests: ClubPaymentRequest[];
  teams: ClubPaymentTeam[];
  managers: ClubPaymentManager[];
  invitations: ClubPaymentInvitation[];
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
    entity: raw.entity
      ? {
          id: raw.entity.id,
          legalName: raw.entity.legal_name,
          orgNumber: raw.entity.org_number,
        }
      : null,
    club: raw.club ? {id: raw.club.id, name: raw.club.name} : null,
    clubs: ((raw.clubs ?? []) as any[]).map((c) => ({id: c.id, name: c.name})),
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
      unresolvedCancellations: t.unresolved_cancellations ?? 0,
    })),
    managers: ((raw.managers ?? []) as any[]).map((m) => ({
      userId: m.user_id,
      name: m.name,
      status: m.status,
      source: m.source ?? null,
      isMe: !!m.is_me,
    })),
    invitations: ((raw.invitations ?? []) as any[]).map((i) => ({
      id: i.id,
      invitedName: i.invited_name,
      status: i.status,
      source: i.source,
      sentAt: i.sent_at ?? null,
      expiresAt: i.expires_at ?? null,
      createdAt: i.created_at,
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
 * trykke igjen (idempotent) — det er nettopp det «Fullfør deaktiveringen»
 * gjør når `unresolvedCancellations > 0`.
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
    throw new Error(
      await edgeMessage(error, 'Noe gikk galt — prøv igjen om litt.'),
    );
  }
  return {count: data?.count ?? 0};
}

// ---------------------------------------------------------------------------
// Rolleadministrasjon for betalingsansvarlige (v2, II.6) — selvbetjening i
// flaten, aldri SQL-runbook. Utfallet KOMMER SOM DATA (00064-kontrakten):
// et forsøk fra en suspendert konto er et sikkerhetsavvik som skal LOGGES og
// VARSLES, og en exception ville rullet sideeffekten tilbake.
// ---------------------------------------------------------------------------

export type IssueInvitationOutcome =
  | {outcome: 'issued'; invitationId: string}
  | {outcome: 'suspended'};

/**
 * «Inviter ny betalingsansvarlig». Varsler øvrige aktive ansvarlige; ingen
 * rutinemessig ops-e-post (B5). E-posten til den inviterte sendes først når
 * web-landingen er live (`WEB_INVITE_BASE_URL`) — til da står invitasjonen
 * med `sentAt = null` i lista, og det sier flaten fra om.
 */
export async function issueManagerInvitation(input: {
  entityId: string;
  name: string;
  email: string;
  note?: string;
}): Promise<IssueInvitationOutcome> {
  const {data, error} = await supabase.rpc('issue_manager_invitation', {
    p_entity_id: input.entityId,
    p_name: input.name,
    p_email: input.email,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  if (data?.outcome === 'issued') {
    return {outcome: 'issued', invitationId: data.invitation_id as string};
  }
  return {outcome: 'suspended'};
}
