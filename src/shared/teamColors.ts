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
