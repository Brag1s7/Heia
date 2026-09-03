import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, radius} from '../theme';
import {useMaterialAccessibility} from './useMaterialAccessibility';

/**
 * OPAL — hverdagens lyse materialprototype (Brage 2026-09-02). ÉN konsument:
 * ikke-festede kort i `FeedCard` bak `FEED_OPAL_AB`. Compose og Lagkassa
 * røres IKKE i denne skiva; festede VIKTIG-kort forblir solide.
 *
 * Materialhierarkiet (B-puls): kampen er mørkt stadionglass, hverdagen er
 * KJØLIG, FROSTET, GJENNOMSKINNELIG glass (Brages retning 2026-09-02, runde
 * 2, mot one.com-referansen) som lar grunnen skinne KONTROLLERT gjennom, og
 * handlingene er blekk-tynne chips i materialet. Opalen er aldri hvit, aldri
 * mørk — og ikke lenger krem: varm krem × cyan grunn blandet til grått papir.
 *
 * ⚠️ GLOBALE `Card`, `HeroSurface`, `StadiumSurface` OG TOKENS RØRES IKKE.
 * Fargene under er lokale med vilje — promotering skjer i egen skive.
 *
 * ---------------------------------------------------------------------------
 * LAGENE, nederst først. Samme byggemåte som `StadiumGlass`: svg-en bor på
 * YTTERBOKSEN (ingen kant der, så absoluteFill = hele border-boksen), og
 * innerboksen beholder `borderWidth: 1` gjennomsiktig — padding-boksen barna
 * ser er identisk med dagens `styles.card` i FeedCard (1 pt kant + padding).
 *
 *   base     linear ~150°: kjølig perlegrå, lysest der lyset treffer (øvre
 *            venstre) → mørkest nederst til høyre. Tegnes ved KANTOPASITETEN
 *            (0,87): mot kanter og bunn skinner grunnen mest gjennom.
 *   kjerne   tekstsonen: en radial pute av baseMid oppå basen som løfter
 *            samlet opasitet til 0,92 midt på kortet og dør ut mot kantene
 *            (alfa = (0,92 − 0,87) / (1 − 0,87)). Én flate, to opasiteter:
 *            frost der teksten står, glass der kortet møter grunnen.
 *            Reduce Transparency → basen 1, kjernen av, solid bunn.
 *   sheen    DIAGONAL: hvitt 0,16 → 0 langs ~150° fra øvre venstre — lys
 *            som ligger PÅ glasset, ikke en glansflekk. Increase Contrast →
 *            halv.
 *   opptak   grunnens neon tatt opp i nedre høyre hjørne, 0,05 → 0. Et hint.
 *            Increase Contrast → halv.
 *   høylys   1 pt rett innenfor kanten langs toppen, tyngdepunkt 30 % fra
 *            venstre: lys som treffer materialet. (IKKE 8 pt tykkelsesbånd i
 *            første forsøk — Brage.)
 *   kantpar  1 pt ring rett UTENFOR border-boksen (egen svg med −1 pt
 *            innrykk; strøket er 2 pt sentrert på svg-kanten, så den
 *            synlige halvdelen er nøyaktig ringen mellom boksen og 1 pt ut):
 *            LYS øverst til venstre (hvit 0,85 → 0,20 ved midten) og MØRK
 *            motkant nederst til høyre (blekk 0 → 0,14). Glass defineres av
 *            en lyskant OG en skyggekant sammen; en hvit ring alene forsvant
 *            på telefonen mot lys grunn. Riggen beviste at en hvit linje
 *            INNENFOR flaten er usynlig (ΔL* ≈ 3) — lyset må ligge på
 *            kanten, mot grunnen. Ringen er maling, ikke layout:
 *            padding-boksen er uendret. Increase Contrast → uniform
 *            BLEKK-hårlinje 0,35 hele veien rundt; høylyset slås da av.
 *   skygge   grønn (#0B3B2A) 0,20 som `boxShadow` (RN 0.83, Fabric) på
 *            ytterboksen uten overflow: hidden. iOS tegner den fra
 *            border-boksen; Android (OutsetBoxShadowDrawable) klipper
 *            border-boksen UT, så skyggen ikke blør gjennom flaten.
 *            ALDRI `elevation`/`shadow*` her — elevation tegnes gjennom en
 *            gjennomskinnelig flate på Android.
 *
 * Ingen buer (feedposter er hverdag, ikke stadion), ingen filtre, ingen
 * blur, ingen bevegelse (materialet ses 100+ ganger om dagen).
 *
 * BLEKKET: `OPAL.inkSecondary`/`inkTertiary`/`inkAccent` er lokalt mørkere
 * enn `colors.textSecondary`/`textTertiary`/`heiaInk`, KUN for tekst på
 * opalen. Grunn: kontrastporten (Brage) — sekundær- og tertiærtekst og
 * pilletekst skal holde 4,5:1 i svakeste grunnposisjon (mørk teal #0E6656
 * rett over tab-baren) ved KANTOPASITETEN, der tokenene faller under.
 * Tertiærblekket (tidsstempel, ⋯) kom til i runde 2: tokenet er 2,7 på
 * hvitt og lavere på glasset. Det globale tokenet røres ikke. Vakten bor i
 * `__tests__/feedOpal.test.tsx` og måler i verste hjørne ved kantopasitet.
 */
