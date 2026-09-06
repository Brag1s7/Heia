/**
 * @format
 *
 * FEEDGLASS V5 — spesifikasjonen (Brage 2026-09-04): Clear-systemglass
 * med arena-dimming (≤ 0,70), materialet i kortet (fade, skyer, opptak,
 * neon, høylys, kant, spekular, skygge) innenfor riggens intervaller,
 * lyst blekk. Materialet godkjennes på telefon.
 */

import {
  ARENA_DIM,
  ARENA_GLASS,
  BACKDROP_SOURCE_ID,
  BAR_PEARL,
  FEED_EDGES,
  FEED_FROST,
  FEED_GLASS,
  FEED_GLASS_MAX_ALPHA,
  FEED_INK_LIGHT,
  FEED_MATERIAL,
  FEED_REFRACTION,
  FEED_SHADOW,
  FEED_SPECULAR,
  FROST_RANGES,
  REFRACTION_RANGES,
  SILVER,
  SILVER_GLASS,
  SILVER_LEVELS,
  SILVER_PEARL,
  parseHex,
  parseRgba,
  FROST_GLASS,
} from '../src/shared/glassOptics';
import {GLASS} from '../src/components/LiquidGlassSurface';

describe('0. A/B-bryteren (Brage 2026-09-06): alt følger FEED_MATERIAL', () => {
  it('kroppen, blekket og spekularbåndet følger bryteren', () => {
    expect(['arena', 'silver', 'frost']).toContain(FEED_MATERIAL);
    expect(FEED_GLASS).toBe(
      FEED_MATERIAL === 'frost'
        ? FROST_GLASS
        : FEED_MATERIAL === 'silver'
        ? SILVER_GLASS
        : ARENA_GLASS,
    );
    expect(FEED_INK_LIGHT).toBe(FEED_MATERIAL === 'arena');
    expect(FEED_SPECULAR).toBe(FEED_MATERIAL === 'arena' ? 0.12 : 0);
    expect(FEED_FROST.specular).toBe(FEED_SPECULAR);
  });

  it('sølvkroppen er Clear-glass UTEN tint (alfa 0 → tintColor nil): materiallaget alene styrer tettheten', () => {
    expect(SILVER_PEARL).toEqual(parseHex(SILVER.pearl));
    expect(SILVER_GLASS.card.alpha).toBe(0);
    expect(SILVER_GLASS.important.alpha).toBe(0);
    expect(SILVER_GLASS.card.style).toBe('clear');
    expect(SILVER_GLASS.important.style).toBe('clear');
    expect(SILVER_GLASS.card.sheen).toBe(ARENA_GLASS.card.sheen);
  });
});

describe('1. kroppen, ARENA (V5): Clear-glass med arena-dimming — dypere enn grunnen, grunnen lever gjennom', () => {
  it('card og important er arena-dimming 0,56 — aldri over 0,70', () => {
    expect(FEED_GLASS_MAX_ALPHA).toBe(0.7);
    expect(ARENA_DIM).toEqual([23, 61, 45]);
    expect(ARENA_GLASS.card.pearl).toEqual(ARENA_DIM);
    expect(ARENA_GLASS.card.alpha).toBe(0.56);
    expect(ARENA_GLASS.important.alpha).toBe(0.56);
    expect(ARENA_GLASS.card.alpha).toBeLessThanOrEqual(FEED_GLASS_MAX_ALPHA);
    expect(ARENA_GLASS.card.style).toBe('clear');
    expect(ARENA_GLASS.important.style).toBe('clear');
  });

  it('materialet står innenfor riggens intervaller; den mørke skyen bærer ujevnheten', () => {
    const within = (v: number, [lo, hi]: readonly [number, number]) =>
      v >= lo && v <= hi;
    expect(FEED_FROST.enabled).toBe(true);
    expect(FEED_FROST.native).toBe(false);
    expect(within(FEED_FROST.fade, FROST_RANGES.fade)).toBe(true);
    expect(within(FEED_FROST.dark, FROST_RANGES.dark)).toBe(true);
    expect(within(FEED_FROST.light, FROST_RANGES.light)).toBe(true);
    expect(within(FEED_FROST.uptake, FROST_RANGES.uptake)).toBe(true);
    expect(within(FEED_FROST.neon, FROST_RANGES.neon)).toBe(true);
    expect(within(FEED_FROST.highlight, FROST_RANGES.highlight)).toBe(true);
    expect(within(FEED_FROST.specular, FROST_RANGES.specular)).toBe(true);
    expect(within(FEED_FROST.shadow, FROST_RANGES.shadow)).toBe(true);
    expect(within(FEED_FROST.scale, FROST_RANGES.scale)).toBe(true);
    expect(FEED_FROST.dark).toBeGreaterThan(FEED_FROST.light);
  });

  it('tab-barens perle står urørt; arenaens dimming er arenaens, ikke perlen', () => {
    expect(parseRgba(GLASS.bar.tint).rgb).toEqual(BAR_PEARL);
    expect(ARENA_GLASS.card.pearl).not.toEqual(BAR_PEARL);
    expect(ARENA_GLASS.important.pearl).toEqual(ARENA_DIM);
  });

  it('sheen som tab-baren — lyset bor i kanten og refraksjonen', () => {
    // FROST (prototypen, vedtatt 2026-09-06): kortet har egen sheen (0,14),
    // VIKTIG litt mindre (0,12); arena/sølv hadde tab-barens.
    if (FEED_MATERIAL === 'frost') {
      expect(FEED_GLASS.card.sheen).toBe(0.14);
      expect(FEED_GLASS.important.sheen).toBe(0.12);
    } else {
      expect(FEED_GLASS.card.sheen).toBe(GLASS.bar.sheen);
      expect(FEED_GLASS.important.sheen).toBe(GLASS.bar.sheen);
    }
  });

  it('GLASS.card og GLASS.important tegner tallene herfra', () => {
    const card = parseRgba(GLASS.card.tint);
    expect(card.rgb).toEqual(FEED_GLASS.card.pearl);
    expect(card.alpha).toBe(FEED_GLASS.card.alpha);
    expect(GLASS.card.sheen).toBe(FEED_GLASS.card.sheen);
    const important = parseRgba(GLASS.important.tint);
    expect(important.rgb).toEqual(FEED_GLASS.important.pearl);
    expect(important.alpha).toBe(FEED_GLASS.important.alpha);
  });
});

