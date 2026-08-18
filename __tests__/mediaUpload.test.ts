/**
 * B1-vakt: opplastingspipelinen (media/upload.ts + uploadTeamImage).
 *
 * Beviser tre ting som ellers bare kan observeres i prod:
 *  1. Et bilde med thumb = NØYAKTIG to uploadAsync-kall (master -d2048 +
 *     thumb -t480, backfill-scriptets navnekonvensjon), med P1-headerne
 *     (cache-control max-age=86400, x-upsert false, Bearer fra økta) — og
 *     media-raden får thumbnail_path som peker på thumben.
 *  2. Uten thumb (logo-stien / feilet generering): ETT kall, thumbnail_path
 *     null — aldri et halvt objektnavn i raden.
 *  3. En FEILET thumb-opplasting blokkerer ikke innlegget: posten opprettes,
 *     thumbnail_path blir null (visningen faller tilbake til masteren, P4).
 *
 * Base64-brua fra A er borte — dette er kontrakten som erstattet den.
 */
import * as FileSystem from 'expo-file-system/legacy';

// Fanger alle inserts per tabell så radinnholdet kan asserters. Buildere:
// media/feed_posts bruker .insert().select('id').single(), media_attachments
// awaiter .insert() direkte — returobjektet dekker begge formene.
const inserts: Array<{table: string; row: any}> = [];
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: {session: {access_token: 'token-123'}},
      })),
    },
    from: jest.fn((table: string) => ({
      insert: jest.fn((row: any) => {
        inserts.push({table, row});
        const id = table === 'media' ? 'media-1' : 'post-1';
        return {
          error: null,
          select: () => ({
            single: async () => ({data: {id}, error: null}),
          }),
        };
      }),
    })),
  },
}));

jest.mock('../src/lib/api/authUser', () => ({
  getUserId: jest.fn(async () => 'user-1'),
  getUserIdOrNull: jest.fn(async () => 'user-1'),
}));

import {createImagePost} from '../src/lib/api/feed';

const uploadAsync = FileSystem.uploadAsync as jest.Mock;

const baseImage = {
  fileUri: 'file:///tmp/display.jpg',
  thumbUri: 'file:///tmp/thumb.jpg',
  mimeType: 'image/jpeg',
  fileName: 'bilde.jpg',
  sizeBytes: 111,
  width: 2048,
  height: 1536,
};

beforeEach(() => {
  inserts.length = 0;
  uploadAsync.mockClear();
  uploadAsync.mockImplementation(async () => ({
    status: 200,
    headers: {},
    body: '',
  }));
});

test('master + thumb: to uploadAsync-kall med P1-headere, thumbnail_path på raden', async () => {
  await createImagePost({teamSpaceId: 'ts-1', content: 'hei', image: baseImage});

  expect(uploadAsync).toHaveBeenCalledTimes(2);
  const [masterCall, thumbCall] = uploadAsync.mock.calls;

  // Masteren: riktig bucket-URL, backfill-konvensjonens -d2048-navn, og
  // fila streames fra picker-URI-en (ingen base64 noe sted).
  expect(masterCall[0]).toMatch(
    /^http:\/\/localhost:54321\/storage\/v1\/object\/feed-media\/ts-1\/.+-d2048\.jpg$/,
  );
  expect(masterCall[1]).toBe(baseImage.fileUri);
  expect(masterCall[2].httpMethod).toBe('POST');
  expect(masterCall[2].headers).toMatchObject({
    authorization: 'Bearer token-123',
    'content-type': 'image/jpeg',
    'x-upsert': 'false',
    'cache-control': 'max-age=86400',
  });

  // Thumben: -t480-navnet, compressor-fila, alltid JPEG.
  expect(thumbCall[0]).toMatch(/-t480\.jpg$/);
  expect(thumbCall[1]).toBe(baseImage.thumbUri);
  expect(thumbCall[2].headers['content-type']).toBe('image/jpeg');

  // Raden: begge stiene, samme base — thumb-oppslaget (mediaPathFor)
  // treffer varianten, aldri masteren.
  const mediaRow = inserts.find(i => i.table === 'media')!.row;
  expect(mediaRow.storage_path).toMatch(/^ts-1\/.+-d2048\.jpg$/);
  expect(mediaRow.thumbnail_path).toMatch(/^ts-1\/.+-t480\.jpg$/);
  expect(mediaRow.thumbnail_path.replace(/-t480\.jpg$/, '')).toBe(
    mediaRow.storage_path.replace(/-d2048\.jpg$/, ''),
  );
});

test('uten thumb: ett kall, thumbnail_path null', async () => {
  await createImagePost({
    teamSpaceId: 'ts-1',
    content: '',
    image: {...baseImage, thumbUri: null},
  });

  expect(uploadAsync).toHaveBeenCalledTimes(1);
  const mediaRow = inserts.find(i => i.table === 'media')!.row;
  expect(mediaRow.thumbnail_path).toBeNull();
});

test('feilet thumb-opplasting blokkerer ikke innlegget', async () => {
  // Masteren lykkes, thumben svarer 500 (f.eks. dødt nett midt i turen).
  uploadAsync
    .mockImplementationOnce(async () => ({status: 200, headers: {}, body: ''}))
    .mockImplementationOnce(async () => ({status: 500, headers: {}, body: ''}));

  await createImagePost({teamSpaceId: 'ts-1', content: 'hei', image: baseImage});

  const mediaRow = inserts.find(i => i.table === 'media')!.row;
  expect(mediaRow.thumbnail_path).toBeNull();
  // Innlegget gikk hele veien: feed_post + kobling finnes.
  expect(inserts.some(i => i.table === 'feed_posts')).toBe(true);
  expect(inserts.some(i => i.table === 'media_attachments')).toBe(true);
});

test('ingen økt = høylytt feil FØR noen bytes sendes', async () => {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  supabase.auth.getSession.mockImplementationOnce(async () => ({
    data: {session: null},
  }));

  await expect(
    createImagePost({teamSpaceId: 'ts-1', content: '', image: baseImage}),
  ).rejects.toThrow('Ingen aktiv økt');
  expect(uploadAsync).not.toHaveBeenCalled();
});
