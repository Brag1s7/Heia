import React, {useEffect, useState} from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  UIManager,
  View,
  requireNativeComponent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, matchColors, radius, shadows} from '../theme';
import {
  BACKDROP_SOURCE_ID,
  FEED_EDGES,
  FEED_FROST,
  FEED_GLASS,
  FEED_MATERIAL,
  FROST,
  FEED_REFRACTION,
  FEED_SHADOW,
  SILVER,
  PEARL_ASPECT,
  PEARL_EDGE,
  PEARL_NATIVE,
  SILVER_LAYERS,
  SILVER_MODE,
  rgbaString,
  type AnchoredBlob,
} from '../shared/glassOptics';
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
 *   card       feedkortet — FEEDGLASS V3.1, REFRAKTIVT (Brage 2026-09-04):
 *              KROPPEN er systemets REGULAR-glass (UIGlassEffectStyleRegular)
 *              UTEN tint (alfa 0 → tintColor nil): Apples adaptive frost,
 *              lyshet og kantlinse. Med `refraction` sampler native-viewet
 *              grunnen (DaylightGround via nativeID) og legger utsnittet
 *              forstørret og bøyd gjennom store linsesoner BAK glasset, så
 *              systemet frosser den deformerte grunnen — se
 *              HeiaLiquidGlassView.m. Historikk samme dag: 0,34 perlegrå
 *              leste flatt; A2 (0,72 + hvit fade) AVVIST som hvit plate;
 *              V2 (0,34 + malte SVG-felt) AVVIST: «et SVG-overlay kan ikke
 *              lese, forskyve, forstørre eller deformere pikslene bak»; V3
 *              (Clear + 0,08) AVVIST: for klart, «en grønn kopi av
 *              bakgrunnen» — Clear er permanent gjennomsiktig uten
 *              adaptivitet («Meet Liquid Glass»).
 *   control    compose-boksen: «tynt, lyst og nøytralt kontrollglass» —
 *              nesten hvit 0,20 (~60 % grunn), halv sheen, INGEN trykk-
 *              respons (feltet og kameraknappen er kontrollene).
 *   important  festet VIKTIG-kort: SAMME refraktive glass, varm hue i den
 *              svake tinten. Trykkrespons på (åpner kommentartråden).
 *              Gullpillen bærer aksenten; INGEN uniform gullkant. Ikke
 *              mørkt, ikke cardSun-papir.
 *
 * KANTFYSIKKEN (`optics`-propen): lys, presis ytterkant topp/venstre, smalt
 * indre høylys i øvre venstre hjørne, svak mørk/teal indre kant bunn/høyre —
 * SVG-strøk klippet til radiusen, ingen fyll — og en myk Heia Deep-skygge
 * på en wrapper. Eksplisitt per flate: feedkortet og originalinnlegget i
 * tråden. REFRAKSJONEN (`refraction`-propen) er kun feedkortets: tråden
 * ligger på arkets solide bunn, ikke på grunnen.
 */
export type GlassVariant =
  | 'card'
  | 'control'
  | 'important'
  | 'bar'
  | 'barMatch'
  | 'sheet'
  | 'panel';

