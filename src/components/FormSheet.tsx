import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius, spacing, typography} from '../theme';
import {LiquidGlassSurface} from './LiquidGlassSurface';
import {OPAL} from './OpalSurface';

/**
 * SKJEMA-ARKET — «Ny hendelse» som kommentararket (Brage 2026-09-03):
 * full bredde, glir opp OVER skjermen du står på, dras ned for å lukke,
 * og selve arket ER glasset (`GLASS.sheet`) — ingen boks oppå.
 *
 * Presentasjon: ruta er en `transparentModal` uten header og uten egen
 * animasjon (AppNavigator `newEventOptions`); skjermen bak står synlig
 * gjennom scrimmet, og dette arket eier bevegelsen. Lukking går ALLTID via
 * `dismiss()` (ref eller Avbryt/bakflate/drag): først utglidningen, så
 * `onDismissed` (= `navigation.goBack`). Android-tilbake popper ruta uten
 * utglidning — akseptert.
 *
 * MEKANIKKEN er feedarkets (`ExpandableCommentSheet`), med ett hvilepunkt
 * mindre: et skjema er høyt, så arket åpner rett til FULL høyde (safe area
 * + 8 pt). Animert `top` på JS-driveren (arket endrer høyde; telefon-
 * godkjent i feedarket), samme terskler (28 % / 0,5 px/ms), samme
 * utglidning (`closeTiming`: sakte slipp = bakgrunnstrykkets 210 ms,
 * kast = fingerens fart, tak 240 ms), samme Heia-blekk-scrim 0,24.
 * Konstantene er KOPIERT, ikke importert: CommentSheet drar med seg hele
 * tråden, og de to arkene skal kunne tunes hver for seg.
 *
 * Gesten bor i HODET (handle + tittel). Den fanger først ved BEVEGELSE, så
 * «Avbryt» i samme rad får trykket sitt. Berøring av hodet lukker
 * tastaturet (som i feedarket). Ingen KeyboardAvoidingView — arket er
 * fullt, og ScrollView-en inni eier tastaturet med
 * `automaticallyAdjustKeyboardInsets` (keyboard.tsx-regelen).
 */

const DRIVER = false;
const OPEN_MS = 340;
const CLOSE_MS = 210;
const DISMISS_RATIO = 0.28;
const DISMISS_VELOCITY = 0.5;
const TOP_GAP = 8;
export const FORM_SHEET_SCRIM = 'rgba(8, 57, 46, 0.24)';
const CLOSE = {fastFloor: 1.0, minMs: 120, maxMs: 240} as const;

/** Varighet + kurve for lukking — feedarkets regel. Ren funksjon. */
export function closeTiming(
  remainingPx: number,
  flickSpeed: number | undefined,
): {duration: number; linear: boolean} {
  const fast = flickSpeed !== undefined && flickSpeed >= CLOSE.fastFloor;
  if (!fast) return {duration: CLOSE_MS, linear: false};
  return {
    duration: Math.min(
      CLOSE.maxMs,
      Math.max(CLOSE.minMs, remainingPx / flickSpeed),
    ),
    linear: true,
  };
}

export interface FormSheetHandle {
  /** Glir ut, så `onDismissed`. Idempotent mens den glir. */
  dismiss: () => void;
}

interface FormSheetProps {
  title: string;
  /** Kalles NÅR arket er ute av skjermen — typisk `navigation.goBack`. */
  onDismissed: () => void;
  reducedMotion?: boolean;
  children?: React.ReactNode;
}

