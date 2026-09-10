import React, {useMemo} from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {matchColors} from '../../theme';
import {floodCap} from '../../shared/teamColors';

/**
 * GRUNNEN — kampens dagslys, statuslinje til tab-bar.
 *
 * ---------------------------------------------------------------------------
 * RUNDE 2 (2026-09-07): KAMPEN ER LYS.
 *
 * Retningen fra Brage: «litt mørkere enn Hjem, akkurat nok til at overgangen
 * føles som "nå er det kamp"». Grunnen er én rolig mintgradient med to skrå,
 * myke lysstreker — et hint av flomlys. Ingen konkurrerende lysfelt, ingen
 * røyk, ingen baneringer. Det mørke rommet fra skive 2 (groundTop/Mid/Low,
 * lagfarge- og motstanderlys, gress og kritt) er borte fra kampsiden;
 * tokenene står igjen fordi scorekortet og den kompakte scorelinja fortsatt
 * er mørkt glass og bruker `matchColors.text`/`dim` som blekk.
 *
 * ⚠️ LAGFARGEN RØRER ALDRI GRUNNEN. Den finnes bare som lys i scorekortet og
 * som flod i måløyeblikket — samme regel som før (rødt lag blir aldri brunt).
 *
 * ⚠️ INGEN LØPENDE BEVEGELSE. Det eneste som beveger seg er målfloden, en
 * ren `opacity`-interpolasjon på native driver.
 */

export type GroundPhase = 'live' | 'paused' | 'finished' | 'cancelled';

/**
 * Kampens tilstand demper flomlyset litt: en ferdig kamp er rolig, men ikke
 * slukket — rapporten bor på samme grunn.
 */
const STREAK: Record<GroundPhase, number> = {
  live: 1,
  paused: 0.8,
  finished: 0.7,
  cancelled: 0.4,
};

interface MatchGroundProps {
  /** Lagets farge — brukes KUN av målfloden. */
  teamColor: string;
  phase: GroundPhase;
  /**
   * Måløyeblikket, 0→1 (fra `useGoalMoment`). Driver FLODEN: lagets lys
   * skyller over hele verdenen og trekker seg tilbake.
   */
  celebrate?: Animated.Value;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function MatchGround({
  teamColor,
  phase,
  celebrate,
  style,
  children,
}: MatchGroundProps) {
  const streak = STREAK[phase];
  // På den lyse grunnen er floden et kortere, mykere blink: halve toppen.
  const flood = useMemo(() => floodCap(teamColor).peak * 0.55, [teamColor]);
  const floodOpacity = useMemo(
    () =>
      celebrate?.interpolate({
        inputRange: [0, 1],
        outputRange: [0, flood],
      }),
    [celebrate, flood],
  );

  return (
    <View style={[styles.root, style]}>
      {/* ATMOSFÆRE, IKKE INNHOLD — skjult for skjermleser. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="dBase" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0" stopColor={matchColors.dayTop} />
              <Stop offset="0.42" stopColor={matchColors.dayMid} />
              <Stop offset="1" stopColor={matchColors.dayLow} />
            </LinearGradient>
            {/* Flomlyset: to skrå streker, øverst til høyre og midt på. */}
            <LinearGradient id="dStreakA" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop
                offset="0.62"
                stopColor="#FFFFFF"
                stopOpacity={0.13 * streak}
              />
              <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="dStreakB" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0.2" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop
                offset="0.3"
                stopColor="#FFFFFF"
                stopOpacity={0.08 * streak}
              />
              <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#dBase)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#dStreakA)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#dStreakB)" />
        </Svg>
      </View>

      {/* MÅLFLODEN. Ligger over verdenen, under innholdet. */}
      {floodOpacity && (
        <Animated.View
          style={[StyleSheet.absoluteFill, {opacity: floodOpacity}]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="gFlood" cx="50%" cy="38%" rx="122%" ry="88%">
                <Stop offset="0" stopColor={teamColor} stopOpacity={1} />
                <Stop offset="0.74" stopColor={teamColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#gFlood)" />
          </Svg>
        </Animated.View>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: matchColors.dayMid,
    overflow: 'hidden',
  },
});