export const GLASS = {
  card: {
    tint: rgbaString(FEED_GLASS.card.pearl, FEED_GLASS.card.alpha),
    sheen: FEED_GLASS.card.sheen,
    interactive: true,
  },
  control: {tint: 'rgba(244, 246, 245, 0.2)', sheen: 0.09, interactive: false},
  important: {
    tint: rgbaString(FEED_GLASS.important.pearl, FEED_GLASS.important.alpha),
    sheen: FEED_GLASS.important.sheen,
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
   * ARKENE (Brage 2026-09-03): månedsvisningen fra «Måned», «Ny hendelse»
   * («+ Ny» på Kalender og «Ny kamp» fra Sesongen). «Ganske tungt glass»:
   * den tyngste perlen i familien, 0,80 — rutenettet og skjemaet skal være
   * ekstremt lesbart, men grunnen skal fortsatt farge flaten (over neon blir
   * arket lys mint, over teal kjølig perle). Lite sheen: et ark skinner
   * ikke. Ingen scrim over siden bak — arket er et parallelt panel, ikke en
   * blokkerende oppgave (Emil: «dim to focus, separate to keep flow»).
   * Blekket på arket er OPAL.ink* (kontrastporten i glassSheet.test).
   */
  sheet: {tint: 'rgba(244, 246, 245, 0.8)', sheen: 0.1, interactive: false},
  /**
   * PROFILS GRUPPER (Brage 2026-09-04: «kantene ser billige ut og boksene er
   * for hvite … mer glassaktig, som resten av appen»): action-gruppa og
   * menygruppene er feedkortets perle og sheen — uten trykkrespons i
   * glasset, for radene inni er kontrollene (samme grunn som `sheet` på
   * Varsler). Lagkortene står i `sheet`. Den matte svg-opalen med kantring
   * (`OpalSurface panel`) er bare fallbacken uten glass.
   * ⚠️ ALFAEN ER BEVISST IKKE KORTETS (2026-09-04): panelet står på det
   * telefongodkjente 0,34 og røres ikke i FeedCard-skiva (Brage: «Profil-
   * panel … står urørt»). Gruppene ligger lenger ned på reisen og tåler
   * tynt glass. Skal panelet følge kortet, er det en egen beslutning.
   */
  panel: {tint: 'rgba(233, 235, 234, 0.34)', sheen: 0.18, interactive: false},
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
  /** Solid perle for arkene uten glass (= OPAL.solid) + svak heiaDeep-kant. */
  sheetSolid: '#EFF3F1',
  sheetSolidEdge: 'rgba(8, 57, 46, 0.12)',
  /**
   * KANTEN PÅ DEN SCROLL-TRYGGE FLATEN (`unbounded`): en lys hårlinje som
   * leser som materialets kant, ikke som en ramme, pluss en litt lysere
   * strek langs toppen — lyset som treffer flaten der den begynner.
   * Erstatter den optiske kanten UIGlassEffect ellers tegner selv.
   */
  unboundedEdge: 'rgba(255, 255, 255, 0.38)',
  unboundedTop: 'rgba(255, 255, 255, 0.55)',
} as const;

export type OpticsVariant = 'card' | 'important';

/** Klart glass på innholdskortene; resten standard (adaptiv) systemglass. */
/**
 * Trykklysets farge per variant (Brage 2026-09-06): hvitt 0,16 på det lyse
 * kortet vasket ut alt («ser ut som noe er feil»); kampkortets hvite lys på
 * mørkt er riktig. Innholdskortene får mint, resten hvitt.
 */
export const GLASS_PRESS: Partial<Record<GlassVariant, string>> = {
  card: FROST.press,
  important: FROST.press,
};

export const GLASS_STYLE: Partial<Record<GlassVariant, 'clear' | 'regular'>> = {
  card: FEED_GLASS.card.style,
  important: FEED_GLASS.important.style,
};

/** Prosent av boksen. */
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/**
 * MATERIALLAGET — ARENAGLASS, LYS (Brage 2026-09-04, kveld). Ligger over
 * systemglasset (Clear + arena-dimming), under innholdet. Nederst først:
 * tonal fade som kampkortet (150°), mørk Heia Deep-sky + lys sky (alfa-PNG,
 * eget utsnitt per kort → ujevn tetthet), aqua-opptak øvre venstre,
 * neon-refleks nedre høyre, høylyslinje under toppkanten, kantstrøk.
 * Skyggen bor på wrapperen; spekularbåndet (bevegelse) er native.
 * Atmosfære, ikke innhold: ingen trykk, skjult for skjermleser. Monteres
 * SAMMEN med flaten (statisk), så det trenger ingen `contentVersion`.
 * Alle tall: FEED_FROST / FEED_EDGES (Fast Refresh).
 */
const FROST_LIGHT = require('../assets/images/frost-light.png');
const FROST_DARK = require('../assets/images/frost-dark.png');
// @2x-navn → 420 pt fliser (uten suffiks tolket RN 840 px som 840 pt og skalerte
// «repeat»-flisen ned til boksen → synlig søm på telefonen 2026-09-06).
// 1x + @2x på disk: Metro velger skala, jest finner 1x-filen.
const SILK_WAVE = require('../assets/images/silk-wave.png');
const SILK_SPEC = require('../assets/images/silk-spec.png');
/** Brages materialtekstur (SILVER_MODE 'texture'), 1916×821 JPEG. */
const PEARL_CARD = require('../assets/images/pearl-card.jpeg');
const FULL = {x: '0', y: '0', width: '100%', height: '100%'} as const;

/**
 * BRAGES MATERIALTEKSTUR som bildeflate (SILVER_MODE 'texture'). Måler boksen
 * (onLayout) og tegner JPEG-en i kortets bredde, ankret i toppen. Kort som er
 * høyere enn teksturen (bildekort) får speilvendte kopier under — skjøten er
 * sømløs, men motivet gjentas; tilpasset komposisjon for bildekort er neste
 * runde. Ingen filtre, ingen svg, intet systemglass: én dekodet JPEG per kort.
 */
function PearlTexture() {
  const [size, setSize] = useState<{width: number; height: number}>();
  const texH = size ? size.width / PEARL_ASPECT : 0;
  const copies = size ? Math.max(1, Math.ceil(size.height / texH)) : 0;
  return (
    <View
      testID="pearl-texture"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={e => {
        const {width, height} = e.nativeEvent.layout;
        setSize(prev =>
          prev && prev.width === width && prev.height === height
            ? prev
            : {width, height},
        );
      }}>
      {size !== undefined &&
        Array.from({length: copies}, (_, i) => (
          <Image
            key={i}
            testID="pearl-card"
            source={PEARL_CARD}
            resizeMode="cover"
            style={[
              styles.pearlCopy,
              {
                top: i * texH,
                width: size.width,
                height: texH,
                transform: [{scaleY: i % 2 ? -1 : 1}],
              },
            ]}
          />
        ))}
      {size !== undefined && PEARL_EDGE.enabled && (
        <PearlEdge width={size.width} height={size.height} r={radius.xl} />
      )}
    </View>
  );
}

/**
 * Kant og hjørneglans rundt teksturen — se PEARL_EDGE. Én svg uten filtre:
 * to sølvgrå dybdefelt (TR, BL), to hjørnebuer (TL, BR) og kantlyset.
 */
function PearlEdge({
  width: w,
  height: h,
  r,
}: {
  width: number;
  height: number;
  r: number;
}) {
  const {edge, gloss, depth} = PEARL_EDGE;
  const arc = (cx: number, cy: number, a0: number) => {
    // Bue langs hjørnets radius (innenfor `inset`), fra a0 over `reach` av 90°.
    const rr = r - gloss.inset;
    const a1 = a0 + (Math.PI / 2) * gloss.reach;
    const p = (a: number) =>
      `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
    return `M${p(a0)} A${rr} ${rr} 0 0 1 ${p(a1)}`;
  };
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient
          id="peEdge"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={w}
          y2={h}>
          {edge.stops.map(([at, color, alpha]) => (
            <Stop key={at} offset={at} stopColor={color} stopOpacity={alpha} />
          ))}
        </LinearGradient>
        <RadialGradient id="peDepth" cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor={depth.color} stopOpacity={depth.alpha} />
          <Stop offset={1} stopColor={depth.color} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id="peClip">
          <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#peClip)">
        <Ellipse
          testID="pearl-depth-tr"
          cx={w - 10}
          cy={10}
          rx={depth.radius}
          ry={depth.radius * 0.7}
          fill="url(#peDepth)"
        />
        <Ellipse
          testID="pearl-depth-bl"
          cx={10}
          cy={h - 10}
          rx={depth.radius}
          ry={depth.radius * 0.7}
          fill="url(#peDepth)"
        />
        <Path
          testID="pearl-gloss-tl"
          d={arc(r, r, Math.PI)}
          stroke="#FFFFFF"
          strokeOpacity={gloss.alpha}
          strokeWidth={gloss.width}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          testID="pearl-gloss-br"
          d={arc(w - r, h - r, 0)}
          stroke="#FFFFFF"
          strokeOpacity={gloss.alpha}
          strokeWidth={gloss.width}
          strokeLinecap="round"
          fill="none"
        />
        <Rect
          testID="pearl-edge"
          x={edge.width / 2}
          y={edge.width / 2}
          width={w - edge.width}
          height={h - edge.width}
          rx={r - edge.width / 2}
          ry={r - edge.width / 2}
          stroke="url(#peEdge)"
          strokeWidth={edge.width}
          fill="none"
        />
      </G>
    </Svg>
  );
}

/**
 * FROST (prototypen, vedtatt 2026-09-06): materiallaget er KUN kanten —
 * lys topp/venstre, svak blekk-kant nede/høyre. Kroppen er systemglasset.
 */
export function FrostEdges({cornerRadius}: {cornerRadius: number}) {
  return (
    <View
      pointerEvents="none"
      testID="glass-optics"
      style={[
        StyleSheet.absoluteFill,
        styles.frostEdge,
        {
          borderRadius: cornerRadius,
          borderTopColor: FROST.edge.top,
          borderLeftColor: FROST.edge.left,
          borderRightColor: FROST.edge.right,
          borderBottomColor: FROST.edge.bottom,
        },
      ]}
    />
  );
}

/** Materiallaget — følger A/B-bryteren `FEED_MATERIAL` (glassOptics). */
export function GlassOptics({cornerRadius}: {cornerRadius: number}) {
  if (FEED_MATERIAL === 'frost') {
    return <FrostEdges cornerRadius={cornerRadius} />;
  }
  return FEED_MATERIAL === 'silver' ? (
    <SilverOptics cornerRadius={cornerRadius} />
  ) : (
    <ArenaOptics cornerRadius={cornerRadius} />
  );
}

/**
 * SØLVGLASS R2 — tykt, frostet glass (Brage 2026-09-06, runde 2). Alle tall
 * og hele begrunnelsen i `SILVER` (glassOptics.ts). Tegnes i PIKSELROM etter
 * målt kortstørrelse (onLayout), så skulder, glans og frostflak holder samme
 * fysiske størrelse på et 150 pt tekstkort og et 600 pt bildekort. Nederst
 * først: kropp → dybde (blur) → skyer → frost (blur) → glans (skarp) →
 * skulder (skarp + én myk skygge). Statisk per kort: null kostnad under
 * scroll (filtrene kjører ved layout, laget rasteriseres).
 */
function blobAt(b: AnchoredBlob, w: number, h: number) {
  const ry = b.ryGrow !== undefined ? Math.max(b.ry, h * b.ryGrow) : b.ry;
  const cx = b.ax * w + (b.dx ?? 0);
  const cy = b.ay * h + (b.dy ?? 0);
  return {cx, cy, ry, transform: `rotate(${b.rotate ?? 0} ${cx} ${cy})`};
}

export function SilverOptics({
  cornerRadius,
  size: fixedSize,
}: {
  cornerRadius: number;
  /** Riggen/tester: målt størrelse uten onLayout. */
  size?: {width: number; height: number};
}) {
  const [measured, setMeasured] = useState<{width: number; height: number}>();
  const size = fixedSize ?? measured;
  const seed = React.useRef(Math.random()).current;
  const flipX = seed < 0.5;
  const shift = Math.round(((seed * 13) % 1) * 40) - 20;
  const texSize = `${Math.round(SILVER.cloud.scale * 100)}%`;
  const texOffset = `${-Math.round(((SILVER.cloud.scale - 1) / 2) * 100)}%`;
  const textureStyle = {
    position: 'absolute' as const,
    left: texOffset,
    top: texOffset,
    width: texSize,
    height: texSize,
  };
  const onLayout = fixedSize
    ? undefined
    : (e: LayoutChangeEvent) => {
        const {width, height} = e.nativeEvent.layout;
        setMeasured(prev =>
          prev && prev.width === width && prev.height === height
            ? prev
            : {width, height},
        );
      };
  return (
    <View
      testID="glass-optics"
      onLayout={onLayout}
      style={[
        StyleSheet.absoluteFill,
        styles.opticsClip,
        {borderRadius: cornerRadius},
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {size !== undefined && (
        <SilverDrawing
          width={size.width}
          height={size.height}
          r={cornerRadius}
          flipX={flipX}
          shift={shift}
          textureStyle={textureStyle}
        />
      )}
    </View>
  );
}

function SilverDrawing({
  width: w,
  height: h,
  r,
  flipX,
  shift,
  textureStyle,
}: {
  width: number;
  height: number;
  r: number;
  flipX: boolean;
  shift: number;
  textureStyle: object;
}) {
  const {rim, highlight, silk} = SILVER;
  const L = SILVER_LAYERS;
  const mirror = flipX ? `translate(${w} 0) scale(-1 1)` : undefined;
  const ring = (inset: number) => ({
    x: inset,
    y: inset,
    width: w - inset * 2,
    height: h - inset * 2,
    rx: Math.max(0, r - inset),
    ry: Math.max(0, r - inset),
    fill: 'none' as const,
  });
  // VIKTIG (simulatorfunn 2026-09-06): react-native-svg leser bare DIREKTE
  // <Stop>-barn i en gradient. En hjelpekomponent/fragment gir null stopp →
  // gradienten tegnes SVART (det var «den mørke rammen»). Stoppene mappes
  // derfor rett inn i hver <LinearGradient>.
  const diagonal = {
    gradientUnits: 'userSpaceOnUse' as const,
    x1: 0,
    y1: 0,
    x2: w,
    y2: h,
  };
  // Silkekartene: 420 pt-fliser, sømløse i y. Ikke `repeat` (RN skalerer
  // flisen til boksen); i stedet tre stablede kopier, annenhver speilvendt i
  // y, med eget utsnitt per kort (shift ∈ [−20, 20] → topp ≤ 0).
  const silkTop = -(shift + 20) * 4;
  const silkCopies = [0, 1, 2].filter(i => silkTop + i * silk.tile < h);
  const silkStyle = (i: number) => ({
    position: 'absolute' as const,
    left: 0,
    top: silkTop + i * silk.tile,
    width: w,
    height: silk.tile,
    transform: [{scaleX: flipX ? -1 : 1}, {scaleY: i % 2 ? -1 : 1}],
  });
  const blobs = (list: ReadonlyArray<AnchoredBlob>, prefix: string) =>
    list.map((b, i) => {
      const p = blobAt(b, w, h);
      return (
        <Ellipse
          key={i}
          testID={`${prefix}-${i}`}
          cx={p.cx}
          cy={p.cy}
          rx={b.rx}
          ry={p.ry}
          transform={p.transform}
          fill={b.color}
          fillOpacity={b.alpha}
        />
      );
    });
  return (
    <>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <Filter id="svDepth" x="-40%" y="-40%" width="180%" height="180%">
            <FeGaussianBlur stdDeviation={SILVER.blur.depth} />
          </Filter>
        </Defs>
        {L.base && (
          <Rect
            testID="silver-base"
            x={0}
            y={0}
            width={w}
            height={h}
            fill={SILVER.pearl}
            fillOpacity={SILVER.base}
          />
        )}
        {L.depth && (
          <G testID="silver-depth" filter="url(#svDepth)">
            {blobs(SILVER.depth, 'silver-depth')}
          </G>
        )}
      </Svg>
      {L.silk &&
        silkCopies.map(i => (
          <Image
            key={i}
            testID="silk-wave"
            source={SILK_WAVE}
            resizeMode="cover"
            style={[silkStyle(i), {opacity: silk.wave}]}
          />
        ))}
      {L.cloud && (
        <Image
          testID="frost-light"
          source={FROST_LIGHT}
          resizeMode="cover"
          style={[
            textureStyle,
            {
              opacity: SILVER.cloud.light,
              transform: [{scaleY: flipX ? 1 : -1}, {translateY: shift}],
            },
          ]}
        />
      )}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <Filter id="svFrost" x="-40%" y="-40%" width="180%" height="180%">
            <FeGaussianBlur stdDeviation={SILVER.blur.frost} />
          </Filter>
          <Filter id="svRim" x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation={SILVER.blur.rim} />
          </Filter>
          <Filter id="svShade" x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation={SILVER.blur.shade} />
          </Filter>
          <LinearGradient id="svHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset={0.02} stopColor="#FFFFFF" stopOpacity={0} />
            <Stop
              offset={highlight.at}
              stopColor="#FFFFFF"
              stopOpacity={highlight.peak}
            />
            <Stop offset={0.95} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="svEdge" {...diagonal}>
            {rim.edge.stops.map(([at, color, alpha]) => (
              <Stop
                key={at}
                offset={at}
                stopColor={color}
                stopOpacity={alpha}
              />
            ))}
          </LinearGradient>
          <LinearGradient
            id="svShadeG"
            gradientUnits="userSpaceOnUse"
            x1={w}
            y1={h}
            x2={0}
            y2={0}>
            {rim.shade.stops.map(([at, color, alpha]) => (
              <Stop
                key={at}
                offset={at}
                stopColor={color}
                stopOpacity={alpha}
              />
            ))}
          </LinearGradient>
          <LinearGradient
            id="svGlowG"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={h}
            x2={w}
            y2={0}>
            {rim.glow.stops.map(([at, color, alpha]) => (
              <Stop
                key={at}
                offset={at}
                stopColor={color}
                stopOpacity={alpha}
              />
            ))}
          </LinearGradient>
          <ClipPath id="svClip">
            <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#svClip)">
          {/* HEIA-LYSET — ansamlinger ved kanten (uskarpe) */}
          {L.heia && (
            <G testID="silver-heia" filter="url(#svFrost)">
              {blobs(SILVER.heia, 'silver-heia')}
            </G>
          )}
          {/* FROST — uskarp, speilvendt per kort */}
          {L.frost && (
            <G testID="silver-frost" filter="url(#svFrost)" transform={mirror}>
              {blobs(SILVER.frost, 'silver-frost')}
            </G>
          )}
          {/* MYK SKULDER: frostbånd mot kanten, skygge BR, grønn glød BL */}
          {L.rimBand && (
            <Rect
              testID="silver-rim-band"
              {...ring(0)}
              stroke="#FFFFFF"
              strokeOpacity={rim.band.alpha}
              strokeWidth={rim.band.width * 2}
              filter="url(#svRim)"
            />
          )}
          {L.rimShade && (
            <Rect
              testID="silver-rim-shade"
              {...ring(rim.shade.width / 2)}
              stroke="url(#svShadeG)"
              strokeWidth={rim.shade.width}
              filter="url(#svShade)"
            />
          )}
          {L.rimGlow && (
            <Rect
              testID="silver-rim-glow"
              {...ring(0)}
              stroke="url(#svGlowG)"
              strokeWidth={rim.glow.width * 2}
              filter="url(#svShade)"
            />
          )}
        </G>
      </Svg>
      {L.spec &&
        silkCopies.map(i => (
          <Image
            key={i}
            testID="silk-spec"
            source={SILK_SPEC}
            resizeMode="cover"
            style={[silkStyle(i), {opacity: silk.spec}]}
          />
        ))}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="svHighlight2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset={0.02} stopColor="#FFFFFF" stopOpacity={0} />
            <Stop
              offset={highlight.at}
              stopColor="#FFFFFF"
              stopOpacity={highlight.peak}
            />
            <Stop offset={0.95} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="svEdge2" {...diagonal}>
            {rim.edge.stops.map(([at, color, alpha]) => (
              <Stop
                key={at}
                offset={at}
                stopColor={color}
                stopOpacity={alpha}
              />
            ))}
          </LinearGradient>
          <ClipPath id="svClip2">
            <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#svClip2)">
          {L.highlight && (
            <Rect
              testID="silver-highlight"
              x={0}
              y={highlight.width}
              width={w}
              height={highlight.width}
              fill="url(#svHighlight2)"
            />
          )}
          {L.edge && (
            <Rect
              testID="silver-edge"
              {...ring(rim.edge.width / 2)}
              stroke="url(#svEdge2)"
              strokeWidth={rim.edge.width}
            />
          )}
        </G>
      </Svg>
    </>
  );
}

/** ARENAGLASSET (V5) — dagens kort, urørt. */
export function ArenaOptics({cornerRadius}: {cornerRadius: number}) {
  const {light, glint, dark} = FEED_EDGES;
  const A = FEED_FROST;
  const r = cornerRadius;
  // Eget utsnitt per kort: speiling og forskyvning, fast for instansen.
  const seed = React.useRef(Math.random()).current;
  const flipX = seed < 0.5 ? -1 : 1;
  const flipY = (seed * 7) % 1 < 0.5 ? -1 : 1;
  const shift = Math.round(((seed * 13) % 1) * 40) - 20;
  const size = `${Math.round(A.scale * 100)}%`;
  const offset = `${-Math.round(((A.scale - 1) / 2) * 100)}%`;
  const textureStyle = {
    position: 'absolute' as const,
    left: offset,
    top: offset,
    width: size,
    height: size,
  };
  const edgeStops = (
    color: string,
    stops: ReadonlyArray<readonly [number, number]>,
  ) =>
    stops.map(([at, alpha]) => (
      <Stop
        key={at}
        offset={at}
        stopColor={color}
        stopOpacity={alpha * A.edge}
      />
    ));
  return (
    <View
      testID="glass-optics"
      style={[StyleSheet.absoluteFill, styles.opticsClip, {borderRadius: r}]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="goFade" x1="22%" y1="0%" x2="78%" y2="100%">
            <Stop
              offset="0"
              stopColor={matchColors.arenaTop}
              stopOpacity={A.fade * 0.4}
            />
            <Stop
              offset="0.4"
              stopColor={matchColors.arenaBottom}
              stopOpacity={A.fade * 0.7}
            />
            <Stop
              offset="1"
              stopColor={matchColors.timeline}
              stopOpacity={A.fade}
            />
          </LinearGradient>
        </Defs>
        <Rect {...FULL} fill="url(#goFade)" />
      </Svg>
      {A.enabled && (
        <>
          <Image
            testID="frost-dark"
            source={FROST_DARK}
            resizeMode="cover"
            style={[
              textureStyle,
              {
                opacity: A.dark,
                transform: [
                  {scaleX: flipX},
                  {scaleY: flipY},
                  {translateX: shift},
                ],
              },
            ]}
          />
          <Image
            testID="frost-light"
            source={FROST_LIGHT}
            resizeMode="cover"
            style={[
              textureStyle,
              {
                opacity: A.light,
                transform: [{scaleX: -flipX}, {translateY: shift}],
              },
            ]}
          />
        </>
      )}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="goClip">
            <Rect {...FULL} rx={r} ry={r} />
          </ClipPath>
          <RadialGradient id="goUptake" cx="0%" cy="0%" rx="56%" ry="82%">
            <Stop offset="0" stopColor={A.uptakeColor} stopOpacity={A.uptake} />
            <Stop offset="0.7" stopColor={A.uptakeColor} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="goNeon" cx="96%" cy="108%" rx="46%" ry="72%">
            <Stop offset="0" stopColor={colors.heia} stopOpacity={A.neon} />
            <Stop offset="0.62" stopColor={colors.heia} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="goHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0.02" stopColor={light.color} stopOpacity={0} />
            <Stop
              offset="0.32"
              stopColor={light.color}
              stopOpacity={A.highlight}
            />
            <Stop offset="0.95" stopColor={light.color} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="goEdgeLight" x1="0%" y1="0%" x2="100%" y2="100%">
            {edgeStops(light.color, light.stops)}
          </LinearGradient>
          <LinearGradient id="goEdgeDark" x1="100%" y1="100%" x2="0%" y2="0%">
            {edgeStops(dark.color, dark.stops)}
          </LinearGradient>
          <LinearGradient
            id="goGlint"
            x1="0%"
            y1="0%"
            x2={pct(glint.reach)}
            y2={pct(glint.reach)}>
            {edgeStops(glint.color, glint.stops)}
          </LinearGradient>
        </Defs>
        <G clipPath="url(#goClip)">
          <Rect {...FULL} fill="url(#goUptake)" />
          <Rect {...FULL} fill="url(#goNeon)" />
          <Rect
            x="0"
            y={light.width}
            width="100%"
            height={light.width}
            fill="url(#goHighlight)"
          />
          <Rect
            {...FULL}
            rx={r}
            ry={r}
            fill="none"
            stroke="url(#goEdgeDark)"
            strokeWidth={dark.width * 2}
          />
          <Rect
            {...FULL}
            rx={r}
            ry={r}
            fill="none"
            stroke="url(#goEdgeLight)"
            strokeWidth={light.width * 2}
          />
          <Rect
            x={glint.inset}
            y={glint.inset}
            width="100%"
            height="100%"
            rx={r - glint.inset}
            ry={r - glint.inset}
            fill="none"
            stroke="url(#goGlint)"
            strokeWidth={glint.width}
          />
        </G>
      </Svg>
    </View>
  );
}

/**
 * FELTFLATEN PÅ GLASS (Brage 2026-09-03, «Ny hendelse»; delt fra 2026-09-04
 * med Profils undersider): et tekstfelt på et glasspanel er lyst og
 * halvgjennomsiktig med en svak blekk-kant — ikke en hvit boks. Voktet i
 * `__tests__/glassSheet.test.tsx` via `NewEventScreen.FIELD`.
 */
export const GLASS_FIELD = {
  fill: 'rgba(255, 255, 255, 0.55)',
  edge: 'rgba(5, 44, 35, 0.12)',
} as const;

/**
 * Flat fallback per variant (Android / Reduce Transparency / eldre iOS).
 * Kort og kontrollglass går til `OpalSurface`; disse tre er én flat View.
 */
const SOLID: Partial<Record<GlassVariant, {fill: string; edge: string}>> = {
  important: {fill: GLASS.importantSolid, edge: GLASS.importantSolidEdge},
  bar: {fill: GLASS.barSolid, edge: GLASS.barSolidEdge},
  barMatch: {fill: GLASS.barMatchSolid, edge: GLASS.barMatchSolidEdge},
  sheet: {fill: GLASS.sheetSolid, edge: GLASS.sheetSolidEdge},
};

interface NativeProps extends ViewProps {
  cornerRadius: number;
  glassTint: string;
  pressed: boolean;
  sheenOpacity: number;
  interactive: boolean;
  /** «regular» | «clear» — UIGlassEffectStyle. */
  glassStyle: 'regular' | 'clear' | 'none';
  /** Trykklysets farge (native `_lightView`): hvitt på mørkt, mint på lyst. */
  pressColor: string;
  /** Kortskygge inni det native laget (krymper med trykket); frost-kortet. */
  cardShadow?: string;
  /** Refraksjonen (se HeiaLiquidGlassView.m). Alle tall i punkter. */
  refraction: boolean;
  backdropSourceID: string;
  refractionStrength: number;
  refractionZone: number;
  refractionScale: number;
  refractionBlur: number;
  refractionSaturation: number;
  refractionParallax: number;
  refractionLive: boolean;
  /** Frosten — materialet i kortet (se glassOptics FEED_FROST). */
  frost: boolean;
  frostLight: number;
  frostDark: number;
  frostTop: number;
  frostBottom: number;
  frostEdge: number;
  frostShadow: number;
  frostScale: number;
  /** Spekularbåndet som glir med scrollen (0 = av). */
  specular: number;
}

const iosMajor =
  Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const LIQUID_GLASS_SUPPORTED = iosMajor >= 26;

/**
 * Er det native glasset det som tegnes (og dermed kampkortets lyse blekk
 * riktig på feedkortet)? Fallback = lys opal med mørkt blekk.
 */
/**
 * TRYKKSENSOR (Brage 2026-09-06: «kampkortet skal oppføre seg likt som det
 * lyse kortet når man scroller og tar tak i det»). Det native glassviewet
 * uten glass (`glassStyle: 'none'`): samme UILongPressGestureRecognizer,
 * samme lys (foran barna i denne modusen), samme skala/senk, samme
 * utfading — lyset holder mens fingeren er nede, også under scroll, fordi
 * gjenkjenneren måler i kortets eget rom og kortet følger fingeren.
 * Uten native (Android/eldre iOS) bruker kortet `useGlassPress` i JS.
 */
export const GLASS_PRESS_NATIVE =
  LIQUID_GLASS_SUPPORTED && NativeGlass !== null;

export function GlassPressSensor({
  cornerRadius,
  pressColor = '#FFFFFF',
  style,
  children,
}: {
  cornerRadius: number;
  pressColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  if (!GLASS_PRESS_NATIVE) {
    return <View style={style}>{children}</View>;
  }
  return (
    <NativeGlass
      style={style}
      cornerRadius={cornerRadius}
      glassTint="rgba(0, 0, 0, 0)"
      sheenOpacity={0}
      // `interactive` er bryteren for selve gjenkjenneren (`_press.enabled`),
      // ikke bare UIGlassEffect.interactive — MÅ være på i sensormodus.
      interactive={true}
      pressColor={pressColor}
      glassStyle="none"
      refraction={false}
      backdropSourceID={BACKDROP_SOURCE_ID}
      refractionStrength={0}
      refractionZone={0}
      refractionScale={1}
      refractionBlur={0}
      refractionSaturation={1}
      refractionParallax={0}
      refractionLive={false}
      frost={false}
      frostLight={0}
      frostDark={0}
      frostTop={0}
      frostBottom={0}
      frostEdge={0}
      frostShadow={0}
      frostScale={1}
      specular={0}
      pressed={false}>
      {children}
    </NativeGlass>
  );
}

export function useLiquidGlassActive(): boolean {
  const {reduceTransparency} = useMaterialAccessibility();
  return FEED_LIQUID_GLASS_AB && LIQUID_GLASS_SUPPORTED && !reduceTransparency;
}

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

/** Se `HeiaPearlView` i HeiaLiquidGlassView.h — alle tall i PEARL_NATIVE. */
interface PearlNativeProps extends ViewProps {
  textureURI: string;
  cornerRadius: number;
  backdropSourceID: string;
  textureWidth: number;
  tileOverlap: number;
  material: boolean;
  materialBase: number;
  materialFold: number;
  materialMid: number;
  materialFrost: number;
  materialRidge: number;
  materialHalo: number;
  materialKnee: number;
  materialGreen: number;
  ground: boolean;
  groundStrength: number;
  groundLight: number;
  groundColor: number;
  groundGlow: number;
  groundFloor: number;
  groundValleyFrom: number;
  groundValleyTo: number;
  groundBlur: number;
  groundSaturation: number;
  groundBlend: string;
  groundLive: boolean;
  sheen: number;
  sheenMotion: number;
  sheenPeriod: number;
  sheenBand: number;
  motionBend: number;
  motionBlur: number;
  motionVRef: number;
  edge: boolean;
  edgeLight: number;
  edgeDepth: number;
  edgeFollow: number;
  frameMeter: boolean;
}

type PearlGlobal = {__heiaPearl?: React.ComponentType<PearlNativeProps>};
// Porten mot et bygg uten view-manageren (Fast Refresh før Cmd+R): uten den
// ville requireNativeComponent gitt red box i den kjørende appen.
const hasPearlManager =
  Platform.OS === 'ios' &&
  typeof UIManager.hasViewManagerConfig === 'function' &&
  UIManager.hasViewManagerConfig('HeiaPearlView');
const NativePearl = hasPearlManager
  ? ((globalThis as unknown as PearlGlobal).__heiaPearl ??=
      requireNativeComponent<PearlNativeProps>('HeiaPearlView'))
  : null;
/** Teksturens URI for native: Metro-http i dev, bundle-fil i release. */
const PEARL_URI: string =
  typeof Image.resolveAssetSource === 'function'
    ? Image.resolveAssetSource(PEARL_CARD)?.uri ?? ''
    : '';

interface LiquidGlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Ytre ramme rundt glasset — for MARGER. `style` treffer innerboksen (der
   * padding hører hjemme); en margin der ville ligget inni glasset.
   */
  wrapStyle?: StyleProp<ViewStyle>;
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
  /**
   * FLATEN KAN BLI VILKÅRLIG HØY (Brage 2026-09-04, kritisk telefonfunn:
   * «glassflaten på Varsler forsvinner under scroll»).
   *
   * ROTÅRSAKEN, ikke symptomet: både `UIGlassEffect` (et backdrop-lag) og
   * `OpalSurface` (svg) er TEKSTURBASERTE materialer — de må rasteres i
   * flatens fulle størrelse. Alle andre glassflater i Heia er avgrenset til
   * omtrent én skjerm (feedkort, ark, tab-bar). Varsler-lista er den første
   * som IKKE er det: `groupByAge` har bare tre bolker, så «Tidligere» samler
   * alt eldre enn i dag og VOKSER med pagineringen (50 rader per side). Én
   * side er ~3400 pt, tre sider ~10200 pt — langt over det et backdrop kan
   * komponeres inn i (Metals tekstur-tak er 8192 px, og skjermen er 852 pt).
   * Da faller effekten ut, og radene står igjen rett på grunnen.
   *
   * LØSNINGEN beholder materialet, men uten teksturen: flaten tegnes som
   * gjennomskinnelig tint + kanter, som er gratis i alle høyder. Det koster
   * ingenting visuelt her, fordi det ikke er noe å blurre: dagslysgrunnen er
   * en jevn gradient, og den STÅR STILLE bak flaten (radene ruller inni
   * den). Å blurre en jevn gradient gir den samme gradienten tilbake —
   * glasskarakteren kommer fra tinten og kantene, ikke fra uskarpheten.
   */
  unbounded?: boolean;
  /**
   * INNHOLD SOM KOMMER SENT (Brage 2026-09-04: «idrettene kommer opp først
   * hvis man for eks velger en farge»). Glasset er en legacy native view
   * gjennom Fabrics interop-lag, og barn som monteres i en SENERE commit enn
   * glasset selv (asynkrone data: idretter, søketreff) vises ikke før neste
   * commit som oppdaterer noe under glasset — hvilken som helst prop, som
   * fargevalget gjorde. Send en verdi som endrer seg når slikt innhold
   * kommer eller går; flaten planlegger da selv én harmløs oppdatering
   * under glasset i neste ramme (`GlassNudge`). Statisk innhold trenger
   * det ikke.
   */
  contentVersion?: string | number;
  /**
   * INNHOLDET UTENFOR NATIVE-VIEWET (Brage 2026-09-04, «Opprett lag»:
   * idrettspillene — en flexWrap-rad — var usynlige inne i glasset selv når
   * de ble montert sammen med det, og dukket opp først ved en senere
   * oppdatering). Med `detached` er glasset en absolutt bakgrunn BAK
   * innholdet, og innholdet er vanlige Fabric-views som søsken over — samme
   * oppsett som feedens tab-bar (`fill`) og det som viste Varsler-radene
   * feilfritt. Prisen: ingen native trykkrespons (irrelevant for
   * ikke-interaktive varianter). Bruk det på flater med skjema og dynamisk
   * innhold. Fallback-grenene er upåvirket (vanlige views uansett).
   */
  detached?: boolean;
  /**
   * KANTFYSIKKEN + skyggen (se toppen). Kun for `card`/`important`, kun i
   * native-grenen (fallbacken er allerede tykk og retningsbestemt i
   * OpalSurface; `detached`/`unbounded` har det ikke). Settes eksplisitt av
   * feedkortet og originalinnlegget i tråden.
   */
  optics?: boolean;
  /**
   * REFRAKSJONEN (FeedGlass V3, se toppen): native sampling av grunnen bak
   * kortet. Kun for `card`/`important` i native-grenen, og kun der grunnen
   * faktisk ligger bak (feeden) — tråden ligger på arkets solide bunn.
   */
  refraction?: boolean;
  children?: React.ReactNode;
}

/** Se `contentVersion`: én oppdaterings-mutasjon under glasset per endring. */
function GlassNudge({version}: {version: string | number}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTick(t => t + 1));
    return () => cancelAnimationFrame(id);
  }, [version]);
  return (
    <View
      testID="glass-nudge"
      pointerEvents="none"
      style={[styles.nudge, tick % 2 === 1 && styles.nudgeOdd]}
    />
  );
}

export function LiquidGlassSurface({
  wrapStyle,
  ...props
}: LiquidGlassSurfaceProps) {
  const node = <GlassSurface {...props} />;
  return wrapStyle ? <View style={wrapStyle}>{node}</View> : node;
}

function GlassSurface({
  style,
  pressed = false,
  variant = 'card',
  cornerRadius = radius.xl,
  fill = false,
  unbounded = false,
  contentVersion,
  detached = false,
  optics = false,
  refraction = false,
  children,
}: Omit<LiquidGlassSurfaceProps, 'wrapStyle'>) {
  const {reduceTransparency} = useMaterialAccessibility();
  const glass = GLASS[variant];
  const fillStyle = fill ? StyleSheet.absoluteFill : null;
  const contentCard = variant === 'card' || variant === 'important';
  const opticsVariant = optics && contentCard ? variant : undefined;
  const refractive = refraction && contentCard && FEED_REFRACTION.enabled;
  // Frosten følger `refraction`-propen: den markerer «innholdskort på grunnen».
  const frosted = refraction && contentCard && FEED_FROST.native;
  const specular = refraction && contentCard ? FEED_FROST.specular : 0;

  // Se `unbounded`: ingen native backdrop, ingen svg — bare tint og kanter,
  // så flaten er like stabil på rad 9 som på rad 900.
  if (unbounded) {
    const solid = SOLID[variant];
    return (
      <View
        testID={`glass-unbounded-${variant}`}
        style={[
          styles.solid,
          {
            borderRadius: cornerRadius,
            backgroundColor:
              reduceTransparency && solid ? solid.fill : glass.tint,
            borderColor:
              reduceTransparency && solid ? solid.edge : GLASS.unboundedEdge,
          },
          fillStyle,
          style,
        ]}>
        {children}
        {/* Lyset langs overkanten — materialets specular, ikke en ramme.
            Ligger over barna så en rad aldri dekker den, og er klippet av
            flatens egen radius. */}
        {!reduceTransparency && (
          <View
            testID="glass-unbounded-top"
            pointerEvents="none"
            style={styles.unboundedTop}
          />
        )}
      </View>
    );
  }

  if (!FEED_LIQUID_GLASS_AB || !NativeGlass || reduceTransparency) {
    const solid = SOLID[variant];
    // Profils grupper uten glass: opalens panel-kantfysikk, ikke kortets.
    if (variant === 'panel') {
      return (
        <OpalSurface variant="panel" style={style} pressed={pressed}>
          {children}
        </OpalSurface>
      );
    }
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
  if (detached) {
    return (
      <View style={[styles.detached, fillStyle]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NativeGlass
            style={[
              styles.glass,
              {borderRadius: cornerRadius},
              StyleSheet.absoluteFill,
            ]}
            cornerRadius={cornerRadius}
            glassTint={glass.tint}
            sheenOpacity={glass.sheen}
            interactive={false}
            pressColor="#FFFFFF"
            glassStyle={GLASS_STYLE[variant] ?? 'regular'}
            refraction={false}
            backdropSourceID={BACKDROP_SOURCE_ID}
            refractionStrength={FEED_REFRACTION.strength}
            refractionZone={FEED_REFRACTION.zone}
            refractionScale={FEED_REFRACTION.scale}
            refractionBlur={FEED_REFRACTION.blur}
            refractionSaturation={FEED_REFRACTION.saturation}
            refractionParallax={FEED_REFRACTION.parallax}
            refractionLive={FEED_REFRACTION.live}
            frost={false}
            frostLight={FEED_FROST.light}
            frostDark={FEED_FROST.dark}
            frostTop={FEED_FROST.top}
            frostBottom={FEED_FROST.bottom}
            frostEdge={FEED_FROST.edge}
            frostShadow={FEED_FROST.shadow}
            frostScale={FEED_FROST.scale}
            specular={0}
            pressed={pressed}
          />
        </View>
        <View style={[styles.surface, {borderRadius: cornerRadius}, style]}>
          {children}
        </View>
      </View>
    );
  }
  // MATERIALMODUS 'texture' (Brage 2026-09-06): Brages heldekkende tekstur
  // som bildeflate bak innholdet, klippet til radiusen. Ingen tegnede lag,
  // ingen skygger inni, intet systemglass — materialet vises rent. Høye
  // bildekort: foreløpig `cover` (tilpasset komposisjon er neste runde).
  if (
    opticsVariant !== undefined &&
    FEED_MATERIAL === 'silver' &&
    SILVER_MODE === 'texture'
  ) {
    // NATIV KROPP (HeiaPearlView) der den finnes; JS-flisingen ellers.
    // Native-viewet klipper seg selv, så wrapperen trenger ingen overflow.
    const nativePearl =
      NativePearl !== null && PEARL_NATIVE.enabled && PEARL_URI !== '';
    return (
      <View
        testID="glass-texture"
        style={[
          styles.glass,
          !nativePearl && styles.opticsClip,
          {borderRadius: cornerRadius},
          fillStyle,
        ]}>
        {nativePearl && NativePearl !== null ? (
          <NativePearl
            testID="pearl-native"
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            textureURI={PEARL_URI}
            cornerRadius={cornerRadius}
            backdropSourceID={BACKDROP_SOURCE_ID}
            {...PEARL_NATIVE.props}
            // Grunnen sampler bare der grunnen faktisk ligger bak (feeden,
            // `refraction`); i arket ligger kortet på arkets solide bunn.
            ground={PEARL_NATIVE.props.ground && refraction}
          />
        ) : (
          <PearlTexture />
        )}
        <View
          style={[
            styles.surface,
            {borderRadius: cornerRadius},
            fillStyle,
            style,
          ]}>
          {children}
        </View>
      </View>
    );
  }
  // DIAGNOSE (SILVER_LAYERS.glass = false): kortet uten systemglass — bare
  // materiallaget og innholdet på en gjennomsiktig View, samme boks.
  if (
    opticsVariant !== undefined &&
    FEED_MATERIAL === 'silver' &&
    !SILVER_LAYERS.glass
  ) {
    return (
      <View
        testID="glass-diagnose"
        style={[styles.glass, {borderRadius: cornerRadius}, fillStyle]}>
        <GlassOptics cornerRadius={cornerRadius} />
        <View
          style={[
            styles.surface,
            {borderRadius: cornerRadius},
            fillStyle,
            style,
          ]}>
          {children}
        </View>
      </View>
    );
  }
  const node = (
    <NativeGlass
      style={[styles.glass, {borderRadius: cornerRadius}, fillStyle]}
      cornerRadius={cornerRadius}
      glassTint={glass.tint}
      sheenOpacity={glass.sheen}
      interactive={glass.interactive}
      pressColor={GLASS_PRESS[variant] ?? '#FFFFFF'}
      cardShadow={
        opticsVariant !== undefined && FEED_MATERIAL === 'frost'
          ? FEED_SHADOW.color
          : undefined
      }
      glassStyle={GLASS_STYLE[variant] ?? 'regular'}
      refraction={refractive}
      backdropSourceID={BACKDROP_SOURCE_ID}
      refractionStrength={FEED_REFRACTION.strength}
      refractionZone={FEED_REFRACTION.zone}
      refractionScale={FEED_REFRACTION.scale}
      refractionBlur={FEED_REFRACTION.blur}
      refractionSaturation={FEED_REFRACTION.saturation}
      refractionParallax={FEED_REFRACTION.parallax}
      refractionLive={FEED_REFRACTION.live}
      frost={frosted}
      frostLight={FEED_FROST.light}
      frostDark={FEED_FROST.dark}
      frostTop={FEED_FROST.top}
      frostBottom={FEED_FROST.bottom}
      frostEdge={FEED_FROST.edge}
      frostShadow={FEED_FROST.shadow}
      frostScale={FEED_FROST.scale}
      specular={specular}
      pressed={pressed}>
      {/* Kantene ligger FØR innerboksen (under innholdet) og dekker hele
          glasset — innerboksens 1 pt kant ville ellers rammet dem inn. */}
      {opticsVariant !== undefined && (
        <GlassOptics cornerRadius={cornerRadius} />
      )}
      <View
        style={[
          styles.surface,
          {borderRadius: cornerRadius},
          fillStyle,
          style,
        ]}>
        {children}
        {contentVersion !== undefined && (
          <GlassNudge version={contentVersion} />
        )}
      </View>
    </NativeGlass>
  );
  // Skyggen bor på en wrapper: en boxShadow på selve native-viewet ville
  // ligget under RN-barna men over glasset. Wrapperen har ingen padding, så
  // skyggen tegnes fra glassets egen border-boks.
  // FROST: skyggen bor i det native laget (`cardShadow`), ikke på wrapperen.
  return opticsVariant !== undefined && FEED_MATERIAL !== 'frost' ? (
    <View style={[styles.opticsShadow, {borderRadius: cornerRadius}]}>
      {node}
    </View>
  ) : (
    node
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.xl,
  },
  frostEdge: {
    borderWidth: 1,
  },
  surface: {
    borderRadius: radius.xl,
    // Samme padding-boks som OpalSurface: 1 pt gjennomsiktig kant.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Flat fallback (important/bar/barMatch) OG den scroll-trygge flaten.
  // Samme padding-boks: 1 pt kant. Fyll og kant settes per variant.
  solid: {
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  // `detached`: rammen måler seg etter innholdet; glasset fyller den bak.
  detached: {
    borderRadius: radius.xl,
  },
  // FeedGlass V2: svært myk Heia Deep-skygge under innholdskortet. iOS
  // maskerer border-boksen ut av outset-skygger (RCTBoxShadow, even-odd),
  // Android klipper den ut — ingen overflow: hidden her.
  opticsShadow: {
    boxShadow: FEED_MATERIAL === 'silver' ? [...SILVER.shadow] : [FEED_SHADOW],
  },
  pearlCopy: {
    position: 'absolute',
    left: 0,
  },
  // Materiallaget klipper teksturene til den avrundede formen.
  opticsClip: {
    overflow: 'hidden',
  },
  // GlassNudge: null høyde, aldri synlig — bare en prop som kan endres.
  nudge: {
    height: 0,
    opacity: 1,
  },
  nudgeOdd: {
    opacity: 0.99,
  },
  unboundedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GLASS.unboundedTop,
  },
});
