// ============================================================
// payments-notify — varslingsnavet for autoritetsmodellen v2
// (00062/00063, se docs/AUTORITET-KLUBBBETALINGER-2026-08.md II.9).
//
// Kalles av notify_payments_event() i Postgres (pg_net, vault-
// idiomet fra 00044) og autentiseres med service-nøkkelen — som
// claim-notify. Én funksjon, `type`-felt:
//
//   invitation / reminder  → e-post til den inviterte. TOKEN-
//     EIERSKAPET (B3) bor HER: 256-bit rå-token genereres i dette
//     øyeblikket, KUN SHA-256-hashen skrives på invitasjonsraden,
//     og rå-tokenet lever bare i minnet + e-posten (aldri i DB
//     eller pg_net-køen). Reminder ROTERER hashen (gammel lenke
//     dør — e-posten sier det). sent_at/reminded_at settes først
//     etter Resend-OK, så en feilet utsendelse er synlig (ops)
//     og reminder-cronen prøver igjen.
//     Lenken: WEB_INVITE_BASE_URL + '#' + token (fragment — når
//     aldri serverlogger). Uten secret: skip — utsendelsen er
//     strukturelt gated på at web-landingen finnes.
//   accepted        → e-post til øvrige aktive ansvarlige.
//   manager_issued  → e-post til øvrige aktive ansvarlige (B5:
//     INGEN rutinemessig ops-kopi — ops ser flaten/loggen).
//   review_needed   → ops: innløsning med identitetsavvik
//     (rollen er IKKE aktiv — venter ops-beslutning).
//   managerless     → ops: enhet uten aktiv betalingsansvarlig.
//   team_request    → e-post til alle aktive ansvarlige (inbox/
//     push tas av RPC-en — e-posten finnes for web-only-managere).
//   team_request_no_manager → ops (fallback-mottakeren: ingen
//     forespørsel forsvinner til null mottakere).
//   security        → ops (f.eks. forsøk fra suspendert utsteder).
//
// Mangler RESEND_API_KEY → skip (aldri feile en DB-transaksjon på
// varsling). Norsk tekst; minimalt innhold — aldri KYC-/bankdata.
// ============================================================
import {createClient} from 'jsr:@supabase/supabase-js@2';

