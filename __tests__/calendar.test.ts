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
  addWeeks,
  atTime,
  busyLabel,
  dateFromDayKey,
  dayCellLabel,
  dayContentLabel,
  dayDiff,
  dayKey,
  fullDayLabel,
  isSameDay,
  longDayLabel,
  monthGrid,
  monthGridWeeks,
  monthTitle,
  nextSaturday,
  relativeDayLabel,
  shortDayLabel,
  startOfDay,
  startOfWeek,
  weekDays,
} from '../src/shared/calendar';

/** Dagene som faktisk hører til måneden som vises. */
function inMonth(cells: {date: Date; inMonth: boolean}[]): Date[] {
  return cells.filter(c => c.inMonth).map(c => c.date);
}

/** Antall dager i en måned — fasiten å måle rutenettet mot. */
function daysIn(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

describe('monthGrid — ALLTID seks uker', () => {
  // Dette er hele grunnen til at funksjonen finnes (Brage 2026-08-07): et
  // rutenett som veksler mellom fem og seks rader endrer høyde når man blar,
  // og da hopper alt under det.
  it('gir 42 celler for HVER måned i fire år', () => {
    for (let year = 2025; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        expect(monthGrid(year, month)).toHaveLength(42);
        const weeks = monthGridWeeks(year, month);
        expect(weeks).toHaveLength(6);
        expect(weeks.every(w => w.length === 7)).toBe(true);
      }
    }
  });

  it('holder høyden også for februar og måneder som starter på søndag', () => {
    // Februar 2026 er 28 dager OG begynner på en søndag — den korteste
    // måneden som finnes. Den skal ha nøyaktig like mange rader som en
    // 31-dagers måned som starter på lørdag.
    expect(new Date(2026, 1, 1).getDay()).toBe(0);
    expect(monthGridWeeks(2026, 1)).toHaveLength(6);
    expect(monthGridWeeks(2026, 7)).toHaveLength(6); // august, starter lørdag
    expect(monthGridWeeks(2021, 1)).toHaveLength(6); // feb 2021: 28 d, mandag
    expect(monthGridWeeks(2024, 1)).toHaveLength(6); // skuddårsfebruar
  });

  it('begynner alltid på en mandag og slutter på en søndag', () => {
    for (let year = 2025; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        const cells = monthGrid(year, month);
        expect(cells[0].date.getDay()).toBe(1);
        expect(cells[41].date.getDay()).toBe(0);
      }
    }
  });

  it('fyller kantene med nabomånedens dager, ikke med tomrom', () => {
    // August 2026 begynner på en lørdag: fem celler før den 1.
    const cells = monthGrid(2026, 7);
    expect(cells.slice(0, 5).every(c => !c.inMonth)).toBe(true);
    expect(dayKey(cells[0].date)).toBe('2026-6-27'); // mandag 27. juli
    expect(cells[5].inMonth).toBe(true);
    expect(cells[5].date.getDate()).toBe(1);
  });

  it('markerer nøyaktig månedens egne dager som inMonth', () => {
    for (let year = 2025; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        const own = inMonth(monthGrid(year, month));
        expect(own).toHaveLength(daysIn(year, month));
        own.forEach((d, i) => {
          expect(d.getDate()).toBe(i + 1);
          expect(d.getMonth()).toBe(month);
          expect(d.getFullYear()).toBe(year);
        });
      }
    }
  });

  it('går sammenhengende dag for dag, uten hull og uten hopp', () => {
    // Inkluderer mars 2026 (sommertid 29. mars) og oktober 2026 (25. okt).
    for (const [year, month] of [
      [2026, 2],
      [2026, 9],
      [2026, 11],
      [2028, 1],
    ]) {
      const cells = monthGrid(year, month);
      for (let i = 1; i < cells.length; i++) {
        expect(dayDiff(cells[i].date, cells[i - 1].date)).toBe(1);
        expect(cells[i].date.getHours()).toBe(0);
      }
    }
  });

  it('deler cellene i uker uten å endre dem', () => {
    expect(monthGridWeeks(2026, 7).flat()).toEqual(monthGrid(2026, 7));
  });
});

