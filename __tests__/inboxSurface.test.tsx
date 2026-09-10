/**
 * @format
 *
 * VARSLER-FLATEN MÅ VÆRE STABIL UNDER SCROLL (Brage 2026-09-04, kritisk
 * telefonfunn: «glassflaten på Varsler forsvinner under scroll»).
 *
 * ROTÅRSAKEN: både `UIGlassEffect` og `OpalSurface` er TEKSTURBASERTE
 * materialer — de rasteres i flatens fulle størrelse. Varsler-lista har
 * ingen øvre høyde («Tidligere» vokser med pagineringen), så en glassflate
 * som følger lista faller ut.
 *
 * To løsninger finnes, og propen `unbounded` er den ene (tint + kanter, uten
 * tekstur). Runde 5 (Brage: «mer glass look på boksene her») valgte den
 * andre for Varsler: ETT fast ark, låst til én skjerm, med lista rullende
 * inni. Propen består for flater som må følge innholdet.
 *
 * Fire påstander:
 *   1. `unbounded` tegner INGEN teksturbasert flate — ingen svg, ingen
 *      native backdrop — bare tint og kanter;
 *   2. den er fortsatt GLASS: tinten er gjennomskinnelig;
 *   3. Reduce Transparency går til den solide perlen, som ellers i familien;
 *   4. InboxScreen har NØYAKTIG ÉN glassflate, og den er låst til skjermen
 *      (`fill` i en fast ramme) — aldri en glassflate som vokser med lista,
 *      og aldri `unbounded` (det var runde 4s flate tint uten glass).
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import Svg from 'react-native-svg';
import {GLASS, LiquidGlassSurface} from '../src/components/LiquidGlassSurface';
import {MAX_SHEET_ROWS} from '../src/screens/InboxScreen';

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

describe('4. InboxScreen: rullende ark, ekte glass, aldri høyere enn skjermen', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/screens/InboxScreen.tsx'),
    'utf8',
  );

  it('hver arkflate er ekte sheet-glass — aldri unbounded, aldri fast fill', () => {
    // Kildesjekk med vilje: dette er regresjonen i begge retninger. Runde 4
    // (flat tint) leste ikke som glass; runde 6 (fast ark bak lista) la
    // oppfrisk-spinneren på en hvit flate og tok bort scrollingen. Ingen
    // render-test ser noen av delene (jest har ikke noe backdrop).
    const tags = src.match(/<LiquidGlassSurface[^>]*\/?>/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(4);
    for (const tag of tags) {
      expect(tag).toContain('variant="sheet"');
      expect(tag).not.toContain('unbounded');
      expect(tag).not.toMatch(/\bfill\b/);
    }
    expect(src).not.toContain('styles.pane');
  });

  it('kjedene deles i biter under én skjerm (MAX_SHEET_ROWS)', () => {
    expect(MAX_SHEET_ROWS * 60).toBeLessThan(852);
    expect(src).toMatch(/if \(run\.length >= MAX_SHEET_ROWS\) flushRun\(\);/);
  });

  it('lista ligger rett i kroppen — spinneren står på grunnen', () => {
    const chrome = src.indexOf('<InboxChrome');
    // JSX-ELEMENTET, ikke en typeannotasjon: `useRef<FlatList>` inneholder
    // samme tegnfølge og lå tidligere i fila enn chromen (2026-09-10).
    const list = src.search(/\n\s*<FlatList/);
    const glass = src.indexOf('<LiquidGlassSurface', chrome);
    expect(chrome).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(chrome);
    // Ingen glassflate mellom chromen og FlatList-en i kilden.
    expect(glass === -1 || glass > list).toBe(true);
  });
});
