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
  checks: {navnMatch: boolean; sokerIRegisteret: boolean} | null;
}

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
    })),
    checks: raw.checks
      ? {
          navnMatch: !!raw.checks.navn_match,
          sokerIRegisteret: !!raw.checks.soker_i_registeret,
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

/** Godkjenning KREVER tekst om hvordan autorisasjonen ble verifisert. */
export async function opsApproveClaim(
  claimId: string,
  authorizationNote: string,
): Promise<void> {
  const {error} = await supabase.rpc('ops_approve_club_claim', {
    p_claim_id: claimId,
    p_authorization_note: authorizationNote,
  });
  if (error) throw error;
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
