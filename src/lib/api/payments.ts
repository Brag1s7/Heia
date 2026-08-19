import {supabase} from '../supabase';

// ---------------------------------------------------------------------------
// Betalingssporet, fase 3 (se docs/PAYMENTS.md): aktivering av «Støtt laget»
// for KLUBBEN. Klienten er uvitende om Stripe-objekter — den ser kun
// aktiveringstilstanden fra get_support_activation_status og en kortlevd
// onboarding-URL fra stripe-onboarding-funksjonen.
// ---------------------------------------------------------------------------

export type SupportActivationState =
  | 'no_club'
  | 'none'
  | 'claim_submitted'
  | 'claim_in_review'
  | 'claim_rejected'
  /** Autoritetsmodellen v2 (00062): verifisert enhet UTEN aktiv
   *  betalingsansvarlig — KYC og port 3 venter på at rollen er på plass. */
  | 'awaiting_manager'
  | 'pending_onboarding'
  | 'onboarding_started'
  | 'restricted'
  | 'active'
  | 'disabled';

/**
 * Grovkornet invitasjonsstatus for trenerkortet i `awaiting_manager`.
 * Serveren mapper `pending → invited` og `awaiting_review → in_review`;
 * resten er invitasjonsstatusen rå. Treneren ser aldri e-postadressen —
 * bare navnet som ble nominert, og hva som skjedde.
 */
export type ManagerPendingStatus =
  | 'invited'
  | 'in_review'
  | 'declined'
  | 'expired'
  | 'revoked'
  | 'accepted';

export interface SupportActivationStatus {
  state: SupportActivationState;
  club: {id: string; name: string} | null;
  claim: {
    id: string;
    orgNumber: string;
    legalName: string;
    reviewNote: string | null;
    isMine: boolean;
    /** «Be om mer informasjon» fra Heia Ops (00046) — vises i søknadskortet. */
    infoRequestNote: string | null;
  } | null;
  entity: {orgNumber: string; legalName: string} | null;
  account: {actionNeeded: boolean} | null;
  /** Lagets klubbdør-tilstand (00047) — styrer «Be om godkjenning»-kortet. */
  team: {
    supportState: 'collecting' | 'pending' | 'paused' | 'deactivated' | 'none';
    approval: {
      id: string;
      status: 'pending' | 'approved' | 'rejected';
      note: string | null;
      createdAt: string;
      decidedAt: string | null;
    } | null;
  } | null;
  /** Er JEG betalingsansvarlig i klubben? (kontekstuell snarvei) */
  isPaymentManager: boolean;
  /**
   * KYC-gaten (II.8, LÅST): kun en AKTIV betalingsansvarlig for enheten kan
   * generere Account Link. Er den false, viser skjermen status og hvem den
   * venter på — aldri en CTA som uansett ville blitt avvist server-side.
   */
  canOnboard: boolean;
  /** Kun i `awaiting_manager`: siste invitasjon for enheten, grovkornet. */
  managerPending: {
    invitedName: string;
    status: ManagerPendingStatus;
  } | null;
  /** En AKTIV betalingsansvarlig for enheten (00067, A3-avvik 2) — så
   *  KYC-kortet kan navngi hvem det venter på når `canOnboard` er false.
   *  null fra eldre DB eller når enheten mangler/venter på rollen. */
  manager: {name: string} | null;
}

