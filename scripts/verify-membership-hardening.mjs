#!/usr/bin/env node
/**
 * VERIFISERING AV MEMBERSHIPS-HERDINGEN (00066).
 *
 * Beviser mot EKTE prod-PostgREST at en vanlig innlogget bruker ikke lenger
 * kan skrive medlemsrader direkte, og at lesingen er strammet:
 *   1. UPDATE av egen role (privilegie-eskalering) → null rader truffet.
 *   2. UPDATE av egen removed-rad tilbake til active → null rader truffet
 *      (hoppes over med forklaring hvis kontoen ikke har noen removed-rad —
 *      mekanismen er uansett den samme: det finnes ingen UPDATE-policy).
 *   3. DELETE av egen medlemsrad → null rader truffet.
 *   4. INSERT av ny medlemsrad → avvist (ingen INSERT-policy).
 *   5. Andres rader i laget: KUN status='active' er synlig; egne rader
 *      leses fortsatt i alle statuser (egen historikk er ens egen).
 *
 * Snakker rett med GoTrue + PostgREST med `fetch`. Ingen avhengigheter:
 * `TEST_EMAIL=... TEST_PASSWORD=... node scripts/verify-membership-hardening.mjs`
 * SUPABASE_URL og SUPABASE_ANON_KEY leses fra .env (gitignorert).
 *
 * ⚠️ KJØR MED EN TESTKONTO, og ETTER at 00066 er pushet. Skriptet er
 * skrevet for å være selvreparerende hvis det mot formodning kjøres FØR
 * herdingen (da LYKKES skrivingene): endringer rulles tilbake og testen
 * rapporterer rødt. Unntaket er DELETE med en testkonto som er lagadmin
 * i laget — da kan gjeninnsettingen mangle rettighet. Bruk en forelder-
 * eller supporter-testkonto.
 */
import {readFileSync} from 'node:fs';

function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env mangler — da må variablene komme fra miljøet */
  }
  return out;
}

const env = {...loadEnv(), ...process.env};
const URL_BASE = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const EMAIL = env.TEST_EMAIL;
const PASSWORD = env.TEST_PASSWORD;

if (!URL_BASE || !ANON || !EMAIL || !PASSWORD) {
  console.error(
    'Mangler SUPABASE_URL/SUPABASE_ANON_KEY (.env) eller TEST_EMAIL/TEST_PASSWORD (miljø).',
  );
  process.exit(2);
}

