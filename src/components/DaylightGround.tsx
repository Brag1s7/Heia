import React, {useState} from 'react';
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {useActiveTeam} from '../context';
import {HEADER_BASE, darkenSameHue, teamSpotlight} from '../shared/teamColors';
import {
  FIELD_END_DARKEN,
  FRAME_OPACITY,
  FRAME_STROKE,
  identityFrame,
  journeyStops,
  mastheadHeight,
} from '../shared/masthead';
import {
  ARC_CONTINUATION_FRACTION,
  ARC_INSET_BOTTOM,
  ARC_INSET_RIGHT,
  ARC_OPACITY_INNER,
  ARC_OPACITY_OUTER,
  ARC_R_INNER,
  ARC_R_OUTER,
  ARC_STROKE,
} from '../shared/headerGeometry';

/**
 * DAGSLYSGRUNNEN — hverdagsskjermenes bunn (Hjem, Kalender, Varsler).
 *
 * SAMMENLIGNINGSRIGG, RUNDE 3 (Brage 2026-09-03): fire polariteter bak én
 * konstant, `DAYLIGHT_VERTICAL_VARIANT`. Bytt bokstaven — ingen annen
 * kodeendring — så følger alle tre skjermene med. Ukommittert til Brage har
 * valgt; de tapende variantene fjernes da.
 *
 *   A  Heia → Pearl            (runde 1, URØRT)
 *   D  Heia → Stadium          (runde 1, URØRT)
 *   E  «Heia-fade», GRUNNARKITEKTUREN (port 1 runde 2, 2026-09-03): ÉN
 *      sammenhengende, svakt skrå LinearGradient, #143126 → dyp Heia-grønn
 *      → Heia-neon → lysere Heia → kort mint → opal. Ingen felt. Godkjent
 *      som palett og rekkefølge under både blå og gul lagheader.
 *   E-clean       (port 1 runde 3): SAMME endepunkter, rekkefølge og retning
 *      som E, men én lengre, mer kontinuerlig overgang — rampen er samplet
 *      fra en jevn OKLCH-kurve, se under. Ingen felt.
 *   E-atmosphere  (port 1 runde 3): nøyaktig E-clean + ETT enormt, svært
 *      diffust, nesten vannrett stadionlys fra venstre. Ingen andre felt.
 *   F  «Skrålys», kontrollvariant (port 1 runde 1): base + Heia-lysbånd
 *      langs diagonal kant + Aqua Foam-bro, start #1E4B3A. Urørt.
 *
 * PORT 1 RUNDE 3 (Brage 2026-09-03): E kunne, særlig på Hjem med lite
 * innhold, leses som TRE soner — mørk, neon, lys — fordi lysheten steg
 * bratt (L* 18 → 88 fra 0 til 50 %) og så lå flatt (88–89 fra 45 til 80 %)
 * mens kromaen toppet. E-clean retter det uten nye farger: opplevd lyshet
 * stiger tilnærmet LINEÆRT (L* 18 → 87 fra 0 til 55 %, så 90 → 96), og
 * kromaen er én pukkel med #02FFAB som topp ved 57 % — et høydepunkt, ikke
 * en plate. Mørk teal påvirker ned til ~44 %, Heia-familien (C* ≥ 40)
 * eier 24–79 %, opal dominerer først fra 89 %, og ingen 5 %-steg har
 * ΔE < 4,5 (ingen stillestående sone). Rampen er 26 stopp samplet hver 4 %
 * fra en monoton PCHIP-kurve gjennom disse OKLCH-ankerne [pos, L, C, h]:
 *   0 #143126 · 0,08 (0,335 0,064 165) · 0,18 (0,430 0,100 163) ·
 *   0,30 (0,565 0,140 162) · 0,42 (0,700 0,175 161,5) · 0,50 (0,800 0,192
 *   161) · 0,57 #02FFAB · 0,66 (0,898 0,175 162) · 0,75 (0,918 0,135 163)
 *   · 0,83 (0,936 0,090 162) · 0,90 (0,950 0,048 152) · 1 #F3F4EC,
 * med kroma klemt til sRGB-gamut der kurven ber om mer enn skjermen har
 * (16–52 % og 60–76 %). Mange stopp trengs fordi react-native-svg
 * interpolerer i sRGB; med få stopp ville kurven fått knekk i lyshet.
 *
 * PORT 1 RUNDE 2 (Brage 2026-09-03): Skrålys-E ble en diagonal WIPE —
 * venstre gikk nesten rett i neon mens midten og høyre lå i teal, så hver
 * kolonne var i ulik fargefase, og etter kilen ble resten én jevn neon-/
 * mintflate. Referansen (kun for MÅTEN fargen utvikler seg på) lar nesten
 * hele bredden gjennomgå SAMME kontinuerlige reise nedover, med umiddelbar
 * endring i både lysstyrke og metning. E er derfor nå ~90 % vertikal
 * bevegelse og ~10 % skråstilling: alle kolonner går gjennom alle faser,
 * skråstillingen forskyver dem bare ~6 prosentpoeng fra venstre til høyre
 * (venstre først). Heia skal DOMINERE — ikke som flatt #02FFAB-felt, men
 * som en lang fade gjennom mørkere, renere og lysere Heia-varianter:
 * 0–20 % mørk Heia-teal, 20–80 % Heia-reisen, 80–100 % mint som raskt
 * løses opp i lys opal. Mint er et kort steg, aldri en flate.
 *
 * BESLUTNING PORT 1 (Brage 2026-09-03, «Komposisjon 1 Skrålys»): MØRKT ER
 * GRUNNTILSTANDEN ØVERST, lys bryter inn — ikke omvendt. Runde 4 hadde lys
 * base med et mørkt felt oppå, og mørket leste som en flekk i hjørnet mens
 * resten var én glatt mintflate. Nå er basen mørk Heia-teal i toppen, og ett
 * bredt Heia-lys bryter gjennom fra første synlige rad langs én myk DIAGONAL
 * kant: alt under kanten er lyst, bare kilen øverst til høyre er teal. Lys
 * på mørkt leses som flomlys — Heias verden; mørkt på lyst leses som skygge.
 *
 * ANKERET ER #143126 — den lyse enden av stadiongradienten (StadiumSurface/
 * BootScreen: #0B1912 → #143126), som lagheaderens høyrekant alt blander mot
 * (teamColors EDGE_TEAL) og som Profil-headeren lander i. Én Heia-familie,
 * ikke en ny cyan-teal (runde 4s kjøligere teal er forkastet). PORT 2 (egen
 * skive, etter telefondom på E): lagheaderen får en ~14 pt «Teal-fot» som
 * fader laggradienten mot nøyaktig #143126, hårlinjen fjernes, og grunnen
 * starter i samme #143126 — så alle lagfarger lander i samme teal uten at
 * grunnen arver lagfargen. Heia-lyset tennes de første 30–45 pt under
 * skjøten. Den harde skjøten er derfor IKKE ferdig i port 1.
 *
 * TO ROM, MED VILJE:
 *
 * 1. MASTERROMMET (A, D og banegeometrien): masterens 1290 × 2796, hele
 *    skjermrammen. Komponenten ligger nå i KROPPEN under laghodet (se
 *    skjermene), og med `xMidYMax slice` forankres masteren i bunnen: på
 *    iPhone-formatet 393 × 852 er den skalerte masteren nøyaktig
 *    skjermhøy, så toppen havner under laghodet og hver piksel står der den
 *    sto i runde 1. A og D er derfor identiske med det Brage alt har sett.
 *
 * 2. KROPPSROMMET (E og F): 0–1000 i begge retninger = det SYNLIGE
 *    body-området, strukket med `preserveAspectRatio="none"`. 0 % er første
 *    synlige piksel under laghodet, 100 % er skjermbunnen (bak tab-baren).
 *    Alle prosenter i spesifikasjonen er prosent av body — ellipsene under
 *    er derfor oppgitt i tusendeler av bredde/høyde, ikke i punkter.
 *
 *    Referansen (background-vertical-fade.png) er IKKE en ren vertikal
 *    gradient: den kombinerer én vertikal reise med svært store lysfelt
 *    UTENFOR rammen, så fargen varierer allerede på samme rad. Skrålys har
 *    tre lag, to felt:
 *      lag 1 = kroppsforankret vertikal base som EIER reisen: mørk teal
 *              øverst → Heia-neon → mint → lys slutt, ingen identiske stopp;
 *      lag 2 = HEIA-LYSET: en rotert ellipse med sentrum langt nede til
 *              venstre UTENFOR kroppen og enorme radier (260 % × 82 %), så
 *              den eneste synlige kanten er én myk diagonal fra like over
 *              venstre topp ned til høyre kant. Opasiteten topper LANGS
 *              kanten (r 0,6–0,85) og er nesten null ved eget sentrum —
 *              derfor er det et lysbånd som tenner Heia fra første rad til
 *              venstre og lar basen ta over nedover, uten mørk «dal» under
 *              båndet (basen er alt lys der båndet slipper). Et sentrert
 *              felt kan ikke gjøre dette: enten dekker det høyre topp også
 *              (tealen forsvinner), eller så er venstre ikke Heia.
 *      lag 3 = AQUA FOAM som BRO nede til venstre (sentrum utenfor venstre
 *              kant ved 60 % høyde): sidebevegelse i nedre halvdel, aldri
 *              toppen.
 *    Ingen småfelt, beam, dgDeep, blur, støy eller animasjon. Ingen
 *    ellipse skal kunne anes; kan den det, er feltet for lite.
 *
 * Banegeometrien tegnes i en EGEN svg i masterrommet (slice), fordi den ville
 * blitt strukket skjevt i `none`-rommet. Det er to statiske svg-er, ikke
 * flere lag i bevegelse; bevegelsesskiva står fortsatt uåpnet.
 *
 * ⚠️ FARGENE ER LOKALE MED VILJE (briefens presisering 6): briefens
 * `heiaInk` (#052C23) og `heiaDeep` (#063A2D) kolliderer med tokenene
 * `colors.heiaInk` (#087A5A, tekstgrønn i ~40 bruksteder) og
 * `colors.heiaDeep` (#08392E). Den valgte polariteten promoteres til tokens
 * ETTER telefondommen, i egen skive.
 */

