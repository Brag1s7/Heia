import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import {Animated, Easing, Pressable, StyleSheet} from 'react-native';
import type {BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {useReducedMotion} from './useReducedMotion';

/**
 * TAB-BARENS KNAPP — den fysiske trykkresponsen (Brage 2026-09-03).
 *
 * Bottom-tabs v7 gir en egen `tabBarButton` KUN `onPress`/`onLongPress`
 * (BottomTabItem.tsx: href, onPress, onLongPress, a11y, style, children,
 * android_ripple, pressOpacity) — ingen pressIn/pressOut. Standardknappen
 * (PlatformPressable, pressOpacity 1) gir derfor INGEN synlig respons.
 * Denne Pressable-en eier touch-down/touch-up selv:
 *
 *   pressIn   → `press` 0 → 1 på 90 ms ease-out (svar på touch-DOWN, Emil §1)
 *   pressOut  → fjær tilbake til 0, dempningsforhold ≈ 0,7: kontrollert,
 *               liten overshoot — det er et slipp med bevegelse i.
 *
 * Hva `press` driver:
 *   • hele faneinnholdet komprimeres til `compress` (vanlig 0,95, KAMP 0,96
 *     — kampknappen beholder egen geometri og alle tilstander, kun skalaen
 *     legges utenpå),
 *   • den AKTIVE mintmarkøren (`TabIconWrap` i navigatoren) leser samme
 *     verdi gjennom `useTabPress()` og squasher svakt horisontalt
 *     (scaleX 0,90 / scaleY 1,04) — én kilde, samme fjær.
 *
 * Reduce Motion: ingen transformasjoner — kort opacity-crossfade (0,72) i
 * stedet. Ingen loop, ingen puls, ingen automatisk bevegelse. Native driver
 * (transform/opacity). Kapselbakgrunnen (`TabBarGlass`) er pointerEvents
 * none — bare kontrollene reagerer.
 *
 * ⛔ Selection-haptikk ved fanebytte er IKKE lagt: ekte haptikk krever en
 * native modul (låst funn, se TimeSheet/STATUS-HANDOFF), og `Vibration`
 * er en ~400 ms alarmbrumming på iOS. Egen skive med pod om Brage vil.
 */
export const TAB_PRESS = {
  /** Vanlig fane: hele innholdet. */
  compress: 0.95,
  /** KAMP: egen, litt roligere kompresjon. */
  compressMatch: 0.96,
  /** Aktiv mintmarkør: horisontal squash + svak vertikal strekk. */
  squashX: 0.9,
  squashY: 1.04,
  /** Reduce Motion: crossfade i stedet for bevegelse. */
  fadeTo: 0.72,
  inMs: 90,
  spring: {stiffness: 320, damping: 22, mass: 0.8},
} as const;

interface TabPress {
  /** 0 = i hvile, 1 = trykket ned. */
  press: Animated.Value;
  reducedMotion: boolean;
}

const TabPressContext = createContext<TabPress | null>(null);

/** Trykkverdien for fanen man står i — null utenfor en TabButton. */
export function useTabPress(): TabPress | null {
  return useContext(TabPressContext);
}

interface TabButtonProps extends BottomTabBarButtonProps {
  /** Skala ved touch-down for hele innholdet. Default vanlig fane. */
  compress?: number;
}

/**
 * Biblioteket sender knappen web-navnene (`aria-selected`, `aria-label`,
 * `role`) + PlatformPressable-egne (`hoverEffect`, `pressOpacity`, `href`).
 * Pressable forstår aria-*; de tre siste er ikke Pressable-props og
 * strippes. `accessibilityState.selected` settes EKSPLISITT (som
 * PlatformPressable gjorde) så VoiceOver — og tabBar-testen — ser at fanen
 * er valgt.
 */
export function TabButton({
  children,
  style,
  compress = TAB_PRESS.compress,
  href: _href,
  hoverEffect: _hoverEffect,
  pressOpacity: _pressOpacity,
  pressColor: _pressColor,
  ...rest
}: TabButtonProps & {
  hoverEffect?: unknown;
  pressOpacity?: number;
  pressColor?: string;
}) {
  const selected = !!(rest as {'aria-selected'?: boolean})['aria-selected'];
  const reducedMotion = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    press.stopAnimation();
    Animated.timing(press, {
      toValue: 1,
      duration: TAB_PRESS.inMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [press]);

  const handlePressOut = useCallback(() => {
    press.stopAnimation();
    if (reducedMotion) {
      Animated.timing(press, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(press, {
      toValue: 0,
      ...TAB_PRESS.spring,
      useNativeDriver: true,
    }).start();
  }, [press, reducedMotion]);

  const ctx = useMemo(() => ({press, reducedMotion}), [press, reducedMotion]);

  const motion = reducedMotion
    ? {
        opacity: press.interpolate({
          inputRange: [0, 1],
          outputRange: [1, TAB_PRESS.fadeTo],
        }),
      }
    : {
        transform: [
          {
            scale: press.interpolate({
              inputRange: [0, 1],
              outputRange: [1, compress],
            }),
          },
        ],
      };

  return (
    <Pressable
      {...(rest as React.ComponentProps<typeof Pressable>)}
      accessibilityState={{selected}}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}>
      <TabPressContext.Provider value={ctx}>
        <Animated.View style={[styles.content, motion]}>
          {children}
        </Animated.View>
      </TabPressContext.Provider>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
