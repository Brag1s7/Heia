import React from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent, MatchEventType} from '../shared/types';

interface MatchEventRowProps {
  event: MatchEvent;
  isLatest?: boolean;
  /** Bilder som hører til nettopp dette øyeblikket — vises under teksten. */
  photos?: MatchPhoto[];
  onPressPhoto?: (photo: MatchPhoto) => void;
}

const eventIcons: Record<MatchEventType, string> = {
  avspark: '⚽',
  mål: '⚽',
  pause: '⏸',
  andre_omgang: '▶',
  slutt: '🏁',
  bytte: '↔',
  kort: '🟨',
  melding: '💬',
};

const eventColors: Record<MatchEventType, string> = {
  avspark: colors.heia,
  mål: colors.heia,
  pause: colors.textTertiary,
  andre_omgang: colors.success,
  slutt: colors.textSecondary,
  bytte: colors.textSecondary,
  kort: colors.warning,
  melding: colors.textTertiary,
};

export function MatchEventRow({
  event,
  isLatest = false,
  photos,
  onPressPhoto,
}: MatchEventRowProps) {
  const icon = eventIcons[event.type];
  const iconColor = eventColors[event.type];

  return (
    <View style={[styles.container, isLatest && styles.latest]}>
      <View style={styles.timeline}>
        <View style={[styles.iconCircle, {backgroundColor: iconColor}]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.line} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.minute}>{event.minute}'</Text>
          {event.player && (
            <Text style={styles.player}>{event.player}</Text>
          )}
        </View>
        <Text style={styles.description}>{event.description}</Text>

        {photos?.map(photo => (
          <Pressable
            key={photo.id}
            onPress={onPressPhoto ? () => onPressPhoto(photo) : undefined}
            style={({pressed}) => [styles.photo, pressed && styles.photoPressed]}>
            <Image
              source={{uri: photo.imageUrl}}
              style={styles.photoImage}
              resizeMode="cover"
            />
            {photo.caption && (
              <Text style={styles.photoCaption}>{photo.caption}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  latest: {
    backgroundColor: colors.heiaSoft,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  timeline: {
    alignItems: 'center',
    width: 32,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  minute: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  player: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  description: {
    ...typography.body,
    lineHeight: 22,
  },
  photo: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPressed: {
    opacity: 0.8,
  },
  photoImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.background,
  },
  photoCaption: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
