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
import {colors, typography, spacing, radius, shadows, fonts} from '../theme';
import {Calendar} from './icons';
import {NextEventHero} from './NextEventHero';
import {HeroSurface} from './HeroSurface';
import {formatKr} from '../lib/money';
import type {HeiaEvent} from '../shared/types';

/** Lagkassa-tallene til karusellkortet (fase 5) — null = skjul kortet. */
export interface LagkassaCardData {
  supporters: number;
  monthlyToClubMinor: number;
}

interface NextEventCarouselProps {
  /** Kommende hendelser i stigende rekkefølge (fra pickNextEvents). */
  events: HeiaEvent[];
  onEventPress: (event: HeiaEvent) => void;
  onOpenCalendar: () => void;
  /** Lagkassa-side i karusellen — Hjem er den emosjonelle inngangen. */
  lagkassa?: LagkassaCardData | null;
  onOpenLagkassa?: () => void;
}

type CarouselItem =
  | {kind: 'event'; event: HeiaEvent}
  | {kind: 'lagkassa'}
  | {kind: 'calendar'};

/**
 * Hjem-heroen som karusell: bla bortover gjennom de neste hendelsene, med
 * lagkassa-kortet (fase 5 — synlig, emosjonell inngang til støtten) og et
 * «Åpne kalenderen»-kort bakerst. Gjelder KUN hverdagsmodus — live kamp
 * beholder hero-prioriteten alene (håndteres av TeamHome).
 *
 * Sidene er skjermbredde med pagingEnabled; kortene selv beholder
 * skjermmargen, så karusellen må ligge i en wrapper UTEN horisontal padding.
 */
export function NextEventCarousel({
  events,
  onEventPress,
  onOpenCalendar,
  lagkassa,
  onOpenLagkassa,
}: NextEventCarouselProps) {
  const {width} = useWindowDimensions();
  const [page, setPage] = useState(0);

  const items: CarouselItem[] = [
    ...events.map(event => ({kind: 'event' as const, event})),
    ...(lagkassa ? [{kind: 'lagkassa' as const}] : []),
    // Kalenderkortet følger hendelsene — uten hendelser er lagkassa alene
    // (P8-regelen «aldri et ensomt kalenderkort» består).
    ...(events.length > 0 ? [{kind: 'calendar' as const}] : []),
  ];

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(e.nativeEvent.contentOffset.x / width);
      setPage(Math.max(0, Math.min(raw, items.length - 1)));
    },
    [width, items.length],
  );

  const renderItem = useCallback(
    ({item}: {item: CarouselItem}) => (
      <View style={[styles.pageWrap, {width}]}>
        {item.kind === 'event' ? (
          <NextEventHero
            event={item.event}
            onPress={() => onEventPress(item.event)}
          />
        ) : item.kind === 'lagkassa' ? (
          <Pressable
            onPress={onOpenLagkassa}
            accessibilityRole="button"
            accessibilityLabel="Åpne lagkassa"
            style={({pressed}) => [styles.flexCard, pressed && styles.pressed]}>
            <HeroSurface style={styles.lagkassaCard}>
              <Text style={styles.lagkassaPill}>💚 LAGKASSA</Text>
              {lagkassa && lagkassa.supporters > 0 ? (
                <>
                  <Text style={styles.lagkassaAmount}>
                    {formatKr(lagkassa.monthlyToClubMinor)}
                  </Text>
                  <Text style={styles.lagkassaCaption}>
                    til laget hver måned ·{' '}
                    {lagkassa.supporters === 1
                      ? '1 støttespiller'
                      : `${lagkassa.supporters} støttespillere`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.lagkassaEmpty}>
                    Bli lagets første støttespiller
                  </Text>
                  <Text style={styles.lagkassaCaption}>
                    Hver krone gjør lagfølelsen større
                  </Text>
                </>
              )}
            </HeroSurface>
          </Pressable>
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
    [width, onEventPress, onOpenCalendar, onOpenLagkassa, lagkassa],
  );

  if (items.length === 0) return null;

  return (
    <View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => (item.kind === 'event' ? item.event.id : item.kind)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Alle sidene (maks 5) rendres med én gang: høyden på listen settes av
        // det høyeste kortet, og skal ikke hoppe når man blar.
        initialNumToRender={items.length}
        onMomentumScrollEnd={handleMomentumEnd}
      />
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={item.kind === 'event' ? item.event.id : item.kind}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    paddingHorizontal: spacing.lg,
  },
  flexCard: {
    flex: 1,
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
  // Lagkassa-kortet: hero-flaten (aldri hvit adminflate) med lagets tall.
  // minHeight bærer kortet når det står alene (ingen hendelser å arve
  // sidehøyde fra).
  lagkassaCard: {
    flex: 1,
    minHeight: 148,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: 2,
  },
  lagkassaPill: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heiaDeep,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  lagkassaAmount: {
    fontSize: 30,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  lagkassaEmpty: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
  lagkassaCaption: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
