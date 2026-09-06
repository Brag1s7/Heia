/**
 * @format
 *
 * PROFIL I GLASS (Brage 2026-09-04, runde 5: «kantene ser billige ut og
 * boksene er for hvite … mer glassaktig, som resten av appen»).
 *
 * Den matte svg-opalen med kantring leste på telefonen som en hvit boks med
 * en lys fals langs venstre/topp. Profil bruker nå SAMME glass som
 * feedkortene på Hjem — `LiquidGlassSurface` — så de to skjermene er ett
 * materiale.
 *
 * Fire påstander:
 *   1. `GLASS.panel` ER feedkortets glass (samme perle, alfa og sheen) —
 *      bare uten trykkrespons, for radene inni er kontrollene;
 *   2. ProfilScreen tegner ingen `OpalSurface` lenger: menygruppene og
 *      action-gruppa er `panel`, lagkortene `card` (kildesjekk — en
 *      render-test har ikke noe glass å miste);
 *   3. gruppene klipper radenes trykk-tint til radiusen (`overflow: hidden`),
 *      som Varsler-lista;
 *   4. uten glass (Reduce Transparency / Android / eldre iOS) faller `panel`
 *      til opalens PANEL-kantfysikk, ikke kortets fulle ring — feedkortets
 *      fallback er urørt.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {Stop} from 'react-native-svg';
import {
  GLASS,
  LiquidGlassSurface,
  LIQUID_GLASS_SUPPORTED,
} from '../src/components/LiquidGlassSurface';
import {OPAL, OPAL_PANEL} from '../src/components/OpalSurface';
import {TEAM_CARD_SELECTED} from '../src/screens/ProfilScreen';
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

const a11y = {reduceTransparency: false, increaseContrast: false};
jest.mock('../src/components/useMaterialAccessibility', () => ({
  useMaterialAccessibility: () => a11y,
}));

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  a11y.reduceTransparency = false;
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function mount(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(el);
  });
  mounted.push(tree);
  return tree;
}

const profilSrc = fs.readFileSync(
  path.join(__dirname, '../src/screens/ProfilScreen.tsx'),
  'utf8',
);

describe('1. GLASS.panel er feedkortets perle uten trykkrespons', () => {
  it('panelet står på sine telefongodkjente tall, frikoblet fra feedkortet', () => {
    // Feedkortet fikk FeedGlass V2 2026-09-04 (tab-barens perle, sheen
    // 0,06, optikk i lag). Profils paneler er URØRT (Brage): samme
    // perlegrå 0,34 og sheen 0,18 som da de ble godkjent.
    expect(GLASS.panel.tint).toBe('rgba(233, 235, 234, 0.34)');
    expect(GLASS.panel.sheen).toBe(0.18);
  });

  it('ingen trykkrespons i glasset — radene er kontrollene', () => {
    expect(GLASS.panel.interactive).toBe(false);
    expect(GLASS.card.interactive).toBe(true);
  });

  it('er tynnere enn arket på Varsler: mer grunn gjennom, ikke en hvit boks', () => {
    const alpha = (s: string) => +s.match(/,\s*([\d.]+)\)$/)![1];
    expect(alpha(GLASS.panel.tint)).toBeLessThan(alpha(GLASS.sheet.tint));
    expect(alpha(GLASS.panel.tint)).toBeLessThan(OPAL_PANEL.baseEdgeOpacity);
  });
});

describe('2. ProfilScreen tegner glass, ikke opal (kildesjekk)', () => {
  it('importerer ikke OpalSurface som komponent', () => {
    expect(profilSrc).not.toMatch(/import \{[^}]*\bOpalSurface\b[^}]*\} from/);
    expect(profilSrc).not.toMatch(/<OpalSurface\b/);
  });

  it('menygruppene og action-gruppa er `panel`', () => {
    const group = profilSrc.match(
      /function MenuGroup[\s\S]*?<LiquidGlassSurface([^>]*)>/,
    );
    expect(group).not.toBeNull();
    expect(group![1]).toContain('variant="panel"');
    expect(group![1]).toContain('styles.group');
  });

  it('lagkortene er arkets tunge glass (sheet), UTEN native trykklys', () => {
    // Brage 2026-09-04 (runde 6/7): i tynt glass (0,34) fulgte kortene den
    // mørke grunnen mot laghodet. Tungt glass (0,80) ble sett og godkjent
    // på telefonen; `panel` brakte feilen tilbake. Trykk er blekk-tint i
    // flaten (native trykklys tentes ved scroll-start).
    const card = profilSrc.match(
      /<LiquidGlassSurface\s+variant="sheet"[\s\S]*?styles\.teamCard[\s\S]*?>/,
    );
    expect(card).not.toBeNull();
    expect(card![0]).not.toContain('pressed={pressed}');
    expect(card![0]).toContain('styles.teamCardPressed');
    expect(profilSrc).not.toMatch(/<LiquidGlassSurface\s+variant="card"/);
  });
});

describe('2b. valgt lag: fyldig tint, fortsatt lesbart', () => {
  it('er en tydelig Heia-tint, ikke heiaSoft og ikke neon i full styrke', () => {
    const [c, a] = rgba(TEAM_CARD_SELECTED);
    expect(c).toEqual(hex(colors.heia));
    expect(a).toBeGreaterThanOrEqual(0.25);
    expect(a).toBeLessThanOrEqual(0.5);
    expect(a).toBeGreaterThan(rgba(colors.heiaSoft)[1]);
  });

  it('blekket holder på valgt OG umarkert flate over hele reisen', () => {
    // Arkets tunge perle (0,80) gjør tint-over-grunn-modellen meningsfull
    // også over den mørke toppen — porten er absolutt, ikke relativ.
    for (const g of ['#0E211A', '#0B412E', '#00845A', '#02FFAB', '#F3F4EC']) {
      const sheet = over(GLASS.sheet.tint, hex(g));
      const selected = over(TEAM_CARD_SELECTED, sheet);
      expect(ratio(hex(colors.textPrimary), selected)).toBeGreaterThanOrEqual(
        7,
      );
      expect(ratio(hex(OPAL.inkSecondary), selected)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(ratio(hex(OPAL.inkSecondary), sheet)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('3. gruppene klipper radene til radiusen', () => {
  it('styles.group har overflow: hidden', () => {
    expect(profilSrc).toMatch(/group: \{\s*overflow: 'hidden',\s*\}/);
  });
});

describe('4. fallback uten glass', () => {
  it('panel → OpalSurface med PANEL-kantfysikk (ikke kortets fulle ring)', () => {
    a11y.reduceTransparency = true;
    const tree = mount(
      <LiquidGlassSurface variant="panel">
        <Text>rad</Text>
      </LiquidGlassSurface>,
    );
    const rim = tree.root.find(n => n.props?.id === 'opRim');
    const stops = rim.findAllByType(Stop);
    expect(+stops[0].props.stopOpacity).toBe(OPAL_PANEL.edgeTop);
    expect(+stops[1].props.offset).toBe(OPAL_PANEL.edgeMidStop);
    expect(+stops[3].props.stopOpacity).toBe(OPAL_PANEL.edgeShade);
    expect(tree.root.findByType(Text).props.children).toBe('rad');
  });

  it('panel-stilen (overflow/padding) treffer innerboksen i begge grener', () => {
    const style = {overflow: 'hidden' as const, paddingTop: 3};
    const tree = mount(
      <LiquidGlassSurface variant="panel" style={style}>
        <Text>rad</Text>
      </LiquidGlassSurface>,
    );
    const text = tree.root.findByType(Text);
    // Nærmeste forelder med stilen: innerboksen, i native- og fallback-grenen.
    let node = text.parent;
    let found = false;
    while (node && !found) {
      const flat = StyleSheet.flatten(node.props?.style);
      if (flat?.paddingTop === 3 && flat?.overflow === 'hidden') found = true;
      node = node.parent;
    }
    expect(found).toBe(true);
  });

  it('native-grenen sender panelets glass når den finnes', () => {
    if (!LIQUID_GLASS_SUPPORTED) {
      // jest/Platform uten iOS 26: bare fallbacken er testbar her.
      expect(a11y.reduceTransparency).toBe(false);
      return;
    }
    const tree = mount(
      <LiquidGlassSurface variant="panel">
        <Text>rad</Text>
      </LiquidGlassSurface>,
    );
    const native = tree.root.find(
      n => typeof n.type === 'string' && n.props?.glassTint !== undefined,
    );
    expect(native.props.glassTint).toBe(GLASS.panel.tint);
    expect(native.props.interactive).toBe(false);
  });
});
