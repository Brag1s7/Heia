// ============================================================
// stripe-onboarding-return — landingsside for Stripe-onboardingens
// return_url/refresh_url (fase 3). Stripe krever HTTPS-URL-er, og
// Heia har ikke eget domene ennå (åpen fase 4/6-beslutning:
// Universal Links) — en offentlig Edge Function er broen.
//
// Retur BEVISER INGENTING (fase 2-prinsippet: webhooks er eneste
// sannhetskilde) — siden sier derfor kun «gå tilbake til appen»;
// status i appen flyttes av account.updated.
//
// verify_jwt = false: Stripe redirecter en nettleser hit uten
// Supabase-JWT. Siden er statisk og leser ingen data.
// ============================================================

const page = (title: string, body: string) => `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Heia</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: flex;
      align-items: center; justify-content: center;
      background: #F6F3EC; color: #1E2B25;
      font-family: -apple-system, system-ui, sans-serif;
      text-align: center; padding: 24px;
    }
    .card { max-width: 420px; }
    .dot {
      width: 64px; height: 64px; border-radius: 50%;
      background: #C9F2DC; margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
    }
    h1 { font-size: 22px; margin: 0 0 10px; }
    p { font-size: 16px; line-height: 1.5; margin: 0; color: #4A5A52; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot">💚</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;

Deno.serve((req) => {
  const flow = new URL(req.url).searchParams.get('flow');
  const html =
    flow === 'refresh'
      ? page(
          'Lenken er utløpt',
          'Onboarding-lenker fra Stripe varer bare en kort stund. Gå tilbake til Heia-appen og trykk «Fortsett hos Stripe» på nytt for å få en fersk lenke.',
        )
      : page(
          'Takk!',
          'Du kan lukke denne siden og gå tilbake til Heia-appen. Statusen der oppdaterer seg av seg selv om et lite øyeblikk.',
        );
  return new Response(html, {
    headers: {'Content-Type': 'text/html; charset=utf-8'},
  });
});
