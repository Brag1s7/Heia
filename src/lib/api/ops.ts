import {supabase} from '../supabase';

// ---------------------------------------------------------------------------
// «Heia Ops» — intern klubbsøknad-flate (00046). Alle kall er selv-gatet på
// ops_admins i databasen: RPC-ene returnerer NULL/kaster for alle andre, så
// UI-et speiler bare vaktene. Ingen direkte klientskriving finnes — claims
// har deny-by-default RLS, og handlingene går gjennom audit-loggede RPC-er.
// ---------------------------------------------------------------------------

export interface BrregRolle {
  rolle: string;
  navn: string;
  matchSoker: boolean;
  /** Treff på den NOMINERTE (◆ i claim-notify-beviset). */
  matchNominert: boolean;
}

export interface BrregSnapshot {
  fetchedAt: string | null;
  notFound: boolean;
  unreachable: boolean;
  /** Autoritetsmodellen v2: hvem skal FÅ myndigheten? `nomineeIsSelf`
   *  false = søkeren peker på en annen, og DET er personen som skal
   *  verifiseres mot styret (claim-notify markerer treff med ◆). */
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

/** `expired` er FJERNET fra CHECK-en i 00062 (ble aldri satt) — den står
 *  her kun så historiske rader og eldre payloads ikke krasjer kartleggingen. */
export type OpsClaimStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

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
  /** Nominasjonen (00067 — A2-avviket tettet): hvem søkeren peker på som
   *  betalingsansvarlig. `nomineeIsSelf` true = søkeren selv; false = navn,
   *  e-post og ev. telefon står her (før 00067 fantes de kun i e-posten). */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // Eldre snapshots (før 00062) mangler nominee-feltene — da er
          // selv-nominasjon riktig tolkning: modellen fantes ikke ennå.
          nomineeIsSelf: raw.checks.nominee_is_self !== false,
          nominertIRegisteret: !!raw.checks.nominert_i_registeret,
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    claimant: raw.claimant
      ? {id: raw.claimant.id, displayName: raw.claimant.display_name}
      : null,
    // Eldre payloads (før 00067) mangler feltet → selv-nominasjon.
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
      ? {
          legalName: raw.existing_entity.legal_name,
          verificationStatus: raw.existing_entity.verification_status,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audit: ((raw.audit ?? []) as any[]).map((a) => ({
      action: a.action,
      note: a.note,
      actor: a.actor ?? null,
      createdAt: a.created_at,
    })),
  };
}

/** Billig «er jeg ops?» for Profil-raden. Cache per sesjon i modulen. */
let opsAdminCache: boolean | null = null;

export async function isOpsAdmin(): Promise<boolean> {
  if (opsAdminCache !== null) return opsAdminCache;
  const {data, error} = await supabase.rpc('is_ops_admin');
  if (error) return false;
  opsAdminCache = !!data;
  return opsAdminCache;
}

export function clearOpsAdminCache(): void {
  opsAdminCache = null;
}

/** NULL for ikke-ops (probe-vernet) — skjermen viser da ingenting. */
export async function listOpsClaims(): Promise<OpsClaim[] | null> {
  const {data, error} = await supabase.rpc('ops_list_club_claims');
  if (error) throw error;
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(mapClaim);
}

export async function getOpsClaim(claimId: string): Promise<OpsClaim | null> {
  const {data, error} = await supabase.rpc('ops_get_club_claim', {
    p_claim_id: claimId,
  });
  if (error) throw error;
  return data ? mapClaim(data) : null;
}

/**
 * Utfallet av godkjenningen (00062 §7) — TILDELINGEN er det viktigste her:
 * `grantedManager` = selv-nominasjon ga rollen med en gang;
 * `invitationId` = en annen ble nominert, og invitasjonen er opprettet
 * (e-posten venter på web-landingen).
 */
export interface OpsApproveOutcome {
  claimId: string;
  legalEntityId: string;
  entityReused: boolean;
  accountStatus: string | null;
  grantedManager: boolean;
  invitationId: string | null;
}

/** Godkjenning KREVER tekst om hvordan autorisasjonen ble verifisert. */
export async function opsApproveClaim(
  claimId: string,
  authorizationNote: string,
): Promise<OpsApproveOutcome> {
  const {data, error} = await supabase.rpc('ops_approve_club_claim', {
    p_claim_id: claimId,
    p_authorization_note: authorizationNote,
  });
  if (error) throw error;
  return {
    claimId: data?.claim_id ?? claimId,
    legalEntityId: data?.legal_entity_id,
    entityReused: !!data?.entity_reused,
    accountStatus: data?.account_status ?? null,
    grantedManager: !!data?.granted_manager,
    invitationId: data?.invitation_id ?? null,
  };
}

export async function opsRejectClaim(
  claimId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_reject_club_claim', {
    p_claim_id: claimId,
    p_note: note,
  });
  if (error) throw error;
}

export async function opsRequestClaimInfo(
  claimId: string,
  message: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_request_claim_info', {
    p_claim_id: claimId,
    p_message: message,
  });
  if (error) throw error;
}


