/**
 * @format
 *
 * OPALPANELET — Profils kantfysikk (Brage 2026-09-04: «kantene ser fortsatt
 * for boksete ut … surface with edge physics, ikke white card with border»).
 *
 * Fire påstander:
 *   1. kortvarianten er URØRT — feedkortets fallback skal ikke endre seg av
 *      at Profil fikk sin egen kant;
 *   2. panelet har mykere lys som dør TIDLIGERE langs diagonalen, og en
 *      dypere blekk-motkant: mindre uniform outline, mer retning;
 *   3. panelet slipper mer av grunnen gjennom enn kortet;
 *   4. kontrastporten holder ved panelets KANTOPASITET over den mørkeste
 *      grunnen et Profil-panel kan stå på — dette er gulvet som hindrer at
 *      «mer glass» blir «dårligere lesbarhet».
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Stop} from 'react-native-svg';
import {OpalSurface, OPAL, OPAL_PANEL} from '../src/components/OpalSurface';
import {colors} from '../src/theme';

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const lum = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const mix = (fg: Rgb, a: number, bg: Rgb): Rgb =>
  fg.map((v, i) => Math.round(a * v + (1 - a) * bg[i])) as Rgb;
const ratio = (a: Rgb, b: Rgb) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/**
 * Grunnen under et Profil-panel, mørkest først: lagkortene starter rett
 * under laghodet (~7 % av kroppen) og action-gruppa følger. Lenger ned blir
 * grunnen lysere, så disse to er gulvet.
 */
const DARKEST: Rgb[] = [hex('#0B412E'), hex('#014C34')];

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

/** Rim-gradientens stopp: [offset, farge, opasitet] i tegnerekkefølge. */
function rimStops(variant?: 'panel'): Array<[number, string, number]> {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<OpalSurface variant={variant} />);
  });
  mounted.push(tree);
  const grad = tree.root.find(n => n.props?.id === 'opRim');
  return grad
    .findAllByType(Stop)
    .map(
      s =>
        [+s.props.offset, s.props.stopColor, +s.props.stopOpacity] as [
          number,
          string,
          number,
        ],
    );
}

/** Materialets grunnflate: hvor mye av grunnen som slipper gjennom kanten. */
function baseEdgeOpacity(variant?: 'panel'): number {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<OpalSurface variant={variant} />);
  });
  mounted.push(tree);
  const base = tree.root.find(
    n => n.type !== 'string' && n.props?.fill === 'url(#opBase)',
  );
  return base.props.fillOpacity as number;
}

describe('1. kortvarianten er urørt', () => {
  it('har fortsatt dagens ring — feedkortets fallback endrer seg ikke', () => {
    const stops = rimStops();
    expect(stops[0][2]).toBe(OPAL.edgeTop);
    expect(stops[1]).toEqual([0.45, OPAL.edgeColor, OPAL.edgeMid]);
    expect(stops[3][2]).toBe(OPAL.edgeShade);
    expect(baseEdgeOpacity()).toBe(OPAL.baseEdgeOpacity);
  });

  it('finnes fortsatt et specular langs toppen (samme i begge varianter)', () => {
    expect(OPAL.highlight).toBeGreaterThan(0.4);
  });
});

describe('2. panelets kantfysikk', () => {
  const card = rimStops();
  const panel = rimStops('panel');

  it('lyset er svakere og dør tidligere langs diagonalen', () => {
    expect(panel[0][2]).toBeLessThan(card[0][2]);
    expect(panel[0][2]).toBe(OPAL_PANEL.edgeTop);
    // Der lyset er dødd ut: panelet slipper det før kortet gjør.
    expect(panel[1][0]).toBeLessThan(card[1][0]);
    expect(panel[1][0]).toBe(OPAL_PANEL.edgeMidStop);
    expect(panel[1][2]).toBeLessThan(card[1][2]);
  });

  it('motkanten nederst/til sidene er dypere enn kortets', () => {
    expect(panel[3][2]).toBeGreaterThan(card[3][2]);
    expect(panel[3][1]).toBe(OPAL.edgeShadeColor);
    expect(panel[3][2]).toBe(OPAL_PANEL.edgeShade);
  });

  it('motkanten begynner der lyset slutter, ikke før', () => {
    expect(panel[2][0]).toBeGreaterThan(panel[1][0]);
    expect(panel[2][2]).toBe(0);
  });
});

describe('3. mer grunn gjennom materialet', () => {
  it('panelet er tynnere enn kortet, men fortsatt ikke tynt glass', () => {
    expect(baseEdgeOpacity('panel')).toBe(OPAL_PANEL.baseEdgeOpacity);
    expect(OPAL_PANEL.baseEdgeOpacity).toBeLessThan(OPAL.baseEdgeOpacity);
    expect(OPAL_PANEL.baseOpacity).toBeLessThan(OPAL.baseOpacity);
    // Gulvet: under dette ryker kontrastporten under.
    expect(OPAL_PANEL.baseEdgeOpacity).toBeGreaterThanOrEqual(0.8);
  });
});

describe('4. kontrastporten på panelet', () => {
  it.each(DARKEST.map(g => [g.join(','), g] as const))(
    'grunn %s: blekket holder ved kantopasiteten',
    (_label, ground) => {
      const panel = mix(
        hex(OPAL.baseBottom),
        OPAL_PANEL.baseEdgeOpacity,
        ground,
      );
      expect(ratio(hex(OPAL.inkSecondary), panel)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(hex(OPAL.inkAccent), panel)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(hex(colors.textPrimary), panel)).toBeGreaterThanOrEqual(7);
    },
  );
});
