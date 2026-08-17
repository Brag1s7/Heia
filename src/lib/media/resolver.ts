/**
 * Signert-URL-laget for privat media (P1/P4) — hele appens ENESTE vei fra
 * storage-path til lesbar URL.
 *
 * Rotårsak nr. 1 i egress-auditen var at hver henting signerte på nytt:
 * nytt token = ny URL = 100 % cache-miss i både CDN og RN-Image, hver gang.
 * Kuren er gjenbruk: én signert URL per path, TTL 24 t, cachet i minne og
 * AsyncStorage, delt av alle skjermer.
 *
 *  - `primeMediaUrls(paths)`: ÉN signeringsbatch per skjermlast. API-laget
 *    kaller den med alle paths den nettopp mappet; `MediaImage` leser
 *    deretter fra varm cache. Signerer kun paths som mangler eller har
 *    < 6 t igjen (margin for klokkeskjev — P1).
 *  - `resolveMediaUrl(ref, variant)`: per-bilde-oppslag med inflight-dedupe.
 *    Sikkerhetsnettet for stier prime ikke så (deep-link rett til en tråd).
 *  - `refreshMediaUrl(path)`: onError-fornying, rate-limited 1/min/path —
 *    en slettet fil skal aldri bli en signeringsstorm.
 *
 * Livssyklus (P1): `clearMediaUrlCache()` ved signOut (delt enhet blir ren),
 * `purgeMediaCacheByPrefix(teamSpaceId)` ved medlemskapstap
 * (path-konvensjonen `{team_space_id}/…` gjør det presist),
 * `invalidateMediaCache(paths)` ved sletting.
 *
 * TTL-en ER tilbakekallingsmekanismen: signerte URL-er kan ikke revokeres
 * før utløp (verifisert i P1) — derfor 24 t og aldri lenger.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../supabase';
import {mediaPathFor, type MediaRef, type MediaVariant} from './types';

// Privat Storage-bucket for feed-/kampbilder. Path-konvensjon:
// {team_space_id}/{filnavn}. Privat fordi bilder kan være av barn — LÅST.
export const FEED_MEDIA_BUCKET = 'feed-media';

/** 24 t (P1, LÅST). Sekunder — det er enheten createSignedUrls tar. */
export const SIGNED_URL_TTL_S = 24 * 3600;

// < 6 t igjen → moden for fornying i neste batch (klokkeskjev-marginen).
const REFRESH_MARGIN_MS = 6 * 3600 * 1000;
// < 5 min igjen → ubrukelig for visning; bildet ville dødd midt i lastingen.
const UNUSABLE_MARGIN_MS = 5 * 60 * 1000;
const REFRESH_MIN_INTERVAL_MS = 60 * 1000;

// Versjonert nøkkel: bytt formatet → bump versjonen, gamle rader ignoreres
// og utløper hos AsyncStorage-lesingen under (aldri migrering av en cache).
const STORAGE_KEY = 'heia:mediaUrls:v1';
// Flere enn dette persisteres ikke — eldste utløp først ut. Minnet beholder
// alt for økten; taket vokter kun disklagringen.
const MAX_PERSISTED = 500;

interface Entry {
  url: string;
  /** Utløp, epoch ms. */
  exp: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
const lastRefreshAt = new Map<string, number>();
let hydrated: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const now = Date.now();
        for (const [path, entry] of Object.entries(
          JSON.parse(raw) as Record<string, Entry>,
        )) {
          // Minnet vinner over disk (ferskere), utløpt tas ikke inn.
          if (!cache.has(path) && entry.exp - now > UNUSABLE_MARGIN_MS) {
            cache.set(path, entry);
          }
        }
      })
      .catch(() => {
        // En ulesbar cache er bare en kald cache.
      });
  }
  return hydrated;
}

// Fire-and-forget, uten timer: skrivingen er liten (én JSON per batch), og
// en debounce-timer ville hengt igjen i testmiljøet.
function persist(): void {
  const entries = [...cache].sort((a, b) => b[1].exp - a[1].exp);
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(Object.fromEntries(entries.slice(0, MAX_PERSISTED))),
  ).catch(() => {});
}

