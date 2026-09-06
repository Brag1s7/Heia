/**
 * @format
 *
 * VARSELRADEN SKÅRET INN I GLASSET (Brage 2026-09-04).
 *
 * Fem påstander:
 *   1. raden er gjennomsiktig innhold på arkglasset — ingen egen flate,
 *      og skillelinja er en innfelt blekk-hårlinje fra tekstkolonnen til
 *      16 pt før kanten (aldri kant til kant, aldri borderSubtle);
 *   2. kategori-ikonet er en avrundet KVADRAT (ikke sirkel) med kategoriens
 *      blekk som tint — ingen pastelltoken, ingen surfaceMuted;
 *   3. ulest = tyngre tittel + blekk-prikk; lest = normal tittel, prikken
 *      toner ut. Ingen mintflate over raden;
 *   4. kontrastporten: tittel, body og tid holder ≥ 4,5:1 på arkglasset
 *      (GLASS.sheet-tinten) over hele grunnspennet lista kan stå på —
 *      fra reisens mørke topp (#0B412E) via neon til perle;
 *   5. trykk er en blekk-tint, aldri en lys flate på glasset.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {
  NotificationRow,
  CATEGORY_INK,
  CATEGORY_TINT,
  ROW_ICON,
  ROW_ICON_RADIUS,
  ROW_SEPARATOR_LEFT,
  ROW_SEPARATOR_RIGHT,
  inkTint,
} from '../src/components/NotificationRow';
import {OPAL} from '../src/components/OpalSurface';
import {GLASS} from '../src/components/LiquidGlassSurface';
import {colors} from '../src/theme';
import type {HeiaNotification, NotificationCategory} from '../src/shared/inbox';

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

/** Grunnen bak lista: fra rett under chromen (~13 % av kroppen) og nedover
 *  hele reisen. Mørkeste rimelige start tas med for sikkerhets skyld. */
const GROUNDS: Rgb[] = [
  hex('#0B412E'),
  hex('#014C34'),
  hex('#00754F'),
  hex('#00B37A'),
  hex('#02FFAB'),
  hex('#B8FDD9'),
  hex('#F3F4EC'),
];

const CATEGORIES: NotificationCategory[] = [
  'match_live',
  'new_post',
  'new_comment',
  'new_reaction',
  'event_reminder',
  'rsvp_update',
  'admin_message',
  'system',
];

function notification(
  overrides: Partial<HeiaNotification> = {},
): HeiaNotification {
  return {
    id: 'n1',
    category: 'system',
    title: 'Lag ber om godkjenning',
    body: '«Ridabu G15» vil samle inn støtte.',
    createdAt: new Date(Date.now() - 3 * 60_000),
    readAt: null,
    ...overrides,
  };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(item: HeiaNotification, showBorder = true) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <NotificationRow
        item={item}
        onPress={jest.fn()}
        showBorder={showBorder}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Pressable-komponenten (style er en funksjon av {pressed}). */
const pressable = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n => typeof n.type !== 'string' && n.props?.accessibilityRole === 'button',
  );
const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(n => n.type === 'View' && n.props?.testID === id);
const textByContent = (
  tree: ReactTestRenderer.ReactTestRenderer,
  content: string,
) => tree.root.find(n => n.props?.children === content && !!n.props?.style);
const rowStyle = (
  tree: ReactTestRenderer.ReactTestRenderer,
  pressed: boolean,
) => StyleSheet.flatten(pressable(tree).props.style({pressed}));

describe('1. gjennomsiktig rad med innfelt skillelinje', () => {
  it('har ingen egen flate, og skillelinja er innfelt blekk', () => {
    const tree = render(notification());
    expect(rowStyle(tree, false).backgroundColor).toBeUndefined();
    expect(rowStyle(tree, false).borderBottomWidth).toBeUndefined();
    const [sep] = byTestId(tree, 'row-separator');
    const style = StyleSheet.flatten(sep.props.style);
    expect(style.left).toBe(ROW_SEPARATOR_LEFT);
    expect(style.right).toBe(ROW_SEPARATOR_RIGHT);
    expect(ROW_SEPARATOR_LEFT).toBe(16 + 40 + 12);
    expect(style.backgroundColor).toBe(OPAL.hairline);
    expect(style.backgroundColor).not.toBe(colors.borderSubtle);
  });

  it('siste rad i kjeden har ingen skillelinje', () => {
    expect(
      byTestId(render(notification(), false), 'row-separator'),
    ).toHaveLength(0);
  });
});

