/**
 * @format
 *
 * KAMPURET (skive 7, P2) — faktisk spilt tid.
 *
 * ⚠️ Fila vokter ÉN egenskap framfor alle andre: at klokka STÅR I PAUSE.
 * Det var feilen i alle tre kopiene appen hadde før 00073, og den er lumsk
 * fordi den er usynlig helt til noen faktisk tar pause — og da er kampen i
 * gang og ingen har tid til å oppdage det.
 */
import {
  matchClockRunning,
  matchMinute,
  matchPlayedSeconds,
} from '../src/shared/matchClock';

const NOW = new Date('2026-08-21T18:30:00Z').getTime();
const sekunderSiden = (s: number) => new Date(NOW - s * 1000);

describe('faktisk spilt tid', () => {
  it('teller mens uret går', () => {
    // 2 minutter i banken + 30 sekunder siden uret startet.
    const clock = {playedSeconds: 120, clockStartedAt: sekunderSiden(30)};
    expect(matchPlayedSeconds(clock, NOW)).toBe(150);
    expect(matchMinute(clock, NOW)).toBe(2);
  });

  it('⚠️ STÅR BOM STILLE I PAUSE — uansett hvor lenge pausen varer', () => {
    const clock = {playedSeconds: 1800, clockStartedAt: undefined};
    expect(matchMinute(clock, NOW)).toBe(30);
    // Et kvarter senere: fortsatt 30. Dette er hele P2.
    expect(matchMinute(clock, NOW + 15 * 60_000)).toBe(30);
  });

  it('andre omgang fortsetter fra minuttet første sluttet', () => {
    // Uret sto på 30′, pausen varte et kvarter, og andre omgang har spilt 1′.
    const clock = {playedSeconds: 1800, clockStartedAt: sekunderSiden(60)};
    expect(matchMinute(clock, NOW)).toBe(31);
  });

  it('⚠️ GULV, IKKE AVRUNDING — sekund 119 er minutt 1', () => {
    // Runder appen mens serveren gulver, viser kampforløpet og klokka ulikt
    // minutt for det SAMME øyeblikket i halvparten av tilfellene.
    expect(matchMinute({playedSeconds: 119}, NOW)).toBe(1);
    expect(matchMinute({playedSeconds: 120}, NOW)).toBe(2);
    expect(matchMinute({playedSeconds: 0}, NOW)).toBe(0);
  });

  it('går aldri i minus, heller ikke om klokkene spriker', () => {
    // Telefonens klokke kan ligge foran serverens. Et negativt kampminutt
    // ville vært synlig tull; 0 er bare kjedelig.
    const framtidig = {playedSeconds: 0, clockStartedAt: new Date(NOW + 5000)};
    expect(matchPlayedSeconds(framtidig, NOW)).toBe(0);
    expect(matchMinute(framtidig, NOW)).toBe(0);
  });
});

describe('reserven mot en server uten 00073', () => {
  it('faller tilbake på den gamle klokka i stedet for å vise null', () => {
    // Mangler `playedSeconds` finnes tallene ikke i basen ennå. En feil
    // klokke er dårlig; en klokke som står på 0 mens kampen spilles er verre.
    const gammel = {startedAt: sekunderSiden(90)};
    expect(matchPlayedSeconds(gammel, NOW)).toBe(90);
    expect(matchMinute(gammel, NOW)).toBe(1);
  });

  it('gir 0 når kampen ikke er startet i det hele tatt', () => {
    expect(matchPlayedSeconds({}, NOW)).toBe(0);
    expect(matchMinute({}, NOW)).toBe(0);
  });

  it('⚠️ reserven teller gjennom pausen — det ER den gamle feilen', () => {
    // Bevisst dokumentert: reserven gjenskaper dagens oppførsel, den retter
    // den ikke. Retten kommer når 00073 står i prod.
    const gammel = {startedAt: sekunderSiden(3600)};
    expect(matchMinute(gammel, NOW)).toBe(60);
    expect(matchMinute(gammel, NOW + 60_000)).toBe(61);
  });
});

describe('går uret?', () => {
  it('spør uret, ikke statusen', () => {
    expect(
      matchClockRunning({playedSeconds: 60, clockStartedAt: new Date()}),
    ).toBe(true);
    expect(matchClockRunning({playedSeconds: 60})).toBe(false);
  });

  it('en server uten 00073 har alltid et ur som går', () => {
    expect(matchClockRunning({startedAt: new Date()})).toBe(true);
    expect(matchClockRunning({})).toBe(false);
  });
});

describe('P2: alle flater arver SAMME tall i samme tick', () => {
  it('gir identisk svar for samme ur og samme tidspunkt', () => {
    // Kampskjermen, banneret og innboksen kaller den samme funksjonen med
    // hvert sitt `nowMs`. Så lenge tallet er en ren funksjon av (ur, tid),
    // kan de ikke sprike når de deler tick — og det var prototypens ene ekte
    // bug (hodet 40′, pulsen 37′).
    const clock = {playedSeconds: 1234, clockStartedAt: sekunderSiden(45)};
    const skjerm = matchMinute(clock, NOW);
    const banner = matchMinute(clock, NOW);
    const innboks = matchMinute(clock, NOW);
    expect([banner, innboks]).toEqual([skjerm, skjerm]);
  });
});
