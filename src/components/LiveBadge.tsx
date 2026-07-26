import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignSelf: 'flex-start',
  },
  containerPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  dotPaused: {
    backgroundColor: colors.warning,
  },
  text: {
    ...typography.label,
    fontSize: 11,
    color: colors.error,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  textPaused: {
    color: colors.warning,
  },
});
