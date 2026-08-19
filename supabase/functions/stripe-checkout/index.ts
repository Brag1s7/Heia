// ============================================================
// stripe-checkout — fase 4 i betalingssporet (se docs/PAYMENTS.md).
//
// Starter «Støtt laget»-tegningen for et LAGMEDLEM (foreldre og
// supportere ER medlemmer — ingen rollegate her, i motsetning til
// stripe-onboarding). Selve betalingen skjer i EKSTERN Safari på
// Stripes hostede Checkout (Apple 3.2.2(iv), låst beslutning).
//
// FASE 2-KONTRAKTEN (bindende, se stripe-webhook-headeren):
//   1. support_subscriptions-raden opprettes FØR redirect
//      (status checkout_pending).
//   2. metadata.support_subscription_id settes på BÅDE checkout-
//      sesjonen og subscription_data — hver webhook-hendelse kan
//      stå alene uansett leveranserekkefølge.
//   3. Sesjons-id-en skrives på raden før URL-en returneres.
//
// Alt pris-/splitoppslag skjer server-side fra aktiv offering —
// klienten kan aldri velge pris, og splitten (ulåst kommersiell
// beslutning) forlater aldri serveren. application_fee_percent =
// fee_bps/100 (fase 0: 2405 bps ga nøyaktig 60 kr til klubb på
// 7900 øre — avrundingen er KUN verifisert for det prispunktet).
//
// Stripe-objektene provisjoneres lat med Idempotency-Keys bundet
// til radene våre (samme mønster som stripe-onboarding):
//   * product/price per offering (write-once på offering-raden)
//   * én plattformkunde per bruker (payment_customers)
// Et dobbeltklikk/kappløp kan derfor aldri gi doble Stripe-objekter.
//
// «Prøv igjen»-flyten gjenbruker en checkout_pending-rad: gammel
// sesjon utløpes best-effort, ny sesjon skrives BETINGET (status
// fortsatt checkout_pending + uten provider_subscription_id) — har
// den gamle sesjonen rukket å fullføre, utløpes den nye sesjonen og
// brukeren får «du støtter allerede». Webhookens expired-handler
// har tilsvarende sesjons-id-vakt (fase 4-patch).
//
// verify_jwt = true (config.toml): innlogget bruker kreves;
// medlemskapet sjekkes eksplisitt mot memberships.
// ============================================================
import {createClient, type SupabaseClient} from 'jsr:@supabase/supabase-js@2';
import {stripePost} from '../_shared/stripe.ts';
import {landingUrl} from '../_shared/web.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const ALREADY = 'Du støtter allerede dette laget 💚';

// Gjenbrukbar «finnes det alt en levende avtale?»-tolkning — brukes
// både før tegning og når et parallelt kall vant insert-racet.
function liveRowBlock(status: string): string | null {
  if (status === 'active' || status === 'past_due') return ALREADY;
  if (status === 'incomplete') {
    return 'Forrige betaling er fortsatt underveis hos Stripe — vent noen minutter og prøv igjen.';
  }
  return null; // checkout_pending → gjenbrukes
}

