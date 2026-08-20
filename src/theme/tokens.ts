import {Platform, type TextStyle, type ViewStyle} from 'react-native';

// ---------------------------------------------------------------------------
// Farger — A v2 «Stadium Pop Hybrid» (låst designretning 2026-07-30)
// Varm mintkrem til hverdags; kampen bor alltid på mørk stadionflate.
// ---------------------------------------------------------------------------
export const colors = {
  // Brand
  heia: '#02FFAB',
  heiaPressed: '#00D492',
  heiaSoft: 'rgba(2, 255, 171, 0.12)',
  // Mørk, WCAG-trygg grønn til TEKST/IKON på lyst (#02ffab er kun fyll — den
  // får bare være tekst på stadionmørk flate, der den måler ≈13:1)
  heiaInk: '#087A5A',
  // Dyp merkevaregrønn — tekst på mintfylte flater (knapper, pills)
  heiaDeep: '#08392E',
  // Valgt/feiring-flate (aktiv 👏, SEIER)
  heiaTint: '#C6FFE9',

  // Flater (varm mintkrem — ikke kald systemgrå)
  background: '#F6F8F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F4EA',
  // Solskinnsflate — trenerbeskjeder/VIKTIG
  sun: '#FFF9E7',
  sunBorder: '#F2E4BC',

  // Stadionmodus — kampens flate, i alle størrelser (hero → score-chip)
  stadium: '#0E211A',
  stadiumEdge: '#1E4033',
  stadiumText: '#EAFFF6',
  stadiumDim: '#A9CCBC',

  // Tekst
  textPrimary: '#11241B',
  textSecondary: '#5F7265',
  textTertiary: '#93A195',

  // Grenser (varmtonede)
  border: '#DFE7D8',
  borderSubtle: '#E9EEE1',

  // Semantisk (system)
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  // Fargesemantikk (låst): coral = live-status, blå = kalender/info,
  // lilla = påminnelse, gul = feiring. Mål feires i grønt/gult — aldri coral.
  live: '#FF5A5F',
  liveSoft: '#FFEDEA',
  liveInk: '#E04A44',
  info: '#3D7BF5',
  infoSoft: '#EAF1FF',
  infoInk: '#2F66DB',
  remind: '#8B5CF6',
  remindSoft: '#F1EAFE',
  remindInk: '#7A4DE8',
  gold: '#FFC53D',
  goldInk: '#5C4A00',

  // Event-type aksentfarger (speiler semantikken over)
  treningText: '#2F66DB',
  kampText: '#E04A44',
  sosialtText: '#7A4DE8',
} as const;