/** RPC-en returnerer NULL for alle som ikke er lagadmin i laget. */
export async function getSupportActivationStatus(
  teamSpaceId: string,
): Promise<SupportActivationStatus | null> {
  const {data, error} = await supabase.rpc('get_support_activation_status', {
    ts_id: teamSpaceId,
  });

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    state: data.state,
    club: data.club ? {id: data.club.id, name: data.club.name} : null,
    claim: data.claim
      ? {
          id: data.claim.id,
          orgNumber: data.claim.org_number,
          legalName: data.claim.legal_name,
          reviewNote: data.claim.review_note ?? null,
          isMine: !!data.claim.is_mine,
          infoRequestNote: data.claim.info_request_note ?? null,
        }
      : null,
    entity: data.entity
      ? {orgNumber: data.entity.org_number, legalName: data.entity.legal_name}
      : null,
    account: data.account
      ? {actionNeeded: !!data.account.action_needed}
      : null,
    team: data.team
      ? {
          supportState: data.team.support_state,
          approval: data.team.approval
            ? {
                id: data.team.approval.id,
                status: data.team.approval.status,
                note: data.team.approval.note ?? null,
                createdAt: data.team.approval.created_at,
                decidedAt: data.team.approval.decided_at ?? null,
              }
            : null,
        }
      : null,
    isPaymentManager: !!data.is_payment_manager,
    canOnboard: !!data.can_onboard,
    managerPending: data.manager_pending
      ? {
          invitedName: data.manager_pending.invited_name,
          status: data.manager_pending.status as ManagerPendingStatus,
        }
      : null,
    manager: data.manager?.name ? {name: data.manager.name} : null,
  };
}

/**
 * Nominasjonen (autoritetsmodellen v2, II.2): hvem skal ha myndighet over
 * klubbens betalinger? Selv-nominasjon gir rollen eksplisitt ved
 * ops-godkjenning; «en annen» gir en sikker invitasjon ETTER godkjenning
 * (aksept skjer på nettsiden — se NOMINATE_OTHER_ENABLED).
 */
export type ClaimNominee =
  | {isSelf: true}
  | {isSelf: false; name: string; email: string; phone?: string};

export interface SubmitClubClaimInput {
  clubId: string;
  orgNumber: string;
  legalName: string;
  role: string;
  contactEmail: string;
  contactPhone?: string;
  nominee: ClaimNominee;
}

function claimBody(input: SubmitClubClaimInput) {
  const n = input.nominee;
  return {
    club_id: input.clubId,
    org_number: input.orgNumber,
    legal_name: input.legalName,
    role: input.role,
    contact_email: input.contactEmail,
    contact_phone: input.contactPhone ?? null,
    nominee_is_self: n.isSelf,
    nominee_name: n.isSelf ? null : n.name,
    nominee_email: n.isSelf ? null : n.email,
    nominee_phone: n.isSelf ? null : (n.phone ?? null),
  };
}

/**
 * Søknaden går gjennom Edge-funksjonen `submit-club-claim` (v2, II.10):
 * Brønnøysund-håndhevelsen bor SERVER-SIDE, så en ny klient (web senere)
 * aldri kan senke listen. RPC-ens egne vakter — lagadmin-gate,
 * duplikatvernene per klubbrad OG per orgnr, nominasjonsvalideringen —
 * gjelder uendret, siden funksjonen kaller med brukerens JWT.
 *
 * Klientens eget brreg-oppslag beholdes som UX (navne-prefill + rask
 * feilmelding), ikke som vakt.
 */
export async function submitClubClaim(
  input: SubmitClubClaimInput,
): Promise<string> {
  const {data, error} = await supabase.functions.invoke('submit-club-claim', {
    body: claimBody(input),
  });

  if (error) {
    throw new Error(await edgeMessage(error, 'Kunne ikke sende søknaden.'));
  }
  if (!data?.claim_id) {
    throw new Error('Søknaden ble ikke registrert — prøv igjen om litt.');
  }
  return data.claim_id as string;
}

/**
 * DEV-ONLY testdatavei: forbi Edge-funksjonens registerhåndhevelse, rett på
 * RPC-en. Brukes av «Send likevel (testdata)» i dev-bygg når orgnummeret
 * ikke finnes i Brønnøysund. Alle DB-vaktene gjelder fortsatt.
 */
