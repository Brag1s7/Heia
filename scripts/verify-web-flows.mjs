#!/usr/bin/env node
// Positive flyttester for web-adminløsningen mot prod, med EGNE fixturer
// (tre throwaway-brukere, én klubbrad, én søknad m/ fiktivt orgnr
// 888888888, ett lag) som ryddes fullstendig etterpå. Fixtur-INSERT-ene
// kjøres som postgres med triggere av (ingen claim-e-post til hello@).
// Handlingene går gjennom NØYAKTIG de RPC-ene web-flatene bruker.
//
//   node scripts/verify-web-flows.mjs            # full runde + opprydding
//   node scripts/verify-web-flows.mjs --keep     # behold fixturer, skriv sesjoner til fil
//   node scripts/verify-web-flows.mjs --cleanup  # kun opprydding (etter --keep)
import {execSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createClient} from '../web/node_modules/@supabase/supabase-js/dist/index.mjs';

const REF = 'sswncdrbsrfieudkdmhj';
const URL_ = `https://${REF}.supabase.co`;
const ORG = '888888888';
const CLUB_NAME = 'VERIFY WEB IL (testfixtur)';
const KEEP = process.argv.includes('--keep');
const ONLY_CLEANUP = process.argv.includes('--cleanup');
const SESSION_FILE = process.argv.find((a) => a.startsWith('--sessions='))?.slice('--sessions='.length);

function mgmtToken() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -w', {encoding: 'utf8'}).trim();
  const prefix = 'go-keyring-base64:';
  return raw.startsWith(prefix) ? Buffer.from(raw.slice(prefix.length), 'base64').toString('utf8') : raw;
}
const TOKEN = mgmtToken();
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const keys = JSON.parse(execSync(`supabase projects api-keys --project-ref ${REF} -o json`, {encoding: 'utf8'}));
const anonKey = keys.find((k) => k.name === 'anon').api_key;
const serviceKey = keys.find((k) => k.name === 'service_role').api_key;
const admin = createClient(URL_, serviceKey, {auth: {persistSession: false}});

const results = [];
const check = (name, pass, detail = '') => { results.push({name, pass: !!pass, detail: String(detail).slice(0, 110)}); };
const finish = () => {
  const ok = results.filter((r) => r.pass).length;
  console.table(results);
  console.log(`verify-web-flows: ${ok}/${results.length} grønne`);
  return ok === results.length;
};

