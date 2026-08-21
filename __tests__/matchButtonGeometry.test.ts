import {
  matchButtonGeometry,
  MATCH_BUTTON_FONT_CAP,
  MIN_FONT,
  OVERFLOW_BUDGET,
  TAB_BAR_HEIGHT,
  TAB_COUNT,
} from '../src/shared/matchButtonGeometry';
import {matchButtonHasGlyph} from '../src/shared/matchButton';

/**
 * KAMPKNAPPENS GEOMETRIVAKT.
 *
 * ⚠️ DEN MÅLER BREDDER, IKKE STILOBJEKTER. En assert på at pillen har
 * `paddingHorizontal: 16` ville vært grønn mens «RAPPORTER» lå over
 * Kalender-etiketten. Her regnes den FAKTISKE bredden av hver etikett, på
 * hver skjermbredde, ved hver tekstskala.
 *
 * Bredder som må holde:
 *   430 — prototypens målebrett (iPhone Pro Max-klassen)
 *   393 — iPhone 14/15/16 Pro
 *   390 — iPhone 12/13/14
 *   375 — iPhone SE 3 / 13 mini
 *   320 — iPhone SE 1./2. gen
 */

const WIDTHS = [430, 393, 390, 375, 320];
const SCALES = [1, 1.235, MATCH_BUTTON_FONT_CAP];

/**
 * Alle etiketter knappen kan vise, med kortformen der den finnes.
 *
 * ⚠️ KORTFORMENE KOM AV TELEFONEN (Brage 2026-08-21): «RAPPORTER» ble
 * klippet til «RAPPORT…» inne i pillen. Årsaken var at bredde-anslaget var
 * målt på sifre og små bokstaver, mens pillen er VERSALER. Med et ærlig
 * anslag får ikke de to lengste ordene plass på 320 pt ved siden av fire
 * andre faner — og da er en kortere, HEL setning bedre enn en lang, halv.
 */
const LABELS: Array<[string, string | undefined, boolean]> = [
  ['KAMP', undefined, true],
  ['2–1', undefined, true],
  ['10–9', undefined, true],
  ['PAUSE 2–1', '2–1', false],
  ['HEIA!', undefined, true],
  ['HEIET', undefined, true],
  ['RAPPORTER', 'RAPPORT', false],
  ['LUKK', undefined, false],
];

describe('prototypen er fasit på 430 pt', () => {
  it('gjengir uttrykket til de korte ordene uendret', () => {
    const g = matchButtonGeometry(430, 1, 'KAMP');
    // .matchbtn { font-size: 13.5 }
    expect(g.fontSize).toBeCloseTo(13.5, 5);
    // letter-spacing: .07em
    expect(g.letterSpacing).toBeCloseTo(13.5 * 0.07, 5);
    expect(g.glyphSize).toBe(17);
    expect(g.hasGlyph).toBe(true);
  });

  /**
   * ⚠️ GLYFEN ER TILSTANDENS SVAR, IKKE ET GJETT PÅ ORDLENGDE. Første
   * utkast antok «langt ord ⇒ ingen glyf», og da trodde geometrien at
   * «RAPPORT» (7 tegn) hadde et ikon komponenten aldri tegnet — 20 pt
   * bredde som ikke fantes, og pillen ble for smal for sitt eget ord.
   */
  it('reporter-tilstandene har ingen glyf — og det bestemmes av tilstanden', () => {
    expect(matchButtonHasGlyph('rapporter')).toBe(false);
    expect(matchButtonHasGlyph('lukk')).toBe(false);
    expect(matchButtonHasGlyph('heia')).toBe(true);
    expect(matchButtonHasGlyph('pause')).toBe(false);
    expect(matchButtonHasGlyph('live')).toBe(true);

    const g = matchButtonGeometry(430, 1, 'RAPPORTER', 'RAPPORT', false);
    expect(g.hasGlyph).toBe(false);
    expect(g.glyphSize).toBe(0);
  });
});

