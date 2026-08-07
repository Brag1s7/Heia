import React, {useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  AccessibilityInfo,
  type ViewStyle,
} from 'react-native';
import {colors, typography, spacing, radius, fonts} from '../../theme';
import {ChevronLeft, ChevronRight} from '../icons';
import {DayCell} from './DayCell';
import {
  WEEKDAY_INITIALS,
  addMonths,
  busyLabel,
  dayCellLabel,
  dayDiff,
  dayKey,
  isSameDay,
  monthGridWeeks,
  monthTitle,
  type BusyDays,
} from '../../shared/calendar';
import type {EventType} from '../../shared/types';

export interface MonthGridProps {
  /** Måneden som vises. Bare år og måned leses. */
  view: Date;
  onChangeView: (next: Date) => void;
  selected: Date;
  today: Date;
  onSelect: (day: Date) => void;
  /** Dagene det er noe på. Prikkenes kilde. */
  busy?: BusyDays;
  /** Tidligste lovlige dag. Uten den er fortiden åpen (Kalender-fanen). */
  minDay?: Date;
  /** Seneste lovlige dag. */
  maxDay?: Date;
  /**
   * VoiceOver-tillegget etter datoen. Standard er datovelgerens
   * kollisjonsspråk («Kamp samme dag»); Kalender sender inn sitt eget
   * innholdsspråk («én kamp»).
   */
  describeDay?: (day: Date, types: EventType[]) => string | null;
  disabled?: boolean;
  /** `card` = skjemaets hvite ramme. `plain` = flat, som på Kalender-fanen. */
  variant?: 'card' | 'plain';
  /** Fotnoten under rutenettet. Kun skjemaet har en. */
  footer?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Månedsrutenettet — ETT bygg, to bruksmåter.
 *
 * Datovelgeren i «Opprett hendelse» bruker det til å velge ÉN verdi, med
 * grenser og en fotnote. Kalender-fanen bruker det til å navigere: ingen
 * grenser, fortiden er synlig, og et trykk ruller agendaen til datoen.
 * Forskjellen er props — ikke to implementasjoner av samme matte.
 *
 * Datomatten selv (`monthGrid`, mandag først, alltid seks uker, norske navn)
 * bor i `shared/calendar.ts` og er testet der.
 */
export function MonthGrid({
  view,
  onChangeView,
  selected,
  today,
  onSelect,
  busy,
  minDay,
  maxDay,
  describeDay,
  disabled = false,
  variant = 'card',
  footer,
  style,
}: MonthGridProps) {
  // Alltid seks rader. Se `monthGrid` for hvorfor: et rutenett som veksler
  // mellom fem og seks rader endrer høyde når man blar, og da hopper alt
  // under det.
  const weeks = useMemo(
    () => monthGridWeeks(view.getFullYear(), view.getMonth()),
    [view],
  );

  // Månedspilene stopper der dagene stopper — ikke én måned senere.
  const minView = minDay
    ? new Date(minDay.getFullYear(), minDay.getMonth(), 1)
    : null;
  const maxView = maxDay
    ? new Date(maxDay.getFullYear(), maxDay.getMonth(), 1)
    : null;
  const canGoBack = minView === null || view > minView;
  const canGoForward = maxView === null || view < maxView;

  const describe = useCallback(
    (day: Date, types: EventType[]) =>
      describeDay ? describeDay(day, types) : busyLabel(types),
    [describeDay],
  );

  // Månedsbyttet må SIES. `accessibilityLiveRegion` er Android-only, så på
  // iOS var den stum: rutenettet byttet innhold uten at VoiceOver nevnte det.
  const goToMonth = useCallback(
    (next: Date) => {
      onChangeView(next);
      AccessibilityInfo.announceForAccessibility(monthTitle(next));
    },
    [onChangeView],
  );

  return (
    <View style={[variant === 'card' ? styles.card : styles.plain, style]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => goToMonth(addMonths(view, -1))}
          disabled={!canGoBack || disabled}
          accessibilityRole="button"
          accessibilityLabel="Forrige måned"
          accessibilityState={{disabled: !canGoBack}}
          style={({pressed}) => [
            styles.navButton,
            !canGoBack && styles.navDisabled,
            pressed && canGoBack && styles.navPressed,
          ]}>
          <ChevronLeft size={18} color={colors.textPrimary} strokeWidth={2.4} />
        </Pressable>

        <Text style={styles.title} accessibilityRole="header">
          {monthTitle(view)}
        </Text>

        <Pressable
          onPress={() => goToMonth(addMonths(view, 1))}
          disabled={!canGoForward || disabled}
          accessibilityRole="button"
          accessibilityLabel="Neste måned"
          accessibilityState={{disabled: !canGoForward}}
          style={({pressed}) => [
            styles.navButton,
            !canGoForward && styles.navDisabled,
            pressed && canGoForward && styles.navPressed,
          ]}>
          <ChevronRight size={18} color={colors.textPrimary} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Kolonnetitlene leses ikke opp: hver celle sier selv hvilken ukedag
          den er, og VoiceOver ville ellers ramset opp «Ma Ti On …» først. */}
      <View style={styles.weekRow} accessibilityElementsHidden>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <Text
            key={initial}
            style={[styles.weekday, index >= 5 && styles.weekdayWeekend]}
            maxFontSizeMultiplier={1.4}>
            {initial}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map(({date, inMonth}) => {
            const types = busy?.[dayKey(date)] ?? [];
            const outOfRange =
              (minDay !== undefined && dayDiff(date, minDay) < 0) ||
              (maxDay !== undefined && dayDiff(date, maxDay) > 0);

            return (
              <DayCell
                key={dayKey(date)}
                day={date}
                selected={isSameDay(date, selected)}
                isToday={isSameDay(date, today)}
                types={types}
                outOfRange={outOfRange}
                outsideMonth={!inMonth}
                disabled={disabled}
                onPress={onSelect}
                accessibilityLabel={dayCellLabel(
                  date,
                  today,
                  describe(date, types),
                )}
              />
            );
          })}
        </View>
      ))}

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  // Kalender-fanen: rutenettet ligger rett på bakgrunnen. Et hvitt kort her
  // ville lest som «admin» (låst designregel).
  plain: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textPrimary,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  navDisabled: {
    opacity: 0.32,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.textTertiary,
    paddingBottom: spacing.xs,
  },
  weekdayWeekend: {
    opacity: 0.6,
  },
});

/** Fotnoten under datovelgerens rutenett. Beholdt her for én kilde til stil. */
export const monthGridFootNote = StyleSheet.create({
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing.xs,
  },
}).text;
