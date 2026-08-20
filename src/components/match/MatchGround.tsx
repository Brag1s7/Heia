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
 * GRUNNEN — kampverdenens bunn, statuslinje til tab-bar.
 *
 * Den frosne retningen: «Hele skjermen er grønn. Ingen hvit eller creamfarget
 * flate. Tre grønne rom, skilt av TONE OG LYS — aldri av bokser eller rammer.»
 * Denne komponenten er det nederste av de lagene: alt annet i kampen ligger
 * OPPÅ den, uten egen bunnfarge.
 *
 * ---------------------------------------------------------------------------
 * LAGENE (prototypens `.ground`, oversatt lag for lag)
 *
 *   base    linear 172° groundTop → groundMid (46 %) → groundLow
 *   warm    gull oppe til venstre       — flomlyset
 *   heia    mint oppe til høyre         — flomlyset
 *   team    lagets lys, venstre skulder
 *   opp     motstanderens skifer, høyre skulder
 *   grass   mint nedenfra               — gresset som fanger lyset
 *   kritt   midtlinje + to banebuer nede til høyre
 *
 * ⚠️ LAGFARGEN RØRER ALDRI GRUNNEN — den legges bare som LYS OPPÅ. Det er dét
 * som gjør at et rødt lag aldri blir brunt: ingen tekst står noen gang på en
 * flate der lagfargen er blandet INN i grunnfargen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ INGEN LØPENDE BEVEGELSE HER ENNÅ. Prototypens pustende `g-pulse-a/b`,
 * bølgen og aurora hører til skive 5/6, sammen med `useReducedMotion`. Det
 * eneste som beveger seg i skive 2 er målfloden, og den er en ren
 * `opacity`-interpolasjon på native driver — samme kontrakt som resten av
 * appen (ingen reanimated).
 */

export type GroundPhase = 'live' | 'paused' | 'finished' | 'cancelled';

/**
 * Kampens tilstand demper verdenen. Tallene er prototypens `.half`/`.cancelled`
 * -overstyringer, uttrykt som faktor av live-styrken så det er ÉN kilde per lag.
 */
const PHASE: Record<
  GroundPhase,
  {heia: number; team: number; opp: number; grass: number}
> = {
  live: {heia: 0.2, team: 0.34, opp: 0.24, grass: 0.18},
  paused: {heia: 0.09, team: 0.13, opp: 0.13, grass: 0.09},
  // Ferdig kamp: rolig, men ikke slukket — rapporten bor på samme grunn
  // (skive 3), og en slukket verden ville gjort den til en arkivside.
  finished: {heia: 0.13, team: 0.2, opp: 0.16, grass: 0.12},
  cancelled: {heia: 0.04, team: 0.07, opp: 0.07, grass: 0.05},
};

interface MatchGroundProps {
  /** Lagets farge — lyset i venstre skulder. */
  teamColor: string;
  phase: GroundPhase;
  /**
   * Måløyeblikket, 0→1 (fra `useGoalMoment`). Driver FLODEN: lagets lys og
   * mint skyller over hele verdenen og trekker seg tilbake.
   *
   * Floden bor her, ikke i arenaen. Prototypen legger den på `.ground`, og
   * grunnen er også det eneste stedet den KAN ligge uten å tegne et firkantet
   * blink over arenaens buede underkant.
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
  const p = PHASE[phase];

  // Klemmen på flodens styrke er avledet av lagfargen, aldri hardkodet — se
  // floodCap(). Stillingen er det eneste som må overleve floden, og den er
  // stor tekst (3:1).
  const flood = useMemo(() => floodCap(teamColor).peak, [teamColor]);
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
      {/* ATMOSFÆRE, IKKE INNHOLD. Hele grunnen skjules for skjermleser —
          uten dette ville VoiceOver stoppet på en flate uten betydning før
          den nådde stillingen. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="gBase" x1="52%" y1="0%" x2="48%" y2="100%">
              <Stop offset="0" stopColor={matchColors.groundTop} />
              <Stop offset="0.46" stopColor={matchColors.groundMid} />
              <Stop offset="1" stopColor={matchColors.groundLow} />
            </LinearGradient>
            <RadialGradient id="gWarm" cx="12%" cy="-12%" rx="108%" ry="56%">
              <Stop offset="0" stopColor="#FFC53D" stopOpacity={0.12} />
              <Stop offset="0.5" stopColor="#FFC53D" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="gHeia" cx="80%" cy="-8%" rx="122%" ry="62%">
              <Stop offset="0" stopColor="#02FFAB" stopOpacity={p.heia} />
              <Stop offset="0.54" stopColor="#02FFAB" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="gTeam" cx="14%" cy="22%" rx="54%" ry="26%">
              <Stop offset="0" stopColor={teamColor} stopOpacity={p.team} />
              <Stop offset="0.62" stopColor={teamColor} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="gOpp" cx="87%" cy="22%" rx="48%" ry="24%">
              <Stop
                offset="0"
                stopColor={matchColors.opponent}
                stopOpacity={p.opp}
              />
              <Stop
                offset="0.62"
                stopColor={matchColors.opponent}
                stopOpacity={0}
              />
            </RadialGradient>
            <RadialGradient id="gGrass" cx="50%" cy="114%" rx="150%" ry="52%">
              <Stop offset="0" stopColor="#02FFAB" stopOpacity={p.grass} />
              <Stop offset="0.6" stopColor="#02FFAB" stopOpacity={0} />
            </RadialGradient>
            {/* Midtlinja: kritt, men i mint — den er banen, ikke tekst. */}
            <LinearGradient id="gHalf" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor="#02FFAB" stopOpacity={0} />
              <Stop offset="0.44" stopColor="#02FFAB" stopOpacity={0.13} />
              <Stop offset="1" stopColor="#02FFAB" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gBase)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gWarm)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gHeia)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gTeam)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gOpp)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gGrass)" />
          <Rect x="-70" y="250" width="580" height="1" fill="url(#gHalf)" />
        </Svg>

        {/* Banebuene nede til høyre — samme signatur som StadiumSurface, i
            hele verdenens skala. Views, ikke svg: en sirkel med kant er
            billigere som View, og den skal ikke gradieres. */}
        <View style={styles.arcOuter} />
        <View style={styles.arcInner} />
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
              <LinearGradient id="gFloodTop" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor={teamColor} stopOpacity={1} />
                <Stop offset="0.88" stopColor={teamColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#gFlood)" />
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#gFloodTop)"
            />
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
    // Fallback-bunn bak svg-en (synlig et blunk mens den måles opp) — og
    // vaktposten mot at noe krem lyser gjennom i kantene under push.
    backgroundColor: matchColors.groundTop,
    overflow: 'hidden',
  },
  arcOuter: {
    position: 'absolute',
    right: -80,
    bottom: -140,
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.10)',
  },
  arcInner: {
    position: 'absolute',
    right: -30,
    bottom: -84,
    width: 254,
    height: 254,
    borderRadius: 127,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.07)',
  },
});
