import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, matchColors, radius} from '../theme';
import {arenaLightCap} from '../shared/teamColors';
import {
  ARC_OPACITY_INNER,
  ARC_OPACITY_OUTER,
  ARC_R_INNER,
  ARC_R_OUTER,
  ARC_STROKE,
  mastheadArcBox,
  type MastheadCard,
} from '../shared/headerGeometry';
import {useMaterialAccessibility} from './useMaterialAccessibility';

/**
 * STADIONGLASS — materialprototype (Brage 2026-09-02). ÉN konsument:
 * kamp-grenen i `NextEventHero` bak `NEXT_MATCH_GLASS_AB`, kun på Hjem.
 *
 * Den ledende materialhypotesen (B-puls): kommende kamp er ROLIG mørkt
 * stadionglass i kampverdenens arenafamilie — dyp grønn, aldri nesten sort.
 * Live blir samme familie med høyere intensitet (egen rad SENERE, ikke her);
 * ferdig kamp blir lys feedpost. Denne komponenten er «calm»-raden alene.
 *
 * ⚠️ GLOBALE `StadiumSurface` (12 konsumenter) OG `HeroSurface` (5) RØRES
 * IKKE. Dette er en eksplisitt, isolert variant — ingen pensjonering.
 *
 * ---------------------------------------------------------------------------
 * LAGENE, nederst først. Runde 2 (Brages tre godkjente justeringer etter den
 * visuelle kontrollen mot referansene, 2026-09-02): kantLYS i stedet for
 * outline, refleks som LYS i stedet for fargeflekk, dypere tonal reise.
 *
 *   base     linear ~150°, arenaTop → arenaBottom (40 %, var 55 %) →
 *            timeline. Opasitet 0,96: grunnen under farger flaten svakt.
 *            Reduce Transparency → 1 og solid bunn på ytterboksen.
 *   opptak   grunnens lys i øvre venstre hjørne: heiaAqua 0,05 → 0. Svært
 *            svakt med vilje — det er retningen på lyset, ikke en glød.
 *   team     lagfargerefleks i hjørnet over pillen. Lagfargen LØFTES 40 %
 *            mot hvitt FØR blanding, fordi en rå mørk lagfarge (marine,
 *            sort) blandet inn i en mørk flate gjør den mørkere — en flekk,
 *            ikke et lys. Styrke min(0,18, arenaLightCap(løftet farge)):
 *            klemmen måler den fargen som faktisk tegnes. Increase
 *            Contrast → halv. Lagfargen ligger fortsatt OPPÅ grunnen, aldri
 *            inni — et rødt lag blir varmt, ikke brunt.
 *   neon     Heia-refleks KONSENTRERT i nedre høyre hjørne under buene
 *            (0,16, mindre radius) — banen under flomlys, ikke glød under
 *            «12 kommer». Increase Contrast → halv.
 *   høylys   1,5 pt rett under kanten langs toppen, tyngdepunkt venstre.
 *   kant     gradientstrøk, 1,5 pt synlig: aqua-tonet hvitt 0,40 øverst til
 *            venstre → 0,16 → 0,06 nederst til høyre. Lyset som treffer
 *            materialet, ikke en ramme. Increase Contrast: uniform hvit
 *            0,45, samme bredde. Strøket tegnes 3 pt sentrert på kanten og
 *            klippes til den avrundede formen, så den synlige halvdelen er
 *            nøyaktig 1,5 pt også i hjørnene (ingen onLayout).
 *   buer     banebuene fra StadiumSurface, samme geometri, neon 0,10/0,07.
 *   skygge   grønn (#0B3B2A) 0,22 som `boxShadow` (RN 0.83, Fabric): iOS
 *            tegner den fra border-boksen uavhengig av flatens alfa, Android
 *            (OutsetBoxShadowDrawable) klipper border-boksen UT. Ligger på
 *            ytterboksen uten overflow: hidden, så ingen plattform klipper.
 *
 * GEOMETRIEN ER UENDRET fra runde 1: svg-en bor nå på YTTERBOKSEN (den har
 * ingen kant, så absoluteFill = hele border-boksen), og innerboksen beholder
 * `borderWidth: 1` med gjennomsiktig farge — padding-boksen barna ser er
 * identisk. Ingen blur, ingen pakker, ingen bevegelse.
 */

