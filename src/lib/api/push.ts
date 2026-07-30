import {supabase} from '../supabase';

/**
 * Lagrer (eller flytter til denne brukeren) en APNs-device-token via
 * `register_device_token` (SECURITY DEFINER, 00022). Konfliktnøkkelen er
 * token, så samme enhet som logger inn på nytt oppdaterer eieren i stedet
 * for å duplisere.
 */
export async function registerDeviceToken(
  token: string,
  platform: 'ios' | 'android' = 'ios',
): Promise<void> {
  const {error} = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: platform,
  });
  if (error) {
    throw error;
  }
}

/**
 * Fjerner en token ved sign-out. Må kalles MENS brukeren fortsatt er
 * innlogget — RPC-en sletter kun rader der token tilhører `auth.uid()`.
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  const {error} = await supabase.rpc('unregister_device_token', {
    p_token: token,
  });
  if (error) {
    throw error;
  }
}
