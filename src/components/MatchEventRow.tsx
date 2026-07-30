import React from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {Ball, Flag, MessageCircle, Pause, Play} from './icons';
import {ScoreChip} from './ScoreChip';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent, MatchEventType} from '../shared/types';

interface MatchEventRowProps {
  event: MatchEvent;
  isLatest?: boolean;
  /** Bilder som hører til nettopp dette øyeblikket — vises under teksten. */
  photos?: MatchPhoto[];
  /** Stillingen etter øyeblikket («2–1») — settes på mål og slutt. */
  score?: string;
  onPressPhoto?: (photo: MatchPhoto) => void;
}

// MÅ stå FØR eventIcons — JSX-en under evalueres i det modulen lastes.
const glyphStyles = StyleSheet.create({
  glyph: {fontSize: 14},
});

// Lucide-ikoner, blekket i flatens ink-farge. `bytte`/`kort` lages ikke av
// appen ennå og beholder tegn-glyfene sine til de får et ordentlig øyeblikk.
const eventIcons: Record<MatchEventType, React.ReactNode> = {
  avspark: <Ball size={16} color={colors.heiaInk} />,
  mål: <Ball size={16} color={colors.heiaInk} />,
  pause: <Pause size={15} color={colors.textSecondary} />,
  andre_omgang: <Play size={15} color={colors.heiaInk} />,
  slutt: <Flag size={15} color={colors.textSecondary} />,
  bytte: <Text style={glyphStyles.glyph}>↔</Text>,
  kort: <Text style={glyphStyles.glyph}>🟨</Text>,
  melding: <MessageCircle size={15} color={colors.textSecondary} />,
};

// A v2: mål/avspark/fortsettelse feires på mint-tint (grønt = feiring, aldri
// coral), kort på solskinnsflate, resten dempet. Myke flater bak ikonet leses
// bedre enn solide sirkler.
const eventColors: Record<MatchEventType, string> = {
  avspark: colors.heiaTint,
  mål: colors.heiaTint,
  pause: colors.surfaceMuted,
  andre_omgang: colors.heiaTint,
  slutt: colors.surfaceMuted,
  bytte: colors.surfaceMuted,
  kort: colors.sun,
  melding: colors.surfaceMuted,
};

export function MatchEventRow({
  event,
  isLatest = false,
  photos,
  score,
  onPressPhoto,
}: MatchEventRowProps) {
  const icon = eventIcons[event.type];
  const iconColor = eventColors[event.type];

  return (
    <View style={[styles.container, isLatest && styles.latest]}>
      <View style={styles.timeline}>
        <View style={[styles.iconCircle, {backgroundColor: iconColor}]}>
          {icon}
        </View>
        <View style={styles.line} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.minute}>{event.minute}'</Text>
          {event.player && (
            <Text style={styles.player}>{event.player}</Text>
          )}
          {/* Stillingen etter øyeblikket — kampens dramaturgi leses i
              høyremargen. Mørk chip: kampen bor alltid på mørk flate. */}
          {score && (
            <View style={styles.scoreWrap}>
              <ScoreChip score={score} />
            </View>
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
    fontSize: 16,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  player: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  // Stillingen skyves til høyremargen — kolonnen med tall leses vertikalt.
  scoreWrap: {
    marginLeft: 'auto',
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
