import {useContext} from 'react';
import {BottomTabBarHeightContext} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {spacing} from '../theme';
import {TAB_BAR_GLASS_AB, bottomContentPadding} from '../shared/tabBarLayout';

/**
 * BUNNPADDING UNDER EN FLYTENDE TAB-BAR (Brage 2026-09-03).
 *
 * Kapselen er absolutt: skjerminnholdet løper under den. Siste innhold må
 * derfor kunne scrolles helt OVER kapselen — og ikke lenger. Regnestykket
 * bor i `bottomContentPadding` (rent, testet):
 *
 *   baren montert:   barhøyde + pust   (safe area er INNE i barhøyden)
 *   ingen bar:       safe area + pust  (skjermer utenfor tabs, skjult bar)
 *
 * ⚠️ IKKE `useBottomTabBarHeight()` direkte: den KASTER utenfor en tab-
 * navigator, og de samme skjermene rendres i tester og i onboarding uten
 * en. Konteksten leses rått; `undefined` = ingen bar.
 *
 * Bryteren av (`TAB_BAR_GLASS_AB = false`): dagens verdi, uendret —
 * `insets.bottom + spacing['3xl']` — så den solide baren er pikselidentisk.
 */
export function useBottomContentPadding(
  breathing: number = spacing.lg,
): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  if (!TAB_BAR_GLASS_AB) return insets.bottom + spacing['3xl'];
  return bottomContentPadding(tabBarHeight, insets.bottom, breathing);
}

/**
 * Hvor mange punkter en BUNNFORANKRET flate (reporterdokken) må løftes for
 * å ligge over kapselen i stedet for under den. 0 uten bar / bryter av.
 */
export function useTabBarOverlap(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  return TAB_BAR_GLASS_AB ? tabBarHeight : 0;
}
