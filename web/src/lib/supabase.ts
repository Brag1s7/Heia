import {createClient} from '@supabase/supabase-js';
import {AUTH_EVENT, AUTH_STORAGE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL} from './env';

// Samme Supabase-prosjekt som appen. `detectSessionInUrl` er AV så klienten
// aldri tolker invitasjonstokenet i URL-fragmentet som en auth-respons (B3 i
// autoritetsmodellen).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
});

// Headeren (Base.astro) leser sesjonen rett fra localStorage og har ikke
// supabase-js. Si fra når sesjonen endres (innlogging, utlogging, fornyet
// token) så «Logg inn» ↔ «Min konto» følger med uten omlasting — og la
// headerens «Logg ut» bruke denne klienten når den finnes på siden, så
// øya på samme side får beskjed med én gang.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(() => {
    window.dispatchEvent(new Event(AUTH_EVENT));
  });
  (window as unknown as {__heiaSignOut?: () => Promise<unknown>}).__heiaSignOut = () =>
    supabase.auth.signOut();
}
