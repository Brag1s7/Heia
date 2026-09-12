import {supabase} from './supabase';

// ---------------------------------------------------------------------------
// Web-API-laget — en port av appens src/lib/api/{clubPayments,ops,payments}.ts.
// Samme RPC-er, samme Edge Functions, samme vakter: alt er gatet i databasen
// (RPC-ene returnerer NULL/kaster for alle uten rolle), UI-et speiler bare.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ApiError extends Error {}

function rpcError(error: {message?: string} | null): never {
  const msg = error?.message ?? 'Noe gikk galt — prøv igjen om litt.';
  throw new ApiError(msg);
}

// Edge Functions svarer {error: 'norsk melding'} på 4xx/5xx.
async function edgeMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as {context?: Response}).context;
    if (ctx) {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // behold standardmeldingen
  }
  return fallback;
}

// ── Roller ─────────────────────────────────────────────────────────────────

export async function isOpsAdmin(): Promise<boolean> {
  const {data, error} = await supabase.rpc('is_ops_admin');
  if (error) return false;
  return !!data;
}

export async function isPaymentManager(): Promise<boolean> {
  const {data, error} = await supabase.rpc('is_payment_manager_anywhere');
  if (error) return false;
  return !!data;
}

// ── Invitasjon (B-1) ────────────────────────────────────────────────────────

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'awaiting_review'
  | 'declined'
  | 'revoked'
  | 'expired';

export interface InvitationPreview {
  found: boolean;
  status: InvitationStatus | null;
  expired: boolean;
  expiresAt: string | null;
  legalName: string | null;
  orgNumber: string | null;
  invitedName: string | null;
  invitedEmailMasked: string | null;
  accountEmail: string | null;
  emailVerified: boolean;
  emailMatches: boolean;
  source: 'claim' | 'ops' | 'manager' | null;
}

/** Lesende forhåndsvisning (00082) — ingen sideeffekter, aldri aksept. */
export async function peekInvitation(token: string): Promise<InvitationPreview> {
  const {data, error} = await supabase.rpc('peek_manager_invitation', {
    p_token: token,
  });
  if (error) rpcError(error);
  return {
    found: !!data?.found,
    status: data?.status ?? null,
    expired: !!data?.expired,
    expiresAt: data?.expires_at ?? null,
    legalName: data?.legal_name ?? null,
    orgNumber: data?.org_number ?? null,
    invitedName: data?.invited_name ?? null,
    invitedEmailMasked: data?.invited_email_masked ?? null,
    accountEmail: data?.account_email ?? null,
    emailVerified: !!data?.email_verified,
    emailMatches: !!data?.email_matches,
    source: data?.source ?? null,
  };
}

export type RedeemOutcome =
  | 'accepted'
  | 'awaiting_review'
  | 'invalid'
  | 'expired'
  | 'suspended';

/** Eksplisitt aksept (00064-kontrakten: utfall som data). */
export async function redeemInvitation(
  token: string,
): Promise<{outcome: RedeemOutcome; legalName: string | null}> {
  const {data, error} = await supabase.rpc('redeem_manager_invitation', {
    p_token: token,
  });
  if (error) rpcError(error);
  return {
    outcome: (data?.outcome ?? 'invalid') as RedeemOutcome,
    legalName: data?.legal_name ?? null,
  };
}

export async function declineInvitation(
  token: string,
  note?: string,
): Promise<'declined' | 'invalid'> {
  const {data, error} = await supabase.rpc('decline_manager_invitation', {
    p_token: token,
    p_note: note ?? null,
  });
  if (error) rpcError(error);
  return (data?.outcome ?? 'declined') as 'declined' | 'invalid';
}

// ── Klubbetalinger (betalingsansvarlig) ─────────────────────────────────────

export type TeamSupportState = 'collecting' | 'pending' | 'paused' | 'deactivated' | 'none';

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
  unresolvedCancellations: number;
  dormantAt: string | null;
}

export interface ClubPaymentManager {
  userId: string;
  name: string;
  status: 'active' | 'suspended';
  source: string | null;
  isMe: boolean;
}