/**
 * A/B-BRYTER — MIDLERTIDIG. `false` = skjermene nøyaktig som før grunnen:
 * krem `colors.background`, ingen grunn, navigatorens vanlige fallback.
 */
export const DAYLIGHT_GROUND_AB = true;

/** De fire polaritetene som sammenlignes på telefonen. */
export type DaylightVerticalVariant =
  | 'A'
  | 'D'
  | 'E'
  | 'F'
  | 'E-clean'
  | 'E-atmosphere';
/** Variantene som tegnes i kroppsrommet (alle unntatt A og D). */
type SpatialKey = Exclude<DaylightVerticalVariant, 'A' | 'D'>;

/**
 * SAMMENLIGNINGSBRYTEREN. Bytt til 'E-atmosphere' (eller 'E', 'F', 'A',
 * 'D') for neste telefonbilde — alt annet er identisk. Fjernes (sammen med de tapende variantene) når
 * Brage har valgt.
 */
export const DAYLIGHT_VERTICAL_VARIANT: DaylightVerticalVariant =
  'E-atmosphere';

/**
 * Fallback-bunnen bak svg-ene (synlig et blunk mens de måles opp) og
 * rutekortet i navigatoren for de tre skjermene, så push/pop ikke blinker
 * krem i kantene. Alle variantene er Heia-neon/mint i den synlige toppen,
 * så den felles mint-fallbacken står urørt gjennom sammenligningen.
 */
