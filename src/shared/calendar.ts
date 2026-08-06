import type {EventType} from './types';

/**
 * Kalenderens datomatte — rene funksjoner, ingen React og ingen Supabase.
 *
 * Dette ER «datobiblioteket» vi valgte å ikke installere (2026-08-06). Alt
 * regnes i LOKAL tid med `Date`-konstruktøren, aldri med millisekunder:
 * `new Date(år, måned, dag + n)` er sommertidssikkert fordi konstruktøren
 * normaliserer selv, mens `+ 86 400 000` bommer med en time to netter i året.
 *
 * Måneds- og ukedagsnavnene er skrevet ut i stedet for hentet fra `Intl`.
 * `toLocaleDateString('nb-NO')` brukes fortsatt ellers i appen, men et
 * rutenett skal ikke kunne bli engelsk fordi en plattform mangler ICU — og
 * hardkodede navn lar testene kjøre uten locale-data.
 */

export const MONTHS = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
] as const;

export const MONTHS_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
] as const;

/** Indeksert med `Date.getDay()` — 0 = søndag. */
export const WEEKDAYS = [
  'søndag',
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
] as const;

export const WEEKDAYS_SHORT = [
  'søn',
  'man',
  'tir',
  'ons',
  'tor',
  'fre',
  'lør',
] as const;

/** Kolonneoverskriftene, mandag først slik norske kalendere leses. */
export const WEEKDAY_INITIALS = [
  'Ma',
  'Ti',
  'On',
  'To',
  'Fr',
  'Lø',
  'Sø',
] as const;

/** Dager laget alt har noe på. Nøkkel fra `dayKey`, verdi = typene den dagen. */
export type BusyDays = Record<string, EventType[]>;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Sommertidssikker: konstruktøren normaliserer overflyt selv. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Alltid den 1. i måneden. Brukes kun til månedsnavigering, og dagen settes
 * bevisst til 1 — «31. januar + 1 måned» ville ellers blitt 3. mars.
 */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Stabil nøkkel for én dag. Ikke ISO — ISO ville vært UTC og bommet på kvelden. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Hele døgn fra `b` til `a`. Regnes mellom to midnatter og avrundes, så
 * sommertidsnetter (23 eller 25 timer) ikke gir 0 eller 2 dager.
 */
export function dayDiff(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000,
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/**
 * HELE månedsrutenettet: dagen i uka for den 1. skjøvet til mandag-først,
 * antall dager i måneden, og `null` i cellene før og etter.
 *
 * `new Date(år, måned + 1, 0)` er dag null i NESTE måned = siste dag i denne.
 * Det er derfor skuddår og 30/31 dager kommer gratis.
 *
 * Lista fylles opp til hele uker, men ikke til seks rader — et rutenett med
 * en tom bunnrad ser ødelagt ut, og utfoldingen måler høyden sin uansett.
 */
export function monthMatrix(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // man = 0 … søn = 6
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** «August 2026» — måneden over rutenettet. Året står alltid; man blar i år her. */
export function monthTitle(date: Date): string {
  return `${capitalize(MONTHS[date.getMonth()])} ${date.getFullYear()}`;
}

/** «lør 8. aug» — hurtigknapper og trange flater. */
export function shortDayLabel(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}. ${
    MONTHS_SHORT[date.getMonth()]
  }`;
}

/**
 * «I dag» / «I morgen» / «I går» / «Lørdag 8. august».
 * Året henges på når datoen bor i et annet år enn i dag — ellers er det støy.
 */
export function longDayLabel(date: Date, today: Date = new Date()): string {
  const diff = dayDiff(date, today);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I morgen';
  if (diff === -1) return 'I går';

  const base = `${capitalize(WEEKDAYS[date.getDay()])} ${date.getDate()}. ${
    MONTHS[date.getMonth()]
  }`;
  return date.getFullYear() === today.getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
}

/**
 * «om 5 uker», «for 3 dager siden» — det som gjør en fjern dato lesbar.
 * Uten den er «Lørdag 17. oktober» bare en streng; med den vet du at det er
 * langt fram, og at du ikke har bommet på måneden.
 */
export function relativeDayLabel(date: Date, today: Date = new Date()): string {
  const diff = dayDiff(date, today);
  if (diff === 0) return 'i dag';
  if (diff === 1) return 'i morgen';
  if (diff === -1) return 'i går';

  const n = Math.abs(diff);
  const ahead = diff > 0;

  let amount: string;
  if (n < 7) {
    amount = `${n} dager`;
  } else if (n < 28) {
    const weeks = Math.round(n / 7);
    amount = `${weeks} ${weeks === 1 ? 'uke' : 'uker'}`;
  } else {
    const months = Math.round(n / 30);
    amount = `${months} ${months === 1 ? 'måned' : 'måneder'}`;
  }

  return ahead ? `om ${amount}` : `for ${amount} siden`;
}

/**
 * «14. august» / «14.–16. august» / «30. august–2. september».
 *
 * Turneringens periode. Måneden gjentas ikke når begge datoene bor i samme
 * måned — «14. august–16. august» leses som to hendelser, ikke én helg.
 * Året henges på når perioden ikke er i inneværende år.
 */
export function dayRangeLabel(
  from: Date,
  to: Date,
  today: Date = new Date(),
): string {
  const sameMonth =
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear();
  const otherYear =
    from.getFullYear() !== today.getFullYear() ||
    to.getFullYear() !== today.getFullYear();
  const year = otherYear ? ` ${to.getFullYear()}` : '';

  if (isSameDay(from, to)) {
    return `${from.getDate()}. ${MONTHS[from.getMonth()]}${year}`;
  }
  if (sameMonth) {
    return `${from.getDate()}.–${to.getDate()}. ${
      MONTHS[to.getMonth()]
    }${year}`;
  }
  return `${from.getDate()}. ${MONTHS[from.getMonth()]}–${to.getDate()}. ${
    MONTHS[to.getMonth()]
  }${year}`;
}

/**
 * Hver dag fra `from` til og med `to`, som midnattsdatoer.
 *
 * `limit` er en vakt mot ødelagte data, ikke en produktgrense: en turnering
 * med sluttdato i 2030 skal ikke tegne ti tusen rader i kalenderen.
 */
export function eachDay(from: Date, to: Date, limit = 31): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(from);
  const last = startOfDay(to);
  while (dayDiff(cursor, last) <= 0 && days.length < limit) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days.length > 0 ? days : [startOfDay(from)];
}

/**
 * Førstkommende lørdag som ikke allerede dekkes av «I dag»/«I morgen» —
 * kampdagen, og den tredje hurtigknappen i datovelgeren.
 */
export function nextSaturday(today: Date): Date {
  let offset = 2;
  while (addDays(today, offset).getDay() !== 6) offset++;
  return addDays(today, offset);
}

/**
 * Setter klokkeslett på en dag uten å røre datoen.
 * Erstatter mønsteret `new Date(day); d.setHours(...)`, som muterer.
 */
export function atTime(day: Date, hours: number, minutes: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}