// ---------------------------------------------------------------------------
// «Klubber og roller» (autoritetsmodellen v2, II.6) — ops-flaten som gjør
// SQL-editoren til nødfallback. Alt er self-gatet på is_ops_admin() i
// databasen, alt logges append-only i payment_authority_events, og hver
// skrivende handling KREVER en begrunnelse (RPC-en avviser tom tekst).
// ---------------------------------------------------------------------------

export interface OpsEntityManager {
  userId: string;
  name: string;
  status: 'active' | 'suspended';
  source: string | null;
  createdAt: string;
}

export type OpsInvitationStatus =
  | 'pending'
  | 'awaiting_review'
  | 'accepted'
  | 'declined'
  | 'revoked'
  | 'expired';

export interface OpsEntityInvitation {
  id: string;
  invitedName: string;
  invitedEmail: string;
  status: OpsInvitationStatus;
  source: 'claim' | 'ops' | 'manager';
  /** NULL = e-posten er ALDRI sendt (WEB_INVITE_BASE_URL mangler). */
  sentAt: string | null;
  remindedAt: string | null;
  expiresAt: string | null;
  acceptedByName: string | null;
  /** Avviksdataene fra B1-kontrollen — grunnlaget for review-beslutningen. */
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
  entity: {
    id: string;
    legalName: string;
    orgNumber: string;
    verificationStatus: string;
  };
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
    account: raw.account
      ? {
          status: raw.account.status,
          chargesEnabled: !!raw.account.charges_enabled,
        }
      : null,
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

/** NULL for ikke-ops (probe-vernet) — skjermen viser da ingenting. */
export async function opsListPaymentEntities(): Promise<
  OpsPaymentEntity[] | null
> {
  const {data, error} = await supabase.rpc('ops_list_payment_entities');
  if (error) throw error;
  if (!data) return null;
  return (data as any[]).map(mapEntity);
}

/** Reparasjons-/førstegangsinvitasjon fra ops. Begrunnelse er PÅKREVD. */
export async function opsIssueManagerInvitation(input: {
  entityId: string;
  name: string;
  email: string;
  note: string;
}): Promise<string> {
  const {data, error} = await supabase.rpc('ops_issue_manager_invitation', {
    p_entity_id: input.entityId,
    p_name: input.name,
    p_email: input.email,
    p_note: input.note,
  });
  if (error) throw error;
  return data as string;
}

export async function opsRevokeManagerInvitation(
  invitationId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_revoke_manager_invitation', {
    p_invitation_id: invitationId,
    p_note: note,
  });
  if (error) throw error;
}

/** Avvikskontrollen (B1): bekreft → aktiv rolle. Rollen aktiveres ALDRI
 *  automatisk ved avvik — dette er den eneste veien videre. */
export async function opsConfirmInvitationReview(
  invitationId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_confirm_invitation_review', {
    p_invitation_id: invitationId,
    p_note: note,
  });
  if (error) throw error;
}

export async function opsRejectInvitationReview(
  invitationId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_reject_invitation_review', {
    p_invitation_id: invitationId,
    p_note: note,
  });
  if (error) throw error;
}

export async function opsSuspendManager(
  entityId: string,
  userId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_suspend_manager', {
    p_entity_id: entityId,
    p_user_id: userId,
    p_note: note,
  });
  if (error) throw error;
}

export async function opsReactivateManager(
  entityId: string,
  userId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_reactivate_manager', {
    p_entity_id: entityId,
    p_user_id: userId,
    p_note: note,
  });
  if (error) throw error;
}

/** Siste-aktive-vernet bor i RPC-en: fjerning av den siste aktive avvises
 *  med en forklarende feilmelding (suspensjon er lov — sikkerhet trumfer). */
export async function opsRemoveManager(
  entityId: string,
  userId: string,
  note: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_remove_manager', {
    p_entity_id: entityId,
    p_user_id: userId,
    p_note: note,
  });
  if (error) throw error;
}

/** Auditert lagflytting — hovedverktøyet for lag under feil/duplikat
 *  klubbrad (II.7). Aldri rå SQL. */
export async function opsMoveTeamToClub(input: {
  teamId: string;
  targetClubId: string;
  note: string;
}): Promise<void> {
  const {error} = await supabase.rpc('ops_move_team_to_club', {
    p_team_id: input.teamId,
    p_target_club_id: input.targetClubId,
    p_note: input.note,
  });
  if (error) throw error;
}

export interface OpsClubTeam {
  teamId: string;
  name: string;
  ageGroup: string | null;
  clubId: string;
}

/**
 * Lagene under gitte klubbrader — grunnlaget for «Flytt lag» når en
 * duplikatrad har fanget et lag. `teams` er lesbar for alle innloggede
 * (00005), så dette trenger ingen ny RPC; selve FLYTTINGEN er den auditerte,
 * ops-gatede `ops_move_team_to_club`.
 */
export async function opsListTeamsForClubs(
  clubIds: string[],
): Promise<OpsClubTeam[]> {
  if (clubIds.length === 0) return [];
  const {data, error} = await supabase
    .from('teams')
    .select('id, name, age_group, club_id')
    .in('club_id', clubIds)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((t) => ({
    teamId: t.id as string,
    name: t.name as string,
    ageGroup: (t.age_group as string | null) ?? null,
    clubId: t.club_id as string,
  }));
}
