// Kuratert lagfarge-palett — A v2-regelen er «lagfarge kontrollert».
// Fri fargevelger er bevisst valgt bort: hvit/krem blir usynlig på kort og
// bakgrunn, og mint-toner kolliderer med #02FFAB (reservert Heia/handling —
// et lag i mint ville gjort live-scoren tvetydig). Tolv farger dekker i
// praksis norske klubbdrakter.

export interface TeamColorOption {
  value: string;
  /** Norsk navn — brukes i accessibilityLabel på swatchene. */
  name: string;
}

export const TEAM_COLORS: TeamColorOption[] = [
  {value: '#D92B2B', name: 'Rød'},
  {value: '#7A1F3D', name: 'Vinrød'},
  {value: '#E8590C', name: 'Oransje'},
  {value: '#FFC53D', name: 'Gul'},
  {value: '#1E7A46', name: 'Skoggrønn'},
  {value: '#0F766E', name: 'Petrol'},
  {value: '#2D9CDB', name: 'Lyseblå'},
  {value: '#1D4ED8', name: 'Blå'},
  {value: '#12315E', name: 'Marineblå'},
  // Indigo = create_team_from_scratch sin gamle default (00016) — beholdes i
  // paletten så eksisterende lag viser «valgt» når fargevelgeren åpnes.
  {value: '#6366F1', name: 'Indigo'},
  {value: '#DB2777', name: 'Rosa'},
  {value: '#111827', name: 'Sort'},
];

const INK_DARK = '#11241B';
const INK_LIGHT = '#FFFFFF';
/** WCAG AA for normal tekst. Headeren bærer lagnavnet — den skal klare den. */
const MIN_CONTRAST = 4.5;

/**
 * Headerens gradient går fra lagets identitet til Heias finish:
 * venstre = lagets faktiske farge, midten = samme familie litt dypere,
 * høyre = tydelig mørkere med et lett drag mot Heias grønn/teal.
 *
 * Teal-ankeret er den lyse enden av stadiongradienten (#143126), IKKE minten
 * (#02FFAB) — minten er handlingsfarge og ville gjort høyresiden flashy.
 * Blandingen er lav nok til at det leses som en mørk, rolig tone, ikke som
 * «grønn».
 */
const MID_DARKEN = 0.18;
const EDGE_DARKEN = 0.32;
const EDGE_TEAL = '#143126';
const EDGE_TEAL_MIX = 0.22;
/**
 * Hvor langt mot høyre teksten realistisk kan rekke før «Sesongen»-chipen
 * (som har sin egen mørke flate). Kontrasten måles der, ikke helt ute i
 * høyre kant der ingen bokstaver står.
 */
const TEXT_REACH = 0.22;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex.trim());
  if (!m) return null;
  return [
    parseInt(m[1].slice(0, 2), 16),
    parseInt(m[1].slice(2, 4), 16),
    parseInt(m[1].slice(4, 6), 16),
  ];
}

function toHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map(v =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** WCAG relativ luminans. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Lagfarget toppflate som en horisontal gradient i tre trinn, med garantert
 * lesbar tekst.
 *
 * Laget eier venstresiden — der står den FAKTISKE valgte fargen, ren og uten
 * innblanding, og det er der logo og lagnavn ligger. Midten er samme
 * fargefamilie litt dypere. Høyre kant er tydelig mørkere med et lett drag mot
 * Heias grønn/teal, så finishen kjennes som Heia uten å bli en grønn flate.
 *
 * Holder ikke fargen 4.5:1 mot verken hvit eller mørk tekst (typiske
 * mellomtoner som lyseblå og oransje), skyves valøren trinnvis til den gjør
 * det. Fargetonen beholdes, så laget kjenner seg igjen.
 *
 * Kontrasten måles i flatens verste punkt DER DET FAKTISK STÅR TEKST: for en
 * flate med mørk tekst er det så langt mot høyre navnet kan rekke (TEXT_REACH),
 * ikke ytterkanten bak «Sesongen»-chipen.
 *
 * Dekker begge ytterpunktene uten hardkodede unntak: nesten-sort ligger med
 * hvit tekst, knallgult beholder mørk tekst.
 */
export function teamHeaderSurface(hex: string): {
  /** Venstre kant — lagets faktiske farge (evt. kontrastjustert). */
  surface: string;
  /** Midtstopp — samme familie, litt dypere. */
  surfaceMid: string;
  /** Høyre kant — mørkere, med et lett hint av Heias teal. */
  surfaceEdge: string;
  /** Tekst-/ikonfargen som skal brukes oppå flaten. */
  ink: string;
  /** Er flaten lys? Styrer statuslinje og kant på logoplate/«Sesongen». */
  light: boolean;
} {
  const rgb = parseHex(hex);
  if (!rgb) {
    return {
      surface: hex,
      surfaceMid: hex,
      surfaceEdge: hex,
      ink: INK_LIGHT,
      light: false,
    };
  }

  const darkInk = parseHex(INK_DARK) as Rgb;
  const lightInk = parseHex(INK_LIGHT) as Rgb;
  const teal = parseHex(EDGE_TEAL) as Rgb;

  const mid = (s: Rgb): Rgb => s.map(v => v * (1 - MID_DARKEN)) as Rgb;
  const edge = (s: Rgb): Rgb =>
    mix(s.map(v => v * (1 - EDGE_DARKEN)) as Rgb, teal, EDGE_TEAL_MIX);

  /**
   * Hvor langt fargen må flyttes for at ÉN av tekstfargene skal klare AA.
   * Mørk tekst: flaten blir mørkere mot høyre, så tekstens ytterste punkt er
   * svakest, og fargen må lysnes. Hvit tekst: venstre kant er svakest, og
   * fargen må mørknes.
   */
  const solve = (useDarkInk: boolean) => {
    const ink = useDarkInk ? darkInk : lightInk;
    const worst = (s: Rgb) => (useDarkInk ? mix(mid(s), edge(s), TEXT_REACH) : s);
    let s = rgb;
    let steps = 0;
    // 14 × 6 % rekker fra hvilken som helst startfarge til nær sort/hvit.
    while (steps < 14 && contrast(worst(s), ink) < MIN_CONTRAST) {
      s = useDarkInk
        ? (s.map(v => v + (255 - v) * 0.06) as Rgb) // mot hvitt
        : (s.map(v => v * 0.94) as Rgb); // mot sort
      steps++;
    }
    return {surface: s, steps, ok: contrast(worst(s), ink) >= MIN_CONTRAST};
  };

  // Velg tekstfargen som krever MINST avvik fra lagets faktiske farge —
  // ikke bare den som vinner på råfargen. Uten dette ble mellomtoner som
  // oransje og lyseblå lysnet til blasse pasteller for å redde mørk tekst,
  // og venstresiden sluttet å ligne lagets valgte farge. Uavgjort → hvit
  // tekst, som passer gradientens retning mot mørkere høyre.
  const withLight = solve(false);
  const withDark = solve(true);
  const useDarkInk =
    withDark.ok && (!withLight.ok || withDark.steps < withLight.steps);
  const surface = useDarkInk ? withDark.surface : withLight.surface;

  return {
    surface: toHex(surface),
    surfaceMid: toHex(mid(surface)),
    surfaceEdge: toHex(edge(surface)),
    ink: useDarkInk ? INK_DARK : INK_LIGHT,
    light: useDarkInk,
  };
}

/**
 * Er lagfargen lys? YIQ-luminans over terskelen. Ett sted for hele appens
 * lys/mørk-vurdering av lagfarger, så nye farger i paletten (og lag som
 * allerede har en farge utenfor den) oppfører seg konsistent.
 * Ukjent/ugyldig verdi regnes som mørk — da får den hvit tekst som før.
 */
export function isLightTeamColor(hex: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex.trim());
  if (!m) {
    return false;
  }
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
}

