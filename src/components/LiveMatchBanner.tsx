import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import type {HeiaEvent} from '../shared/types';

interface LiveMatchBannerProps {
  event: HeiaEvent;
  onPress: () => void;
}

export function LiveMatchBanner({event, onPress}: LiveMatchBannerProps) {
  // Pause er også «pågående» — kampen er ikke over, klokka står bare stille.
  const isUnderway =
    event.matchStatus === 'live' || event.matchStatus === 'halfTime';
  if (!event.score || !event.opponent || !isUnderway) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.banner, pressed && styles.pressed]}>
      <LiveBadge paused={event.matchStatus === 'halfTime'} />

      <View style={styles.matchInfo}>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>
            {event.score.home} – {event.score.away}
          </Text>
        </View>
        {event.location && (
          <Text style={styles.location}>{event.location}</Text>
        )}
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.heia,
    ...shadows.elevated,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
  },
  matchInfo: {
    gap: spacing.xs,
  },
  title: {
    ...typography.heading3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  score: {
    ...typography.heading1,
    fontSize: 36,
    color: colors.heia,
  },
  location: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  arrow: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
    fontSize: 28,
    color: colors.textTertiary,
  },
});
