// ============================================================
// stripe-webhook — fase 2 i betalingssporet (se docs/PAYMENTS.md).
//
// ENESTE sannhetskilde for betalingstilstand: all statusflytting i
// betalingsdomenet (kontoer, abonnementer, transaksjoner) skjer HER
// — aldri fra klientkall (retur fra checkout beviser ingenting).
//
// Prinsippene (fase 0-funn P13 + beslutningsboken):
//  * Idempotent per (provider, event_id): webhook_events-raden er
//    duplikatvernet (UNIQUE). failed/received reprosesseres trygt
//    fordi hver handler er KONVERGENT — se neste punkt.
//  * Rekkefølge-agnostisk: checkout.session.completed ankommer SIST
//    (empirisk, logs/13). Hendelsen er derfor kun en TRIGGER —
//    sannheten hentes alltid fresh fra Stripe-API-et (GET), så
//    prosesseringen konvergerer uansett leveranse-rekkefølge og
//    tåler dobbeltkjøring.
//  * Rent observerende: kun GET mot Stripe. Refusjoner og transfer-
//    reverseringer (policy: alltid full reversering / reverser ved
//    TAPT dispute) er bevisste ops-handlinger — aldri en webhook-
//    bivirkning.
//  * payment_transactions er penger som FAKTISK flyttet seg — et
//    feilet trekk skaper ingen rad (purreløpet eies av Stripe;
//    abonnementet går past_due via API-sannheten).
//
// Kontrakt mot fase 4 (checkout): raden i support_subscriptions
// opprettes FØR redirect (status checkout_pending, med session-id),
// og checkout-sesjonen settes opp med metadata.support_subscription_id
// på BÅDE sesjonen og subscription_data — da kan hver hendelse stå
// alene selv når den ankommer før checkout.session.completed.
//
// verify_jwt = false (config.toml): Stripe kan ikke sende Supabase-
// JWT. Autentisering = signaturverifisering. To secrets fordi
// account.updated for tilkoblede kontoer leveres på et eget Connect-
// endepunkt med egen secret (samme URL).
// ============================================================
import {createClient, type SupabaseClient} from 'jsr:@supabase/supabase-js@2';
import {
  stripeGet,
  verifyStripeSignature,
  type StripeObject,
} from '../_shared/stripe.ts';

type HandlerResult = {outcome: 'processed' | 'skipped'; note?: string};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toIso(epoch: number | null | undefined): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

// ------------------------------------------------------------
// Statusmapping: Stripes abonnementsstatus → vår enum.
// trialing/paused kan vi ikke selv skape (ingen trials, ingen pause
// i v1) — mappes defensivt i stedet for å velte prosesseringen om
// de likevel dukker opp. incomplete_expired = betalingen kom aldri
// gjennom → 'abandoned' (frigjør plassen, brukeren kan tegne på nytt).
// ------------------------------------------------------------
const SUB_STATUS: Record<string, string> = {
  incomplete: 'incomplete',
  incomplete_expired: 'abandoned',
  trialing: 'active',
  active: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  paused: 'past_due',
  canceled: 'canceled',
};

// Transaksjonsstatus går kun FREMOVER (låst invariant). Refund kan
// aldri nedgradere en dispute; lukket dispute overstyrer alt.
const TXN_RANK: Record<string, number> = {
  pending: 0,
  succeeded: 1,
  partially_refunded: 2,
  refunded: 3,
  disputed: 4,
  dispute_won: 5,
  dispute_lost: 5,
};

// ------------------------------------------------------------
// Oppslag av vår abonnementsrad — i prioritert rekkefølge:
// provider-id → checkout-session-id → metadata (fase 4-kontrakten).
// ------------------------------------------------------------
type SubRow = {
  id: string;
  status: string;
  provider_subscription_id: string | null;
  started_at: string | null;
  team_space_id: string;
  club_payment_account_id: string;
  offering_id: string;
};

const SUB_COLS =
  'id, status, provider_subscription_id, started_at, team_space_id, club_payment_account_id, offering_id';

