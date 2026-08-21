/**
 * ⚠️ IDEMPOTENSEN, PÅ NIVÅET DEN FAKTISK BOR.
 *
 * `reactions` har `UNIQUE (feed_post_id, user_id, emoji)` (00009:103). Et
 * andre INSERT gir derfor `23505`. Kampknappen (skive 10) er en jubel som
 * blir hamret på, og den skal aldri se en feil fordi brukeren alt har heiet
 * — raden finnes, som er alt kalleren ba om.
 *
 * Testen vokter to ting som lett kunne blitt snudd:
 *   · `addReaction` gjør KUN insert. Det finnes ingen delete-gren.
 *   · `23505` svelges. Alt annet kastes videre.
 */

const mockInsert = jest.fn();
const mockDelete = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'reactions') throw new Error('feil tabell: ' + table);
      return {
        insert: (row: unknown) => mockInsert(row),
        delete: () => mockDelete(),
      };
    },
  },
}));
jest.mock('../src/lib/api/authUser', () => ({
  getUserId: async () => 'u1',
  getUserIdOrNull: async () => 'u1',
}));

import {addReaction} from '../src/lib/api/feed';

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({error: null});
});

it('skriver ÉN rad, og rører aldri delete', async () => {
  await addReaction('p1');
  expect(mockInsert).toHaveBeenCalledTimes(1);
  expect(mockInsert).toHaveBeenCalledWith({
    feed_post_id: 'p1',
    user_id: 'u1',
    emoji: '👏',
  });
  // ⚠️ Selve garantien: funksjonen KAN ikke fjerne en reaksjon.
  expect(mockDelete).not.toHaveBeenCalled();
});

it('23505 — «du har alt heiet» — er suksess, ikke en feil', async () => {
  mockInsert.mockResolvedValue({error: {code: '23505', message: 'duplicate'}});
  await expect(addReaction('p1')).resolves.toBeUndefined();
});

it('alt annet kastes videre — en ekte feil skal ikke se ut som en heia', async () => {
  mockInsert.mockResolvedValue({error: {code: '42501', message: 'RLS'}});
  await expect(addReaction('p1')).rejects.toMatchObject({code: '42501'});
});
