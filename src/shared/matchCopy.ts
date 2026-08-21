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

// ---------------------------------------------------------------------------
// ENGASJEMENTET SOM TALE (skive 4)
//
// «En teller alene («34») er ikke en label» — tilgjengelighetskravet, ordrett.
// HEIA og kommentarer er HANDLINGER, og de ligger derfor utenfor øyeblikkets
// samlede label: de har egne setninger, egen state og egen trykkflate.
//
// Setningen sier HVA trykket gjør, HVILKET øyeblikk det gjelder, og HVOR
// mange som har gjort det før deg. Om DU har heiet sier `accessibilityState`
// — ikke teksten, ellers leses tilstanden opp to ganger.
// ---------------------------------------------------------------------------

/** «målet» / «målet til motstanderen» / «oppdateringen» / «bildet». */
function momentPhrase(subject: MatchEventA11yInput | 'photo'): string {
  if (subject === 'photo') {
    return 'bildet';
  }
  switch (subject.type) {
    case 'mål':
      return subject.teamSide === 'home' ? 'målet' : 'målet til motstanderen';
    case 'melding':
      return 'oppdateringen';
    default:
      return 'øyeblikket';
  }
}

function countPhrase(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** «Heia på målet på 34 minutter. 12 heier.» */
export function matchHeiaA11yLabel(opts: {
  subject: MatchEventA11yInput | 'photo';
  minute?: number;
  count: number;
}): string {
  const where = `Heia på ${momentPhrase(opts.subject)}${
    opts.minute !== undefined ? ` på ${minuteSpoken(opts.minute)}` : ''
  }`;
  return sentence([where, countPhrase(opts.count, 'heia', 'heier')]);
}

/** «Åpne samtalen om målet på 34 minutter. 2 kommentarer.» */
export function matchCommentA11yLabel(opts: {
  subject: MatchEventA11yInput | 'photo';
  minute?: number;
  count: number;
}): string {
  const where = `Åpne samtalen om ${momentPhrase(opts.subject)}${
    opts.minute !== undefined ? ` på ${minuteSpoken(opts.minute)}` : ''
  }`;
  return sentence([where, countPhrase(opts.count, 'kommentar', 'kommentarer')]);
}

// ---------------------------------------------------------------------------
// KAMPENS PULS (skive 5)
//
// ⚠️ ÉN KILDE TIL DET SOM STÅR TIL HØYRE I PULSEN — synlig OG lest. Samme
// lærdom som arenaens klokkeslott: deles de i to, drifter de fra hverandre,
// og det var nettopp prototypens ene ekte bug (hodet på 40′, pulsen på 37′).
//
// ⚠️ ALDRI ET NAKENT MINUTT (frosset retning): «NÅ 40′», ikke «40′».
//
// ⚠️ INGEN MINUTT I PAUSE. Arenaen 90 px lenger opp skjuler tallet med
// vilje — klokka i appen teller fortsatt under pause til kampuret blir
// serverautoritativt (P2, skive 7). Et tall her ville motsagt hodet rett
// over seg. «PAUSE» er sant uansett.
// ---------------------------------------------------------------------------

/** Pulsens høyre side: det synlige tallet og setningen som leses. */
export function matchPulseClock(opts: {
  phase: 'live' | 'paused' | 'finished';
  minute?: number;
}): {text: string; a11y: string} {
  if (opts.phase === 'finished') {
    return {text: 'SLUTT', a11y: 'Kampen er slutt.'};
  }
  if (opts.phase === 'paused') {
    return {text: 'PAUSE', a11y: 'Pause i kampen.'};
  }
  const minute = opts.minute ?? 0;
  return {
    text: `NÅ ${minute}′`,
    a11y: `${minuteSpoken(minute)} spilt.`,
  };
}

// ---------------------------------------------------------------------------
// PULSENS ØYEBLIKK SOM TEKST
//
// ⚠️ ÉN KILDE TIL BÅDE DET SYNLIGE OG DET LESTE. Valgpanelet viser
// «20′ · Mål — Jarle · 3–1»; VoiceOver leser den samme opplysningen som en
// setning. To formuleringer ville drevet fra hverandre.
//
// ⚠️ STILLINGEN ER DEN SAMME SOM I KAMPFORLØPET. Begge regnes av
// `buildPulseMoments`/`MatchTimeline` med samme regel, så det samme målet
// aldri kan stå med to ulike stillinger på én skjerm.
// ---------------------------------------------------------------------------

/** Det pulsteksten trenger å vite om et øyeblikk. */
export interface PulseMomentText {
  minute: number;
  kind: 'goalUs' | 'goalThem' | 'update' | 'photo';
  actor?: string;
  score?: string;
  heia: number;
  comments: number;
}

function kindWord(kind: PulseMomentText['kind']): string {
  switch (kind) {
    case 'goalUs':
      return 'Mål';
    case 'goalThem':
      return 'Mål imot';
    case 'update':
      return 'Oppdatering';
    case 'photo':
      return 'Bilde';
  }
}

/** «20′ · Mål — Jarle · 3–1» */
export function matchPulseMomentText(m: PulseMomentText): string {
  const deler = [`${m.minute}′`, kindWord(m.kind)];
  if (m.actor) {
    deler[1] = `${deler[1]} — ${m.actor}`;
  }
  if (m.score) {
    deler.push(m.score);
  }
  return deler.join(' · ');
}

/** «2 heier · 1 kommentar» — eller en ærlig tomhet. */
export function matchPulseResponseText(m: {
  heia: number;
  comments: number;
}): string {
  if (m.heia === 0 && m.comments === 0) {
    return 'Ingen heier eller kommentarer ennå';
  }
  return [
    countPhrase(m.heia, 'heia', 'heier'),
    countPhrase(m.comments, 'kommentar', 'kommentarer'),
  ].join(' · ');
}

/** «MEST LIV · 34′–41′» / «ROLIG · 18′–31′» */
export function matchPulsePhaseText(p: {
  kind: 'busiest' | 'quiet';
  from: number;
  to: number;
}): string {
  const navn = p.kind === 'busiest' ? 'MEST LIV' : 'ROLIG';
  return `${navn} · ${p.from}′–${p.to}′`;
}

/**
 * PULSENS FØRSTE LABEL — hele kampen i én setning.
 *
 * ⚠️ PULSEN ER ÉTT JUSTERBART ELEMENT, IKKE ET DUSIN STOPP (Brage). De
 * visuelle markørene skal ALDRI bli parallelle VoiceOver-stopp rett før den
 * samme tidslinjen. Denne setningen er inngangen; `accessibilityValue`
 * bærer det valgte øyeblikket.
 */
export function matchPulseSummaryA11y(opts: {
  clock: string;
  count: number;
  phases: {kind: 'busiest' | 'quiet'; from: number; to: number}[];
}): string {
  const deler: string[] = ['Kampens puls', opts.clock];
  deler.push(
    opts.count === 0
      ? 'Ingen rapporterte øyeblikk ennå'
      : countPhrase(opts.count, 'øyeblikk', 'øyeblikk'),
  );
  for (const p of opts.phases) {
    deler.push(
      p.kind === 'busiest'
        ? `Mest liv fra ${p.from} til ${minuteSpoken(p.to)}`
        : `Roligst fra ${p.from} til ${minuteSpoken(p.to)}`,
    );
  }
  if (opts.count > 0) {
    deler.push('Sveip opp eller ned for å bla mellom øyeblikkene');
  }
  return sentence(deler);
}

/** `accessibilityValue` — det valgte øyeblikket, lest som en setning. */
export function matchPulseValueA11y(
  m: PulseMomentText,
  position: {index: number; total: number},
): string {
  const hva =
    m.kind === 'goalUs'
      ? `Mål for oss${m.actor ? `, ${m.actor}` : ''}`
      : m.kind === 'goalThem'
      ? 'Mål imot'
      : m.kind === 'update'
      ? `Oppdatering${m.actor ? ` fra ${m.actor}` : ''}`
      : `Bilde${m.actor ? ` av ${m.actor}` : ''}`;
  return sentence([
    `${position.index} av ${position.total}`,
    minuteSpoken(m.minute),
    hva,
    m.score ? `Stillingen ${m.score.replace('–', ' ')}` : undefined,
    m.heia > 0 || m.comments > 0
      ? [
          countPhrase(m.heia, 'heia', 'heier'),
          countPhrase(m.comments, 'kommentar', 'kommentarer'),
        ].join(', ')
      : 'Ingen heier eller kommentarer',
  ]);
}
