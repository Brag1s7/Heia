/**
 * Auth-feil på norsk.
 *
 * ⚠️ Supabase-feilene er ENGELSKE, og AuthScreen har til nå gjort
 * `setError(e.message)` — altså sendt dem rått ut i en norsk flyt. Det gikk
 * så lenge feilene i praksis var «feil e-post eller passord», men
 * passordreglene endrer det: slår man på HaveIBeenPwned-sjekken i dashboardet
 * («Prevent use of leaked passwords»), får en forelder midt i registreringen
 * «Password is known to be weak and easy to guess, please choose a different
 * one.» Denne modulen er forutsetningen for at den bryteren kan skrus på.
 *
 * Vi matcher på `code` FØRST (stabil, maskinlesbar) og faller tilbake på
 * teksten — eldre GoTrue-svar bærer ikke alltid en kode.
 *
 * Beslektet: `shared/errorMessage.ts` gjør samme jobb for PostgrestError, der
 * problemet var motsatt (presise norske DB-meldinger som forsvant i en
 * generisk fallback).
 */

/** Feilkoder fra GoTrue vi har en egen, handlingsrettet norsk tekst for. */
const BY_CODE: Record<string, string> = {
  // Passordendring med server-håndhevet current_password (00-config:
  // «Require current password when updating»).
  current_password_required: 'Skriv inn det nåværende passordet ditt.',
  // Bekreftet av scripts/verify-password-change.mjs mot prod 2026-08-19:
  // GoTrue svarer 400 `current_password_invalid` når det oppgitte
  // nåværende passordet er feil. Sto tidligere kun dekket av
  // tekst-fallbacken (/current password/i) — koden er stabil, teksten ikke.
  current_password_invalid: 'Feil nåværende passord. Prøv igjen.',
  invalid_credentials: 'Feil e-post eller passord.',
  // Under minstelengden, eller avvist av HaveIBeenPwned-sjekken.
  weak_password:
    'Passordet er for svakt eller for vanlig — velg et annet med minst 6 tegn.',
  same_password: 'Det nye passordet er likt det gamle.',
  reauthentication_needed:
    'Av sikkerhetsgrunner må du logge inn på nytt før du bytter passord.',
  over_request_rate_limit: 'Vent litt før du prøver igjen.',
  email_not_confirmed: 'Bekreft e-postadressen din først — sjekk innboksen.',
  user_not_found: 'Fant ingen konto med denne e-posten.',
  otp_expired: 'Koden er utløpt — be om en ny.',
};

/** Tekstbiter i engelske GoTrue-meldinger som ikke alltid bærer en kode. */
const BY_TEXT: ReadonlyArray<[RegExp, string]> = [
  [/current password/i, 'Feil nåværende passord. Prøv igjen.'],
  [/invalid login credentials/i, 'Feil e-post eller passord.'],
  [
    /known to be weak|easy to guess|pwned/i,
    'Dette passordet er funnet i kjente datalekkasjer — velg et annet.',
  ],
  [/password should be at least/i, 'Passordet må ha minst 6 tegn.'],
  [/should be different from the old/i, 'Det nye passordet er likt det gamle.'],
  [
    /for security purposes|rate limit|too many requests/i,
    'Vent litt før du prøver igjen.',
  ],
  [
    /email not confirmed/i,
    'Bekreft e-postadressen din først — sjekk innboksen.',
  ],
  [/token has expired|expired/i, 'Koden er utløpt — be om en ny.'],
  [/network|fetch failed/i, 'Ingen nettforbindelse. Prøv igjen.'],
];

export function authErrorMessage(
  e: unknown,
  fallback = 'Noe gikk galt. Prøv igjen om litt.',
): string {
  const err = e as { code?: unknown; message?: unknown } | null | undefined;

  const code = typeof err?.code === 'string' ? err.code : undefined;
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = typeof err?.message === 'string' ? err.message : '';
  for (const [pattern, text] of BY_TEXT) {
    if (pattern.test(message)) return text;
  }

  return fallback;
}
