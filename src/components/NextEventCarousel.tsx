import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Calendar} from './icons';
import {NextEventHero} from './NextEventHero';
import type {HeiaEvent} from '../shared/types';

interface NextEventCarouselProps {
  /** Kommende hendelser i stigende rekkefølge (fra pickNextEvents). */
  events: HeiaEvent[];
  onEventPress: (event: HeiaEvent) => void;
  onOpenCalendar: () => void;
}

type CarouselItem =
  | {kind: 'event'; event: HeiaEvent}
  | {kind: 'calendar'};

/**
 * Hjem-heroen som karusell: bla bortover gjennom de neste hendelsene, med et
 * «Åpne kalenderen»-kort bakerst som vei videre. Gjelder KUN hverdagsmodus —
 * live kamp beholder hero-prioriteten alene (håndteres av TeamHome).
 *
 * Sidene er skjermbredde med pagingEnabled; kortene selv beholder
 * skjermmargen, så karusellen må ligge i en wrapper UTEN horisontal padding.
 */
export function NextEventCarousel({
  events,
  onEventPress,
  onOpenCalendar,
}: NextEventCarouselProps) {
  const {width} = useWindowDimensions();
  const [page, setPage] = useState(0);

  const items: CarouselItem[] = [
    ...events.map(event => ({kind: 'event' as const, event})),
    {kind: 'calendar' as const},
  ];

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(e.nativeEvent.contentOffset.x / width);
      setPage(Math.max(0, Math.min(raw, events.length)));
    },
    [width, events.length],
  );

  const renderItem = useCallback(
    ({item}: {item: CarouselItem}) => (
      <View style={[styles.pageWrap, {width}]}>
        {item.kind === 'event' ? (
          <NextEventHero
            event={item.event}
            onPress={() => onEventPress(item.event)}
          />
        ) : (
          <Pressable
            onPress={onOpenCalendar}
            accessibilityRole="button"
            accessibilityLabel="Åpne kalenderen"
            style={({pressed}) => [
              styles.calendarCard,
              pressed && styles.pressed,
            ]}>
            <View style={styles.calendarIcon}>
              <Calendar size={22} color={colors.heiaInk} />
            </View>
            <Text style={styles.calendarTitle}>Åpne kalenderen</Text>
            <Text style={styles.calendarHint}>
              Treninger, kamper og alt som skjer
            </Text>
          </Pressable>
        )}
      </View>
    ),
    [width, onEventPress, onOpenCalendar],
  );

  if (events.length === 0) return null;

  return (
    <View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => (item.kind === 'event' ? item.event.id : 'calendar')}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Alle sidene (maks 4) rendres med én gang: høyden på listen settes av
        // det høyeste kortet, og skal ikke hoppe når man blar.
        initialNumToRender={items.length}
        onMomentumScrollEnd={handleMomentumEnd}
      />
      <View style={styles.dots}>
        {items.map((item, i) => (
          <View
            key={item.kind === 'event' ? item.event.id : 'calendar'}
            style={[styles.dot, i === page && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    paddingHorizontal: spacing.lg,
  },
  // Kalenderkortet fyller sidehøyden (flex) — hendelseskortene setter den.
  calendarCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.cardResting,
  },
  pressed: {
    opacity: 0.93,
  },
  calendarIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.heiaTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  calendarTitle: {
    ...typography.heading3,
  },
  calendarHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 57, 46, 0.15)',
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.heia,
  },
});
