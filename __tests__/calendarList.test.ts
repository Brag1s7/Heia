/**
 * Kalenderlistas gruppering (src/shared/calendarList.ts).
 *
 * Regelen som testes: det finnes bare ETT kampobjekt. En turneringskamp
 * skal vises under turneringen sin OG ingen andre steder — aldri både som
 * turneringskamp og som løs kalenderhendelse.
 */
import {
  buildCalendarRows,
  splitByTime,
  tournamentTitleFor,
  type CalendarRow,
  type TournamentDayRow,
} from '../src/shared/calendarList';
import {dayRangeLabel} from '../src/shared/calendar';
import type {HeiaEvent, EventType} from '../src/shared/types';

function evt(
  id: string,
  type: EventType,
  start: Date,
  extra: Partial<HeiaEvent> = {},
): HeiaEvent {
  return {
    id,
    teamSpaceId: 'ts',
    type,
    title: id,
    startTime: start,
    rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'venter'},
    ...extra,
  };
}

const days = (rows: CalendarRow[]): TournamentDayRow[] =>
  rows.filter((r): r is TournamentDayRow => r.kind === 'tournamentDay');

describe('buildCalendarRows — uten turneringer', () => {
  it('gir én rad per hendelse, kronologisk', () => {
    const rows = buildCalendarRows([
      evt('b', 'trening', new Date(2026, 7, 10, 18, 0)),
      evt('a', 'kamp', new Date(2026, 7, 8, 14, 0)),
    ]);
    expect(rows.map(r => r.key)).toEqual(['a', 'b']);
    expect(rows.every(r => r.kind === 'event')).toBe(true);
  });
});

describe('buildCalendarRows — flerdagers turnering', () => {
  // HamKam Cup 14.–16. august, med kamper på dag 1 og dag 2.
  const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0), {
    title: 'HamKam Cup',
    endTime: new Date(2026, 7, 16, 23, 59),
  });
  const m1 = evt('m1', 'kamp', new Date(2026, 7, 14, 10, 0), {
    parentEventId: 'cup',
  });
  const m2 = evt('m2', 'kamp', new Date(2026, 7, 14, 14, 0), {
    parentEventId: 'cup',
  });
  const m3 = evt('m3', 'kamp', new Date(2026, 7, 15, 11, 0), {
    parentEventId: 'cup',
  });

  it('lager én rad per dag turneringen dekker', () => {
    const rows = days(buildCalendarRows([cup, m1, m2, m3]));
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.dayIndex)).toEqual([1, 2, 3]);
    expect(rows.every(r => r.dayCount === 3)).toBe(true);
  });

  it('legger kampene under RIKTIG dag, kronologisk', () => {
    const rows = days(buildCalendarRows([cup, m3, m2, m1]));
    expect(rows[0].matches.map(m => m.id)).toEqual(['m1', 'm2']);
    expect(rows[1].matches.map(m => m.id)).toEqual(['m3']);
    expect(rows[2].matches).toEqual([]);
  });

  it('dupliserer ALDRI en kamp som egen kalenderhendelse', () => {
    const rows = buildCalendarRows([cup, m1, m2, m3]);
    const loose = rows.filter(r => r.kind === 'event');
    expect(loose).toHaveLength(0);

    // Hver kamp finnes nøyaktig én gang i hele lista.
    const seen = days(rows).flatMap(r => r.matches.map(m => m.id));
    expect(seen.sort()).toEqual(['m1', 'm2', 'm3']);
  });

  it('viser ikke turneringen som en egen vanlig rad i tillegg', () => {
    const rows = buildCalendarRows([cup, m1]);
    expect(rows.some(r => r.kind === 'event' && r.event.id === 'cup')).toBe(
      false,
    );
  });

  it('gir en dag uten kamper en tom liste — «oppsettet er ikke klart»', () => {
    const rows = days(buildCalendarRows([cup]));
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.matches.length === 0)).toBe(true);
  });
});

describe('buildCalendarRows — endagsturnering', () => {
  it('gir én rad, og skjuler «Dag 1 av 1» ved å sette dayCount 1', () => {
    const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0), {
      endTime: new Date(2026, 7, 14, 23, 59),
    });
    const rows = days(buildCalendarRows([cup]));
    expect(rows).toHaveLength(1);
    expect(rows[0].dayCount).toBe(1);
  });

  it('takler turnering HELT uten sluttid', () => {
    const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0));
    const rows = days(buildCalendarRows([cup]));
    expect(rows).toHaveLength(1);
    expect(rows[0].dayCount).toBe(1);
  });
});