/**
 * Tekstfarge for initialer/ikon PÅ en lagfarget flate. Gult (Glimt/LSK)
 * krever mørk tekst der resten av paletten tåler hvit — YIQ-luminans avgjør.
 * Mørk verdi = textPrimary (#11241B), hardkodet for å slippe theme-import
 * fra shared/.
 */
export function inkOnTeamColor(hex: string): string {
  return isLightTeamColor(hex) ? '#11241B' : '#FFFFFF';
}

// ---------------------------------------------------------------------------
// KAMPFLATENS LAGFARGE-KLEMME (designretning FROSSET 2026-08-20)
//
// På kampflaten finnes det ingen kort å gjemme seg bak: teksten står RETT PÅ
// det lagfargede lyset. Det gjør vakten viktigere, ikke mindre viktig.
//
// Feiringens kjerne er ALLTID mint/krem med mørkt blekk. Lagfargen er en
// STRÅLE i ytterkanten — og denne funksjonen bestemmer hvor sterk strålen får
// bli før den begynner å spise lesbarheten. Det er dette som er grunnen til at
// et rødt lag aldri blir brunt: lagfargen ligger aldri under tekst med mer
// styrke enn kontrasten tåler.
//
// Samme regnestykke som prototypens `swellCap()`
// (docs/prototypes/kampskjerm/index.html), oversatt rett.
// ---------------------------------------------------------------------------

/** Kampverdenens midttone — flaten swellen blandes INN i. */
const MATCH_GROUND: Rgb = [0x14, 0x38, 0x2a]; // #14382A
/** Varm off-white — brødteksten som står oppå swellen. */
const MATCH_TEXT: Rgb = [0xea, 0xff, 0xf6]; // #EAFFF6
/** Mint — stillingen som står oppå swellen. */
const MATCH_MINT: Rgb = [0x02, 0xff, 0xab]; // #02FFAB

/** Ønsket styrke. Klemmes ned til kontrasten holder. */
const SWELL_WANT = 0.6;

export interface SwellCap {
  /** Lagfargens maksimale dekkevne i målswellen, 0.02–0.60. */
  peak: number;
  /** Målt kontrast for brødteksten på den klemte flaten. */
  textRatio: number;
  /** Målt kontrast for mint-stillingen på den klemte flaten. */
  mintRatio: number;
  /** Sant når fargen faktisk måtte klemmes under ønsket styrke. */
  capped: boolean;
}

/**
 * Hvor sterkt lagfargen får lyse i målswellen.
 *
 * BÅDE den lyse teksten (7:1) og mint-tallet (4.5:1) står på flaten, så begge
 * må holde. Vi går nedover fra ønsket styrke i 1 %-trinn og tar det første
 * nivået der begge krav er innfridd.
 *
 * Ukjent/ugyldig farge → full styrke på Heias egen grønn, som alltid holder.
 */
export function swellCap(hex: string): SwellCap {
  const team = parseHex(hex);
  if (!team) {
    return {peak: SWELL_WANT, textRatio: 0, mintRatio: 0, capped: false};
  }

  for (let a = SWELL_WANT; a >= 0.02; a -= 0.01) {
    const blended = mix(MATCH_GROUND, team, a);
    const textRatio = contrast(MATCH_TEXT, blended);
    const mintRatio = contrast(MATCH_MINT, blended);
    if (textRatio >= 7 && mintRatio >= 4.5) {
      return {
        peak: a,
        textRatio,
        mintRatio,
        capped: a < SWELL_WANT - 0.001,
      };
    }
  }

  // Ingen styrke holdt kravet — da er lagfargen så lys at den nesten ikke får
  // lyse i det hele tatt. Teksten vinner.
  const floor = mix(MATCH_GROUND, team, 0.02);
  return {
    peak: 0.02,
    textRatio: contrast(MATCH_TEXT, floor),
    mintRatio: contrast(MATCH_MINT, floor),
    capped: true,
  };
}