export const OPAL = {
  /** Opasitet i tekstsonen (kjernen). */
  baseOpacity: 0.92,
  /** Opasitet mot kanter og bunn. Ikke under 0,86 før telefonen har vist 0,87 rent. */
  baseEdgeOpacity: 0.87,
  /** Der lyset treffer: kjølig, nesten hvit perle. */
  baseTop: '#F6F8F7',
  /** Perlegrå midt. */
  baseMid: '#EFF3F1',
  baseMidStop: 0.55,
  /** Svakt mørkere perlegrå der lyset faller av. */
  baseBottom: '#E9EEEC',
  /** Solid bunn for Reduce Transparency (og fallback-farge). */
  solid: '#EFF3F1',
  sheen: 0.16,
  uptake: 0.05,
  uptakeColor: colors.heia,
  edgeColor: '#FFFFFF',
  edgeTop: 0.85,
  edgeMid: 0.2,
  /** Motkanten: blekk nederst til høyre. */
  edgeShadeColor: '#08392E',
  edgeShade: 0.14,
  /** Ringens bredde i pt, utenfor boksen. Strøket tegnes 2× og klippes av svg-en. */
  edgeWidth: 1,
  /** Increase Contrast: blekk-hårlinje i stedet for lys. */
  edgeContrastColor: '#08392E',
  edgeContrast: 0.35,
  highlight: 0.55,
  shadow: 'rgba(11, 59, 42, 0.20)',
  /** Sekundærblekk på opalen (pilletekst, kommentarikon). */
  inkSecondary: '#44574C',
  /** Tertiærblekk på opalen (tidsstempel, ⋯). */
  inkTertiary: '#506259',
  /** Aksentblekk på opalen (rolle-pillen «Trener» på heiaSoft). */
  inkAccent: '#05604A',
} as const;

interface OpalSurfaceProps {
  /** Padding/gap — legges oppå flaten (innerboksen). */
  style?: StyleProp<ViewStyle>;
  /** Trykktilstand: samme heiaSoft-tint som dagens `cardPressed`. */
  pressed?: boolean;
  /**
   * Tekstsonens opasitet — KUN for riggverk/tuning. Produktet bruker
   * `OPAL.baseOpacity`; kantopasiteten følger `OPAL.baseEdgeOpacity`.
   */
  baseOpacity?: number;
  children?: React.ReactNode;
}

const FULL = {x: '0', y: '0', width: '100%', height: '100%'} as const;

