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
 *   2. Bryteren bytter ikke-festede kort til `card`-glass; festede VIKTIG-
 *      kort går i `important`-varianten (varm perle, PINNED_GLASS_AB) og
 *      faller uten glass til én SOLID varm perle — aldri tilbake til det
 *      mettede cardSun-papiret. Padding-boksen er identisk med `styles.card`.
 *   3. Systembryterne: Reduce Transparency → solid base + solid bunn,
 *      Increase Contrast → blekk-hårlinje i stedet for lys, høylys av.
 *      Android: `boxShadow`, aldri `elevation`/`shadow*` (blør gjennom).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, StyleSheet, type ViewStyle} from 'react-native';
import {LinearGradient, Rect, Stop} from 'react-native-svg';
import {
  FeedCard,
  FEED_OPAL_AB,
  PINNED_GLASS_AB,
  MATCH_GLASS_AB,
  MATCH_INK,
} from '../src/components/FeedCard';
import {OpalSurface, OPAL} from '../src/components/OpalSurface';
import {GLASS} from '../src/components/LiquidGlassSurface';
import {StadiumGlass, GLASS as STADIUM} from '../src/components/StadiumGlass';
import {matchColors} from '../src/theme';
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
const kampMaal = {
  ...melding,
  id: 'p3',
  type: 'match_event',
  content: 'MÅL! 2–1',
  match: {minute: 41, status: 'live', home: 2, away: 1},
  matchEvent: {type: 'mål', teamSide: 'home'},
} as unknown as FeedItem;
const resultat = {
  ...melding,
  id: 'p4',
  type: 'resultat',
  content: 'Seier 2–1',
  match: {status: 'finished', home: 2, away: 1},
} as unknown as FeedItem;
const kamp = (patch: Record<string, unknown>) =>
  ({...kampMaal, ...patch} as unknown as FeedItem);
const allTexts = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root.findAllByType('Text' as never).map(t => t.children.join(''));

type A11y = {rt?: boolean; ic?: boolean};

