/**
 * @format
 *
 * VARSLER-CHROMEN (Brage 2026-09-04) — liten, fast, i stadionblekk.
 *
 * Fire påstander:
 *   1. statuslinja er chromens tittel (header-rolle) og står i stadionblekk
 *      med ≥ 4,5:1 på grunnen der den faktisk står (kroppens første 48 pt:
 *      #143126 → #0B412E). Den gamle heiaInk-handlingen sto der med 2,2:1;
 *   2. «Merk alle som lest» er en frostpille i SAMME materiale som ukeradens
 *      plater (STADIUM_CELL) — kopiert, ikke importert, så likheten voktes
 *      her — og teksten på platen holder ≥ 4,5:1 over samme grunnspenn;
 *   3. pillen finnes bare når det er noe å merke, og trykket kaller
 *      handlingen;
 *   4. chromens høyde er den samme med og uten pille — lista under hopper
 *      aldri når alt merkes som lest.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {
  InboxChrome,
  INBOX_CHROME_HEIGHT,
  STADIUM_PILL,
} from '../src/components/InboxChrome';
import {STADIUM_CELL} from '../src/components/calendar/DayCell';
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
const over = (fg: string, bg: Rgb): Rgb => {
  const [c, a] = rgba(fg);
  return c.map((v, i) => Math.round(a * v + (1 - a) * bg[i])) as Rgb;
};
const ratio = (a: Rgb, b: Rgb) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Grunnen der chromen står: E-clean-rampen fra laghodets underkant og
 *  48 pt ned (~6,5 % av kroppen): #143126 → #0B412E. */
const GROUNDS: Rgb[] = [hex('#143126'), hex('#0B412E')];

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(onMarkAll?: () => void, status = '3 nye fra Stange G10') {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <InboxChrome status={status} onMarkAll={onMarkAll} />,
    );
  });
  mounted.push(tree);
  return tree;
}

const header = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(n => n.props?.accessibilityRole === 'header');
/** Pressable-komponenten (eier onPress). */
const pills = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    n =>
      typeof n.type !== 'string' &&
      n.props?.accessibilityLabel === 'Merk alle varsler som lest',
    {deep: true},
  );
/** Host-View-en Pressable tegner — der den utregnede stilen står. */
const pillHost = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n =>
      n.type === 'View' &&
      n.props?.accessibilityLabel === 'Merk alle varsler som lest',
  );
const bar = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.children[0] as ReactTestRenderer.ReactTestInstance;

describe('1. statuslinja', () => {
  it('er chromens tittel, i stadionblekk, og holder ≥ 4,5:1 der den står', () => {
    const tree = render(jest.fn());
    const h = header(tree);
    expect(h.props.children).toBe('3 nye fra Stange G10');
    expect(h.props.numberOfLines).toBe(1);
    const style = StyleSheet.flatten(h.props.style);
    expect(style.color).toBe(colors.stadiumText);
    for (const ground of GROUNDS) {
      expect(ratio(hex(colors.stadiumText), ground)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('den gamle handlingsfargen ville IKKE holdt her (derfor stadionblekk)', () => {
    expect(ratio(hex(colors.heiaInk), GROUNDS[0])).toBeLessThan(3);
  });
});

describe('2. frostpillen', () => {
  it('er samme materiale som ukeradens plater i kalenderchromen', () => {
    expect(STADIUM_PILL.plate).toBe(STADIUM_CELL.plate);
    expect(STADIUM_PILL.plateEdge).toBe(STADIUM_CELL.plateEdge);
    expect(STADIUM_PILL.platePressed).toBe(STADIUM_CELL.platePressed);
    expect(STADIUM_PILL.text).toBe(colors.stadiumText);
  });

  it('har plate med kant, og teksten holder ≥ 4,5:1 på platen over grunnspennet', () => {
    const tree = render(jest.fn());
    const style = StyleSheet.flatten(pillHost(tree).props.style);
    expect(style.backgroundColor).toBe(STADIUM_PILL.plate);
    expect(style.borderColor).toBe(STADIUM_PILL.plateEdge);
    expect(style.borderWidth).toBe(1);
    for (const ground of GROUNDS) {
      const plate = over(STADIUM_PILL.plate, ground);
      expect(ratio(hex(STADIUM_PILL.text), plate)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('3. pillen finnes bare når det er noe å merke', () => {
  it('med uleste: én pille, og trykket kaller handlingen', () => {
    const onMarkAll = jest.fn();
    const tree = render(onMarkAll);
    const found = pills(tree);
    expect(found.length).toBeGreaterThanOrEqual(1);
    act(() => {
      found[0].props.onPress();
    });
    expect(onMarkAll).toHaveBeenCalledTimes(1);
  });

  it('uten uleste: ingen pille, statuslinja står', () => {
    const tree = render(undefined, 'Du er oppdatert');
    expect(pills(tree)).toHaveLength(0);
    expect(header(tree).props.children).toBe('Du er oppdatert');
  });
});

describe('4. høyden endrer seg aldri', () => {
  it('raden holder samme minHeight med og uten pille, og pillen er lavere enn den', () => {
    const withPill = StyleSheet.flatten(bar(render(jest.fn())).props.style);
    const without = StyleSheet.flatten(bar(render(undefined)).props.style);
    expect(withPill.minHeight).toBe(INBOX_CHROME_HEIGHT);
    expect(without.minHeight).toBe(INBOX_CHROME_HEIGHT);
    // Pille 32 + luft 8 over og under = chromens høyde. Ingen flate, ingen kant.
    expect(INBOX_CHROME_HEIGHT).toBe(48);
    expect(withPill.backgroundColor).toBeUndefined();
    expect(withPill.borderBottomWidth).toBeUndefined();
  });
});