export const DAYLIGHT_GROUND_FALLBACK = '#26F5AD';

/** [posisjon 0–1, farge] langs den vertikale aksen. */
type ColorStops = ReadonlyArray<readonly [number, string]>;

// ---------------------------------------------------------------------------
// MASTERROMMET — A og D (runde 1, ordrett), pluss banegeometrien.
// ---------------------------------------------------------------------------

const MASTER_W = 1290;
const MASTER_H = 2796;
/** Bunnforankret: samme piksler som runde 1 (se filkommentaren, punkt 1). */
const MASTER_ASPECT = 'xMidYMax slice';

const MASTER_STOPS: Record<'A' | 'D', ColorStops> = {
  // A – Heia → Pearl
  A: [
    [0, '#02FFAB'],
    [0.28, '#02FFAB'],
    [0.5, '#55FFC5'],
    [0.72, '#B9FFE5'],
    [0.88, '#E8FFF6'],
    [1, '#F7F5E9'],
  ],
  // D – Heia → Stadium
  D: [
    [0, '#79FFD3'],
    [0.18, '#02FFAB'],
    [0.43, '#02FFAB'],
    [0.62, '#09CE94'],
    [0.8, '#08765D'],
    [1, '#052C23'],
  ],
};

// ---------------------------------------------------------------------------
// KROPPSROMMET — E og F: vertikal base + to enorme off-canvas-felt.
// ---------------------------------------------------------------------------

/** Kroppens lerret: 1000 = 100 % av synlig bredde, 1000 = 100 % av høyde. */
const BODY = 1000;

