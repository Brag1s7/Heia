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
export type GlassVariant =
  | 'card'
  | 'control'
  | 'important'
  | 'bar'
  | 'barMatch';

export const GLASS = {
  card: {tint: 'rgba(233, 235, 234, 0.34)', sheen: 0.18, interactive: true},
  control: {tint: 'rgba(244, 246, 245, 0.2)', sheen: 0.09, interactive: false},
  important: {
    tint: 'rgba(246, 240, 226, 0.52)',
    sheen: 0.18,
    interactive: true,
  },
  /**
   * TAB-BAREN (Brage 2026-09-03, godkjent; sluttrunde: 0,30 → 0,34, samme
   * nøytrale perle): lys perle — tykkere enn
   * kontrollglasset (den bærer tekst nederst over det dype hjørnet), tynnere
   * enn kortet (chrome skal ikke eie minten). Nesten ingen sheen: chrome
   * skinner ikke. Fanene er kontrollene — ingen trykkrespons i glasset.
   */
  bar: {tint: 'rgba(244, 246, 245, 0.34)', sheen: 0.06, interactive: false},
  /**
   * SAMME BAR PÅ KAMPSIDEN: mørkt, transparent stadionglass — arenaBottom
   * som tint (designregelen: mørkt glass kjennetegner kamp). JS-only
   * første forsøk: kun tinten byttes, geometrien er identisk. Blekket i
   * baren er opalhvitt (`matchColors.text`/`dim`) i denne varianten.
   */
  barMatch: {tint: 'rgba(29, 70, 51, 0.62)', sheen: 0.06, interactive: false},
  /**
   * Solid varm perle for `important` uten glass (Android / Reduce
   * Transparency / eldre iOS): tinten over lysfelt-grunnen regnet ut til én
   * flat farge, så materialretningen beholdes — IKKE det mettede
   * `colors.sun`-papiret. Kanten er goldInk-blekk, svakt.
   */
  importantSolid: '#F4F1E6',
  importantSolidEdge: 'rgba(92, 74, 0, 0.14)',
  /** Solid perle for baren uten glass (= OPAL.solid) + svak heiaDeep-kant. */
  barSolid: '#EFF3F1',
  barSolidEdge: 'rgba(8, 57, 46, 0.1)',
  /** Solid arena for kampbaren uten glass + svak opalhvit kant. */
  barMatchSolid: '#1D4633',
  barMatchSolidEdge: 'rgba(234, 255, 246, 0.16)',
} as const;

/**
 * Flat fallback per variant (Android / Reduce Transparency / eldre iOS).
 * Kort og kontrollglass går til `OpalSurface`; disse tre er én flat View.
 */
const SOLID: Partial<Record<GlassVariant, {fill: string; edge: string}>> = {
  important: {fill: GLASS.importantSolid, edge: GLASS.importantSolidEdge},
  bar: {fill: GLASS.barSolid, edge: GLASS.barSolidEdge},
  barMatch: {fill: GLASS.barMatchSolid, edge: GLASS.barMatchSolidEdge},
};

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
  /**
   * Fyll forelderen (absoluteFill) i stedet for å måle seg etter barna.
   * Tab-barens kapsel: glasset er bakgrunnen, fanene legges ut av
   * biblioteket OVER den.
   */
  fill?: boolean;
  children?: React.ReactNode;
}

export function LiquidGlassSurface({
  style,
  pressed = false,
  variant = 'card',
  cornerRadius = radius.xl,
  fill = false,
  children,
}: LiquidGlassSurfaceProps) {
  const {reduceTransparency} = useMaterialAccessibility();
  const glass = GLASS[variant];
  const fillStyle = fill ? StyleSheet.absoluteFill : null;
  if (!FEED_LIQUID_GLASS_AB || !NativeGlass || reduceTransparency) {
    const solid = SOLID[variant];
    if (solid) {
      return (
        <View
          testID={`glass-solid-${variant}`}
          style={[
            styles.solid,
            variant === 'important' && shadows.cardResting,
            {
              borderRadius: cornerRadius,
              backgroundColor: solid.fill,
              borderColor: solid.edge,
            },
            fillStyle,
            style,
          ]}>
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
      style={[styles.glass, {borderRadius: cornerRadius}, fillStyle]}
      cornerRadius={cornerRadius}
      glassTint={glass.tint}
      sheenOpacity={glass.sheen}
      interactive={glass.interactive}
      pressed={pressed}>
      <View
        style={[
          styles.surface,
          {borderRadius: cornerRadius},
          fillStyle,
          style,
        ]}>
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
  // Flat fallback (important/bar/barMatch). Samme padding-boks: 1 pt kant.
  // Fyll og kant settes per variant fra `SOLID`.
  solid: {
    borderRadius: radius.xl,
    borderWidth: 1,
  },
});
