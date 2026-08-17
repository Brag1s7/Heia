import React, {useCallback} from 'react';
import {View, Text, Pressable, FlatList, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {MediaImage} from '../lib/media/MediaImage';
import type {MatchPhoto} from '../lib/api/feed';

interface MatchPhotoRailProps {
  photos: MatchPhoto[];
  onPressPhoto: (photo: MatchPhoto) => void;
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
export function MatchPhotoRail({photos, onPressPhoto}: MatchPhotoRailProps) {
  const renderThumb = useCallback(
    ({item}: {item: MatchPhoto}) => (
      <Pressable
        onPress={() => onPressPhoto(item)}
        style={({pressed}) => [styles.thumb, pressed && styles.pressed]}>
        {/* 96 pt-rute → thumb-varianten (480 px holder i massevis). */}
        <MediaImage
          media={item.media}
          variant="thumb"
          style={styles.thumbImage}
          resizeMode="cover"
        />
      </Pressable>
    ),
    [onPressPhoto],
  );

  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kampbilder</Text>
        <Text style={styles.count}>
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
  count: {
    ...typography.caption,
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
  pressed: {
    opacity: 0.7,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
});
