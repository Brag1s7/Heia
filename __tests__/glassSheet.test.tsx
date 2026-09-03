/**
 * @format
 *
 * ARKENE I GLASS (Brage 2026-09-03): månedsvisningen fra «Måned» og «Ny
 * hendelse» («+ Ny» på Kalender, «Ny kamp» fra Sesongen) er tungt Heia-glass
 * i samme familie som feedkortene — ikke flate hvite ark.
 *
 * Fire påstander:
 *   1. `GLASS.sheet` er den tyngste perlen i familien (≥ 0,72) men ikke
 *      opak — grunnen skal fortsatt farge arket;
 *   2. blekket på arket holder over hele grunnspennet arket kan ligge på:
 *      fra reisens mørkeste (#143126, øverst i «Ny hendelse») via neon til
 *      opal — OPAL.inkSecondary ≥ 4,5:1, textPrimary ≥ 7:1;
 *   3. månedsarket har INGEN scrim: bakflaten er gjennomsiktig, men fortsatt
 *      trykkbar for å lukke; arket er glass-varianten `sheet`, med handle;
 *   4. feltflaten på skjemapanelet er lys og halvgjennomsiktig, ikke hvit.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {GLASS, LiquidGlassSurface} from '../src/components/LiquidGlassSurface';
import {OPAL} from '../src/components/OpalSurface';
import {MonthSheet} from '../src/components/calendar/MonthSheet';
import {FIELD} from '../src/screens/NewEventScreen';
import {colors} from '../src/theme';

jest.mock('../src/context', () => ({
  useActiveTeam: () => ({
    activeTeamSpaceId: 'ts-1',
    activeTeamSpace: {id: 'ts-1', displayName: 'Ridabu G10', color: '#1D4ED8'},
  }),
}));

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgba = (s: string): [Rgb, number] => {
  const m = s.match(
    /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/,
  );
  if (!m) return [hex(s), 1];
  return [[+m[1], +m[2], +m[3]], m[4] === undefined ? 1 : +m[4]];
};
const lum = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const over = (fg: string, bg: Rgb): Rgb => {
  const [c, a] = rgba(fg);
  return c.map((v, i) => Math.round(a * v + (1 - a) * bg[i])) as Rgb;
};
const ratio = (a: Rgb, b: Rgb) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Grunnen arket kan ligge over: reisens mørkeste, neon-toppen, mint, opal. */
const GROUNDS: Rgb[] = [
  hex('#143126'),
  hex('#0B412E'),
  hex('#00845A'),
  hex('#02FFAB'),
  hex('#A3FFD3'),
  hex('#F3F4EC'),
];

describe('GLASS.sheet — tungt, ikke opakt, lesbart over hele reisen', () => {
  it('er den tyngste perlen i familien, og fortsatt gjennomsiktig', () => {
    const [, alpha] = rgba(GLASS.sheet.tint);
    expect(alpha).toBeGreaterThanOrEqual(0.72);
    expect(alpha).toBeLessThan(0.9);
    for (const v of ['card', 'control', 'important', 'bar'] as const) {
      expect(alpha).toBeGreaterThan(rgba(GLASS[v].tint)[1]);
    }
    expect(GLASS.sheet.interactive).toBe(false);
  });

  it.each(GROUNDS.map(g => [g.join(','), g] as const))(
    'blekk på arket over grunn %s',
    (_label, ground) => {
      const sheet = over(GLASS.sheet.tint, ground);
      expect(ratio(hex(colors.textPrimary), sheet)).toBeGreaterThanOrEqual(7);
      expect(ratio(hex(OPAL.inkSecondary), sheet)).toBeGreaterThanOrEqual(4.5);
      // Ingen tertiær tekst står rett på arket (plassholderne bruker
      // inkSecondary): over reisens mørkeste ligger inkTertiary på 4,1.
      // Feltflaten på panelet: samme blekk holder også inne i feltet.
      const field = over(FIELD.fill, sheet);
      expect(ratio(hex(colors.textPrimary), field)).toBeGreaterThanOrEqual(7);
      expect(ratio(hex(OPAL.inkTertiary), field)).toBeGreaterThanOrEqual(4.5);
      // Grunnen farger arket: over neon og over teal er to ulike flater.
    },
  );

  it('grunnen farger arket — ikke én flat farge', () => {
    expect(over(GLASS.sheet.tint, GROUNDS[0])).not.toEqual(
      over(GLASS.sheet.tint, GROUNDS[3]),
    );
  });

  it('feltflaten er lys og halvgjennomsiktig, ikke hvit', () => {
    const [c, a] = rgba(FIELD.fill);
    expect(c).toEqual([255, 255, 255]);
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.75);
  });
});

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

describe('månedsarket: glass uten scrim', () => {
  function render() {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <MonthSheet
          visible
          selected={new Date(2026, 8, 9)}
          today={new Date(2026, 8, 9)}
          onSelect={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });
    mounted.push(tree);
    return tree;
  }

  it('bakflaten er gjennomsiktig (ingen mørk scrim) og lukker ved trykk', () => {
    const tree = render();
    const backdrop = tree.root.find(
      n => n.props?.accessibilityLabel === 'Lukk månedsvisningen',
    );
    const style = StyleSheet.flatten(backdrop.props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(typeof backdrop.props.onPress).toBe('function');
  });

  it('arket er glass-varianten «sheet» med handle og rutenett uten egne bokser', () => {
    const tree = render();
    const glass = tree.root.findByType(LiquidGlassSurface);
    expect(glass.props.variant).toBe('sheet');
    // Rutenettet er `plain` — ingen glassboks per dato.
    const grid = tree.root.find(n => n.props?.variant === 'plain');
    expect(grid).toBeTruthy();
    // Handle: 36 × 5 (HIG), sentrert.
    const handle = tree.root.find(
      n =>
        n.type === 'View' &&
        StyleSheet.flatten(n.props.style)?.width === 36 &&
        StyleSheet.flatten(n.props.style)?.height === 5,
    );
    expect(StyleSheet.flatten(handle.props.style).alignSelf).toBe('center');
  });
});