export async function submitClubClaimDirect(
  input: SubmitClubClaimInput,
): Promise<string> {
  const b = claimBody(input);
  const {data, error} = await supabase.rpc('submit_club_claim', {
    p_club_id: b.club_id,
    p_org_number: b.org_number,
    p_legal_name: b.legal_name,
    p_role: b.role,
    p_contact_email: b.contact_email,
    p_contact_phone: b.contact_phone,
    p_nominee_is_self: b.nominee_is_self,
    p_nominee_name: b.nominee_name,
    p_nominee_email: b.nominee_email,
    p_nominee_phone: b.nominee_phone,
  });

  if (error) {
    throw error;
  }
  return data as string;
}

/**
 * Henter en FERSK onboarding-lenke (Account Links er kortlevde og lagres
 * aldri — fase 0-funn #6). Åpnes i Safari av den innloggede brukeren.
 *
 * v2 (II.8, LÅST): lenken DELES ALDRI videre — Share-arket er fjernet, og
 * gaten i `stripe-onboarding` er aktiv betalingsansvarlig for enheten
 * (+ ops-unntak). Kall den derfor kun når `canOnboard` er sann.
 */
export async function startStripeOnboarding(
  teamSpaceId: string,
): Promise<{url: string}> {
  return invokeForUrl('stripe-onboarding', teamSpaceId, 'onboarding-lenke');
}

// ---------------------------------------------------------------------------
// Fase 4: «Støtt laget» for medlemmene. Prisen er DATA fra aktiv offering
// (kun pris/valuta — splitten forlater aldri serveren); selve betalingen
// skjer i ekstern Safari via en kortlevd Checkout-URL, og statusen flyttes
// utelukkende av webhookene (retur fra checkout beviser ingenting).
// ---------------------------------------------------------------------------

export type SupportOffering =
  | {
      available: true;
      amountMinor: number;
      /** Kommunisert klubbandel (LÅST 2026-08-02: fordelingen er OFFENTLIG
       *  og et tillitspoeng — «79 kr i måneden, 60 kr går direkte til
       *  laget»). Alltid data fra offeringen, aldri hardkodet. */
      clubAmountMinor: number;
      currency: string;
      billingInterval: 'month';
      recipientLegalName: string;
    }
  | {available: false; reason: 'not_activated' | 'no_offering'};

/** RPC-en returnerer NULL for alle som ikke er medlem av laget. */
export async function getSupportOffering(
  teamSpaceId: string,
): Promise<SupportOffering | null> {
  const {data, error} = await supabase.rpc(
    'get_support_offering_for_team_space',
    {ts_id: teamSpaceId},
  );

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  if (!data.available) {
    return {available: false, reason: data.reason};
  }
  return {
    available: true,
    amountMinor: data.amount_minor,
    clubAmountMinor: data.club_amount_minor,
    currency: data.currency,
    billingInterval: data.billing_interval,
    recipientLegalName: data.recipient_legal_name,
  };
}

// ---------------------------------------------------------------------------
// Fase 5: Lagkassa + «Min støtte». Hovedtallet er alltid det LAGET får —
// aldri brutto betalingsvolum (låst 2026-08-02). Lagaggregatet er synlig
// for alle lagmedlemmer (sosialt bevis).
// ---------------------------------------------------------------------------

export interface TeamSupportSummary {
  supporters: number;
  monthlyToClubMinor: number;
  totalToClubMinor: number;
  currency: string;
  since: string | null;
}

/** RPC-en returnerer NULL for alle som ikke er medlem av laget. */
export async function getTeamSupportSummary(
  teamSpaceId: string,
): Promise<TeamSupportSummary | null> {
  const {data, error} = await supabase.rpc('get_team_support_summary', {
    ts_id: teamSpaceId,
  });

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    supporters: data.supporters,
    monthlyToClubMinor: data.monthly_to_club_minor,
    totalToClubMinor: data.total_to_club_minor,
    currency: data.currency,
    since: data.since ?? null,
  };
}

