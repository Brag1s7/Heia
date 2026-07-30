import {supabase} from '../supabase';
import type {Profile} from '../types';

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    locale: row.locale,
    onboardingCompleted: row.onboarding_completed,
    householdId: row.household_id,
  };
}

export async function getProfile(): Promise<Profile> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    throw error;
  }
  return mapProfile(data);
}

export async function updateProfile(
  updates: Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'phone'>>,
): Promise<Profile> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const dbUpdates: Record<string, any> = {};
  if (updates.displayName !== undefined) {
    dbUpdates.display_name = updates.displayName;
  }
  if (updates.avatarUrl !== undefined) {
    dbUpdates.avatar_url = updates.avatarUrl;
  }
  // `null` er et gyldig valg her: det er slik du fjerner nummeret ditt igjen.
  if (updates.phone !== undefined) {
    dbUpdates.phone = updates.phone;
  }

  const {data, error} = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return mapProfile(data);
}
