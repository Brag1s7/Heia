import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing} from '../theme';
import type {MatchPhoto} from '../lib/api/feed';

interface MatchPhotoGalleryProps {
  photos: MatchPhoto[];
  /** Bildet det ble trykket på — galleriet åpner på nettopp dette. */
  initialPhotoId: string | null;
  onClose: () => void;
}

/** Fullskjerm bildevisning med sveiping mellom kampens bilder. */
export function MatchPhotoGallery({
  photos,
  initialPhotoId,
  onClose,
}: MatchPhotoGalleryProps) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const initialIndex = Math.max(
    0,
    photos.findIndex(p => p.id === initialPhotoId),
  );
  const [index, setIndex] = useState(initialIndex);

  // Hopper til riktig bilde når galleriet åpnes. `animated: false` fordi
  // brukeren skal se bildet de trykket på, ikke en scroll fra bilde 1.
  useEffect(() => {
    if (initialPhotoId === null) return;
    setIndex(initialIndex);
    // Uten rammen har ScrollView-en ennå ingen bredde å scrolle innenfor.
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({x: initialIndex * width, animated: false});
    });
    return () => cancelAnimationFrame(id);
  }, [initialPhotoId, initialIndex, width]);

  const current = photos[index];

  return (
    <Modal
      visible={initialPhotoId !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }>
          {photos.map(photo => (
            <View key={photo.id} style={[styles.page, {width}]}>
              <Image
                source={{uri: photo.imageUrl}}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, {top: insets.top + spacing.md}]}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {current && (
          <View style={[styles.footer, {paddingBottom: insets.bottom + spacing.lg}]}>
            {current.caption && (
              <Text style={styles.caption}>{current.caption}</Text>
            )}
            <Text style={styles.meta}>
              {current.authorName}
              {photos.length > 1 ? ` · ${index + 1}/${photos.length}` : ''}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  caption: {
    ...typography.body,
    color: colors.surface,
  },
  meta: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