async function cleanup() {
  await sql(`
    -- Append-only-triggerne (audit/hendelseslogg) må av for at testdata skal
    -- kunne fjernes fullstendig. Kun for denne opprydningen, som postgres.
    SET session_replication_role = replica;
    DO $$
    DECLARE v_ent uuid; v_club uuid; v_users uuid[];
    BEGIN
      SELECT id INTO v_ent FROM public.legal_club_entities WHERE org_number = '${ORG}';
      SELECT id INTO v_club FROM public.clubs WHERE name = '${CLUB_NAME}';
      SELECT array_agg(id) INTO v_users FROM auth.users WHERE email LIKE 'verify-flow-%@example.test';
      IF v_ent IS NOT NULL THEN
        DELETE FROM public.payment_authority_events WHERE legal_club_entity_id = v_ent;
        DELETE FROM public.manager_invitations WHERE legal_club_entity_id = v_ent;
        DELETE FROM public.club_payment_managers WHERE legal_club_entity_id = v_ent;
        DELETE FROM public.club_support_defaults WHERE legal_club_entity_id = v_ent;
        DELETE FROM public.club_payment_accounts WHERE legal_club_entity_id = v_ent;
        DELETE FROM public.club_legal_entity_links WHERE legal_club_entity_id = v_ent;
      END IF;
      IF v_club IS NOT NULL THEN
        DELETE FROM public.team_support_approvals WHERE club_id = v_club;
        DELETE FROM public.club_claim_audit WHERE claim_id IN (SELECT id FROM public.club_claims WHERE club_id = v_club);
        DELETE FROM public.club_claims WHERE club_id = v_club;
        DELETE FROM public.memberships WHERE team_space_id IN (SELECT ts.id FROM public.team_spaces ts JOIN public.teams t ON t.id = ts.team_id WHERE t.club_id = v_club);
        DELETE FROM public.team_spaces WHERE team_id IN (SELECT id FROM public.teams WHERE club_id = v_club);
        DELETE FROM public.teams WHERE club_id = v_club;
        DELETE FROM public.clubs WHERE id = v_club;
      END IF;
      IF v_ent IS NOT NULL THEN DELETE FROM public.legal_club_entities WHERE id = v_ent; END IF;
      IF v_users IS NOT NULL THEN
        DELETE FROM public.ops_admins WHERE user_id = ANY(v_users);
        DELETE FROM public.payment_authority_events WHERE actor_user_id = ANY(v_users) OR subject_user_id = ANY(v_users);
      END IF;
    END $$;
    SET session_replication_role = origin;`);
  const {data} = await admin.auth.admin.listUsers({perPage: 1000});
  for (const u of data?.users ?? []) {
    if (u.email?.startsWith('verify-flow-') && u.email.endsWith('@example.test')) await admin.auth.admin.deleteUser(u.id);
  }
  const left = await sql(`select (select count(*) from public.legal_club_entities where org_number='${ORG}') ent, (select count(*) from public.clubs where name='${CLUB_NAME}') club, (select count(*) from auth.users where email like 'verify-flow-%@example.test') users`);
  check('opprydding: ingen fixturer igjen', left[0].ent === 0 && left[0].club === 0 && left[0].users === 0, JSON.stringify(left[0]));
}

if (ONLY_CLEANUP) {
  await cleanup();
  process.exit(finish() ? 0 : 1);
}

// ── Fixturer ──
const stamp = Date.now();
const pw = () => 'Vf-' + Math.random().toString(36).slice(2, 12) + 'x';
async function mkUser(tag, name) {
  const email = `verify-flow-${tag}-${stamp}@example.test`;
  const password = pw();
  const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true, user_metadata: {display_name: name}});
  if (error) throw error;
  const client = createClient(URL_, anonKey, {auth: {persistSession: false}});
  const {error: sErr} = await user_login(client, email, password);
  if (sErr) throw sErr;
  return {id: data.user.id, email, password, client, name};
}
async function user_login(client, email, password) { return client.auth.signInWithPassword({email, password}); }