async function findLiveRow(
  admin: SupabaseClient,
  userId: string,
  teamSpaceId: string,
): Promise<{id: string; status: string; provider_checkout_session_id: string | null} | null> {
  const {data} = await admin
    .from('support_subscriptions')
    .select('id, status, provider_checkout_session_id')
    .eq('user_id', userId)
    .eq('team_space_id', teamSpaceId)
    .in('status', ['checkout_pending', 'incomplete', 'active', 'past_due'])
    .maybeSingle();
  return data as {
    id: string;
    status: string;
    provider_checkout_session_id: string | null;
  } | null;
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

  let teamSpaceId: string | undefined;
  try {
    const body = await req.json();
    teamSpaceId = body?.team_space_id;
  } catch {
    // faller gjennom til valideringen under
  }
  if (!teamSpaceId || !UUID_RE.test(teamSpaceId)) {
    return json({error: 'Ugyldig forespørsel (team_space_id mangler).'}, 400);
  }

  const admin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Alle aktive medlemmer kan støtte laget sitt — ingen rollegate.
  // limit(1): en forelder med to barn har TO aktive rader i laget, og
  // maybeSingle() uten limit feiler da (PGRST116) — feilen ble svelget
  // av destruktureringen og gaten falt til falsk 403 for flerbarns-
  // foreldre. Gaten er «finnes minst én», aldri «finnes nøyaktig én».
  const {data: membership} = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('team_space_id', teamSpaceId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return json({error: 'Du må være medlem av laget for å støtte det.'}, 403);
  }

  // Kapabilitetskjeden (00037): lag → klubb → aktiv link → verifisert
  // enhet → AKTIV konto med charges_enabled. Hard vakt — ingen
  // checkout uten entydig aktiv mottaker.
  const {data: ts} = await admin
    .from('team_spaces')
    .select('display_name, teams(club_id)')
    .eq('id', teamSpaceId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const clubId = (ts?.teams as any)?.club_id as string | undefined;
  if (!clubId) return json({error: 'Fant ikke klubben til laget.'}, 404);

  const {data: link} = await admin
    .from('club_legal_entity_links')
    .select('legal_club_entity_id, legal_club_entities(verification_status)')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  if (!link || (link.legal_club_entities as any)?.verification_status !== 'verified') {
    return json({error: 'Klubben er ikke aktivert for støtte ennå.'}, 409);
  }

  const {data: account} = await admin
    .from('club_payment_accounts')
    .select('id, provider_account_id, status, charges_enabled')
    .eq('legal_club_entity_id', link.legal_club_entity_id)
    .eq('provider', 'stripe')
    .maybeSingle();
  if (
    !account?.provider_account_id ||
    account.status !== 'active' ||
    !account.charges_enabled
  ) {
    return json({error: 'Klubben er ikke klar til å ta imot støtte ennå.'}, 409);
  }

  // Prisen er DATA (aktiv offering) — aldri hardkodet, aldri fra klient.
  const {data: offering} = await admin
    .from('support_offerings')
    .select(
      'id, amount_minor, currency, billing_interval, fee_bps, provider_product_id, provider_price_id',
    )
    .eq('team_space_id', teamSpaceId)
    .eq('status', 'active')
    .maybeSingle();
  if (!offering) {
    return json({error: 'Støtte for dette laget er ikke satt opp ennå.'}, 409);
  }

  try {
    // --- Stripe-product/price for offeringen, lat + write-once ---
    let priceId = offering.provider_price_id as string | null;
    if (!priceId) {
      let productId = offering.provider_product_id as string | null;
      if (!productId) {
        const product = await stripePost(
          '/v1/products',
          {
            name: `Støtt ${ts?.display_name ?? 'laget'}`,
            'metadata[team_space_id]': teamSpaceId,
            'metadata[offering_id]': offering.id,
          },
          `heia-offprod-${offering.id}`,
        );
        productId = product.id as string;
        await admin
          .from('support_offerings')
          .update({provider_product_id: productId})
          .eq('id', offering.id)
          .is('provider_product_id', null);
      }
      const price = await stripePost(
        '/v1/prices',
        {
          product: productId,
          currency: offering.currency as string,
          unit_amount: String(offering.amount_minor),
          'recurring[interval]': offering.billing_interval as string,
          'metadata[offering_id]': offering.id,
        },
        `heia-offprice-${offering.id}`,
      );
      priceId = price.id as string;
      await admin
        .from('support_offerings')
        .update({provider_price_id: priceId})
        .eq('id', offering.id)
        .is('provider_price_id', null);
    }

    // --- Plattformkunden, lat + én per (bruker, provider) ---
    let {data: pc} = await admin
      .from('payment_customers')
      .select('id, provider_customer_id')
      .eq('user_id', user.id)
      .eq('provider', 'stripe')
      .maybeSingle();
    if (!pc) {
      const params: Record<string, string> = {'metadata[user_id]': user.id};
      if (user.email) params.email = user.email;
      const customer = await stripePost(
        '/v1/customers',
        params,
        `heia-cust-${user.id}`,
      );
      await admin.from('payment_customers').upsert(
        {
          user_id: user.id,
          provider: 'stripe',
          provider_customer_id: customer.id,
        },
        {onConflict: 'user_id,provider', ignoreDuplicates: true},
      );
      // Reselect: taper vi et kappløp gjelder raden som vant (samme
      // idempotency-nøkkel gjør uansett Stripe-kunden til den samme).
      const {data: fresh, error: pcErr} = await admin
        .from('payment_customers')
        .select('id, provider_customer_id')
        .eq('user_id', user.id)
        .eq('provider', 'stripe')
        .single();
      if (pcErr) throw new Error(`payment_customers: ${pcErr.message}`);
      pc = fresh;
    }

    // --- Avtaleraden: én levende per (bruker, lag) ---
    let subRow = await findLiveRow(admin, user.id, teamSpaceId);
    if (subRow) {
      const block = liveRowBlock(subRow.status);
      if (block) return json({error: block}, 409);
      // checkout_pending → gjenbruk raden; den gamle sesjonen utløpes
      // best-effort så to betalbare sesjoner aldri lever samtidig.
      if (subRow.provider_checkout_session_id) {
        try {
          await stripePost(
            `/v1/checkout/sessions/${subRow.provider_checkout_session_id}/expire`,
            {},
          );
        } catch {
          // alt utløpt/fullført — den betingede oppdateringen under
          // fanger fullført-tilfellet
        }
      }
    } else {
      const {data: inserted, error: insErr} = await admin
        .from('support_subscriptions')
        .insert({
          user_id: user.id,
          team_space_id: teamSpaceId,
          offering_id: offering.id,
          payment_customer_id: pc.id,
          club_payment_account_id: account.id,
        })
        .select('id, status, provider_checkout_session_id')
        .single();
      if (insErr) {
        // Unik-indexen (én levende avtale) — et parallelt kall vant.
        const winner = await findLiveRow(admin, user.id, teamSpaceId);
        if (!winner) throw new Error(`avtaleinnsetting: ${insErr.message}`);
        const block = liveRowBlock(winner.status);
        if (block) return json({error: block}, 409);
        subRow = winner;
      } else {
        subRow = inserted;
      }
    }

    // --- Checkout-sesjonen (fase 0-spikens eksakte subscription_data) ---
    const feePercent = (offering.fee_bps / 100).toFixed(2);
    const session = await stripePost('/v1/checkout/sessions', {
      mode: 'subscription',
      customer: pc.provider_customer_id as string,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'subscription_data[on_behalf_of]': account.provider_account_id,
      'subscription_data[transfer_data][destination]': account.provider_account_id,
      'subscription_data[application_fee_percent]': feePercent,
      'metadata[support_subscription_id]': subRow.id,
      'subscription_data[metadata][support_subscription_id]': subRow.id,
      success_url: landingUrl('success'),
      cancel_url: landingUrl('cancel'),
    });

    // Betinget skriving av sesjons-id: har den gamle sesjonen rukket å
    // fullføre (webhooken satte sub-id/status), skal den nye sesjonen
    // aldri nå brukeren — utløp den og si ifra.
    const {data: updated, error: updErr} = await admin
      .from('support_subscriptions')
      .update({provider_checkout_session_id: session.id})
      .eq('id', subRow.id)
      .eq('status', 'checkout_pending')
      .is('provider_subscription_id', null)
      .select('id');
    if (updErr) throw new Error(`sesjonsskriving: ${updErr.message}`);
    if (!updated || updated.length === 0) {
      try {
        await stripePost(`/v1/checkout/sessions/${session.id}/expire`, {});
      } catch {
        // best-effort — sesjonen dør uansett av seg selv
      }
      return json({error: ALREADY}, 409);
    }

    return json({url: session.url});
  } catch (e) {
    console.error('stripe-checkout:', e);
    return json(
      {error: 'Fikk ikke kontakt med Stripe akkurat nå — prøv igjen om litt.'},
      502,
    );
  }
});