const OPS_TO = 'hello@heiaapp.no';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sendMail(
  to: string[],
  subject: string,
  text: string,
): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key || to.length === 0) {
    console.log('payments-notify: hopper over e-post', {subject, to: to.length});
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Heia <onboarding@resend.dev>',
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error('payments-notify: Resend', res.status, await res.text());
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', {status: 401});
  }

  let body: Json;
  try {
    body = await req.json();
    if (!body?.type) throw new Error('type mangler');
  } catch {
    return new Response('Bad Request', {status: 400});
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // ── oppslags-hjelpere ──────────────────────────────────────
  const entityName = async (id: string): Promise<string> => {
    const {data} = await admin
      .from('legal_club_entities')
      .select('legal_name')
      .eq('id', id)
      .maybeSingle();
    return (data?.legal_name as string) ?? 'klubben';
  };

  // Aktive ansvarliges konto-e-poster (auth.users via admin-API).
  const managerEmails = async (
    entityId: string,
    excludeUserId?: string,
  ): Promise<string[]> => {
    const {data} = await admin
      .from('club_payment_managers')
      .select('user_id')
      .eq('legal_club_entity_id', entityId)
      .eq('status', 'active');
    const out: string[] = [];
    for (const row of data ?? []) {
      if (excludeUserId && row.user_id === excludeUserId) continue;
      const {data: u} = await admin.auth.admin.getUserById(row.user_id);
      if (u?.user?.email) out.push(u.user.email);
    }
    return out;
  };

  const type = String(body.type);

  try {
    // ── invitasjon + påminnelse: token-generering + utsendelse ──
    if (type === 'invitation' || type === 'reminder') {
      const {data: inv} = await admin
        .from('manager_invitations')
        .select('*')
        .eq('id', body.invitation_id)
        .maybeSingle();
      if (!inv) return new Response('unknown invitation', {status: 200});
      if (inv.status !== 'pending') {
        return new Response('not pending', {status: 200});
      }

      const base = Deno.env.get('WEB_INVITE_BASE_URL');
      if (!base) {
        console.log('payments-notify: WEB_INVITE_BASE_URL mangler — skip', inv.id);
        return new Response('skipped (no web landing)', {status: 200});
      }

      const legal = await entityName(inv.legal_club_entity_id);
      const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const hash = await sha256hex(token);

      // invitation: kun første gang (token_hash IS NULL) ELLER
      // reparasjon av feilet utsendelse (sent_at IS NULL).
      // reminder: roterer hashen på en alt utsendt invitasjon.
      let q = admin
        .from('manager_invitations')
        .update({token_hash: hash})
        .eq('id', inv.id)
        .eq('status', 'pending');
      if (type === 'invitation') q = q.is('sent_at', null);
      const {data: upd} = await q.select('id');
      if (!upd || upd.length === 0) {
        return new Response('token not rotated (already sent?)', {status: 200});
      }

      const link = `${base.replace(/\/$/, '')}#${token}`;
      const intro =
        type === 'reminder'
          ? 'En påminnelse: du er invitert som betalingsansvarlig i Heia. ' +
            'Denne lenken ERSTATTER den forrige — bruk denne.\n\n'
          : '';
      const ok = await sendMail(
        [inv.invited_email],
        `Bli betalingsansvarlig for ${legal} i Heia`,
        `Hei ${inv.invited_name},

${intro}${legal} er godkjent for supporterstøtte i Heia-appen, og du er ` +
          `foreslått som betalingsansvarlig — den i klubben som godkjenner ` +
          `hvilke lag som samler inn støtte, og som fullfører klubbens ` +
          `registrering hos Stripe (som håndterer utbetalingene).

Godta eller avslå her (lenken er personlig og varer i 14 dager):
${link}

Du trenger en Heia-konto — du kan opprette den i samme steg.
Rollen gir aldri innsyn i hvem som støtter, og prisen er fast for alle.

Lurer du på noe? Svar til hello@heiaapp.no.

Hilsen Heia`,
      );

      if (ok) {
        const stamp =
          type === 'reminder' ? {reminded_at: new Date().toISOString()} : {sent_at: new Date().toISOString()};
        await admin
          .from('manager_invitations')
          .update(stamp)
          .eq('id', inv.id);
      }
      return new Response(ok ? 'sent' : 'send failed', {status: 200});
    }

    // ── accepted: øvrige ansvarlige får e-post ─────────────────
    if (type === 'accepted') {
      const {data: inv} = await admin
        .from('manager_invitations')
        .select('legal_club_entity_id, invited_name, accepted_by')
        .eq('id', body.invitation_id)
        .maybeSingle();
      if (!inv) return new Response('unknown invitation', {status: 200});
      const legal = await entityName(inv.legal_club_entity_id);
      const to = await managerEmails(inv.legal_club_entity_id, inv.accepted_by);
      await sendMail(
        to,
        `Ny betalingsansvarlig for ${legal}`,
        `${inv.invited_name} har takket ja og er nå betalingsansvarlig for ${legal} i Heia.\n\nDu ser rollene under Klubbbetalinger.`,
      );
      return new Response('ok', {status: 200});
    }

    // ── manager_issued: øvrige ansvarlige (B5: ikke ops) ───────
    if (type === 'manager_issued') {
      const {data: inv} = await admin
        .from('manager_invitations')
        .select('legal_club_entity_id, invited_name, created_by')
        .eq('id', body.invitation_id)
        .maybeSingle();
      if (!inv) return new Response('unknown invitation', {status: 200});
      const legal = await entityName(inv.legal_club_entity_id);
      const to = await managerEmails(inv.legal_club_entity_id, inv.created_by);
      await sendMail(
        to,
        `Ny betalingsansvarlig invitert for ${legal}`,
        `En av klubbens betalingsansvarlige har invitert ${inv.invited_name} som betalingsansvarlig for ${legal} i Heia.\n\nRollen blir aktiv først når invitasjonen aksepteres. Mener du dette er feil, ta kontakt på hello@heiaapp.no.`,
      );
      return new Response('ok', {status: 200});
    }

    // ── review_needed: identitetsavvik → ops (rollen er IKKE aktiv)
    if (type === 'review_needed') {
      const {data: inv} = await admin
        .from('manager_invitations')
        .select('*')
        .eq('id', body.invitation_id)
        .maybeSingle();
      if (!inv) return new Response('unknown invitation', {status: 200});
      const legal = await entityName(inv.legal_club_entity_id);
      const m = (inv.mismatch ?? {}) as Json;
      await sendMail(
        [OPS_TO],
        `⚠️ Identitetsavvik: betalingsansvarlig for ${legal}`,
        `En invitasjon som betalingsansvarlig for ${legal} ble innløst av en konto som IKKE matcher den inviterte e-postadressen. Rollen er IKKE aktivert — den venter på din beslutning i Heia Ops (Klubber og roller).

Invitert:   ${inv.invited_name} <${inv.invited_email}>
Innløst av: ${m.profile_name ?? '(ukjent navn)'} <${m.account_email ?? '?'}>
Navnematch: ${m.name_match ? 'JA (beslutningsstøtte, aldri fasit)' : 'NEI'}

Bekreft eller avvis i appen: Profil → Heia internt → Klubber og roller.
Invitasjons-id: ${inv.id}`,
      );
      return new Response('ok', {status: 200});
    }

    // ── managerless: enhet uten aktiv ansvarlig → ops ──────────
    if (type === 'managerless') {
      const legal = await entityName(body.legal_club_entity_id);
      await sendMail(
        [OPS_TO],
        `⚠️ ${legal} står uten betalingsansvarlig`,
        `${legal} har ingen aktiv betalingsansvarlig (årsak: ${body.reason ?? 'ukjent'}).

Lagforespørsler har ingen mottaker før en ny ansvarlig er på plass.
Inviter en ny fra Heia Ops (Klubber og roller) når klubben har pekt ut en person.`,
      );
      return new Response('ok', {status: 200});
    }

    // ── lagforespørsler ────────────────────────────────────────
    if (type === 'team_request' || type === 'team_request_no_manager') {
      const {data: appr} = await admin
        .from('team_support_approvals')
        .select('id, club_id, team_space_id')
        .eq('id', body.approval_id)
        .maybeSingle();
      if (!appr) return new Response('unknown approval', {status: 200});
      const {data: ts} = await admin
        .from('team_spaces')
        .select('display_name')
        .eq('id', appr.team_space_id)
        .maybeSingle();
      const teamName = (ts?.display_name as string) ?? 'Et lag';
      const {data: link} = await admin
        .from('club_legal_entity_links')
        .select('legal_club_entity_id')
        .eq('club_id', appr.club_id)
        .eq('status', 'active')
        .maybeSingle();
      const legal = link
        ? await entityName(link.legal_club_entity_id)
        : 'klubben';

      if (type === 'team_request_no_manager') {
        await sendMail(
          [OPS_TO],
          `⚠️ Lagforespørsel uten mottaker: ${teamName}`,
          `«${teamName}» ber om godkjenning for støtte, men ${legal} har ingen aktiv betalingsansvarlig.\n\nForespørselen ligger og venter. Få en ansvarlig på plass via Heia Ops (Klubber og roller).`,
        );
      } else if (link) {
        const to = await managerEmails(link.legal_club_entity_id);
        await sendMail(
          to,
          `${teamName} ber om godkjenning for støtte`,
          `«${teamName}» vil samle inn supporterstøtte for ${legal}.\n\nGodkjenn eller avslå under Klubbbetalinger på Profil i Heia-appen.`,
        );
      }
      return new Response('ok', {status: 200});
    }

    // ── security: unntak → ops ─────────────────────────────────
    if (type === 'security') {
      const legal = body.legal_club_entity_id
        ? await entityName(body.legal_club_entity_id)
        : '(ukjent enhet)';
      await sendMail(
        [OPS_TO],
        `⚠️ Sikkerhetsavvik: ${legal}`,
        `Hendelse: ${body.reason ?? 'ukjent'}\nBruker: ${body.user_id ?? '?'}\n\nSe hendelsesloggen i Heia Ops (Klubber og roller).`,
      );
      return new Response('ok', {status: 200});
    }

    console.log('payments-notify: ukjent type', type);
    return new Response('unknown type', {status: 200});
  } catch (e) {
    console.error('payments-notify:', e);
    return new Response('error', {status: 500});
  }
});