describe('buildCalendarRows — kanttilfeller som ellers skjuler data', () => {
  it('lar en kamp UTENFOR turneringens datoer stå som vanlig rad', () => {
    // Bedre en løs kamp enn en usynlig kamp.
    const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0), {
      endTime: new Date(2026, 7, 15, 23, 59),
    });
    const strays = evt('stray', 'kamp', new Date(2026, 7, 20, 12, 0), {
      parentEventId: 'cup',
    });
    const rows = buildCalendarRows([cup, strays]);
    expect(rows.some(r => r.kind === 'event' && r.event.id === 'stray')).toBe(
      true,
    );
  });

  it('lar en kamp med SLETTET turnering stå som vanlig rad', () => {
    const orphan = evt('orphan', 'kamp', new Date(2026, 7, 20, 12, 0), {
      parentEventId: 'borte',
    });
    const rows = buildCalendarRows([orphan]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('event');
  });

  it('sorterer turneringsdagen mot vanlige hendelser samme dag', () => {
    const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0), {
      endTime: new Date(2026, 7, 14, 23, 59),
    });
    const morning = evt('trening', 'trening', new Date(2026, 7, 14, 7, 0));
    const rows = buildCalendarRows([cup, morning]);
    expect(rows.map(r => r.key)).toEqual(['trening', `cup:2026-7-14`]);
  });
});

describe('splitByTime', () => {
  const today = new Date(2026, 7, 15);

  it('deler en flerdagers turnering per dag over «i dag»', () => {
    // Cupen går 14.–16. Dag 1 er historie, dag 2 og 3 er det ikke.
    const cup = evt('cup', 'turnering', new Date(2026, 7, 14, 9, 0), {
      endTime: new Date(2026, 7, 16, 23, 59),
    });
    const {upcoming, past} = splitByTime(buildCalendarRows([cup]), today);
    expect(past.map(r => (r as TournamentDayRow).dayIndex)).toEqual([1]);
    expect(upcoming.map(r => (r as TournamentDayRow).dayIndex)).toEqual([2, 3]);
  });

  it('snur arkivet så det nyeste ligger først', () => {
    const rows = buildCalendarRows([
      evt('gammel', 'kamp', new Date(2026, 7, 1, 12, 0)),
      evt('nyere', 'kamp', new Date(2026, 7, 10, 12, 0)),
    ]);
    expect(splitByTime(rows, today).past.map(r => r.key)).toEqual([
      'nyere',
      'gammel',
    ]);
  });
});

describe('tournamentTitleFor', () => {
  const cup = evt('cup', 'turnering', new Date(2026, 7, 14), {
    title: 'HamKam Cup',
  });

  it('finner turneringens navn til etiketten på Hjem', () => {
    const match = evt('m', 'kamp', new Date(2026, 7, 14, 10, 0), {
      parentEventId: 'cup',
    });
    expect(tournamentTitleFor(match, [cup, match])).toBe('HamKam Cup');
  });

  it('gir undefined for en vanlig seriekamp', () => {
    const match = evt('m', 'kamp', new Date(2026, 7, 14, 10, 0));
    expect(tournamentTitleFor(match, [cup, match])).toBeUndefined();
  });
});

describe('dayRangeLabel', () => {
  const today = new Date(2026, 7, 6);

  it('skriver én dato når turneringen varer én dag', () => {
    expect(
      dayRangeLabel(new Date(2026, 7, 14), new Date(2026, 7, 14), today),
    ).toBe('14. august');
  });

  it('gjentar ikke måneden innenfor samme måned', () => {
    expect(
      dayRangeLabel(new Date(2026, 7, 14), new Date(2026, 7, 16), today),
    ).toBe('14.–16. august');
  });

  it('tar med begge månedene over et månedsskifte', () => {
    expect(
      dayRangeLabel(new Date(2026, 7, 30), new Date(2026, 8, 2), today),
    ).toBe('30. august–2. september');
  });

  it('henger på året når perioden ikke er i år', () => {
    expect(
      dayRangeLabel(new Date(2027, 5, 4), new Date(2027, 5, 6), today),
    ).toBe('4.–6. juni 2027');
  });
});