describe('2. refraksjonen — Brages intervaller', () => {
  const within = (v: number, [lo, hi]: readonly [number, number]) =>
    v >= lo && v <= hi;

  it('kantlinse 6–12 pt, soner 30–90 pt, forstørrelse 1,03–1,06, metning 0,75–0,85, parallakse 0–8', () => {
    expect(within(FEED_REFRACTION.strength, REFRACTION_RANGES.strength)).toBe(
      true,
    );
    expect(within(FEED_REFRACTION.zone, REFRACTION_RANGES.zone)).toBe(true);
    expect(within(FEED_REFRACTION.scale, REFRACTION_RANGES.scale)).toBe(true);
    expect(
      within(FEED_REFRACTION.saturation, REFRACTION_RANGES.saturation),
    ).toBe(true);
    expect(within(FEED_REFRACTION.parallax, REFRACTION_RANGES.parallax)).toBe(
      true,
    );
    expect(FEED_REFRACTION.blur).toBeGreaterThan(0);
    expect(FEED_REFRACTION.live).toBe(true);
    expect(FEED_REFRACTION.enabled).toBe(false);
  });

  it('grunnen finnes via én id', () => {
    expect(BACKDROP_SOURCE_ID).toBe('daylight-ground');
  });
});

describe('3. kant og skygge', () => {
  it('kampkortets kantlys: aqua-hvitt 0,40 → 0,16 → 0,06; svak mørk kant fra nedre høyre', () => {
    const {light, dark, glint} = FEED_EDGES;
    expect(light.color).toBe('#D6FFF1');
    expect(light.width).toBe(1.5);
    expect(light.stops.map(([, a]) => a)).toEqual([0.4, 0.16, 0.06]);
    expect(dark.color).toBe('#08392E');
    expect(dark.stops[0][1]).toBeLessThan(light.stops[0][1]);
    expect(dark.stops[dark.stops.length - 1][1]).toBe(0);
    expect(glint.reach).toBeLessThan(0.5);
    expect(glint.inset).toBeGreaterThan(0);
    expect(glint.stops[glint.stops.length - 1][1]).toBe(0);
  });

  it('skyggen er kampkortets grønne, myk — aldri hard sort', () => {
    const shadow = parseRgba(FEED_SHADOW.color);
    expect(shadow.rgb).toEqual(parseHex('#0B3B2A'));
    expect(shadow.alpha).toBeLessThanOrEqual(0.25);
    expect(FEED_SHADOW.blurRadius).toBeGreaterThanOrEqual(20);
    expect(FEED_SHADOW.spreadDistance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SØLVGLASSET — spesifikasjonen (Brage 2026-09-06)
// ---------------------------------------------------------------------------
type Rgb3 = readonly [number, number, number];
const luminance = (c: Rgb3) => {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (ink: string, surface: Rgb3) => {
  const a = luminance(parseHex(ink));
  const b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const over = (fg: string, alpha: number, bg: Rgb3): Rgb3 => {
  const f = parseHex(fg);
  return [0, 1, 2].map(
    i => alpha * f[i] + (1 - alpha) * bg[i],
  ) as unknown as Rgb3;
};
/** Mørkeste grunn under et feedkort: rampen ved første kort (E-clean 0,04). */
const DARKEST_GROUND: Rgb3 = parseHex('#11382A');
/** Opalens lokale blekk (FeedCard bruker det på sølvglasset). */
const INK = {secondary: '#44574C', tertiary: '#506259', accent: '#05604A'};

describe('4. sølvglasset R3: silkefolder i tykt, frostet glass (referansen godkjent)', () => {
  it('kroppen er tett og lys sølvhvit; tekstsonen stabil; frosten bygger seg opp mot kanten', () => {
    expect(SILVER.base).toBeGreaterThanOrEqual(0.8);
    expect(SILVER.base).toBeLessThanOrEqual(0.9);
    expect(SILVER_LEVELS.pocketMin).toBe(SILVER.base);
    expect(SILVER_LEVELS.textZone).toBeGreaterThan(SILVER.base);
    expect(SILVER_LEVELS.edge).toBeGreaterThan(SILVER.base);
  });

  it('dybde/frost/Heia-lys er uskarpe; kantene skarpe; feltene har radier i punkter', () => {
    expect(SILVER.blur.depth).toBeGreaterThan(SILVER.blur.frost);
    expect(SILVER.blur.frost).toBeGreaterThan(SILVER.blur.rim);
    for (const b of [...SILVER.depth, ...SILVER.frost, ...SILVER.heia]) {
      expect(b.rx).toBeGreaterThanOrEqual(50);
      expect(b.ax).toBeGreaterThanOrEqual(0);
      expect(b.ax).toBeLessThanOrEqual(1);
      expect(b.ay).toBeGreaterThanOrEqual(0);
      expect(b.ay).toBeLessThanOrEqual(1);
    }
    // Heia-grønt er lysansamlinger VED KANTEN (referansen: venstre kant nede,
    // nedre venstre hjørne), ikke en tint over alt.
    expect(SILVER.heia.length).toBeGreaterThanOrEqual(3);
    expect(SILVER.heia[0].ax).toBe(0);
    expect(SILVER.heia[0].ay).toBeGreaterThan(0.6);
    for (const g of SILVER.heia) {
      expect(g.color).toBe('#02FFAB');
      expect(g.alpha).toBeLessThanOrEqual(0.65);
    }
    // Silkekartene: sømløse 420 pt-fliser, fast størrelse uansett korthøyde.
    expect(SILVER.silk.tile).toBe(420);
    expect(SILVER.silk.spec).toBeGreaterThanOrEqual(SILVER.silk.wave);
  });

  it('kontrastporten (Brage): primær ≥ 7 på kroppen; sekundær/aksent ≥ 4,5 på pillene; tertiær ≥ 4,5 i toppfeltet', () => {
    const body = over(SILVER.pearl, SILVER.base, DARKEST_GROUND);
    const silverPool = SILVER.depth.find(b => b.color === '#A6B2BB')!;
    const pocket = over(silverPool.color, silverPool.alpha, body);
    const heia = SILVER.heia[0];
    const heiaPool = over(heia.color, heia.alpha, body);
    const top = over(SILVER.pearl, SILVER_LEVELS.textZone, DARKEST_GROUND);
    const pill = parseRgba(SILVER.pill.fill);
    const pillOnPocket = over(
      `#${pill.rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`,
      pill.alpha,
      pocket,
    );
    expect(contrast('#11241B', pocket)).toBeGreaterThanOrEqual(7);
    expect(contrast('#11241B', heiaPool)).toBeGreaterThanOrEqual(7);
    expect(contrast(INK.secondary, pillOnPocket)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK.accent, pillOnPocket)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK.tertiary, top)).toBeGreaterThanOrEqual(4.5);
  });

  it('myk skulder (ingen ramme), tolags skygge, frostede piller med grønn glød på aktiv Heia', () => {
    expect((SILVER as Record<string, unknown>).shoulderRamp).toBeUndefined();
    expect((SILVER as Record<string, unknown>).lip).toBeUndefined();
    expect(SILVER.rim.band.alpha).toBeLessThanOrEqual(0.6);
    expect(SILVER.rim.edge.width).toBeLessThanOrEqual(2);
    expect(SILVER.rim.glow.stops[0][1]).toBe('#02FFAB');
    expect(SILVER.shadow).toHaveLength(2);
    for (const sh of SILVER.shadow)
      expect(parseRgba(sh.color).rgb).toEqual(parseHex('#0B3B2A'));
    expect(parseRgba(SILVER.pill.lipLight).alpha).toBeGreaterThan(
      parseRgba(SILVER.pill.lipDark).alpha,
    );
    expect(SILVER.pill.glow).toMatch(/rgba\(2, 255, 171/);
  });
});
