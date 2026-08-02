// ============================================================
// _shared/web.ts — retur-/landingssider for Stripes redirects.
//
// Med secreten WEB_BASE_URL satt (`https://heiaapp.no`) lander alle
// flows på den pene siden `web/betaling/` (HEIAAPP-NO.md steg 1+3).
// Uten secreten består fase 3/4-tekstsidene på funksjonsdomenet —
// null atferdsendring, så funksjonene kan deployes FØR hostingen er
// live; selve byttet er kun `supabase secrets set WEB_BASE_URL=…`
// (secrets når kjørende funksjoner uten redeploy).
// ============================================================

export type LandingFlow =
  | 'success'
  | 'cancel'
  | 'portal'
  | 'onboarding'
  | 'refresh';

export function landingUrl(flow: LandingFlow): string {
  const base = Deno.env.get('WEB_BASE_URL');
  if (base) {
    return `${base.replace(/\/+$/, '')}/betaling?flow=${flow}`;
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  if (flow === 'onboarding' || flow === 'refresh') {
    // Tekstsiden bruker Stripes navn «return» der websiden sier det
    // tydeligere «onboarding».
    const legacy = flow === 'onboarding' ? 'return' : 'refresh';
    return `${supabaseUrl}/functions/v1/stripe-onboarding-return?flow=${legacy}`;
  }
  return `${supabaseUrl}/functions/v1/stripe-checkout-return?flow=${flow}`;
}
