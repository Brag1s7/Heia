import {supabase} from '../supabase';
import {getUserId} from './authUser';
import {primeAvatars} from '../media/avatar';
import type {Profile} from '../types';

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    // Kolonnen heter avatar_url, men bærer en PATH (00068).
    avatarPath: row.avatar_url,
    avatarColor: row.avatar_color ?? null,
    phone: row.phone,
    locale: row.locale,
    onboardingCompleted: row.onboarding_completed,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    householdId: row.household_id,
  };
}

/**
 * `userId` kommer fra kalleren (UserContext eier sesjonen — P5): profilen
 * ligger i boot-kjeden, og RLS (`id = auth.uid()`) er uansett vakten —
 * en fremmed id gir null rader, aldri en annens profil.
 */
export async function getProfile(userId: string): Promise<Profile> {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }
  const profile = mapProfile(data);
  // Ditt eget bilde tegnes to steder med én gang (profilheaderen og
  // composeren på Hjem) — signeres det ikke her, gjør de to det hver for
  // seg ved første render.
  await primeAvatars([profile.avatarPath]);
  return profile;
}

/**
 * Kontosletting (Apple 5.1.1(v)) — Edge Function-en kansellerer
 * støtteavtaler hos Stripe, anonymiserer profilen og sletter
 * auth-brukeren til slutt. Kalleren gjør lokal signOut etterpå.
 */
export async function deleteAccount(): Promise<void> {
  const {error} = await supabase.functions.invoke('delete-account', {
    body: {},
  });
  if (error) {
    // {error: 'norsk melding'} graves frem så Alert-en sier noe
    // forståelig — samme mønster som betalings-funksjonene.
    let message = 'Kunne ikke slette kontoen — prøv igjen om litt.';
    try {
      const ctx = (error as {context?: Response}).context;
      if (ctx) {
        const body = await ctx.json();
        if (body?.error) {
          message = body.error;
        }
      }
    } catch {
      // behold standardmeldingen
    }
    throw new Error(message);
  }
}

export async function updateProfile(
  updates: Partial<
    Pick<Profile, 'displayName' | 'avatarPath' | 'avatarColor' | 'phone'>
  >,
): Promise<Profile> {
  const userId = await getUserId();

  const dbUpdates: Record<string, any> = {};
  if (updates.displayName !== undefined) {
    dbUpdates.display_name = updates.displayName;
  }
  // `null` fjerner bildet. Vakten mot å peke på en ANNENS path bor i
  // profiles-UPDATE-policyen (00068), ikke her.
  if (updates.avatarPath !== undefined) {
    dbUpdates.avatar_url = updates.avatarPath;
  }
  // `null` = tilbake til navne-hashen.
  if (updates.avatarColor !== undefined) {
    dbUpdates.avatar_color = updates.avatarColor;
  }
  // `null` er et gyldig valg her: det er slik du fjerner nummeret ditt igjen.
  if (updates.phone !== undefined) {
    dbUpdates.phone = updates.phone;
  }

  const {data, error} = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return mapProfile(data);
}
