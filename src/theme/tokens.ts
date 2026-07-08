import {Platform, type TextStyle, type ViewStyle} from 'react-native';

// ---------------------------------------------------------------------------
// Farger
// ---------------------------------------------------------------------------
export const colors = {
  // Brand
  heia: '#02ffab',
  heiaPressed: '#00D492',
  heiaSoft: 'rgba(2, 255, 171, 0.10)',
  // Mørk, WCAG-trygg grønn til TEKST/IKON på lyst (#02ffab er kun fyll — feiler kontrast som tekst)
  heiaInk: '#047857',

  // Flater
  background: '#F7F7F8',
  surface: '#FFFFFF',
  // Nøytral, dempet flate til chips o.l. (erstatter pastell-fyll)
  surfaceMuted: '#F1F2F4',

  // Tekst
  textPrimary: '#1A1D26',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  // Grenser
  border: '#E5E7EB',
  // Rolig 1px kort-kant på lyst (premium-separasjon sammen med cardResting)
  borderSubtle: '#EDEEF0',

  // Semantisk
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  // Event-type aksentfarger (brukes som prikk på nøytrale chips)
  treningText: '#4F46E5',
  kampText: '#EA580C',
  sosialtText: '#9333EA',
} as const;

// ---------------------------------------------------------------------------
// Typografi
// ---------------------------------------------------------------------------
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  heading1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  heading2: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily,
    color: colors.textPrimary,
  } satisfies TextStyle,

  heading3: {
    fontSize: 18,
    fontWeight: '600',
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
// Shadows
// ---------------------------------------------------------------------------
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  } satisfies ViewStyle,

  elevated: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  } satisfies ViewStyle,

  // Mykt ambient-løft for feed-kort på nær-hvit bakgrunn (premium light)
  cardResting: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  } satisfies ViewStyle,
} as const;
