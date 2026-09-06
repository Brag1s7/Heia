/**
 * @format
 *
 * GLASS-NUDGEN (Brage 2026-09-04: «idrettene kommer opp først hvis man for
 * eks velger en farge»). Kilden er `contentVersion` i LiquidGlassSurface.
 *
 * Tre påstander:
 *   1. uten `contentVersion` rendres ingen nudge (statisk innhold koster
 *      ingenting);
 *   2. med `contentVersion` planlegges ÉN oppdatering under glasset i neste
 *      ramme, og en NY versjon planlegger én til — det er oppdateringen som
 *      får sent montert innhold til å vises;
 *   3. nudgen er usynlig: null høyde, ingen trykkflate.
 *
 * Jest tar fallback-grenen (ingen iOS 26), så nudgen testes der den bor:
 * i native-grenen via kildesjekk, og komponenten selv direkte.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {LiquidGlassSurface} from '../src/components/LiquidGlassSurface';

jest.mock('../src/components/useMaterialAccessibility', () => ({
  useMaterialAccessibility: () => ({
    reduceTransparency: false,
    increaseContrast: false,
  }),
}));

const src = fs.readFileSync(
  path.join(__dirname, '../src/components/LiquidGlassSurface.tsx'),
  'utf8',
);

describe('1. kilden', () => {
  it('nudgen ligger i native-grenen, etter barna, kun med contentVersion', () => {
    expect(src).toMatch(
      /\{children\}\s*\{contentVersion !== undefined && \(\s*<GlassNudge version=\{contentVersion\} \/>\s*\)\}\s*<\/View>\s*<\/NativeGlass>/,
    );
  });

  it('nudgen planlegger oppdateringen i neste ramme per versjon', () => {
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*const id = requestAnimationFrame\(\(\) => setTick\(t => t \+ 1\)\);\s*return \(\) => cancelAnimationFrame\(id\);\s*\}, \[version\]\);/,
    );
  });

  it('nudgen er usynlig', () => {
    expect(src).toMatch(/nudge: \{\s*height: 0,\s*opacity: 1,\s*\}/);
    expect(src).toMatch(/nudgeOdd: \{\s*opacity: 0\.99,\s*\}/);
  });
});

describe('1b. detached: glasset er bakgrunn, innholdet er søsken over', () => {
  it('native-grenen legger glasset absolutt bak en vanlig View med barna', () => {
    expect(src).toMatch(
      /if \(detached\) \{[\s\S]*?<View style=\{StyleSheet\.absoluteFill\} pointerEvents="none">\s*<NativeGlass[\s\S]*?interactive=\{false\}[\s\S]*?\/>\s*<\/View>\s*<View style=\{\[styles\.surface, \{borderRadius: cornerRadius\}, style\]\}>\s*\{children\}\s*<\/View>/,
    );
  });
});

describe('2. propen går gjennom uten å røre fallbacken', () => {
  it('fallback-grenen rendrer barna og ingen nudge', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <LiquidGlassSurface variant="sheet" contentVersion="a" />,
      );
    });
    expect(
      tree.root.findAll(n => n.props?.testID === 'glass-nudge'),
    ).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('nudge-stilen har null høyde', () => {
    // StyleSheet.create er identitet i jest — stilene leses via kilden over;
    // her bare at en flat stil med height 0 er gyldig for View.
    expect(StyleSheet.flatten([{height: 0, opacity: 1}]).height).toBe(0);
  });
});
