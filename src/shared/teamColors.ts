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

/**
 * Tekstfarge for initialer/ikon PÅ en lagfarget flate. Gult (Glimt/LSK)
 * krever mørk tekst der resten av paletten tåler hvit — YIQ-luminans avgjør.
 * Mørk verdi = textPrimary (#11241B), hardkodet for å slippe theme-import
 * fra shared/.
 */
export function inkOnTeamColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex.trim());
  if (!m) {
    return '#FFFFFF';
  }
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#11241B' : '#FFFFFF';
}
