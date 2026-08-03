// ============================================================
// claim-notify — kalles av trigger'en notify_on_club_claim
// (pg_net, 00044) hver gang en klubb søker aktivering.
//
// AUTORISASJONSKONTROLLEN (Brages presisering 2026-08-03):
// Stripe står for KYC — Heia står for å verifisere at SØKEREN har
// fullmakt til å representere klubben. Denne funksjonen automatiserer
// BEVISINNSAMLINGEN, aldri beslutningen:
//   1. Henter enheten fra Brønnøysunds åpne API (finnes den, stemmer
//      navnet, er organisasjonsformen et idrettslag, er den
//      slettet/konkurs).
//   2. Henter ROLLENE (styret er offentlig!) og sjekker om søkerens
//      profilnavn står der. Match = sterkt bevis; ikke-match beviser
//      INGENTING (kasserer/trener med reell fullmakt står ikke i
//      registeret) — da er kontaktveien registerets egen e-post/
//      telefon, som også står i e-posten.
//   3. Skriver registerutdraget på claim-raden (brreg_snapshot) så
//      beslutningsgrunnlaget er varig og revisjonsbart.
//   4. Sender alt til hello@heiaapp.no med approve-/reject-SQL-en
//      ferdig til å lime inn (registerets navn som autoritativt).
//
// Brønnøysund-kallene er best-effort med timeout: feiler registeret,
// sendes varselet likevel (uten bevis-seksjonen) — en søknad skal
// aldri bli liggende usett fordi et eksternt API var nede.
//
// verify_jwt = false (config.toml): som report-notify autentiserer
// funksjonen seg ved å sammenligne Bearer mot SERVICE_ROLE_KEY —
// kun trigger'en (vault) kjenner den.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';

const CLAIM_TO = 'hello@heiaapp.no';
const BRREG = 'https://data.brreg.no/enhetsregisteret/api';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

async function fetchJson(url: string, timeoutMs = 6000): Promise<Json | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
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

// Navnenormalisering for løs sammenligning: store bokstaver, kun
// bokstaver/tall/mellomrom, kollapsede mellomrom.
function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-ZÆØÅ0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Persons navn ↔ profilnavn: match når alle ordene i det ENE navnet
// finnes i det andre (tåler mellomnavn som mangler én av veiene).
function nameMatches(a: string, b: string): boolean {
  const wa = norm(a).split(' ').filter(Boolean);
  const wb = norm(b).split(' ').filter(Boolean);
  if (wa.length === 0 || wb.length === 0) return false;
  const inB = new Set(wb);
  const inA = new Set(wa);
  return wa.every((w) => inB.has(w)) || wb.every((w) => inA.has(w));
}

type RolePerson = {label: string; name: string; match: boolean};

