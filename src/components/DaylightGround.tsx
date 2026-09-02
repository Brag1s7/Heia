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
          {/* Fargereisen: mint → neon → aqua/teal → dyp grønn, 158°. */}
          <LinearGradient
            id="dgBase"
            gradientUnits="userSpaceOnUse"
            x1={106}
            y1={90}
            x2={1175}
            y2={2692}>
            <Stop offset={0} stopColor={MASTER.mintTop} />
            <Stop offset={0.25} stopColor={MASTER.mint} />
            <Stop offset={0.52} stopColor={MASTER.neon} />
            <Stop offset={0.76} stopColor={MASTER.aquaDeep} />
            <Stop offset={1} stopColor={MASTER.deepEdge} />
          </LinearGradient>

          {/* Det ene, avgrensede sollysfeltet — heiaSun er kun dette. */}
          <RadialGradient
            id="dgSun"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(115 860) rotate(18) scale(870 940)">
            <Stop offset={0} stopColor={MASTER.sun} stopOpacity={0.66} />
            <Stop offset={0.4} stopColor={MASTER.sunSoft} stopOpacity={0.3} />
            <Stop offset={0.78} stopColor={MASTER.sunSoft} stopOpacity={0} />
          </RadialGradient>

          {/* Mintløftet oppe til venstre — toppen skal være mint, aldri hvit. */}
          <RadialGradient
            id="dgLift"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(80 -70) rotate(49) scale(1070 900)">
            <Stop offset={0} stopColor={MASTER.liftTop} stopOpacity={0.96} />
            <Stop offset={0.38} stopColor={MASTER.liftMid} stopOpacity={0.72} />
            <Stop offset={0.68} stopColor={MASTER.liftLow} stopOpacity={0.2} />
            <Stop offset={1} stopColor={MASTER.liftLow} stopOpacity={0} />
          </RadialGradient>

          {/* Dybde i øvre høyre hjørne. */}
          <RadialGradient
            id="dgTopDepth"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1320 -55) rotate(139) scale(820 850)">
            <Stop offset={0} stopColor={MASTER.deep} stopOpacity={0.23} />
            <Stop offset={0.48} stopColor={MASTER.deep} stopOpacity={0.08} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0} />
          </RadialGradient>

          {/* NEONFELTET — det overdimensjonerte #02FFAB-lyset, 50–65 % av
              inntrykket. Skilles ut som eget lag i bevegelsesskiva. */}
          <RadialGradient
            id="dgNeon"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-30 1650) rotate(-10) scale(1140 1450)">
            <Stop offset={0} stopColor={MASTER.neon} stopOpacity={1} />
            <Stop offset={0.42} stopColor={MASTER.neon} stopOpacity={0.91} />
            <Stop
              offset={0.72}
              stopColor={MASTER.neonSoft}
              stopOpacity={0.45}
            />
            <Stop offset={1} stopColor={MASTER.neonSoft} stopOpacity={0} />
          </RadialGradient>

          {/* AQUAFELTET — den kjølige motparten til høyre. Eget lag senere. */}
          <RadialGradient
            id="dgAqua"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1340 1270) rotate(173) scale(1010 1240)">
            <Stop offset={0} stopColor={MASTER.aqua} stopOpacity={0.95} />
            <Stop offset={0.44} stopColor={MASTER.aquaMid} stopOpacity={0.72} />
            <Stop offset={1} stopColor={MASTER.aquaMid} stopOpacity={0} />
          </RadialGradient>

          {/* Masterens tre blur80-ellipser, som radiale gradienter (avvik 1):
              ellipse(-145 1670, 690×1010) #02FFAB .33
              ellipse(1425 1230, 480×740)  #65E7DD .38
              ellipse(1290 2800, 540×430)  #063A2D .24 */}
          <RadialGradient
            id="dgNeonPool"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-145 1670) scale(850 1170)">
            <Stop offset={0} stopColor={MASTER.neon} stopOpacity={0.33} />
            <Stop offset={0.67} stopColor={MASTER.neon} stopOpacity={0.33} />
            <Stop offset={0.84} stopColor={MASTER.neon} stopOpacity={0.165} />
            <Stop offset={1} stopColor={MASTER.neon} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="dgAquaPool"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1425 1230) scale(640 900)">
            <Stop offset={0} stopColor={MASTER.aqua} stopOpacity={0.38} />
            <Stop offset={0.57} stopColor={MASTER.aqua} stopOpacity={0.38} />
            <Stop offset={0.78} stopColor={MASTER.aqua} stopOpacity={0.19} />
            <Stop offset={1} stopColor={MASTER.aqua} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="dgDeepPool"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1290 2800) scale(700 590)">
            <Stop offset={0} stopColor={MASTER.deep} stopOpacity={0.24} />
            <Stop offset={0.5} stopColor={MASTER.deep} stopOpacity={0.24} />
            <Stop offset={0.75} stopColor={MASTER.deep} stopOpacity={0.12} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0} />
          </RadialGradient>

          {/* STADIONLYSBEAMET — masterens firkant M-260 490 L1390 170 L1470 730
              L-190 880 med blur52 og opacity .76, her som ett mykt, skrått
              lysbånd: senter (610 565), retning −8°, halv lengde 940, halv
              tykkelse 340 (halv båndtykkelse 237 + 2σ). Opasitetene har
              masterens .76 ganget inn. Eget lag i bevegelsesskiva. */}
          <RadialGradient
            id="dgBeam"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(610 565) rotate(-8) scale(940 340)">
            <Stop offset={0} stopColor={MASTER.white} stopOpacity={0.26} />
            <Stop offset={0.4} stopColor={MASTER.white} stopOpacity={0.16} />
            <Stop
              offset={0.75}
              stopColor={MASTER.beamWarm}
              stopOpacity={0.06}
            />
            <Stop offset={1} stopColor={MASTER.white} stopOpacity={0} />
          </RadialGradient>

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

          {/* Dyp grønn kantdybde nede til høyre — verdenen går mot dypt, men
              hverdagsskjermen forblir lys. */}
          <RadialGradient
            id="dgDeep"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1240 2815) rotate(-118) scale(770 900)">
            <Stop offset={0} stopColor={MASTER.deep} stopOpacity={0.43} />
            <Stop offset={0.5} stopColor={MASTER.deep} stopOpacity={0.18} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="dgVignette"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(645 1280) rotate(90) scale(1900 1100)">
            <Stop offset={0.62} stopColor={MASTER.deep} stopOpacity={0} />
            <Stop offset={1} stopColor={MASTER.deep} stopOpacity={0.075} />
          </RadialGradient>
        </Defs>

        {/* Lagrekkefølgen er masterens. */}
        <Sheet fill="url(#dgBase)" />
        <Sheet fill="url(#dgSun)" />
        <Sheet fill="url(#dgLift)" />
        <Sheet fill="url(#dgTopDepth)" />
        <Sheet fill="url(#dgNeon)" />
        <Sheet fill="url(#dgAqua)" />
        <Sheet fill="url(#dgNeonPool)" />
        <Sheet fill="url(#dgAquaPool)" />
        <Sheet fill="url(#dgDeepPool)" />
        <Sheet fill="url(#dgBeam)" />

        {/* BANEGEOMETRIEN — midtsirkelen i høyre kant, to brede banebuer, én
            diagonal lysstripe og ett punkt. Skal bare gjenkjennes når man
            leter etter den. */}
        <G fill="none" opacity={0.86}>
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
        <Sheet fill="url(#dgVignette)" />
        {/* Masterens korn-rect (feTurbulence, multiply .72) utelatt — avvik 2. */}
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
