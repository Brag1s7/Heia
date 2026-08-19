// ============================================================
// submit-club-claim — server-side Brønnøysund-håndhevelse for
// «Aktiver støtte for [klubb]» (autoritetsmodellen v2, II.10).
//
// Før v2 bodde blokkeringen av ugyldige orgnr KUN i klienten
// (src/lib/brreg.ts) — serveren hadde bare mod 11. Denne tynne
// wrappen gjør håndhevelsen klient-uavhengig (app OG web kaller
// hit), så en ny klient aldri kan senke listen:
//
//   1. Slår opp orgnr i Enhetsregisteret (åpent API, 6 s timeout).
//      Finnes ikke → 400. Slettet/konkurs/under avvikling → 400.
//      Registeret er autoritativt for juridisk navn.
//      NEDETID BLOKKERER ALDRI (fail-open — claim-notify-beviset og
//      den manuelle reviewen fanger det; dagens prinsipp).
//   2. Kaller submit_club_claim-RPC-en MED BRUKERENS JWT — alle
//      vaktene der (lagadmin-gate, duplikatvernene per klubbrad OG
//      per orgnr, nominasjonsvalidering) gjelder uendret.
//
// Klientens eget brreg-oppslag beholdes som UX (navne-prefill og
// umiddelbar feilmelding); dev-bygg har en direkte-RPC-vei for
// testdata («Send likevel») — prod-appen går alltid hit.
//
// verify_jwt = true (config.toml).
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';

const BRREG = 'https://data.brreg.no/enhetsregisteret/api';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

async function fetchEnhet(org: string): Promise<Json | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${BRREG}/enheter/${org}`, {
      signal: ctrl.signal,
      headers: {Accept: 'application/json'},
    });
    if (res.status === 404) return {notFound: true};
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}}},
  );
  const {
    data: {user},
  } = await userClient.auth.getUser();
  if (!user) return json({error: 'Ikke innlogget.'}, 401);

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({error: 'Ugyldig forespørsel.'}, 400);
  }

  const org = String(body?.org_number ?? '').replace(/[^0-9]/g, '');
  if (org.length !== 9) {
    return json({error: 'Organisasjonsnummeret skal ha 9 siffer.'}, 400);
  }

  // Server-side registerhåndhevelse (fail-open ved nedetid).
  let legalName = String(body?.legal_name ?? '').trim();
  const enhet = await fetchEnhet(org);
  if (enhet?.notFound) {
    return json(
      {
        error:
          `${org} finnes ikke i Brønnøysundregistrene. Sjekk sifrene — ` +
          'nummeret står på klubbens side på brreg.no.',
      },
      400,
    );
  }
  if (enhet && !enhet.notFound) {
    const flags: string[] = [];
    if (enhet.slettedato) flags.push('slettet');
    if (enhet.konkurs) flags.push('konkurs');
    if (enhet.underAvvikling) flags.push('under avvikling');
    if (flags.length > 0) {
      return json(
        {
          error: `${enhet.navn ?? 'Organisasjonen'} er ${flags.join(' og ')} i Brønnøysundregistrene og kan ikke motta støtte.`,
        },
        400,
      );
    }
    if (enhet.navn) legalName = String(enhet.navn); // registeret er autoritativt
  }

  const {data, error} = await userClient.rpc('submit_club_claim', {
    p_club_id: body?.club_id,
    p_org_number: org,
    p_legal_name: legalName,
    p_role: body?.role,
    p_contact_email: body?.contact_email,
    p_contact_phone: body?.contact_phone ?? null,
    p_nominee_is_self: body?.nominee_is_self ?? true,
    p_nominee_name: body?.nominee_name ?? null,
    p_nominee_email: body?.nominee_email ?? null,
    p_nominee_phone: body?.nominee_phone ?? null,
  });

  if (error) {
    return json({error: error.message}, 400);
  }
  return json({claim_id: data});
});
