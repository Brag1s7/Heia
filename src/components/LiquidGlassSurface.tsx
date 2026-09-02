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
import {radius} from '../theme';
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
 * Tinten i glasset: NESTEN FARGELØS perlegrå (Brage runde 2: bakgrunnen eier
 * Heia-minten, glasset låner grønt kun gjennom blur/refraksjon). Ikke mer
 * hvitt fyll, ikke lavere transparens — bare metningen ut. Alfa = styrke.
 */
export const GLASS = {
  // Runde 3 (Brage: «mintfarget plast» på telefon ved 0,26): samme nøytrale
  // farge, ett kontrollert alfa-steg opp. Mål: ~75 % perle / 25 % grunn.
  tint: 'rgba(233, 235, 234, 0.34)',
} as const;

interface NativeProps extends ViewProps {
  cornerRadius: number;
  glassTint: string;
  pressed: boolean;
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
  /** Hjørneradius — kort = radius.xl (default), kantlinjer/bar = 0. */
  cornerRadius?: number;
  children?: React.ReactNode;
}

export function LiquidGlassSurface({
  style,
  pressed = false,
  cornerRadius = radius.xl,
  children,
}: LiquidGlassSurfaceProps) {
  const {reduceTransparency} = useMaterialAccessibility();
  if (!FEED_LIQUID_GLASS_AB || !NativeGlass || reduceTransparency) {
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
      glassTint={GLASS.tint}
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
});