/**
 * Signerer en batch og legger resultatet i cachen. Feil svelges: et bilde
 * uten URL vises som flate, og neste skjermlast prøver igjen.
 */
async function signBatch(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const {data} = await supabase.storage
      .from(FEED_MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    const exp = Date.now() + SIGNED_URL_TTL_S * 1000;
    let changed = false;
    for (const s of data || []) {
      if (s.signedUrl && !s.error && s.path) {
        cache.set(s.path, {url: s.signedUrl, exp});
        changed = true;
      }
    }
    if (changed) persist();
  } catch {
    // Som over: kald cache, ikke krasj.
  }
}

/**
 * ÉN signeringsbatch per skjermlast (P1): kall den med alle paths skjermen
 * skal vise, FØR items leveres til UI-et. Paths med god tid igjen hopper
 * den over — gjenbruk er hele poenget.
 */
export async function primeMediaUrls(paths: string[]): Promise<void> {
  await hydrate();
  const now = Date.now();
  const stale = [...new Set(paths)].filter(p => {
    const entry = cache.get(p);
    return !entry || entry.exp - now < REFRESH_MARGIN_MS;
  });
  await signBatch(stale);
}

/** Synkron lesing fra varm cache — `MediaImage` slipper et tomt førsteframe. */
export function peekMediaUrl(path: string): string | null {
  const entry = cache.get(path);
  return entry && entry.exp - Date.now() > UNUSABLE_MARGIN_MS
    ? entry.url
    : null;
}

/**
 * URL for én variant. Nesten alltid et cache-treff (prime har vært der);
 * ved miss signeres path-en alene, med dedupe så to samtidige `MediaImage`
 * for samme bilde blir ETT kall.
 */
export async function resolveMediaUrl(
  ref: MediaRef,
  variant: MediaVariant,
): Promise<string | null> {
  const path = mediaPathFor(ref, variant);
  await hydrate();
  const warm = peekMediaUrl(path);
  if (warm) return warm;

  const pending = inflight.get(path);
  if (pending) return pending;

  const promise = signBatch([path])
    .then(() => peekMediaUrl(path))
    .finally(() => {
      inflight.delete(path);
    });
  inflight.set(path, promise);
  return promise;
}

/**
 * Tvungen fornying etter en feilet bildelasting (typisk utløpt token etter
 * lang bakgrunn). Rate-limited per path: returnerer null i stedet for å
 * hamre på en fil som faktisk er borte.
 */
export async function refreshMediaUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const last = lastRefreshAt.get(path);
  if (last !== undefined && now - last < REFRESH_MIN_INTERVAL_MS) {
    return null;
  }
  lastRefreshAt.set(path, now);
  await hydrate();
  cache.delete(path);
  await signBatch([path]);
  return peekMediaUrl(path);
}

/** Sletting: URL-ene til de fjernede objektene skal ikke overleve dem. */
export function invalidateMediaCache(paths: string[]): void {
  let changed = false;
  for (const p of paths) {
    if (cache.delete(p)) changed = true;
  }
  if (changed) persist();
}

/**
 * Medlemskapstap: alt som hører laget til ut av cachen. Path-konvensjonen
 * `{team_space_id}/…` gjør prefikset presist.
 */
export async function purgeMediaCacheByPrefix(
  teamSpaceId: string,
): Promise<void> {
  await hydrate();
  const prefix = `${teamSpaceId}/`;
  let changed = false;
  for (const path of [...cache.keys()]) {
    if (path.startsWith(prefix)) {
      cache.delete(path);
      changed = true;
    }
  }
  if (changed) persist();
}

/** signOut: delt enhet skal være ren — minne OG disk. */
export async function clearMediaUrlCache(): Promise<void> {
  cache.clear();
  lastRefreshAt.clear();
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/**
 * KUN for tester: glem minnet og hydreringen, men la AsyncStorage stå —
 * simulerer en app-omstart så persistering/prune kan bevises.
 */
export function _resetMediaUrlCacheForTests(): void {
  cache.clear();
  inflight.clear();
  lastRefreshAt.clear();
  hydrated = null;
}
