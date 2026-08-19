#!/usr/bin/env node
/**
 * VERIFISERING AV SERVER-HÅNDHEVET PASSORDBYTTE (B6).
 *
 * Beviser at sikkerhetsgrensen ligger på SERVEREN, ikke i appflyten — altså
 * at dashboard-bryteren «Require current password when updating»
 * (Auth → Sign In / Providers → Email) faktisk står PÅ i prod.
 *
 * Snakker rett med GoTrues REST-API med `fetch`. INGEN avhengigheter, ingen
 * npm install, ingen tsx: `node scripts/verify-password-change.mjs`.
 * SUPABASE_URL og SUPABASE_ANON_KEY leses fra .env (gitignorert).
 *
 * ⚠️ KJØR MED EN TESTKONTO, ikke din egen. Skriptet bytter passordet fram og
 * tilbake og setter det ALLTID tilbake til utgangspunktet til slutt — men
 * avbrytes den midtveis, kan passordet stå på TEST_NEW_PASSWORD.
 *
 *   TEST_EMAIL=... TEST_PASSWORD=... node scripts/verify-password-change.mjs
 *
 * Dekker punkt 1, 2, 3 og 5 i Brages sjekkliste helt, og punkt 4 delvis
 * (at koden sendes — selve kodeinntastingen må gjøres på telefon).
 * Punkt 7 verifiseres ved å kjøre skriptet PÅ NYTT etter
 * `supabase config push`: test 1 skal fortsatt være rød-hvis-den-lykkes.
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
const NEW_PASSWORD = env.TEST_NEW_PASSWORD ?? 'heia-verify-8821';

if (!URL_BASE || !ANON) {
  console.error('Mangler SUPABASE_URL / SUPABASE_ANON_KEY (.env eller miljø).');
  process.exit(2);
}
if (!EMAIL || !PASSWORD) {
  console.error('Sett TEST_EMAIL og TEST_PASSWORD. Bruk en TESTKONTO.');
  process.exit(2);
}

const H = {apikey: ANON, 'Content-Type': 'application/json'};

async function signIn(password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({email: EMAIL, password}),
  });
  return {ok: r.ok, status: r.status, body: await r.json().catch(() => ({}))};
}

async function updatePassword(token, password, currentPassword) {
  const payload = {password};
  if (currentPassword !== undefined) payload.current_password = currentPassword;
  const r = await fetch(`${URL_BASE}/auth/v1/user`, {
    method: 'PUT',
    headers: {...H, Authorization: `Bearer ${token}`},
    body: JSON.stringify(payload),
  });
  return {ok: r.ok, status: r.status, body: await r.json().catch(() => ({}))};
}

let failures = 0;
function check(name, passed, detail) {
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures++;
}

const session = await signIn(PASSWORD);
if (!session.ok) {
  console.error(`Kom ikke inn med TEST_PASSWORD (${session.status}).`);
  process.exit(2);
}
let token = session.body.access_token;
console.log(`\nTestkonto: ${EMAIL}\n`);

// --- 3) Passordbytte UTEN current_password skal avvises av serveren --------
console.log('3) Direkte passordbytte uten current_password');
const noCurrent = await updatePassword(token, NEW_PASSWORD);
check(
  'serveren avviser',
  !noCurrent.ok,
  noCurrent.ok
    ? 'GIKK GJENNOM — dashboard-bryteren står AV! Ruller tilbake …'
    : `${noCurrent.status} ${noCurrent.body.error_code ?? noCurrent.body.msg ?? ''}`,
);
if (noCurrent.ok) {
  // Passordet ER byttet. Sett det tilbake med én gang, uansett utfall.
  await updatePassword(token, PASSWORD, NEW_PASSWORD);
  console.error('\nAVBRYTER: bryteren må skrus på før resten gir mening.\n');
  process.exit(1);
}

// --- 1) Feil nåværende passord skal ikke endre noe ------------------------
console.log('\n1) Feil nåværende passord');
const wrong = await updatePassword(token, NEW_PASSWORD, `${PASSWORD}-feil`);
check('serveren avviser', !wrong.ok, `${wrong.status} ${wrong.body.error_code ?? ''}`);
const stillOld = await signIn(PASSWORD);
check('gamle passordet virker fortsatt — ingenting ble endret', stillOld.ok);

// --- 2) Riktig nåværende passord skal endre passordet ---------------------
console.log('\n2) Riktig nåværende passord');
const right = await updatePassword(token, NEW_PASSWORD, PASSWORD);
check('serveren godtar', right.ok, right.ok ? '' : JSON.stringify(right.body));

// --- 5) Brukeren kan logge inn med det nye passordet ----------------------
console.log('\n5) Innlogging med nytt passord');
const withNew = await signIn(NEW_PASSWORD);
check('nytt passord virker', withNew.ok);
const withOld = await signIn(PASSWORD);
check('gammelt passord virker IKKE lenger', !withOld.ok);

// --- 4) Recovery sender kode uten at nåværende passord kreves -------------
console.log('\n4) Glemt-passord (recovery)');
const recover = await fetch(`${URL_BASE}/auth/v1/recover`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({email: EMAIL}),
});
check('koden sendes', recover.ok, `${recover.status}`);
console.log('     (selve kodeinntastingen verifiseres på telefon)');

// --- Rydd opp: tilbake til utgangspunktet ---------------------------------
console.log('\nRydder opp');
if (withNew.ok) {
  const restore = await updatePassword(
    withNew.body.access_token,
    PASSWORD,
    NEW_PASSWORD,
  );
  check('passordet satt tilbake', restore.ok);
}

console.log(
  failures === 0
    ? '\n✅ Alt grønt — grensen håndheves av serveren.\n'
    : `\n❌ ${failures} sjekk(er) feilet.\n`,
);
process.exit(failures === 0 ? 0 : 1);
