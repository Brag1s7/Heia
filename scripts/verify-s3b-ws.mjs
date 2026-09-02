#!/usr/bin/env node
/**
 * S3B-EXIT-KRITERIET: EKTE PRIVATE WEBSOCKET-JOINS MOT PROD (00080-filhodet).
 *
 * SQL-emuleringen i `verify-00080.sql` beviser policyUTTRYKKENE, men ikke
 * Realtime-tjenestens egen join-/re-auth-mekanikk. Dette scriptet gjør det
 * emuleringen ikke kan: joiner kanalene med `{config: {private: true}}`
 * gjennom nøyaktig samme bibliotek som appen (supabase-js), som ekte
 * innlogget bruker. Egen user-/team-/match-kanal skal TILLATES; ekte
 * fremmed lag/kamp, andres user-kanal, søppel-topics og uinnlogget klient
 * skal NEKTES.
 *
 * PROBEDISIPLIN (Brage 2026-08-30, håndhevet i `wsProbeCore.mjs`):
 *   • De bærende negativ-probene bruker et EKTE eksisterende fremmed
 *     teamSpaceId/matchSessionId (tilfeldige uuid-er er kun tillegg — en
 *     ikke-eksisterende id beviser ikke fremmed-LAG-sikkerheten).
 *   • TIMED_OUT er aldri grønn nekt: retry med frisk kanal; uten en
 *     eksplisitt avvisning (CHANNEL_ERROR med reason) blir proben ⚠️
 *     UAVKLART og kjøringen feiler.
 *   • Positivene må være grønne i SAMME kjøring, ellers nedgraderes alle
 *     grønne nekter til ⚠️ (kan ha bestått av feil årsak).
 *   • Ingen credentials eller produksjonsdata logges: alt hemmelig kommer
 *     via env/.env, og all utskrift uuid-maskeres. Sjekk aldri inn output.
 *   • ALDRI service_role — den bypasser policyene og beviser ingenting.
 *
 * IKKE DESTRUKTIVT: scriptet gjør kun realtime-joins — ingen skriving.
 *
 * KJØRING (SUPABASE_URL/SUPABASE_ANON_KEY leses fra gitignorert .env):
 *   BRUKER_EMAIL=… BRUKER_PASSWORD=… \
 *   EGET_TEAM=<teamSpaceId du er medlem av> \
 *   EGEN_KAMP=<matchSessionId i eget lag> \
 *   FREMMED_TEAM=<teamSpaceId du IKKE er medlem av> \
 *   FREMMED_KAMP=<matchSessionId i det fremmede laget> \
 *   node scripts/verify-s3b-ws.mjs
 *
 * FINN FREMMED-ID-ENE (SQL-editoren i Supabase, aldri fra klienten):
 *   select ts.id from public.team_spaces ts
 *   where not exists (
 *     select 1 from public.memberships m
 *     where m.team_space_id = ts.id and m.user_id = '<din-user-id>')
 *   limit 1;
 *
 *   select ms.id from public.match_sessions ms
 *   join public.events e on e.id = ms.event_id
 *   where e.team_space_id = '<fremmed-team-id>'
 *   limit 1;
 */
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {
  applyPositiveGate,
  classifyAttempt,
  combineAttempts,
  evaluateProbe,
  maskUuids,
  summarize,
} from './wsProbeCore.mjs';

function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(
      new URL('../.env', import.meta.url),
      'utf8',
    ).split('\n')) {
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

const UUID_EXACT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function die(msg) {
  console.error(msg);
  process.exit(2);
}

if (!BASE || !ANON || !env.BRUKER_EMAIL || !env.BRUKER_PASSWORD) {
  die(
    'Mangler SUPABASE_URL/SUPABASE_ANON_KEY (.env) eller BRUKER_EMAIL/BRUKER_PASSWORD.',
  );
}
for (const key of ['EGET_TEAM', 'EGEN_KAMP', 'FREMMED_TEAM', 'FREMMED_KAMP']) {
  // Håndskrevet feil-id ville gitt falsk grønn nekt (try_uuid nekter alt
  // som ikke er uuid) — derfor hard formatkontroll før noe kjøres.
  if (!UUID_EXACT.test(env[key] ?? '')) {
    die(`${key} mangler eller er ikke en uuid.`);
  }
}
if (env.FREMMED_TEAM === env.EGET_TEAM || env.FREMMED_KAMP === env.EGEN_KAMP) {
  die('FREMMED_TEAM/FREMMED_KAMP kan ikke være lik EGET_TEAM/EGEN_KAMP.');
}

const ATTEMPTS = 2;
const JOIN_TIMEOUT_MS = 12_000;

/**
 * Ett join-forsøk på et topic. Kanalen rives med `await removeChannel` FØR
 * retur: det stopper phoenix' rejoin-backoff etter nekt, og supabase-js
 * dedupliserer kanaler på topic-navn — uten await ville neste forsøk på
 * samme topic fått den døende kanalen tilbake.
 */
async function attemptJoin(client, topic) {
  const channel = client.channel(topic, {config: {private: true}});
  const result = await new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({status: 'TIMED_OUT', reason: null});
      }
    }, JOIN_TIMEOUT_MS);
    channel.subscribe((status, err) => {
      if (settled) return;
      if (
        status === 'SUBSCRIBED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        settled = true;
        clearTimeout(timer);
        resolve({status, reason: err?.message ?? null});
      }
    });
  });
  await client.removeChannel(channel);
  return result;
}

