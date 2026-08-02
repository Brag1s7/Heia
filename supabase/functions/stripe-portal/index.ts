// ============================================================
// stripe-portal — fase 5 i betalingssporet (se docs/PAYMENTS.md).
//
// «Min støtte» på Profil: Customer Portal ER hele selvbetjeningen
// i v1 (låst) — betalingsmåte, kvitteringer og oppsigelse skjer
// hos Stripe, aldri i appen. Sesjonen er kortlevd (fase 0-funn
// #6) og genereres i klikkøyeblikket; åpnes i ekstern Safari.
// Kanselleringer o.l. bokføres av fase 2-webhooken
// (customer.subscription.updated/deleted) — retur beviser
// ingenting, som alltid.
//
// verify_jwt = true: innlogget bruker; kunden slås opp på
// auth-brukerens payment_customers-rad — man kan aldri åpne en
// annens portal.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {stripePost} from '../_shared/stripe.ts';

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const userClient = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}}},
  );
  const {
    data: {user},
  } = await userClient.auth.getUser();
  if (!user) return json({error: 'Ikke innlogget.'}, 401);

  const admin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const {data: pc} = await admin
    .from('payment_customers')
    .select('provider_customer_id')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .maybeSingle();
  if (!pc) {
    return json({error: 'Du har ingen betalingsprofil ennå.'}, 409);
  }

  try {
    const session = await stripePost('/v1/billing_portal/sessions', {
      customer: pc.provider_customer_id as string,
      return_url: `${supabaseUrl}/functions/v1/stripe-checkout-return?flow=portal`,
    });
    return json({url: session.url});
  } catch (e) {
    console.error('stripe-portal:', e);
    return json(
      {error: 'Fikk ikke kontakt med Stripe akkurat nå — prøv igjen om litt.'},
      502,
    );
  }
});