async function resolveSubRow(
  admin: SupabaseClient,
  ids: {
    subscriptionId?: string | null;
    checkoutSessionId?: string | null;
    metadataId?: string | null;
  },
): Promise<SubRow | null> {
  if (ids.subscriptionId) {
    const {data} = await admin
      .from('support_subscriptions')
      .select(SUB_COLS)
      .eq('provider', 'stripe')
      .eq('provider_subscription_id', ids.subscriptionId)
      .maybeSingle();
    if (data) return data as SubRow;
  }
  if (ids.checkoutSessionId) {
    const {data} = await admin
      .from('support_subscriptions')
      .select(SUB_COLS)
      .eq('provider', 'stripe')
      .eq('provider_checkout_session_id', ids.checkoutSessionId)
      .maybeSingle();
    if (data) return data as SubRow;
  }
  if (ids.metadataId && UUID_RE.test(ids.metadataId)) {
    const {data} = await admin
      .from('support_subscriptions')
      .select(SUB_COLS)
      .eq('id', ids.metadataId)
      .maybeSingle();
    if (data) return data as SubRow;
  }
  return null;
}

// ------------------------------------------------------------
// Konvergent synk: hent abonnementet fresh fra Stripe og skriv
// tilstanden. Kalles fra ALLE abonnementsbærende hendelser — da er
// hver hendelse komplett alene, uansett rekkefølge.
// Fase 0-funn: cancel_at (timestamp) er sannheten for «kansellert
// ved periodeslutt» (boolean-en forble false); current_period_end
// bor på abonnements-ITEMET i denne API-versjonen.
// ------------------------------------------------------------
async function syncSubscription(
  admin: SupabaseClient,
  row: SubRow,
  subscriptionId: string,
): Promise<void> {
  if (
    row.provider_subscription_id &&
    row.provider_subscription_id !== subscriptionId
  ) {
    // Skal aldri skje (unik index + én levende avtale per bruker/lag) —
    // rop høyt i stedet for å skrive feil tilstand.
    throw new Error(
      `rad ${row.id} peker på ${row.provider_subscription_id}, hendelsen på ${subscriptionId}`,
    );
  }

  const sub = await stripeGet(`/v1/subscriptions/${subscriptionId}`);
  const mapped = SUB_STATUS[sub.status as string];
  if (!mapped) throw new Error(`ukjent abonnementsstatus «${sub.status}»`);

  const {error} = await admin
    .from('support_subscriptions')
    .update({
      provider_subscription_id: subscriptionId,
      provider_status: sub.status,
      status: mapped,
      cancel_at: toIso(sub.cancel_at),
      canceled_at: toIso(sub.canceled_at),
      current_period_end: toIso(sub.items?.data?.[0]?.current_period_end),
      started_at: row.started_at ?? toIso(sub.start_date),
      ended_at: toIso(sub.ended_at),
    })
    .eq('id', row.id);
  if (error) throw new Error(`oppdatering av abonnement: ${error.message}`);
}

// ------------------------------------------------------------
// Handlers — én per hendelsestype vi abonnerer på.
// ------------------------------------------------------------

async function onAccountUpdated(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const accountId = (event.data.object?.id ?? event.account) as
    | string
    | undefined;
  if (!accountId) throw new Error('account.updated uten konto-id');

  const {data: row} = await admin
    .from('club_payment_accounts')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_account_id', accountId)
    .maybeSingle();
  if (!row) {
    return {outcome: 'skipped', note: `ukjent konto ${accountId}`};
  }

  const acct = await stripeGet(`/v1/accounts/${accountId}`);
  const req = acct.requirements ?? {};
  const disabledReason = req.disabled_reason as string | null;

  // Statusen avledes KUN her — én plass, alltid fra fresh API-tilstand.
  let status: string;
  if (disabledReason?.startsWith('rejected')) {
    status = 'disabled';
  } else if (acct.charges_enabled && acct.payouts_enabled && !disabledReason) {
    status = 'active';
  } else if (acct.details_submitted || acct.charges_enabled) {
    status = 'restricted';
  } else {
    status = 'onboarding_started';
  }

  const {error} = await admin
    .from('club_payment_accounts')
    .update({
      status,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      // Kun feltene fase 3-oppfølgingen trenger — aldri hele payloaden
      // (klienten skal uansett aldri lese requirements rått).
      requirements: {
        disabled_reason: disabledReason ?? null,
        currently_due: req.currently_due ?? [],
        past_due: req.past_due ?? [],
        pending_verification: req.pending_verification ?? [],
        current_deadline: req.current_deadline ?? null,
      },
    })
    .eq('id', row.id);
  if (error) throw new Error(`oppdatering av konto: ${error.message}`);

  return {outcome: 'processed', note: `konto → ${status}`};
}

