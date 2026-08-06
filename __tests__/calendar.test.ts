/**
 * Kalenderens datomatte (src/shared/calendar.ts).
 *
 * Vi valgte bort et datobibliotek 2026-08-06. Prisen for det valget er at
 * skuddår, månedsskift, årsskift og sommertid er VÅRE feil — så de testes
 * her, ikke i appen.
 */
import {
  addDays,
  addMonths,
  dayDiff,
  dayKey,
  isSameDay,
  longDayLabel,
  monthMatrix,
  monthTitle,
  nextSaturday,
  relativeDayLabel,
  shortDayLabel,
  startOfDay,
  atTime,
} from '../src/shared/calendar';

/** Antall reelle datoer i rutenettet — resten er null-celler. */
function realDays(cells: (Date | null)[]): Date[] {
  return cells.filter((c): c is Date => c !== null);
}

describe('monthMatrix', () => {
  it('legger august 2026 med fem tomme celler først (1. aug er en lørdag)', () => {
    const cells = monthMatrix(2026, 7);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]?.getDate()).toBe(1);
    expect(realDays(cells)).toHaveLength(31);
  });

  it('starter uken på mandag, ikke på søndag', () => {
    // Juni 2026 begynner PÅ en mandag — da skal det ikke være ledende tomrom.
    const cells = monthMatrix(2026, 5);
    expect(cells[0]?.getDate()).toBe(1);
    expect(cells[0]?.getDay()).toBe(1);
  });

  it('setter søndag sist i uken', () => {
    // Februar 2026 begynner på en søndag: seks tomme celler, ikke null.
    const cells = monthMatrix(2026, 1);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]?.getDay()).toBe(0);
  });

  it('gir 29 dager i februar et skuddår', () => {
    expect(realDays(monthMatrix(2024, 1))).toHaveLength(29);
    expect(realDays(monthMatrix(2026, 1))).toHaveLength(28);
    expect(realDays(monthMatrix(2100, 1))).toHaveLength(28); // ikke skuddår
  });

  it('fyller alltid opp til hele uker — og aldri mer', () => {
    for (let year = 2025; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        const cells = monthMatrix(year, month);
        expect(cells.length % 7).toBe(0);
        // Ingen tom bunnrad: siste uke må inneholde minst én ekte dag.
        expect(realDays(cells.slice(-7)).length).toBeGreaterThan(0);
      }
    }
  });

  it('holder dagene i stigende rekkefølge uten hull', () => {
    const days = realDays(monthMatrix(2026, 9));
    days.forEach((d, i) => {
      expect(d.getDate()).toBe(i + 1);
      expect(d.getMonth()).toBe(9);
      expect(d.getFullYear()).toBe(2026);
    });
  });
});

describe('addDays / addMonths', () => {
  it('krysser månedsskiftet', () => {
    expect(dayKey(addDays(new Date(2026, 7, 31), 1))).toBe('2026-8-1');
  });

  it('krysser årsskiftet begge veier', () => {
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-0-1');
    expect(dayKey(addDays(new Date(2027, 0, 1), -1))).toBe('2026-11-31');
  });

  it('overlever sommertidsnatten (29. mars 2026)', () => {
    // Natten er 23 timer. Med + 86 400 000 ms havner man 28. mars kl. 23.
    expect(dayKey(addDays(new Date(2026, 2, 28), 1))).toBe('2026-2-29');
    expect(dayKey(addDays(new Date(2026, 2, 29), 1))).toBe('2026-2-30');
    // Og høstens 25-timersnatt.
    expect(dayKey(addDays(new Date(2026, 9, 25), 1))).toBe('2026-9-26');
  });

  it('bommer ikke på 31. januar + 1 måned', () => {
    const next = addMonths(new Date(2026, 0, 31), 1);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(1);
  });

  it('blar 18 måneder fram til riktig år', () => {
    const far = addMonths(new Date(2026, 7, 1), 18);
    expect(monthTitle(far)).toBe('Februar 2028');
  });
});