describe('2. kategori-ikonet', () => {
  it.each(CATEGORIES)('%s: avrundet kvadrat i kategoriens blekk-tint', cat => {
    const tree = render(notification({category: cat}));
    const [icon] = byTestId(tree, 'row-icon');
    const style = StyleSheet.flatten(icon.props.style);
    expect(style.width).toBe(ROW_ICON);
    expect(style.height).toBe(ROW_ICON);
    expect(style.borderRadius).toBe(ROW_ICON_RADIUS);
    expect(ROW_ICON_RADIUS).toBeLessThan(ROW_ICON / 2);
    expect(style.backgroundColor).toBe(CATEGORY_TINT[cat]);
  });

  it('tintene er blekk, ikke pastelltokens; hverdagen er Heia-grønn, ikke grå', () => {
    const pastels = [
      colors.surfaceMuted,
      colors.liveSoft,
      colors.infoSoft,
      colors.remindSoft,
      colors.sun,
      colors.heiaTint,
      colors.surface,
    ];
    for (const cat of CATEGORIES) {
      expect(pastels).not.toContain(CATEGORY_TINT[cat]);
      expect(CATEGORY_TINT[cat]).toMatch(/^rgba\(/);
    }
    expect(CATEGORY_INK.new_post).toBe(colors.heiaDeep);
    expect(CATEGORY_INK.system).toBe(colors.heiaDeep);
    expect(CATEGORY_INK.new_post).not.toBe(colors.textSecondary);
    expect(inkTint('#E04A44', 0.12)).toBe('rgba(224, 74, 68, 0.12)');
    expect(CATEGORY_TINT.match_live).toBe(inkTint(colors.liveInk, 0.12));
  });

  it('et menneske er en sirkel (Avatar), ikke et kvadrat', () => {
    const tree = render(
      notification({
        category: 'new_comment',
        actor: {id: 'u1', name: 'Sjur Lothe Larsen', avatarPath: null},
      }),
    );
    expect(byTestId(tree, 'row-icon')).toHaveLength(0);
    expect(textByContent(tree, 'SL')).toBeTruthy();
  });
});

describe('3. ulest-tilstanden', () => {
  const dotOpacity = (tree: ReactTestRenderer.ReactTestRenderer) => {
    const [dot] = byTestId(tree, 'unread-dot');
    const style = StyleSheet.flatten(dot.props.style);
    const op = style.opacity as unknown as number | {__getValue: () => number};
    return typeof op === 'number' ? op : op.__getValue();
  };

  it('ulest: tyngre tittel og synlig blekk-prikk', () => {
    const tree = render(notification({readAt: null}));
    const title = StyleSheet.flatten(
      textByContent(tree, 'Lag ber om godkjenning').props.style,
    );
    expect(title.fontWeight).toBe('700');
    expect(title.color).toBe(colors.textPrimary);
    expect(dotOpacity(tree)).toBe(1);
    const [dot] = byTestId(tree, 'unread-dot');
    expect(StyleSheet.flatten(dot.props.style).backgroundColor).toBe(
      colors.heiaInk,
    );
    expect(pressable(tree).props.accessibilityLabel).toMatch(/^Ulest\. /);
  });

  it('lest: normal tittel i full tekstfarge, prikken borte, ingen mintflate', () => {
    const tree = render(notification({readAt: new Date()}));
    const title = StyleSheet.flatten(
      textByContent(tree, 'Lag ber om godkjenning').props.style,
    );
    expect(title.fontWeight).toBe('600');
    expect(title.color).toBe(colors.textPrimary);
    expect(dotOpacity(tree)).toBe(0);
    expect(rowStyle(tree, false).backgroundColor).toBeUndefined();
  });
});

describe('4. kontrastporten på arkglasset', () => {
  it('tittel, body og tid holder ≥ 4,5:1 over hele grunnspennet', () => {
    const tree = render(notification());
    const title = StyleSheet.flatten(
      textByContent(tree, 'Lag ber om godkjenning').props.style,
    );
    const body = StyleSheet.flatten(
      textByContent(tree, '«Ridabu G15» vil samle inn støtte.').props.style,
    );
    const time = StyleSheet.flatten(textByContent(tree, '3 min').props.style);
    for (const ground of GROUNDS) {
      const glass = over(GLASS.sheet.tint, ground);
      expect(ratio(hex(title.color as string), glass)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(ratio(hex(body.color as string), glass)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(ratio(hex(time.color as string), glass)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(body.color).toBe(OPAL.inkSecondary);
    expect(time.color).toBe(OPAL.inkSecondary);
    expect(time.fontSize).toBeLessThan(body.fontSize as number);
  });
});

describe('5. trykk', () => {
  it('er en blekk-tint, ikke en lys flate', () => {
    const tree = render(notification());
    const pressed = rowStyle(tree, true);
    expect(pressed.backgroundColor).toBe(OPAL.rowPressed);
    const [, alpha] = rgba(pressed.backgroundColor as string);
    expect(alpha).toBeLessThanOrEqual(0.1);
    expect(pressed.backgroundColor).not.toBe(colors.surfaceMuted);
  });
});