async function onCheckoutCompleted(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const session = event.data.object as StripeObject;
  const row = await resolveSubRow(admin, {
    checkoutSessionId: session.id,
    metadataId: session.metadata?.support_subscription_id,
  });
  if (!row) {
    // Fase 4 oppretter raden FØR redirect — en ukjent sesjon er ikke vår.
    return {outcome: 'skipped', note: `ukjent checkout-session ${session.id}`};
  }
  if (!session.subscription) {
    return {outcome: 'processed', note: 'sesjon uten abonnement — ingenting å synke'};
  }
  await syncSubscription(admin, row, session.subscription as string);
  return {outcome: 'processed'};
}

async function onCheckoutExpired(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const session = event.data.object as StripeObject;
  const row = await resolveSubRow(admin, {
    checkoutSessionId: session.id,
    metadataId: session.metadata?.support_subscription_id,
  });
  if (!row) {
    return {outcome: 'skipped', note: `ukjent checkout-session ${session.id}`};
  }
  // Kun den som aldri kom videre skal merkes — en fullført tegning har
  // alt fått status fra abonnementshendelsene.
  if (row.status === 'checkout_pending') {
    const {error} = await admin
      .from('support_subscriptions')
      .update({status: 'abandoned', ended_at: new Date().toISOString()})
      .eq('id', row.id)
      .eq('status', 'checkout_pending');
    if (error) throw new Error(`abandonering: ${error.message}`);
  }
  return {outcome: 'processed'};
}

async function onSubscriptionEvent(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const sub = event.data.object as StripeObject;
  const row = await resolveSubRow(admin, {
    subscriptionId: sub.id,
    metadataId: sub.metadata?.support_subscription_id,
  });
  if (!row) {
    return {
      outcome: 'skipped',
      note: `ukjent abonnement ${sub.id} (mangler metadata — tegnet utenfor appen?)`,
    };
  }
  await syncSubscription(admin, row, sub.id as string);
  return {outcome: 'processed'};
}

async function onInvoicePaid(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const invoice = event.data.object as StripeObject;
  const subDetails = invoice.parent?.subscription_details;
  const row = await resolveSubRow(admin, {
    subscriptionId: subDetails?.subscription,
    metadataId: subDetails?.metadata?.support_subscription_id,
  });
  if (!row) {
    return {
      outcome: 'skipped',
      note: `faktura ${invoice.id} uten kjent abonnement`,
    };
  }

  // Fase 0-funn #4: fakturaen bærer ikke charge/payment_intent lenger.
  // Kjeden er invoice_payments → payment_intent → charges-listen.
  const payments = await stripeGet('/v1/invoice_payments', {
    invoice: invoice.id as string,
  });
  const paid = (payments.data as StripeObject[] | undefined)?.find(
    (p) => p.status === 'paid' && p.payment?.payment_intent,
  );
  if (!paid) {
    // invoice.paid uten betalt invoice_payment = Stripe er ikke ferdig —
    // kast så leveransen reprøves.
    throw new Error(`ingen betalt invoice_payment for ${invoice.id} ennå`);
  }
  const charges = await stripeGet('/v1/charges', {
    payment_intent: paid.payment.payment_intent as string,
  });
  const charge = (charges.data as StripeObject[] | undefined)?.find(
    (c) => c.status === 'succeeded',
  );
  if (!charge) throw new Error(`ingen succeeded charge for ${invoice.id} ennå`);

  // Charge-id-en er idempotensnøkkelen for transaksjonen.
  const {data: existing} = await admin
    .from('payment_transactions')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_charge_id', charge.id)
    .maybeSingle();
  if (existing) {
    // Uansett: synk abonnementet så hendelsen er komplett alene.
    await syncSubscription(admin, row, subDetails.subscription as string);
    return {outcome: 'processed', note: 'transaksjonen var alt registrert'};
  }

  const gross = charge.amount as number;
  const platformFee = charge.application_fee_amount as number | null;
  if (platformFee == null) {
    // Våre abonnementer har ALLTID application fee — en charge uten er
    // et arkitekturbrudd, ikke en tilstand å lagre.
    throw new Error(`charge ${charge.id} mangler application_fee_amount`);
  }

  // Frossen økonomi: split-modellen som GJALDT hentes fra offeringen
  // abonnementet ble tegnet på — aldri fra «dagens» offering.
  const {data: offering, error: offErr} = await admin
    .from('support_offerings')
    .select('fee_model, fee_bps, club_fixed_minor')
    .eq('id', row.offering_id)
    .single();
  if (offErr) throw new Error(`offering-oppslag: ${offErr.message}`);

  // Stripe-gebyret ankommer med balance transaction (fee inkl. MVA).
  const bt = await stripeGet(
    `/v1/balance_transactions/${charge.balance_transaction}`,
  );

  // Kappløp med en parallell leveranse gir unik-brudd her — Stripe
  // reprøver, og neste runde treffer «alt registrert»-grenen. Riktig.
  const {error: insErr} = await admin.from('payment_transactions').insert({
    origin: 'subscription_invoice',
    subscription_id: row.id,
    team_space_id: row.team_space_id,
    club_payment_account_id: row.club_payment_account_id,
    provider: 'stripe',
    provider_invoice_id: invoice.id,
    provider_payment_intent_id: paid.payment.payment_intent,
    provider_charge_id: charge.id,
    provider_transfer_id: charge.transfer ?? null,
    provider_balance_txn_id: charge.balance_transaction ?? null,
    gross_minor: gross,
    currency: charge.currency,
    club_share_minor: gross - platformFee,
    platform_fee_minor: platformFee,
    provider_fee_minor: bt.fee ?? null,
    fee_model_applied: offering.fee_model,
    fee_bps_applied: offering.fee_bps,
    club_fixed_minor_applied: offering.club_fixed_minor,
    status: 'succeeded',
    occurred_at: toIso(charge.created as number),
  });
  if (insErr) throw new Error(`transaksjonsinnsetting: ${insErr.message}`);

  await syncSubscription(admin, row, subDetails.subscription as string);
  return {outcome: 'processed', note: `charge ${charge.id} registrert`};
}