/** Retry KUN ved uavklart utfall — et eksplisitt svar står ved første forsøk. */
async function runProbe(client, topic) {
  const attempts = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const {status, reason} = await attemptJoin(client, topic);
    const attempt = classifyAttempt(status, reason);
    attempts.push(attempt);
    if (attempt.kind !== 'inconclusive') break;
  }
  return combineAttempts(attempts);
}

const authClient = createClient(BASE, ANON);
const anonClient = createClient(BASE, ANON);

const {data: signIn, error: signInError} =
  await authClient.auth.signInWithPassword({
    email: env.BRUKER_EMAIL,
    password: env.BRUKER_PASSWORD,
  });
if (signInError || !signIn?.user?.id) {
  die(`Innlogging feilet: ${maskUuids(signInError?.message ?? 'ukjent feil')}`);
}
const uid = signIn.user.id;

const probes = [
  {
    name: 'P1  user:   egen kanal',
    client: authClient,
    topic: `user:${uid}`,
    expected: 'allow',
  },
  {
    name: 'P2  team:   eget lag',
    client: authClient,
    topic: `team:${env.EGET_TEAM}`,
    expected: 'allow',
  },
  {
    name: 'P3  match:  egen kamp',
    client: authClient,
    topic: `match:${env.EGEN_KAMP}`,
    expected: 'allow',
  },
  {
    name: 'N1  team:   EKTE fremmed lag',
    client: authClient,
    topic: `team:${env.FREMMED_TEAM}`,
    expected: 'deny',
  },
  {
    name: 'N2  match:  EKTE fremmed kamp',
    client: authClient,
    topic: `match:${env.FREMMED_KAMP}`,
    expected: 'deny',
  },
  {
    name: 'N3  user:   tilfeldig uuid (tillegg)',
    client: authClient,
    topic: `user:${randomUUID()}`,
    expected: 'deny',
  },
  {
    name: 'N4a team:   tilfeldig uuid (tillegg)',
    client: authClient,
    topic: `team:${randomUUID()}`,
    expected: 'deny',
  },
  {
    name: 'N4b match:  tilfeldig uuid (tillegg)',
    client: authClient,
    topic: `match:${randomUUID()}`,
    expected: 'deny',
  },
  {
    name: 'N5  team:   søppel-topic (try_uuid)',
    client: authClient,
    topic: 'team:ikke-en-uuid',
    expected: 'deny',
  },
  {
    name: 'N6a anon →  user: egen',
    client: anonClient,
    topic: `user:${uid}`,
    expected: 'deny',
  },
  {
    name: 'N6b anon →  team: eget lag',
    client: anonClient,
    topic: `team:${env.EGET_TEAM}`,
    expected: 'deny',
  },
  {
    name: 'N6c anon →  match: egen kamp',
    client: anonClient,
    topic: `match:${env.EGEN_KAMP}`,
    expected: 'deny',
  },
];

console.log(
  `\nverify-s3b-ws — ${probes.length} prober mot ${new URL(BASE).host}\n`,
);

let results = [];
for (const probe of probes) {
  const {outcome, reason} = await runProbe(probe.client, probe.topic);
  const mark = evaluateProbe(probe.expected, outcome);
  const note =
    probe.expected === 'deny' && outcome === 'OK'
      ? 'SIKKERHETSBRUDD — join ble tillatt'
      : undefined;
  results.push({...probe, outcome, reason, mark, note});
}

results = applyPositiveGate(results);

for (const r of results) {
  const detail = [r.note, r.reason].filter(Boolean).join(' · ');
  console.log(
    `${r.mark}  ${r.name}  [${maskUuids(r.topic)}]  → ${r.outcome}` +
      (detail ? `  (${maskUuids(detail)})` : ''),
  );
}

const {green, total, exitCode} = summarize(results);
console.log(
  `\nSUM ${green}/${total} GRØNT${exitCode === 0 ? '' : ' — IKKE godkjent'}\n`,
);

authClient.realtime.disconnect();
anonClient.realtime.disconnect();
process.exit(exitCode);
