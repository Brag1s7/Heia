import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  requireNativeComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {radius, shadows} from '../theme';
import {OpalSurface} from './OpalSurface';
import {useMaterialAccessibility} from './useMaterialAccessibility';

/**
 * LIQUID GLASS — isolert iOS-prototype (Brage 2026-09-02): ekte systemblur og
 * refraksjon (`UIGlassEffect`, iOS 26) bak ikke-festede FeedCards. Brage
 * opphevet blur-sperren for AKKURAT denne flaten etter at fire SVG-runder
 * fortsatt leste som en flat, lys flate på telefonen.
 *
 * Native: `ios/Heia2/HeiaLiquidGlassView.{h,m}` + `HeiaLiquidGlassViewManager.m`
 * (legacy view manager gjennom RN 0.83s interop-lag — ingen codegen, ingen
 * ny pakke, ingen pod install). Systemet eier blur, kant og trykkrespons;
 * ett delt sheen-lag glir svakt ved press. Ingen loop.
 *
 * Portene:
 *   • kun iOS ≥ 26 — eldre iOS og Android får dagens `OpalSurface`
 *   • Reduce Transparency → `OpalSurface` (solid, lesbar fallback)
 *   • padding-boksen er identisk med OpalSurface/`styles.card` (1 pt
 *     gjennomsiktig kant + radius xl), så layout og innhold er uendret
 *   • blekket er fortsatt OPAL.ink* i FeedCard (kontrastporten)
 *   • ingen bakgrunn, tokens eller globale flater rørt
 */
export const FEED_LIQUID_GLASS_AB = true;

/**
 * ÉN komponent, tre varianter (Brage 2026-09-02, godkjent): materialvekt
 * koder hierarki (Emil-linsa), tynt glass til kontroller og tykkere glass til
 * større innholdsflater (HIG). Alfa = styrke; fargen er alltid en perle,
 * aldri hvitt fyll og aldri krem.
 *
 *   card       feedkortet (LÅST): nesten fargeløs perlegrå 0,34 — bakgrunnen
 *              eier Heia-minten, glasset låner grønt kun gjennom blur.
 *              Mål ~75 % perle / 25 % grunn. Full sheen, trykkrespons på.
 *   control    compose-boksen: «tynt, lyst og nøytralt kontrollglass» —
 *              nesten hvit 0,20 (~60 % grunn), halv sheen, INGEN trykk-
 *              respons (feltet og kameraknappen er kontrollene).
 *   important  festet VIKTIG-kort: «varmere og mer solid opalglass» — varm
 *              perle (sun-tonen med metningen ned) 0,52 (~85 % perle), full
 *              sheen, trykkrespons på (åpner kommentartråden). Gullpillen
 *              bærer aksenten; INGEN uniform gullkant (leser som annonse/
 *              advarsel — Brage). Ikke mørkt, ikke cardSun-papir.
 */
export type GlassVariant = 'card' | 'control' | 'important';

export const GLASS = {
  card: {tint: 'rgba(233, 235, 234, 0.34)', sheen: 0.18, interactive: true},
  control: {tint: 'rgba(244, 246, 245, 0.2)', sheen: 0.09, interactive: false},
  important: {
    tint: 'rgba(246, 240, 226, 0.52)',
    sheen: 0.18,
    interactive: true,
  },
  /**
   * Solid varm perle for `important` uten glass (Android / Reduce
   * Transparency / eldre iOS): tinten over lysfelt-grunnen regnet ut til én
   * flat farge, så materialretningen beholdes — IKKE det mettede
   * `colors.sun`-papiret. Kanten er goldInk-blekk, svakt.
   */
  importantSolid: '#F4F1E6',
  importantSolidEdge: 'rgba(92, 74, 0, 0.14)',
} as const;

interface NativeProps extends ViewProps {
  cornerRadius: number;
  glassTint: string;
  pressed: boolean;
  sheenOpacity: number;
  interactive: boolean;
}

const iosMajor =
  Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const LIQUID_GLASS_SUPPORTED = iosMajor >= 26;

// `requireNativeComponent` registrerer viewet i RN-registeret én gang per
// app-økt; Fast Refresh evaluerer denne modulen på nytt og ville kastet
// «Tried to register two views with the same name». Derfor caches
// komponenten globalt, som RN-biblioteker gjør.
type GlassGlobal = {__heiaLiquidGlass?: React.ComponentType<NativeProps>};
const glassGlobal = globalThis as unknown as GlassGlobal;
const NativeGlass = LIQUID_GLASS_SUPPORTED
  ? (glassGlobal.__heiaLiquidGlass ??= requireNativeComponent<NativeProps>(
      'HeiaLiquidGlassView',
    ))
  : null;

interface LiquidGlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  pressed?: boolean;
  /** Materialvariant — se `GLASS`. Default = feedkortet. */
  variant?: GlassVariant;
  /** Hjørneradius — kort = radius.xl (default), kantlinjer/bar = 0. */
  cornerRadius?: number;
  children?: React.ReactNode;
}

export function LiquidGlassSurface({
  style,
  pressed = false,
  variant = 'card',
  cornerRadius = radius.xl,
  children,
}: LiquidGlassSurfaceProps) {
  const {reduceTransparency} = useMaterialAccessibility();
  const glass = GLASS[variant];
  if (!FEED_LIQUID_GLASS_AB || !NativeGlass || reduceTransparency) {
    if (variant === 'important') {
      return (
        <View
          style={[styles.importantSolid, {borderRadius: cornerRadius}, style]}>
          {children}
        </View>
      );
    }
    return (
      <OpalSurface style={style} pressed={pressed}>
        {children}
      </OpalSurface>
    );
  }
  return (
    <NativeGlass
      style={[styles.glass, {borderRadius: cornerRadius}]}
      cornerRadius={cornerRadius}
      glassTint={glass.tint}
      sheenOpacity={glass.sheen}
      interactive={glass.interactive}
      pressed={pressed}>
      <View style={[styles.surface, {borderRadius: cornerRadius}, style]}>
        {children}
      </View>
    </NativeGlass>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.xl,
  },
  surface: {
    borderRadius: radius.xl,
    // Samme padding-boks som OpalSurface: 1 pt gjennomsiktig kant.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Solid varm perle (important-fallback). Samme padding-boks: 1 pt kant.
  importantSolid: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: GLASS.importantSolidEdge,
    backgroundColor: GLASS.importantSolid,
    ...shadows.cardResting,
  },
});
