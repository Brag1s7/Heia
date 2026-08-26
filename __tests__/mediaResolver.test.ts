/**
 * @format
 *
 * SIGNED-URL-CACHEN (fase A, P1/P4) — kontrakten som gjør egress-fiksen sann:
 *
 *   1. Gjenbruk: samme path signeres ÉN gang innenfor TTL — andre lesing er
 *      et cache-treff, aldri et nytt kall. (Rotårsak nr. 1 var det motsatte.)
 *   2. Fornying: < 6 t igjen → prime signerer på nytt (klokkeskjev-marginen).
 *   3. Dedupe: to samtidige oppslag på kald path = ETT signeringskall.
 *   4. Rate-limit: onError-fornying maks 1/min/path — en død fil skal aldri
 *      bli en signeringsstorm.
 *   5. Persistering: cachen overlever «omstart» (AsyncStorage), og utløpte
 *      rader tas ikke inn igjen.
 *   6. Livssyklus: signOut tømmer alt; medlemskapstap purger lag-prefikset.
 *
 * Endres tallene her, endres egress-regnestykket i
 * docs/EGRESS-MEDIA-ARKITEKTUR-2026-08.md — gjør det bevisst.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/lib/supabase', () => {
  const createSignedUrls = jest.fn((paths: string[]) =>
    Promise.resolve({
      data: paths.map(p => ({
        path: p,
        signedUrl: `https://cdn.test/${p}?token=${Math.random()}`,
        error: null,
      })),
      error: null,
    }),
  );
  return {
    supabase: {storage: {from: jest.fn(() => ({createSignedUrls}))}},
    __createSignedUrls: createSignedUrls,
  };
});

import {
  primeMediaUrls,
  resolveMediaUrl,
  refreshMediaUrl,
  peekMediaUrl,
  invalidateMediaCache,
  purgeMediaCacheByPrefix,
  clearMediaUrlCache,
  _resetMediaUrlCacheForTests,
} from '../src/lib/media/resolver';

const {__createSignedUrls: signMock} = jest.requireMock('../src/lib/supabase');

const HOUR = 3600 * 1000;
const REF = {path: 'ts-1/1722900000000-abc.jpg'};

beforeEach(async () => {
  jest.useFakeTimers({now: new Date('2026-08-17T12:00:00Z')});
  await clearMediaUrlCache();
  _resetMediaUrlCacheForTests();
  signMock.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

test('gjenbruk: én signering per path innenfor TTL, på tvers av inngangene', async () => {
  const url = await resolveMediaUrl(REF, 'display');
  expect(url).toContain(REF.path);
  expect(signMock).toHaveBeenCalledTimes(1);

  // Ny resolve, prime og synkron peek — alle treffer cachen.
  expect(await resolveMediaUrl(REF, 'display')).toBe(url);
  await primeMediaUrls([REF.path]);
  expect(peekMediaUrl(REF.path)).toBe(url);
  expect(signMock).toHaveBeenCalledTimes(1);

  // 12 t senere (12 t igjen av TTL): fortsatt gjenbruk.
  jest.advanceTimersByTime(12 * HOUR);
  await primeMediaUrls([REF.path]);
  expect(signMock).toHaveBeenCalledTimes(1);
});

test('fornying: prime signerer på nytt når < 6 t gjenstår', async () => {
  await primeMediaUrls([REF.path]);
  expect(signMock).toHaveBeenCalledTimes(1);

  // 19 t inne i 24 t-TTL-en → 5 t igjen → moden for fornying.
  jest.advanceTimersByTime(19 * HOUR);
  await primeMediaUrls([REF.path]);
  expect(signMock).toHaveBeenCalledTimes(2);
});

test('utløpt URL brukes aldri: peek gir null, resolve signerer på nytt', async () => {
  await primeMediaUrls([REF.path]);
  jest.advanceTimersByTime(24 * HOUR);
  expect(peekMediaUrl(REF.path)).toBeNull();
  expect(await resolveMediaUrl(REF, 'display')).toContain(REF.path);
  expect(signMock).toHaveBeenCalledTimes(2);
});

test('dedupe: to samtidige oppslag på kald path = ett signeringskall', async () => {
  const [a, b] = await Promise.all([
    resolveMediaUrl(REF, 'display'),
    resolveMediaUrl(REF, 'display'),
  ]);
  expect(a).toBe(b);
  expect(signMock).toHaveBeenCalledTimes(1);
});

test('prime signerer batchen i ETT kall og hopper over varme paths', async () => {
  await primeMediaUrls(['ts-1/a.jpg', 'ts-1/b.jpg']);
  expect(signMock).toHaveBeenCalledTimes(1);
  expect(signMock).toHaveBeenCalledWith(
    ['ts-1/a.jpg', 'ts-1/b.jpg'],
    expect.anything(),
  );

  // Én ny path i neste skjermlast → kun DEN signeres.
  await primeMediaUrls(['ts-1/a.jpg', 'ts-1/c.jpg']);
  expect(signMock).toHaveBeenCalledTimes(2);
  expect(signMock).toHaveBeenLastCalledWith(['ts-1/c.jpg'], expect.anything());
});

test('chunking (S1-e): 250 paths signeres som 3 kall på maks 100', async () => {
  const mange = Array.from({length: 250}, (_, i) => `ts-1/p${i}.jpg`);
  await primeMediaUrls(mange);
  expect(signMock).toHaveBeenCalledTimes(3);
  expect(signMock.mock.calls.map((c: unknown[][]) => c[0].length)).toEqual([
    100, 100, 50,
  ]);
  // Alle 250 landet i cachen — chunkingen mistet ingen.
  expect(peekMediaUrl('ts-1/p249.jpg')).toContain('ts-1/p249.jpg');
});

test('inflight-dedupe (S1-e): samtidige primes med samme paths = ETT kall', async () => {
  // To skjermer primer samme liste samtidig (feed + kommentartråd åpnet
  // raskt): før S1-e ga det to identiske signeringskall.
  await Promise.all([
    primeMediaUrls(['ts-1/a.jpg', 'ts-1/b.jpg']),
    primeMediaUrls(['ts-1/a.jpg', 'ts-1/b.jpg']),
  ]);
  expect(signMock).toHaveBeenCalledTimes(1);

  // Delvis overlapp: den inflight path-en ventes på, kun den NYE signeres.
  signMock.mockClear();
  await Promise.all([
    primeMediaUrls(['ts-1/c.jpg', 'ts-1/d.jpg']),
    primeMediaUrls(['ts-1/d.jpg', 'ts-1/e.jpg']),
  ]);
  expect(signMock).toHaveBeenCalledTimes(2);
  expect(signMock).toHaveBeenLastCalledWith(['ts-1/e.jpg'], expect.anything());
});

test('thumb-varianten leser thumbPath, med fallback til path', async () => {
  const withThumb = {path: 'ts-1/a.jpg', thumbPath: 'ts-1/a-t480.jpg'};
  await resolveMediaUrl(withThumb, 'thumb');
  expect(signMock).toHaveBeenLastCalledWith(
    ['ts-1/a-t480.jpg'],
    expect.anything(),
  );
  await resolveMediaUrl({path: 'ts-1/b.jpg'}, 'thumb');
  expect(signMock).toHaveBeenLastCalledWith(['ts-1/b.jpg'], expect.anything());
});

test('refresh er rate-limited per path: 1/min, aldri en storm', async () => {
  await primeMediaUrls([REF.path]);
  expect(await refreshMediaUrl(REF.path)).toContain(REF.path);
  expect(signMock).toHaveBeenCalledTimes(2);

  // Rett etterpå: nektes (null) uten nytt kall.
  expect(await refreshMediaUrl(REF.path)).toBeNull();
  expect(signMock).toHaveBeenCalledTimes(2);

  // Ett minutt senere: lov igjen.
  jest.advanceTimersByTime(61 * 1000);
  expect(await refreshMediaUrl(REF.path)).toContain(REF.path);
  expect(signMock).toHaveBeenCalledTimes(3);
});

test('persistering: cachen overlever omstart, utløpte rader gjør det ikke', async () => {
  await primeMediaUrls([REF.path]);
  const url = peekMediaUrl(REF.path);

  // «Omstart»: minnet er borte, AsyncStorage består → null nye signeringer.
  _resetMediaUrlCacheForTests();
  expect(await resolveMediaUrl(REF, 'display')).toBe(url);
  expect(signMock).toHaveBeenCalledTimes(1);

  // Omstart ETTER utløp: raden tas ikke inn, path-en signeres på nytt.
  jest.advanceTimersByTime(24 * HOUR);
  _resetMediaUrlCacheForTests();
  expect(await resolveMediaUrl(REF, 'display')).not.toBe(url);
  expect(signMock).toHaveBeenCalledTimes(2);
});

test('livssyklus: invalidate/purge/clear fjerner nøyaktig det de skal', async () => {
  await primeMediaUrls(['ts-1/a.jpg', 'ts-1/b.jpg', 'ts-2/c.jpg']);

  // Sletting: kun det slettede objektet mister URL-en sin.
  invalidateMediaCache(['ts-1/a.jpg']);
  expect(peekMediaUrl('ts-1/a.jpg')).toBeNull();
  expect(peekMediaUrl('ts-1/b.jpg')).not.toBeNull();

  // Medlemskapstap: hele lagets prefiks purges, andre lag urørt.
  await purgeMediaCacheByPrefix('ts-1');
  expect(peekMediaUrl('ts-1/b.jpg')).toBeNull();
  expect(peekMediaUrl('ts-2/c.jpg')).not.toBeNull();

  // signOut: alt borte — også fra disk (omstart finner ingenting).
  await clearMediaUrlCache();
  _resetMediaUrlCacheForTests();
  expect(await AsyncStorage.getItem('heia:mediaUrls:v1')).toBeNull();
  expect(peekMediaUrl('ts-2/c.jpg')).toBeNull();
});
