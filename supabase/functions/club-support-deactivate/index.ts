// ============================================================
// club-support-deactivate — KLUBBDØREN (00047, se docs/PAYMENTS.md
// §Åpne beslutninger «KLUBBDØREN» pkt. 6).
//
// «Deaktiver støtte for laget»: nye checkouts stoppes + eksisterende
// abonnementer settes til kansellering ved periodeslutt. Ingen
// refusjon av allerede betalt periode. Presist språk — aldri
// «revoke» når abonnementer består.
//
// Rekkefølgen: DB FØRST (deactivate_team_support_data — arkiverer
// offeringen atomisk, logger handlingen, returnerer abonnements-
// listen; rollen sjekkes også der), SÅ Stripe per abonnement
// (cancel_at_period_end = true). Webhookene (fase 2) bokfører
// cancel_at i support_subscriptions — retur herfra beviser
// ingenting, som alltid.
//
// Idempotent: et nytt kall arkiverer ingenting (alt arkivert),
// returnerer samme abonnementsliste (radene flippes først av
// webhooken) og cancel_at_period_end=true er trygt å gjenta.
//
// verify_jwt = true: innlogget bruker; betalingsansvarlig-rollen
// er vakten (DB-siden håndhever den).
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

  let teamSpaceId: string | undefined;
  let note: string | undefined;
  try {
    const body = await req.json();
    teamSpaceId = body?.team_space_id;
    note = typeof body?.note === 'string' ? body.note : undefined;
  } catch {
    // faller gjennom til 400 under
  }
  if (!teamSpaceId) return json({error: 'team_space_id mangler.'}, 400);

  const admin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // DB-siden i én transaksjon: rolle-vakt + arkivering + logg.
  const {data, error} = await admin.rpc('deactivate_team_support_data', {
    p_team_space_id: teamSpaceId,
    p_actor_user_id: user.id,
    p_note: note ?? null,
  });
  if (error) {
    return json({error: error.message}, 403);
  }

  const subIds = (data?.subscription_ids ?? []) as string[];

  // Stripe per abonnement — enkeltfeil velter ikke resten; et nytt
  // kall tar dem som gjenstår.
  let canceled = 0;
  const failed: string[] = [];
  for (const id of subIds) {
    try {
      await stripePost(`/v1/subscriptions/${id}`, {
        cancel_at_period_end: 'true',
      });
      canceled += 1;
    } catch (e) {
      console.error(`club-support-deactivate: ${id}:`, e);
      failed.push(id);
    }
  }

  if (failed.length > 0) {
    return json(
      {
        error:
          `Nye støttespillere er stoppet, men ${failed.length} av ` +
          `${subIds.length} abonnementer fikk ikke kontakt med Stripe — ` +
          'prøv «Deaktiver» en gang til.',
        count: subIds.length,
        canceled,
        failed: failed.length,
      },
      502,
    );
  }

  return json({count: subIds.length, canceled, failed: 0});
});