/**
 * Ett enormt elliptisk felt med sentrum UTENFOR kroppen. Alle mål i
 * tusendeler av body-bredde (cx, rx) og body-høyde (cy, ry); `rotate` er
 * grader i kroppsrommet (før strekkingen til skjermen — en rett kant forblir
 * rett). Stoppene er [avstand fra sentrum 0–1, farge, opasitet].
 */
interface OffCanvasField {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate?: number;
  stops: ReadonlyArray<readonly [number, string, number]>;
}

interface SpatialVariant {
  /** Lag 1: kroppsforankret vertikal base. Ingen identiske stopp. */
  base: ColorStops;
  /**
   * Basens skråstilling, i tusendeler av kroppshøyden: hvor mye SENERE
   * (lenger ned) en gitt fase treffer høyre kant enn venstre kant. 60 = høyre
   * kant ligger 6 % av høyden etter venstre (midten er referansen, ±3 %).
   * Fargegrensene blir nesten vannrette, bare svakt skrå. 0/udefinert =
   * rent vertikal.
   */
  skew?: number;
  /** Lag 2 og 3, i tegnerekkefølge: Heia-lyset (diagonal kant), Aqua Foam
   *  som bro (nede til venstre). Maks to. */
  fields: ReadonlyArray<OffCanvasField>;
}

/**
 * ANKERET: Heias universelle teal — den lyse enden av stadiongradienten
 * (StadiumSurface/BootScreen), lagheaderens EDGE_TEAL, Profil-headerens
 * landing. E starter i nøyaktig denne; port 2 lar laghodets fot lande i den.
 * Lokal her til port 2 promoterer den til token (samme regel som resten).
 */
const HEIA_TEAL = '#143126';
/** F-start: samme tone som ankeret, løftet mot Heia (L* 28 mot 18). */
const HEIA_TEAL_SOFT = '#1E4B3A';
const HEIA = '#02FFAB';

/**
 * Aqua Foam som BRO — felles for E og F. Sentrum utenfor venstre kant ved
 * 60 % av høyden, aldri i toppen: sidebevegelse i nedre halvdel (gutter ved
 * 85 %: ΔE ≈ 17 på E, ≈ 6 på F), mens toppen eies av teal og Heia.
 */
const AQUA_FOAM_BRIDGE: OffCanvasField = {
  cx: -250,
  cy: 600,
  rx: 950,
  ry: 500,
  stops: [
    [0, '#84F8E4', 0.5],
    [0.5, '#84F8E4', 0.25],
    [1, '#84F8E4', 0],
  ],
};

/**
 * Heia-lysets opasitet langs radius: null ved eget sentrum (nede til
 * venstre), topp langs den diagonale kanten (0,6–0,85), null utenfor.
 * Samme for E og F — bare linja (sentrum/rotasjon) og basen skiller dem.
 */
const HEIA_LIGHT_STOPS: ReadonlyArray<readonly [number, string, number]> = [
  [0, HEIA, 0],
  [0.35, HEIA, 0.1],
  [0.6, HEIA, 0.9],
  [0.75, HEIA, 1],
  [0.85, HEIA, 0.5],
  [1, HEIA, 0],
];

/**
 * E-CLEAN-RAMPEN — se filkommentaren (port 1 runde 3) for kurven og ankerne.
 * Endepunktene er E sine, ordrett. Delt av E-clean og E-atmosphere.
 */
const E_CLEAN_BASE: ColorStops = [
  [0, HEIA_TEAL],
  [0.04, '#11382A'],
  [0.08, '#0B412E'],
  [0.12, '#014C34'],
  [0.16, '#00593C'],
  [0.2, '#006645'],
  [0.24, '#00754F'],
  [0.28, '#00845A'],
  [0.32, '#009364'],
  [0.36, '#00A36F'],
  [0.4, '#00B37A'],
  [0.44, '#00C485'],
  [0.48, '#00D791'],
  [0.52, '#03EA9E'],
  [0.56, '#01FDAA'], // toppen (#02FFAB ligger ved 57 %, mellom stoppene)
  [0.6, '#3EFFB1'],
  [0.64, '#52FFB8'],
  [0.68, '#68FFBF'],
  [0.72, '#7DFFC6'],
  [0.76, '#90FFCD'],
  [0.8, '#A3FFD3'],
  [0.84, '#B8FDD9'],
  [0.88, '#CFFADD'],
  [0.92, '#DFF7E0'],
  [0.96, '#ECF5E4'],
  [1, '#F3F4EC'],
];

