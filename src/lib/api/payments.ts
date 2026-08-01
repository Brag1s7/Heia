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
  const {data, error} = await supabase.functions.invoke('stripe-onboarding', {
    body: {team_space_id: teamSpaceId},
  });

  if (error) {
    // Funksjonen svarer alltid {error: 'norsk melding'} på 4xx/5xx —
    // grav den frem så Alert-en i skjermen sier noe forståelig.
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
    throw new Error('Fikk ingen onboarding-lenke — prøv igjen om litt.');
  }
  return {url: data.url};
}
