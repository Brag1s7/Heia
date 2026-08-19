#!/usr/bin/env node
/**
 * AVATAR-STORAGE-POLICYENE (00068) MOT EKTE STORAGE-API.
 *
 * Dette er delen `verify-00068.sql` IKKE kan ta: Supabase avviser all
 * direkte `DELETE FROM storage.objects` («Use the Storage API instead»),
 * og vakten fyrer på statement-nivå — i SQL er «kastet» og «null rader»
 * ikke til å skille fra hverandre. Her går alt gjennom nøyaktig det
 * API-et appen selv bruker, med ekte brukertokens.
 *
 * ⚠️ DEN VIKTIGSTE NYANSEN, og grunnen til at skriptet ser ut som det gjør:
 * Storage svarer **200 OK også når RLS filtrerte bort alt**. Bulk-DELETE
 * returnerer en LISTE over det som faktisk ble slettet, og en tom liste er
 * det normale utfallet av et avslag. Statuskoden beviser altså ingenting —
 * beviset er om objektet fortsatt FINNES etterpå. Skriptet asserter derfor
 * alltid på etterpå-tilstanden, aldri på 200.
 *
 * IKKE DESTRUKTIVT: det rører aldri et ekte profilbilde. Eieren laster opp
 * en engangsfil i sin egen mappe, alle forsøkene går mot den, og den
 * ryddes til slutt. Går noe galt, er det verste som kan skje at en
 * throwaway-fil blir liggende.
 *
 * KJØRING:
 *   EIER_EMAIL=… EIER_PASSWORD=… \
 *   ANNEN_EMAIL=… ANNEN_PASSWORD=… \
 *   [ADMIN_EMAIL=… ADMIN_PASSWORD=…] \
 *   node scripts/verify-avatar-storage.mjs
 *
 *   EIER  = en hvilken som helst konto (filen legges i DENNES mappe)
 *   ANNEN = et VANLIG medlem (ikke trener/lagleder) i SAMME lag som EIER
 *   ADMIN = valgfritt: en trener/lagleder i samme lag. Uten den hoppes
 *           admin-grenen over — den er den ene som «Fjern profilbildet»
 *           i lagoversikten faktisk bruker.
 *
 * SUPABASE_URL og SUPABASE_ANON_KEY leses fra .env (gitignorert).
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
const BASE = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const BUCKET = 'avatars';

if (!BASE || !ANON || !env.EIER_EMAIL || !env.EIER_PASSWORD
    || !env.ANNEN_EMAIL || !env.ANNEN_PASSWORD) {
  console.error(
    'Mangler SUPABASE_URL/SUPABASE_ANON_KEY (.env) eller\n' +
    'EIER_EMAIL/EIER_PASSWORD/ANNEN_EMAIL/ANNEN_PASSWORD (miljø).',
  );
  process.exit(2);
}

let failures = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => {
  failures += 1;
  console.log(`  ❌ ${m}`);
};
const skip = (m) => console.log(`  ⚠️  ${m}`);

// 1×1 JPEG. Må være ekte image/jpeg: bucketen har mime-liste (00068), så
// en tekstfil ville blitt avvist med 415 og sett ut som et policy-avslag.
const PROBE = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

async function signIn(email, password, label) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {apikey: ANON, 'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    console.error(`Kunne ikke logge inn ${label} (${email}): ${body.error_description || body.msg || res.status}`);
    process.exit(2);
  }
  return {token: body.access_token, id: body.user.id};
}

function auth(token) {
  return {apikey: ANON, Authorization: `Bearer ${token}`};
}

async function upload(token, path) {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {...auth(token), 'Content-Type': 'image/jpeg', 'x-upsert': 'false'},
    body: PROBE,
  });
  return {status: res.status, body: (await res.text()).slice(0, 200)};
}

/** Finnes objektet? Signering er den billigste eksistenssjekken som
 *  også respekterer RLS — 200 = både «finnes» og «du har lov å se det». */