export function OpalSurface({
  style,
  pressed = false,
  baseOpacity = OPAL.baseOpacity,
  children,
}: OpalSurfaceProps) {
  const {reduceTransparency, increaseContrast} = useMaterialAccessibility();
  const half = increaseContrast ? 0.5 : 1;
  const sheen = OPAL.sheen * half;
  const uptake = OPAL.uptake * half;
  const edge = Math.min(baseOpacity, OPAL.baseEdgeOpacity);
  // Kjernens alfa slik at base + kjerne = tekstsonens opasitet.
  const core = reduceTransparency ? 0 : (baseOpacity - edge) / (1 - edge);
  const edgeColor = increaseContrast ? OPAL.edgeContrastColor : OPAL.edgeColor;
  const shadeColor = increaseContrast
    ? OPAL.edgeContrastColor
    : OPAL.edgeShadeColor;
  const edgeStops = increaseContrast
    ? [
        OPAL.edgeContrast,
        OPAL.edgeContrast,
        OPAL.edgeContrast,
        OPAL.edgeContrast,
      ]
    : [OPAL.edgeTop, OPAL.edgeMid, 0, OPAL.edgeShade];
  // Høylyset er lys; under Increase Contrast er kanten blekk, og et hvitt
  // høylys rett under en mørk hårlinje ville lest som en dobbel strek.
  const highlight = increaseContrast ? 0 : OPAL.highlight;

  return (
    <View style={[styles.shadow, reduceTransparency && styles.shadowSolid]}>
      {/* MATERIALE, IKKE INNHOLD — skjult for skjermleser, som StadiumGlass. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <ClipPath id="opClip">
              <Rect {...FULL} rx={radius.xl} ry={radius.xl} />
            </ClipPath>
            <LinearGradient id="opBase" x1="20%" y1="0%" x2="80%" y2="100%">
              <Stop offset="0" stopColor={OPAL.baseTop} />
              <Stop offset={OPAL.baseMidStop} stopColor={OPAL.baseMid} />
              <Stop offset="1" stopColor={OPAL.baseBottom} />
            </LinearGradient>
            <RadialGradient id="opCore" cx="50%" cy="45%" rx="60%" ry="60%">
              <Stop offset="0" stopColor={OPAL.baseMid} stopOpacity={core} />
              <Stop offset="0.55" stopColor={OPAL.baseMid} stopOpacity={core} />
              <Stop offset="1" stopColor={OPAL.baseMid} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="opSheen" x1="0%" y1="0%" x2="70%" y2="100%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={sheen} />
              <Stop
                offset="0.3"
                stopColor="#FFFFFF"
                stopOpacity={sheen * 0.6}
              />
              <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <RadialGradient id="opUptake" cx="100%" cy="104%" rx="58%" ry="70%">
              <Stop
                offset="0"
                stopColor={OPAL.uptakeColor}
                stopOpacity={uptake}
              />
              <Stop
                offset="0.62"
                stopColor={OPAL.uptakeColor}
                stopOpacity={0}
              />
            </RadialGradient>
            <LinearGradient id="opHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0.02" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={highlight} />
              <Stop offset="0.95" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <G clipPath="url(#opClip)">
            <Rect
              {...FULL}
              fill="url(#opBase)"
              fillOpacity={reduceTransparency ? 1 : edge}
            />
            <Rect {...FULL} fill="url(#opCore)" />
            <Rect {...FULL} fill="url(#opSheen)" />
            <Rect {...FULL} fill="url(#opUptake)" />
            <Rect
              x="0"
              y="0"
              width="100%"
              height={OPAL.edgeWidth}
              fill="url(#opHighlight)"
            />
          </G>
        </Svg>
      </View>

      {/* KANTPARET — ringen utenfor boksen. Egen svg, 1 pt større enn boksen
          på alle sider; strøket ligger på svg-kanten og klippes av den.
          Lys øverst til venstre, blekk nederst til høyre. */}
      <View
        style={styles.rim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="opRim" x1="0%" y1="0%" x2="60%" y2="100%">
              <Stop
                offset="0"
                stopColor={edgeColor}
                stopOpacity={edgeStops[0]}
              />
              <Stop
                offset="0.45"
                stopColor={edgeColor}
                stopOpacity={edgeStops[1]}
              />
              <Stop
                offset="0.55"
                stopColor={shadeColor}
                stopOpacity={edgeStops[2]}
              />
              <Stop
                offset="1"
                stopColor={shadeColor}
                stopOpacity={edgeStops[3]}
              />
            </LinearGradient>
          </Defs>
          <Rect
            {...FULL}
            rx={radius.xl + OPAL.edgeWidth}
            ry={radius.xl + OPAL.edgeWidth}
            fill="none"
            stroke="url(#opRim)"
            strokeWidth={OPAL.edgeWidth * 2}
          />
        </Svg>
      </View>

      <View style={[styles.surface, style, pressed && styles.pressed]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.xl,
    boxShadow: [{offsetX: 0, offsetY: 8, blurRadius: 24, color: OPAL.shadow}],
  },
  // Ringens svg: 1 pt utenfor boksen på alle sider. Ytterboksen har ikke
  // overflow: hidden, så ingen plattform klipper den.
  rim: {
    position: 'absolute',
    top: -OPAL.edgeWidth,
    left: -OPAL.edgeWidth,
    right: -OPAL.edgeWidth,
    bottom: -OPAL.edgeWidth,
  },
  // Reduce Transparency: solid perlebunn under den (da ugjennomsiktige) svg-en.
  shadowSolid: {
    backgroundColor: OPAL.solid,
  },
  surface: {
    borderRadius: radius.xl,
    // Gjennomsiktig kant, ikke fjernet: padding-boksen skal være identisk
    // med dagens FeedCard (1 pt kant). Kanten tegnes i svg-en.
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
  },
});
