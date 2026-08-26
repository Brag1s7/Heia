/**
 * Signert-URL-laget for privat media (P1/P4) — hele appens ENESTE vei fra
 * storage-path til lesbar URL.
 *
 * Rotårsak nr. 1 i egress-auditen var at hver henting signerte på nytt:
 * nytt token = ny URL = 100 % cache-miss i både CDN og RN-Image, hver gang.
 * Kuren er gjenbruk: én signert URL per path, TTL 24 t, cachet i minne og
 * AsyncStorage, delt av alle skjermer.
 *
 *  - `primeMediaUrls(paths, bucket?)`: ÉN signeringsbatch per skjermlast.
 *    API-laget kaller den med alle paths den nettopp mappet; `MediaImage`
 *    leser deretter fra varm cache. Signerer kun paths som mangler eller har
 *    < 6 t igjen (margin for klokkeskjev — P1).
 *  - `resolveMediaUrl(ref, variant)`: per-bilde-oppslag med inflight-dedupe.
 *    Sikkerhetsnettet for stier prime ikke så (deep-link rett til en tråd).
 *  - `refreshMediaUrl(path, bucket?)`: onError-fornying, rate-limited
 *    1/min/path — en slettet fil skal aldri bli en signeringsstorm.
 *
 * TO BUCKETS (fra profilbilde-skiva, 00068): `feed-media` (lag-scopet, path
 * `{team_space_id}/…`) og `avatars` (person-scopet, `{user_id}/…`). Begge er
 * PRIVATE, og cachen nøkles derfor på `bucket/path` — ikke path alene.
 * Bucket er valgfri overalt og defaulter til feed-media, så alle kallsteder
 * fra fase A/B står uendret.
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

/**
 * Privat Storage-bucket for profilbilder (00068). Path-konvensjon:
 * {user_id}/avatar-{ms}.jpg. Privat av samme grunn som feed-media, og av
 * én til: et profilbilde er ofte et bilde av opplasterens eget barn.
 */
export const AVATARS_BUCKET = 'avatars';

/** 24 t (P1, LÅST). Sekunder — det er enheten createSignedUrls tar. */
export const SIGNED_URL_TTL_S = 24 * 3600;

// < 6 t igjen → moden for fornying i neste batch (klokkeskjev-marginen).
const REFRESH_MARGIN_MS = 6 * 3600 * 1000;
// < 5 min igjen → ubrukelig for visning; bildet ville dødd midt i lastingen.
const UNUSABLE_MARGIN_MS = 5 * 60 * 1000;
const REFRESH_MIN_INTERVAL_MS = 60 * 1000;

/**
 * Maks paths per `createSignedUrls`-kall (S1-e). Én batch på flere hundre
 * paths er én stor, treg respons som alt venter på — og et vilkårlig stort
 * request-body. Chunken holder hvert kall forutsigbart; 250 paths = 3 kall.
 */
export const SIGN_BATCH_MAX = 100;

// Versjonert nøkkel: bytt formatet → bump versjonen, gamle rader ignoreres
// og utløper hos AsyncStorage-lesingen under (aldri migrering av en cache).
// v2 = nøkkelen bærer bucket foran path (to private buckets fra 00068).
const STORAGE_KEY = 'heia:mediaUrls:v2';
// Flere enn dette persisteres ikke — eldste utløp først ut. Minnet beholder
// alt for økten; taket vokter kun disklagringen.
const MAX_PERSISTED = 500;

interface Entry {
  url: string;
  /** Utløp, epoch ms. */
  exp: number;
}

/**
 * Cache-nøkkelen. Bucketnavn kan ikke inneholde `/`, så første segment er
 * entydig bucketen og resten er path-en — nøkler fra to buckets kan aldri
 * kollidere, heller ikke når to objekter har samme path.
 */
