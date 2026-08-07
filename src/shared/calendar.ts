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

/**
 * Mandagen i uka `date` hører til. Norske kalendere begynner på mandag, og
 * `getDay()` gjør ikke det (0 = søndag) — søndag skal seks dager tilbake,
 * ikke null.
 */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

/** Samme ukedag `n` uker unna. Går via `addDays`, så sommertid er trygt. */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** Mandag til søndag i uka `date` hører til — ukestripas sju celler. */
export function weekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({length: 7}, (_, i) => addDays(monday, i));
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

/** Én celle i månedsrutenettet. */
export interface GridDay {
  date: Date;
  /** Hører dagen til måneden som vises, eller er den en nabo? */
  inMonth: boolean;
}

/** Rader i et månedsrutenett. ALLTID seks — se `monthGrid`. */
export const GRID_WEEKS = 6;

/**
 * HELE månedsrutenettet: alltid 42 celler = seks uker à sju dager, mandag
 * først, uten hull.
 *
 * ⚠️ Seks rader ALLTID, også når måneden bare trenger fire eller fem
 * (Brage 2026-08-07). Et rutenett som bytter mellom fem og seks rader endrer
 * høyde når man blar — og da hopper alt under det, både i skjemaet og i
 * månedsarket. Cellene før og etter måneden fylles med nabomånedens dager i
 * stedet for å stå tomme: samme plass, dempet uttrykk, og februar oppfører
 * seg som alle andre måneder.
 *
 * `new Date(år, måned, 1 - lead)` med negativt dagtall normaliseres av
 * konstruktøren inn i forrige måned — samme regel som resten av denne fila.
 */
export function monthGrid(year: number, month: number): GridDay[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // man = 0 … søn = 6
  const first = new Date(year, month, 1 - lead);

  return Array.from({length: GRID_WEEKS * 7}, (_, i) => {
    const date = addDays(first, i);
    return {
      date,
      inMonth: date.getMonth() === month && date.getFullYear() === year,
    };
  });
}

/** Månedsrutenettet delt i uker — formatet et rutenett faktisk rendres i. */
export function monthGridWeeks(year: number, month: number): GridDay[][] {
  const cells = monthGrid(year, month);
  const rows: GridDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/**
 * `dayKey` den andre veien. Nøkkelen er «år-månedsindeks-dag» med 0-basert
 * måned — den er vår egen, ikke ISO, og må derfor også tolkes av oss.
 *
 * Returnerer null på alt som ikke er en ekte dato, fordi den brukes på
 * navigasjonsparametere: en gammel lenke skal gi «i dag», ikke en Invalid Date
 * som forplanter seg gjennom hele skjermen.
 */
export function dateFromDayKey(key: string): Date | null {
  const parts = key.split('-');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const date = new Date(year, month, day);
  // 31. februar normaliseres stille til 3. mars av konstruktøren — den skal
  // avvises, ikke godtas som «en dato».
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

/** Hendelsestypen som substantiv. Brukes i prikkenes VoiceOver-tekst. */
export const TYPE_NOUN: Record<EventType, string> = {
  trening: 'Trening',
  kamp: 'Kamp',
  turnering: 'Turnering',
  sosialt: 'Noe sosialt',
  annet: 'En hendelse',
};

/**
 * «Kamp samme dag» / «2 hendelser samme dag» — KOLLISJONEN, kort.
 * Datovelgerens språk: her er prikken en advarsel om at dagen er opptatt.
 */
export function busyLabel(types: EventType[] | undefined): string | null {
  if (!types || types.length === 0) return null;
  if (types.length === 1) return `${TYPE_NOUN[types[0]]} samme dag`;
  return `${types.length} hendelser samme dag`;
}

/**
 * «én kamp» / «2 hendelser» — INNHOLDET, kort.
 * Kalenderens språk: her er prikken ikke en advarsel, men det som skjer.
 * `count` er antall hendelser, `types` er de ulike typene (prikkene).
 */
export function dayContentLabel(
  types: EventType[] | undefined,
  count: number,
): string | null {
  if (!types || types.length === 0 || count === 0) return null;
  if (count === 1) return `én ${TYPE_NOUN[types[0]].toLowerCase()}`;
  return `${count} hendelser`;
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
 * «Lørdag 8. august» — alltid datoen, aldri «I dag».
 *
 * Kalenderens dagceller leses opp med denne: en VoiceOver-bruker som blar i
 * månedsrutenettet skal få vite hvilken dato cellen ER. «I dag» henges på som
 * et tillegg der det gjelder, det erstatter ikke datoen.
 */
export function fullDayLabel(date: Date, today: Date = new Date()): string {
  const base = `${capitalize(WEEKDAYS[date.getDay()])} ${date.getDate()}. ${
    MONTHS[date.getMonth()]
  }`;
  return date.getFullYear() === today.getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
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
  return fullDayLabel(date, today);
}

/**
 * Hele VoiceOver-teksten for én dagcelle: «Fredag 7. august, i dag, én kamp».
 *
 * ⚠️ Sier bevisst IKKE «valgt». Cellen setter `accessibilityState.selected`,
 * og iOS leser den som en egen trait — står ordet også i teksten, blir det
 * «Valgt, fredag 7. august, valgt». Samme grunn til at datoen ikke hentes fra
 * `longDayLabel`: den ville sagt «I dag, i dag».
 */
export function dayCellLabel(
  date: Date,
  today: Date,
  note?: string | null,
): string {
  return [fullDayLabel(date, today), isSameDay(date, today) ? 'i dag' : null, note]
    .filter(Boolean)
    .join(', ');
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
