import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MediaImage} from '../lib/media/MediaImage';
import {X} from './icons';
import {colors, typography, spacing} from '../theme';
import type {MatchPhoto} from '../lib/api/feed';

interface MatchPhotoGalleryProps {
  photos: MatchPhoto[];
  /** Bildet det ble trykket på — galleriet åpner på nettopp dette. */
  initialPhotoId: string | null;
  onClose: () => void;
}

const photoKeyExtractor = (photo: MatchPhoto) => photo.id;

/**
 * Fullskjerm bildevisning med sveiping mellom kampens bilder.
 *
 * FlatList med windowSize 3 (B2): gjeldende side + ett viewport hver vei —
 * nabobildet er alltid forhåndsmontert for sveipet, mens resten av kampens
 * bilder (display-varianten, den tunge) ikke lastes før man faktisk sveiper
 * dit. Før monterte modalen ALLE bildene i det den åpnet.
 */
export function MatchPhotoGallery({
  photos,
  initialPhotoId,
  onClose,
}: MatchPhotoGalleryProps) {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MatchPhoto>>(null);

  const initialIndex = Math.max(
    0,
    photos.findIndex(p => p.id === initialPhotoId),
  );
  const [index, setIndex] = useState(initialIndex);

  // Modal-en unmounter innholdet når den er lukket, så lista monteres ferskt
  // per åpning — initialScrollIndex (+ getItemLayout) stiller den rett på
  // bildet det ble trykket på. Kun indeks-staten trenger resync her.
  useEffect(() => {
    if (initialPhotoId === null) return;
    setIndex(initialIndex);
  }, [initialPhotoId, initialIndex]);

  // Rotasjon/breddeendring: pagingen regner i px, så gjeldende side må
  // re-innrettes når bredden endres — ellers lander man mellom to bilder.
  // Indeksen leses via ref så effekten IKKE fyrer per sveip.
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    listRef.current?.scrollToOffset({
      offset: indexRef.current * width,
      animated: false,
    });
  }, [width]);

  // Eksplisitt høyde: FlatList-cellen wrapper siden, så `flex: 1` alene
  // ville ikke garantert full skjermhøyde slik det gjorde i ScrollView-en.
  const renderPhoto = useCallback(
    ({item}: {item: MatchPhoto}) => (
      <View style={[styles.page, {width, height}]}>
        <MediaImage
          media={item.media}
          variant="display"
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    ),
    [width, height],
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({length: width, offset: width * i, index: i}),
    [width],
  );

  const current = photos[index];

  return (
    <Modal
      visible={initialPhotoId !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.screen}>
        <FlatList
          ref={listRef}
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={photoKeyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          onMomentumScrollEnd={e =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        />

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, {top: insets.top + spacing.md}]}>
          <X size={18} color={colors.surface} strokeWidth={2.4} />
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
