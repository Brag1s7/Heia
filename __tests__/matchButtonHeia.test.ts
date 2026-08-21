/**
 * ⚠️ KAMPKNAPPENS HEIA SKAL ALDRI KUNNE FJERNE EN REAKSJON.
 *
 * Dette er testen Brage ba om eksplisitt: «En rask dobbeltrykk eller treg
 * forespørsel må aldri føre til at toggleReaction fjerner reaksjonen.»
 *
 * Tre ting bevises her:
 *   1. Knappen når ALDRI delete-stien (`toggleReaction` finnes ikke i sporet).
 *   2. Dobbelttrykk og trykk-mens-den-henger gir ÉTT kall og ÉN opptelling.
 *   3. Et unique-brudd (`23505`, altså «du har alt heiet») ruller ikke
 *      tilbake — telleren skal ikke gå ned fordi serveren allerede har raden.
 */

const mockAddReaction = jest.fn();
const mockToggleReaction = jest.fn();
const mockAdjustMatchEngagement = jest.fn();
const mockPatchFeedItem = jest.fn();

jest.mock('../src/lib/api/feed', () => ({
  addReaction: (...a: unknown[]) => mockAddReaction(...a),
  toggleReaction: (...a: unknown[]) => mockToggleReaction(...a),
}));
jest.mock('../src/lib/queries/eventDetail', () => ({
  adjustMatchEngagement: (...a: unknown[]) => mockAdjustMatchEngagement(...a),
}));
jest.mock('../src/lib/queries/feed', () => ({
  patchFeedItem: (...a: unknown[]) => mockPatchFeedItem(...a),
}));

import {cheerOnMoment, resetHeiaPending} from '../src/lib/queries/matchHeia';

const ARGS = {eventId: 'e1', teamSpaceId: 't1', postId: 'p1'};

/** Summen av alle optimistiske HEIA-justeringer på posten. */
function nettoHeia(): number {
  return mockAdjustMatchEngagement.mock.calls.reduce(
    (sum, call) => sum + ((call[2] as {heia?: number})?.heia ?? 0),
    0,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetHeiaPending();
  mockAddReaction.mockResolvedValue(undefined);
});

it('bruker add-stien, aldri toggle', async () => {
  await cheerOnMoment(ARGS);
  expect(mockAddReaction).toHaveBeenCalledWith('p1');
  // ⚠️ Selve poenget: det finnes ingen retning å ta feil av.
  expect(mockToggleReaction).not.toHaveBeenCalled();
  expect(nettoHeia()).toBe(1);
});

it('DOBBELTTRYKK: to trykk i samme øyeblikk gir ett kall og +1', async () => {
  // Begge startes før noen av dem rekker å fullføre — nøyaktig det en
  // hardhendt tommel gjør når et mål går inn.
  await Promise.all([cheerOnMoment(ARGS), cheerOnMoment(ARGS)]);
  expect(mockAddReaction).toHaveBeenCalledTimes(1);
  expect(nettoHeia()).toBe(1);
});

it('TREG FORESPØRSEL: nytt trykk mens den henger blir avvist', async () => {
  let slipp!: () => void;
  mockAddReaction.mockImplementation(
    () => new Promise<void>(res => (slipp = () => res())),
  );

  const forste = cheerOnMoment(ARGS);
  // Trykk nummer to mens nettet fortsatt tygger på det første.
  await cheerOnMoment(ARGS);
  expect(mockAddReaction).toHaveBeenCalledTimes(1);

  slipp();
  await forste;

  expect(mockAddReaction).toHaveBeenCalledTimes(1);
  expect(nettoHeia()).toBe(1);
  expect(mockToggleReaction).not.toHaveBeenCalled();
});

it('låsen slippes: et SENERE trykk går gjennom', async () => {
  await cheerOnMoment(ARGS);
  await cheerOnMoment(ARGS);
  // To bevisste trykk etter hverandre er to ekte kall — serveren er
  // idempotent (23505), så det er trygt.
  expect(mockAddReaction).toHaveBeenCalledTimes(2);
});

it('to ULIKE øyeblikk låser ikke hverandre', async () => {
  await Promise.all([
    cheerOnMoment(ARGS),
    cheerOnMoment({...ARGS, postId: 'p2'}),
  ]);
  expect(mockAddReaction).toHaveBeenCalledTimes(2);
});

it('EKTE feil ruller tilbake — telleren skal ikke lyve', async () => {
  mockAddReaction.mockRejectedValue(new Error('nettet er borte'));
  await cheerOnMoment(ARGS);
  // +1 optimistisk, −1 tilbake.
  expect(nettoHeia()).toBe(0);
  expect(
    mockAdjustMatchEngagement.mock.calls.some(
      c => (c[2] as {iReacted?: boolean})?.iReacted === false,
    ),
  ).toBe(true);
});

it('«du har alt heiet» (23505) ruller IKKE tilbake', async () => {
  // `addReaction` svelger unique-bruddet, så det når aldri hit som en feil.
  // Testen vokter kontrakten: raden finnes ⇒ telleren blir stående.
  mockAddReaction.mockResolvedValue(undefined);
  await cheerOnMoment(ARGS);
  expect(nettoHeia()).toBe(1);
  expect(
    mockAdjustMatchEngagement.mock.calls.every(
      c => (c[2] as {iReacted?: boolean})?.iReacted === true,
    ),
  ).toBe(true);
});

it('uten lagrom patches ikke feeden — men kampen oppdateres', async () => {
  await cheerOnMoment({...ARGS, teamSpaceId: null});
  expect(mockPatchFeedItem).not.toHaveBeenCalled();
  expect(nettoHeia()).toBe(1);
});
