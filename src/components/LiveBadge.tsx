import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {colors, spacing, radius} from '../theme';

interface LiveBadgeProps {
  /** I pause slutter prikken å pulsere og merket sier «PAUSE» i gult. */
  paused?: boolean;
}

export function LiveBadge({paused}: LiveBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ingen puls i pause — en stillestående prikk signaliserer «stoppet».
    if (paused) {
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
  }, [pulseAnim, paused]);

  return (
    <View style={[styles.container, paused && styles.containerPaused]}>
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