async function canSign(token, path) {
  const res = await fetch(`${BASE}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {...auth(token), 'Content-Type': 'application/json'},
    body: JSON.stringify({expiresIn: 60}),
  });
  return res.status === 200;
}

/** Samme kall som appens `.remove([path])`. Svarer 200 med TOM liste når
 *  RLS avviste — derfor returnerer vi antallet, ikke statusen. */
async function remove(token, path) {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {...auth(token), 'Content-Type': 'application/json'},
    body: JSON.stringify({prefixes: [path]}),
  });
  let deleted = 0;
  try {
    const body = await res.json();
    if (Array.isArray(body)) deleted = body.length;
  } catch {
    /* ikke-JSON = ingenting slettet */
  }
  return {status: res.status, deleted};
}

const eier = await signIn(env.EIER_EMAIL, env.EIER_PASSWORD, 'EIER');
const annen = await signIn(env.ANNEN_EMAIL, env.ANNEN_PASSWORD, 'ANNEN');
const admin = env.ADMIN_EMAIL && env.ADMIN_PASSWORD
  ? await signIn(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, 'ADMIN')
  : null;

if (eier.id === annen.id) {
  console.error('EIER og ANNEN er samme konto — testen ville bevist ingenting.');
  process.exit(2);
}

const probe = `${eier.id}/verify-probe-${Date.now()}.jpg`;
const foreign = `${annen.id}/verify-probe-forbudt.jpg`;

console.log(`\nAvatar-storage-policyene (00068) mot ${BASE}`);
console.log(`  eier  ${eier.id}`);
console.log(`  annen ${annen.id}`);
console.log(`  admin ${admin ? admin.id : '(ikke oppgitt — admin-grenen hoppes over)'}\n`);

let uploaded = false;
try {
  // ── 1. INSERT: egen mappe ────────────────────────────────────────
  const up = await upload(eier.token, probe);
  if (up.status === 200) {
    uploaded = true;
    ok('eier kan laste opp i sin EGEN mappe');
  } else {
    bad(`eier kunne IKKE laste opp i egen mappe (HTTP ${up.status}): ${up.body}`);
  }

  // ── 2. INSERT: en annens mappe — overtakelsesvektoren ────────────
  const foreignUp = await upload(eier.token, foreign);
  if (foreignUp.status === 200) {
    bad('eier fikk laste opp i en ANNENS mappe — INSERT-policyen er for løs');
    await remove(eier.token, foreign); // rydd det som ikke skulle vært der
  } else {
    ok(`opplasting i en ANNENS mappe avvises (HTTP ${foreignUp.status})`);
  }

  if (!uploaded) {
    skip('resten hoppes over — det finnes ingen fil å teste mot');
  } else {
    // ── 3. SELECT: lagkameraten ser den ──────────────────────────
    if (await canSign(annen.token, probe)) {
      ok('lagkameraten kan signere (se) filen');
    } else {
      bad('lagkameraten kan IKKE se filen — er de i samme lag? Avatarer ville vært usynlige');
    }

    // ── 4. DELETE: et VANLIG medlem skal IKKE kunne slette ───────
    // Statusen er meningsløs her (200 også ved avslag) — det som teller
    // er om filen fortsatt finnes etterpå.
    const attempt = await remove(annen.token, probe);
    const survived = await canSign(eier.token, probe);
    if (survived) {
      ok(`et vanlig medlem kan IKKE slette andres fil (svar: HTTP ${attempt.status}, ${attempt.deleted} slettet)`);
    } else {
      bad('ET VANLIG MEDLEM SLETTET EN ANNENS FIL — DELETE-policyen er for løs');
      uploaded = false;
    }

    // ── 5. DELETE: lagadmin SKAL kunne — «Fjern profilbildet» ────
    if (admin && uploaded) {
      const byAdmin = await remove(admin.token, probe);
      const stillThere = await canSign(eier.token, probe);
      if (!stillThere) {
        uploaded = false;
        ok('lagadmin KAN slette en lagkamerats fil (moderasjonsknappen virker)');
      } else {
        bad(`lagadmin fikk IKKE slettet (HTTP ${byAdmin.status}, ${byAdmin.deleted} slettet) — «Fjern profilbildet» nuller kolonnen, men bildet blir liggende og vises videre i frosne varselrader`);
      }
    } else if (!admin) {
      skip('admin-grenen ikke testet — sett ADMIN_EMAIL/ADMIN_PASSWORD (trener/lagleder i samme lag)');
    }

    // ── 6. DELETE: eieren selv ──────────────────────────────────
    if (uploaded) {
      const byOwner = await remove(eier.token, probe);
      if (!(await canSign(eier.token, probe))) {
        uploaded = false;
        ok('eieren kan slette sin egen fil');
      } else {
        bad(`eieren fikk IKKE slettet sin egen fil (HTTP ${byOwner.status}) — «Fjern bildet» ville etterlatt fila`);
      }
    }
  }
} finally {
  // Rydd uansett hvordan det gikk — en throwaway-fil skal ikke bli
  // liggende og telle mot lagringen for alltid.
  if (uploaded) {
    await remove(eier.token, probe);
  }
}

console.log(
  failures === 0
    ? '\n✅ ALT GRØNT — avatar-policyene holder gjennom det ekte Storage-API-et.\n'
    : `\n❌ ${failures} feil. Se over.\n`,
);
process.exit(failures === 0 ? 0 : 1);