let ops, claimant, invitee, other;
try {
  await cleanup(); // rydd rester fra en tidligere avbrutt kjøring
  results.length = 0;
  ops = await mkUser('ops', 'Ops Tester');
  claimant = await mkUser('claimant', 'Kari Kasserer');
  invitee = await mkUser('invitee', 'Ola Invitert');
  other = await mkUser('other', 'Per Annen');

  const fx = await sql(`
    SET session_replication_role = replica;
    INSERT INTO public.ops_admins (user_id, note) VALUES ('${ops.id}', 'verify-web-flows fixtur');
    INSERT INTO public.clubs (id, name, short_name, created_by) VALUES (gen_random_uuid(), '${CLUB_NAME}', 'VWIL', '${claimant.id}');
    INSERT INTO public.teams (id, club_id, sport_id, name, age_group, created_by)
      SELECT gen_random_uuid(), c.id, (SELECT id FROM public.sports LIMIT 1), 'Verify G12', 'G12', '${claimant.id}' FROM public.clubs c WHERE c.name = '${CLUB_NAME}';
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated, activated_at, activated_by)
      SELECT gen_random_uuid(), t.id, 'Verify G12', (SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '') FROM generate_series(1, 8)), true, now(), '${claimant.id}' FROM public.teams t JOIN public.clubs c ON c.id = t.club_id WHERE c.name = '${CLUB_NAME}';
    INSERT INTO public.memberships (user_id, team_space_id, role, status)
      SELECT '${claimant.id}', ts.id, 'trener', 'active' FROM public.team_spaces ts JOIN public.teams t ON t.id = ts.team_id JOIN public.clubs c ON c.id = t.club_id WHERE c.name = '${CLUB_NAME}';
    INSERT INTO public.club_claims (club_id, claimed_org_number, claimed_legal_name, claimant_user_id, claimed_role, contact_email, nominee_is_self)
      SELECT id, '${ORG}', 'VERIFY WEB IDRETTSLAG', '${claimant.id}', 'Styremedlem', '${claimant.email}', true FROM public.clubs WHERE name = '${CLUB_NAME}';
    SET session_replication_role = origin;
    SELECT cc.id AS claim_id, ts.id AS team_space_id, c.id AS club_id
      FROM public.club_claims cc JOIN public.clubs c ON c.id = cc.club_id
      JOIN public.teams t ON t.club_id = c.id JOIN public.team_spaces ts ON ts.team_id = t.id
     WHERE c.name = '${CLUB_NAME}';`);
  const {claim_id: claimId, team_space_id: tsId, club_id: clubId} = fx[0];
  check('fixturer opprettet', !!claimId && !!tsId, `claim ${claimId}`);

  // ── Ops: søknadskø → be om info → godkjenn ──
  {
    const {data} = await ops.client.rpc('ops_list_club_claims');
    check('ops: søknaden ligger i køen', Array.isArray(data) && data.some((c) => c.id === claimId), `${data?.length} søknader`);
    const {data: one} = await ops.client.rpc('ops_get_club_claim', {p_claim_id: claimId});
    check('ops: detalj m/ nominee_is_self', one?.id === claimId && one?.nominee_is_self === true, one?.claimed_legal_name);
    const {error: iErr} = await ops.client.rpc('ops_request_claim_info', {p_claim_id: claimId, p_message: 'Test: send vedtaket fra årsmøtet.'});
    check('ops: be om mer info', !iErr, iErr?.message ?? '');
    const {data: after} = await ops.client.rpc('ops_get_club_claim', {p_claim_id: claimId});
    check('ops: status in_review + info_request_note', after?.status === 'in_review' && !!after?.info_request_note, after?.status);
    const {error: aErr0} = await ops.client.rpc('ops_approve_club_claim', {p_claim_id: claimId, p_authorization_note: ''});
    check('ops: godkjenning UTEN tekst avvises', !!aErr0, aErr0?.message ?? '');
    const {data: appr, error: aErr} = await ops.client.rpc('ops_approve_club_claim', {p_claim_id: claimId, p_authorization_note: 'Test: styremedlem verifisert (fixtur).'});
    check('ops: godkjenn → granted_manager', !aErr && appr?.granted_manager === true, aErr?.message ?? JSON.stringify(appr));
  }

  // ── Betalingsansvarlig (claimant): oversikt, lagforespørsel, avslag ──
  let entityId;
  {
    const {data: isMgr} = await claimant.client.rpc('is_payment_manager_anywhere');
    check('manager: is_payment_manager_anywhere=true', isMgr === true, String(isMgr));
    const {data: ov} = await claimant.client.rpc('get_club_payments_overview');
    const club = ov?.find((c) => c.entity?.org_number === ORG);
    entityId = club?.entity?.id;
    check('manager: oversikt viser enheten', !!club, JSON.stringify(club?.entity));
    check('manager: konto pending_onboarding (ikke Stripe ennå)', club?.account?.status === 'pending_onboarding', club?.account?.status);
    check('manager: står selv som aktiv manager (is_me)', club?.managers?.some((m) => m.is_me && m.status === 'active'), JSON.stringify(club?.managers));
    const {error: rqErr} = await claimant.client.rpc('request_team_support_approval', {ts_id: tsId});
    check('trener: be om godkjenning for laget', !rqErr, rqErr?.message ?? '');
    const {data: ov2} = await claimant.client.rpc('get_club_payments_overview');
    const req = ov2?.find((c) => c.entity?.org_number === ORG)?.requests?.[0];
    check('manager: forespørselen vises', !!req && req.team_space_id === tsId, JSON.stringify(req));
    const {error: apErr} = await claimant.client.rpc('approve_team_support', {p_approval_id: req?.id});
    check('manager: godkjenning før Stripe avvises av backend', !!apErr, apErr?.message ?? 'INGEN FEIL');
    const {error: rjErr} = await claimant.client.rpc('reject_team_support', {p_approval_id: req?.id, p_note: 'Test: avslått i verify-web-flows.'});
    check('manager: avslå m/ begrunnelse', !rjErr, rjErr?.message ?? '');
    const {data: ov3} = await claimant.client.rpc('get_club_payments_overview');
    const c3 = ov3?.find((c) => c.entity?.org_number === ORG);
    check('manager: loggen har avslaget', c3?.log?.some((l) => l.action === 'reject'), JSON.stringify(c3?.log?.slice(0, 2)));
  }

  // ── Invitasjon m/ e-postmatch → aksept ──
  const T1 = 'verify-flow-token-1-' + stamp + '-' + Math.random().toString(36).slice(2);
  {
    const {data: iss, error} = await claimant.client.rpc('issue_manager_invitation', {p_entity_id: entityId, p_name: invitee.name, p_email: invitee.email, p_note: 'Test'});
    check('manager: inviter ny betalingsansvarlig → issued', !error && iss?.outcome === 'issued', error?.message ?? JSON.stringify(iss));
    await sql(`UPDATE public.manager_invitations SET token_hash = encode(digest('${T1}', 'sha256'), 'hex'), sent_at = now() WHERE id = '${iss.invitation_id}'`);
    const {data: peek} = await invitee.client.rpc('peek_manager_invitation', {p_token: T1});
    check('invitert: forhåndsvisning found + email_matches', peek?.found && peek?.email_matches && peek?.legal_name === 'VERIFY WEB IDRETTSLAG', JSON.stringify(peek));
    const {data: peekOther} = await other.client.rpc('peek_manager_invitation', {p_token: T1});
    check('feil konto: forhåndsvisning viser avvik (email_matches=false)', peekOther?.found && peekOther?.email_matches === false, JSON.stringify(peekOther));
    const {data: red} = await invitee.client.rpc('redeem_manager_invitation', {p_token: T1});
    check('invitert: aksept → accepted', red?.outcome === 'accepted', JSON.stringify(red));
    const {data: red2} = await invitee.client.rpc('redeem_manager_invitation', {p_token: T1});
    check('invitert: gjentatt aksept → invalid (engangs)', red2?.outcome === 'invalid', JSON.stringify(red2));
    const {data: ov} = await invitee.client.rpc('get_club_payments_overview');
    check('invitert: kommer videre til Klubbetalinger', ov?.some((c) => c.entity?.id === entityId), `${ov?.length} enheter`);
  }

  // ── Invitasjon m/ AVVIK → awaiting_review → ops bekrefter → suspender/reaktiver/fjern ──
  const T2 = 'verify-flow-token-2-' + stamp + '-' + Math.random().toString(36).slice(2);
  {
    const {data: iss} = await claimant.client.rpc('issue_manager_invitation', {p_entity_id: entityId, p_name: 'Per Annen', p_email: `verify-flow-noen-annen-${stamp}@example.test`, p_note: 'Test avvik'});
    await sql(`UPDATE public.manager_invitations SET token_hash = encode(digest('${T2}', 'sha256'), 'hex'), sent_at = now() WHERE id = '${iss.invitation_id}'`);
    const {data: red} = await other.client.rpc('redeem_manager_invitation', {p_token: T2});
    check('avvik: aksept fra annen konto → awaiting_review', red?.outcome === 'awaiting_review', JSON.stringify(red));
    const {data: ovO} = await other.client.rpc('get_club_payments_overview');
    check('avvik: ingen rolle før ops bekrefter', ovO == null || !ovO.some((c) => c.entity?.id === entityId), JSON.stringify(ovO));
    const {data: ents} = await ops.client.rpc('ops_list_payment_entities');
    const ent = ents?.find((e) => e.entity?.id === entityId);
    const inv = ent?.invitations?.find((i) => i.id === iss.invitation_id);
    check('ops: enheten m/ awaiting_review + mismatch-data', inv?.status === 'awaiting_review' && !!inv?.mismatch?.account_email, JSON.stringify(inv?.mismatch));
    const {error: cErr} = await ops.client.rpc('ops_confirm_invitation_review', {p_invitation_id: iss.invitation_id, p_note: 'Test: identitet bekreftet.'});
    check('ops: bekreft avvik', !cErr, cErr?.message ?? '');
    const {data: ovO2} = await other.client.rpc('get_club_payments_overview');
    check('avvik: rollen aktiv etter bekreftelse', ovO2?.some((c) => c.entity?.id === entityId), `${ovO2?.length}`);
    const {error: sErr} = await ops.client.rpc('ops_suspend_manager', {p_entity_id: entityId, p_user_id: other.id, p_note: 'Test suspensjon'});
    check('ops: suspender', !sErr, sErr?.message ?? '');
    const {data: issS} = await other.client.rpc('issue_manager_invitation', {p_entity_id: entityId, p_name: 'X', p_email: 'x@example.test', p_note: null});
    check('suspendert: kan ikke invitere (outcome suspended)', issS?.outcome === 'suspended', JSON.stringify(issS));
    const {error: rErr} = await ops.client.rpc('ops_reactivate_manager', {p_entity_id: entityId, p_user_id: other.id, p_note: 'Test reaktivering'});
    check('ops: reaktiver', !rErr, rErr?.message ?? '');
    const {error: rmErr} = await ops.client.rpc('ops_remove_manager', {p_entity_id: entityId, p_user_id: other.id, p_note: 'Test fjerning'});
    check('ops: fjern (ikke siste aktive)', !rmErr, rmErr?.message ?? '');
    const {data: iss3} = await ops.client.rpc('ops_issue_manager_invitation', {p_entity_id: entityId, p_name: 'Trekkes', p_email: `verify-flow-trekk-${stamp}@example.test`, p_note: 'Test'});
    const {error: rvErr} = await ops.client.rpc('ops_revoke_manager_invitation', {p_invitation_id: iss3, p_note: 'Test tilbaketrekking'});
    check('ops: utsted + trekk tilbake invitasjon', !!iss3 && !rvErr, rvErr?.message ?? '');
    const {data: ents2} = await ops.client.rpc('ops_list_payment_entities');
    const ev = ents2?.find((e) => e.entity?.id === entityId)?.events ?? [];
    check('ops: hendelseslogg dekker kjeden', ['review_confirmed', 'suspended', 'reactivated', 'removed', 'invite_revoked'].every((k) => ev.some((e) => e.event === k)), ev.map((e) => e.event).join(','));
  }

  // ── Stripe-gaten fra web (entity_id): fjernet manager → 403 ──
  {
    const tok = (await other.client.auth.getSession()).data.session.access_token;
    const res = await fetch(`${URL_}/functions/v1/stripe-onboarding`, {method: 'POST', headers: {Authorization: `Bearer ${tok}`, apikey: anonKey, 'Content-Type': 'application/json'}, body: JSON.stringify({entity_id: entityId, source: 'web'})});
    check('stripe-onboarding (web, entity_id) nekter fjernet manager m/ 403', res.status === 403, `HTTP ${res.status}`);
  }

  if (KEEP && SESSION_FILE) {
    const s = async (u) => (await u.client.auth.getSession()).data.session;
    writeFileSync(SESSION_FILE, JSON.stringify({ops: await s(ops), manager: await s(claimant), invitee: await s(invitee), claimId, entityId, teamSpaceId: tsId, clubId}));
    console.log('sesjoner skrevet til', SESSION_FILE, '— husk --cleanup');
  }
} catch (e) {
  check('uventet feil: ' + (e?.message ?? e), false);
} finally {
  if (!KEEP) await cleanup();
}
process.exit(finish() ? 0 : 1);
