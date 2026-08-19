/**
 * Norske auth-feil.
 *
 * Hvorfor dette testes: AuthScreen gjorde `setError(e.message)` og sendte
 * dermed ENGELSK Supabase-tekst rett ut i en norsk flyt. Den vanen ble
 * ufarlig så lenge feilene i praksis var «feil e-post eller passord» — men
 * passordreglene endrer det, og `current_password_required` er nå en feil en
 * helt vanlig forelder vil treffe.
 */
import {authErrorMessage} from '../src/shared/authErrors';

describe('authErrorMessage', () => {
  it('oversetter kravet om nåværende passord (server-håndhevet)', () => {
    expect(authErrorMessage({code: 'current_password_required'})).toBe(
      'Skriv inn det nåværende passordet ditt.',
    );
  });

  // Eksakt kode observert i verify-password-change.mjs mot prod.
  it('oversetter feil nåværende passord på KODE, ikke på engelsk tekst', () => {
    expect(authErrorMessage({code: 'current_password_invalid'})).toBe(
      'Feil nåværende passord. Prøv igjen.',
    );
  });

  it('tar koden FØR teksten når begge finnes', () => {
    expect(
      authErrorMessage({
        code: 'weak_password',
        message: 'Password is known to be weak and easy to guess',
      }),
    ).toBe(
      'Passordet er for svakt eller for vanlig — velg et annet med minst 6 tegn.',
    );
  });

  // Eldre GoTrue-svar bærer ikke alltid en kode — da må teksten redde oss.
  it('faller tilbake på teksten når koden mangler', () => {
    expect(
      authErrorMessage({
        message: 'Password is known to be weak and easy to guess, please …',
      }),
    ).toBe('Dette passordet er funnet i kjente datalekkasjer — velg et annet.');
    expect(authErrorMessage({message: 'Invalid login credentials'})).toBe(
      'Feil e-post eller passord.',
    );
    expect(
      authErrorMessage({message: 'For security purposes, you can only …'}),
    ).toBe('Vent litt før du prøver igjen.');
  });

  // KJERNEN: ingen engelsk skal kunne lekke ut som «feilmelding».
  it('gir norsk fallback for ukjente feil — aldri rå engelsk', () => {
    const out = authErrorMessage({message: 'Some unmapped English failure'});
    expect(out).toBe('Noe gikk galt. Prøv igjen om litt.');
    expect(authErrorMessage(null)).toBe('Noe gikk galt. Prøv igjen om litt.');
    expect(authErrorMessage(undefined)).toBe(
      'Noe gikk galt. Prøv igjen om litt.',
    );
    expect(authErrorMessage({})).toBe('Noe gikk galt. Prøv igjen om litt.');
  });

  it('lar kalleren sette en mer presis fallback', () => {
    expect(authErrorMessage({message: 'nope'}, 'Kunne ikke sende kode.')).toBe(
      'Kunne ikke sende kode.',
    );
  });
});
