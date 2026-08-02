// ============================================================
// stripe-checkout-return — landingsside for Checkout-sesjonens
// success_url/cancel_url (fase 4). Samme bro som
// stripe-onboarding-return: Stripe krever HTTPS, Heia mangler
// eget domene (åpen fase 4/6-beslutning) — og Supabase omskriver
// text/html fra funksjonsdomenet (fase 3-funnet), så REN TEKST
// med eksplisitt charset til domenet finnes.
//
// Retur BEVISER INGENTING (fase 2-prinsippet): success-siden sier
// «behandles», aldri «bekreftet» — statusen i appen flyttes av
// webhookene (invoice.paid / subscription-hendelsene).
//
// verify_jwt = false: Stripe redirecter en nettleser hit uten
// Supabase-JWT. Siden er statisk og leser ingen data.
// ============================================================

const SUCCESS_TEXT = `💚 Tusen takk for støtten!

Betalingen behandles hos Stripe.

Du kan lukke denne siden og gå tilbake
til Heia-appen — der ser du statusen
under «Støtt laget» om et lite øyeblikk.`;

const CANCEL_TEXT = `Ingen betaling ble gjennomført.

Du kan lukke denne siden og gå tilbake
til Heia-appen.

Ombestemmer du deg, står «Støtt laget»-
knappen klar når som helst. 💚`;

// Retur fra Customer Portal (fase 5 — «Min støtte» på Profil).
const PORTAL_TEXT = `💚 Alt lagret!

Du kan lukke denne siden og gå tilbake
til Heia-appen.

Endringer i støtten din oppdaterer seg
der om et lite øyeblikk.`;

Deno.serve((req) => {
  const flow = new URL(req.url).searchParams.get('flow');
  const text =
    flow === 'cancel' ? CANCEL_TEXT : flow === 'portal' ? PORTAL_TEXT : SUCCESS_TEXT;
  return new Response(text, {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
});
