/**
 * @format
 *
 * MÅLSKIVA = DEN TETTESTE KAMPFLATEN (Brage 2026-09-10, pass 2).
 *
 * Beslutningen er et MATERIALVALG, ikke en layoutdetalj, og den har ingen
 * synlig effekt i jest (svg-flaten rendres likt uansett tint). Derfor
 * vokter denne testen kilden — samme mønster som `inboxSurface`.
 *
 * Systemet den holder fast:
 *   upcoming / før kamp   `StadiumGlass`  (gjennomskinnelig, lys grunn bak)
 *   kampinnlegg i feed    `StadiumGlass compact`
 *   Kalender + Sesongen   `StadiumSurface` med DEFAULT buer — urørt
 *   LIVE hero / målskive  `StadiumSurface` med `arcTone="quiet"`
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) =>
  fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');

describe('målskiva på kampskjermen', () => {
  const screens = [
    'components/match/LiveMatch.tsx',
    'components/match/FinishedMatch.tsx',
  ];

  it.each(screens)(
    '%s bruker den tette kampflaten, ikke score-glasset',
    file => {
      const src = read(file);
      expect(src).toContain(
        '<StadiumSurface style={styles.scoreCard} arcTone="quiet">',
      );
      expect(src).not.toContain('variant="score"');
      expect(src).not.toContain('LiquidGlassSurface');
    },
  );

  it('minutt og kampstatus står i Heia-neon', () => {
    const src = read('components/match/MatchArena.tsx');
    const clock = src.slice(src.indexOf('  clock: {'));
    expect(clock.slice(0, 220)).toContain('color: colors.heia');
  });

  it('den tette flaten er Heia-grønn, aldri nøytralt svart', () => {
    const src = read('components/StadiumSurface.tsx');
    expect(src).toContain('#0B1912');
    expect(src).toContain('#143126');
  });

  it('⚠️ Kalender og Sesongen er URØRT — de sender ingen arcTone', () => {
    expect(read('components/EventCard.tsx')).not.toContain('arcTone');
    expect(read('screens/SeasonScreen.tsx')).not.toContain('arcTone');
  });

  it('kommende kamp beholder StadiumGlass', () => {
    const src = read('components/NextEventHero.tsx');
    expect(src).toContain('StadiumGlass');
    expect(src).not.toContain('arcTone');
  });
});
