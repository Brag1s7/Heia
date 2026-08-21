import React, {useEffect, useRef} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  PixelRatio,
} from 'react-native';
import {colors, fonts, radius, shadows} from '../theme';
import {Activity, Check} from './icons';
import {useReducedMotion} from './useReducedMotion';
import {useMatchButton} from '../context/MatchButtonContext';
import {
  matchButtonGeometry,
  MIN_FONT_SCALE,
} from '../shared/matchButtonGeometry';
import {
  matchButtonHasGlyph,
  shouldNudge,
  type MatchButtonKind,
} from '../shared/matchButton';

/**
 * KAMPKNAPPEN — pillen i tab-barens midtplass (P4, skive 10).
 *
 * ---------------------------------------------------------------------------
 * DEN LESER TILSTANDEN SIN SELV
 *
 * Komponenten abonnerer på `useMatchButton()` i stedet for å ta tilstanden som
 * prop. Grunnen er konkret: `heiaTarget` endrer seg for hvert mål, hvert
 * bilde og hvert 👏 i en pågående kamp. Gikk det gjennom `MainTabs`, ville
 * HELE fanetreets `screenOptions` blitt regnet på nytt hver gang. Nå rendres
 * bare denne pillen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HEIA-SYMBOLET ER 👏 — IKKE PROTOTYPENS HÅND-SVG.
 *
 * Prototypen tegner en egen hånd i CSS. Skive 4.1 avviste NØYAKTIG det
 * lånet én gang før (`MatchEngagementRow`): i feeden, i kommentarene og i
 * kampforløpet er HEIA 👏, og et sjette sted med en sjuende tegning ville
 * vært et ikon å vedlikeholde uten en betydning å bære.
 *
 * Fasit for tilstandene og fargene: `docs/prototypes/kampskjerm/index.html`,
 * `btnState()` + `.matchbtn`-reglene.
 */

/** Flate og blekk per tilstand — prototypens `.matchbtn`-klasser. */
const SKIN: Record<MatchButtonKind, {bg: string; ink: string; glow?: boolean}> =
  {
    // Før vi vet: samme mørke flate som hvile, men uten ord og uten glød.
    // En rolig plass, ikke et svar — se `unknown` i `matchButton.ts`.
    unknown: {bg: colors.heiaDeep, ink: colors.heia},
    // Mørk med mint blekk: hvilende, men tydelig at den hører kampen til.
    idle: {bg: colors.heiaDeep, ink: colors.heia, glow: false},
    // Coral = live-status, låst fargesemantikk i Heia.
    live: {bg: colors.live, ink: '#FFFFFF'},
    // Gull = pause. Samme par som `LiveBadge` bruker i pause.
    pause: {bg: colors.gold, ink: colors.goldInk},
    // Mint = feiringen. Den ene av de rasjonerte glødplassene.
    heia: {bg: colors.heia, ink: colors.heiaDeep, glow: true},
    'heia-tom': {bg: colors.heiaTint, ink: colors.heiaInk},
    // Gjort: dempet mint, ingen glød. Handlingen er over.
    heiet: {bg: colors.heiaTint, ink: colors.heiaDeep},
    rapporter: {bg: colors.heiaDeep, ink: colors.heia},
    // Åpen dokk snur pillen: den er nå en av/på-bryter, ikke en invitasjon.
    lukk: {bg: colors.heia, ink: colors.heiaDeep},
  };

interface MatchTabButtonProps {
  /**
   * Kamp-fanen er valgt (skive 10.3).
   *
   * ⚠️ MARKERES MED EN MINT RING, IKKE MED FYLLFARGE. Brage var eksplisitt:
   * live-stillingen skal IKKE bli mint bare for å vise at fanen er valgt —
   * coral BETYR live, og å bytte den for å si noe om navigasjon ville gjort
   * fargesemantikken usann. Ringen ligger utenpå og rører ikke pillen.
   */
  focused?: boolean;
}