describe('ingen etikett spiser naboen', () => {
  for (const width of WIDTHS) {
    for (const scale of SCALES) {
      for (const [label, short, glyf] of LABELS) {
        it(`«${label}» holder budsjettet på ${width} pt × ${scale}`, () => {
          const g = matchButtonGeometry(width, scale, label, short, glyf);

          // ⚠️ SELVE PÅSTANDEN: pillen stikker aldri lenger ut enn budsjettet.
          // Naboens ikonpille har 11 pt fri marg i elementet sitt, så 6 pt
          // betyr at de to aldri kan møtes.
          expect(g.overflowPerSide).toBeLessThanOrEqual(
            OVERFLOW_BUDGET + 0.001,
          );
          expect(g.width).toBeLessThanOrEqual(g.maxWidth + 0.001);

          // Aldri en hvisking. Brytes denne, er det et produktproblem —
          // ordet må kortes, ikke terskelen senkes.
          expect(g.fontSize).toBeGreaterThanOrEqual(MIN_FONT);

          // Ordet som faktisk tegnes er ETT av de to — aldri et tredje, og
          // aldri et klippet.
          expect([label, short]).toContain(g.label);

          // Aldri større enn prototypens uttrykk.
          expect(g.fontSize).toBeLessThanOrEqual(
            13.5 * MATCH_BUTTON_FONT_CAP + 0.001,
          );
        });
      }
    }
  }
});

describe('fanene er og blir like brede', () => {
  it('elementbredden er skjermen delt på fem — uendret fordeling', () => {
    for (const width of WIDTHS) {
      const g = matchButtonGeometry(width, 1, 'RAPPORTER');
      // ⚠️ Hadde vi gitt midtfanen `flex: 1.5`, ville dette tallet vært
      // større og de fire andre tilsvarende mindre. Det er nettopp
      // bieffekten skive 10 er forbudt å ha.
      expect(g.itemWidth).toBeCloseTo(width / 5, 5);
      expect(TAB_COUNT).toBe(5);
    }
  });

  it('elementbredden er uavhengig av hvilket ord som står i pillen', () => {
    const widths = LABELS.map(
      ([l, short, glyf]) =>
        matchButtonGeometry(390, 1, l, short, glyf).itemWidth,
    );
    expect(new Set(widths).size).toBe(1);
  });
});

describe('Dynamic Type', () => {
  it('taket er lavere enn griddets, fordi barhøyden er låst', () => {
    // P4: `height: 88` skal ikke endres — endres den, reflower scenen midt
    // i en push. Pillen kan derfor ikke vokse slik griddet kan.
    expect(MATCH_BUTTON_FONT_CAP).toBeLessThan(1.6);
    expect(TAB_BAR_HEIGHT).toBe(88);
  });

  it('klemmer skalaen: ×3.571 gir samme resultat som taket', () => {
    const iOSmaks = matchButtonGeometry(390, 3.571, 'KAMP');
    const tak = matchButtonGeometry(390, MATCH_BUTTON_FONT_CAP, 'KAMP');
    expect(iOSmaks.fontSize).toBeCloseTo(tak.fontSize, 5);
  });

  it('pillen vokser aldri vertikalt', () => {
    const hoyder = WIDTHS.flatMap(w =>
      SCALES.map(s => matchButtonGeometry(w, s, 'KAMP').height),
    );
    expect(new Set(hoyder).size).toBe(1);
  });
});

describe('kortformen brukes KUN når den fulle ikke får plass', () => {
  it('393 pt (iPhone Pro): «RAPPORTER» står helt ut', () => {
    expect(
      matchButtonGeometry(393, 1, 'RAPPORTER', 'RAPPORT', false).label,
    ).toBe('RAPPORTER');
    expect(matchButtonGeometry(393, 1, 'PAUSE 2–1', '2–1', false).label).toBe(
      'PAUSE 2–1',
    );
  });

  it('320 pt (SE): faller til kortformen i stedet for å bli en hvisking', () => {
    const g = matchButtonGeometry(320, 1, 'RAPPORTER', 'RAPPORT', false);
    expect(g.label).toBe('RAPPORT');
    expect(g.fontSize).toBeGreaterThanOrEqual(MIN_FONT);
  });

  it('uten kortform klemmes ordet så langt det går, men aldri under gulvet', () => {
    const g = matchButtonGeometry(320, 1, 'RAPPORTER', undefined, false);
    expect(g.label).toBe('RAPPORTER');
    expect(g.fontSize).toBe(MIN_FONT);
  });
});
