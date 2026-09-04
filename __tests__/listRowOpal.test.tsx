/**
 * @format
 *
 * LISTROW PÅ OPAL (Brage 2026-09-04 — Profil-gruppene).
 *
 * Fire påstander:
 *   1. standardmaterialet er URØRT: kant-til-kant borderSubtle, textSecondary
 *      på underteksten, heiaSoft ved trykk (Lagoversikt, Sesongen, hendelsen);
 *   2. `material="opal"`: ingen kant på containeren; en innfelt blekk-
 *      hårlinje som starter der teksten starter (16 + 32 + 12 med ikon,
 *      16 uten) og slutter 16 pt før kanten; underteksten i OPAL-blekk;
 *      trykk = blekk-tint;
 *   3. `tone="action"`: tittelen i opalens aksentblekk — ikke heiaInk, som
 *      faller under 4,5:1 på perlen;
 *   4. kontrastporten: undertekst og handlingstittel holder ≥ 4,5:1 på
 *      opalen ved KANTOPASITETEN over Profils mørkeste grunn (#143126 rett
 *      under headeren, der lagkortene står).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, View} from 'react-native';
import {ListRow, OPAL_ROW_ICON_SLOT} from '../src/components/ListRow';
import {OPAL} from '../src/components/OpalSurface';
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

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(props: Partial<React.ComponentProps<typeof ListRow>> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <ListRow
        title="Lagoversikt"
        subtitle="Se hvem som er med i laget"
        onPress={jest.fn()}
        icon={<View testID="icon" />}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

const pressable = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(n => typeof n.props?.style === 'function');
const container = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(n => n.type === 'View' && Array.isArray(n.props?.style))[0];
const separators = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    n => n.type === 'View' && n.props?.testID === 'row-separator',
  );
const textByContent = (
  tree: ReactTestRenderer.ReactTestRenderer,
  content: string,
) => tree.root.find(n => n.props?.children === content && !!n.props?.style);

describe('1. standardmaterialet er urørt', () => {
  it('kant til kant, textSecondary, heiaSoft ved trykk', () => {
    const tree = render();
    const style = StyleSheet.flatten(container(tree).props.style);
    expect(style.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
    expect(style.borderBottomColor).toBe(colors.borderSubtle);
    expect(separators(tree)).toHaveLength(0);
    expect(
      StyleSheet.flatten(
        textByContent(tree, 'Se hvem som er med i laget').props.style,
      ).color,
    ).toBe(colors.textSecondary);
    expect(
      StyleSheet.flatten(pressable(tree).props.style({pressed: true}))
        .backgroundColor,
    ).toBe(colors.heiaSoft);
  });
});

describe('2. material="opal"', () => {
  it('ingen kant på containeren, innfelt blekk-hårlinje fra teksten', () => {
    const tree = render({material: 'opal'});
    const style = StyleSheet.flatten(container(tree).props.style);
    expect(style.borderBottomWidth).toBeUndefined();
    const [sep] = separators(tree);
    const s = StyleSheet.flatten(sep.props.style);
    expect(s.left).toBe(16 + OPAL_ROW_ICON_SLOT + 12);
    expect(s.right).toBe(16);
    expect(s.height).toBe(StyleSheet.hairlineWidth);
    expect(s.backgroundColor).toBe(OPAL.hairline);
  });

  it('uten ikon starter linja ved 16; uten kant finnes den ikke', () => {
    const noIcon = render({material: 'opal', icon: undefined});
    expect(StyleSheet.flatten(separators(noIcon)[0].props.style).left).toBe(16);
    expect(
      separators(render({material: 'opal', showBorder: false})),
    ).toHaveLength(0);
  });

  it('underteksten i OPAL-blekk, trykk = blekk-tint', () => {
    const tree = render({material: 'opal'});
    expect(
      StyleSheet.flatten(
        textByContent(tree, 'Se hvem som er med i laget').props.style,
      ).color,
    ).toBe(OPAL.inkSecondary);
    expect(
      StyleSheet.flatten(pressable(tree).props.style({pressed: true}))
        .backgroundColor,
    ).toBe(OPAL.rowPressed);
  });
});

describe('3. tone="action"', () => {
  it('tittelen står i opalens aksentblekk', () => {
    const tree = render({material: 'opal', tone: 'action', title: 'Bli med'});
    const title = StyleSheet.flatten(
      textByContent(tree, 'Bli med').props.style,
    );
    expect(title.color).toBe(OPAL.inkAccent);
    expect(title.color).not.toBe(colors.heiaInk);
  });
});

describe('4. kontrastporten på opalen', () => {
  it('undertekst og handlingstittel ≥ 4,5:1 ved kantopasitet over #143126', () => {
    const ground = hex('#143126');
    const opal = mix(hex(OPAL.baseBottom), OPAL.baseEdgeOpacity, ground);
    expect(ratio(hex(OPAL.inkSecondary), opal)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex(OPAL.inkAccent), opal)).toBeGreaterThanOrEqual(4.5);
    // …og heiaInk ville IKKE holdt her — derfor aksentblekket.
    expect(ratio(hex(colors.heiaInk), opal)).toBeLessThan(4.5);
  });
});