/**
 * STADIONLYSET i E-atmosphere — KALIBRERINGSVERSJON, MED VILJE STERK (Brage
 * 2026-09-03). De to første testene var målbare i ΔE (3,7 og 8) men ikke
 * synlige på telefonen: for store (3 bredder) og for like grunnrampen i
 * farge. Nå: ett stort, mykt stadionlys som kommer inn fra venstre og dør ut
 * mot høyre og mot den lyse bunnen. Sentrum 15 % utenfor venstre kant ved
 * 33 % høyde, 2,1 bredder bredt, 0,84 høyder høyt, 7° fra vannrett. Fargen er
 * en lys, METTET Heia-tone (#35FFC0), ikke mint. Effektiv styrke: venstre
 * 0,24–0,28 i 20–40 %, midt 0,11–0,17, høyre 0; ΔE mot E-clean venstre
 * 13,5 / 11 ved 20 / 30 %, midt 7 / 7; nesten null under 60 %, null fra 70 %.
 * Ingen kant: fadingen fra r 0,72 til 1 er 30 % av bredden bred. Fungerer
 * komposisjonen, tunes styrken NED etter telefonbildet; ellers låses E-clean.
 */
const STADIUM_LIGHT: OffCanvasField = {
  cx: -150,
  cy: 330,
  rx: 1050,
  ry: 420,
  rotate: 7,
  stops: [
    [0, '#35FFC0', 0.3],
    [0.25, '#35FFC0', 0.27],
    [0.72, '#35FFC0', 0.14],
    [1, '#35FFC0', 0],
  ],
};

const SPATIAL: Record<SpatialKey, SpatialVariant> = {
  // E-clean – samme retning (skew 60) som E, rampen over, ingen felt.
  'E-clean': {
    base: E_CLEAN_BASE,
    skew: 60,
    fields: [],
  },
  // E-atmosphere – nøyaktig E-clean + ett stadionlys. Ingen andre felt.
  'E-atmosphere': {
    base: E_CLEAN_BASE,
    skew: 60,
    fields: [STADIUM_LIGHT],
  },
  // E – HOVEDKANDIDATEN, «Heia-fade». Brages ramp, ordrett, relativt til det
  // synlige body-området. Ingen identiske stopp, ingen felt. Skråstilling
  // 60 (6 prosentpoeng venstre → høyre, venstre først) ≈ 6,4° fra vertikal
  // på 393 × 739 pt. Fasetabell (modellert, L* < 45 = mørk, lysfase = L* >
  // 90): mørk fase slipper venstre 18 % / midt 21 % / høyre 24 %; ren
  // Heia-kjerne 49 / 52 / 55 %; lysfasen begynner 77 / 80 / 83 %. Første
  // rad ligger i sin helhet mellom #143126 og #164232.
  E: {
    base: [
      [0, HEIA_TEAL], // loading-/bro-teal
      [0.07, '#164232'], // umiddelbar mørk bevegelse
      [0.15, '#126149'], // dyp Heia-grønn
      [0.23, '#0B8F68'], // grønn mellomtone
      [0.33, '#00C889'], // på vei inn i Heia
      [0.43, '#02EFA2'], // sterk Heia
      [0.52, HEIA], // ren Heia-kjerne — ett stopp, ikke et platå
      [0.62, '#16FDB2'], // lysere Heia
      [0.72, '#3EF9BB'], // Heia-familien fortsetter
      [0.8, '#76F4C8'], // lys overgang
      [0.87, '#B8EED7'], // kort mintfase
      [0.94, '#DDEFE5'], // lys opal
      [1, '#F3F4EC'], // varm, rolig avslutning
    ],
    skew: 60,
    fields: [],
  },
  // F – KONTROLLVARIANTEN, mildere: samme geometri, start #1E4B3A, neon
  // alt ved 30 %, så #75EABC → #B7E9CC → #DDEDDD → varm opal #F7F3E9.
  // Lyskanten fra 8 % over venstre topp til 20 % ned på høyre kant.
  // Modellert: første rad #06E49A · #177B58 · #1E4B3A; mørk fase slutter
  // 0 / 0 / 11 %; midt ved 50 % #81EDC3, ved 100 % #E4F4E4; gutter ΔE 5,9.
  F: {
    base: [
      [0, HEIA_TEAL_SOFT],
      [0.1, '#1F6A50'],
      [0.2, '#10B384'],
      [0.3, HEIA],
      [0.44, '#75EABC'],
      [0.6, '#B7E9CC'],
      [0.78, '#DDEDDD'],
      [1, '#F7F3E9'],
    ],
    fields: [
      {
        cx: 311,
        cy: 734,
        rx: 2600,
        ry: 824,
        rotate: 15.6,
        stops: HEIA_LIGHT_STOPS,
      },
      AQUA_FOAM_BRIDGE,
    ],
  },
};

