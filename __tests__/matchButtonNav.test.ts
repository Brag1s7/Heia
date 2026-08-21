/**
 * KILDEBEVARENDE TABMODELL (Brage 2026-08-21, LÅST).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ REGELEN: DEN VALGTE FANEN SKAL ALLTID GJENSPEILE HVOR BRUKEREN KOM FRA.
 *
 *   · Kamp-fanen  → `KampStack`. Rot: Sesongen. Ved livekamp åpnes kampen,
 *                   og «tilbake» fører til Sesongen.
 *   · Kalender    → kampen blir i `KalenderStack`. Kalender forblir valgt.
 *   · Varsler     → kampen blir i `InboxStack`. Varsler forblir valgt.
 *   · Hjem        → kampen blir i `HomeStack`. Hjem forblir valgt.
 *   · Push / deep link, UTEN intern kilde → `KampStack`, tilbake til Sesongen.
 *
 * Det er FLERE NAVIGASJONSRUTER til de samme skjermkomponentene — ikke
 * duplisert produktlogikk. Og ingen `returnTo`, ingen tilbakeknapp som
 * teleporterer mellom faner, ingen falsk Kamp-markering.
 */

const mockNavigate = jest.fn();
let mockReady = true;

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => mockReady,
    navigate: (...a: unknown[]) => mockNavigate(...a),
  }),
}));
jest.mock('../src/navigation/profilEntry', () => ({profilEntry: () => null}));

import {openEvent} from '../src/navigation/deepLink';

beforeEach(() => {
  jest.clearAllMocks();
  mockReady = true;
});

/**
 * ⚠️ ET PUSH-VARSEL HAR INGEN INTERN KILDE. Brukeren kom ikke fra Hjem —
 * hun kom fra utsiden. Da er `KampStack` det ærlige stedet: Kamp-fanen blir
 * valgt fordi hun faktisk ER i kampen, og «tilbake» fører til Sesongen.
 */
it('push og deep link lander i Kamp-fanen', () => {
  openEvent('e1');
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('Kamp', {
    screen: 'EventDetail',
    params: {eventId: 'e1'},
    // `initial: false` er det som gir en ekte tilbake-knapp: uten den blir
    // EventDetail stackens rot, og «tilbake» til Sesongen finnes ikke.
    initial: false,
  });
});

it('den lander ikke i Hjem — Hjem var ikke kilden', () => {
  openEvent('e1');
  const [mål] = mockNavigate.mock.calls[0];
  expect(mål).not.toBe('HjemStack');
});

it('gjør ingenting før navigatoren er montert — ingen krasj ved kaldstart', () => {
  mockReady = false;
  openEvent('e1');
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('tom eventId er en no-op, ikke en navigasjon til ingenting', () => {
  openEvent('');
  expect(mockNavigate).not.toHaveBeenCalled();
});
