#!/usr/bin/env node
// Tilgangstest for web-flatene (blokk 1+2): backend håndhever rollene.
//  1. anon: ops-/manager-RPC-er og peek nektes.
//  2. innlogget bruker UTEN roller: ops → null/nekt, manager-oversikt →
//     null, peek m/ ukjent token → found=false, redeem m/ ukjent → invalid.
// Testbrukeren opprettes med service-nøkkel (bekreftet e-post) og slettes
// til slutt. Nøkkelen hentes fra CLI-en, aldri fra repoet.
import {execSync} from 'node:child_process';
import {createClient} from '../web/node_modules/@supabase/supabase-js/dist/index.mjs';

const URL_ = 'https://sswncdrbsrfieudkdmhj.supabase.co';
const keys = JSON.parse(execSync('supabase projects api-keys --project-ref sswncdrbsrfieudkdmhj -o json', {encoding: 'utf8'}));
const anonKey = keys.find((k) => k.name === 'anon').api_key;
const serviceKey = keys.find((k) => k.name === 'service_role').api_key;

const results = [];
const check = (name, pass, detail = '') => { results.push({name, pass, detail}); };

const anon = createClient(URL_, anonKey, {auth: {persistSession: false}});
for (const fn of ['ops_list_club_claims', 'ops_list_payment_entities', 'get_club_payments_overview', 'is_ops_admin']) {
  const {data, error} = await anon.rpc(fn);
  check(`anon ${fn} nektes/null`, !!error || data == null || data === false, error?.message ?? JSON.stringify(data));
}
{
  const {data, error} = await anon.rpc('peek_manager_invitation', {p_token: 'x'.repeat(32)});
  check('anon peek_manager_invitation nektes', !!error, error?.message ?? JSON.stringify(data));
}

const admin = createClient(URL_, serviceKey, {auth: {persistSession: false}});
const email = `verify-web-${Date.now()}@example.test`;
const password = 'Verify-' + Math.random().toString(36).slice(2, 10) + 'x';
const {data: created, error: cErr} = await admin.auth.admin.createUser({email, password, email_confirm: true, user_metadata: {display_name: 'Verify Web'}});
if (cErr) { console.error('createUser feilet', cErr); process.exit(1); }
const uid = created.user.id;
try {
  const user = createClient(URL_, anonKey, {auth: {persistSession: false}});
  const {error: sErr} = await user.auth.signInWithPassword({email, password});
  check('testbruker kan logge inn', !sErr, sErr?.message ?? '');
  for (const fn of ['ops_list_club_claims', 'ops_list_payment_entities', 'get_club_payments_overview']) {
    const {data, error} = await user.rpc(fn);
    check(`bruker uten rolle: ${fn} → null/nekt`, !!error || data == null, error?.message ?? JSON.stringify(data));
  }
  {
    const {data} = await user.rpc('is_ops_admin');
    check('bruker uten rolle: is_ops_admin=false', data === false, JSON.stringify(data));
  }
  {
    const {data} = await user.rpc('is_payment_manager_anywhere');
    check('bruker uten rolle: is_payment_manager_anywhere=false', data === false, JSON.stringify(data));
  }
  {
    const {data, error} = await user.rpc('ops_get_club_claim', {p_claim_id: '00000000-0000-0000-0000-000000000000'});
    check('bruker uten rolle: ops_get_club_claim → null/nekt', !!error || data == null, error?.message ?? JSON.stringify(data));
  }
  {
    const {data, error} = await user.rpc('peek_manager_invitation', {p_token: 'ukjent-token-'.padEnd(40, 'x')});
    check('bruker: peek m/ ukjent token → found=false', !error && data?.found === false, error?.message ?? JSON.stringify(data));
  }
  {
    const {data, error} = await user.rpc('redeem_manager_invitation', {p_token: 'ukjent-token-'.padEnd(40, 'x')});
    check('bruker: redeem m/ ukjent token → invalid (ingen rolle)', !error && data?.outcome === 'invalid', error?.message ?? JSON.stringify(data));
  }
  {
    const {error} = await user.rpc('ops_approve_club_claim', {p_claim_id: '00000000-0000-0000-0000-000000000000', p_authorization_note: 'x'});
    check('bruker uten rolle: ops_approve_club_claim nektes', !!error, error?.message ?? '');
  }
  {
    const {error} = await user.rpc('approve_team_support', {p_approval_id: '00000000-0000-0000-0000-000000000000'});
    check('bruker uten rolle: approve_team_support nektes', !!error, error?.message ?? '');
  }
  {
    const res = await fetch(`${URL_}/functions/v1/stripe-onboarding`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${(await user.auth.getSession()).data.session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json'},
      body: JSON.stringify({entity_id: '00000000-0000-0000-0000-000000000000', source: 'web'}),
    });
    check('bruker uten rolle: stripe-onboarding (entity_id) → 4xx', res.status >= 400 && res.status < 500, `HTTP ${res.status} ${(await res.text()).slice(0, 80)}`);
  }
} finally {
  const {error: dErr} = await admin.auth.admin.deleteUser(uid);
  check('testbruker slettet', !dErr, dErr?.message ?? '');
}

const ok = results.filter((r) => r.pass).length;
console.table(results);
console.log(`verify-web-access: ${ok}/${results.length} grønne`);
process.exit(ok === results.length ? 0 : 1);
