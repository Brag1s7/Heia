#!/usr/bin/env node
// Kjører en SQL-fil (eller -e "…") mot prod via Supabase Management API
// (/database/query) med CLI-ens innloggingstoken fra macOS-nøkkelringen
// (tjenesten «Supabase CLI», go-keyring-base64-innpakket). Samme kanal som
// verify-scriptene har blitt kjørt gjennom siden fase 3.
//
//   node scripts/run-sql.mjs scripts/verify-00082.sql
//   node scripts/run-sql.mjs -e "select 1"
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const REF = 'sswncdrbsrfieudkdmhj';

function token() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -w', {
    encoding: 'utf8',
  }).trim();
  const prefix = 'go-keyring-base64:';
  return raw.startsWith(prefix)
    ? Buffer.from(raw.slice(prefix.length), 'base64').toString('utf8')
    : raw;
}

const args = process.argv.slice(2);
const query = args[0] === '-e' ? args[1] : readFileSync(args[0], 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: {Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json'},
  body: JSON.stringify({query}),
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text}`);
  process.exit(1);
}
try {
  const rows = JSON.parse(text);
  if (Array.isArray(rows)) console.table(rows);
  else console.log(rows);
} catch {
  console.log(text);
}