export function MatchTabButton({focused = false}: MatchTabButtonProps) {
  const {state} = useMatchButton();
  const {width, fontScale} = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const g = matchButtonGeometry(
    width,
    fontScale,
    state.label,
    state.shortLabel,
    // ⚠️ SAMME KILDE SOM `renderGlyph` under. Lot vi geometrien gjette på
    // ordlengde, ville den regnet med et ikon komponenten aldri tegnet.
    matchButtonHasGlyph(state.kind),
  );
  const skin = SKIN[state.kind];

  // ⚠️ PRIKKEN PUSTER SOM I `LiveBadge`, og av samme grunner — inkludert
  // `stopAnimation()` FØR sluttverdien: en løpende `Animated.loop` dør ikke
  // av seg selv, og slås Reduce Motion på mens den går, blir prikken stående
  // på en tilfeldig skala.
  const pulse = useRef(new Animated.Value(1)).current;
  const isLive = state.kind === 'live';
  useEffect(() => {
    if (!isLive || reducedMotion) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isLive, reducedMotion]);

  // Prototypens `nudge`: et kort sprett når tilstanden SKIFTER, så et mål i
  // kampen merkes i baren. Aldri ved første tegning, og aldri ved Reduce
  // Motion.
  const nudge = useRef(new Animated.Value(1)).current;
  const prevKind = useRef<MatchButtonKind | null>(null);
  useEffect(() => {
    const nudgeNow = shouldNudge(prevKind.current, state.kind);
    prevKind.current = state.kind;
    if (!nudgeNow || reducedMotion) return;
    Animated.sequence([
      Animated.timing(nudge, {
        toValue: 1.13,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(nudge, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state.kind, nudge, reducedMotion]);

  const glyph = renderGlyph(state.kind, g.glyphSize, skin.ink, pulse);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {transform: [{scale: nudge}]},
        // Pillen kan bli bredere enn faneelementet på lange ord. Den er da
        // DEKOR utenfor kjernen — trykket ligger på elementet. Se
        // `matchButtonGeometry` for budsjettet og hvorfor det holder.
        {width: g.width},
      ]}
      pointerEvents="none">
      <View
        // Semantikken, ikke bare fargen: skjermleseren skal si at fanen er
        // valgt. (Biblioteket setter den òg på faneknappen; her er den for
        // pillen selv, som er det man faktisk ser.)
        accessibilityState={{selected: focused}}
        style={[
          styles.pill,
          {
            backgroundColor: skin.bg,
            paddingHorizontal: g.paddingH,
            height: g.height,
            opacity: state.disabled ? 0.55 : 1,
          },
          skin.glow && !state.disabled && shadows.glow,
          focused && styles.pillFocused,
        ]}>
        {glyph !== null && <View style={{marginRight: g.gap}}>{glyph}</View>}
        <Text
          numberOfLines={1}
          // ⚠️ SIKKERHETSNETTET MOT «RAPPORT…». Bredde-anslaget i
          // `matchButtonGeometry` er nettopp et anslag; her måler iOS de
          // EKTE glyfene og krymper de siste prosentene om anslaget bommer.
          // Uten den kutter systemet ordet i stedet, og flaten lyver.
          adjustsFontSizeToFit
          minimumFontScale={MIN_FONT_SCALE}
          maxFontSizeMultiplier={g.fontCap}
          style={[
            styles.label,
            {
              color: skin.ink,
              // Rundes til fysisk piksel: en halv piksel på @3x gjør
              // displayfonten uskarp, og pillen er appens minste tekst i
              // største vekt.
              fontSize: PixelRatio.roundToNearestPixel(g.fontSize),
              letterSpacing: g.letterSpacing,
            },
          ]}>
          {g.label}
        </Text>
      </View>
    </Animated.View>
  );
}

function renderGlyph(
  kind: MatchButtonKind,
  size: number,
  ink: string,
  pulse: Animated.Value,
): React.ReactNode {
  if (size === 0) return null;
  switch (kind) {
    case 'unknown':
    case 'idle':
      return <Activity size={size} color={ink} strokeWidth={2.3} />;
    case 'live':
      return (
        <Animated.View
          style={[
            styles.dot,
            {backgroundColor: ink, transform: [{scale: pulse}]},
          ]}
        />
      );
    case 'heia':
    case 'heia-tom':
      // 👏 — samme glyf som feeden, kommentarene og kampforløpet.
      return <Text style={{fontSize: size}}>👏</Text>;
    case 'heiet':
      return <Check size={size} color={ink} strokeWidth={3} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // Løftet som prototypens `.mbw{margin-top:-12px}` og som dagens
    // «+»-squircle. Barhøyden er urørt.
    marginTop: -10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    // Ringen finnes ALLTID, gjennomsiktig når fanen ikke er valgt: en kant
    // som kommer og går ville endret pillens bredde med 4 pt og dyttet
    // teksten i det du bytter fane.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // Valgt fane: mint ring utenpå, uansett hvilken farge pillen har inni.
  pillFocused: {
    borderColor: colors.heia,
  },
  label: {
    fontFamily: fonts.display,
    // Prototypens `.matchbtn` er versaler. Etikettene kommer ferdig i
    // versaler fra `matchButton.ts` — ingen `textTransform`, så VoiceOver
    // leser a11y-labelen og ikke et bokstavert ord.
    includeFontPadding: false,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
