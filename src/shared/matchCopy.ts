import type {NotificationMatch} from '../lib/api/notifications';
import type {MatchEventType} from './types';

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

// ---------------------------------------------------------------------------
// KAMPENS SPRÅK FOR SKJERMLESER (skive 2 — obligatorisk akseptansekriterium)
//
// «En kamptidslinje VoiceOver ikke kan lese, er en kamp en blind forelder
// ikke kan følge.»
//
// REGELEN: ÉN HENDELSE = ÉTT STOPP. Raden leser hele øyeblikket i rekkefølgen
// MINUTT → HVA → HVEM → DETALJ, ikke fire stopp (node, minutt, overskrift,
// tekst). Derfor bor setningen her, som en ren funksjon — ikke som strenger
// spredt utover JSX-en, der ingen kan teste at rekkefølgen holder.
//
// ⚠️ Denne teksten er IKKE den samme som radens synlige tekst, og skal ikke
// være det. Skjermen viser «MÅL!» stort med stillingen ved siden av og noden
// som bærer betydningen; det leses ikke opp av seg selv. Labelen sier det
// noden viser.
// ---------------------------------------------------------------------------

/** «34 minutter» / «1 minutt» — kampminuttet som tale, ikke som symbol. */
function minuteSpoken(minute: number): string {
  return minute === 1 ? '1 minutt' : `${minute} minutter`;
}

/** Fornavnet alene — det er slik reporteren omtales i raden. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Setter sammen ledd til én setning uten doble punktum eller tomme ledd. */
function sentence(parts: (string | undefined)[]): string {
  return parts
    .map(p => p?.trim())
    .filter((p): p is string => !!p)
    .map(p => (/[.!?:]$/.test(p) ? p : `${p}.`))
    .join(' ');
}

export interface MatchEventA11yInput {
  type: MatchEventType;
  minute: number;
  description?: string;
  player?: string;
  teamSide?: 'home' | 'away';
}

/**
 * Hele øyeblikket som én setning.
 *
 *   «34 minutter. Mål for oss, 2–1. Erlend Hagen.»
 *   «31 minutter. Jarle oppdaterer: Vi presser høyt nå.»
 *   «45 minutter. Slutt, 3–2.»
 *
 * `score` er stillingen ETTER øyeblikket (samme verdi raden viser), og
 * `authorName` er reporteren bak en oppdatering.
 */
export function matchEventA11yLabel(
  event: MatchEventA11yInput,
  opts: {score?: string; authorName?: string} = {},
): string {
  const when = minuteSpoken(event.minute);
  const {score, authorName} = opts;

  switch (event.type) {
    case 'mål': {
      // ⚠️ For mål er `description` SYNTETISK («Mål for oss» / «Mål for X»),
      // og reporterens frie tekst ligger i `player` — se describeMatchEvent.
      // Skjermen viser bare `player`; labelen må derimot si HVA som skjedde,
      // for noden er det eneste som sier det, og en node kan ikke leses.
      const what =
        event.teamSide === 'home'
          ? 'Mål for oss'
          : event.description || 'Mål for motstanderen';
      return sentence([
        score ? `${when}. ${what}, ${score}` : `${when}. ${what}`,
        event.player,
      ]);
    }
    case 'melding':
      return authorName
        ? `${when}. ${firstName(authorName)} oppdaterer: ${
            event.description ?? ''
          }`.trim()
        : sentence([`${when}. Oppdatering`, event.description]);
    case 'avspark':
      return `${when}. Avspark.`;
    case 'andre_omgang':
      return `${when}. Andre omgang.`;
    case 'pause':
      return score ? `${when}. Pause, ${score}.` : `${when}. Pause.`;
    case 'slutt':
      return score ? `${when}. Slutt, ${score}.` : `${when}. Slutt.`;
    case 'bytte':
      return sentence([`${when}. Bytte`, event.description]);
    case 'kort':
      return sentence([`${when}. Kort`, event.description]);
  }
}

/** Et kampbilde som ett stopp. Minuttet mangler på bilder uten kjent start. */
export function matchPhotoA11yLabel(opts: {
  minute?: number;
  authorName?: string;
  caption?: string;
}): string {
  const when =
    opts.minute !== undefined ? minuteSpoken(opts.minute) : undefined;
  return sentence([
    when,
    opts.authorName ? `Bilde fra ${opts.authorName}` : 'Kampbilde',
    opts.caption,
  ]);
}

/**
 * Arenaens stilling som én setning. Tallet står i mint uten ord rundt seg på
 * skjermen — «2–1» alene ville blitt lest som «to bindestrek en».
 */
export function matchScoreA11yLabel(opts: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}): string {
  return `${opts.homeTeam} ${opts.homeScore}, ${opts.awayTeam} ${opts.awayScore}.`;
}
