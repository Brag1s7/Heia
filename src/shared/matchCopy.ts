import type {NotificationMatch} from '../lib/api/notifications';

// ---------------------------------------------------------------------------
// Kampens SPRÅK, ett sted.
//
// Basen bygger kamptekster med glyfer og gjentatte lagnavn:
//   «⚽ MÅL! Stange G10 1–0 Oslo»
//   «⚽ Kampen er i gang: Stange G10 mot Oslo»
//   «▶️ Andre omgang i gang. Stange G10 1–0 Oslo»
//   «🏁 Slutt! Stange G10 2–1 Oslo»
//
// Strengene deles med FEEDEN og PUSH-varselet, så de ligger urørt i
// `report_match_event`/`start_match` (00020/00021). Varsler komponerer i
// stedet sin egen tekst fra strukturerte felt (00051) — kortet viser alt
// stillingen stort og har sitt eget ikon, så glyfen og gjentakelsen er
// dobbelt opp.
//
// Endrer du ordlyden her, endres den samme sted for kortet og raden.
// ---------------------------------------------------------------------------

/** Fjerner ledende glyfer der vi likevel må falle tilbake på basens tekst. */
export function stripLeadingGlyph(text: string): string {
  return text.replace(/^(?:[⚽⏸🏁🟨↔▶]️?\s*)+/u, '');
}

/**
 * Målets egen setning, utledet av stillingen FØR og ETTER målet.
 *
 * Stillingen etter alene holder ikke: ved 2–1 → 3–1 er laget i ledelse både
 * før og etter, og «tar ledelsen» blir feil — ledelsen ble ØKT, ikke tatt.
 * Stillingen før finnes ikke i varselet, men den er utledbar: målscoreren
 * hadde nøyaktig ett mål mindre.
 */
function goalLine(match: NotificationMatch, teamName: string): string {
  const opponent = match.opponent ?? 'motstanderen';

  // Uten side vet vi ikke hvem som scoret — da navngir vi ingen. Å tilskrive
  // feil lag er verre enn å si det nøkternt (skal ikke skje etter 00020).
  if (match.teamSide === null) {
    return 'Nytt mål';
  }

  const us = match.teamSide === 'home';
  const who = us ? teamName : opponent;

  // «Vår» margin etter målet, og den samme marginen før målet.
  const after = match.homeScore - match.awayScore;
  const before = us ? after - 1 : after + 1;

  // Sett fra målscorerens side.
  const leadAfter = us ? after : -after;
  const leadBefore = us ? before : -before;

  if (leadAfter === 0) {
    return `${who} utligner`;
  }
  if (leadAfter > 0) {
    return leadBefore > 0 ? `${who} øker ledelsen` : `${who} tar ledelsen`;
  }
  return `${who} reduserer`;
}

/** Én kamphendelse som én menneskelig setning. */
export function matchEventLine(
  match: NotificationMatch | undefined,
  body: string,
  teamName: string,
): string {
  const fallback = stripLeadingGlyph(body);
  if (!match) {
    return fallback;
  }
  switch (match.eventType) {
    case 'avspark':
      return 'Kampen er i gang';
    case 'pause':
      return 'Pause';
    case 'andre_omgang':
      return 'Andre omgang i gang';
    case 'slutt':
      return 'Full tid';
    case 'bytte':
      return fallback || 'Bytte';
    case 'kort':
      return fallback || 'Kort';
    case 'melding':
      return fallback;
    case 'mål':
      return goalLine(match, teamName);
    default:
      return fallback;
  }
}
