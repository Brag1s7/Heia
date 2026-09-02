import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * DAGSLYSGRUNNEN — hverdagsskjermenes bunn.
 * SKIVE 1A: STATISK BAKGRUNNSTEST PÅ HJEM (Brage 2026-09-02).
 *
 * LYSFELT-VERSJONEN (Brage 2026-09-02 natt): masterens lineære reise var for
 * jevn — «én grønn/cyan-flate». Grunnen er nå et LYSFELT: mange store, myke,
 * roterte og overlappende felt i Heia-familien (lime/mint-lysninger, neon,
 * aqua lokalt, dyp emerald/teal), med overganger i flere retninger og
 * forskjeller i både farge og lys. Fortsatt samme koordinatrom (1290 × 2796,
 * xMidYMin slice), fortsatt kun radiale/lineære gradienter uten filtre;
 * banegeometrien er beholdt som et svakere ekstralag. Fargene er lokale.
 *
 * Fasiten er Brages egen master:
 *   docs/Heia_Design_Master/Heia_Background_Master.svg  (kilden, 1290 × 2796)
 *   docs/Heia_Design_Master/Heia_Background_Master.png  (bildet som skal treffes)
 *   docs/Heia_Design_Master/Heia_Claude_Build_Brief.md  (reglene)
 *
 * Alt tegnes i MASTERENS EGET KOORDINATROM (viewBox 1290 × 2796), så hvert
 * senter, hver radius og hvert stopp under kan kontrolleres mot svg-fila
 * linje for linje. Ingen tall er funnet opp her.
 *
 * ⚠️ FARGENE ER LOKALE MED VILJE (Brages presisering 6). Briefens palett er
 * IKKE lagt inn i `colors`: briefens `heiaInk` (#052C23) og `heiaDeep`
 * (#063A2D) kolliderer med de eksisterende tokenene `colors.heiaInk`
 * (#087A5A, WCAG-tekstgrønn i ~40 bruksteder) og `colors.heiaDeep`
 * (#08392E). Godkjente bakgrunnsfarger promoteres til tokens ETTER
 * telefontesten, i egen skive.
 *
 * TO BEVISSTE AVVIK FRA MASTEREN, begge for å slippe svg-filtre (briefens
 * ytelseskrav, likt på Android):
 *   1. De tre blur80-ellipsene og blur52-beamet er radiale gradienter med
 *      samme senter, samme utstrekning pluss 2σ, og samme opasitet — full
 *      styrke innenfor den gamle kanten minus 2σ, halv styrke DER kanten lå,
 *      null ved kanten pluss 2σ. Det er formen en gaussisk blurkant har.
 *   2. Kornet (feTurbulence) er utelatt — finnes ikke nativt i
 *      react-native-svg 15.15.3, kun som TS-type.
 *
 * TILPASNING TIL SKJERMEN: `xMidYMin slice`. Masteren er en HEL skjermramme,
 * statuslinje til hjemindikator. Hjem-flaten er vinduet minus tab-baren, så
 * toppen forankres i statuslinja og tab-baren dekker de nederste ~85 pt —
 * akkurat slik materialpreviewen legger tab-baren over det dype hjørnet.
 * `xMidYMid` hadde skjøvet hele komposisjonen ~42 pt opp i forhold til
 * masteren. Bytt strengen under om den andre forankringen skal prøves.
 *
 * INGEN BEVEGELSE OG INGEN REDUCE MOTION HER. De kommer sammen i
 * bevegelsesskiva, og først da skilles neon-, aqua- og beamlaget ut som egne
 * lag med release-profilering (Brages presisering 2 og 8). Én svg til
 * komposisjonen er det som er godkjent.
 */

/**
 * A/B-BRYTER FOR TELEFONTESTEN — MIDLERTIDIG. `false` = Hjem nøyaktig som før:
 * krem `colors.background`, ingen grunn, navigatorens vanlige fallback.
 * Fjernes når komposisjonen er avgjort på fysisk telefon.
 */
export const DAYLIGHT_GROUND_AB = true;

/**
 * Fallback-bunnen bak svg-en (synlig et blunk mens den måles opp) og
 * Home-rutens `contentStyle` i navigatoren, så push/pop ikke blinker krem i
 * kantene mot en mintgrunn. Basegradientens 25 %-stopp: midt mellom
 * mint-toppen og neonkjernen — grunnens dominante mint.
 */
export const DAYLIGHT_GROUND_FALLBACK = '#26F5AD';

const ASPECT = 'xMidYMin slice';

/** Masterens lerret. */
const W = 1290;
const H = 2796;

/**
 * Masterens farger, navngitt etter rollen i komposisjonen. Der verdien ER
 * briefens palett står tokennavnet fra briefen bak; resten er mellomstopp
 * som bare finnes i svg-fila.
 */
const MASTER = {
  mintTop: '#9FFFD8', // base 0 %
  mint: '#26F5AD', // base 25 %
  neon: '#02FFAB', // base 52 % — briefens heiaNeon
  aquaDeep: '#31DCC9', // base 76 %
  deepEdge: '#0E7560', // base 100 %
  sun: '#CFFF74', // briefens heiaSun — kun atmosfærisk, aldri kontroll/tekst
  sunSoft: '#B5FF6B',
  liftTop: '#AEFFDE',
  liftMid: '#70FFCD',
  liftLow: '#48F2B8',
  deep: '#063A2D', // briefens heiaDeep
  neonSoft: '#24FFB8',
  aqua: '#65E7DD',
  aquaMid: '#39D7C4',
  white: '#FFFFFF',
  beamWarm: '#F8FFF9',
} as const;

/** Ett helt lerret med gitt fyll — masterens `<rect width height fill>`. */
function Sheet({fill}: {fill: string}) {
  return <Rect x={0} y={0} width={W} height={H} fill={fill} />;
}

/** Lysfeltets egne farger — nyanser INNE i Heia-verdenen, ikke nye kulører. */
const FIELD = {
  baseTop: '#7FF0C4',
  baseMint: '#2AE6A8',
  baseGreen: '#17C594',
  baseDeep: '#0F8C6A',
  lime: '#D9FF8C',
  limeSoft: '#BFFF7A',
  mintLight: '#B9FFE3',
  mintPocket: '#C4FFEA',
  aqua: '#5AF0E4',
  cyan: '#46E0D6',
  teal: '#19B79B',
  emerald: '#0C8A66',
  deep: '#0B6E52',
  deepTop: '#0E7F62',
} as const;

interface FieldProps {
  id: string;
  /** Senter i masterrommet. */
  x: number;
  y: number;
  rotate: number;
  rx: number;
  ry: number;
  color: string;
  /** Stopp: [offset, opasitet]. */
  stops: Array<[number, number]>;
}

/** Ett mykt, rotert lysfelt — en ellipse uten kant. */
function Field({id, x, y, rotate, rx, ry, color, stops}: FieldProps) {
  return (
    <RadialGradient
      id={id}
      cx={0}
      cy={0}
      r={1}
      gradientUnits="userSpaceOnUse"
      gradientTransform={`translate(${x} ${y}) rotate(${rotate}) scale(${rx} ${ry})`}>
      {stops.map(([offset, opacity]) => (
        <Stop
          key={offset}
          offset={offset}
          stopColor={color}
          stopOpacity={opacity}
        />
      ))}
      <Stop offset={1} stopColor={color} stopOpacity={0} />
    </RadialGradient>
  );
}

/** Feltene, i tegnerekkefølge (nederst først). Lys OG mørke, i flere retninger. */
const FIELDS: FieldProps[] = [
  // Dybde under overflaten — emerald/teal-partier.
  {
    id: 'fDeepTop',
    x: 1290,
    y: 620,
    rotate: -40,
    rx: 620,
    ry: 340,
    color: FIELD.deepTop,
    stops: [
      [0, 0.6],
      [0.55, 0.25],
    ],
  },
  {
    id: 'fDeepR',
    x: 1360,
    y: 2000,
    rotate: -60,
    rx: 620,
    ry: 880,
    color: FIELD.deep,
    stops: [
      [0, 0.85],
      [0.5, 0.4],
    ],
  },
  {
    id: 'fEmeraldL',
    x: -80,
    y: 2450,
    rotate: 15,
    rx: 620,
    ry: 500,
    color: FIELD.emerald,
    stops: [
      [0, 0.7],
      [0.5, 0.3],
    ],
  },
  {
    id: 'fTealMid',
    x: 560,
    y: 1980,
    rotate: -20,
    rx: 560,
    ry: 400,
    color: FIELD.teal,
    stops: [
      [0, 0.55],
      [0.55, 0.22],
    ],
  },
  {
    id: 'fTealTop',
    x: 420,
    y: 420,
    rotate: 30,
    rx: 520,
    ry: 300,
    color: FIELD.teal,
    stops: [[0, 0.35]],
  },
  // Heia-energien — neon som ett stort felt, ikke hele flaten.
  {
    id: 'fNeon',
    x: 60,
    y: 1480,
    rotate: -12,
    rx: 860,
    ry: 720,
    color: '#02FFAB',
    stops: [
      [0, 1],
      [0.45, 0.75],
    ],
  },
  {
    id: 'fNeon2',
    x: 900,
    y: 2380,
    rotate: 20,
    rx: 520,
    ry: 360,
    color: '#02FFAB',
    stops: [
      [0, 0.7],
      [0.5, 0.3],
    ],
  },
  // Aqua/cyan som kommer inn lokalt.
  {
    id: 'fAqua',
    x: 1250,
    y: 1150,
    rotate: -35,
    rx: 660,
    ry: 920,
    color: FIELD.aqua,
    stops: [
      [0, 0.95],
      [0.5, 0.5],
    ],
  },
  {
    id: 'fCyanLow',
    x: 700,
    y: 2300,
    rotate: 28,
    rx: 620,
    ry: 380,
    color: FIELD.cyan,
    stops: [
      [0, 0.6],
      [0.5, 0.25],
    ],
  },
  {
    id: 'fAquaTop',
    x: 700,
    y: 250,
    rotate: -10,
    rx: 460,
    ry: 260,
    color: FIELD.cyan,
    stops: [[0, 0.45]],
  },
  // Lysninger — lime og mint der lyset treffer.
  {
    id: 'fLime',
    x: 150,
    y: 700,
    rotate: 22,
    rx: 800,
    ry: 540,
    color: FIELD.lime,
    stops: [
      [0, 0.9],
      [0.5, 0.4],
    ],
  },
  {
    id: 'fMintTop',
    x: 1000,
    y: 150,
    rotate: -15,
    rx: 720,
    ry: 420,
    color: FIELD.mintLight,
    stops: [
      [0, 0.8],
      [0.5, 0.3],
    ],
  },
  {
    id: 'fMintPocket',
    x: 1010,
    y: 1660,
    rotate: 35,
    rx: 440,
    ry: 300,
    color: FIELD.mintPocket,
    stops: [
      [0, 0.6],
      [0.5, 0.2],
    ],
  },
  {
    id: 'fLime2',
    x: 430,
    y: 2540,
    rotate: -30,
    rx: 380,
    ry: 250,
    color: FIELD.limeSoft,
    stops: [[0, 0.45]],
  },
  {
    id: 'fLime3',
    x: 1180,
    y: 1900,
    rotate: 50,
    rx: 300,
    ry: 200,
    color: FIELD.limeSoft,
    stops: [[0, 0.35]],
  },
  // Stadionlyset — ett skrått, mykt lysbånd.
  {
    id: 'fBeam',
    x: 610,
    y: 900,
    rotate: -14,
    rx: 1000,
    ry: 260,
    color: '#FFFFFF',
    stops: [
      [0, 0.22],
      [0.5, 0.08],
    ],
  },
];

export function DaylightGround() {
  return (
    // ATMOSFÆRE, IKKE INNHOLD — skjult for skjermleser og uten trykkflate,
    // samme kontrakt som MatchGround.
    <View
      style={styles.root}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={ASPECT}>
        <Defs>
          {/* Grunntonen: en MELLOMTONE, så feltene kan både lysne og mørkne. */}
          <LinearGradient
            id="dgBase"
            gradientUnits="userSpaceOnUse"
            x1={106}
            y1={90}
            x2={1175}
            y2={2692}>
            <Stop offset={0} stopColor={FIELD.baseTop} />
            <Stop offset={0.35} stopColor={FIELD.baseMint} />
            <Stop offset={0.7} stopColor={FIELD.baseGreen} />
            <Stop offset={1} stopColor={FIELD.baseDeep} />
          </LinearGradient>
          {FIELDS.map(f => (
            <Field key={f.id} {...f} />
          ))}

          {/* Kritt: lyst oppe til venstre, blekk nede til høyre. */}
          <LinearGradient
            id="dgChalk"
            gradientUnits="userSpaceOnUse"
            x1={-100}
            y1={150}
            x2={1390}
            y2={2600}>
            <Stop offset={0} stopColor={MASTER.white} stopOpacity={0.3} />
            <Stop offset={0.5} stopColor={MASTER.white} stopOpacity={0.1} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0.16} />
          </LinearGradient>
          <LinearGradient
            id="dgInkChalk"
            gradientUnits="userSpaceOnUse"
            x1={-100}
            y1={2300}
            x2={1450}
            y2={1400}>
            <Stop offset={0} stopColor={MASTER.deep} stopOpacity={0.025} />
            <Stop offset={0.58} stopColor={MASTER.deep} stopOpacity={0.145} />
            <Stop offset={1} stopColor={MASTER.white} stopOpacity={0.08} />
          </LinearGradient>

          {/* Dyp grønn kantdybde nede til høyre — tab-barens hjørne. */}
          <RadialGradient
            id="dgDeep"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1240 2815) rotate(-118) scale(770 900)">
            <Stop offset={0} stopColor={MASTER.deep} stopOpacity={0.45} />
            <Stop offset={0.5} stopColor={MASTER.deep} stopOpacity={0.18} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Sheet fill="url(#dgBase)" />
        {FIELDS.map(f => (
          <Sheet key={f.id} fill={`url(#${f.id})`} />
        ))}

        {/* BANEGEOMETRIEN — et ekstralag, halvert: skal ikke bære bakgrunnen. */}
        <G fill="none" opacity={0.45}>
          <Circle
            cx={1355}
            cy={1140}
            r={710}
            stroke="url(#dgChalk)"
            strokeWidth={3.4}
          />
          <Circle
            cx={1355}
            cy={1140}
            r={554}
            stroke="url(#dgChalk)"
            strokeWidth={2}
          />
          <Path
            d="M-300 555 C288 685 510 330 1530 545"
            stroke="url(#dgChalk)"
            strokeWidth={3.2}
          />
          <Path
            d="M-350 2080 C265 1835 830 2180 1595 1810"
            stroke="url(#dgInkChalk)"
            strokeWidth={3.2}
          />
          <Path
            d="M-355 2170 C300 1935 835 2290 1600 1920"
            stroke="url(#dgInkChalk)"
            strokeWidth={1.9}
          />
          <Path
            d="M190 -120 L1135 2925"
            stroke="url(#dgChalk)"
            strokeWidth={1.8}
            opacity={0.52}
          />
          <Circle
            cx={155}
            cy={2024}
            r={17}
            fill={MASTER.white}
            fillOpacity={0.14}
            stroke={MASTER.deep}
            strokeOpacity={0.1}
            strokeWidth={2.5}
          />
        </G>

        <Sheet fill="url(#dgDeep)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DAYLIGHT_GROUND_FALLBACK,
  },
});