async function onInvoicePaymentFailed(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const invoice = event.data.object as StripeObject;
  const subDetails = invoice.parent?.subscription_details;
  const row = await resolveSubRow(admin, {
    subscriptionId: subDetails?.subscription,
    metadataId: subDetails?.metadata?.support_subscription_id,
  });
  if (!row) {
    return {
      outcome: 'skipped',
      note: `faktura ${invoice.id} uten kjent abonnement`,
    };
  }
  // Ingen transaksjonsrad — ingen penger flyttet seg. Purreløpet eies
  // av Stripe; vi synker bare abonnementet (→ past_due når API-et sier det).
  if (subDetails?.subscription) {
    await syncSubscription(admin, row, subDetails.subscription as string);
  }
  return {outcome: 'processed'};
}

// Felles for refund/dispute: finn transaksjonen via charge-id.
async function findTxnByCharge(
  admin: SupabaseClient,
  chargeId: string,
): Promise<{id: string; status: string} | null> {
  const {data} = await admin
    .from('payment_transactions')
    .select('id, status')
    .eq('provider', 'stripe')
    .eq('provider_charge_id', chargeId)
    .maybeSingle();
  return data as {id: string; status: string} | null;
}

async function onChargeRefunded(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const chargeId = event.data.object?.id as string;
  const txn = await findTxnByCharge(admin, chargeId);
  if (!txn) return {outcome: 'skipped', note: `ukjent charge ${chargeId}`};

  // Fresh tilstand — refunded_minor akkumulerer hos Stripe, ikke hos oss.
  const charge = await stripeGet(`/v1/charges/${chargeId}`);
  const target = charge.refunded
    ? 'refunded'
    : (charge.amount_refunded as number) > 0
      ? 'partially_refunded'
      : txn.status;

  const patch: Record<string, unknown> = {
    refunded_minor: charge.amount_refunded ?? 0,
  };
  // Fremover-vakten: en refund rører aldri en dispute-status.
  if (TXN_RANK[target] > TXN_RANK[txn.status]) patch.status = target;

  const {error} = await admin
    .from('payment_transactions')
    .update(patch)
    .eq('id', txn.id);
  if (error) throw new Error(`refund-oppdatering: ${error.message}`);
  return {outcome: 'processed'};
}

async function onDisputeCreated(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const dispute = event.data.object as StripeObject;
  const txn = await findTxnByCharge(admin, dispute.charge as string);
  if (!txn) return {outcome: 'skipped', note: `ukjent charge ${dispute.charge}`};

  if (TXN_RANK.disputed > TXN_RANK[txn.status]) {
    const {error} = await admin
      .from('payment_transactions')
      .update({status: 'disputed'})
      .eq('id', txn.id);
    if (error) throw new Error(`dispute-oppdatering: ${error.message}`);
  }
  return {outcome: 'processed'};
}

