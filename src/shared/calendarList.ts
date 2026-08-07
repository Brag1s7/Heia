import {
  dayDiff,
  dayKey,
  eachDay,
  longDayLabel,
  startOfDay,
  type BusyDays,
} from './calendar';
import type {EventType, HeiaEvent} from './types';

/**
 * Kalenderlistas struktur — rene funksjoner, ingen React og ingen Supabase.
 *
 * Regelen som styrer alt her (Brage 2026-08-06):
 *
 *   **Det finnes bare ETT kampobjekt.** En kamp i en turnering er en helt
 *   vanlig kamp med `parentEventId`, med samme kampmotor som alle andre —
 *   live, score, bilder, kommentarer, statistikk. Den skal ALDRI dupliseres
 *   som en egen kalenderhendelse.
 *
 * Turneringen og kampene skal likevel ikke leses som flere uavhengige
 * arrangementer. Derfor grupperes de: turneringen blir én rad PER DAG den
 * dekker, og dagens kamper henger under den raden. Kampen finnes fortsatt
 * bare én gang — den er bare tegnet inni turneringen sin.
 */

/** Turneringen på ÉN av dagene den dekker, med den dagens kamper. */
export interface TournamentDayRow {
  kind: 'tournamentDay';
  key: string;
  /** Dagen raden hører til (midnatt). Styrer seksjon og fortid/framtid. */
  date: Date;
  /** Sorteringsnøkkel i millisekunder — dagens første kamp, ellers dagen. */
  sortAt: number;
  tournament: HeiaEvent;
  /** 1-basert. «Dag 1 av 2». */
  dayIndex: number;
  dayCount: number;
  /** Kampene denne dagen, kronologisk. Tom = oppsettet er ikke klart. */
  matches: HeiaEvent[];
}

/** En helt vanlig hendelse: trening, kamp, sosialt, annet. */
export interface EventRow {
  kind: 'event';
  key: string;
  date: Date;
  sortAt: number;
  event: HeiaEvent;
}

export type CalendarRow = TournamentDayRow | EventRow;

function eventRow(event: HeiaEvent): EventRow {
  return {
    kind: 'event',
    key: event.id,
    date: startOfDay(event.startTime),
    sortAt: event.startTime.getTime(),
    event,
  };
}

/**
 * Bygger kalenderens rader fra lagets hendelser, kronologisk stigende.
 *
 * Kampene i en turnering plukkes UT av den flate lista og legges under
 * turneringsdagen sin. Ett unntak, og det er viktig: en turneringskamp som
 * ligger UTENFOR turneringens datoer havner ellers ingen steder — den
 * faller derfor tilbake til å være en vanlig rad. Bedre en løs kamp enn en
 * usynlig kamp.
 */
export function buildCalendarRows(events: HeiaEvent[]): CalendarRow[] {
  const tournaments = events.filter(e => e.type === 'turnering');

  if (tournaments.length === 0) {
    return events.map(eventRow).sort((a, b) => a.sortAt - b.sortAt);
  }

  // Kampene som faktisk blir plassert under en turneringsdag. Alt annet
  // renderes som vanlige rader.
  const claimed = new Set<string>();
  const rows: CalendarRow[] = [];

  for (const tournament of tournaments) {
    const days = eachDay(
      tournament.startTime,
      tournament.endTime ?? tournament.startTime,
    );

    const children = events.filter(
      e => e.parentEventId === tournament.id && e.id !== tournament.id,
    );

    days.forEach((date, index) => {
      const matches = children
        .filter(match => dayKey(match.startTime) === dayKey(date))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      matches.forEach(match => claimed.add(match.id));

      rows.push({
        kind: 'tournamentDay',
        key: `${tournament.id}:${dayKey(date)}`,
        date,
        // Dag 1 arver turneringens klokkeslett, så den sorteres riktig mot
        // en trening samme morgen. Senere dager har ingen egen starttid, og
        // legger seg etter dagens første kamp — eller først på dagen.
        sortAt:
          matches[0]?.startTime.getTime() ??
          (index === 0 ? tournament.startTime.getTime() : date.getTime()),
        tournament,
        dayIndex: index + 1,
        dayCount: days.length,
        matches,
      });
    });
  }

  for (const event of events) {
    if (event.type === 'turnering') continue; // tegnet som turneringsdager
    if (claimed.has(event.id)) continue; // tegnet under turneringen sin
    // En kamp med forelder som ikke ble plassert (dato utenfor perioden,
    // eller slettet turnering) faller pent tilbake til en vanlig rad.
    rows.push(eventRow(event));
  }

  return rows.sort((a, b) => a.sortAt - b.sortAt);
}

