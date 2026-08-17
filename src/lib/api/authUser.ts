/**
 * Én lesevei for «hvem er jeg» (P5).
 *
 * `supabase.auth.getUser()` er en NETTVERKSRUNDE (GET /auth/v1/user), og den
 * sto foran 9 kall — sekvensielt, i de varmeste stiene (boot, feed, hvert
 * skriv). Alle kallstedene er gjennomgått mot RLS-policyene i P5: ingen
 * leser annet enn `user.id`, og datakallet som følger bærer samme JWT som
 * getUser ville validert — en død sesjon feiler uansett med 401 på selve
 * spørringen. getUser ga altså null sikkerhet for én ekstra rundtur, og
 * beholdes INGEN steder.
 *
 * `getSession()` leser lokalt (minne/AsyncStorage). Skrivestiene bruker
 * helperne her; de varme lesestiene får id-en som parameter fra context og
 * slipper selv dét.
 */
import {supabase} from '../supabase';

/** Bruker-id fra lokal sesjon, eller null når ingen er innlogget. */
export async function getUserIdOrNull(): Promise<string | null> {
  const {
    data: {session},
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Som over, men kaster — for stier der «ingen bruker» er en programfeil. */
export async function getUserId(): Promise<string> {
  const id = await getUserIdOrNull();
  if (!id) {
    throw new Error('Not authenticated');
  }
  return id;
}
