import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius, fonts} from '../../theme';
import type {EventType} from '../../shared/types';

/**
 * Prikkefargene speiler StatusPill: blå trening, coral kamp, lilla sosialt,
 * gull turnering. Turneringen får `goldInk` og ikke `gold` — en 5 px prikk i
 * #FFC53D forsvinner på hvitt.
 */
export const DOT_COLOR: Record<EventType, string> = {
  trening: colors.treningText,
  kamp: colors.kampText,
  turnering: colors.goldInk,
  sosialt: colors.sosialtText,
  annet: colors.textTertiary,
};

/** Prikker det er plass til før det blir grøt. Resten telles i «+N». */
const MAX_DOTS = 3;

interface DayCellProps {
  day: Date;
  selected: boolean;
  isToday: boolean;
  /** Typene dagen har noe av. Rekkefølgen er prikkenes rekkefølge. */
  types?: EventType[];
  /** Utenfor lovlig område — kun skjemaet setter grenser. */
  outOfRange?: boolean;
  /**
   * Nabomånedens dag i et seksukers rutenett. Den tar samme plass som alle
   * andre celler (det er hele poenget), men skal leses som bakgrunn.
   */
  outsideMonth?: boolean;
  disabled?: boolean;
  /** «man» over tallet. Kun ukestripa; månedsrutenettet har kolonnetitler. */
  weekday?: string;
  /** Lørdag/søndag: dempet ukedagstekst, aldri rød søndag. */
  weekend?: boolean;
  onPress: (day: Date) => void;
  accessibilityLabel: string;
}

/**
 * Én dag i kalenderen — den SAMME cellen i datovelgeren og på Kalender-fanen.
 *
 * Alle tilstandene bor her, og bare her: valgt (mintfyll + mintramme +
 * heiaInk), i dag (typografisk tyngde og heiaInk — ingen ekstra ring, ingen ny
 * farge), helg (dempet ukedagstekst), utenfor rekkevidde (blass).
 *
 * Høyden er `minHeight`, aldri `height`: med forstørret skrift skal cellen
 * vokse, ikke klippe tallet.
 */
export function DayCell({
  day,
  selected,
  isToday,
  types,
  outOfRange = false,
  outsideMonth = false,
  disabled = false,
  weekday,
  weekend = false,
  onPress,
  accessibilityLabel,
}: DayCellProps) {
  const marks = types ?? [];
  const extra = marks.length - MAX_DOTS;

  return (
    <Pressable
      onPress={() => onPress(day)}
      disabled={outOfRange || disabled}
      accessibilityRole="button"
      accessibilityState={{selected, disabled: outOfRange || disabled}}
      accessibilityLabel={accessibilityLabel}
      style={({pressed}) => [
        styles.cell,
        selected && styles.cellSelected,
        pressed && !selected && !outOfRange && styles.cellPressed,
      ]}>
      {weekday !== undefined && (
        <Text
          style={[
            styles.weekday,
            weekend && styles.weekdayWeekend,
            selected && styles.weekdaySelected,
          ]}
          maxFontSizeMultiplier={1.4}>
          {weekday}
        </Text>
      )}

      <Text
        style={[
          styles.number,
          // Dempingen først, så «i dag» og «valgt» fortsatt vinner over den.
          outsideMonth && styles.numberOutside,
          isToday && styles.numberToday,
          selected && styles.numberSelected,
          outOfRange && styles.numberOut,
        ]}
        maxFontSizeMultiplier={1.6}>
        {day.getDate()}
      </Text>

      {/* Fast høyde: dager med og uten prikk må stå på samme linje, ellers
          hopper tallrekka. Antallet leses uansett opp av VoiceOver. */}
      <View style={styles.dots}>
        {marks.slice(0, MAX_DOTS).map((type, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {backgroundColor: DOT_COLOR[type]},
              (outOfRange || outsideMonth) && styles.dotOut,
            ]}
          />
        ))}
        {extra > 0 && (
          <Text style={styles.dotOverflow} allowFontScaling={false}>
            +{extra}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    // 44 pt er Apples minste trykkflate. `minHeight`, ikke `height` — cellen
    // skal vokse med forstørret skrift, ikke klippe den.
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
  },
  cellSelected: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  cellPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  weekday: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
    color: colors.textSecondary,
  },
  // Norske kalendere har røde søndager. Coral er låst til live-status i Heia,
  // så helgen dempes i stedet — en rød søndag ville løyet om semantikken.
  weekdayWeekend: {
    opacity: 0.55,
  },
  weekdaySelected: {
    color: colors.heiaInk,
    opacity: 1,
  },
  number: {
    fontFamily: fonts.display,
    fontSize: 16.5,
    color: colors.textPrimary,
  },
  // I dag uten å være valgt: merkevaregrønn tekst. Ingen ring, ingen ny farge
  // — tyngden i displayfonten er markeringen.
  numberToday: {
    color: colors.heiaInk,
  },
  numberSelected: {
    color: colors.heiaInk,
  },
  // Nabomånedens dag: samme plass, tydelig bakgrunn. Rekkefølgen i style-
  // lista gjør at valgt og i dag fortsatt vinner over dempingen.
  numberOutside: {
    color: colors.textTertiary,
  },
  numberOut: {
    color: colors.textTertiary,
    opacity: 0.5,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
  },
  dotOut: {
    opacity: 0.35,
  },
  // Vises først ved fire ulike typer samme dag. Skalerer ikke med skriften:
  // den ville sprengt prikkeraden, og tallet står uansett i VoiceOver-teksten.
  dotOverflow: {
    fontSize: 8.5,
    lineHeight: 9,
    fontWeight: '800',
    color: colors.textTertiary,
  },
});