async function onDisputeClosed(
  admin: SupabaseClient,
  event: StripeObject,
): Promise<HandlerResult> {
  const dispute = event.data.object as StripeObject;
  const txn = await findTxnByCharge(admin, dispute.charge as string);
  if (!txn) return {outcome: 'skipped', note: `ukjent charge ${dispute.charge}`};

  const target =
    dispute.status === 'won'
      ? 'dispute_won'
      : dispute.status === 'lost'
        ? 'dispute_lost'
        : null;
  if (!target) {
    return {
      outcome: 'processed',
      note: `dispute lukket med status «${dispute.status}» — ingen endring`,
    };
  }
  // NB (policy, fase 0-funn P11): ved TAPT dispute skal klubbens
  // transfer reverseres — det er en bevisst OPS-HANDLING, aldri en
  // automatisk webhook-bivirkning. Raden her er varselet.
  const {error} = await admin
    .from('payment_transactions')
    .update({status: target})
    .eq('id', txn.id);
  if (error) throw new Error(`dispute-lukking: ${error.message}`);
  return {outcome: 'processed', note: `→ ${target}`};
}

const HANDLERS: Record<
  string,
  (admin: SupabaseClient, event: StripeObject) => Promise<HandlerResult>
> = {
  'account.updated': onAccountUpdated,
  'checkout.session.completed': onCheckoutCompleted,
  'checkout.session.expired': onCheckoutExpired,
  'customer.subscription.created': onSubscriptionEvent,
  'customer.subscription.updated': onSubscriptionEvent,
  'customer.subscription.deleted': onSubscriptionEvent,
  'invoice.paid': onInvoicePaid,
  'invoice.payment_failed': onInvoicePaymentFailed,
  'charge.refunded': onChargeRefunded,
  'charge.dispute.created': onDisputeCreated,
  'charge.dispute.closed': onDisputeClosed,
};

// ------------------------------------------------------------
// Selve endepunktet.
// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  const secrets = [
    Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET'),
  ].filter((s): s is string => !!s);

  const payload = await req.text();
  const ok = await verifyStripeSignature(
    payload,
    req.headers.get('stripe-signature'),
    secrets,
  );
  if (!ok) return new Response('Invalid signature', {status: 400});

  let event: StripeObject;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('Malformed payload', {status: 400});
  }
  if (!event?.id || !event?.type) {
    return new Response('Not an event', {status: 400});
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Idempotensvakten: én rad per (provider, event_id) ---
  const {data: claimed, error: claimErr} = await admin
    .from('webhook_events')
    .upsert(
      {
        provider: 'stripe',
        event_id: event.id,
        event_type: event.type,
        api_version: event.api_version ?? null,
        payload: event,
      },
      {onConflict: 'provider,event_id', ignoreDuplicates: true},
    )
    .select('id, attempts')
    .maybeSingle();
  if (claimErr) {
    return new Response(`Claim error: ${claimErr.message}`, {status: 500});
  }

  let row = claimed as {id: string; attempts: number} | null;
  if (!row) {
    // Duplikat-leveranse. Ferdigbehandlet → kvitter 200 uten å røre noe;
    // failed/received → reprosesser (konvergente handlers gjør det trygt).
    const {data: existing} = await admin
      .from('webhook_events')
      .select('id, status, attempts')
      .eq('provider', 'stripe')
      .eq('event_id', event.id)
      .maybeSingle();
    if (!existing) {
      return new Response('Claim race lost', {status: 500});
    }
    if (existing.status === 'processed' || existing.status === 'skipped') {
      return json({received: true, duplicate: true});
    }
    row = existing as {id: string; attempts: number};
  }

  const handler = HANDLERS[event.type as string];
  try {
    const result: HandlerResult = handler
      ? await handler(admin, event)
      : // Abonnerer vi ikke bevisst — men kvitter og logg i stedet for 500.
        {outcome: 'skipped', note: 'uhåndtert hendelsestype'};

    await admin
      .from('webhook_events')
      .update({
        status: result.outcome,
        // error-kolonnen bærer også skip-/prosesseringsnotatet — det er
        // driftssporet vårt, ikke bare feil.
        error: result.note ?? null,
        attempts: (row.attempts ?? 0) + 1,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    return json({received: true, outcome: result.outcome});
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from('webhook_events')
      .update({
        status: 'failed',
        error: message,
        attempts: (row.attempts ?? 0) + 1,
      })
      .eq('id', row.id);
    // 500 → Stripe reprøver med samme event_id → failed-grenen over.
    return new Response(`Handler error: ${message}`, {status: 500});
  }
});