function isSpatial(v: DaylightVerticalVariant): v is SpatialKey {
  return v !== 'A' && v !== 'D';
}

/** Krittets og blekkets farger — banegeometriens egne, fra masteren. */
const CHALK = {
  white: '#FFFFFF',
  deep: '#063A2D', // briefens heiaDeep
} as const;

/** A/D: masterens vertikale base, bunnforankret. */
function MasterGround({stops}: {stops: ColorStops}) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${MASTER_W} ${MASTER_H}`}
      preserveAspectRatio={MASTER_ASPECT}>
      <Defs>
        <LinearGradient
          id="dgMasterBase"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={0}
          y2={MASTER_H}>
          {stops.map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={MASTER_W}
        height={MASTER_H}
        fill="url(#dgMasterBase)"
      />
    </Svg>
  );
}

/** Ett off-canvas-felt som radial gradient i kroppsrommet. */
function FieldGradient({id, field}: {id: string; field: OffCanvasField}) {
  return (
    <RadialGradient
      id={id}
      cx={0}
      cy={0}
      r={1}
      gradientUnits="userSpaceOnUse"
      gradientTransform={`translate(${field.cx} ${field.cy}) rotate(${
        field.rotate ?? 0
      }) scale(${field.rx} ${field.ry})`}>
      {field.stops.map(([offset, color, opacity]) => (
        <Stop
          key={offset}
          offset={offset}
          stopColor={color}
          stopOpacity={opacity}
        />
      ))}
    </RadialGradient>
  );
}

/**
 * Basens gradientakse fra `skew`. Utledet slik at fasen t(x, y) =
 * (y − s·x)/H + s/2 med s = skew/H: midten (x = H/2) er uforskjøvet, venstre
 * kant ligger s/2 foran, høyre kant s/2 etter. p1 = (H/2, 0); p2 = p1 +
 * b·(−s, 1) med b = H/(1 + s²), som gir nøyaktig disse koeffisientene.
 */
function baseAxis(skew: number | undefined) {
  const sk = (skew ?? 0) / BODY;
  const b = BODY / (1 + sk * sk);
  return {x1: BODY / 2, y1: 0, x2: BODY / 2 - sk * b, y2: b};
}

/**
 * E/F: base (evt. svakt skrå) + felt, strukket til containeren.
 *
 * MASTHEAD: containeren er HELE skjermen, og `bodyTop` (andel av høyden der
 * laghodet slutter) forskyver kroppsrommet ned: basen får #0E211A ved 0 og
 * broen #143126 ved laghodets underkant (journeyStops), og feltene skaleres
 * inn i kroppen med samme utseende på skjermen — så reisen og
 * E-atmosphere-lyset er ÉN kontinuerlig flate over laghodets underkant.
 * Ingen egen toppstripe, ingen stripe under identitetsfeltet (Brage
 * 2026-09-03: «streken under linjen med lagfarge»). bodyTop 0 = som før.
 */
function SpatialGround({
  spec,
  bodyTop = 0,
}: {
  spec: SpatialVariant;
  bodyTop?: number;
}) {
  const bodyScale = 1 - bodyTop;
  const mapY = (y: number) => (bodyTop + (y / BODY) * bodyScale) * BODY;
  const axis = baseAxis(
    spec.skew === undefined ? undefined : spec.skew * bodyScale,
  );
  const base =
    bodyTop > 0 ? journeyStops(bodyTop, 1, HEADER_BASE, spec.base) : spec.base;
  const fields = spec.fields.map(f => ({
    ...f,
    cy: mapY(f.cy),
    ry: f.ry * bodyScale,
    // Rotasjonen i 1000-rommet justeres så vinkelen PÅ SKJERMEN er uendret
    // når y-skalaen endres.
    rotate:
      f.rotate === undefined
        ? undefined
        : (Math.atan(Math.tan((f.rotate * Math.PI) / 180) * bodyScale) * 180) /
          Math.PI,
  }));
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${BODY} ${BODY}`}
      preserveAspectRatio="none">
      <Defs>
        <LinearGradient
          id="dgBodyBase"
          gradientUnits="userSpaceOnUse"
          x1={axis.x1}
          y1={axis.y1}
          x2={axis.x2}
          y2={axis.y2}>
          {base.map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
        {fields.map((field, i) => (
          <FieldGradient key={i} id={`dgField${i}`} field={field} />
        ))}
      </Defs>
      <Rect x={0} y={0} width={BODY} height={BODY} fill="url(#dgBodyBase)" />
      {fields.map((_, i) => (
        <Rect
          key={i}
          x={0}
          y={0}
          width={BODY}
          height={BODY}
          fill={`url(#dgField${i})`}
        />
      ))}
    </Svg>
  );
}

