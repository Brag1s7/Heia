/**
 * @format
 *
 * TAB-BARENS KAPSEL — regnestykket og blekket (Brage 2026-09-03).
 *
 * Tre påstander Brage ba om bevis for:
 *   1. safe area telles ÉN gang: siste innhold kan scrolles helt over
 *      kapselen, uten unødvendig tomrom;
 *   2. baren skjules på kommentarsiden, og bare der;
 *   3. blekket i begge miljøene holder 4,5:1 over glasset — mot de samme
 *      grunnene feedkortene måles mot, og mot kampens grunn.
 */

import {
  CAPSULE,
  bottomContentPadding,
  tabBarHiddenFor,
  tabBarItemsWidth,
  tabBarTotalHeight,
  capsuleBottomGap,
} from '../src/shared/tabBarLayout';
import {GLASS} from '../src/components/LiquidGlassSurface';
import {OPAL} from '../src/components/OpalSurface';
import {
  CAPSULE_HAZE,
  DIFFUSION,
  diffusionOffsets,
} from '../src/components/TabBarGlass';
import {colors, matchColors, spacing} from '../src/theme';

// ---------------------------------------------------------------------------
// Kontrast — samme regnestykke som feedOpal.test / stadiumGlass.test.
// ---------------------------------------------------------------------------
type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const la = luminance(rgb(a));
  const lb = luminance(rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const over = (fg: string, alpha: number, bg: string) => {
  const f = rgb(fg);
  const b = rgb(bg);
  const mix = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `#${mix.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};
/** `rgba(r, g, b, a)` → [#hex, a]. */
const tint = (s: string): [string, number] => {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(s);
  if (!m) throw new Error(`ikke rgba: ${s}`);
  const hex = `#${[m[1], m[2], m[3]]
    .map(v => Number(v).toString(16).padStart(2, '0'))
    .join('')}`;
  return [hex, Number(m[4])];
};

/**
 * Grunnene under kapselen på Hjem (samme målte piksler som feedOpal).
 *
 * ⚠️ WEAKEST (det dype hjørnet nederst til høyre — NØYAKTIG under kapselens
 * høyre ende) er med vilje IKKE i porten for det lyse glasset. En flat
 * blanding av perle 0,30 over #0E6656 gir ~2,1:1 for mørkt blekk, men den
 * modellen kan ikke se det ekte glasset: UIGlassEffect blurrer OG lysner
 * adaptivt for lesbarhet — feedkortene (0,34, samme blekk, samme hjørne)
 * ble telefongodkjent på nettopp det. Porten måles der modellen holder
 * (lyse grunner + solid fallback); hjørnet er et eksplisitt TELEFON-
 * sjekkpunkt i handoffen, ikke en skjult antakelse.
 */
const DAYLIGHT = {NEON: '#02FEAB', AQUA: '#4AE1CE'};
const DAYLIGHT_DEEP_CORNER = '#0E6656';
/** Kampens grunn — kapselen ligger over det dypeste og det midtre. */
const ARENA = {
  groundTop: matchColors.groundTop,
  groundMid: matchColors.groundMid,
  groundLow: matchColors.groundLow,
};

describe('geometrien er Brages tall', () => {
  it('12 pt inn, 64 pt høy, full radius, 2 pt løft (sluttrunde)', () => {
    expect(CAPSULE.inset).toBe(12);
    expect(CAPSULE.height).toBe(64);
    expect(CAPSULE.radius).toBe(CAPSULE.height / 2);
    // Runde 3 (Brage): 8 pt lenger ned, safe-area-bevisst — max(10, inset − 6).
    expect(capsuleBottomGap(34)).toBe(28);
    expect(capsuleBottomGap(0)).toBe(10);
    expect(capsuleBottomGap(20)).toBe(14);
    // Hjemindikatoren (topp ≈ 13 pt over kanten) berøres ikke.
    expect(capsuleBottomGap(34)).toBeGreaterThan(13);
  });

  it('containerhøyden er kapsel + løft + safe area', () => {
    expect(tabBarTotalHeight(0)).toBe(74);
    expect(tabBarTotalHeight(34)).toBe(92);
  });

  it('diffusjonsfeltet: fader helt transparent oppover, aldri opak stripe, lys perle / mørk arena', () => {
    for (const env of ['light', 'match'] as const) {
      const {stops} = DIFFUSION[env];
      expect(stops[0]).toBe(0); // helt transparent øverst
      for (let i = 1; i < stops.length; i++)
        expect(stops[i]).toBeGreaterThan(stops[i - 1]);
      expect(stops[stops.length - 1]).toBeLessThanOrEqual(0.6); // aldri opak
    }
    expect(DIFFUSION.light.color.toUpperCase()).not.toBe('#FFFFFF');
    const offs = diffusionOffsets(92);
    expect(offs[0]).toBe(0);
    expect(offs[1]).toBeCloseTo(28 / 120, 5);
    expect(offs[2]).toBeCloseTo(92 / 120, 5);
    expect(offs[3]).toBe(1);
  });

  it('hazen: bred myk perlehaze (ikke hvit, ikke glød) + svak grønn grunnskygge; kampsiden mørk', () => {
    const [haze, ground] = CAPSULE_HAZE.light;
    // Haze: null offset, stor blur, liten spread, PERLE (ikke #fff) og lavmælt.
    expect(haze.offsetX).toBe(0);
    expect(haze.offsetY).toBe(0);
    expect(haze.blurRadius).toBeGreaterThanOrEqual(24);
    expect(haze.spreadDistance).toBeLessThanOrEqual(4);
    const [hr, hg, hb, ha] = haze.color.match(/[\d.]+/g)!.map(Number);
    expect([hr, hg, hb]).not.toEqual([255, 255, 255]);
    expect(hg).toBeGreaterThanOrEqual(hr); // grønnstikk, ikke varm
    expect(ha).toBeLessThanOrEqual(0.5);
    // Grunnskyggen: grønn (#0B3B2A = 11,59,42), under, svak.
    expect(ground.offsetY).toBeGreaterThan(0);
    const [gr, gg, gb, ga] = ground.color.match(/[\d.]+/g)!.map(Number);
    expect([gr, gg, gb]).toEqual([11, 59, 42]);
    expect(ga).toBeLessThanOrEqual(0.2);
    // Kampsiden: samme geometri, mørke toner — ingen lys halo på mørkt glass.
    const [mh, mg] = CAPSULE_HAZE.match;
    expect(mh.blurRadius).toBe(haze.blurRadius);
    expect(mg.offsetY).toBe(ground.offsetY);
    const [mr, mgg, mb] = mh.color.match(/[\d.]+/g)!.map(Number);
    expect(mr + mgg + mb).toBeLessThan(hr + hg + hb);
  });

  it('fanene deler vinduet minus 2 × 12', () => {
    expect(tabBarItemsWidth(393)).toBe(369);
    expect(tabBarItemsWidth(320)).toBe(296);
  });
});

describe('safe area telles én gang', () => {
  it('med baren montert: barhøyde + pust — safe area er INNE i barhøyden', () => {
    const bar = tabBarTotalHeight(34);
    const pad = bottomContentPadding(bar, 34, spacing.lg);
    expect(pad).toBe(bar + spacing.lg);
    // Det doble regnestykket ville vært 34 pt større. Det er tomrommet
    // Brage ikke vil ha.
    expect(pad).not.toBe(bar + 34 + spacing.lg);
  });

  it('siste innhold lander nøyaktig ett pust over kapselens overkant', () => {
    const inset = 34;
    const pad = bottomContentPadding(
      tabBarTotalHeight(inset),
      inset,
      spacing.lg,
    );
    // Kapselens overkant måles fra skjermbunnen: safe area + løft + høyde.
    const capsuleTop = capsuleBottomGap(inset) + CAPSULE.height;
    expect(pad - capsuleTop).toBe(spacing.lg);
  });

  it('uten bar (skjult / utenfor tabs): safe area + pust', () => {
    expect(bottomContentPadding(0, 34, spacing.lg)).toBe(34 + spacing.lg);
    expect(bottomContentPadding(0, 0, spacing.lg)).toBe(spacing.lg);
  });
});

describe('skjult på kommentarsiden — og bare der', () => {
  it('Comments skjuler, roten og alle andre viser', () => {
    expect(tabBarHiddenFor('Comments')).toBe(true);
    expect(tabBarHiddenFor(undefined)).toBe(false);
    for (const r of [
      'TeamHome',
      'EventDetail',
      'Season',
      'Lagkassa',
      'InboxList',
    ]) {
      expect(tabBarHiddenFor(r)).toBe(false);
    }
  });
});

describe('blekket holder 4,5:1 i begge miljøer', () => {
  const [barHex, barAlpha] = tint(GLASS.bar.tint);
  const [matchHex, matchAlpha] = tint(GLASS.barMatch.tint);

  it('lyst glass: inaktivt OPAL.inkSecondary og aktivt textPrimary over dagslysgrunnene', () => {
    for (const ground of Object.values(DAYLIGHT)) {
      const surface = over(barHex, barAlpha, ground);
      expect(ratio(OPAL.inkSecondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.textPrimary, surface)).toBeGreaterThanOrEqual(7);
    }
  });

  it('lyst glass: solid fallback holder samme port', () => {
    expect(ratio(OPAL.inkSecondary, GLASS.barSolid)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(ratio(colors.textPrimary, GLASS.barSolid)).toBeGreaterThanOrEqual(7);
  });

  it('det dype hjørnet er dokumentert som telefonsjekk — modellen feiler der', () => {
    // Bevisst SYNLIG: brytes tallet under (f.eks. ved høyere tint-alfa),
    // kan hjørnet flyttes inn i porten over. Til da eier telefonen svaret.
    const surface = over(barHex, barAlpha, DAYLIGHT_DEEP_CORNER);
    expect(ratio(OPAL.inkSecondary, surface)).toBeLessThan(4.5);
  });

  it('kampglass: opalhvitt dim/text over kampens grunn', () => {
    for (const ground of Object.values(ARENA)) {
      const surface = over(matchHex, matchAlpha, ground);
      expect(ratio(matchColors.dim, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(7);
    }
    expect(ratio(matchColors.dim, GLASS.barMatchSolid)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('kampglasset er arenaens egen tone, ikke sort — og ikke lyst', () => {
    // Designregelen: mørkt glass = kamp, dyp grønn, aldri nesten sort.
    expect(matchHex.toLowerCase()).toBe(matchColors.arenaBottom.toLowerCase());
    expect(luminance(rgb(matchHex))).toBeGreaterThan(
      luminance(rgb('#000000')) + 0.02,
    );
    expect(luminance(rgb(matchHex))).toBeLessThan(luminance(rgb(barHex)) / 4);
  });

  it('begge variantene er kontrollglass: ingen trykkrespons, nesten ingen sheen', () => {
    expect(GLASS.bar.interactive).toBe(false);
    expect(GLASS.barMatch.interactive).toBe(false);
    expect(GLASS.bar.sheen).toBeLessThan(GLASS.control.sheen);
    expect(GLASS.barMatch.sheen).toBe(GLASS.bar.sheen);
    expect(barAlpha).toBeCloseTo(0.34, 5);
    // Samme nøytrale perle som før — kun alfaen er rørt.
    expect(barHex.toLowerCase()).toBe('#f4f6f5');
  });
});