describe('dayDiff', () => {
  it('teller hele døgn uansett klokkeslett', () => {
    const a = new Date(2026, 7, 8, 23, 59);
    const b = new Date(2026, 7, 6, 0, 1);
    expect(dayDiff(a, b)).toBe(2);
  });

  it('teller riktig over sommertidsskiftet', () => {
    expect(dayDiff(new Date(2026, 2, 30), new Date(2026, 2, 28))).toBe(2);
    expect(dayDiff(new Date(2026, 9, 26), new Date(2026, 9, 24))).toBe(2);
  });

  it('er negativ bakover', () => {
    expect(dayDiff(new Date(2026, 7, 1), new Date(2026, 7, 6))).toBe(-5);
  });
});

describe('etikettene', () => {
  const today = new Date(2026, 7, 6); // torsdag 6. august 2026

  it('sier I dag, I morgen og I går', () => {
    expect(longDayLabel(today, today)).toBe('I dag');
    expect(longDayLabel(addDays(today, 1), today)).toBe('I morgen');
    expect(longDayLabel(addDays(today, -1), today)).toBe('I går');
  });

  it('skriver ukedag og måned med stor forbokstav', () => {
    expect(longDayLabel(new Date(2026, 7, 8), today)).toBe('Lørdag 8. august');
  });

  it('henger på året først når datoen bor i et annet år', () => {
    expect(longDayLabel(new Date(2026, 11, 5), today)).toBe(
      'Lørdag 5. desember',
    );
    expect(longDayLabel(new Date(2027, 0, 9), today)).toBe(
      'Lørdag 9. januar 2027',
    );
  });

  it('gir kort form til hurtigknappene', () => {
    expect(shortDayLabel(new Date(2026, 7, 8))).toBe('lør 8. aug');
  });

  it('sier hvor langt unna datoen er', () => {
    expect(relativeDayLabel(addDays(today, 3), today)).toBe('om 3 dager');
    expect(relativeDayLabel(addDays(today, 14), today)).toBe('om 2 uker');
    expect(relativeDayLabel(addDays(today, 7), today)).toBe('om 1 uke');
    expect(relativeDayLabel(new Date(2026, 9, 17), today)).toBe('om 2 måneder');
  });

  it('sier det samme bakover — fortiden er lovlig for trener/lagleder', () => {
    expect(relativeDayLabel(addDays(today, -1), today)).toBe('i går');
    expect(relativeDayLabel(addDays(today, -4), today)).toBe(
      'for 4 dager siden',
    );
    expect(relativeDayLabel(addDays(today, -21), today)).toBe(
      'for 3 uker siden',
    );
    expect(relativeDayLabel(addDays(today, -30), today)).toBe(
      'for 1 måned siden',
    );
  });
});

describe('nextSaturday', () => {
  it('hopper over I dag og I morgen', () => {
    // Torsdag → lørdag om to dager.
    expect(dayKey(nextSaturday(new Date(2026, 7, 6)))).toBe('2026-7-8');
    // Fredag: lørdagen i morgen har alt en knapp, så neste uke er riktig.
    expect(dayKey(nextSaturday(new Date(2026, 7, 7)))).toBe('2026-7-15');
    // Lørdag: neste lørdag.
    expect(dayKey(nextSaturday(new Date(2026, 7, 8)))).toBe('2026-7-15');
  });

  it('lander alltid på en lørdag', () => {
    for (let i = 0; i < 40; i++) {
      expect(nextSaturday(addDays(new Date(2026, 7, 6), i)).getDay()).toBe(6);
    }
  });
});

describe('atTime / startOfDay / isSameDay', () => {
  it('setter klokkeslett uten å røre datoen', () => {
    const day = new Date(2026, 9, 17);
    const start = atTime(day, 18, 30);
    expect(dayKey(start)).toBe('2026-9-17');
    expect(start.getHours()).toBe(18);
    expect(start.getMinutes()).toBe(30);
    expect(start.getSeconds()).toBe(0);
    // Ikke muterende — dette var feilen i det gamle new Date(day) + setHours.
    expect(day.getHours()).toBe(0);
  });

  it('kutter klokkeslettet i startOfDay', () => {
    expect(startOfDay(new Date(2026, 7, 6, 23, 45)).getHours()).toBe(0);
  });

  it('ser bort fra klokkeslett i isSameDay', () => {
    expect(
      isSameDay(new Date(2026, 7, 6, 0, 1), new Date(2026, 7, 6, 23, 59)),
    ).toBe(true);
    expect(isSameDay(new Date(2026, 7, 6), new Date(2026, 7, 7))).toBe(false);
  });
});
