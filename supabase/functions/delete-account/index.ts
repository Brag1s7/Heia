// ============================================================
// delete-account — V1-hygiene del 2 (Apple 5.1.1(v): kontosletting
// i appen er et hardt review-krav).
//
// Modellen (besluttet 2026-08-02): anonymiser, ikke utrader.
// delete_account_data (00042) tar hele DB-siden i én transaksjon —
// profilen blir et anonymt «Slettet bruker»-spøkelse så finansradene
// (bokføringsloven) og laginnholdet består, alt personlig slettes.
//
// Rekkefølgen er en sikkerhetsrekkefølge:
//   1. Stripe: kanseller levende abonnement og slett kunden (PII +
//      kortdata hos Stripe forsvinner; charge-/invoice-historikken
//      består der for regnskap). Feiler dette reelt, avbryter vi FØR
//      noe annet er rørt — en slettet konto skal aldri etterlate et
//      løpende trekk. 4xx tolereres: det betyr «allerede borte /
//      allerede kansellert», og gjentak skal gli gjennom.
//   2. delete_account_data — idempotent, transaksjonell.
//   3. auth-brukeren slettes SIST: frem til da er JWT-en gyldig og
//      brukeren kan prøve igjen; etterpå finnes ingen pålogging.
// Webhookene bokfører kanselleringene som alltid (subscription-
// radene flippes til canceled når eventene ankommer) — vi venter
// ikke på dem her.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {stripeDelete, StripeApiError} from '../_shared/stripe.ts';

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const FEIL_STRIPE =
  'Fikk ikke avsluttet støtteavtalen hos Stripe — prøv igjen om litt.';
const FEIL_GENERELL =
  'Kunne ikke slette kontoen akkurat nå — prøv igjen om litt.';

// 4xx fra Stripe ved kansellering/sletting = tilstanden er allerede
// nådd (borte, kansellert) — idempotent OK. Alt annet skal stoppe oss.
async function stripeDeleteTolerant(path: string): Promise<void> {
  try {
    await stripeDelete(path);
  } catch (e) {
    if (e instanceof StripeApiError && e.status < 500) {
      console.warn(`delete-account: tolererer ${e.message}`);
      return;
    }
    throw e;
  }
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

  // --- 1) Stripe først: levende avtaler kanselleres, kunden slettes.
  try {
    const {data: subs, error: subsErr} = await admin
      .from('support_subscriptions')
      .select('provider_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['checkout_pending', 'incomplete', 'active', 'past_due'])
      .not('provider_subscription_id', 'is', null);
    if (subsErr) throw subsErr;

    for (const sub of subs ?? []) {
      await stripeDeleteTolerant(
        `/v1/subscriptions/${sub.provider_subscription_id}`,
      );
    }

    // Kundesletting tar også en checkout-sesjon som ennå ikke har
    // rukket å bli abonnement (checkout_pending uten subscription-id).
    const {data: customers, error: custErr} = await admin
      .from('payment_customers')
      .select('provider_customer_id')
      .eq('user_id', user.id);
    if (custErr) throw custErr;

    for (const c of customers ?? []) {
      await stripeDeleteTolerant(`/v1/customers/${c.provider_customer_id}`);
    }
  } catch (e) {
    console.error('delete-account (stripe):', e);
    return json({error: FEIL_STRIPE}, 502);
  }

  // --- 2) DB-siden i én transaksjon (idempotent ved gjentak).
  const {error: rpcErr} = await admin.rpc('delete_account_data', {
    p_user_id: user.id,
  });
  if (rpcErr) {
    console.error('delete-account (rpc):', rpcErr);
    return json({error: FEIL_GENERELL}, 500);
  }

  // --- 3) auth-brukeren til slutt — da dør påloggingen.
  const {error: authErr} = await admin.auth.admin.deleteUser(user.id);
  if (authErr) {
    console.error('delete-account (auth):', authErr);
    return json({error: FEIL_GENERELL}, 500);
  }

  return json({ok: true});
});
