/**
 * @format
 *
 * PROFILBILDE-VAKTEN (00068). Fire ting som ellers bare kan observeres i
 * prod — og som alle er stille når de ryker:
 *
 *   1. BUCKET-ISOLASJON. Cachen nøkles på bucket+path. Ryker den, kan et
 *      profilbilde serveres fra et feed-bildes signerte URL (eller motsatt)
 *      — samme path i to buckets er fullt lovlig.
 *   2. ÉN BATCH. Avataren er appens mest gjentatte bilde: én per feed-rad,
 *      én per kommentar, én per varsel. Signerer skjermen per bilde i
 *      stedet for per skjerm, er det en egress-regresjon på nettopp det
 *      bildet som gjentas mest — den regresjonen er hele grunnen til at
 *      `Avatar` ble flyttet inn i mediepipelinen.
 *   3. OPPLASTINGSKONTRAKTEN. Path `{user_id}/avatar-…`, privat bucket,
 *      1 års cache-control (P1: kan ALDRI endres per objekt i etterkant).
 *      Første path-segment er det storage-policyene gates på — endres det,
 *      slutter policyene i 00068 å bety noe.
 *   4. SLETTING RYDDER CACHEN FØRST. Uten det blir en fersk signert URL til
 *      et nettopp slettet objekt liggende i inntil 24 t og gir 404 der det
 *      skulle stått initialer.
 */
import * as FileSystem from 'expo-file-system/legacy';

// Mocken registrerer BUCKETEN — resolver-testen fra fase A bryr seg ikke om
// den (alt lå i feed-media), og det er nettopp det som ikke lenger holder.
const signed: Array<{bucket: string; paths: string[]}> = [];
const removed: Array<{bucket: string; paths: string[]}> = [];
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: {session: {access_token: 'token-123'}},
      })),
    },
    storage: {
      from: jest.fn((bucket: string) => ({
        createSignedUrls: jest.fn(async (paths: string[]) => {
          signed.push({bucket, paths});
          return {
            data: paths.map(p => ({
              path: p,
              signedUrl: `https://cdn.test/${bucket}/${p}?token=${signed.length}`,
              error: null,
            })),
            error: null,
          };
        }),
        remove: jest.fn(async (paths: string[]) => {
          removed.push({bucket, paths});
          return {data: null, error: null};
        }),
      })),
    },
  },
}));

import {
  avatarRef,
  deleteAvatarFile,
  primeAvatars,
  uploadAvatar,
} from '../src/lib/media/avatar';
import {
  clearMediaUrlCache,
  peekMediaUrl,
  primeMediaUrls,
  _resetMediaUrlCacheForTests,
} from '../src/lib/media/resolver';

const uploadAsync = FileSystem.uploadAsync as jest.Mock;

const IMAGE = {
  uri: 'file:///tmp/meg.jpg',
  fileUri: 'file:///tmp/meg.jpg',
  thumbUri: null,
  mimeType: 'image/jpeg',
  fileName: 'meg.jpg',
  sizeBytes: 24_000,
  width: 256,
  height: 256,
};

beforeEach(async () => {
  await clearMediaUrlCache();
  _resetMediaUrlCacheForTests();
  signed.length = 0;
  removed.length = 0;
  uploadAsync.mockClear();
  uploadAsync.mockImplementation(async () => ({
    status: 200,
    headers: {},
    body: '',
  }));
});

test('avatarRef: path → ref i avatars-bucketen, tomt → null', () => {
  expect(avatarRef('u-1/avatar-9.jpg')).toEqual({
    path: 'u-1/avatar-9.jpg',
    bucket: 'avatars',
  });
  // Ingen thumb: profilbildet har KUN én variant (256 px), så begge
  // variantene skal peke på samme path.
  expect(avatarRef('u-1/avatar-9.jpg')?.thumbPath).toBeUndefined();

  expect(avatarRef(null)).toBeNull();
  expect(avatarRef(undefined)).toBeNull();
  expect(avatarRef('')).toBeNull();
});

test('bucket-isolasjon: samme path i to buckets er to cache-oppføringer', async () => {
  const path = 'shared/kollisjon.jpg';
  await primeAvatars([path]);
  await primeMediaUrls([path]);

  expect(signed).toEqual([
    {bucket: 'avatars', paths: [path]},
    {bucket: 'feed-media', paths: [path]},
  ]);

  const asAvatar = peekMediaUrl(path, 'avatars');
  const asFeed = peekMediaUrl(path);
  expect(asAvatar).toContain('/avatars/');
  expect(asFeed).toContain('/feed-media/');
  expect(asAvatar).not.toBe(asFeed);
});

test('primeAvatars: ÉN batch for hele skjermen, null-er og duplikater ut', async () => {
  await primeAvatars([
    'u-1/a.jpg',
    null,
    'u-2/a.jpg',
    undefined,
    // Samme person to ganger (forelder med to barn i lagoversikten, eller
    // to kommentarer fra samme forfatter) skal ikke signeres to ganger.
    'u-1/a.jpg',
  ]);

  expect(signed).toHaveLength(1);
  expect(signed[0].bucket).toBe('avatars');
  expect(signed[0].paths).toEqual(['u-1/a.jpg', 'u-2/a.jpg']);
});

test('primeAvatars: en liste helt uten bilder rører ikke nettet', async () => {
  await primeAvatars([null, undefined]);
  expect(signed).toHaveLength(0);
});

test('primeAvatars: allerede varme paths signeres ikke på nytt', async () => {
  await primeAvatars(['u-1/a.jpg']);
  await primeAvatars(['u-1/a.jpg', 'u-2/a.jpg']);

  expect(signed).toHaveLength(2);
  // Andre runde tok KUN den nye — gjenbruk er hele poenget (P1).
  expect(signed[1].paths).toEqual(['u-2/a.jpg']);
});

test('uploadAvatar: {user_id}/avatar-…, privat bucket, 1 års cache-control', async () => {
  const path = await uploadAvatar('u-42', IMAGE);

  expect(path).toMatch(/^u-42\/avatar-\d+\.jpg$/);
  expect(uploadAsync).toHaveBeenCalledTimes(1);

  const [url, fileUri, opts] = uploadAsync.mock.calls[0];
  expect(url).toBe(
    `http://localhost:54321/storage/v1/object/avatars/${path}`,
  );
  expect(fileUri).toBe(IMAGE.fileUri);
  expect(opts.headers).toMatchObject({
    authorization: 'Bearer token-123',
    'content-type': 'image/jpeg',
    // P1: settes ved upload og kan ALDRI endres per objekt etterpå.
    'cache-control': 'max-age=31536000',
    // Nytt filnavn per opplasting — en kollisjon skal feile høyt.
    'x-upsert': 'false',
  });
});

test('deleteAvatarFile: cachen invalideres FØR objektet fjernes', async () => {
  const path = 'u-42/avatar-1.jpg';
  await primeAvatars([path]);
  expect(peekMediaUrl(path, 'avatars')).toBeTruthy();

  await deleteAvatarFile(path);

  expect(peekMediaUrl(path, 'avatars')).toBeNull();
  expect(removed).toEqual([{bucket: 'avatars', paths: [path]}]);
});