export interface ClubPaymentInvitation {
  id: string;
  invitedName: string;
  status: InvitationStatus;
  source: 'claim' | 'ops' | 'manager';
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

function mapClub(raw: any): ClubPaymentsClub {
  return {
    entity: raw.entity
      ? {id: raw.entity.id, legalName: raw.entity.legal_name, orgNumber: raw.entity.org_number}
      : null,
    club: raw.club ? {id: raw.club.id, name: raw.club.name} : null,
    clubs: ((raw.clubs ?? []) as any[]).map((c) => ({id: c.id, name: c.name})),
    account: raw.account
      ? {status: raw.account.status, chargesEnabled: !!raw.account.charges_enabled}
      : null,
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
    teams: ((raw.teams ?? []) as any[]).map((t) => ({
      teamSpaceId: t.team_space_id,
      teamName: t.team_name,
      ageGroup: t.age_group ?? null,
      state: t.state as TeamSupportState,
      liveSubscriptions: t.live_subscriptions ?? 0,
      unresolvedCancellations: t.unresolved_cancellations ?? 0,
      dormantAt: t.dormant_at ?? null,
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

/** NULL for ikke-ansvarlige (probe-vernet). */
export async function getClubPaymentsOverview(): Promise<ClubPaymentsClub[] | null> {
  const {data, error} = await supabase.rpc('get_club_payments_overview');
  if (error) rpcError(error);
  if (!data) return null;
  return (data as any[]).map(mapClub);
}

export async function approveTeamSupport(approvalId: string): Promise<void> {
  const {error} = await supabase.rpc('approve_team_support', {p_approval_id: approvalId});
  if (error) rpcError(error);
}

export async function rejectTeamSupport(approvalId: string, note: string): Promise<void> {
  const {error} = await supabase.rpc('reject_team_support', {p_approval_id: approvalId, p_note: note});
  if (error) rpcError(error);
}

export async function pauseTeamSupport(teamSpaceId: string, note?: string): Promise<{liveSubscriptions: number}> {
  const {data, error} = await supabase.rpc('pause_team_support', {ts_id: teamSpaceId, p_note: note ?? null});
  if (error) rpcError(error);
  return {liveSubscriptions: data?.live_subscriptions ?? 0};
}

export async function deactivateTeamSupport(teamSpaceId: string, note?: string): Promise<{count: number}> {
  const {data, error} = await supabase.functions.invoke('club-support-deactivate', {
    body: {team_space_id: teamSpaceId, note: note ?? null},
  });
  if (error) throw new ApiError(await edgeMessage(error, 'Noe gikk galt — prøv igjen om litt.'));
  return {count: data?.count ?? 0};
}

export type IssueInvitationOutcome =
  | {outcome: 'issued'; invitationId: string}
  | {outcome: 'suspended'};

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
  if (error) rpcError(error);
  if (data?.outcome === 'issued') return {outcome: 'issued', invitationId: data.invitation_id};
  return {outcome: 'suspended'};
}

/**
 * Fersk Stripe Account Link (kortlevd). Gaten i `stripe-onboarding` er
 * aktiv betalingsansvarlig for enheten (+ ops). `source: 'web'` gir en
 * retur til /betaling som sier «gå tilbake til fanen», ikke «til appen».
 */
export async function startStripeOnboarding(
  target: {teamSpaceId: string} | {entityId: string},
): Promise<{url: string}> {
  // Funksjonen tar begge veier: laget (som appen bruker) eller enheten
  // direkte. Web kjenner enheten, så en klubb UTEN lag i Heia kan sette
  // opp utbetaling på forhånd i stedet for å møte en vegg.
  const body =
    'teamSpaceId' in target
      ? {team_space_id: target.teamSpaceId, source: 'web'}
      : {entity_id: target.entityId, source: 'web'};
  const {data, error} = await supabase.functions.invoke('stripe-onboarding', {body});
  if (error) throw new ApiError(await edgeMessage(error, 'Kunne ikke hente onboarding-lenke.'));
  if (!data?.url) throw new ApiError('Fikk ingen onboarding-lenke — prøv igjen om litt.');
  return {url: data.url};
}

// ── Heia Ops ────────────────────────────────────────────────────────────────

export interface BrregRolle {
  rolle: string;
  navn: string;
  matchSoker: boolean;
  matchNominert: boolean;
}

export interface BrregSnapshot {
  fetchedAt: string | null;
  notFound: boolean;
  unreachable: boolean;
  enhet: {
    navn: string;
    orgformKode: string;
    orgformTekst: string;
    slettedato: string | null;
    konkurs: boolean;
    underAvvikling: boolean;
    epostadresse: string | null;
    telefon: string | null;
  } | null;
  roller: BrregRolle[];
  checks: {
    navnMatch: boolean;
    sokerIRegisteret: boolean;
    nomineeIsSelf: boolean;
    nominertIRegisteret: boolean;
  } | null;
}

export type OpsClaimStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'expired';

export interface OpsClaimAuditEntry {
  action: 'approve' | 'reject' | 'request_info';
  note: string;
  actor: string | null;
  createdAt: string;
}

export interface OpsClaim {
  id: string;
  status: OpsClaimStatus;
  createdAt: string;
  club: {id: string; name: string} | null;
  orgNumber: string;
  legalName: string;
  claimedRole: string;
  contactEmail: string | null;
  contactPhone: string | null;
  claimant: {id: string; displayName: string} | null;
  nomineeIsSelf: boolean;
  nomineeName: string | null;
  nomineeEmail: string | null;
  nomineePhone: string | null;
  brreg: BrregSnapshot | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  infoRequestNote: string | null;
  clubAlreadyLinked: boolean;
  existingEntity: {legalName: string; verificationStatus: string} | null;
  audit: OpsClaimAuditEntry[];
}

function mapSnapshot(raw: any): BrregSnapshot | null {
  if (!raw) return null;
  return {
    fetchedAt: raw.fetched_at ?? null,
    notFound: !!raw.not_found,
    unreachable: raw.error === 'brreg_unreachable',
    enhet: raw.enhet
      ? {
          navn: raw.enhet.navn ?? '',
          orgformKode: raw.enhet.organisasjonsform?.kode ?? '?',
          orgformTekst: raw.enhet.organisasjonsform?.beskrivelse ?? '',
          slettedato: raw.enhet.slettedato ?? null,
          konkurs: !!raw.enhet.konkurs,
          underAvvikling: !!raw.enhet.underAvvikling,
          epostadresse: raw.enhet.epostadresse ?? null,
          telefon: raw.enhet.telefon ?? null,
        }
      : null,
    roller: ((raw.roller ?? []) as any[]).map((r) => ({
      rolle: r.rolle ?? 'Rolle',
      navn: r.navn ?? '',
      matchSoker: !!r.match_soker,
      matchNominert: !!r.match_nominert,
    })),
    checks: raw.checks
      ? {
          navnMatch: !!raw.checks.navn_match,
          sokerIRegisteret: !!raw.checks.soker_i_registeret,
          nomineeIsSelf: raw.checks.nominee_is_self !== false,
          nominertIRegisteret: !!raw.checks.nominert_i_registeret,
        }
      : null,
  };
}

function mapClaim(raw: any): OpsClaim {
  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.created_at,
    club: raw.club ? {id: raw.club.id, name: raw.club.name} : null,
    orgNumber: raw.org_number,
    legalName: raw.legal_name,
    claimedRole: raw.claimed_role,
    contactEmail: raw.contact_email ?? null,
    contactPhone: raw.contact_phone ?? null,
    claimant: raw.claimant ? {id: raw.claimant.id, displayName: raw.claimant.display_name} : null,
    nomineeIsSelf: raw.nominee_is_self !== false,
    nomineeName: raw.nominee_name ?? null,
    nomineeEmail: raw.nominee_email ?? null,
    nomineePhone: raw.nominee_phone ?? null,
    brreg: mapSnapshot(raw.brreg_snapshot),
    reviewNote: raw.review_note ?? null,
    reviewedAt: raw.reviewed_at ?? null,
    infoRequestNote: raw.info_request_note ?? null,
    clubAlreadyLinked: !!raw.club_already_linked,
    existingEntity: raw.existing_entity
      ? {legalName: raw.existing_entity.legal_name, verificationStatus: raw.existing_entity.verification_status}
      : null,
    audit: ((raw.audit ?? []) as any[]).map((a) => ({
      action: a.action,
      note: a.note,
      actor: a.actor ?? null,
      createdAt: a.created_at,
    })),
  };
}

/** NULL for ikke-ops (probe-vernet). */
export async function listOpsClaims(): Promise<OpsClaim[] | null> {
  const {data, error} = await supabase.rpc('ops_list_club_claims');
  if (error) rpcError(error);
  if (!data) return null;
  return (data as any[]).map(mapClaim);
}

export async function getOpsClaim(claimId: string): Promise<OpsClaim | null> {
  const {data, error} = await supabase.rpc('ops_get_club_claim', {p_claim_id: claimId});
  if (error) rpcError(error);
  return data ? mapClaim(data) : null;
}

export interface OpsApproveOutcome {
  claimId: string;
  legalEntityId: string;
  entityReused: boolean;
  accountStatus: string | null;
  grantedManager: boolean;
  invitationId: string | null;
}

export async function opsApproveClaim(claimId: string, authorizationNote: string): Promise<OpsApproveOutcome> {
  const {data, error} = await supabase.rpc('ops_approve_club_claim', {
    p_claim_id: claimId,
    p_authorization_note: authorizationNote,
  });
  if (error) rpcError(error);
  return {
    claimId: data?.claim_id ?? claimId,
    legalEntityId: data?.legal_entity_id,
    entityReused: !!data?.entity_reused,
    accountStatus: data?.account_status ?? null,
    grantedManager: !!data?.granted_manager,
    invitationId: data?.invitation_id ?? null,
  };
}

export async function opsRejectClaim(claimId: string, note: string): Promise<void> {
  const {error} = await supabase.rpc('ops_reject_club_claim', {p_claim_id: claimId, p_note: note});
  if (error) rpcError(error);
}

export async function opsRequestClaimInfo(claimId: string, message: string): Promise<void> {
  const {error} = await supabase.rpc('ops_request_claim_info', {p_claim_id: claimId, p_message: message});
  if (error) rpcError(error);
}

export interface OpsEntityManager {
  userId: string;
  name: string;
  status: 'active' | 'suspended';
  source: string | null;
  createdAt: string;
}

export interface OpsEntityInvitation {
  id: string;
  invitedName: string;
  invitedEmail: string;
  status: InvitationStatus;
  source: 'claim' | 'ops' | 'manager';
  sentAt: string | null;
  remindedAt: string | null;
  expiresAt: string | null;
  acceptedByName: string | null;
  mismatch: {
    accountEmail: string | null;
    invitedEmail: string | null;
    profileName: string | null;
    invitedName: string | null;
    nameMatch: boolean;
  } | null;
  note: string | null;
  createdAt: string;
}

export interface OpsAuthorityEvent {
  event: string;
  subject: string | null;
  actor: string | null;
  note: string | null;
  createdAt: string;
}

export interface OpsPaymentEntity {
  entity: {id: string; legalName: string; orgNumber: string; verificationStatus: string};
  account: {status: string; chargesEnabled: boolean} | null;
  clubs: {id: string; name: string}[];
  managers: OpsEntityManager[];
  invitations: OpsEntityInvitation[];
  events: OpsAuthorityEvent[];
}

function mapEntity(raw: any): OpsPaymentEntity {
  return {
    entity: {
      id: raw.entity.id,
      legalName: raw.entity.legal_name,
      orgNumber: raw.entity.org_number,
      verificationStatus: raw.entity.verification_status,
    },
    account: raw.account ? {status: raw.account.status, chargesEnabled: !!raw.account.charges_enabled} : null,
    clubs: ((raw.clubs ?? []) as any[]).map((c) => ({id: c.id, name: c.name})),
    managers: ((raw.managers ?? []) as any[]).map((m) => ({
      userId: m.user_id,
      name: m.name,
      status: m.status,
      source: m.source ?? null,
      createdAt: m.created_at,
    })),
    invitations: ((raw.invitations ?? []) as any[]).map((i) => ({
      id: i.id,
      invitedName: i.invited_name,
      invitedEmail: i.invited_email,
      status: i.status,
      source: i.source,
      sentAt: i.sent_at ?? null,
      remindedAt: i.reminded_at ?? null,
      expiresAt: i.expires_at ?? null,
      acceptedByName: i.accepted_by_name ?? null,
      mismatch: i.mismatch
        ? {
            accountEmail: i.mismatch.account_email ?? null,
            invitedEmail: i.mismatch.invited_email ?? null,
            profileName: i.mismatch.profile_name ?? null,
            invitedName: i.mismatch.invited_name ?? null,
            nameMatch: !!i.mismatch.name_match,
          }
        : null,
      note: i.note ?? null,
      createdAt: i.created_at,
    })),
    events: ((raw.events ?? []) as any[]).map((e) => ({
      event: e.event,
      subject: e.subject ?? null,
      actor: e.actor ?? null,
      note: e.note ?? null,
      createdAt: e.created_at,
    })),
  };
}

export async function opsListPaymentEntities(): Promise<OpsPaymentEntity[] | null> {
  const {data, error} = await supabase.rpc('ops_list_payment_entities');
  if (error) rpcError(error);
  if (!data) return null;
  return (data as any[]).map(mapEntity);
}

export async function opsIssueManagerInvitation(input: {entityId: string; name: string; email: string; note: string}): Promise<string> {
  const {data, error} = await supabase.rpc('ops_issue_manager_invitation', {
    p_entity_id: input.entityId,
    p_name: input.name,
    p_email: input.email,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as string;
}

async function opsVoid(fn: string, args: Record<string, unknown>): Promise<void> {
  const {error} = await supabase.rpc(fn, args);
  if (error) rpcError(error);
}

export const opsRevokeManagerInvitation = (invitationId: string, note: string) =>
  opsVoid('ops_revoke_manager_invitation', {p_invitation_id: invitationId, p_note: note});
export const opsConfirmInvitationReview = (invitationId: string, note: string) =>
  opsVoid('ops_confirm_invitation_review', {p_invitation_id: invitationId, p_note: note});
export const opsRejectInvitationReview = (invitationId: string, note: string) =>
  opsVoid('ops_reject_invitation_review', {p_invitation_id: invitationId, p_note: note});
export const opsSuspendManager = (entityId: string, userId: string, note: string) =>
  opsVoid('ops_suspend_manager', {p_entity_id: entityId, p_user_id: userId, p_note: note});
export const opsReactivateManager = (entityId: string, userId: string, note: string) =>
  opsVoid('ops_reactivate_manager', {p_entity_id: entityId, p_user_id: userId, p_note: note});
export const opsRemoveManager = (entityId: string, userId: string, note: string) =>
  opsVoid('ops_remove_manager', {p_entity_id: entityId, p_user_id: userId, p_note: note});
export const opsMoveTeamToClub = (teamId: string, targetClubId: string, note: string) =>
  opsVoid('ops_move_team_to_club', {p_team_id: teamId, p_target_club_id: targetClubId, p_note: note});

export interface OpsClubTeam {
  teamId: string;
  name: string;
  ageGroup: string | null;
  clubId: string;
}

/** `teams` er lesbar for innloggede (00005) — grunnlaget for «Flytt lag». */
export async function opsListTeamsForClubs(clubIds: string[]): Promise<OpsClubTeam[]> {
  if (clubIds.length === 0) return [];
  const {data, error} = await supabase
    .from('teams')
    .select('id, name, age_group, club_id')
    .in('club_id', clubIds)
    .order('name');
  if (error) rpcError(error);
  return (data ?? []).map((t: any) => ({
    teamId: t.id,
    name: t.name,
    ageGroup: t.age_group ?? null,
    clubId: t.club_id,
  }));
}

// ── Formatering ─────────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('nb-NO', {day: 'numeric', month: 'short', year: 'numeric'});
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('nb-NO', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
}
