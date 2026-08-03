// ============================================================
// push-fanout — kalles av trg_push_on_notifications (pg_net, 00049)
// hver gang inbox-rader skrives i notifications-tabellen.
//
// ⚠️ ENDRET i 00049: kontrakten er {notification_ids: [...]} — ikke
// lenger {feed_post_id}. Databasen skriver inbox-radene selv i samme
// transaksjon som kilden (00023-prinsippet); her gjenstår kun det
// plpgsql ikke kan: APNs HTTP/2 med signert JWT. Vi leser radene
// triggeren peker på og pusher til eierne. Inbox og push kan dermed
// aldri komme ut av synk — det er én mottakerliste, og den dekker
// ALT som skriver notifications (feed, kommentarer, reaksjoner,
// hendelser, klubbdøren, alt fremtidig).
//
// verify_jwt = false (se config.toml): funksjonen autentiserer seg
// selv ved å sammenligne Bearer-tokenet mot SERVICE_ROLE_KEY. Kun
// triggeren (som leser nøkkelen fra vault) kjenner den.
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

  let ids: string[] = [];
  try {
    const parsed = (await req.json())?.notification_ids;
    if (Array.isArray(parsed)) {
      ids = parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // faller gjennom til 400 under
  }
  if (ids.length === 0) {
    return new Response('Missing notification_ids', {status: 400});
  }
  // Én statement er maks ett lags medlemsliste — 500 er romslig vern.
  ids = ids.slice(0, 500);

  const admin = createClient(url, serviceKey);

  // pg_net sender først etter commit, så radene finnes når vi kommer hit.
  const {data: notifs, error: notifErr} = await admin
    .from('notifications')
    .select('id, user_id, title, body, data')
    .in('id', ids);

  if (notifErr) {
    return new Response(`Notifications error: ${notifErr.message}`, {
      status: 500,
    });
  }
  if (!notifs || notifs.length === 0) {
    return new Response(JSON.stringify({recipients: 0}), {
      headers: {'Content-Type': 'application/json'},
    });
  }

  const cfg = apnsConfigFromEnv();
  if (!cfg) {
    // Ikke konfigurert ennå: inboxen står allerede, push hoppes over.
    return new Response(
      JSON.stringify({recipients: notifs.length, apns: 'not_configured'}),
      {headers: {'Content-Type': 'application/json'}},
    );
  }

  const targets = Array.from(new Set(notifs.map((n) => n.user_id as string)));
  const {data: tokens} = await admin
    .from('device_tokens')
    .select('user_id, token')
    .in('user_id', targets)
    .eq('platform', 'ios');

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    const list = tokensByUser.get(t.user_id as string) ?? [];
    list.push(t.token as string);
    tokensByUser.set(t.user_id as string, list);
  }

  // Én push per inbox-rad per enhet. `data` sendes videre som den står —
  // appens push-lytter leser event_id m.m. flatt fra toppnivået, nøyaktig
  // slik radene allerede er skrevet (sendApns sprer data på toppnivå).
  //
  // Utsendingene går SEKVENSIELT med fangst per token. Parallelle kall mot
  // APNs fikk hele batchen til å kaste (én rejection → 500 → INGEN push,
  // heller ikke til friske enheter) — verifisert 2026-08-03: hvert token
  // svarte pent enkeltvis, kun flersending veltet. Volumet er et lags
  // medlemsliste, så sekvensielt koster ingenting; en død enhet skal aldri
  // kunne stoppe et lagvarsel.
  type SendOutcome =
    | Awaited<ReturnType<typeof sendApns>>
    | {token: string; ok: false; gone: false; error: string};
  const results: SendOutcome[] = [];
  for (const n of notifs) {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const payload: ApnsPayload = {
      title: n.title as string,
      body: n.body as string,
      threadId:
        typeof data.team_space_id === 'string' ? data.team_space_id : undefined,
      data,
    };
    for (const token of tokensByUser.get(n.user_id as string) ?? []) {
      try {
        results.push(await sendApns(cfg, token, payload));
      } catch (e) {
        results.push({
          token,
          ok: false,
          gone: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
  // Feilårsakene tas med i svaret: pg_net lagrer responsen i
  // net._http_response, så en feilet push kan diagnostiseres rett fra
  // databasen uten å grave i Edge-logger.
  const failures = results
    .filter((r) => !r.ok)
    .map((r) => ('error' in r ? r.error : `${r.status} ${r.reason ?? ''}`))
    .slice(0, 5);

  // Døde tokens ryddes bort så vi ikke prøver dem igjen.
  const gone = Array.from(
    new Set(results.filter((r) => !r.ok && r.gone).map((r) => r.token)),
  );
  if (gone.length > 0) {
    await admin.from('device_tokens').delete().in('token', gone);
  }

  const sent = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({
      notifications: notifs.length,
      recipients: targets.length,
      tokens: results.length,
      sent,
      removed: gone.length,
      ...(failures.length > 0 ? {failures} : {}),
    }),
    {headers: {'Content-Type': 'application/json'}},
  );
});
