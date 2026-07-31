import React from 'react';
import {View, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, radius} from '../theme';

interface StadiumSurfaceProps {
  /** Padding/gap/radius — legges oppå grunnflaten. */
  style?: StyleProp<ViewStyle>;
  /** Flomlys-glødene (amber + mint) øverst. Av på små flater (chips/striper). */
  flood?: boolean;
  /** Banesirkelen nede til høyre — kampens signatur (Brage 2026-07-31:
      ringen SKAL med på kampflater, også kampkort i lister; den gamle
      «maks ett sted per skjerm»-regelen er opphevet). Av på småflater
      (chips/striper). */
  arc?: boolean;
  /** Kantlinjen (stadiumEdge). Av på chips som skal ligge rett på et kort. */
  bordered?: boolean;
  children?: React.ReactNode;
}

/**
 * Kampens mørke flate (A v2-signaturen), med EKTE gradienter via svg:
 * base = linear 165° #0B1912→#143126, flomlys = to radiale gløder (varm amber
 * oppe til venstre, mint oppe til høyre). Erstatter de lagdelte sirkel-Viewene
 * som sto som placeholder frem til rebuilden — Views kan ikke blurre, svg kan.
 *
 * Gradient-id-ene er trygt gjenbrukbare: hver <Svg> er sitt eget rot-tre, og
 * url(#…) slås alltid opp innenfor samme rot.
 */
export function StadiumSurface({
  style,
  flood = true,
  arc = true,
  bordered = true,
  children,
}: StadiumSurfaceProps) {
  return (
    <View style={[styles.surface, bordered && styles.border, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="base" x1="62%" y1="0%" x2="38%" y2="100%">
              <Stop offset="0" stopColor="#0B1912" />
              <Stop offset="0.78" stopColor="#143126" />
              <Stop offset="1" stopColor="#143126" />
            </LinearGradient>
            <RadialGradient id="floodAmber" cx="18%" cy="-20%" rx="130%" ry="100%">
              <Stop offset="0" stopColor="#FFC53D" stopOpacity={0.13} />
              <Stop offset="0.52" stopColor="#FFC53D" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="floodMint" cx="85%" cy="-10%" rx="120%" ry="90%">
              <Stop offset="0" stopColor="#02FFAB" stopOpacity={0.15} />
              <Stop offset="0.55" stopColor="#02FFAB" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
          {flood && (
            <>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#floodAmber)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#floodMint)" />
            </>
          )}
        </Svg>
      </View>

      {arc && <View style={styles.arcOuter} pointerEvents="none" />}
      {arc && <View style={styles.arcInner} pointerEvents="none" />}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    // Fallback-bunn bak svg-en (synlig et blunk mens svg måles opp).
    backgroundColor: colors.stadium,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1,
    borderColor: colors.stadiumEdge,
  },
  arcOuter: {
    position: 'absolute',
    right: -70,
    bottom: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.13)',
  },
  arcInner: {
    position: 'absolute',
    right: -38,
    bottom: -58,
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.09)',
  },
});