export interface MySupportItem {
  subscriptionId: string;
  teamSpaceId: string;
  teamName: string;
  status: MySupportStatus;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  amountMinor: number;
  clubAmountMinor: number;
  currency: string;
}

/** Brukerens egne, levende støtteavtaler — LISTE (flere lag senere). */
export async function getMySupportOverview(): Promise<MySupportItem[]> {
  const {data, error} = await supabase.rpc('get_my_support_overview');

  if (error) {
    throw error;
  }
  return ((data ?? []) as any[]).map((row) => ({
    subscriptionId: row.subscription_id,
    teamSpaceId: row.team_space_id,
    teamName: row.team_name,
    status: row.status as MySupportStatus,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAt: row.cancel_at ?? null,
    amountMinor: row.amount_minor,
    clubAmountMinor: row.club_amount_minor,
    currency: row.currency,
  }));
}

/**
 * Kortlevd Customer Portal-lenke (betalingsmåte, kvitteringer, oppsigelse).
 * Portalen ER selvbetjeningen i v1 — endringer bokføres av webhookene.
 */
export async function openSupportPortal(): Promise<{url: string}> {
  return invokeForUrl('stripe-portal', null, 'administrasjonslenke');
}

export type MySupportStatus = 'checkout_pending' | 'incomplete' | 'active' | 'past_due';

export interface MySupportSubscription {
  status: MySupportStatus;
  currentPeriodEnd: string | null;
  /** Satt når avtalen er sagt opp og løper ut perioden (deaktivert lag
   *  eller egen oppsigelse). Da FORNYES den ikke — den avsluttes, og
   *  flatene må si det. «Min støtte» har alltid gjort det; Lagkassa
   *  manglet feltet og sa «Fornyes» om en avsluttet avtale (A3, 2026-08-19). */
  cancelAt: string | null;
}

/**
 * Brukerens egen, levende støtteavtale for laget (RLS: kun egne rader).
 * canceled/abandoned regnes ikke — da kan man tegne på nytt.
 */
export async function getMySupportSubscription(
  teamSpaceId: string,
): Promise<MySupportSubscription | null> {
  const {data, error} = await supabase
    .from('support_subscriptions')
    .select('status, current_period_end, cancel_at')
    .eq('team_space_id', teamSpaceId)
    .in('status', ['checkout_pending', 'incomplete', 'active', 'past_due'])
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    status: data.status as MySupportStatus,
    currentPeriodEnd: data.current_period_end ?? null,
    cancelAt: data.cancel_at ?? null,
  };
}

/**
 * Henter en FERSK Checkout-URL (kortlevd — aldri lagret). Åpnes i ekstern
 * Safari (Apple 3.2.2(iv), låst): gratis app + innsamling utenfor appen.
 */
export async function startSupportCheckout(
  teamSpaceId: string,
): Promise<{url: string}> {
  return invokeForUrl('stripe-checkout', teamSpaceId, 'betalingslenke');
}

// Edge Functions svarer {error: 'norsk melding'} på 4xx/5xx — graves frem
// her så Alert-en i skjermen sier noe forståelig i stedet for «non-2xx».
export async function edgeMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
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

// Felles for URL-funksjonene.
async function invokeForUrl(
  fn: 'stripe-onboarding' | 'stripe-checkout' | 'stripe-portal',
  teamSpaceId: string | null,
  what: string,
): Promise<{url: string}> {
  const {data, error} = await supabase.functions.invoke(fn, {
    body: teamSpaceId ? {team_space_id: teamSpaceId} : {},
  });

  if (error) {
    throw new Error(
      await edgeMessage(error, 'Noe gikk galt — prøv igjen om litt.'),
    );
  }
  if (!data?.url) {
    throw new Error(`Fikk ingen ${what} — prøv igjen om litt.`);
  }
  return {url: data.url};
}