async function render(
  item: FeedItem,
  a11y: A11y = {},
  onPress?: () => void,
  onOpenMatch?: () => void,
) {
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
        onOpenMatch={onOpenMatch}
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

describe('GLASS-variantene (Brages godkjente tall 2026-09-02)', () => {
  const alpha = (rgba: string) => Number(rgba.match(/,\s*([\d.]+)\)$/)![1]);

  it('control er tynnest, card i midten, important mest solid', () => {
    expect(alpha(GLASS.control.tint)).toBe(0.2);
    expect(alpha(GLASS.card.tint)).toBe(0.34);
    expect(alpha(GLASS.important.tint)).toBe(0.52);
  });

  it('compose-glasset har halv sheen og ingen trykkrespons; kortene har full', () => {
    expect(GLASS.control.sheen).toBe(GLASS.card.sheen / 2);
    expect(GLASS.control.interactive).toBe(false);
    expect(GLASS.card.interactive).toBe(true);
    expect(GLASS.important.interactive).toBe(true);
  });

  it('GLASS har ingen match-variant: kampkortet er mørkt stadionglass, ikke lyst glass', () => {
    expect('match' in GLASS).toBe(false);
    expect(MATCH_GLASS_AB).toBe(true);
    expect(MATCH_INK.text).toBe(matchColors.text);
    expect(MATCH_INK.dim).toBe(matchColors.dim);
    expect(MATCH_INK.accent).toBe(colors.heia);
  });

  it.each(
    Object.entries({
      topp: matchColors.arenaTop,
      midt: matchColors.arenaBottom,
      bunn: matchColors.timeline,
    }),
  )(
    'kampkortets blekk på %s: hovedtekst 7:1, dempet/aksent 4,5:1, også inne i de lyse lagene',
    (_name, surface) => {
      // Reaksjonspill (hvit 0,10), rollepill (opalhvit 0,14), kapselramme (hvit 0,06).
      const pill = over('#FFFFFF', 0.1, surface);
      const role = over('#EAFFF6', 0.14, surface);
      const frame = over('#FFFFFF', 0.06, surface);
      expect(ratio(MATCH_INK.text, surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(MATCH_INK.dim, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MATCH_INK.accent, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MATCH_INK.text, pill)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MATCH_INK.text, role)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.stadiumDim, frame)).toBeGreaterThanOrEqual(3);
      // Aldri sort: flaten er dyp grønn.
      expect(luminance(rgb(surface))).toBeGreaterThan(
        luminance(rgb('#0B1912')),
      );
    },
  );

  it('glasset er transparent (basen under 1) med lyset presset inn ved trykk', () => {
    expect(STADIUM.baseOpacity).toBeLessThan(1);
    expect(STADIUM.pressLight).toBeGreaterThan(0);
    expect(STADIUM.pressLight).toBeLessThanOrEqual(0.16);
  });

  it('important-fallbacken er en varm perle, ikke cardSun, og holder blekket 4,5:1', () => {
    expect(GLASS.importantSolid).not.toBe(colors.sun);
    // Varm: rød ≥ grønn ≥ blå, men mindre mettet enn sun (mindre R−B-avstand).
    const [r, g, b] = rgb(GLASS.importantSolid);
    const [sr, , sb] = rgb(colors.sun);
    expect(r).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThanOrEqual(b);
    expect(r - b).toBeLessThan(sr - sb);
    expect(
      ratio(OPAL.inkSecondary, GLASS.importantSolid),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      ratio(OPAL.inkTertiary, GLASS.importantSolid),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('FEED_OPAL_AB bytter kun ikke-festede kort', () => {
  it('bryterne står PÅ i prototypen', () => {
    expect(PINNED_GLASS_AB).toBe(true);
    expect(MATCH_GLASS_AB).toBe(true);
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

  it('festet VIKTIG-kort: important-varianten — uten glass én solid varm perle, opalblekk, aldri cardSun', async () => {
    const root = await render(festet);
    // Ingen SVG-variant for important: fallbacken er en flat View.
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(0);
    const card = root.root.findAllByType('View' as never)[0];
    const style = flat(card.props.style);
    expect(style.backgroundColor).toBe(GLASS.importantSolid);
    expect(style.backgroundColor).not.toBe(colors.sun);
    expect(style.borderColor).toBe(GLASS.importantSolidEdge);
    expect(style.borderWidth).toBe(1);
    expect(style.borderRadius).toBe(radius.xl);
    expect(style.padding).toBe(spacing.xl);
    expect(textsWithColor(root, OPAL.inkSecondary)).toEqual([
      '👏 3 heier',
      '2',
    ]);
    expect(textsWithColor(root, colors.textSecondary)).toEqual([]);
    expect(textsWithColor(root, OPAL.inkAccent)).toEqual(['Trener']);
    root.unmount();
  });

  it('kampkortet: StadiumGlass compact (mørkt), FRA KAMPEN i neon, kapsel i ramme, puls, lyse reaksjonslag, Se kampen ›', async () => {
    const onPress = jest.fn();
    const root = await render(kampMaal, {}, onPress, jest.fn());
    // Materialet: kompakt stadionglass — ikke opal, ikke lyst glass.
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(0);
    const glass = root.root.findAllByType(StadiumGlass);
    expect(glass).toHaveLength(1);
    expect(glass[0].props.compact).toBe(true);
    expect(glass[0].props.pressed).toBe(false);
    expect(flat(glass[0].props.style).padding).toBe(spacing.xl);
    const views = root.root.findAllByType('View' as never);
    expect(views[0].props.accessibilityRole).toBe('button');
    // Flaten åpner SAMTALEN (2026-09-03); kampen ligger bak «Se kampen ›».
    expect(views[0].props.accessibilityLabel).toBe('Åpne kommentarer');

    const texts = allTexts(root);
    expect(texts).toContain('FRA KAMPEN');
    expect(texts).toContain('Se kampen ›');
    expect(texts).toContain('Mål · 41′');
    expect(texts).not.toContain('41′');
    // Blekk: opalhvit hovedtekst, dempet mintgrå sekundær, neon-etikett,
    // coral på live-kapselen. Ingen lys-glass-blekk.
    expect(textsWithColor(root, MATCH_INK.accent)).toEqual(['FRA KAMPEN']);
    expect(textsWithColor(root, '#FF8A8D')).toEqual(['Mål · 41′']);
    expect(textsWithColor(root, MATCH_INK.text).sort()).toEqual(
      ['Jarle Wik', 'Trener', 'MÅL! 2–1', '👏 3 heier', '2'].sort(),
    );
    expect(textsWithColor(root, MATCH_INK.dim).sort()).toEqual(
      ['Akkurat nå', 'Se kampen ›'].sort(),
    );
    for (const ink of [
      OPAL.inkSecondary,
      OPAL.inkTertiary,
      OPAL.inkAccent,
      colors.textSecondary,
      colors.textTertiary,
      colors.heiaDeep,
    ]) {
      expect(textsWithColor(root, ink)).toEqual([]);
    }
    // Reaksjonene er tynne lyse lag, ikke den mørke blekkvasken.
    const pills = views.filter(v =>
      ['Heia', 'Kommenter'].includes(v.props.accessibilityLabel),
    );
    expect(pills).toHaveLength(2);
    for (const p of pills) {
      const st = flat(p.props.style);
      expect(st.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
      expect(st.borderWidth).toBe(1);
    }
    // Kapselen står i en lys ramme; ett live-hendelsespunkt i neon.
    const frame = views.find(
      v => flat(v.props.style).borderColor === 'rgba(234, 255, 246, 0.28)',
    );
    expect(frame).toBeDefined();
    const dots = views.filter(
      v => flat(v.props.style).borderColor === matchColors.text,
    );
    expect(dots).toHaveLength(1);
    expect(flat(dots[0].props.style).backgroundColor).toBe(colors.heia);
    root.unmount();
  });

  it('kapselen: LIVE · 1–0, PAUSE, SLUTT · 1–1, hendelsestype + minutt, mål imot — aldri bare et minutt', async () => {
    const cases: Array<[FeedItem, string[]]> = [
      [
        kamp({type: 'match_start', match: {status: 'live', home: 1, away: 0}}),
        ['Live ·', '1–0'],
      ],
      [
        kamp({
          type: 'match_start',
          match: {status: 'halfTime', home: 1, away: 0},
        }),
        ['Pause'],
      ],
      [
        kamp({
          type: 'match_start',
          match: {status: 'finished', home: 1, away: 0},
        }),
        ['Avspark'],
      ],
      [
        kamp({
          type: 'match_end',
          match: {status: 'finished', home: 1, away: 1},
        }),
        ['Slutt ·', '1–1'],
      ],
      [kamp({matchEvent: {type: 'mål', teamSide: 'away'}}), ['Mål imot · 41′']],
      [
        kamp({
          matchEvent: {type: 'kort'},
          match: {minute: 63, status: 'live', home: 2, away: 1},
        }),
        ['Kort · 63′'],
      ],
      [
        kamp({
          matchEvent: {type: 'bytte'},
          match: {minute: 70, status: 'live', home: 2, away: 1},
        }),
        ['Bytte · 70′'],
      ],
      [
        kamp({
          matchEvent: undefined,
          match: {minute: 0, status: 'live', home: 0, away: 0},
        }),
        ['Kamp · 0′'],
      ],
      [kamp({matchEvent: {type: 'pause'}}), ['Pause']],
    ];
    for (const [item, expected] of cases) {
      const root = await render(item);
      const texts = allTexts(root);
      for (const e of expected) expect(texts).toContain(e);
      expect(texts.some(x => /^\d+′$/.test(x))).toBe(false);
      expect(texts).toContain('FRA KAMPEN');
      root.unmount();
    }
  });

  it('vanlig melding er urørt av kampkortet', async () => {
    const root = await render(melding);
    const texts = allTexts(root);
    expect(texts).not.toContain('FRA KAMPEN');
    expect(texts).not.toContain('Se kampen ›');
    expect(root.root.findAllByType(OpalSurface)).toHaveLength(1);
    root.unmount();
  });

  it('manuelt resultat beholder card (OpalSurface); festet kamp vinner important', async () => {
    const res = await render(resultat);
    expect(res.root.findAllByType(OpalSurface)).toHaveLength(1);
    expect(allTexts(res)).toContain('Resultat');
    expect(allTexts(res)).not.toContain('FRA KAMPEN');
    res.unmount();
    const festetKamp = await render({...kampMaal, isPinned: true} as FeedItem);
    expect(festetKamp.root.findAllByType(OpalSurface)).toHaveLength(0);
    const card = festetKamp.root.findAllByType('View' as never)[0];
    expect(flat(card.props.style).backgroundColor).toBe(GLASS.importantSolid);
    festetKamp.unmount();
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

/**
 * KAMPKORTET I FEEDEN: samtale på flaten, kampen bak «Se kampen ›»
 * (Brage 2026-09-03). Feedinnlegg åpner kommentarene — også automatiske
 * kampinnlegg — mens den eksplisitte kampkontrollen er den ENESTE veien til
 * kampen. Inne i kommentararket (`variant="thread"`) finnes ingen Kommenter,
 * kortet er ikke trykkbart, og HEIA + «Se kampen ›» virker fortsatt.
 */
describe('kampkortet: flaten = kommentarer, «Se kampen ›» = kampen', () => {
  async function mount(props: Partial<React.ComponentProps<typeof FeedCard>>) {
    let root!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      root = ReactTestRenderer.create(<FeedCard item={kampMaal} {...props} />);
    });
    await act(async () => {});
    return root;
  }
  const pressable = (
    root: ReactTestRenderer.ReactTestRenderer,
    label: string,
  ) =>
    // Ytterste node med label + onPress = Pressable-elementet (memo-
    // wrapperen og den indre funksjonen deler props; deep:false gir én).
    root.root.findAll(
      n =>
        n.props?.accessibilityLabel === label &&
        typeof n.props?.onPress === 'function',
      {deep: false},
    );

  it('1. kortflaten åpner kommentarer', async () => {
    const onPress = jest.fn();
    const onOpenMatch = jest.fn();
    const root = await mount({onPress, onOpenMatch, onComment: jest.fn()});
    const card = pressable(root, 'Åpne kommentarer');
    expect(card).toHaveLength(1);
    act(() => card[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onOpenMatch).not.toHaveBeenCalled();
    expect(pressable(root, 'Åpne kampen')).toHaveLength(0);
    root.unmount();
  });

  it('2. «Kommenter» åpner kommentarer', async () => {
    const onComment = jest.fn();
    const onOpenMatch = jest.fn();
    const root = await mount({onPress: jest.fn(), onComment, onOpenMatch});
    const pill = pressable(root, 'Kommenter');
    expect(pill).toHaveLength(1);
    act(() => pill[0].props.onPress());
    expect(onComment).toHaveBeenCalledTimes(1);
    expect(onOpenMatch).not.toHaveBeenCalled();
    root.unmount();
  });

  it('3. «Se kampen» åpner BARE kampen — egen Pressable med ≥ 44 pt flate', async () => {
    const onPress = jest.fn();
    const onComment = jest.fn();
    const onOpenMatch = jest.fn();
    const root = await mount({onPress, onComment, onOpenMatch});
    const link = pressable(root, 'Se kampen');
    expect(link).toHaveLength(1);
    act(() => link[0].props.onPress());
    expect(onOpenMatch).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(onComment).not.toHaveBeenCalled();
    // Trykkflaten: minst 44 × 44 (boks + hitSlop), raden vokser ikke.
    const box = flat(link[0].props.style({pressed: false}));
    const slop = link[0].props.hitSlop;
    expect(
      (box.minWidth as number) + slop.left + slop.right,
    ).toBeGreaterThanOrEqual(44);
    expect(
      (box.minHeight as number) + slop.top + slop.bottom,
    ).toBeGreaterThanOrEqual(44);
    expect(allTexts(root)).toContain('Se kampen ›');
    // Uten onOpenMatch finnes lenken ikke — ingen død tekst.
    const bare = await mount({onPress: jest.fn(), onComment: jest.fn()});
    expect(allTexts(bare)).not.toContain('Se kampen ›');
    bare.unmount();
    root.unmount();
  });

  it('4. trådvarianten rendrer ingen «Kommenter»', async () => {
    const root = await mount({
      variant: 'thread',
      onHeia: jest.fn(),
      onMore: jest.fn(),
      onOpenMatch: jest.fn(),
    });
    expect(pressable(root, 'Kommenter')).toHaveLength(0);
    expect(allTexts(root)).not.toContain('Kommenter');
    // Konteksten er der: forfatter, FRA KAMPEN, hendelsen, ⋯.
    for (const t of ['Jarle Wik', 'FRA KAMPEN', 'MÅL! 2–1', 'Mål · 41′'])
      expect(allTexts(root)).toContain(t);
    expect(pressable(root, 'Flere valg')).toHaveLength(1);
    root.unmount();
  });

  it('5. originalkortet inne i arket er ikke trykkbart', async () => {
    const root = await mount({
      variant: 'thread',
      onHeia: jest.fn(),
      onOpenMatch: jest.fn(),
    });
    expect(pressable(root, 'Åpne kommentarer')).toHaveLength(0);
    expect(pressable(root, 'Åpne kampen')).toHaveLength(0);
    const views = root.root.findAllByType('View' as never);
    expect(views[0].props.accessibilityRole).toBeUndefined();
    expect(views[0].props.onClick).toBeUndefined();
    root.unmount();
  });

  it('6. HEIA og «Se kampen» fungerer fortsatt inne i arket', async () => {
    const onHeia = jest.fn();
    const onOpenMatch = jest.fn();
    const root = await mount({variant: 'thread', onHeia, onOpenMatch});
    const heia = pressable(root, 'Heia');
    expect(heia).toHaveLength(1);
    act(() => heia[0].props.onPress());
    expect(onHeia).toHaveBeenCalledTimes(1);
    const link = pressable(root, 'Se kampen');
    expect(link).toHaveLength(1);
    act(() => link[0].props.onPress());
    expect(onOpenMatch).toHaveBeenCalledTimes(1);
    root.unmount();
  });
});
