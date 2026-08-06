import {dayDiff, dayKey, eachDay, startOfDay} from './calendar';
import type {HeiaEvent} from './types';

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

/**
 * Skiller fortid fra framtid og snur arkivet, slik kalenderen alltid har
 * gjort: det som kommer først, og forrige lørdag øverst i historikken.
 *
 * En FLERDAGERS turnering deles per dag — dag 1 kan ligge i arkivet mens
 * dag 2 fortsatt er kommende. Det er riktig: det er dagen, ikke turneringen,
 * som har vært.
 */
export function splitByTime(
  rows: CalendarRow[],
  today: Date = new Date(),
): {upcoming: CalendarRow[]; past: CalendarRow[]} {
  const upcoming: CalendarRow[] = [];
  const past: CalendarRow[] = [];
  for (const row of rows) {
    (dayDiff(row.date, today) < 0 ? past : upcoming).push(row);
  }
  return {upcoming, past: past.reverse()};
}
