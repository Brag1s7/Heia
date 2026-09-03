import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {radius, spacing} from '../theme';
import {LiquidGlassSurface} from './LiquidGlassSurface';
import {OPAL} from './OpalSurface';

/**
 * ARKENE I GLASS (Brage 2026-09-03) — to byggeklosser som deles av
 * månedsvisningen («Måned» på Kalender), datovelgeren og klokkeslett-
 * velgeren i «Ny hendelse»:
 *
 *   GlassSheetSurface  selve arket: `GLASS.sheet` (tungt Heia-glass, ekte
 *                      systemblur på iOS 26, solid perle ellers), stor
 *                      radius, drag-handle 36×5, og ETT radius-mål trukket
 *                      under skjermkanten så de nedre hjørnene aldri synes
 *                      (glasset har uniform radius; Android har ingen
 *                      avrundede skjermhjørner).
 *   InlineSheet        presenteren for ark INNE i en skjerm: en absolutt
 *                      overflate med gjennomsiktig, trykkbar bakflate (ingen
 *                      scrim — Brage) og arket som glir opp fra bunnen på den
 *                      native driveren.
 *
 * ⚠️ HVORFOR INLINE OG IKKE `Modal`: «Ny hendelse» er en native modal
 * (react-native-screens). En RN `Modal` presentert fra en skjerm som selv er
 * presentert modalt, kom på telefonen «etter flere sekunder, og man måtte
 * trykke rundt for at den skulle dukke opp» (Brage 2026-09-03). Kalenderens
 * månedsark (`MonthSheet`) ligger IKKE i en native modal og bruker fortsatt
 * `Modal` — den må dekke den flytende tab-baren. Samme flate, to
 * presentasjoner.
 */

interface GlassSheetSurfaceProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GlassSheetSurface({style, children}: GlassSheetSurfaceProps) {
  const insets = useSafeAreaInsets();
  return (
    <LiquidGlassSurface
      variant="sheet"
      style={[
        styles.sheet,
        {paddingBottom: insets.bottom + spacing.lg + radius.xl},
        style,
      ]}>
      <View style={styles.handle} />
      {children}
    </LiquidGlassSurface>
  );
}

interface InlineSheetProps {
  visible: boolean;
  onClose: () => void;
  /** VoiceOver-navnet på bakflaten («Lukk klokkeslettvelgeren»). */
  closeLabel: string;
  /** «Reduser bevegelse»: arket kommer uten å gli. */
  reducedMotion?: boolean;
  children?: React.ReactNode;
}

const OPEN_MS = 260;
const CLOSE_MS = 200;

export function InlineSheet({
  visible,
  onClose,
  closeLabel,
  reducedMotion = false,
  children,
}: InlineSheetProps) {
  const {height} = useWindowDimensions();
  // Montert så lenge arket er synlig ELLER på vei ned; avmonteres først når
  // utglidningen er ferdig, så ingenting blir stående usynlig over skjemaet.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      // Arket eier bunnen av skjermen; et åpent tastatur ville ligget oppå.
      Keyboard.dismiss();
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reducedMotion ? 0 : visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({finished}) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [mounted, visible, reducedMotion, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    // ⚠️ `accessibilityViewIsModal` (iOS): VoiceOver skal ikke kunne vandre
    // inn i skjemaet bak mens arket er oppe.
    <View style={styles.overlay} accessibilityViewIsModal>
      {/* Ingen scrim: skjemaet bak står som det er. Flaten er trykkbar. */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      />
      <Animated.View style={{transform: [{translateY}]}}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    // Nedre hjørner under skjermkanten — se filkommentaren.
    marginBottom: -radius.xl,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: OPAL.inkTertiary,
    opacity: 0.35,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
