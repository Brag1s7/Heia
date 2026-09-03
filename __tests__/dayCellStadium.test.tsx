/**
 * @format
 *
 * UKERADEN I KALENDERCHROMEN — stadion-tonen (Brage 2026-09-03, runde 2).
 *
 * Chromen er permanent og står i dagslysgrunnens mørke topp. Tre påstander:
 *   1. blekket holder: ukedag og tall ≥ 4,5:1 og «valgt/i dag»-neon ≥ 3:1
 *      på frostplaten over grunnen der de faktisk står (#143126 ved
 *      laghodets underkant → #00593C der raden slutter);
 *   2. hver dag har en plate med kant — definisjon, ikke flytende tekst —
 *      og den valgte skiller seg fra de andre med neonramme;
 *   3. standardtonen (datovelgeren) er URØRT: uten `tone` er stilene som før.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {DayCell, STADIUM_CELL} from '../src/components/calendar/DayCell';
import {colors} from '../src/theme';

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
const over = (fg: string, bg: Rgb, opacity = 1): Rgb => {
  const [c, a] = rgba(fg);
  const k = a * opacity;
  return c.map((v, i) => Math.round(k * v + (1 - k) * bg[i])) as Rgb;
};
const ratio = (a: Rgb, b: Rgb) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/**
 * Grunnen der raden står: E-clean-rampen fra laghodets underkant (0 %) og
 * nedover. Ukedagsteksten står i cellens TOPP (kroppens ~6–8 %: #143126 →
 * #0B412E); tallet og prikkene lenger ned (~8–14 %: #0B412E → #00593C).
 * Neon og platen måles over hele spennet.
 */
const WEEKDAY_GROUNDS: Rgb[] = [hex('#143126'), hex('#0B412E')];
const GROUNDS: Rgb[] = [
  hex('#143126'),
  hex('#0B412E'),
  hex('#014C34'),
  hex('#00593C'),
];

describe('stadion-tonen: blekket holder på platen over hele grunnspennet', () => {
  it.each(WEEKDAY_GROUNDS.map(g => [g.join(','), g] as const))(
    'ukedag på grunn %s: vanlig og helg ≥ 4,5:1',
    (_label, ground) => {
      const plate = over(STADIUM_CELL.plate, ground);
      expect(
        ratio(over(STADIUM_CELL.weekday, plate), plate),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(
          over(STADIUM_CELL.weekday, plate, STADIUM_CELL.weekendOpacity),
          plate,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(GROUNDS.map(g => [g.join(','), g] as const))(
    'tall, neon og plate på grunn %s',
    (_label, ground) => {
      const plate = over(STADIUM_CELL.plate, ground);
      const selectedPlate = over(colors.heiaSoft, ground);
      // Tallet på vanlig plate: AA for brødtekst.
      expect(
        ratio(over(STADIUM_CELL.number, plate), plate),
      ).toBeGreaterThanOrEqual(4.5);
      // Neon («i dag» på vanlig plate, «valgt» på heiaSoft-platen): fet
      // displayfont på 16,5 pt, og tilstanden bæres også av ramme/fyll —
      // porten er AA for stor/fet tekst (3:1), ikke brødtekst.
      expect(ratio(hex(STADIUM_CELL.accent), plate)).toBeGreaterThanOrEqual(3);
      expect(
        ratio(hex(STADIUM_CELL.accent), selectedPlate),
      ).toBeGreaterThanOrEqual(3);
      // Platen selv skiller seg fra grunnen — ellers er den ikke en plate.
      expect(ratio(plate, ground)).toBeGreaterThan(1.1);
      expect(
        ratio(over(STADIUM_CELL.plateEdge, ground), ground),
      ).toBeGreaterThan(1.2);
    },
  );

  it('det gamle mørke blekket hadde IKKE holdt her — derfor finnes tonen', () => {
    const plate = over(STADIUM_CELL.plate, GROUNDS[0]);
    expect(ratio(hex(colors.textPrimary), plate)).toBeLessThan(2);
    expect(ratio(hex(colors.textSecondary), plate)).toBeLessThan(3);
    expect(ratio(hex(colors.goldInk), plate)).toBeLessThan(2);
  });
});

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});
function render(props: Partial<React.ComponentProps<typeof DayCell>>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <DayCell
        day={new Date(2026, 8, 9)}
        selected={false}
        isToday={false}
        weekday="ons"
        onPress={jest.fn()}
        accessibilityLabel="onsdag 9. september"
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}
const cellStyle = (tree: ReactTestRenderer.ReactTestRenderer) => {
  const p = tree.root.find(n => n.props?.accessibilityRole === 'button');
  return StyleSheet.flatten(
    typeof p.props.style === 'function'
      ? p.props.style({pressed: false})
      : p.props.style,
  );
};
const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType('Text' as never).map(t => ({
    text: t.children.join(''),
    style: StyleSheet.flatten(t.props.style),
  }));

describe('stadion-tonen: plate per dag, neon for valgt', () => {
  it('vanlig dag har frostplate med kant og stadionblekk', () => {
    const tree = render({tone: 'stadium'});
    const cell = cellStyle(tree);
    expect(cell.backgroundColor).toBe(STADIUM_CELL.plate);
    expect(cell.borderColor).toBe(STADIUM_CELL.plateEdge);
    const [wd, num] = texts(tree);
    expect(wd.style.color).toBe(STADIUM_CELL.weekday);
    expect(num.style.color).toBe(colors.stadiumText);
  });

  it('valgt dag: neonramme + heiaSoft-fyll, tall og ukedag i neon', () => {
    const tree = render({tone: 'stadium', selected: true, isToday: true});
    const cell = cellStyle(tree);
    expect(cell.borderColor).toBe(colors.heia);
    expect(cell.backgroundColor).toBe(colors.heiaSoft);
    const [wd, num] = texts(tree);
    expect(wd.style.color).toBe(colors.heia);
    expect(num.style.color).toBe(colors.heia);
  });

  it('i dag (ikke valgt): neon tall, vanlig plate — ingen ekstra ring', () => {
    const tree = render({tone: 'stadium', isToday: true});
    const cell = cellStyle(tree);
    expect(cell.borderColor).toBe(STADIUM_CELL.plateEdge);
    expect(texts(tree)[1].style.color).toBe(colors.heia);
  });

  it('turneringsprikken er gull på stadion, goldInk på lys', () => {
    const dark = render({tone: 'stadium', types: ['turnering']});
    const light = render({types: ['turnering']});
    const dot = (t: ReactTestRenderer.ReactTestRenderer) =>
      StyleSheet.flatten(
        t.root.findAll(
          n =>
            n.type === 'View' &&
            n.props.style &&
            StyleSheet.flatten(n.props.style).width === 5,
        )[0].props.style,
      ).backgroundColor;
    expect(dot(dark)).toBe(colors.gold);
    expect(dot(light)).toBe(colors.goldInk);
  });

  it('standardtonen (datovelgeren) er urørt', () => {
    const tree = render({});
    const cell = cellStyle(tree);
    expect(cell.backgroundColor).toBeUndefined();
    expect(cell.borderColor).toBe('transparent');
    const [wd, num] = texts(tree);
    expect(wd.style.color).toBe(colors.textSecondary);
    expect(num.style.color).toBe(colors.textPrimary);
  });
});