/** Turneringens tittel for en kamp, til den lille etiketten på Hjem. */
export function tournamentTitleFor(
  match: HeiaEvent,
  events: HeiaEvent[],
): string | undefined {
  if (!match.parentEventId) return undefined;
  return events.find(
    e => e.id === match.parentEventId && e.type === 'turnering',
  )?.title;
}

/** Kampene en rad representerer. En turneringsdag «er» kampene sine. */
export function rowEvents(row: CalendarRow): HeiaEvent[] {
  return row.kind === 'event' ? [row.event] : row.matches;
}

/**
 * Radene fra og med dagen `from`, kronologisk stigende.
 *
 * Kalenderen har ETT tidsforløp, og det går én vei (Brage 2026-08-07). Det
 * gamle arkivet lå reversert etter det kommende, så tiden først gikk framover
 * og så plutselig bakover mens man scrollet videre nedover. Historikk nås nå
 * ved å FLYTTE `from` bakover — gjennom uke-/månedsvisningen eller «Se
 * tidligere hendelser» — ikke ved å snu en liste.
 *
 * En FLERDAGERS turnering deles per dag: dag 1 kan ha vært mens dag 2 fortsatt
 * kommer. Det er riktig — det er dagen, ikke turneringen, som har vært.
 */
export function rowsFrom(rows: CalendarRow[], from: Date): CalendarRow[] {
  return rows.filter(row => dayDiff(row.date, from) >= 0);
}

/** Én dag i agendaen, med alt som skjer den dagen. */
export interface DaySection {
  /** `dayKey` — også scroll-målet og React-nøkkelen. */
  key: string;
  date: Date;
  /** «I dag» / «I morgen» / «Mandag 10. august». */
  label: string;
  rows: CalendarRow[];
  /** Hendelser denne dagen. Turneringsdagen teller kampene sine. */
  count: number;
  /** Typene denne dagen, i rekkefølgen de opptrer. Prikkenes farger. */
  types: EventType[];
  /** Første dag i en ny måned — et diskret månedsskille hører over den. */
  monthBreak: boolean;
}

/**
 * Grupperer radene i én seksjon PER DAG.
 *
 * Erstatter de brede seksjonene («Denne uken», «August»), som ikke kunne være
 * scroll-mål: en dato må kunne peke på ett sted i lista. Månedsnavnet er ikke
 * borte — det henger nå som et skille OVER dagen måneden skifter.
 */
export function groupByDay(
  rows: CalendarRow[],
  today: Date = new Date(),
): DaySection[] {
  const sections: DaySection[] = [];

  for (const row of rows) {
    const key = dayKey(row.date);
    let section = sections[sections.length - 1];

    if (!section || section.key !== key) {
      const previous = section;
      section = {
        key,
        date: row.date,
        label: longDayLabel(row.date, today),
        rows: [],
        count: 0,
        types: [],
        monthBreak:
          previous !== undefined &&
          (previous.date.getMonth() !== row.date.getMonth() ||
            previous.date.getFullYear() !== row.date.getFullYear()),
      };
      sections.push(section);
    }

    section.rows.push(row);
    // Turneringsdagen bidrar med kampene sine, og med turneringen selv når
    // oppsettet ikke er klart ennå — ellers ville en cupdag uten kamper vært
    // en «tom» dag i kalenderen.
    section.count += row.kind === 'event' ? 1 : Math.max(1, row.matches.length);

    for (const type of rowTypes(row)) {
      if (!section.types.includes(type)) section.types.push(type);
    }
  }

  return sections;
}

/** Typene én rad bidrar med. Turneringsdagen er både gull OG kampene sine. */
function rowTypes(row: CalendarRow): EventType[] {
  if (row.kind === 'event') return [row.event.type];
  return ['turnering', ...row.matches.map(m => m.type)];
}

/**
 * Prikkene i uke- og månedsvisningen, bygget fra de SAMME radene som agendaen.
 *
 * Bevisst ikke et nytt `getBusyDays`-kall: kalenderfanen har alt hendelsene,
 * og to kilder ville før eller siden vist ulikt innhold på samme dag. En
 * flerdagers turnering markerer alle dagene sine helt av seg selv, fordi
 * `buildCalendarRows` allerede har gitt den én rad per dag.
 */
export function busyDaysFromRows(rows: CalendarRow[]): BusyDays {
  const days: BusyDays = {};
  for (const row of rows) {
    const key = dayKey(row.date);
    const existing = days[key] ?? (days[key] = []);
    for (const type of rowTypes(row)) {
      // Tre treninger samme dag skal gi én prikk, ikke tre.
      if (!existing.includes(type)) existing.push(type);
    }
  }
  return days;
}