// ---------------------------------------------------------------------------
// KAMPVERDENEN — «de tre grønne rommene» (designretning FROSSET 2026-08-20,
// docs/prototypes/kampskjerm/index.html er fasit).
//
// Egen eksport, ikke flere navn i `colors`, av én grunn: disse fargene er
// KUN gyldige på kampflaten. Havner `arenaTop` på en lys skjerm, er det en
// feil — og et separat navnerom gjør den feilen synlig i diffen i stedet for
// å gjemme den blant 40 andre `colors.`-oppslag.
//
// Rommene skilles av TONE OG LYS, aldri av bokser eller rammer. Trinnene er
// satt i opplevd lyshet (L*), ikke på øyemål:
//
//   Rom          Farge      L*     tekst / dempet / mint
//   Arena topp   #25563F    32.7   8.1 / 4.9 / 6.4
//   Arena bunn   #1D4633    26.4   10.2 / 6.1 / 8.0
//   Puls         #1A4433    ~23    11.7 / 7.0 / 9.2
//   Kampforløp   #123325    18.5   13.2 / 7.9 / 10.4
//
// ⚠️ TO FELLER SOM SER RIKTIGE UT OG MÅLER FEIL:
//   1. `light` (#3B8062) er LYS, ikke en tekstflate — 4.5:1, kun stor tekst.
//   2. På ARENAFLATEN faller `colors.stadiumDim` (#A9CCBC) til 3.7:1. Bruk
//      `dim` (#C8E6D8) i stedet. Dette er den ene detaljen som ellers ser
//      helt riktig ut. Kontrastvakten i __tests__ er der for å holde den.
// ---------------------------------------------------------------------------
export const matchColors = {
  // Grunnen — kampverdenens bunn, edge-to-edge. FAST: lagfargen rører den
  // aldri, den legges bare som lys OPPÅ (derfor blir rødt lag aldri brunt).
  groundTop: '#0B1911',
  groundMid: '#183F30',
  groundLow: '#0E291D',

  // De fire rommene
  arenaTop: '#25563F',
  arenaBottom: '#1D4633',
  pulse: '#1A4433',
  timeline: '#123325',

  // Blekk
  text: '#EAFFF6',
  /** Dempet tekst PÅ KAMPFLATE. Erstatter colors.stadiumDim her — se felle 2. */
  dim: '#C8E6D8',
  /** Lys flate, ikke tekst. 4.5:1 — kun stor tekst. */
  light: '#3B8062',

  // Motstanderen: skifer. Aldri coral — coral betyr LIVE og ingenting annet.
  opponent: '#46525C',
  opponentNode: 'rgba(143, 163, 172, 0.26)',
  opponentInk: '#C3D4DA',

  // Feiringens kjerne er ALLTID mint/krem med mørkt blekk. Lagfargen er en
  // stråle i ytterkanten, aldri under tekst.
  goalLight: '#DDFFEF',

  // Stadionkritt — linjespråket. 1 px, varm off-white, 20-24 %.
  // Aldri rette linjer over hele bredden, aldri rammer.
  chalk: 'rgba(234, 255, 246, 0.22)',
  chalkStrong: 'rgba(234, 255, 246, 0.34)',
  chalkFaint: 'rgba(234, 255, 246, 0.15)',
} as const;

// ---------------------------------------------------------------------------
// Typografi — titler med pondus, store rounded tall (Nunito, bundlet).
// ---------------------------------------------------------------------------
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

// Displayfont for STORE TALL (score, klokkeslett, datotall, minutter) — aldri
// brødtekst/titler. Nunito = SF Rounded-erstatteren fra artifacten (`ui-rounded`).
// Strengen er både PostScript-navnet (iOS) og filnavnet (Android), så samme
// verdi virker begge steder. Sifrene er like brede i fonten, så tabular-nums
// trengs ikke. Sett ALDRI fontWeight sammen med disse — fila ER vekten, og
// en fontWeight får iOS til å lete etter vekter familien ikke har.
export const fonts = {
  display: 'Nunito-ExtraBold',
  displayBold: 'Nunito-Bold',
} as const;

export const typography = {
  heading1: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  heading2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  heading3: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Til TextInput — som body, men uten lineHeight. iOS rendrer felt med
  // lineHeight feil MENS man skriver (teksten klippes/forskyves og faller
  // først på plass når feltet mister fokus — RN-issue #41240/#28012).
  // Bruk denne på alle skrivefelt; lineHeight gjør uansett ingen nytte der.
  input: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily,
    color: colors.textSecondary,
  } satisfies TextStyle,

  caption: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily,
    color: colors.textTertiary,
  } satisfies TextStyle,

  label: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Store, stolte tall — rounded 800 (vekten ligger i fontfila, se `fonts`)
  scoreLarge: {
    fontSize: 40,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  } satisfies TextStyle,

  scoreSmall: {
    fontSize: 16,
    letterSpacing: 0.2,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  } satisfies TextStyle,

  displayTime: {
    fontSize: 22,
    letterSpacing: -0.3,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  } satisfies TextStyle,
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px base grid)
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Skygger — grønntonede og tilbakeholdne. Kort skal føles skarpe, ikke ligge
// i grønn tåke. Glød er reservert: live-score, aktiv hovedhandling, 👏.
// ---------------------------------------------------------------------------
export const shadows = {
  card: {
    shadowColor: '#0B3B2A',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  } satisfies ViewStyle,

  elevated: {
    shadowColor: '#0B3B2A',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  } satisfies ViewStyle,

  cardResting: {
    shadowColor: '#0B3B2A',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  } satisfies ViewStyle,

  // Mint-glød — KUN hovedhandling (primærknapp, +-knappen) og live-score
  glow: {
    shadowColor: '#02FFAB',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  } satisfies ViewStyle,
} as const;