export const FormSheet = forwardRef<FormSheetHandle, FormSheetProps>(
  function FormSheet(
    {title, onDismissed, reducedMotion = false, children},
    ref,
  ) {
    const {height} = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const fullTop = insets.top + TOP_GAP;

    const top = useRef(new Animated.Value(height)).current;
    const backdropOpacity = top.interpolate({
      inputRange: [fullTop, height],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    // Refs, ikke state: brukes inne i PanResponder og lyttere som lages én gang.
    const geom = useRef({height, fullTop});
    geom.current = {height, fullTop};
    const dismissedRef = useRef(onDismissed);
    dismissedRef.current = onDismissed;
    const reduceRef = useRef(reducedMotion);
    reduceRef.current = reducedMotion;

    /** Hvor overkanten er akkurat nå (målet, under animasjon). Ren ref. */
    const posY = useRef(height);
    const dragStart = useRef(height);
    const closing = useRef(false);

    const slideOut = useRef((flickSpeed?: number) => {
      if (closing.current) return;
      closing.current = true;
      const {height: h} = geom.current;
      const remaining = Math.max(1, h - posY.current);
      const {duration, linear} = closeTiming(remaining, flickSpeed);
      posY.current = h;
      Animated.timing(top, {
        toValue: h,
        duration: reduceRef.current ? 0 : duration,
        easing: linear ? Easing.linear : Easing.in(Easing.cubic),
        useNativeDriver: DRIVER,
      }).start(({finished}) => {
        if (finished) dismissedRef.current();
        else closing.current = false;
      });
    }).current;

    const snapBack = useRef(() => {
      const {fullTop: f} = geom.current;
      posY.current = f;
      if (reduceRef.current) {
        top.setValue(f);
        return;
      }
      Animated.spring(top, {
        toValue: f,
        useNativeDriver: DRIVER,
        bounciness: 0,
        speed: 14,
      }).start();
    }).current;

    const dismiss = useCallback(() => slideOut(), [slideOut]);
    useImperativeHandle(ref, () => ({dismiss}), [dismiss]);

    // INN: fra skjermbunnen til full høyde, én gang ved montering.
    useEffect(() => {
      const {height: h, fullTop: f} = geom.current;
      top.setValue(reduceRef.current ? f : h);
      posY.current = f;
      Animated.timing(top, {
        toValue: f,
        duration: reduceRef.current ? 0 : OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: DRIVER,
      }).start();
    }, [top]);

    const pan = useMemo(
      () =>
        PanResponder.create({
          // Fanger ved BEVEGELSE, ikke ved trykk — «Avbryt» ligger i hodet.
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
          onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 2,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            dragStart.current = posY.current;
            Keyboard.dismiss();
          },
          onPanResponderMove: (_e, g) => {
            const {height: h, fullTop: f} = geom.current;
            const y = Math.min(h, Math.max(f, dragStart.current + g.dy));
            posY.current = y;
            top.setValue(y);
          },
          onPanResponderRelease: (_e, g) => {
            const {height: h, fullTop: f} = geom.current;
            const y = posY.current;
            if (g.vy > DISMISS_VELOCITY) {
              slideOut(Math.max(0, g.vy));
              return;
            }
            if (y > f + (h - f) * DISMISS_RATIO) {
              slideOut(Math.max(0, g.vy));
              return;
            }
            snapBack();
          },
          onPanResponderTerminate: snapBack,
        }),
      [top, slideOut, snapBack],
    );

    return (
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, {opacity: backdropOpacity}]}
          pointerEvents="box-none">
          {/* Eget trykkfelt inni det animerte laget: en Pressable rundt ALT
              ville svelget trykk i selve skjemaet. */}
          <Pressable
            style={styles.backdropHit}
            accessibilityRole="button"
            accessibilityLabel="Lukk skjemaet"
            onPress={dismiss}
          />
        </Animated.View>

        {/* Forankret i bunnen, overkanten animeres — arket ENDRER høyde. Ett
            radius-mål under skjermkanten så glassets nedre hjørner aldri
            synes. Glasset er bakgrunnen; innholdet ligger oppå. */}
        <Animated.View
          style={[styles.sheet, {top}]}
          accessibilityViewIsModal
          accessibilityLabel={title}>
          <LiquidGlassSurface variant="sheet" fill cornerRadius={radius.xl} />
          <View style={styles.fill}>
            <View {...pan.panHandlers} collapsable={false} style={styles.head}>
              <View style={styles.handle} />
              <View style={styles.headRow}>
                <Pressable
                  onPress={dismiss}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Avbryt"
                  style={({pressed}) => [
                    styles.cancel,
                    pressed && styles.cancelPressed,
                  ]}>
                  <Text style={styles.cancelText}>Avbryt</Text>
                </Pressable>
                <Text
                  style={styles.title}
                  accessibilityRole="header"
                  numberOfLines={1}>
                  {title}
                </Text>
                {/* Speiler Avbryt så tittelen står midt på. */}
                <View style={styles.cancel} />
              </View>
            </View>
            {children}
          </View>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Heia-blekk 0,24 — samme som feedarket over dagslysgrunnen.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FORM_SHEET_SCRIM,
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -radius.xl,
    paddingBottom: radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  // Gripeflaten. Raus nok til at tommelen treffer uten å sikte.
  head: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: OPAL.inkTertiary,
    opacity: 0.35,
    marginBottom: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  cancel: {
    width: 64,
    minHeight: 32,
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.6,
  },
  cancelText: {
    ...typography.body,
    fontWeight: '600',
    color: OPAL.inkAccent,
  },
  title: {
    ...typography.heading3,
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
