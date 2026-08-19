/**
 * «Om Heia»-versjonsraden — den ene delen av versjonslesingen som kan
 * verifiseres uten en telefon.
 *
 * Selve LESINGEN er native (`src/lib/appVersion.ts` spør RNSentry om
 * bundelens Info.plist) og bevises på enhet. Det som testes her er
 * kontrakten som gjorde raden verdt å bygge: at ingen streng noen gang
 * finner på et tall den ikke har fått.
 */
import { formatAppVersion } from '../src/shared/appVersion';

describe('formatAppVersion', () => {
  it('viser markedsføringsversjon og byggnummer slik en tester må oppgi det', () => {
    expect(formatAppVersion({ version: '1.0', build: '3' })).toBe(
      'Versjon 1.0 (3)',
    );
  });

  it('klarer seg uten byggnummer — versjonen alene er fortsatt sann', () => {
    expect(formatAppVersion({ version: '1.0', build: null })).toBe(
      'Versjon 1.0',
    );
    expect(formatAppVersion({ version: '1.0' })).toBe('Versjon 1.0');
    expect(formatAppVersion({ version: '1.0', build: '  ' })).toBe(
      'Versjon 1.0',
    );
  });

  // KJERNEN: hardkodet «v0.1.0» sto og løy i TestFlight. Faller lesingen
  // bort, skal raden forsvinne — aldri erstattes av en gjetning.
  it('gir null når versjonen mangler, i stedet for å gjette', () => {
    expect(formatAppVersion(null)).toBeNull();
    expect(formatAppVersion({})).toBeNull();
    expect(formatAppVersion({ version: null, build: '3' })).toBeNull();
    expect(formatAppVersion({ version: '', build: '3' })).toBeNull();
    expect(formatAppVersion({ version: '   ', build: '3' })).toBeNull();
  });

  it('trimmer verdiene fra bundelen', () => {
    expect(formatAppVersion({ version: ' 1.0 ', build: ' 3 ' })).toBe(
      'Versjon 1.0 (3)',
    );
  });
});
