// Supabase-adressen og anon-nøkkelen deles av supabase-js-klienten (øyene)
// og headerens lille auth-skript (Base.astro, uten supabase-js). Anon-nøkkelen
// er offentlig per design — all autorisasjon skjer i Postgres (RLS + RPC).
export const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL ??
  'https://sswncdrbsrfieudkdmhj.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzd25jZHJic3JmaWV1ZGtkbWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIxMTEsImV4cCI6MjA5MDQzODExMX0.PUOFfLNkqivvSR_y_REvnffjxUEw35ZkkABNtT7yuBM';

/** localStorage-nøkkelen supabase-js lagrer sesjonen under. */
export const AUTH_STORAGE_KEY = 'heia-web-auth';
/** localStorage-nøkkel for headerens rollecache ({uid, ops, manager, at}). */
export const ROLES_STORAGE_KEY = 'heia-web-roles';
/** Hendelsen øyene sender når sesjonen endres, så headeren kan tegne om. */
export const AUTH_EVENT = 'heia:auth';