// ---------------------------------------------------------------------------
// ARENAENS LAGFARGE-KLEMME (skive 2)
//
// Samme klasse feil som swellCap vokter, ett rom lenger opp. Arenaflaten er
// kampverdenens LYSESTE rom (#25563F, 8.11:1 for brødtekst) — den har altså
// nesten ingen luft mot 7:1-kravet før noe legges oppå. Og noe legges oppå:
// lagets lys ligger i venstre halvdel, nøyaktig der lagmerket og lagnavnet
// står.
//
// Uten denne vakten ville et gult eller lyseblått lag løftet flaten under sitt
// eget navn til teksten forsvant — den samme feilen som gjorde at et rødt lag
// kunne bli brunt i målswellen, bare med motsatt fortegn.
// ---------------------------------------------------------------------------

/** Arenaens toppflate — den lagfargede strålen blandes INN i denne. */
const ARENA_SURFACE: Rgb = [0x25, 0x56, 0x3f]; // matchColors.arenaTop
/** Prototypens ønskede styrke på `.arena::after`s lagradial. */
const ARENA_WANT = 0.34;

/**
 * Hvor sterkt lagfargen får lyse på arenaflaten.
 *
 * Kravene er de samme som i swellen fordi teksten er den samme: lagnavnet er
 * brødtekst (7:1) og stillingen er mint (4.5:1). Bare grunnflaten er en annen,
 * og den er lysere — derfor er dette en EGEN funksjon og ikke et kall til
 * swellCap: å gjenbruke swellens mørkere base ville gitt en klemme som måler
 * riktig på feil flate.
 */
export function arenaLightCap(hex: string): SwellCap {
  const team = parseHex(hex);
  if (!team) {
    return {peak: ARENA_WANT, textRatio: 0, mintRatio: 0, capped: false};
  }

  for (let a = ARENA_WANT; a >= 0.02; a -= 0.01) {
    const blended = mix(ARENA_SURFACE, team, a);
    const textRatio = contrast(MATCH_TEXT, blended);
    const mintRatio = contrast(MATCH_MINT, blended);
    if (textRatio >= 7 && mintRatio >= 4.5) {
      return {peak: a, textRatio, mintRatio, capped: a < ARENA_WANT - 0.001};
    }
  }

  const floor = mix(ARENA_SURFACE, team, 0.02);
  return {
    peak: 0.02,
    textRatio: contrast(MATCH_TEXT, floor),
    mintRatio: contrast(MATCH_MINT, floor),
    capped: true,
  };
}

/** Målflodens ønskede styrke. Prototypens `FLOOD_WANT`. */
const FLOOD_WANT = 0.78;

export interface FloodCap {
  /** Lagfargens maksimale dekkevne i måløyeblikkets flod over grunnen. */
  peak: number;
  /** Målt kontrast for mint-stillingen på den klemte flaten. */
  mintRatio: number;
  capped: boolean;
}

/**
 * Hvor sterkt lagfargen får lyse i MÅLFLODEN over grunnen.
 *
 * Floden er kort og dekker hele verdenen, så kravet er et annet enn swellens:
 * det eneste som må overleve den er STILLINGEN, og den er 60+ px — altså stor
 * tekst, 3:1. Brødteksten stilles det ikke krav til her, for i det sekundet
 * floden står på sitt sterkeste er det tallet man ser på.
 *
 * Uten klemmen ville et gult lag hvitvasket hele skjermen i akkurat det
 * øyeblikket brukeren skal lese den nye stillingen.
 */
export function floodCap(hex: string): FloodCap {
  const team = parseHex(hex);
  if (!team) {
    return {peak: FLOOD_WANT, mintRatio: 0, capped: false};
  }

  for (let a = FLOOD_WANT; a >= 0.05; a -= 0.01) {
    const mintRatio = contrast(MATCH_MINT, mix(MATCH_GROUND, team, a));
    if (mintRatio >= 3) {
      return {peak: a, mintRatio, capped: a < FLOOD_WANT - 0.001};
    }
  }

  return {
    peak: 0.05,
    mintRatio: contrast(MATCH_MINT, mix(MATCH_GROUND, team, 0.05)),
    capped: true,
  };
}
