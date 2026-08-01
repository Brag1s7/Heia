// ============================================================
// stripe-onboarding-return — landingsside for Stripe-onboardingens
// return_url/refresh_url (fase 3). Stripe krever HTTPS-URL-er, og
// Heia har ikke eget domene ennå (åpen fase 4/6-beslutning:
// Universal Links) — en offentlig Edge Function er broen.
//
// PLATTFORMBEGRENSNING (funnet i fase 3-telefontesten): Supabase
// omskriver text/html-svar fra *.supabase.co-funksjonsdomenet til
// text/plain + `CSP sandbox` + nosniff (anti-phishing) — HTML kan
// KUN serveres fra eget domene. Derfor REN TEKST med eksplisitt
// charset (omskrivingen droppet charset → mojibake i Safari).
// Oppgraderes til ekte HTML-side når Heia-domenet finnes.
//
// Retur BEVISER INGENTING (fase 2-prinsippet: webhooks er eneste
// sannhetskilde) — siden sier derfor kun «gå tilbake til appen»;
// status i appen flyttes av account.updated.
//
// verify_jwt = false: Stripe redirecter en nettleser hit uten
// Supabase-JWT. Siden er statisk og leser ingen data.
// ============================================================

const RETURN_TEXT = `Takk!

Du kan lukke denne siden og gå tilbake til Heia-appen.
Statusen der oppdaterer seg av seg selv om et lite øyeblikk.`;

const REFRESH_TEXT = `Lenken er utløpt

Onboarding-lenker fra Stripe varer bare en kort stund.
Gå tilbake til Heia-appen og trykk «Fortsett hos Stripe» på nytt
for å få en fersk lenke.`;

Deno.serve((req) => {
  const flow = new URL(req.url).searchParams.get('flow');
  return new Response(flow === 'refresh' ? REFRESH_TEXT : RETURN_TEXT, {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
});
