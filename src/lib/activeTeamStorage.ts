import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Nøkkelen for sist aktive lag (flyttet hit fra TeamContext i S2 —
 * kontekst-RPC-en trenger kandidatlaget FØR TeamContext har rukket å velge).
 * Semantikken er uendret: kun ID-en lagres, gyldigheten avgjøres ALLTID mot
 * ferske memberships før den brukes.
 */
export const ACTIVE_TEAM_KEY = 'heia:activeTeamSpace:v1';

/** Husket lagvalg fra forrige økt, eller null. Svelger lagringsfeil. */
export async function readStoredActiveTeamSpaceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_TEAM_KEY);
  } catch {
    return null;
  }
}
