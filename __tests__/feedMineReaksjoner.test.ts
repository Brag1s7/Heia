/**
 * @format
 *
 * «HAR JEG HEIET» KOMMER NÅ MED FEEDEN (punkt 100 / migrasjon 00086).
 *
 * Før 00086 kostet svaret en ekstra, SERIELL spørring mot `reactions` —
 * den kunne ikke parallelliseres, for den trenger post-id-ene fra
 * feed-svaret. 150–300 ms på hver eneste feed-åpning på mobilnett.
 *
 * Denne vokter BEGGE veier, og fallbacken er det viktigste:
 *   · med `my_reactions` i radene → ingen ekstra spørring, riktige verdier
 *   · UTEN nøkkelen (base uten 00086) → nøyaktig dagens ekstra spørring,
 *     og feeden viser IKKE alle innlegg som uheiet
 *
 * Uten den andre halvdelen ville en app rullet ut før migrasjonen vist
 * hvert eneste innlegg som «ikke heiet», og hvert HEIA-trykk ville blitt et
 * forsøk på å heie på nytt.
 */

const mockRpc = jest.fn();
const mockIn = jest.fn();
const mockFrom = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));

jest.mock('../src/lib/media/resolver', () => ({
  primeMediaUrls: jest.fn(() => Promise.resolve()),
  FEED_MEDIA_BUCKET: 'feed-media',
  invalidateMediaCache: jest.fn(),
}));

jest.mock('../src/lib/media/avatar', () => ({
  primeAvatars: jest.fn(() => Promise.resolve()),
  avatarRef: jest.fn(() => null),
}));

import {getTeamFeed, HEIA_EMOJI} from '../src/lib/api/feed';

const TS = 'ts-1';
const MEG = 'user-meg';

/** To innlegg: ett jeg har heiet på, ett jeg ikke har rørt. */
function rows(withMine: boolean) {
  return [
    {
      id: 'post-heiet',
      type: 'melding',
      content: 'Heiet',
      is_pinned: false,
      created_at: '2026-09-10T10:00:00Z',
      author_id: 'user-annen',
      author_name: 'Annen',
      reaction_counts: {[HEIA_EMOJI]: 3},
      comment_count: 0,
      ...(withMine ? {my_reactions: [HEIA_EMOJI]} : {}),
    },
    {
      id: 'post-urort',
      type: 'melding',
      content: 'Urørt',
      is_pinned: false,
      created_at: '2026-09-09T10:00:00Z',
      author_id: 'user-annen',
      author_name: 'Annen',
      reaction_counts: {},
      comment_count: 0,
      ...(withMine ? {my_reactions: []} : {}),
    },
  ];
}

/** Kjeden `.from('reactions').select().eq().eq().in()`. */
function stubReactionsQuery(reacted: string[]) {
  mockIn.mockResolvedValue({
    data: reacted.map(id => ({feed_post_id: id})),
    error: null,
  });
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.in = (...a: unknown[]) => mockIn(...a);
  mockFrom.mockReturnValue(chain);
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('med 00086: ingen ekstra spørring, og riktige verdier begge veier', async () => {
  mockRpc.mockResolvedValue({data: rows(true), error: null});
  stubReactionsQuery([]);

  const items = await getTeamFeed(TS, MEG);

  expect(items.map(i => [i.id, i.iReacted])).toEqual([
    ['post-heiet', true],
    ['post-urort', false],
  ]);
  // DET ER HELE POENGET: reactions-tabellen er ikke rørt.
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

test('uten 00086: dagens ekstra spørring, og den brukes faktisk', async () => {
  mockRpc.mockResolvedValue({data: rows(false), error: null});
  stubReactionsQuery(['post-heiet']);

  const items = await getTeamFeed(TS, MEG);

  expect(items.map(i => [i.id, i.iReacted])).toEqual([
    ['post-heiet', true],
    ['post-urort', false],
  ]);
  expect(mockFrom).toHaveBeenCalledWith('reactions');
});

test('en annens emoji i my_reactions er ikke et HEIA', async () => {
  const r = rows(true);
  (r[0] as {my_reactions: string[]}).my_reactions = ['🎉'];
  mockRpc.mockResolvedValue({data: r, error: null});
  stubReactionsQuery([]);

  const items = await getTeamFeed(TS, MEG);

  // Jeg har reagert på posten, men ikke med 👏 — knappen skal være av.
  expect(items[0].iReacted).toBe(false);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('tom feed: ingen av delene fyrer', async () => {
  mockRpc.mockResolvedValue({data: [], error: null});
  stubReactionsQuery([]);

  expect(await getTeamFeed(TS, MEG)).toEqual([]);
  expect(mockFrom).not.toHaveBeenCalled();
});
