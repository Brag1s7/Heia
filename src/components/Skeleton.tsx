import React, {useEffect} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import {colors, radius, spacing, shadows} from '../theme';

// ---------------------------------------------------------------------------
// Skeleton — lastetilstand på Card-språket (P1 i design-polish-planen).
// Grå/krem flater med svak opacity-puls, ren RN Animated — ingen shimmer-
// bibliotek, ingen nye deps.
// ---------------------------------------------------------------------------

// Én delt Animated.Value for HELE appen: alle bones puster i takt (usynkrone
// pulser ser ut som flimmer), og det kjører maks én loop uansett hvor mange
// blokker en skjerm viser. Refcount starter/stopper loopen med første/siste
// monterte bone.
const pulse = new Animated.Value(1);
let activeBones = 0;
let loop: Animated.CompositeAnimation | null = null;

function retainPulse() {
  activeBones += 1;
  if (activeBones === 1) {
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
  }
}

function releasePulse() {
  activeBones -= 1;
  if (activeBones === 0) {
    loop?.stop();
    loop = null;
    pulse.setValue(1);
  }
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Full sirkel (avatar/ikon) — radius følger høyden. */
  round?: boolean;
  style?: ViewStyle;
}

/** Én pulserende blokk. Farge overstyres via style (stadionflate: stadiumEdge). */
export function Skeleton({
  width = '100%',
  height = 14,
  round = false,
  style,
}: SkeletonProps) {
  useEffect(() => {
    retainPulse();
    return releasePulse;
  }, []);

  return (
    <Animated.View
      style={[
        styles.bone,
        {width, height, borderRadius: round ? height / 2 : radius.sm},
        {opacity: pulse},
        style,
      ]}
    />
  );
}

/** Hvit kortflate til å legge bones i — samme språk som Card/FeedCard. */
export function SkeletonCard({
  children,
  style,
}: React.PropsWithChildren<{style?: ViewStyle}>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Feed-post: avsenderlinje + to tekstlinjer. */
export function FeedCardSkeleton() {
  return (
    <SkeletonCard>
      <View style={styles.headerRow}>
        <Skeleton width={40} height={40} round />
        <View style={styles.headerText}>
          <Skeleton width={130} height={13} />
          <Skeleton width={70} height={10} />
        </View>
      </View>
      <View style={styles.lines}>
        <Skeleton height={13} />
        <Skeleton width="65%" height={13} />
      </View>
    </SkeletonCard>
  );
}

/** Kalenderkort: kompakt hero — pill + tid, tittel, metalinje, progress. */
export function EventCardSkeleton() {
  return (
    <SkeletonCard>
      <View style={styles.eventBand}>
        <Skeleton width={80} height={20} round />
        <Skeleton width={52} height={16} />
      </View>
      <View style={styles.eventLines}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="35%" height={11} />
        <Skeleton height={8} round />
      </View>
    </SkeletonCard>
  );
}

/** Listerad: sirkel + to linjer (Varsler, Lagoversikt). Legges i eget kort. */
export function ListRowSkeleton({showBorder = true}: {showBorder?: boolean}) {
  return (
    <View style={[styles.listRow, showBorder && styles.listRowBorder]}>
      <Skeleton width={40} height={40} round />
      <View style={styles.headerText}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="80%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  lines: {
    gap: spacing.sm,
  },
  eventBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  eventLines: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
});
