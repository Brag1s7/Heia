import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {typography, spacing} from '../theme';
import {MonthGrid} from './calendar/MonthGrid';
import {GlassSheetSurface, InlineSheet} from './GlassSheet';
import {OPAL} from './OpalSurface';
import {addDays, startOfDay, type BusyDays} from '../shared/calendar';

interface DateSheetProps {
  visible: boolean;
  /** Valgt dag. Klokkeslettet ignoreres. */
  value: Date;
  /** Velger dagen OG lukker — én handling, ett resultat. */
  onChange: (day: Date) => void;
  onClose: () => void;
  busy?: BusyDays;
  busyLoading?: boolean;
  /** Hvor mange dager tilbake som er lov. 0 = ingen fortid. */
  daysBack?: number;
  /** Hvor langt fram man kan bla. */
  monthsAhead?: number;
  /** Overstyrer den tidligste lovlige dagen (turneringens sluttdato). */
  minDate?: Date;
  disabled?: boolean;
  reducedMotion?: boolean;
}

/**
 * Datovelgeren som GLASSARK (Brage 2026-09-03): «trykker man på når
 * hendelsen skal finne sted må samme glassbakgrunn komme opp som når man
 * trykker Måned». Erstatter den utfoldede kalenderen i skjemaet (2026-08-06),
 * som var et hvitt kort som skjøv resten av flaten ned.
 *
 * Rutenettet, grensene og fotnoten er de samme som før — bare
 * presentasjonen er ny: `MonthGrid` som `plain` (ingen bokser per dato) på
 * `GlassSheetSurface`, presentert med `InlineSheet` (ikke `Modal` — se
 * GlassSheet.tsx for hvorfor).
 */
export function DateSheet({
  visible,
  value,
  onChange,
  onClose,
  busy,
  busyLoading = false,
  daysBack = 0,
  monthsAhead = 18,
  minDate,
  disabled = false,
  reducedMotion = false,
}: DateSheetProps) {
  // Fryses ved montering. Skjermen er en modal man ikke står i over midnatt.
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => startOfDay(value), [value]);

  // Grensene: `daysBack` dager tilbake, `monthsAhead` måneder fram. Fram
  // regnes i HELE måneder, så siste måned kan brukes ut.
  const minDay = useMemo(
    () => (minDate ? startOfDay(minDate) : addDays(today, -daysBack)),
    [today, daysBack, minDate],
  );
  const maxDay = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthsAhead + 1, 0),
    [today, monthsAhead],
  );

  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  // Åpner man arket igjen, skal man lande i den valgte datoens måned — ikke
  // der man blar seg bort forrige gang.
  useEffect(() => {
    if (visible) {
      setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [visible, selected]);

  // `busy` er undefined både før hentingen og HVIS den feilet. Bare et tomt
  // objekt betyr «vi vet, og det er ingenting» — ellers ville en feilet
  // spørring påstått at kalenderen er ledig.
  const footNote = busyLoading
    ? 'Henter lagets kalender …'
    : busy && Object.keys(busy).length === 0
    ? 'Ingenting annet i kalenderen denne perioden'
    : 'Prikk = laget har alt noe den dagen';

  return (
    <InlineSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Lukk datovelgeren"
      reducedMotion={reducedMotion}>
      <GlassSheetSurface>
        <MonthGrid
          view={view}
          onChangeView={setView}
          selected={selected}
          today={today}
          onSelect={onChange}
          busy={busy}
          minDay={minDay}
          maxDay={maxDay}
          disabled={disabled}
          variant="plain"
        />
        <Text style={styles.foot}>{footNote}</Text>
      </GlassSheetSurface>
    </InlineSheet>
  );
}

const styles = StyleSheet.create({
  foot: {
    ...typography.caption,
    color: OPAL.inkSecondary,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
});
