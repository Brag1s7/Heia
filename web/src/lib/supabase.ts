import {createClient} from '@supabase/supabase-js';

// Samme Supabase-prosjekt som appen. Anon-nøkkelen er offentlig per design
// (all autorisasjon skjer i Postgres via RLS og RPC-er); env-variablene
// overstyrer om prosjektet noen gang byttes. `detectSessionInUrl` er AV så
// klienten aldri tolker invitasjonstokenet i URL-fragmentet som en
// auth-respons (B3 i autoritetsmodellen).
const url =
  import.meta.env.PUBLIC_SUPABASE_URL ??
  'https://sswncdrbsrfieudkdmhj.supabase.co';
const anonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzd25jZHJic3JmaWV1ZGtkbWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIxMTEsImV4cCI6MjA5MDQzODExMX0.PUOFfLNkqivvSR_y_REvnffjxUEw35ZkkABNtT7yuBM';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'heia-web-auth',
  },
});
