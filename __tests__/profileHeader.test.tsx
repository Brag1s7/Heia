/**
 * @format
 *
 * PROFIL-HEADEREN SOM MASTHEAD (Brage 2026-09-04: «samme header og bakgrunn
 * som resten av sidene», innholdet — avatar + navn + e-post — som før).
 *
 * Fire påstander:
 *   1. headeren er gjennomsiktig innhold: ingen egen gradient, ingen egne
 *      buer, ingen hårlinje — lerretet (DaylightGround masthead) eier alt;
 *   2. geometrien er laghodets: safe area + 42 + 12 = `mastheadHeight`, og
 *      navneblokken klippes innenfor feltets fulle farge som lagnavnet;
 *   3. feltet er Heias mørkegrønne — ikke en lagfarge — og blekket (hvitt)
 *      holder ≥ 4,5:1 for navn og e-post på det;
 *   4. innholdet er som før: avataren er inngangen til profilbilde,
 *      e-posten klippes i midten, rollebadgen står til høyre, statuslinja
 *      er lys.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StatusBar, StyleSheet} from 'react-native';
import Svg from 'react-native-svg';
import {ProfileHeader, PROFILE_IDENTITY} from '../src/components/ProfileHeader';
import {TEAM_COLORS, teamSpotlight} from '../src/shared/teamColors';
import {mastheadHeight, nameMaxWidth} from '../src/shared/masthead';
import {
  HEADER_CONTENT_HEIGHT,
  HEADER_FOOT_HEIGHT,
} from '../src/shared/headerGeometry';
import {colors} from '../src/theme';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
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

const W = 393;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(onPressAvatar?: () => void) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <ProfileHeader
        name="Brage Lothe Weium"
        email="brage.lothe.weium@gmail.com"
        role="Trener"
        onPressAvatar={onPressAvatar}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

const root = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.children[0] as ReactTestRenderer.ReactTestInstance;
/** Pressable-komponenten (eier onPress). */
const avatarPressable = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n =>
      typeof n.type !== 'string' &&
      n.props?.accessibilityLabel === 'Endre profilbilde',
  );
/** Host-View-en Pressable tegner — der den utregnede stilen står. */
const avatarHost = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n =>
      n.type === 'View' && n.props?.accessibilityLabel === 'Endre profilbilde',
  );
const textByContent = (
  tree: ReactTestRenderer.ReactTestRenderer,
  content: string,
) => tree.root.find(n => n.props?.children === content && !!n.props?.style);

describe('1. gjennomsiktig innhold på lerretet', () => {
  it('har ingen egen flate, gradient, buer eller hårlinje', () => {
    const tree = render();
    const style = StyleSheet.flatten(root(tree).props.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderBottomWidth).toBeUndefined();
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
  });
});

describe('2. laghodets geometri', () => {
  it('safe area + 42 + 12 = mastheadHeight (insets.top er 0 i testmiljøet)', () => {
    const tree = render(jest.fn());
    const style = StyleSheet.flatten(root(tree).props.style);
    expect(style.paddingTop).toBe(0);
    expect(style.paddingBottom).toBe(HEADER_FOOT_HEIGHT);
    expect(HEADER_CONTENT_HEIGHT + HEADER_FOOT_HEIGHT).toBe(mastheadHeight(0));
    expect(StyleSheet.flatten(avatarHost(tree).props.style).minHeight).toBe(
      HEADER_CONTENT_HEIGHT,
    );
  });

  it('navneblokken klippes innenfor feltets fulle farge, som lagnavnet', () => {
    const tree = render();
    act(() => {
      root(tree).props.onLayout({nativeEvent: {layout: {width: W}}});
    });
    const name = textByContent(tree, 'Brage Lothe Weium');
    const wrap = name.parent as ReactTestRenderer.ReactTestInstance;
    const style = StyleSheet.flatten(wrap.props.style);
    // Navneblokken starter etter padding 16 + ring 42 + gap 12 = 70.
    expect(style.maxWidth).toBeCloseTo(nameMaxWidth(W, 70), 5);
    expect(style.flexShrink).toBe(1);
  });
});

describe('3. feltet er Heias, og blekket holder', () => {
  it('feltet er heiaDeep og ikke en av lagfargene', () => {
    expect(PROFILE_IDENTITY).toBe(colors.heiaDeep);
    expect(TEAM_COLORS.map(c => c.value.toUpperCase())).not.toContain(
      PROFILE_IDENTITY.toUpperCase(),
    );
  });

  it('navn og e-post står i hvitt blekk med ≥ 4,5:1 på feltet', () => {
    const spot = teamSpotlight(PROFILE_IDENTITY);
    expect(spot.light).toBe(false);
    expect(spot.surface.toUpperCase()).toBe(PROFILE_IDENTITY.toUpperCase());
    const field = hex(PROFILE_IDENTITY);
    const tree = render();
    const name = StyleSheet.flatten(
      textByContent(tree, 'Brage Lothe Weium').props.style,
    );
    expect(name.color).toBe(spot.ink);
    expect(ratio(hex(spot.ink), field)).toBeGreaterThanOrEqual(4.5);
    const email = StyleSheet.flatten(
      textByContent(tree, 'brage.lothe.weium@gmail.com').props.style,
    );
    expect(
      ratio(over(email.color as string, field), field),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('4. innholdet er som før', () => {
  it('avataren er inngangen til profilbilde, e-posten klippes i midten, rollen står', () => {
    const onPressAvatar = jest.fn();
    const tree = render(onPressAvatar);
    act(() => {
      avatarPressable(tree).props.onPress();
    });
    expect(onPressAvatar).toHaveBeenCalledTimes(1);
    expect(
      textByContent(tree, 'brage.lothe.weium@gmail.com').props.ellipsizeMode,
    ).toBe('middle');
    expect(textByContent(tree, 'Trener')).toBeTruthy();
  });

  it('statuslinja er lys på den universelle mørke basen', () => {
    const tree = render();
    const bars = tree.root.findAllByType(StatusBar);
    expect(bars).toHaveLength(1);
    expect(bars[0].props.barStyle).toBe('light-content');
  });
});
