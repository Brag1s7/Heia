import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {colors, spacing, radius} from '../theme';
import {useReducedMotion} from './useReducedMotion';

interface LiveBadgeProps {
  /** I pause slutter prikken å pulsere og merket sier «PAUSE» i gult. */
  paused?: boolean;
}

export function LiveBadge({paused}: LiveBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ⚠️ REDUCE MOTION (skive 6). Prikken slutter å puste, men merket blir
  // stående i coral og sier fortsatt LIVE: bevegelsen er det som fjernes,
  // ikke statusen. Betydningen ligger i fargen og ordet, aldri i pulsen —
  // ellers ville merket vært utilgjengelig for alle som ikke ser bevegelse.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Ingen puls i pause — en stillestående prikk signaliserer «stoppet».
    //
    // ⚠️ EN LØPENDE `Animated.loop` DØR IKKE AV SEG SELV. Slås innstillingen
    // på mens sløyfa går, kjører den videre usynlig for koden og etterlater
    // prikken på en tilfeldig skala når den stoppes. `stopAnimation()` +
    // eksplisitt sluttverdi, i den rekkefølgen.
    if (paused || reducedMotion) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, paused, reducedMotion]);

  return (
    <View
      // Ett stopp, én betydning: merket ER statusen. Uten labelen leser
      // VoiceOver bare ordet «LIVE», som ikke sier hva det gjelder.
      accessible
      accessibilityLabel={paused ? 'Pause i kampen' : 'Kampen sendes direkte'}
      style={[styles.container, paused && styles.containerPaused]}>
      <Animated.View
        style={[
          styles.dot,
          paused && styles.dotPaused,
          {transform: [{scale: pulseAnim}]},
        ]}
      />
      <Text style={[styles.text, paused && styles.textPaused]}>
        {paused ? 'PAUSE' : 'LIVE'}
      </Text>
    </View>
  );
}

// A v2: coral eier live-status — solid fylt pill som leses på både lys og
// mørk (stadion) flate. Pause = gul, stillestående.
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.live,
    alignSelf: 'flex-start',
  },
  containerPaused: {
    backgroundColor: colors.gold,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  dotPaused: {
    backgroundColor: colors.goldInk,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  textPaused: {
    color: colors.goldInk,
  },
});
