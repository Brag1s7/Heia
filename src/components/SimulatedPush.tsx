import React, {useEffect, useRef} from 'react';
import {Text, StyleSheet, Animated} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius, shadows} from '../theme';

interface SimulatedPushProps {
  title: string;
  message: string;
  visible: boolean;
  onHide: () => void;
}

export function SimulatedPush({
  title,
  message,
  visible,
  onHide,
}: SimulatedPushProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;

  // `onHide` sendes som regel inn som en pil-funksjon rett i JSX-en, altså en
  // NY funksjon for hver render. Lå den i dependency-lista, ville enhver
  // re-render (et refetch, en tikkende kampklokke) startet animasjonen på
  // nytt. Ref-en gjør at effekten bare avhenger av `visible`.
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-200);
    const animation = Animated.sequence([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.delay(3000),
      Animated.timing(translateY, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    // `finished` er poenget: en avbrutt animasjon kaller også denne callbacken.
    // Uten sjekken skjulte banneret seg i det noe avbrøt den — som er hvorfor
    // det bare så vidt rakk å vises.
    animation.start(({finished}) => {
      if (finished) {
        onHideRef.current();
      }
    });

    return () => animation.stop();
  }, [visible, translateY]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + spacing.sm,
          transform: [{translateY}],
        },
      ]}>
      {/* Mint-strek + heiaInk (A v2) — #02FFAB er kun fyll, aldri tekst på lyst. */}
      <Animated.View style={styles.appRow}>
        <Animated.View style={styles.appDash} />
        <Text style={styles.appLabel}>Heia</Text>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.elevated,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  appLabel: {
    ...typography.caption,
    color: colors.heiaInk,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