function parseRoller(roller: Json | null, claimantName: string): RolePerson[] {
  const out: RolePerson[] = [];
  for (const gruppe of roller?.rollegrupper ?? []) {
    for (const rolle of gruppe?.roller ?? []) {
      if (rolle?.fratraadt) continue;
      const n = rolle?.person?.navn;
      if (!n) continue; // enhetsroller (revisor o.l.) er uinteressante her
      const name = [n.fornavn, n.mellomnavn, n.etternavn]
        .filter(Boolean)
        .join(' ');
      out.push({
        label: rolle?.type?.beskrivelse ?? rolle?.type?.kode ?? 'Rolle',
        name,
        match: claimantName ? nameMatches(name, claimantName) : false,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', {status: 401});
  }

  let record: Json;
  try {
    ({record} = await req.json());
    if (!record?.id) throw new Error('payload uten record');
  } catch {
    return new Response('Bad Request', {status: 400});
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // Søkerens profilnavn — det vi matcher mot registerets roller.
  const {data: claimant} = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', record.claimant_user_id)
    .maybeSingle();
  const claimantName = (claimant?.display_name as string | undefined) ?? '';

  const org = String(record.claimed_org_number ?? '');

  // --- Brønnøysund: enhet + roller (åpne API-er, best-effort) ---
  const enhet = await fetchJson(`${BRREG}/enheter/${org}`);
  const roller = enhet && !enhet.notFound
    ? await fetchJson(`${BRREG}/enheter/${org}/roller`)
    : null;

  let evidence: string;
  const snapshot: Json = {fetched_at: new Date().toISOString()};

  if (!enhet) {
    evidence = '⚠️ Fikk ikke kontakt med Brønnøysund — sjekk manuelt: ' +
      `https://virksomhet.brreg.no/nb/oppslag/enheter/${org}`;
    snapshot.error = 'brreg_unreachable';
  } else if (enhet.notFound) {
    evidence = `❌ ORGNR ${org} FINNES IKKE i Enhetsregisteret — avslå, ` +
      'eller be søkeren sjekke nummeret.';
    snapshot.not_found = true;
  } else {
    const regName = String(enhet.navn ?? '');
    const formKode = String(enhet.organisasjonsform?.kode ?? '?');
    const formTekst = String(enhet.organisasjonsform?.beskrivelse ?? '');
    const nameOk = nameMatches(regName, String(record.claimed_legal_name ?? ''));
    const flags: string[] = [];
    if (enhet.slettedato) flags.push(`SLETTET ${enhet.slettedato}`);
    if (enhet.konkurs) flags.push('KONKURS');
    if (enhet.underAvvikling) flags.push('UNDER AVVIKLING');

    const people = parseRoller(roller, claimantName);
    const matched = people.filter((p) => p.match);

    snapshot.enhet = {
      navn: regName,
      organisasjonsform: {kode: formKode, beskrivelse: formTekst},
      slettedato: enhet.slettedato ?? null,
      konkurs: !!enhet.konkurs,
      underAvvikling: !!enhet.underAvvikling,
      epostadresse: enhet.epostadresse ?? null,
      telefon: enhet.telefon ?? enhet.mobil ?? null,
    };
    snapshot.roller = people.map((p) => ({
      rolle: p.label,
      navn: p.name,
      match_soker: p.match,
    }));
    snapshot.checks = {
      navn_match: nameOk,
      soker_i_registeret: matched.length > 0,
    };

    const lines: string[] = [];
    lines.push(`Registeret:  ${regName} (${formKode} — ${formTekst})`);
    lines.push(
      nameOk
        ? '✓ Navnet stemmer med søknaden'
        : `✗ Søknaden skrev «${record.claimed_legal_name}» — bruk REGISTERETS navn ved godkjenning`,
    );
    lines.push(
      formKode === 'FLI'
        ? '✓ Organisasjonsform som forventet for idrettslag (FLI)'
        : `△ Organisasjonsform ${formKode} — er dette virkelig et idrettslag?`,
    );
    if (flags.length > 0) lines.push(`❌ FLAGG: ${flags.join(', ')} — avslå`);

    lines.push('');
    lines.push(`Autorisasjonen (søker: «${claimantName || 'ukjent profilnavn'}», oppgitt rolle: «${record.claimed_role}»):`);
    if (matched.length > 0) {
      for (const p of matched) {
        lines.push(`✓ SØKEREN STÅR I REGISTERET: ${p.label} — ${p.name}`);
      }
      lines.push('→ Sterkt bevis på fullmakt.');
    } else if (people.length > 0) {
      lines.push('✗ Søkeren står IKKE i registerets roller. Beviser ingenting');
      lines.push('  (kasserer/trener kan ha reell fullmakt) — verifiser via');
      lines.push('  klubbens registrerte kanal eller styret under.');
    } else {
      lines.push('△ Registeret har ingen roller å vise for enheten.');
    }
    if (people.length > 0) {
      lines.push('');
      lines.push('Registrerte roller:');
      for (const p of people) {
        lines.push(`  ${p.match ? '★' : '·'} ${p.label}: ${p.name}`);
      }
    }
    if (enhet.epostadresse || enhet.telefon || enhet.mobil) {
      lines.push('');
      lines.push('Klubbens registrerte kontakt (verifiseringskanal):');
      if (enhet.epostadresse) lines.push(`  E-post:  ${enhet.epostadresse}`);
      if (enhet.telefon) lines.push(`  Telefon: ${enhet.telefon}`);
      if (enhet.mobil) lines.push(`  Mobil:   ${enhet.mobil}`);
    }
    evidence = lines.join('\n');
  }

  // Beviset skrives på claim-raden uansett om e-posten går ut —
  // varig, revisjonsbart, og synlig i SQL-editoren ved review.
  await admin
    .from('club_claims')
    .update({brreg_snapshot: snapshot})
    .eq('id', record.id);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log('claim-notify: RESEND_API_KEY mangler — hopper over e-post');
    return new Response('skipped', {status: 200});
  }

  const opsLink = `heia://ops/claims/${record.id}`;
  const text = `En klubb har søkt om aktivering av støtte i Heia.

ÅPNE I HEIA OPS (på telefonen med Heia installert):
${opsLink}

Klubb (søknad): ${record.claimed_legal_name}
Orgnr:          ${org}
Søker:          ${claimantName || '(ukjent)'} — oppgitt rolle: ${record.claimed_role}
Kontakt:        ${record.contact_email ?? '(mangler)'}${record.contact_phone ? ` / ${record.contact_phone}` : ''}
Sendt:          ${record.created_at}
Claim-id:       ${record.id}

BESLUTNINGSGRUNNLAG (Brønnøysund, hentet automatisk — Stripe tar KYC,
Heia tar autorisasjonskontrollen; registermatch er bevis, aldri fasit):
----------------------------------------------------------------------
${evidence}
----------------------------------------------------------------------

Handlingene (Godkjenn / Be om mer informasjon / Avslå) gjøres i Heia
Ops-flaten i appen — godkjenning krever at du beskriver hvordan
autorisasjonen ble verifisert, og alt logges. SQL-editoren er kun
nødfallback (ops-runbooken i PAYMENTS.md §Fase 3).
`;

  // HTML-versjon: Mail gjør ikke custom-scheme-lenker i ren tekst
  // trykkbare — knappen her er selve inngangen til ops-flaten.
  const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="font-family:-apple-system,sans-serif;max-width:560px">
<h2 style="margin:0 0 4px">🏟 Klubbsøknad: ${esc(record.claimed_legal_name)}</h2>
<p style="margin:4px 0 16px;color:#555">Orgnr ${esc(org)} · Søker: ${esc(claimantName || '(ukjent)')} (${esc(record.claimed_role)}) · ${esc(record.contact_email ?? '')}</p>
<p style="margin:0 0 20px"><a href="${opsLink}" style="background:#02FFAB;color:#0B3B2E;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Åpne i Heia Ops →</a></p>
<pre style="background:#f6f6f2;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:13px">${esc(evidence)}</pre>
<p style="color:#888;font-size:12px">Godkjenn / Be om mer info / Avslå gjøres i appen — godkjenning krever verifisert autorisasjon og alt logges. Claim-id: ${esc(record.id)}</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Heia <onboarding@resend.dev>',
      to: [CLAIM_TO],
      subject: `🏟 Klubbsøknad i Heia: ${record.claimed_legal_name} (${org})`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    console.error('claim-notify: Resend svarte', res.status, await res.text());
    return new Response('resend error', {status: 502});
  }

  return new Response('ok', {status: 200});
});
