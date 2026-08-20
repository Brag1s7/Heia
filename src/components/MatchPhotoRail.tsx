import React, {useCallback} from 'react';
import {View, Text, Pressable, FlatList, StyleSheet} from 'react-native';
import {colors, matchColors, typography, spacing, radius} from '../theme';
import {MediaImage} from '../lib/media/MediaImage';
import type {MatchPhoto} from '../lib/api/feed';

interface MatchPhotoRailProps {
  photos: MatchPhoto[];
  onPressPhoto: (photo: MatchPhoto) => void;
  /**
   * ⚠️ VARIANT, IKKE ENDRET DEFAULT. Stripa står i dag på appens lyse flate.
   * Når rapporten flytter ned på grunnen (skive 3) må overskriften og
   * lasteplatene følge med, ellers blir de to hvite flekker på grønt.
   */
  variant?: 'default' | 'match';
}

const photoKeyExtractor = (photo: MatchPhoto) => photo.id;

// Gapet bor i separatoren, ikke i contentContainer-gap (B2): virtualiserte
// celler + container-gap gir små offsetfeil når celler av- og påmonteres.
const ThumbGap = () => <View style={styles.thumbGap} />;

/**
 * Kompakt inngang til kampens bilder — kun på ferdigspilte kamper.
 *
 * Under kampen ville den konkurrert med stillingen og kampforløpet, som er
 * det man er der for. Etterpå snur det: da er bildene det man kom tilbake
 * for, mens forløpet er konteksten. Bildene blir uansett stående i forløpet.
 *
 * FlatList med windowSize 3 (B2): en kamp med mange bilder laster bare de
 * synlige thumbene (+ ett viewport hver vei), ikke hele railen ved mount.
 */
export function MatchPhotoRail({
  photos,
  onPressPhoto,
  variant = 'default',
}: MatchPhotoRailProps) {
  const onMatch = variant === 'match';
  const renderThumb = useCallback(
    ({item, index}: {item: MatchPhoto; index: number}) => (
      <Pressable
        onPress={() => onPressPhoto(item)}
        accessibilityRole="imagebutton"
        accessibilityLabel={
          item.caption
            ? `Kampbilde ${index + 1}. ${item.caption}`
            : `Kampbilde ${index + 1}`
        }
        style={({pressed}) => [
          styles.thumb,
          onMatch && styles.thumbMatch,
          pressed && styles.pressed,
        ]}>
        {/* 96 pt-rute → thumb-varianten (480 px holder i massevis). */}
        <MediaImage
          media={item.media}
          variant="thumb"
          style={[styles.thumbImage, onMatch && styles.thumbImageMatch]}
          resizeMode="cover"
        />
      </Pressable>
    ),
    [onPressPhoto, onMatch],
  );

  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, onMatch && styles.titleMatch]}>
          Kampbilder
        </Text>
        <Text style={[styles.count, onMatch && styles.countMatch]}>
          {photos.length === 1 ? '1 bilde' : `${photos.length} bilder`}
        </Text>
      </View>
      <FlatList
        data={photos}
        renderItem={renderThumb}
        keyExtractor={photoKeyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        ItemSeparatorComponent={ThumbGap}
        windowSize={3}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.heading3,
  },
  titleMatch: {
    color: matchColors.text,
  },
  count: {
    ...typography.caption,
  },
  countMatch: {
    color: matchColors.dim,
  },
  rail: {
    paddingHorizontal: spacing.lg,
  },
  thumbGap: {
    width: spacing.sm,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  // Laste-platen må være GRUNNEN, ikke hvitt — ellers blinker den krem mens
  // thumben dekodes, på nøyaktig den flaten som aldri skal være hvit.
  thumbMatch: {
    backgroundColor: matchColors.timeline,
  },
  thumbImageMatch: {
    backgroundColor: matchColors.timeline,
  },
  pressed: {
    opacity: 0.7,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
});
