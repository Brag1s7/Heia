/**
 * @format
 *
 * MASTHEAD — lagets identitetsfelt bygget inn i Heia-headeren (Brage
 * 2026-09-03, runde 3).
 *
 * Fire påstander:
 *   1. blekket velges mot ren lagfarge: alle palettfargene beholder seg selv
 *      og bærer blekket med ≥ 4,5:1 — gul, lyseblå og oransje med mørkt;
 *   2. feltet: avrundet form åpen mot venstre, under systemikonene, over
 *      laghodets bunn, full lagfarge gjennom navnesonen, svakt mørknet med
 *      samme hue mot den runde enden — aldri gjennomsiktig;
 *   3. kontrast der teksten står: lagnavnets blekk gjennom hele navnesonen,
 *      også der mørkningen så vidt har begynt;
 *   4. lerretet: reisen starter i #0E211A, treffer broen #143126 nøyaktig
 *      ved laghodets underkant, og laghodets høyde er den lerretet regner med.
 */

import {
  HEADER_BASE,
  HEIA_BRIDGE,
  TEAM_COLORS,
  darkenSameHue,
  teamSpotlight,
} from '../src/shared/teamColors';
import {
  FIELD_END_DARKEN,
  FIELD_FULL,
  FRAME_RADIUS,
  NAME_REACH,
  identityFrame,
  journeyStops,
  mastheadHeight,
  nameMaxWidth,
} from '../src/shared/masthead';
import {
  HEADER_CONTENT_HEIGHT,
  HEADER_FOOT_HEIGHT,
} from '../src/shared/headerGeometry';
import {colors} from '../src/theme';

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const lerp = (a: number[], b: number[], t: number) =>
  a.map((v, i) => v + (b[i] - v) * t);

const W = 393;
const INSET = 59;
const SCREEN = 852;
const HEADER = mastheadHeight(INSET);
const ICON_CLEARANCE = 44;

describe('1. blekk på ren lagfarge', () => {
  it.each(TEAM_COLORS.map(c => [c.name, c.value]))(
    '%s bærer blekket sitt med ≥ 4,5:1, og fargen er (nesten) uendret',
    (_name, value) => {
      const spot = teamSpotlight(value);
      expect(spot.ratio).toBeGreaterThanOrEqual(4.5);
      expect(spot.steps).toBeLessThanOrEqual(1);
    },
  );

  it('gul, lyseblå og oransje får mørkt blekk på sin FAKTISKE farge', () => {
    for (const value of ['#FFC53D', '#2D9CDB', '#E8590C']) {
      const spot = teamSpotlight(value);
      expect(spot.light).toBe(true);
      expect(spot.surface.toUpperCase()).toBe(value);
    }
  });

  it('marineblå, rød, skoggrønn og sort får hvitt blekk uendret', () => {
    for (const value of ['#12315E', '#D92B2B', '#1E7A46', '#111827']) {
      const spot = teamSpotlight(value);
      expect(spot.light).toBe(false);
      expect(spot.surface.toUpperCase()).toBe(value);
    }
  });
});

describe('2. feltet', () => {
  const f = identityFrame(W, INSET);

  it('er en avrundet form åpen mot venstre, under ikonene og over laghodets bunn', () => {
    expect(f.fill.d.startsWith('M -8 ')).toBe(true);
    expect(f.fill.d.endsWith(' Z')).toBe(true);
    expect((f.fill.d.match(/A /g) ?? []).length).toBe(2);
    expect(f.top.y).toBeGreaterThanOrEqual(ICON_CLEARANCE);
    expect(f.top.y).toBeLessThan(INSET);
    expect(f.side.y).toBeGreaterThan(INSET + HEADER_CONTENT_HEIGHT);
    expect(f.side.y).toBeLessThan(HEADER);
    expect(f.fill.right).toBeGreaterThan(NAME_REACH * W);
    expect(f.fill.right).toBeLessThan(0.7 * W);
    expect(f.fill.d).toContain(`A ${FRAME_RADIUS} ${FRAME_RADIUS}`);
  });

  it('holder full lagfarge gjennom navnesonen og mørkner først mot den runde enden', () => {
    expect(f.fill.fullUntil).toBeCloseTo(FIELD_FULL * f.fill.right, 5);
    expect(f.fill.fullUntil).toBeGreaterThanOrEqual(NAME_REACH * W);
  });

  it('den runde enden er samme hue, litt mørkere — aldri gjennomsiktig', () => {
    for (const value of ['#FFC53D', '#D92B2B', '#12315E']) {
      const end = hex(darkenSameHue(value, FIELD_END_DARKEN));
      const base = hex(value);
      for (let i = 0; i < 3; i++) {
        expect(end[i]).toBeCloseTo(base[i] * FIELD_END_DARKEN, 0);
      }
    }
  });

  it('strekene er åpne: topplinja løses opp mot høyre, hjørnet oppover', () => {
    expect(f.top.fadeTo).toBeGreaterThan(f.top.fadeFrom);
    expect(f.top.fadeTo).toBeLessThan(f.fill.right);
    expect(f.side.fadeTo).toBeLessThan(f.side.fadeFrom);
    expect(f.side.d).not.toContain(' V ');
  });

  it('navnet klippes innenfor feltets fulle lagfarge', () => {
    expect(nameMaxWidth(W, 70)).toBeCloseTo(NAME_REACH * W - 70, 5);
  });
});

describe('3. kontrast der teksten står', () => {
  const f = identityFrame(W, INSET);
  it.each([
    ['gul', '#FFC53D'],
    ['lyseblå', '#2D9CDB'],
    ['oransje', '#E8590C'],
    ['rød', '#D92B2B'],
    ['marineblå', '#12315E'],
  ])(
    '%s: lagnavnets blekk holder ≥ 4,5:1 gjennom hele navnesonen',
    (_n, value) => {
      const spot = teamSpotlight(value);
      const full = hex(spot.surface);
      const end = hex(darkenSameHue(spot.surface, FIELD_END_DARKEN));
      const ink = hex(spot.ink);
      for (const x of [70, 0.4 * W, NAME_REACH * W]) {
        const t = Math.max(
          0,
          (x - f.fill.fullUntil) / (f.fill.right - f.fill.fullUntil),
        );
        expect(
          contrast(ink, lerp(full, end, Math.min(1, t))),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('hvite systemikoner står på ren base', () => {
    expect(contrast(hex('#FFFFFF'), hex(HEADER_BASE))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe('4. lerretet', () => {
  it('reisen starter i #0E211A og treffer broen nøyaktig ved laghodets underkant', () => {
    const body: Array<[number, string]> = [
      [0, HEIA_BRIDGE],
      [0.5, '#02FFAB'],
      [1, '#F3F4EC'],
    ];
    const j = journeyStops(HEADER, SCREEN, HEADER_BASE, body);
    expect(j[0]).toEqual([0, HEADER_BASE]);
    expect(j[1][0]).toBeCloseTo(HEADER / SCREEN, 9);
    expect(j[1][1]).toBe(HEIA_BRIDGE);
    expect(j[j.length - 1]).toEqual([1, '#F3F4EC']);
    for (let i = 1; i < j.length; i++)
      expect(j[i][0]).toBeGreaterThan(j[i - 1][0]);
  });

  it('laghodets høyde er den lerretet regner med, og basen er tokenet', () => {
    expect(HEADER).toBe(INSET + HEADER_CONTENT_HEIGHT + HEADER_FOOT_HEIGHT);
    expect(HEADER).toBe(113);
    expect(HEADER_BASE).toBe(colors.stadium);
    expect(HEIA_BRIDGE).toBe('#143126');
  });
});
