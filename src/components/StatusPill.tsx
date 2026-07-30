import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius} from '../theme';

/**
 * Status-pill (A v2): uttrykker status, type eller viktighet — ikke generell
 * metadata. Fargesemantikken er låst: coral = live, blå = trening/info,
 * lilla = påminnelse, gul = viktig, mint = seier/feiring.
 */
export type PillKind =
  | 'live'
  | 'kamp'
  | 'trening'
  | 'turnering'
  | 'sosialt'
  | 'remind'
  | 'viktig'
  | 'seier'
  | 'neutral';

interface StatusPillProps {
  kind: PillKind;
  label: string;
  withDot?: boolean;
  /** Gjør pillen trykkbar (f.eks. «Viktig ✕» for å løsne en festet post). */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Liten etterfølger, typisk «✕». Vises kun sammen med onPress. */
  suffix?: string;
}

const kindStyles: Record<PillKind, {bg: string; fg: string}> = {
  live: {bg: colors.live, fg: '#FFFFFF'},
  kamp: {bg: colors.liveSoft, fg: colors.liveInk},
  trening: {bg: colors.infoSoft, fg: colors.infoInk},
  // Myk gul — turneringsdagen er en festdag (solid gull er reservert VIKTIG).
  turnering: {bg: colors.sun, fg: colors.goldInk},
  sosialt: {bg: colors.remindSoft, fg: colors.remindInk},
  remind: {bg: colors.remindSoft, fg: colors.remindInk},
  viktig: {bg: colors.gold, fg: colors.goldInk},
  seier: {bg: colors.heiaTint, fg: colors.heiaInk},
  neutral: {bg: colors.surfaceMuted, fg: colors.textSecondary},
};

export function StatusPill({
  kind,
  label,
  withDot = false,
  onPress,
  accessibilityLabel,
  suffix,
}: StatusPillProps) {
  const {bg, fg} = kindStyles[kind];

  const inner = (
    <>
      {withDot && <View style={[styles.dot, {backgroundColor: fg}]} />}
      <Text style={[styles.text, {color: fg}]} numberOfLines={1}>
        {label}
      </Text>
      {onPress && suffix ? (
        <Text style={[styles.suffix, {color: fg}]}>{suffix}</Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={({pressed}) => [
          styles.pill,
          {backgroundColor: bg},
          pressed && styles.pressed,
        ]}>
        {inner}
      </Pressable>
    );
  }

  return <View style={[styles.pill, {backgroundColor: bg}]}>{inner}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  suffix: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
});
