import React from 'react';
import {View, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {radius} from '../theme';

interface HeroSurfaceProps {
  /** Padding/margin/skygge — legges oppå grunnflaten. */
  style?: StyleProp<ViewStyle>;
  /** Banedekoren (de svake sirklene oppe til høyre). */
  arc?: boolean;
  children?: React.ReactNode;
}

/**
 * Hverdagens lyse hero-flate (A v2) — StadiumSurface sin lyse tvilling:
 * mint→krem-gradient (140°, varmt kremdrag nede til høyre) med svak
 * banedekor. Brukes av kalenderkortene og hendelsessidens infokort, så
 * alle flatene kjennes som samme Heia som Hjem-heroen.
 */
export function HeroSurface({style, arc = true, children}: HeroSurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="heroBase" x1="0%" y1="0%" x2="78%" y2="94%">
              <Stop offset="0" stopColor="#DFFBEA" />
              <Stop offset="0.7" stopColor="#F4F9E6" />
              <Stop offset="1" stopColor="#FAF4DC" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroBase)" />
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
    backgroundColor: '#E3F5E9',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#CDEEDA',
    overflow: 'hidden',
  },
  arcOuter: {
    position: 'absolute',
    right: -52,
    top: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 57, 46, 0.08)',
  },
  arcInner: {
    position: 'absolute',
    right: -28,
    top: -36,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 57, 46, 0.06)',
  },
});
