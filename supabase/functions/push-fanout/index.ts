// ============================================================
// push-fanout — kalles av trigger'en notify_on_feed_post (pg_net)
// hver gang en feed-post som er verdt et varsel opprettes.
//
// ⚠️ ENDRET i 00023: funksjonen regner IKKE lenger ut mottakere og
// skriver IKKE `notifications`. Det gjør databasen selv, i samme
// transaksjon som posten — slik at inboxen virker uten vault, uten
// denne funksjonen og uten Apple-konto.
//
// Her gjenstår kun det plpgsql ikke kan: APNs HTTP/2 med signert JWT.
// Vi leser radene trigger'en alt har skrevet og sender push til dem.
// Da kan inbox og push ikke komme ut av synk — det er én mottakerliste.
//
// verify_jwt = false (se config.toml): funksjonen autentiserer seg
// selv ved å sammenligne Bearer-tokenet mot SERVICE_ROLE_KEY. Kun
// trigger'en (som leser nøkkelen fra vault) kjenner den.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {
  apnsConfigFromEnv,
  sendApns,
  type ApnsPayload,
} from '../_shared/apns.ts';

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const url = Deno.env.get('SUPABASE_URL')!;

  // Selv-autentisering: kun kall med service-nøkkelen slipper gjennom.
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', {status: 401});
  }

  let feedPostId: string | undefined;
  try {
    feedPostId = (await req.json())?.feed_post_id;
  } catch {
    // faller gjennom til 400 under
  }
  if (!feedPostId) {
    return new Response('Missing feed_post_id', {status: 400});
  }

  const admin = createClient(url, serviceKey);

  // --- Mottakerne er allerede bestemt: én notifications-rad per person ---
  // pg_net sender først etter commit, så radene finnes når vi kommer hit.
  const {data: notifs, error: notifErr} = await admin
    .from('notifications')
    .select('user_id, title, body, data')
    .eq('source_entity_type', 'feed_post')
    .eq('source_entity_id', feedPostId);

  if (notifErr) {
    return new Response(`Notifications error: ${notifErr.message}`, {
      status: 500,
    });
  }

  if (!notifs || notifs.length === 0) {
    // Ingen mottakere (f.eks. ett-medlems lag) — ikke en feil.
    return new Response(JSON.stringify({recipients: 0}), {
      headers: {'Content-Type': 'application/json'},
    });
  }

  const targets = Array.from(new Set(notifs.map((n) => n.user_id as string)));

  // Tittel/kropp er identisk på alle radene — trigger'en satte dem én gang.
  const first = notifs[0];
  const data = (first.data ?? {}) as Record<string, string | null>;
  const title = first.title as string;
  const body = first.body as string;

  const cfg = apnsConfigFromEnv();
  if (!cfg) {
    // Ikke konfigurert ennå: inboxen står allerede, push hoppes over.
    return new Response(
      JSON.stringify({recipients: targets.length, apns: 'not_configured'}),
      {headers: {'Content-Type': 'application/json'}},
    );
  }

  const {data: tokens} = await admin
    .from('device_tokens')
    .select('token, platform')
    .in('user_id', targets)
    .eq('platform', 'ios');

  const payload: ApnsPayload = {
    title,
    body,
    threadId: data.team_space_id ?? undefined,
    data: {
      feed_post_id: data.feed_post_id ?? feedPostId,
      event_id: data.event_id ?? null,
      team_space_id: data.team_space_id ?? null,
    },
  };

  const results = await Promise.all(
    (tokens ?? []).map((t) => sendApns(cfg, t.token as string, payload)),
  );

  // Døde tokens ryddes bort så vi ikke prøver dem igjen.
  const gone = results.filter((r) => !r.ok && r.gone).map((r) => r.token);
  if (gone.length > 0) {
    await admin.from('device_tokens').delete().in('token', gone);
  }

  const sent = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({
      recipients: targets.length,
      tokens: results.length,
      sent,
      removed: gone.length,
    }),
    {headers: {'Content-Type': 'application/json'}},
  );
});
