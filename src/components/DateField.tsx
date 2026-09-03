import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {ChevronDown} from './icons';
import {
  MONTHS_SHORT,
  busyLabel,
  dayKey,
  longDayLabel,
  relativeDayLabel,
  startOfDay,
  type BusyDays,
} from '../shared/calendar';

interface DateFieldProps {
  /** Valgt dag. Klokkeslettet ignoreres — datoen er alt denne eier. */
  value: Date;
  /** Dager laget alt har noe på — til underteksten («· 2 hendelser»). */
  busy?: BusyDays;
  disabled?: boolean;
  /** Arket er oppe — raden viser det som valgt. */
  open: boolean;
  onOpen: () => void;
}

/**
 * Datovelgerens rad: den valgte datoen som en verdi. Trykk åpner
 * kalenderen som GLASSARK (`DateSheet`, rendret av skjermen i skjermroten).
 *
 * ⚠️ HISTORIKK: fra 2026-08-06 foldet kalenderen seg ut UNDER raden, i
 * skjemaet (et hvitt kort som skjøv resten av flaten ned). Brage
 * 2026-09-03: «trykker man på når hendelsen skal finne sted må samme
 * glassbakgrunn komme opp som når man trykker Måned» — så utfoldingen er
 * borte, og raden er kontrollert (`open`/`onOpen`) på samme måte som
 * `TimeField`. Grensene (daysBack/monthsAhead/minDate) bor nå i `DateSheet`.
 *
 * Den har med vilje INGEN hurtigknapper («I dag» / «I morgen»): i dag er alt
 * standardvalget, og det aller meste legges lenger fram enn i morgen.
 */
export function DateField({
  value,
  busy,
  disabled = false,
  open,
  onOpen,
}: DateFieldProps) {
  // Fryses ved montering. Skjermen er en modal man ikke står i over midnatt.
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => startOfDay(value), [value]);

  const selectedBusy = busyLabel(busy?.[dayKey(selected)]);
  const relative = relativeDayLabel(selected, today);

  return (
    <View>
      <Pressable
        onPress={onOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{expanded: open, disabled}}
        accessibilityLabel={`Dato: ${longDayLabel(
          selected,
          today,
        )}, ${relative}`}
        accessibilityHint="Åpner kalenderen"
        style={({pressed}) => [
          styles.summary,
          open && styles.summaryOpen,
          pressed && !open && styles.summaryPressed,
        ]}>
        <View style={styles.tile}>
          <Text style={styles.tileDay}>{selected.getDate()}</Text>
          <Text style={styles.tileMonth}>
            {MONTHS_SHORT[selected.getMonth()]}
          </Text>
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {longDayLabel(selected, today)}
          </Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {selectedBusy ? `${relative} · ${selectedBusy}` : relative}
          </Text>
        </View>
        <ChevronDown
          size={20}
          color={open ? colors.heiaInk : colors.textSecondary}
          strokeWidth={2.2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
  },
  summaryOpen: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  summaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  tile: {
    width: 52,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.heiaTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tileDay: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.heiaDeep,
  },
  tileMonth: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.heiaInk,
  },
  summaryText: {
    flex: 1,
    gap: 1,
  },
  summaryTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  summarySub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
