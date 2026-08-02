// ============================================================
// report-notify — kalles av trigger'en notify_on_content_report
// (pg_net, 00043) hver gang noen rapporterer innhold til Heia.
//
// Sender ÉN e-post per rapport til hello@heiaapp.no via Resend, med
// alt som trengs for å vurdere saken (grunn, frossent innhold) og
// SQL-en som lukker den. Dette er hele moderasjonsrutinen: null
// arbeid til en e-post lander (Brages beslutning 2026-08-02).
//
// verify_jwt = false (se config.toml): som push-fanout autentiserer
// funksjonen seg selv ved å sammenligne Bearer-tokenet mot
// SERVICE_ROLE_KEY. Kun trigger'en (som leser nøkkelen fra vault)
// kjenner den.
//
// RESEND_FROM settes som secret når heiaapp.no er verifisert i
// Resend; frem til da bruker vi Resends onboarding-avsender, som kun
// kan sende til kontoens egen adresse — og det er akkurat dit vi
// skal (hello@heiaapp.no er Resend-kontoen).
// ============================================================

const REPORT_TO = 'hello@heiaapp.no';

const REASON_LABELS: Record<string, string> = {
  upassende: 'Upassende innhold',
  trakassering: 'Mobbing eller trakassering',
  annet: 'Annet',
};

const ENTITY_LABELS: Record<string, string> = {
  feed_post: 'innlegg',
  comment: 'kommentar',
};

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', {status: 401});
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    // Varsling er ikke konfigurert ennå — si det tydelig i loggen,
    // men svar 200 så pg_net ikke noterer feil for en kjent tilstand.
    console.log('report-notify: RESEND_API_KEY mangler — hopper over');
    return new Response('skipped', {status: 200});
  }

  let record: Record<string, unknown>;
  try {
    ({record} = await req.json());
    if (!record?.id) throw new Error('payload uten record');
  } catch {
    return new Response('Bad Request', {status: 400});
  }

  const reason = REASON_LABELS[String(record.reason)] ?? String(record.reason);
  const entity = ENTITY_LABELS[String(record.entity_type)] ??
    String(record.entity_type);
  const details = record.details ? String(record.details) : '(ingen)';
  const snapshot = record.content_snapshot
    ? String(record.content_snapshot)
    : '(ikke noe tekstinnhold — trolig et bilde)';

  const text = `Noen har rapportert et ${entity} i Heia.

Grunn:     ${reason}
Detaljer:  ${details}
Rapportert: ${record.created_at}
Sak-id:    ${record.id}

Innholdet (frosset ved rapporttidspunktet, består selv om det slettes):
----------------------------------------------------------------------
${snapshot}
----------------------------------------------------------------------

Forventningen (Apple 1.2) er reaksjon innen ~24 timer. Det meste kan
løses i appen: slett innholdet som trener/lagleder, eller la det stå.

Lukk saken i SQL-editoren (Supabase-dashboardet):

  UPDATE content_reports
  SET status = 'resolved', resolved_at = now(),
      resolution_note = '…hva du gjorde…'
  WHERE id = '${record.id}';

Full kontekst (hvem, hvilket lag) ved behov:

  SELECT * FROM content_reports WHERE id = '${record.id}';
`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Heia <onboarding@resend.dev>',
      to: [REPORT_TO],
      subject: `🚩 Rapport i Heia: ${reason} (${entity})`,
      text,
    }),
  });

  if (!res.ok) {
    console.error('report-notify: Resend svarte', res.status, await res.text());
    return new Response('resend error', {status: 502});
  }

  return new Response('ok', {status: 200});
});
