import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {MediaImage} from '../lib/media/MediaImage';
import {
  ArrowLeftRight,
  Ball,
  BookingCard,
  Flag,
  MessageCircle,
  Pause,
  Play,
} from './icons';
import {ScoreChip} from './ScoreChip';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent} from '../shared/types';

interface MatchEventRowProps {
  event: MatchEvent;
  isLatest?: boolean;
  /** Bilder som hører til nettopp dette øyeblikket — vises under teksten. */
  photos?: MatchPhoto[];
  /** Stillingen etter øyeblikket («2–1») — settes på mål og slutt. */
  score?: string;
  onPressPhoto?: (photo: MatchPhoto) => void;
}

interface Marker {
  icon: React.ReactNode;
  bg: string;
  /** Liten gulldetalj på sirkelen — kun mål for oss (feiring: grønt/gult). */
  goldDot?: boolean;
}

// P5-skannbarhet: ballen betyr MÅL og ingenting annet, og kun mål for OSS
// feires (mint + gulldetalj). Mål imot er informasjon — dempet nøytral, aldri
// coral (låst: coral = live-status; «ingen TAP-roping»). Avspark/fortsettelse
// er spillet i gang (nøytral pil, ikke feiring), slutt lukker kampen på
// stadion-mørk markør.
function markerFor(event: MatchEvent): Marker {
  switch (event.type) {
    case 'mål':
      // teamSide mangler (skal ikke skje etter 00020) → dempet som mål imot:
      // bedre å underfeire eget mål enn å feire motstanderens.
      return event.teamSide === 'home'
        ? {
            icon: <Ball size={16} color={colors.heiaInk} />,
            bg: colors.heiaTint,
            goldDot: true,
          }
        : {
            icon: <Ball size={16} color={colors.textSecondary} />,
            bg: colors.surfaceMuted,
          };
    case 'avspark':
    case 'andre_omgang':
      return {
        icon: <Play size={15} color={colors.textSecondary} />,
        bg: colors.surfaceMuted,
      };
    case 'pause':
      return {
        icon: <Pause size={15} color={colors.textSecondary} />,
        bg: colors.surfaceMuted,
      };
    case 'slutt':
      return {
        icon: <Flag size={15} color={colors.stadiumText} />,
        bg: colors.stadium,
      };
    case 'bytte':
      return {
        icon: <ArrowLeftRight size={15} color={colors.textSecondary} />,
        bg: colors.surfaceMuted,
      };
    case 'kort':
      return {icon: <BookingCard size={16} />, bg: colors.sun};
    case 'melding':
      return {
        icon: <MessageCircle size={15} color={colors.textSecondary} />,
        bg: colors.surfaceMuted,
      };
  }
}

export function MatchEventRow({
  event,
  isLatest = false,
  photos,
  score,
  onPressPhoto,
}: MatchEventRowProps) {
  const marker = markerFor(event);

  return (
    <View style={[styles.container, isLatest && styles.latest]}>
      <View style={styles.timeline}>
        <View>
          <View style={[styles.iconCircle, {backgroundColor: marker.bg}]}>
            {marker.icon}
          </View>
          {marker.goldDot && <View style={styles.goldDot} />}
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
            {/* Thumb her også (B2): samme forhåndsvisningsflate som resten
                av forløpet — display bor i galleriet. */}
            <MediaImage
              media={photo.media}
              variant="thumb"
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
  // Gulldetaljen på mål for oss — hvit kant løfter den av mint-sirkelen.
  goldDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.surface,
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
