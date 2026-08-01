// ============================================================
// stripe-onboarding — fase 3 i betalingssporet (se docs/PAYMENTS.md).
//
// Kalles av LAGADMIN i appen etter at Heia har godkjent claimen
// (approve_club_claim). Gjør to ting, i klikkøyeblikket:
//   1. Oppretter Stripe-kontoen LAT ved første kall (kontoraden
//      finnes fra godkjenningen, provider_account_id er NULL til nå).
//      Idempotency-Key = kontorad-id: et dobbeltklikk/kappløp kan
//      aldri gi to Stripe-kontoer for samme enhet.
//   2. Genererer en Account Link (fase 0-funn #6: kortlevd — ALDRI
//      lagret, alltid generert på klikk) og returnerer URL-en.
//      Lenken åpnes i Safari og KAN videresendes (kasserer/
//      styreleder med reell fullmakt fullfører KYC-en).
//
// Kontoparametrene er nøyaktig fase 0-spikens (RUNBOOK steg 3,
// P1 bevist): controller-konfig = Express-tilsvarende, Stripe eier
// requirement-innsamlingen. statement_descriptor settes BEVISST ikke
// (standarden er en åpen fase 6-beslutning — Stripes onboarding
// avleder fra business_profile.name; mangler noe, sier requirements
// fra via account.updated).
//
// Statusen på kontoraden flyttes ALDRI her — det eier fase 2-
// webhooken (account.updated). Denne funksjonen skriver kun
// provider_account_id (write-once).
//
// verify_jwt = true (config.toml): innlogget bruker kreves; på
// toppen verifiseres lagadminskap mot memberships før noe skjer.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {stripePost} from '../_shared/stripe.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Hvem spør? JWT-en er alt verifisert av plattformen (verify_jwt),
  // men brukeren slås opp eksplisitt — adminsjekken under trenger id-en.
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

  // Kun lagadmin i laget får generere onboarding-lenker.
  const {data: membership} = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('team_space_id', teamSpaceId)
    .eq('status', 'active')
    .in('role', ['trener', 'lagleder', 'admin'])
    .maybeSingle();
  if (!membership) {
    return json({error: 'Bare trenere og lagledere kan gjøre dette.'}, 403);
  }

  // Kjeden team_space → team → club → aktiv link → enhet → konto.
  // Kontoraden finnes KUN etter godkjent claim — det er selve gaten.
  const {data: ts} = await admin
    .from('team_spaces')
    .select('team_id, teams(club_id)')
    .eq('id', teamSpaceId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const clubId = (ts?.teams as any)?.club_id as string | undefined;
  if (!clubId) return json({error: 'Fant ikke klubben til laget.'}, 404);

  const {data: link} = await admin
    .from('club_legal_entity_links')
    .select('legal_club_entity_id, legal_club_entities(verification_status, legal_name)')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const entity = link?.legal_club_entities as any;
  if (!link || !entity) {
    return json({error: 'Klubben er ikke godkjent for støtte ennå.'}, 409);
  }
  if (entity.verification_status !== 'verified') {
    return json({error: 'Klubbens godkjenning er ikke gyldig lenger.'}, 409);
  }

  const {data: account} = await admin
    .from('club_payment_accounts')
    .select('id, provider_account_id, status')
    .eq('legal_club_entity_id', link.legal_club_entity_id)
    .eq('provider', 'stripe')
    .maybeSingle();
  if (!account) {
    return json({error: 'Klubben mangler betalingskonto — kontakt Heia.'}, 409);
  }
  if (account.status === 'disabled') {
    return json(
      {error: 'Kontoen er sperret hos Stripe — kontakt Heia for oppfølging.'},
      409,
    );
  }

  try {
    let stripeAccountId = account.provider_account_id as string | null;

    if (!stripeAccountId) {
      // Fase 0-spikens kontooppsett (RUNBOOK steg 3), minus descriptor.
      const created = await stripePost(
        '/v1/accounts',
        {
          country: 'NO',
          business_type: 'non_profit',
          'controller[fees][payer]': 'application',
          'controller[losses][payments]': 'application',
          'controller[stripe_dashboard][type]': 'express',
          'controller[requirement_collection]': 'stripe',
          'capabilities[card_payments][requested]': 'true',
          'capabilities[transfers][requested]': 'true',
          'business_profile[name]': entity.legal_name as string,
        },
        `heia-acct-create-${account.id}`,
      );
      stripeAccountId = created.id as string;

      // Write-once: taper vi et kappløp, gjelder raden som alt vant
      // (idempotency-nøkkelen gjør uansett Stripe-kontoen til samme).
      const {data: updated} = await admin
        .from('club_payment_accounts')
        .update({provider_account_id: stripeAccountId})
        .eq('id', account.id)
        .is('provider_account_id', null)
        .select('id');
      if (!updated || updated.length === 0) {
        const {data: fresh} = await admin
          .from('club_payment_accounts')
          .select('provider_account_id')
          .eq('id', account.id)
          .single();
        stripeAccountId = fresh?.provider_account_id ?? stripeAccountId;
      }
    }

    // Kortlevd lenke, generert nå — landingssiden er en liten offentlig
    // søsterfunksjon (domene for Universal Links er en fase 4/6-sak).
    const landing = `${supabaseUrl}/functions/v1/stripe-onboarding-return`;
    const linkObj = await stripePost('/v1/account_links', {
      account: stripeAccountId!,
      type: 'account_onboarding',
      return_url: `${landing}?flow=return`,
      refresh_url: `${landing}?flow=refresh`,
    });

    return json({url: linkObj.url, expires_at: linkObj.expires_at ?? null});
  } catch (e) {
    console.error('stripe-onboarding:', e);
    return json(
      {error: 'Fikk ikke kontakt med Stripe akkurat nå — prøv igjen om litt.'},
      502,
    );
  }
});
