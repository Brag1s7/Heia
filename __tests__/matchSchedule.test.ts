import {buildMatchSchedule, isUnderway} from '../src/shared/matchSchedule';
import type {HeiaEvent, MatchStatus} from '../src/shared/types';

/**
 * KAMPPROGRAMMETS PRIORITERING (skive 10.1).
 *
 * ⚠️ Dette er en PRODUKTREGEL, ikke en sortering. Brage etter telefontesten
 * 2026-08-21: fra skive 10 fører kampknappen til Sesongen, «da forventer man
 * også å finne dagens kamp her … med dagens kamp tydelig prioritert».
 *
 * Tre nivåer som lett kan bli feil hver for seg — derfor testes de hver for
 * seg, uten å montere en skjerm.
 */

const NÅ = new Date(2026, 7, 21, 18, 0);

function kamp(id: string, start: Date, matchStatus?: MatchStatus): HeiaEvent {
  return {
    id,
    teamSpaceId: 't1',
    type: 'kamp',
    title: `Kamp ${id}`,
    startTime: start,
    rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'venter'},
    matchStatus,
  } as unknown as HeiaEvent;
}

const iDag = (t: number) => new Date(2026, 7, 21, t, 0);
const iGår = (t: number) => new Date(2026, 7, 20, t, 0);
const iMorgen = (t: number) => new Date(2026, 7, 22, t, 0);

it('en PÅGÅENDE kamp slår alt — den er grunnen til at man åpnet siden', () => {
  const s = buildMatchSchedule(
    [kamp('senere', iMorgen(12)), kamp('live', iDag(17), 'live')],
    NÅ,
  );
  expect(s.live.map(m => m.id)).toEqual(['live']);
  expect(s.upcoming.map(m => m.id)).toEqual(['senere']);
});

it('PAUSE er også pågående — kampen er ikke over, klokka står stille', () => {
  const s = buildMatchSchedule([kamp('p', iDag(17), 'halfTime')], NÅ);
  expect(s.live.map(m => m.id)).toEqual(['p']);
  expect(isUnderway(kamp('x', iDag(17), 'halfTime'))).toBe(true);
});

/**
 * ⚠️ En kamp som PÅGÅR kan ha startet i går — sen kveldskamp, eller en som
 * ble stående. Med et rent «fra i dag»-filter ville nettopp den kampen, den
 * ene man virkelig leter etter, falt ut av programmet.
 */
it('en pågående kamp som startet I GÅR ligger fortsatt øverst', () => {
  const s = buildMatchSchedule([kamp('igår', iGår(21), 'live')], NÅ);
  expect(s.live.map(m => m.id)).toEqual(['igår']);
});

it('en kamp i går som IKKE er i gang faller ut — den er ikke «kommende»', () => {
  const s = buildMatchSchedule([kamp('glemt', iGår(12), 'upcoming')], NÅ);
  expect(s.live).toHaveLength(0);
  expect(s.today).toHaveLength(0);
  expect(s.upcoming).toHaveLength(0);
});

it('dagens kamper skilles fra senere, og begge går tidligst først', () => {
  const s = buildMatchSchedule(
    [
      kamp('sent-i-dag', iDag(20)),
      kamp('om-tre-dager', new Date(2026, 7, 24, 12, 0)),
      kamp('tidlig-i-dag', iDag(9)),
      kamp('i-morgen', iMorgen(11)),
    ],
    NÅ,
  );
  expect(s.today.map(m => m.id)).toEqual(['tidlig-i-dag', 'sent-i-dag']);
  expect(s.upcoming.map(m => m.id)).toEqual(['i-morgen', 'om-tre-dager']);
});

it('en kamp tidligere I DAG som ikke er startet blir stående under «i dag»', () => {
  // Den er ikke glemt før dagen er omme — treneren kan fortsatt starte den.
  const s = buildMatchSchedule([kamp('kl-9', iDag(9))], NÅ);
  expect(s.today.map(m => m.id)).toEqual(['kl-9']);
});

it('flere pågående: nyeste avspark først — samme regel som getLiveMatch', () => {
  const s = buildMatchSchedule(
    [kamp('først', iDag(15), 'live'), kamp('nyest', iDag(17), 'live')],
    NÅ,
  );
  expect(s.live.map(m => m.id)).toEqual(['nyest', 'først']);
});

it('tomt program gir tre tomme lister, ikke undefined', () => {
  const s = buildMatchSchedule([], NÅ);
  expect(s).toEqual({live: [], today: [], upcoming: []});
});
