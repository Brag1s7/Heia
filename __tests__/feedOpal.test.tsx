/**
 * @format
 *
 * OPALEN — materialprototypen for ikke-festede feedposter (2026-09-02).
 *
 * KONTRASTPORTEN ER HARD (Brage): sekundærtekst og pilletekst skal holde
 * 4,5:1 i SVAKESTE grunnposisjon — målt, ikke «dokumentert som kjent gjeld».
 * Tre ting som ellers går galt stille:
 *   1. Blekket måles mot flaten det står på: opalens mørkeste base-stopp
 *      over den mørkeste grunnen et kort kan nå, MED neon-opptaket i
 *      hjørnet, og inne i reaksjonspillens blekkvask oppå det igjen.
 *   2. Bryteren bytter KUN ikke-festede kort; VIKTIG-kort er solide og
 *      beholder tokenblekket. Padding-boksen er identisk med `styles.card`.
 *   3. Systembryterne: Reduce Transparency → solid base + solid bunn,
 *      Increase Contrast → blekk-hårlinje i stedet for lys, høylys av.
 *      Android: `boxShadow`, aldri `elevation`/`shadow*` (blør gjennom).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, StyleSheet, type ViewStyle} from 'react-native';
import {LinearGradient, Rect, Stop} from 'react-native-svg';
import {FeedCard, FEED_OPAL_AB} from '../src/components/FeedCard';
import {OpalSurface, OPAL} from '../src/components/OpalSurface';
import {colors, radius, spacing} from '../src/theme';
import type {FeedItem} from '../src/shared/types';

// ---------------------------------------------------------------------------
// Kontrast — samme regnestykke som stadiumGlass.test.
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
/** Én farge med alfa lagt over en annen — det øyet faktisk ser. */
const over = (fg: string, alpha: number, bg: string) => {
  const f = rgb(fg);
  const b = rgb(bg);
  const mix = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `#${mix.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * GRUNNENE et feedkort kan ligge på (DaylightGround, RN-porten, rendret
 * 393 × 852 i riggen og pikselmålt i kortregionen x 16–377, y 118–764 —
 * under laghodet, over tab-baren):
 *   WEAKEST  mørkeste piksel i regionen, nederst til høyre (373, 763).
 *   NEON     neonkjernen under første korts venstre kant.
 *   AQUA     aquafeltet under første korts høyre kant.
 */
const GROUNDS = {
  WEAKEST: '#0E6656',
  NEON: '#02FEAB',
  AQUA: '#4AE1CE',
} as const;

/** Reaksjonspillens blekkvask (FeedCard `reactPill`). Vaktes under. */
const PILL_WASH = {color: colors.textPrimary, alpha: 0.06};
/** Rolle-pillens fyll (`heiaSoft` = neon 0,12). */
const ROLE_WASH = {color: colors.heia, alpha: 0.12};

/**
 * Flaten i kortets mørkeste hjørne: mørkeste base-stopp ved basens opasitet
 * over grunnen, med neon-opptaket på full styrke oppå. Sheen-en ligger i
 * motsatt hjørne og hjelper ikke her — dette er verste sted på kortet.
 */
const cornerSurface = (ground: string) =>
  over(
    OPAL.uptakeColor,
    OPAL.uptake,
    over(OPAL.baseBottom, OPAL.baseEdgeOpacity, ground),
  );

describe('opalens blekk holder 4,5:1 i svakeste grunnposisjon', () => {
  it.each(Object.entries(GROUNDS))(
    '%s: sekundærblekk på flaten OG inne i reaksjonspillen, aksent på rollepillen',
    (_name, ground) => {
      const surface = cornerSurface(ground);
      const pill = over(PILL_WASH.color, PILL_WASH.alpha, surface);
      const role = over(ROLE_WASH.color, ROLE_WASH.alpha, surface);
      expect(ratio(OPAL.inkSecondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(OPAL.inkSecondary, pill)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(OPAL.inkTertiary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(OPAL.inkAccent, role)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.textPrimary, surface)).toBeGreaterThanOrEqual(7);
    },
  );

  it('aktiv 👏 (heiaInk på solid heiaTint) er grunn-uavhengig og holder', () => {
    expect(ratio(colors.heiaInk, colors.heiaTint)).toBeGreaterThanOrEqual(4.5);
  });

  it('det lokale blekket finnes av én grunn: tokenene faller under porten her', () => {
    // Faller denne, holder `colors.textSecondary`/`heiaInk` selv — da skal
    // OPAL.inkSecondary/inkAccent fjernes, ikke beholdes av vane.
    const surface = cornerSurface(GROUNDS.WEAKEST);
    const pill = over(PILL_WASH.color, PILL_WASH.alpha, surface);
    const role = over(ROLE_WASH.color, ROLE_WASH.alpha, surface);
    expect(ratio(colors.textSecondary, pill)).toBeLessThan(4.5);
    expect(ratio(colors.heiaInk, role)).toBeLessThan(4.5);
    expect(ratio(colors.textTertiary, surface)).toBeLessThan(4.5);
  });

  it('opalen er kjølig perlegrå i Brages bånd, aldri hvit', () => {
    expect(OPAL.baseOpacity).toBeGreaterThanOrEqual(0.9);
    expect(OPAL.baseOpacity).toBeLessThanOrEqual(0.92);
    expect(OPAL.baseEdgeOpacity).toBeGreaterThanOrEqual(0.86);
    expect(OPAL.baseEdgeOpacity).toBeLessThanOrEqual(0.88);
    for (const stop of [OPAL.baseTop, OPAL.baseMid, OPAL.baseBottom]) {
      expect(stop.toUpperCase()).not.toBe('#FFFFFF');
      const [r, g, b] = rgb(stop);
      // Kjølig: blå ≥ rød (perle), aldri varm krem. Grønn ≥ rød (Heia).
      expect(b).toBeGreaterThanOrEqual(r);
      expect(g).toBeGreaterThanOrEqual(r);
    }
    // Grunnen påvirker flaten: over neon og over aqua er to ulike farger.
    expect(over(OPAL.baseMid, OPAL.baseOpacity, GROUNDS.NEON)).not.toBe(
      over(OPAL.baseMid, OPAL.baseOpacity, GROUNDS.AQUA),
    );
  });
});

// ---------------------------------------------------------------------------
// Bryteren og grenene
// ---------------------------------------------------------------------------
const author = {id: 'u1', name: 'Jarle Wik', role: 'trener'} as const;
const melding = {
  id: 'p1',
  teamSpaceId: 'ts-1',
  type: 'melding',
  author,
  createdAt: new Date(),
  content: 'Husk draktene.',
  heiaCount: 3,
  commentCount: 2,
} as unknown as FeedItem;
const festet = {...melding, id: 'p2', isPinned: true} as FeedItem;

type A11y = {rt?: boolean; ic?: boolean};

async function render(item: FeedItem, a11y: A11y = {}, onPress?: () => void) {
  // RN-mockens gettere er delte jest.fn — Once, så neste test er uberørt.
  // Kun når bryteren skal PÅ: et festet kort monterer ikke hooken, og en
  // Once(false) i kø der ville blitt lest av NESTE test i stedet.
  if (a11y.rt) {
    (
      AccessibilityInfo.isReduceTransparencyEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
  }
  if (a11y.ic) {
    (
      AccessibilityInfo.isDarkerSystemColorsEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
  }
  let root!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    root = ReactTestRenderer.create(
      <FeedCard
        item={item}
        onHeia={() => {}}
        onComment={() => {}}
        onMore={() => {}}
        onPress={onPress}
      />,
    );
  });
  await act(async () => {});
  return root;
}

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as Record<string, unknown>;

const textsWithColor = (
  root: ReactTestRenderer.ReactTestRenderer,
  color: string,
) =>
  root.root
    .findAllByType('Text' as never)
    .filter(t => flat(t.props.style).color === color)
    .map(t => t.children.join(''));

const baseRect = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root.findAllByType(Rect).find(r => r.props.fill === 'url(#opBase)');
const rimStops = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root
    .findAllByType(LinearGradient)
    .find(g => g.props.id === 'opRim')
    ?.findAllByType(Stop)
    .map(s => [s.props.stopColor, s.props.stopOpacity]);
const highlightStops = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root
    .findAllByType(LinearGradient)
    .find(g => g.props.id === 'opHighlight')
    ?.findAllByType(Stop)
    .map(s => s.props.stopOpacity);

describe('FEED_OPAL_AB bytter kun ikke-festede kort', () => {
  it('bryteren står PÅ i prototypen', () => {
    expect(FEED_OPAL_AB).toBe(true);
  });

  it('vanlig melding: OpalSurface, lokalt blekk på pilletekst og rolle', async () => {
    const root = await render(melding);
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(1);
    expect(textsWithColor(root, OPAL.inkSecondary)).toEqual([
      '👏 3 heier',
      '2',
    ]);
    expect(textsWithColor(root, OPAL.inkAccent)).toEqual(['Trener']);
    expect(textsWithColor(root, colors.textSecondary)).toEqual([]);
    root.unmount();
  });

  it('festet VIKTIG-kort: solid solskinnsflate, tokenblekk, ingen opal', async () => {
    const root = await render(festet);
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(0);
    const card = root.root.findAllByType('View' as never)[0];
    expect(flat(card.props.style).backgroundColor).toBe(colors.sun);
    expect(textsWithColor(root, colors.textSecondary)).toEqual([
      '👏 3 heier',
      '2',
    ]);
    expect(textsWithColor(root, OPAL.inkSecondary)).toEqual([]);
    expect(textsWithColor(root, colors.heiaInk)).toEqual(['Trener']);
    root.unmount();
  });

  it('padding-boksen er identisk med dagens kort: 1 pt kant + padding xl, radius xl', async () => {
    const root = await render(melding);
    const surface = root.root.findByType(OpalSurface);
    // Innerboksen: det første View-et med overflow hidden under svg-en.
    const inner = surface
      .findAllByType('View' as never)
      .find(v => flat(v.props.style).overflow === 'hidden');
    const s = flat(inner?.props.style);
    expect(s.borderWidth).toBe(1);
    expect(s.borderColor).toBe('transparent');
    expect(s.padding).toBe(spacing.xl);
    expect(s.borderRadius).toBe(radius.xl);
    root.unmount();
  });

  it('reaksjonspillens vask er den vakten regner med', async () => {
    const root = await render(melding);
    const pills = root.root
      .findAllByType('View' as never)
      .filter(
        v =>
          flat(v.props.style).backgroundColor ===
          `rgba(17, 36, 27, ${PILL_WASH.alpha})`,
      );
    expect(pills).toHaveLength(2);
    expect(rgb(PILL_WASH.color)).toEqual([17, 36, 27]);
    root.unmount();
  });

  it('trykkbart kort: Pressable ytterst, opalen inni, heiaSoft ved trykk', async () => {
    const root = await render(melding, {}, () => {});
    const pressable = root.root.findAllByType('View' as never)[0];
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(1);
    root.unmount();
  });

  it('Android-vakt: boxShadow på ytterboksen, aldri elevation/shadow*', async () => {
    const root = await render(melding);
    const outer = root.root
      .findByType(OpalSurface)
      .findAllByType('View' as never)[0];
    const s = flat(outer.props.style);
    expect(Array.isArray(s.boxShadow)).toBe(true);
    expect(s.elevation).toBeUndefined();
    expect(s.shadowColor).toBeUndefined();
    expect(s.shadowOpacity).toBeUndefined();
    expect(s.overflow).toBeUndefined();
    root.unmount();
  });
});

// ---------------------------------------------------------------------------
// Systembryterne
// ---------------------------------------------------------------------------
describe('Reduce Transparency og Increase Contrast', () => {
  it('standard: base ved kantopasiteten, kantpar lys øverst → blekk nederst', async () => {
    const root = await render(melding);
    expect(baseRect(root)?.props.fillOpacity).toBe(OPAL.baseEdgeOpacity);
    expect(rimStops(root)).toEqual([
      [OPAL.edgeColor, OPAL.edgeTop],
      [OPAL.edgeColor, OPAL.edgeMid],
      [OPAL.edgeShadeColor, 0],
      [OPAL.edgeShadeColor, OPAL.edgeShade],
    ]);
    expect(OPAL.edgeShade).toBeGreaterThan(0);
    expect(OPAL.edgeShade).toBeLessThanOrEqual(0.2);
    expect(highlightStops(root)).toContain(OPAL.highlight);
    root.unmount();
  });

  it('Reduce Transparency: solid base og solid krembunn', async () => {
    const root = await render(melding, {rt: true});
    expect(baseRect(root)?.props.fillOpacity).toBe(1);
    const outer = root.root
      .findByType(OpalSurface)
      .findAllByType('View' as never)[0];
    expect(flat(outer.props.style).backgroundColor).toBe(OPAL.solid);
    root.unmount();
  });

  it('Increase Contrast: uniform blekk-hårlinje, høylys av, reflekser halvert', async () => {
    const root = await render(melding, {ic: true});
    expect(rimStops(root)).toEqual([
      [OPAL.edgeContrastColor, OPAL.edgeContrast],
      [OPAL.edgeContrastColor, OPAL.edgeContrast],
      [OPAL.edgeContrastColor, OPAL.edgeContrast],
      [OPAL.edgeContrastColor, OPAL.edgeContrast],
    ]);
    expect(highlightStops(root)).toEqual([0, 0, 0]);
    const sheen = root.root
      .findAllByType(Stop)
      .find(s => s.props.stopOpacity === OPAL.sheen / 2);
    expect(sheen).toBeDefined();
    root.unmount();
  });
});
