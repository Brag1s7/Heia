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
// Typografi — titler med pondus, store tabulære tall.
// (Rounded display-tall venter på den samlede native rebuilden.)
// ---------------------------------------------------------------------------
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

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

  // Store, stolte tall — alltid 800 + tabulære siffer
  scoreLarge: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  } satisfies TextStyle,

  scoreSmall: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  } satisfies TextStyle,

  displayTime: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily,
    fontVariant: ['tabular-nums'],
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