function cacheKey(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

const cache = new Map<string, Entry>();
// Pågående signering per cache-nøkkel (S1-e): to samtidige primes med samme
// paths — eller en prime og en resolve — skal bli ETT signeringskall.
const inflight = new Map<string, Promise<void>>();
const lastRefreshAt = new Map<string, number>();
let hydrated: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const now = Date.now();
        for (const [key, entry] of Object.entries(
          JSON.parse(raw) as Record<string, Entry>,
        )) {
          // Minnet vinner over disk (ferskere), utløpt tas ikke inn.
          if (!cache.has(key) && entry.exp - now > UNUSABLE_MARGIN_MS) {
            cache.set(key, entry);
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
async function signBatch(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const {data} = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    const exp = Date.now() + SIGNED_URL_TTL_S * 1000;
    let changed = false;
    for (const s of data || []) {
      if (s.signedUrl && !s.error && s.path) {
        cache.set(cacheKey(bucket, s.path), {url: s.signedUrl, exp});
        changed = true;
      }
    }
    if (changed) persist();
  } catch {
    // Som over: kald cache, ikke krasj.
  }
}

/**
 * Signerer paths i chunker på ≤ SIGN_BATCH_MAX, med inflight-dedupe per
 * path (S1-e): paths som allerede er i flukt (fra en annen prime eller en
 * resolve) ventes på i stedet for å signeres på nytt. Løses når ALLE
 * involverte paths er avgjort.
 */
async function signPaths(bucket: string, paths: string[]): Promise<void> {
  const waits: Promise<void>[] = [];
  const fresh: string[] = [];
  for (const p of paths) {
    const pending = inflight.get(cacheKey(bucket, p));
    if (pending) {
      waits.push(pending);
    } else {
      fresh.push(p);
    }
  }
  for (let i = 0; i < fresh.length; i += SIGN_BATCH_MAX) {
    const chunk = fresh.slice(i, i + SIGN_BATCH_MAX);
    const promise = signBatch(bucket, chunk).finally(() => {
      for (const p of chunk) {
        inflight.delete(cacheKey(bucket, p));
      }
    });
    for (const p of chunk) {
      inflight.set(cacheKey(bucket, p), promise);
    }
    waits.push(promise);
  }
  await Promise.all(waits);
}

/**
 * ÉN signeringsrunde per skjermlast (P1): kall den med alle paths skjermen
 * skal vise, FØR items leveres til UI-et. Paths med god tid igjen hopper
 * den over — gjenbruk er hele poenget. Store lister chunkes
 * (SIGN_BATCH_MAX), og to samtidige primes med samme paths dedupes til
 * ett kall (S1-e).
 *
 * En skjerm som viser BEGGE bucketene (feeden: bilder + forfatteravatarer)
 * kaller den to ganger — én runde per bucket.
 */
export async function primeMediaUrls(
  paths: string[],
  bucket: string = FEED_MEDIA_BUCKET,
): Promise<void> {
  await hydrate();
  const now = Date.now();
  const stale = [...new Set(paths)].filter(p => {
    const entry = cache.get(cacheKey(bucket, p));
    return !entry || entry.exp - now < REFRESH_MARGIN_MS;
  });
  await signPaths(bucket, stale);
}

/** Synkron lesing fra varm cache — `MediaImage` slipper et tomt førsteframe. */
export function peekMediaUrl(
  path: string,
  bucket: string = FEED_MEDIA_BUCKET,
): string | null {
  const entry = cache.get(cacheKey(bucket, path));
  return entry && entry.exp - Date.now() > UNUSABLE_MARGIN_MS
    ? entry.url
    : null;
}

/**
 * URL for én variant. Nesten alltid et cache-treff (prime har vært der);
 * ved miss signeres path-en alene, med dedupe så to samtidige `MediaImage`
 * for samme bilde blir ETT kall — `signPaths` eier inflight-registeret.
 */
export async function resolveMediaUrl(
  ref: MediaRef,
  variant: MediaVariant,
): Promise<string | null> {
  const bucket = ref.bucket ?? FEED_MEDIA_BUCKET;
  const path = mediaPathFor(ref, variant);
  await hydrate();
  const warm = peekMediaUrl(path, bucket);
  if (warm) return warm;

  await signPaths(bucket, [path]);
  return peekMediaUrl(path, bucket);
}

/**
 * Tvungen fornying etter en feilet bildelasting (typisk utløpt token etter
 * lang bakgrunn). Rate-limited per path: returnerer null i stedet for å
 * hamre på en fil som faktisk er borte.
 */
export async function refreshMediaUrl(
  path: string,
  bucket: string = FEED_MEDIA_BUCKET,
): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const now = Date.now();
  const last = lastRefreshAt.get(key);
  if (last !== undefined && now - last < REFRESH_MIN_INTERVAL_MS) {
    return null;
  }
  lastRefreshAt.set(key, now);
  await hydrate();
  cache.delete(key);
  await signBatch(bucket, [path]);
  return peekMediaUrl(path, bucket);
}

/** Sletting: URL-ene til de fjernede objektene skal ikke overleve dem. */
export function invalidateMediaCache(
  paths: string[],
  bucket: string = FEED_MEDIA_BUCKET,
): void {
  let changed = false;
  for (const p of paths) {
    if (cache.delete(cacheKey(bucket, p))) changed = true;
  }
  if (changed) persist();
}

/**
 * Medlemskapstap: alt som hører laget til ut av cachen. Path-konvensjonen
 * `{team_space_id}/…` gjør prefikset presist.
 *
 * Rører KUN feed-media. Avatarer er person-scopet, ikke lag-scopet, så det
 * finnes ingen prefiks å purge på — en tapt lagkamerats signerte
 * avatar-URL blir liggende til den utløper (≤ 24 t). Selve BILDET er
 * uansett utilgjengelig med en gang: `shares_team_with` (00068) nekter ny
 * signering i det medlemskapet er borte.
 */
export async function purgeMediaCacheByPrefix(
  teamSpaceId: string,
): Promise<void> {
  await hydrate();
  const prefix = cacheKey(FEED_MEDIA_BUCKET, `${teamSpaceId}/`);
  let changed = false;
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
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
