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
  | 'pending_onboarding'
  | 'onboarding_started'
  | 'restricted'
  | 'active'
  | 'disabled';

export interface SupportActivationStatus {
  state: SupportActivationState;
  club: {id: string; name: string} | null;
  claim: {
    id: string;
    orgNumber: string;
    legalName: string;
    reviewNote: string | null;
    isMine: boolean;
  } | null;
  entity: {orgNumber: string; legalName: string} | null;
  account: {actionNeeded: boolean} | null;
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
        }
      : null,
    entity: data.entity
      ? {orgNumber: data.entity.org_number, legalName: data.entity.legal_name}
      : null,
    account: data.account
      ? {actionNeeded: !!data.account.action_needed}
      : null,
  };
}

export async function submitClubClaim(input: {
  clubId: string;
  orgNumber: string;
  legalName: string;
  role: string;
  contactEmail: string;
  contactPhone?: string;
}): Promise<string> {
  const {data, error} = await supabase.rpc('submit_club_claim', {
    p_club_id: input.clubId,
    p_org_number: input.orgNumber,
    p_legal_name: input.legalName,
    p_role: input.role,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone ?? null,
  });

  if (error) {
    throw error;
  }
  return data as string;
}

/**
 * Henter en FERSK onboarding-lenke (Account Links er kortlevde og lagres
 * aldri — fase 0-funn #6). Åpnes i Safari; kan også deles videre til den
 * i klubben som har fullmakt til å fullføre hos Stripe.
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
    .select('status, current_period_end')
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

// Felles for URL-funksjonene: {error: 'norsk melding'} på 4xx/5xx
// graves frem så Alert-en i skjermen sier noe forståelig.
async function invokeForUrl(
  fn: 'stripe-onboarding' | 'stripe-checkout' | 'stripe-portal',
  teamSpaceId: string | null,
  what: string,
): Promise<{url: string}> {
  const {data, error} = await supabase.functions.invoke(fn, {
    body: teamSpaceId ? {team_space_id: teamSpaceId} : {},
  });

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
  if (!data?.url) {
    throw new Error(`Fikk ingen ${what} — prøv igjen om litt.`);
  }
  return {url: data.url};
}