let failures = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  ❌ ${msg}`);
};
const skip = (msg) => console.log(`  ⚠️  ${msg}`);

async function rest(method, path, token, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // return=representation: svaret viser radene som faktisk ble truffet.
      // RLS uten policy filtrerer stille — «[]» ER beviset vi er ute etter.
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ikke-JSON (204 o.l.) */
  }
  return {status: res.status, json, text};
}

async function main() {
  console.log('— Logger inn testkontoen …');
  const login = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {apikey: ANON, 'Content-Type': 'application/json'},
    body: JSON.stringify({email: EMAIL, password: PASSWORD}),
  });
  const session = await login.json();
  if (!login.ok || !session.access_token) {
    console.error('Innlogging feilet:', session.error_description ?? session.msg ?? login.status);
    process.exit(2);
  }
  const token = session.access_token;
  const uid = session.user.id;

  const mine = await rest(
    'GET',
    `memberships?select=*&user_id=eq.${uid}&order=joined_at.asc`,
    token,
  );
  if (mine.status !== 200 || !Array.isArray(mine.json)) {
    console.error('Fikk ikke lest egne medlemskap:', mine.status, mine.text);
    process.exit(2);
  }
  const active = mine.json.filter((r) => r.status === 'active');
  const removed = mine.json.filter((r) => r.status === 'removed');
  if (active.length === 0) {
    console.error('Testkontoen har ingen aktive medlemskap — meld den inn i et testlag først.');
    process.exit(2);
  }
  console.log(`  (${active.length} aktiv(e) rad(er), ${removed.length} removed)`);

  // ── 1) Rolle-eskalering på egen aktiv rad ────────────────────────────
  console.log('— Test 1: UPDATE egen role via PostgREST …');
  const target = active[0];
  const newRole = target.role === 'admin' ? 'trener' : 'admin';
  const esc = await rest('PATCH', `memberships?id=eq.${target.id}`, token, {role: newRole});
  if (Array.isArray(esc.json) && esc.json.length === 0) {
    ok(`role='${newRole}' traff null rader — eskaleringshullet er tettet`);
  } else if (Array.isArray(esc.json) && esc.json.length > 0) {
    bad(`SKRIVINGEN GIKK GJENNOM (role='${esc.json[0].role}') — policyen står fortsatt!`);
    const revert = await rest('PATCH', `memberships?id=eq.${target.id}`, token, {role: target.role});
    console.log(
      Array.isArray(revert.json) && revert.json.length > 0
        ? `     (rullet tilbake til role='${target.role}')`
        : '     ⚠️ KLARTE IKKE RULLE TILBAKE — rett raden manuelt!',
    );
  } else {
    bad(`Uventet svar (${esc.status}): ${esc.text.slice(0, 120)}`);
  }

  // ── 2) Reaktivering av removed-rad ───────────────────────────────────
  console.log('— Test 2: UPDATE removed-rad tilbake til active …');
  if (removed.length === 0) {
    skip(
      'kontoen har ingen removed-rad å teste mot — dekket av samme mekanisme ' +
        'som test 1 (ingen UPDATE-policy finnes lenger), men kjør gjerne på ' +
        'nytt når en removed-rad finnes.',
    );
  } else {
    const dead = removed[0];
    const rev = await rest('PATCH', `memberships?id=eq.${dead.id}`, token, {status: 'active'});
    if (Array.isArray(rev.json) && rev.json.length === 0) {
      ok('reaktiveringen traff null rader — removed er endelig for klienten');
    } else if (Array.isArray(rev.json) && rev.json.length > 0) {
      bad('REAKTIVERINGEN GIKK GJENNOM — policyen står fortsatt!');
      const undo = await rest('PATCH', `memberships?id=eq.${dead.id}`, token, {status: 'removed'});
      console.log(
        Array.isArray(undo.json) && undo.json.length > 0
          ? '     (rullet tilbake til removed)'
          : '     ⚠️ KLARTE IKKE RULLE TILBAKE — rett raden manuelt!',
      );
    } else {
      bad(`Uventet svar (${rev.status}): ${rev.text.slice(0, 120)}`);
    }
  }

  // ── 3) Hard delete av egen rad ───────────────────────────────────────
  console.log('— Test 3: DELETE egen medlemsrad …');
  const del = await rest('DELETE', `memberships?id=eq.${target.id}`, token);
  if (Array.isArray(del.json) && del.json.length === 0) {
    ok('DELETE traff null rader — historikken kan ikke slettes fra klienten');
  } else if (Array.isArray(del.json) && del.json.length > 0) {
    bad('DELETE GIKK GJENNOM — raden er borte, policyen står fortsatt!');
    const {id: _drop, ...fields} = del.json[0];
    const back = await rest('POST', 'memberships', token, fields);
    console.log(
      Array.isArray(back.json) && back.json.length > 0
        ? '     (raden er satt inn igjen — med NY id)'
        : '     ⚠️ KLARTE IKKE SETTE RADEN INN IGJEN — gjenopprett manuelt!',
    );
  } else {
    bad(`Uventet svar (${del.status}): ${del.text.slice(0, 120)}`);
  }

  // ── 4) INSERT av ny rad ──────────────────────────────────────────────
  console.log('— Test 4: INSERT ny medlemsrad …');
  const ins = await rest('POST', 'memberships', token, {
    user_id: uid,
    team_space_id: target.team_space_id,
    role: 'supporter',
    status: 'active',
  });
  if (ins.status === 403 || ins.status === 401) {
    ok(`INSERT avvist (${ins.status}) — ingen INSERT-policy`);
  } else if (Array.isArray(ins.json) && ins.json.length > 0) {
    bad('INSERT GIKK GJENNOM — policyen står fortsatt!');
    const undo = await rest('DELETE', `memberships?id=eq.${ins.json[0].id}`, token);
    console.log(
      Array.isArray(undo.json) && undo.json.length > 0
        ? '     (raden er slettet igjen)'
        : '     ⚠️ KLARTE IKKE SLETTE TESTRADEN — rydd manuelt!',
    );
  } else {
    bad(`Uventet svar (${ins.status}): ${ins.text.slice(0, 120)}`);
  }

  // ── 5) Lesing: andres ikke-aktive rader usynlige, egen historikk består ─
  console.log('— Test 5: lesestramming …');
  const others = await rest(
    'GET',
    `memberships?select=status&team_space_id=eq.${target.team_space_id}&user_id=neq.${uid}`,
    token,
  );
  if (others.status === 200 && Array.isArray(others.json)) {
    const leaked = others.json.filter((r) => r.status !== 'active');
    if (leaked.length === 0) {
      ok(
        `andres rader i laget: ${others.json.length} synlige, alle 'active' — ` +
          'ingen historikklekkasje',
      );
    } else {
      bad(`${leaked.length} ikke-aktive rader fra andre er synlige (${leaked.map((r) => r.status).join(', ')})`);
    }
  } else {
    bad(`Uventet svar (${others.status}): ${others.text.slice(0, 120)}`);
  }
  if (removed.length > 0) {
    ok(`egen historikk leses fortsatt (${removed.length} egne removed-rader synlige)`);
  } else {
    skip('kontoen har ingen egne removed-rader — egen-historikk-lesingen er ikke bevist her.');
  }

  console.log(
    failures === 0
      ? '\nALT GRØNT — 00066 håndheves av serveren.'
      : `\n${failures} RØD(E) — 00066 er IKKE aktiv (er migrasjonen pushet?).`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Uventet feil:', e);
  process.exit(2);
});