export const GLASS = {
  baseOpacity: 0.96,
  /** Mellomstoppet — 0,40 gir mer av kortet i den dypere tonen. */
  baseMidStop: 0.4,
  /** Refleksens maksstyrke (Brages testverdi). */
  teamReflex: 0.18,
  /** Hvor mye lagfargen løftes mot hvitt før blanding — refleks som LYS. */
  teamLift: 0.4,
  neonReflex: 0.16,
  /** Aqua-opptaket i øvre venstre hjørne. Briefens heiaAqua, lokal med vilje. */
  uptake: 0.05,
  uptakeColor: '#8FFFE0',
  /** Kantlyset: hvitt med et drag mot aqua. */
  edgeColor: '#D6FFF1',
  edgeTop: 0.4,
  edgeMid: 0.16,
  edgeBottom: 0.06,
  /** Synlig strøkbredde i pt. Tegnes 2× og klippes. */
  edgeWidth: 1.5,
  edgeContrast: 0.45,
  /** Indre topphøylys — 1,5 pt under kanten, sterkest ved 32 % fra venstre. */
  highlight: 0.14,
  shadow: 'rgba(11, 59, 42, 0.22)',
  /** Kompakt (feedkort): lettere skygge — mindre flate, tynnere materiale. */
  shadowCompact: 'rgba(11, 59, 42, 0.18)',
  /**
   * KOMPAKT-TRINNET (Brage 2026-09-10: «feed-kampkortet skal tydelig føles
   * som Compact StadiumGlass, altså underordnet heroen»).
   *
   * Fram til nå var `compact` KUN en lettere skygge — materialet var ellers
   * identisk med heroen, og de to konkurrerte. Nå er det et ekte trinn:
   * lyset dempes (lagrefleks, neon, aqua-opptak, topphøylys), og buene
   * legger seg lenger tilbake. Basen og KANTEN røres ikke — det er de som
   * gir kortet form, og et utvasket kort ville bare sett uskarpt ut.
   */
  compactLight: 0.6,
  compactArcOuter: 'rgba(2, 255, 171, 0.055)',
  compactArcInner: 'rgba(2, 255, 171, 0.04)',
  /** Trykk: hvitt lys presset inn i glasset (JS-motstykket til native 0,16 på lyst). */
  pressLight: 0.1,
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Lagfargen løftet mot hvitt (GLASS.teamLift). Null for ugyldig farge —
 * ingen refleks, ikke en gjetning. Dette er fargen som TEGNES og fargen
 * klemmen måler; ren rød blir #E88080 og ren gul #FFDC8B, men det er
 * blandingen ved 6–18 % over dyp grønn øyet ser, og den leser som varmt lys.
 */
export function liftTeamColor(teamColor: string): string | null {
  if (!HEX.test(teamColor)) return null;
  const channel = (i: number) => {
    const v = parseInt(teamColor.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(v + (255 - v) * GLASS.teamLift)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * Hvor sterkt lagfargen får lyse i hjørnet. Klemmen er arenaens
 * (`arenaLightCap`, samme flate som toppstoppet), målt på den LØFTEDE
 * fargen; taket er Brages maksstyrke.
 */
export function teamReflexStrength(
  teamColor: string | undefined,
  increaseContrast: boolean,
): number {
  const lifted = teamColor ? liftTeamColor(teamColor) : null;
  if (!lifted) return 0;
  const strength = Math.min(GLASS.teamReflex, arenaLightCap(lifted).peak);
  return increaseContrast ? strength / 2 : strength;
}

interface StadiumGlassProps {
  /** Lagets farge — refleksen i hjørnet over pillen. Uten: ingen refleks. */
  teamColor?: string;
  /** Padding/gap — legges oppå flaten (innerboksen). */
  style?: StyleProp<ViewStyle>;
  /**
   * Kompakt variant (Brage 2026-09-02, designregel: MØRKT GLASS KJENNETEGNER
   * KAMP): kampinnleggene i feeden deler dette materialet med kommende-kamp-
   * heroen — samme base, opptak, refleks, neon, kant, høylys og buer. Det
   * eneste som skalerer er skyggen (mindre flate → lettere skygge).
   */
  compact?: boolean;
  /** Trykk (Pressable): lys presses inn i glasset. Skalering eier Pressable. */
  pressed?: boolean;
  /** Trykkfysikken fra `useGlassPress`: lyset inn i glasset, animert. */
  pressLight?: Animated.AnimatedInterpolation<number>;
  /**
   * KORTET STÅR RETT UNDER LAGHODET (Brage 2026-09-10: «legg til samme bue
   * på det kortet på toppen»). Da byttes kortets egne buer ut med lerretets
   * sirkel, tegnet videre gjennom kortets kant — samme sentrum, samme
   * radier, samme kritt (`mastheadArcBox`). Kun Hjem-heroen sender den;
   * kampinnleggene i feeden beholder sine egne, roligere mint-buer.
   */
  mastheadCard?: MastheadCard;
  children?: React.ReactNode;
}

/**
 * TRYKKFYSIKKEN FRA DET LYSE GLASSET, I JS (Brage 2026-09-06: «kampkortet
 * skal oppføre seg likt som det lyse kortet når man scroller og tar tak i
 * det»). Speiler HeiaLiquidGlassView sin UILongPressGestureRecognizer:
 * touch-down → lys 0,16 + skala 0,98 + 1 pt ned på 120 ms; bevegelse > 12 pt
 * (scroll), slipp eller avbrudd → tilbake på 300 ms, alltid fra nåverdien.
 * Rå touch-hendelser, ikke responder-kjeden: barna (piller, ⋯) trykker som
 * før, og kortet lyser likevel under dem. Reduce Motion → kun lys.
 */
export const PRESS = {
  light: 0.16,
  scale: 0.98,
  drop: 1,
  slop: 12,
  inMs: 120,
  outMs: 300,
} as const;

export function useGlassPress() {
  const value = useRef(new Animated.Value(0)).current;
  const start = useRef<{x: number; y: number} | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (live) {
        setReduceMotion(v);
      }
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const drive = useCallback(
    (down: boolean) => {
      Animated.timing(value, {
        toValue: down ? 1 : 0,
        duration: down ? PRESS.inMs : PRESS.outMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [value],
  );
  const handlers = useMemo(
    () => ({
      onTouchStart: (e: GestureResponderEvent) => {
        start.current = {x: e.nativeEvent.pageX, y: e.nativeEvent.pageY};
        drive(true);
      },
      onTouchMove: (e: GestureResponderEvent) => {
        const s = start.current;
        if (!s) {
          return;
        }
        const dx = e.nativeEvent.pageX - s.x;
        const dy = e.nativeEvent.pageY - s.y;
        if (Math.hypot(dx, dy) > PRESS.slop) {
          start.current = null; // fingeren scroller — slipp glasset
          drive(false);
        }
      },
      onTouchEnd: () => {
        start.current = null;
        drive(false);
      },
      onTouchCancel: () => {
        start.current = null;
        drive(false);
      },
    }),
    [drive],
  );
  const light = value.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PRESS.light],
  });
  const style = reduceMotion
    ? undefined
    : {
        transform: [
          {
            translateY: value.interpolate({
              inputRange: [0, 1],
              outputRange: [0, PRESS.drop],
            }),
          },
          {
            scale: value.interpolate({
              inputRange: [0, 1],
              outputRange: [1, PRESS.scale],
            }),
          },
        ],
      };
  return {light, style, handlers};
}

const FULL = {x: '0', y: '0', width: '100%', height: '100%'} as const;

export function StadiumGlass({
  teamColor,
  style,
  compact = false,
  pressed = false,
  pressLight,
  mastheadCard,
  children,
}: StadiumGlassProps) {
  const {reduceTransparency, increaseContrast} = useMaterialAccessibility();
  const lifted = useMemo(
    () => (teamColor ? liftTeamColor(teamColor) : null),
    [teamColor],
  );
  const team = useMemo(
    () => teamReflexStrength(teamColor, increaseContrast),
    [teamColor, increaseContrast],
  );
  const half = increaseContrast ? 0.5 : 1;
  // Kompakt = samme material-DNA, dempet lys. Se `GLASS.compactLight`.
  const damp = compact ? GLASS.compactLight : 1;
  const neon = GLASS.neonReflex * half * damp;
  const uptake = GLASS.uptake * half * damp;
  const edgeColor = increaseContrast ? '#FFFFFF' : GLASS.edgeColor;
  const edgeStops = increaseContrast
    ? [GLASS.edgeContrast, GLASS.edgeContrast, GLASS.edgeContrast]
    : [GLASS.edgeTop, GLASS.edgeMid, GLASS.edgeBottom];

  // MÅLT LERRET (Brage 2026-09-06: «bunnen av kampkortet kuttes i
  // kommentararket»): rn-svg regner prosent mot sin EGEN første oppmålte
  // størrelse og henger igjen der (samme felle som MatchEventRow). I arket
  // får kortet første layout før innholdet er ferdig, så kroppen stoppet
  // over platen. Høyden måles og gis i PUNKTER; prosent bare til første
  // måling.
  const [box, setBox] = useState({w: 0, h: 0});
  const onBoxLayout = useCallback(
    (e: {nativeEvent: {layout: {width: number; height: number}}}) => {
      const {width, height} = e.nativeEvent.layout;
      setBox(prev =>
        prev.w === width && prev.h === height ? prev : {w: width, h: height},
      );
    },
    [],
  );

  return (
    <View
      onLayout={onBoxLayout}
      style={[
        compact ? styles.shadowCompact : styles.shadow,
        reduceTransparency && styles.shadowSolid,
      ]}>
      {/* ATMOSFÆRE, IKKE INNHOLD — skjult for skjermleser, som MatchGround. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width={box.w || '100%'} height={box.h || '100%'}>
          <Defs>
            <ClipPath id="sgClip">
              <Rect {...FULL} rx={radius.xl} ry={radius.xl} />
            </ClipPath>
            <LinearGradient id="sgBase" x1="22%" y1="0%" x2="78%" y2="100%">
              <Stop offset="0" stopColor={matchColors.arenaTop} />
              <Stop
                offset={GLASS.baseMidStop}
                stopColor={matchColors.arenaBottom}
              />
              <Stop offset="1" stopColor={matchColors.timeline} />
            </LinearGradient>
            <RadialGradient id="sgUptake" cx="0%" cy="0%" rx="56%" ry="82%">
              <Stop
                offset="0"
                stopColor={GLASS.uptakeColor}
                stopOpacity={uptake}
              />
              <Stop
                offset="0.7"
                stopColor={GLASS.uptakeColor}
                stopOpacity={0}
              />
            </RadialGradient>
            {lifted && team > 0 && (
              <RadialGradient id="sgTeam" cx="10%" cy="-12%" rx="58%" ry="84%">
                <Stop offset="0" stopColor={lifted} stopOpacity={team * damp} />
                <Stop offset="0.62" stopColor={lifted} stopOpacity={0} />
              </RadialGradient>
            )}
            <RadialGradient id="sgNeon" cx="96%" cy="108%" rx="46%" ry="72%">
              <Stop offset="0" stopColor={colors.heia} stopOpacity={neon} />
              <Stop offset="0.62" stopColor={colors.heia} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="sgEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop
                offset="0"
                stopColor={edgeColor}
                stopOpacity={edgeStops[0]}
              />
              <Stop
                offset="0.5"
                stopColor={edgeColor}
                stopOpacity={edgeStops[1]}
              />
              <Stop
                offset="1"
                stopColor={edgeColor}
                stopOpacity={edgeStops[2]}
              />
            </LinearGradient>
            <LinearGradient id="sgHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0.02" stopColor={edgeColor} stopOpacity={0} />
              <Stop
                offset="0.32"
                stopColor={edgeColor}
                stopOpacity={GLASS.highlight * damp}
              />
              <Stop offset="0.95" stopColor={edgeColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <G clipPath="url(#sgClip)">
            <Rect
              {...FULL}
              fill="url(#sgBase)"
              fillOpacity={reduceTransparency ? 1 : GLASS.baseOpacity}
            />
            <Rect {...FULL} fill="url(#sgUptake)" />
            {lifted && team > 0 && <Rect {...FULL} fill="url(#sgTeam)" />}
            <Rect {...FULL} fill="url(#sgNeon)" />
            <Rect
              x="0"
              y={GLASS.edgeWidth}
              width="100%"
              height={GLASS.edgeWidth}
              fill="url(#sgHighlight)"
            />
            <Rect
              {...FULL}
              rx={radius.xl}
              ry={radius.xl}
              fill="none"
              stroke="url(#sgEdge)"
              strokeWidth={GLASS.edgeWidth * 2}
            />
          </G>
        </Svg>
      </View>

      <View style={[styles.surface, style]}>
        {mastheadCard ? (
          <>
            <View
              style={[
                styles.arcMasthead,
                styles.arcMastheadOuter,
                mastheadArcBox(ARC_R_OUTER, mastheadCard),
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.arcMasthead,
                styles.arcMastheadInner,
                mastheadArcBox(ARC_R_INNER, mastheadCard),
              ]}
              pointerEvents="none"
            />
          </>
        ) : (
          <>
            <View
              style={[styles.arcOuter, compact && styles.arcOuterCompact]}
              pointerEvents="none"
            />
            <View
              style={[styles.arcInner, compact && styles.arcInnerCompact]}
              pointerEvents="none"
            />
          </>
        )}
        {pressed && <View style={styles.pressLight} pointerEvents="none" />}
        {pressLight !== undefined && (
          <Animated.View
            style={[styles.pressLightAnimated, {opacity: pressLight}]}
            pointerEvents="none"
          />
        )}
        {children}
      </View>
    </View>
  );
}

/** Lerretets krittfarge (= `colors.stadiumText`) med gitt styrke. */
const CHALK = (alpha: number) => `rgba(234, 255, 246, ${alpha})`;

const styles = StyleSheet.create({
  /**
   * ⚠️ INGEN SLAGSKYGGE PÅ DEN STORE FLATEN (Brage 2026-09-10: «du har lagt
   * til et skille som en skygge mellom kamp hero og det under»). En 28 pt
   * myk skygge under et fullbreddes kort leser som en STREK tvers over
   * skjermen, ikke som dybde. Kortet står på egne ben: materialet og kanten
   * skiller det fra grunnen. Den kompakte varianten (feedens kampinnlegg)
   * beholder sin lettere skygge — den er telefongodkjent.
   */
  shadow: {
    borderRadius: radius.xl,
  },
  shadowCompact: {
    borderRadius: radius.xl,
    boxShadow: [
      {offsetX: 0, offsetY: 4, blurRadius: 16, color: GLASS.shadowCompact},
    ],
  },
  pressLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(255, 255, 255, ${GLASS.pressLight})`,
  },
  // Animert lys (useGlassPress): hvitt lag, opasiteten er trykkverdien.
  pressLightAnimated: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  // Reduce Transparency: solid bunn under den (da ugjennomsiktige) svg-en.
  shadowSolid: {
    backgroundColor: matchColors.arenaBottom,
  },
  surface: {
    borderRadius: radius.xl,
    // Gjennomsiktig kant, ikke fjernet: padding-boksen barna ser skal være
    // identisk med runde 1 (og med StadiumSurface). Kanten tegnes i svg-en.
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  /**
   * Lerretets sirkel, tegnet videre inne i kortet (`mastheadCard`). Samme
   * KRITT som `DaylightGround` ArcFamily — ikke kortets mint: linjen skal
   * leses som ÉN linje som krysser kortets kant, og da må den ha samme
   * farge og styrke på begge sider av kanten.
   */
  arcMasthead: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: ARC_STROKE,
  },
  arcMastheadOuter: {
    borderColor: CHALK(ARC_OPACITY_OUTER),
  },
  arcMastheadInner: {
    borderColor: CHALK(ARC_OPACITY_INNER),
  },
  // Banebuene — identisk geometri som StadiumSurface, litt roligere kritt.
  arcOuter: {
    position: 'absolute',
    right: -70,
    bottom: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.10)',
  },
  arcInner: {
    position: 'absolute',
    right: -38,
    bottom: -58,
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.07)',
  },
  // Kompakt: buene legger seg lenger tilbake enn i heroen.
  arcOuterCompact: {
    borderColor: GLASS.compactArcOuter,
  },
  arcInnerCompact: {
    borderColor: GLASS.compactArcInner,
  },
});
