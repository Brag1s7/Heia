import React, {useMemo, useState} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {matchColors} from '../../theme';
import {arenaLightCap} from '../../shared/teamColors';

/**
 * ARENAEN — «ikke et kort: et platå i samme verden, med buet underkant».
 *
 * ---------------------------------------------------------------------------
 * HVORFOR EN NY FLATE OG IKKE `StadiumSurface`
 *
 * `StadiumSurface` har 11 kallesteder, og `ScoreChip` arver alt fra den. Å gi
 * den en buet underkant ville endret kampkort i lister, feeden og
 * varselkortene i samme slag. Arenaformen er kampskjermens, og bare den.
 *
 * ---------------------------------------------------------------------------
 * DEN BUEDE UNDERKANTEN
 *
 * Fasiten har `border-radius: 30px 30px 46% 46% / 30px 30px 40px 40px` — en
 * ELLIPTISK radius. RN har ikke elliptiske radier, og heller ikke inset-skygge
 * for lyskanten. Begge tegnes derfor i svg: hele flaten er ÉN `Path`, og alt
 * innhold i den (grunngradient, lagets lys, banebuene) klippes til den samme
 * pathen. Da finnes de firkantede hjørnene aldri, og de trenger ikke males
 * bort slik målswellen må gjøre det.
 *
 * Prisen er at pathen trenger FAKTISKE punkter, altså en måling: flaten er
 * flat grønn i én frame før `onLayout` lander. Samme mønster som
 * `ProfileHeader` allerede bruker.
 *
 * ⚠️ Lagets lys på flaten er KLEMT (`arenaLightCap`). Arenaen er kampens
 * lyseste rom og har minst luft mot 7:1 — uten klemmen ville et gult lag
 * spist sitt eget lagnavn.
 */

/** Øvre hjørner. */
const CORNER = 30;
/** Hvor dypt underkanten buer ned på midten. */
const DIP = 40;

interface ArenaSurfaceProps {
  teamColor: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function ArenaSurface({teamColor, style, children}: ArenaSurfaceProps) {
  const [box, setBox] = useState<{w: number; h: number} | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (
      !box ||
      Math.abs(box.w - width) > 0.5 ||
      Math.abs(box.h - height) > 0.5
    ) {
      setBox({w: width, h: height});
    }
  };

  const teamPeak = useMemo(() => arenaLightCap(teamColor).peak, [teamColor]);

  const paths = useMemo(() => {
    if (!box) return null;
    const {w, h} = box;
    const dip = Math.min(DIP, h * 0.25);
    // Underkanten alene — den brukes både som del av flaten og som lyskant.
    const bottom = `M 0 ${h - dip} C ${w * 0.14} ${h}, ${w * 0.86} ${h}, ${w} ${
      h - dip
    }`;
    const shape =
      `M 0 ${CORNER} ` +
      `C 0 ${CORNER * 0.45}, ${CORNER * 0.45} 0, ${CORNER} 0 ` +
      `L ${w - CORNER} 0 ` +
      `C ${w - CORNER * 0.45} 0, ${w} ${CORNER * 0.45}, ${w} ${CORNER} ` +
      `L ${w} ${h - dip} ` +
      `C ${w * 0.86} ${h}, ${w * 0.14} ${h}, 0 ${h - dip} Z`;
    return {shape, bottom, w, h};
  }, [box]);

  return (
    <View style={[styles.surface, style]} onLayout={onLayout}>
      {/* Én frame før målingen lander. Toppradiusen holder, underkanten er
          rett — bedre enn et hull i verdenen. */}
      {!paths && <View style={styles.fallback} pointerEvents="none" />}

      {paths && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Svg width={paths.w} height={paths.h}>
            <Defs>
              <ClipPath id="arenaClip">
                <Path d={paths.shape} />
              </ClipPath>
              <LinearGradient
                id="arenaBase"
                x1="58%"
                y1="0%"
                x2="42%"
                y2="100%">
                <Stop offset="0" stopColor={matchColors.arenaTop} />
                <Stop offset="1" stopColor={matchColors.arenaBottom} />
              </LinearGradient>
              <RadialGradient
                id="arenaTeam"
                cx="16%"
                cy="34%"
                rx="66%"
                ry="46%">
                <Stop offset="0" stopColor={teamColor} stopOpacity={teamPeak} />
                <Stop offset="0.66" stopColor={teamColor} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="arenaOpp" cx="86%" cy="34%" rx="52%" ry="38%">
                <Stop
                  offset="0"
                  stopColor={matchColors.opponent}
                  stopOpacity={0.26}
                />
                <Stop
                  offset="0.64"
                  stopColor={matchColors.opponent}
                  stopOpacity={0}
                />
              </RadialGradient>
              <RadialGradient
                id="arenaGrass"
                cx="50%"
                cy="116%"
                rx="90%"
                ry="60%">
                <Stop offset="0" stopColor="#02FFAB" stopOpacity={0.13} />
                <Stop offset="0.6" stopColor="#02FFAB" stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="arenaLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0" stopColor="#EAFFF6" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#EAFFF6" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#EAFFF6" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <G clipPath="url(#arenaClip)">
              <Rect
                x="0"
                y="0"
                width={paths.w}
                height={paths.h}
                fill="url(#arenaBase)"
              />
              <Rect
                x="0"
                y="0"
                width={paths.w}
                height={paths.h}
                fill="url(#arenaTeam)"
              />
              <Rect
                x="0"
                y="0"
                width={paths.w}
                height={paths.h}
                fill="url(#arenaOpp)"
              />
              <Rect
                x="0"
                y="0"
                width={paths.w}
                height={paths.h}
                fill="url(#arenaGrass)"
              />
              {/* Feltbuene og midtlinja INNE i arenaen — samme signatur som
                  grunnen, mindre skala. Klippet, så de aldri stikker ut. */}
              <Circle
                cx={paths.w / 2}
                cy={paths.h * 0.46}
                r={105}
                stroke="rgba(234, 255, 246, 0.09)"
                strokeWidth={1.5}
                fill="none"
              />
              <Circle
                cx={paths.w / 2}
                cy={paths.h * 0.46}
                r={66}
                stroke="rgba(234, 255, 246, 0.06)"
                strokeWidth={1.5}
                fill="none"
              />
              <Rect
                x={-20}
                y={paths.h * 0.46}
                width={paths.w + 40}
                height={1}
                fill="url(#arenaLine)"
              />
            </G>

            {/* BUET LYSKANT. Fasitens inset-skygge følger radiusen — her er
                den strøket langs den samme kurven, som er nøyaktig det den
                gjør visuelt. Dette er skillet mellom arenaen og pulsen:
                ingen ramme, bare lys. */}
            <Path
              d={paths.bottom}
              stroke={matchColors.chalk}
              strokeWidth={1}
              fill="none"
            />
          </Svg>
        </View>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: matchColors.arenaTop,
    borderTopLeftRadius: CORNER,
    borderTopRightRadius: CORNER,
  },
});
