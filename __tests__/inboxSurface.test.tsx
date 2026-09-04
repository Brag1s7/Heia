/**
 * @format
 *
 * VARSLER-FLATEN MÅ VÆRE STABIL UNDER SCROLL (Brage 2026-09-04, kritisk
 * telefonfunn: «glassflaten på Varsler forsvinner under scroll»).
 *
 * ROTÅRSAKEN: både `UIGlassEffect` og `OpalSurface` er TEKSTURBASERTE
 * materialer — de rasteres i flatens fulle størrelse. Varsler-lista er den
 * eneste flaten i Heia som ikke er avgrenset til omtrent én skjerm:
 * `groupByAge` har bare tre bolker, så «Tidligere» samler alt eldre enn i
 * dag og vokser med pagineringen. 50 rader ≈ 3400 pt, 150 rader ≈ 10200 pt —
 * langt over det et backdrop kan komponeres inn i. Da faller effekten ut.
 *
 * Fire påstander:
 *   1. `unbounded` tegner INGEN teksturbasert flate — ingen svg, ingen
 *      native backdrop — bare tint og kanter;
 *   2. den er fortsatt GLASS: tinten er gjennomskinnelig, så grunnen lever
 *      gjennom flaten (ikke en flat hvit bakgrunn, som var det forbudte
 *      symptomfikset);
 *   3. Reduce Transparency går til den solide perlen, som ellers i familien;
 *   4. InboxScreen sender `unbounded` på ALLE arkflatene sine — propen er
 *      ikke pynt, og den skal ikke kunne forsvinne i en senere opprydding.
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import Svg from 'react-native-svg';
import {GLASS, LiquidGlassSurface} from '../src/components/LiquidGlassSurface';

let mockReduceTransparency = false;
jest.mock('../src/components/useMaterialAccessibility', () => ({
  useMaterialAccessibility: () => ({
    reduceTransparency: mockReduceTransparency,
    increaseContrast: false,
  }),
}));

const rgba = (s: string) => {
  const m = s.match(
    /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/,
  );
  return m ? {alpha: m[4] === undefined ? 1 : +m[4]} : {alpha: 1};
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  mockReduceTransparency = false;
});

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <LiquidGlassSurface variant="sheet" unbounded>
        <Text>Lag ber om godkjenning</Text>
      </LiquidGlassSurface>,
    );
  });
  mounted.push(tree);
  return tree;
}

const surface = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n => n.type === 'View' && n.props?.testID === 'glass-unbounded-sheet',
  );

describe('1. ingen teksturbasert flate', () => {
  it('tegner verken svg eller native backdrop — bare en flate med kanter', () => {
    const tree = render();
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    expect(surface(tree)).toBeTruthy();
    // Innholdet ligger fortsatt i flaten.
    expect(
      tree.root.find(n => n.props?.children === 'Lag ber om godkjenning'),
    ).toBeTruthy();
  });

  it('har en lys specular langs overkanten, over barna og uten trykkflate', () => {
    const tree = render();
    const top = tree.root.find(
      n => n.type === 'View' && n.props?.testID === 'glass-unbounded-top',
    );
    const style = StyleSheet.flatten(top.props.style);
    expect(style.height).toBe(1);
    expect(style.top).toBe(0);
    expect(style.backgroundColor).toBe(GLASS.unboundedTop);
    expect(top.props.pointerEvents).toBe('none');
  });
});

describe('2. fortsatt glass, ikke en flat hvit bakgrunn', () => {
  it('bruker arkglassets egen tint, og den er gjennomskinnelig', () => {
    const style = StyleSheet.flatten(surface(render()).props.style);
    expect(style.backgroundColor).toBe(GLASS.sheet.tint);
    expect(rgba(GLASS.sheet.tint).alpha).toBeLessThan(1);
    expect(style.backgroundColor).not.toBe('#FFFFFF');
    expect(style.backgroundColor).not.toBe(GLASS.sheetSolid);
    expect(style.borderColor).toBe(GLASS.unboundedEdge);
  });
});

describe('3. Reduce Transparency', () => {
  it('går til den solide perlen, uten specular', () => {
    mockReduceTransparency = true;
    const tree = render();
    const style = StyleSheet.flatten(surface(tree).props.style);
    expect(style.backgroundColor).toBe(GLASS.sheetSolid);
    expect(style.borderColor).toBe(GLASS.sheetSolidEdge);
    expect(
      tree.root.findAll(
        n => n.type === 'View' && n.props?.testID === 'glass-unbounded-top',
      ),
    ).toHaveLength(0);
  });
});

describe('4. InboxScreen bruker den', () => {
  it('sender `unbounded` på hver eneste arkflate', () => {
    // Kildesjekk med vilje: dette er regresjonen. Fjernes propen, kommer
    // scroll-glitchen tilbake, og det ville ikke vist seg i noen render-test
    // (jest har ingen backdrop å miste).
    const src = fs.readFileSync(
      path.join(__dirname, '../src/screens/InboxScreen.tsx'),
      'utf8',
    );
    const sheets = src.match(/<LiquidGlassSurface variant="sheet"[^>]*/g) ?? [];
    expect(sheets.length).toBeGreaterThanOrEqual(4);
    for (const tag of sheets) {
      expect(tag).toContain('unbounded');
    }
  });
});
