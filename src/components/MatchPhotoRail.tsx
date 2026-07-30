import React from 'react';
import {View, Text, Image, Pressable, ScrollView, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import type {MatchPhoto} from '../lib/api/feed';

interface MatchPhotoRailProps {
  photos: MatchPhoto[];
  onPressPhoto: (photo: MatchPhoto) => void;
}

/**
 * Kompakt inngang til kampens bilder — kun på ferdigspilte kamper.
 *
 * Under kampen ville den konkurrert med stillingen og kampforløpet, som er
 * det man er der for. Etterpå snur det: da er bildene det man kom tilbake
 * for, mens forløpet er konteksten. Bildene blir uansett stående i forløpet.
 */
export function MatchPhotoRail({photos, onPressPhoto}: MatchPhotoRailProps) {
  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kampbilder</Text>
        <Text style={styles.count}>
          {photos.length === 1 ? '1 bilde' : `${photos.length} bilder`}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {photos.map(photo => (
          <Pressable
            key={photo.id}
            onPress={() => onPressPhoto(photo)}
            style={({pressed}) => [styles.thumb, pressed && styles.pressed]}>
            <Image
              source={{uri: photo.imageUrl}}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
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
    gap: spacing.sm,
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