describe('uka — mandag først', () => {
  it('finner mandagen uansett hvilken dag man står på', () => {
    // Uke 32 i 2026: mandag 3. august til søndag 9. august.
    for (let d = 3; d <= 9; d++) {
      expect(dayKey(startOfWeek(new Date(2026, 7, d)))).toBe('2026-7-3');
    }
  });

  it('trekker søndag SEKS dager tilbake, ikke null', () => {
    // Søndag 9. august hører til uka som begynner mandag 3.
    expect(new Date(2026, 7, 9).getDay()).toBe(0);
    expect(dayKey(startOfWeek(new Date(2026, 7, 9)))).toBe('2026-7-3');
  });

  it('gir sju dager fra mandag til søndag', () => {
    const days = weekDays(new Date(2026, 7, 6));
    expect(days).toHaveLength(7);
    expect(days.map(d => d.getDate())).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
  });

  it('krysser månedsskiftet i én uke', () => {
    // Mandag 31. august 2026 → søndag 6. september.
    expect(weekDays(new Date(2026, 8, 2)).map(d => dayKey(d))).toEqual([
      '2026-7-31',
      '2026-8-1',
      '2026-8-2',
      '2026-8-3',
      '2026-8-4',
      '2026-8-5',
      '2026-8-6',
    ]);
  });

  it('overlever sommertidsnatten når man blar uke for uke', () => {
    // 29. mars 2026 er 23 timer lang. Uke-for-uke må lande på mandager.
    let cursor = startOfWeek(new Date(2026, 2, 2));
    for (let i = 0; i < 8; i++) {
      expect(cursor.getDay()).toBe(1);
      expect(cursor.getHours()).toBe(0);
      cursor = addWeeks(cursor, 1);
    }
    // Og bakover, over høstens 25-timersnatt.
    let back = startOfWeek(new Date(2026, 10, 9));
    for (let i = 0; i < 8; i++) {
      expect(back.getDay()).toBe(1);
      back = addWeeks(back, -1);
    }
  });
});

describe('dateFromDayKey', () => {
  it('er den nøyaktige motsatsen til dayKey', () => {
    for (const date of [
      new Date(2026, 0, 1),
      new Date(2026, 7, 6),
      new Date(2028, 1, 29), // skuddår
      new Date(2027, 11, 31),
    ]) {
      expect(dayKey(dateFromDayKey(dayKey(date))!)).toBe(dayKey(date));
    }
  });

  it('avviser tull i stedet for å lage en Invalid Date', () => {
    // Navigasjonsparametere kan være gamle eller feil — de skal gi «i dag»,
    // ikke en dato som forplanter seg gjennom hele skjermen.
    expect(dateFromDayKey('')).toBeNull();
    expect(dateFromDayKey('2026-07-06T00:00:00Z')).toBeNull();
    expect(dateFromDayKey('2026-7')).toBeNull();
    expect(dateFromDayKey('abc-1-2')).toBeNull();
    expect(dateFromDayKey('2026-12-1')).toBeNull(); // måned 12 finnes ikke
    expect(dateFromDayKey('2026-7-0')).toBeNull();
  });

  it('avviser 31. februar i stedet for å la den bli 3. mars', () => {
    expect(dateFromDayKey('2026-1-31')).toBeNull();
    expect(dateFromDayKey('2026-1-29')).toBeNull(); // ikke skuddår
    expect(dayKey(dateFromDayKey('2028-1-29')!)).toBe('2028-1-29');
  });
});

describe('prikkenes tekst', () => {
  it('sier hva som KOLLIDERER i skjemaet', () => {
    expect(busyLabel(undefined)).toBeNull();
    expect(busyLabel([])).toBeNull();
    expect(busyLabel(['kamp'])).toBe('Kamp samme dag');
    expect(busyLabel(['kamp', 'trening'])).toBe('2 hendelser samme dag');
  });

  it('sier hva som SKJER i kalenderen', () => {
    expect(dayContentLabel(['kamp'], 1)).toBe('én kamp');
    expect(dayContentLabel(['trening'], 1)).toBe('én trening');
    expect(dayContentLabel(['kamp'], 2)).toBe('2 hendelser');
    expect(dayContentLabel(['turnering', 'kamp'], 3)).toBe('3 hendelser');
    expect(dayContentLabel([], 0)).toBeNull();
    expect(dayContentLabel(undefined, 0)).toBeNull();
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

  it('lar fullDayLabel ALLTID si datoen, aldri «I dag»', () => {
    // Dagcellene i rutenettet leses opp med denne: en VoiceOver-bruker som
    // blar må få vite hvilken dato cellen er.
    expect(fullDayLabel(today, today)).toBe('Torsdag 6. august');
    expect(fullDayLabel(addDays(today, 1), today)).toBe('Fredag 7. august');
    expect(fullDayLabel(new Date(2027, 0, 9), today)).toBe(
      'Lørdag 9. januar 2027',
    );
  });

  it('sier ikke «valgt» eller «i dag» to ganger i dagcellen', () => {
    // `accessibilityState.selected` leses som en egen trait, og datoen kommer
    // fra fullDayLabel — står ordene også i teksten, blir det dobbelt opp.
    expect(dayCellLabel(today, today, 'én kamp')).toBe(
      'Torsdag 6. august, i dag, én kamp',
    );
    expect(dayCellLabel(addDays(today, 2), today, null)).toBe(
      'Lørdag 8. august',
    );
    expect(dayCellLabel(addDays(today, 2), today)).not.toContain('valgt');
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