/**
 * BANEGEOMETRIEN — et ekstralag, halvert: skal ikke bære bakgrunnen.
 * Identisk i alle variantene, alltid i masterrommet (aldri strukket).
 */
function ChalkGeometry() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${MASTER_W} ${MASTER_H}`}
      preserveAspectRatio={MASTER_ASPECT}>
      <Defs>
        {/* Kritt: lyst oppe til venstre, blekk nede til høyre. */}
        <LinearGradient
          id="dgChalk"
          gradientUnits="userSpaceOnUse"
          x1={-100}
          y1={150}
          x2={1390}
          y2={2600}>
          <Stop offset={0} stopColor={CHALK.white} stopOpacity={0.3} />
          <Stop offset={0.5} stopColor={CHALK.white} stopOpacity={0.1} />
          <Stop offset={1} stopColor={CHALK.deep} stopOpacity={0.16} />
        </LinearGradient>
        <LinearGradient
          id="dgInkChalk"
          gradientUnits="userSpaceOnUse"
          x1={-100}
          y1={2300}
          x2={1450}
          y2={1400}>
          <Stop offset={0} stopColor={CHALK.deep} stopOpacity={0.025} />
          <Stop offset={0.58} stopColor={CHALK.deep} stopOpacity={0.145} />
          <Stop offset={1} stopColor={CHALK.white} stopOpacity={0.08} />
        </LinearGradient>
      </Defs>
      {/* PORT 2 (Brage 2026-09-03): de to store krittsirklene er FJERNET —
          buene (ArcFamily under) er nå
          grunnens eneste sirkelfamilie. Banelinjene og prikken står. */}
      <G fill="none" opacity={0.45}>
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
          fill={CHALK.white}
          fillOpacity={0.14}
          stroke={CHALK.deep}
          strokeOpacity={0.1}
          strokeWidth={2.5}
        />
      </G>
    </Svg>
  );
}

/**
 * BUENE — ÉN familie (masthead, Brage 2026-09-03): sirkelparet forankret 30 pt
 * inn fra høyre og 10 pt over laghodets underkant (radius 100 og 68, delt
 * med kampkortene og ProfileHeader), i stadiumText, konstant gjennom
 * laghodet og fadet ut over de første 12 % av kroppen. Laghodet tegner ikke
 * egne buer — det er gjennomsiktig innhold oppå dette lerretet.
 */
function ArcFamily({
  width,
  height,
  headerHeight,
}: {
  width: number;
  height: number;
  headerHeight: number;
}) {
  if (width <= 0 || height <= 0) return null;
  const cx = width - ARC_INSET_RIGHT;
  const cy = headerHeight - ARC_INSET_BOTTOM;
  const fadeEnd =
    headerHeight + (height - headerHeight) * ARC_CONTINUATION_FRACTION;
  const fade = (id: string, opacity: number) => (
    <LinearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      y1={0}
      x2={0}
      y2={fadeEnd}>
      <Stop offset={0} stopColor={colors.stadiumText} stopOpacity={opacity} />
      <Stop
        offset={headerHeight / fadeEnd}
        stopColor={colors.stadiumText}
        stopOpacity={opacity}
      />
      <Stop offset={1} stopColor={colors.stadiumText} stopOpacity={0} />
    </LinearGradient>
  );
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        {fade('dgArcOuter', ARC_OPACITY_OUTER)}
        {fade('dgArcInner', ARC_OPACITY_INNER)}
      </Defs>
      <Circle
        cx={cx}
        cy={cy}
        r={ARC_R_OUTER}
        fill="none"
        stroke="url(#dgArcOuter)"
        strokeWidth={ARC_STROKE}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={ARC_R_INNER}
        fill="none"
        stroke="url(#dgArcInner)"
        strokeWidth={ARC_STROKE}
      />
    </Svg>
  );
}

/**
 * IDENTITETSFELTET (masthead): lagfargen klippet til innsiden av den
 * avrundede rammen rundt logo/navn — full styrke gjennom 85 % av feltets
 * bredde, svakt mørknet med samme hue mot den runde enden. Utenfor: ren
 * base. Streken er et subtilt kantlys i stadiumText som følger formen med
 * åpne sider og løses opp med gradient. Se shared/masthead.ts.
 */
function TeamField({
  width,
  height,
  insetTop,
  color,
}: {
  width: number;
  height: number;
  insetTop: number;
  color: string;
}) {
  if (width <= 0 || height <= 0) return null;
  const frame = identityFrame(width, insetTop);
  const edge = colors.stadiumText;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient
          id="dgFieldFill"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={frame.fill.right}
          y2={0}>
          <Stop offset={0} stopColor={color} />
          <Stop
            offset={frame.fill.fullUntil / frame.fill.right}
            stopColor={color}
          />
          <Stop offset={1} stopColor={darkenSameHue(color, FIELD_END_DARKEN)} />
        </LinearGradient>
        <LinearGradient
          id="dgFrameTop"
          gradientUnits="userSpaceOnUse"
          x1={frame.top.fadeFrom}
          y1={0}
          x2={frame.top.fadeTo}
          y2={0}>
          <Stop offset={0} stopColor={edge} stopOpacity={FRAME_OPACITY} />
          <Stop offset={1} stopColor={edge} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient
          id="dgFrameSide"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={frame.side.fadeFrom}
          x2={0}
          y2={frame.side.fadeTo}>
          <Stop offset={0} stopColor={edge} stopOpacity={FRAME_OPACITY} />
          <Stop offset={1} stopColor={edge} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={frame.fill.d} fill="url(#dgFieldFill)" />
      <Path
        d={frame.top.d}
        fill="none"
        stroke="url(#dgFrameTop)"
        strokeWidth={FRAME_STROKE}
      />
      <Path
        d={frame.side.d}
        fill="none"
        stroke="url(#dgFrameSide)"
        strokeWidth={FRAME_STROKE}
      />
    </Svg>
  );
}

interface DaylightGroundProps {
  /**
   * MASTHEAD (Brage 2026-09-03): grunnen fyller HELE skjermen, også bak
   * laghodet — laghodet er gjennomsiktig innhold. Reisen starter i #0E211A
   * i statuslinja og treffer broen #143126 ved laghodets underkant; lagets
   * identitetsfelt og buene tegnes her. Uten: som før — grunnen fyller
   * containeren den står i (Comments).
   */
  masthead?: boolean;
}

export function DaylightGround({masthead = false}: DaylightGroundProps) {
  const variant = DAYLIGHT_VERTICAL_VARIANT;
  const [box, setBox] = useState({w: 0, h: 0});
  const insets = useSafeAreaInsets();
  const {activeTeamSpace} = useActiveTeam();
  const headerHeight = masthead ? mastheadHeight(insets.top) : 0;
  const teamColor = masthead ? activeTeamSpace?.color : undefined;
  const spot = teamColor ? teamSpotlight(teamColor) : null;
  return (
    // ATMOSFÆRE, IKKE INNHOLD — skjult for skjermleser og uten trykkflate,
    // samme kontrakt som MatchGround. Fyller KROPPEN den ligger i.
    <View
      style={styles.root}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={e =>
        setBox({w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height})
      }>
      {/* REISEN: i masthead-modus ÉN flate fra statuslinja til bunnen, med
          kroppsrommet forskjøvet ned under laghodet (bodyTop); ellers hele
          containeren som før. Ventes til høyden er målt i masthead-modus, så
          ingenting tegnes med feil forskyvning et blunk. */}
      {isSpatial(variant) ? (
        (!masthead || box.h > 0) && (
          <SpatialGround
            spec={SPATIAL[variant]}
            bodyTop={masthead && box.h > 0 ? headerHeight / box.h : 0}
          />
        )
      ) : (
        <MasterGround stops={MASTER_STOPS[variant]} />
      )}
      <ChalkGeometry />
      {spot && (
        <TeamField
          width={box.w}
          height={box.h}
          insetTop={insets.top}
          color={spot.surface}
        />
      )}
      {masthead && (
        <ArcFamily width={box.w} height={box.h} headerHeight={headerHeight} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DAYLIGHT_GROUND_FALLBACK,
  },
});
