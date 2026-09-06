/**
 * @format
 *
 * FEEDGLASS V5 — ARENAGLASS, LYS (Brage 2026-09-04). Kroppen er systemets
 * Clear-glass med arena-dimming; materialet (fade, skyer, opptak, neon,
 * høylys, kant, skygge) er JS-laget `GlassOptics`; spekularbåndet er
 * native. Jest tar fallback-grenen (ingen iOS 26), så native-grenen
 * sjekkes i kilden — samme mønster som glassNudge.test — og materiallaget
 * rendres direkte.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  ClipPath,
  Ellipse,
  FeGaussianBlur,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  ArenaOptics,
  GLASS_STYLE,
  GlassOptics,
  LiquidGlassSurface,
  SilverOptics,
  FrostEdges,
} from '../src/components/LiquidGlassSurface';
import {
  BACKDROP_SOURCE_ID,
  FEED_EDGES,
  FEED_FROST,
  FEED_MATERIAL,
  FEED_OPTICS_EDGES,
  FEED_REFRACTION,
  FEED_SHADOW,
  SILVER,
} from '../src/shared/glassOptics';

jest.mock('../src/components/useMaterialAccessibility', () => ({
  useMaterialAccessibility: () => ({
    reduceTransparency: false,
    increaseContrast: false,
  }),
}));

const read = (p: string) =>
  fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const glassSrc = read('src/components/LiquidGlassSurface.tsx');
const feedSrc = read('src/components/FeedCard.tsx');
const threadSrc = read('src/components/CommentThread.tsx');
const groundSrc = read('src/components/DaylightGround.tsx');
const nativeSrc = read('ios/Heia2/HeiaLiquidGlassView.m');
const nativeHeader = read('ios/Heia2/HeiaLiquidGlassView.h');
const managerSrc = read('ios/Heia2/HeiaLiquidGlassViewManager.m');

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

describe('0. A/B-bryteren (Brage 2026-09-06): GlassOptics tegner kandidaten bryteren peker på', () => {
  it('sølv → SilverOptics; arena → ArenaOptics (dagens kort, urørt)', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<GlassOptics cornerRadius={24} />);
    });
    const silver = tree.root.findAllByType(SilverOptics).length;
    const arena = tree.root.findAllByType(ArenaOptics).length;
    expect([silver, arena]).toEqual(
      FEED_MATERIAL === 'silver'
        ? [1, 0]
        : FEED_MATERIAL === 'arena'
        ? [0, 1]
        : [0, 0],
    );
    // FROST (prototypen, vedtatt 2026-09-06): materiallaget er KUN kanten.
    expect(tree.root.findAllByType(FrostEdges)).toHaveLength(
      FEED_MATERIAL === 'frost' ? 1 : 0,
    );
    act(() => tree.unmount());
  });
});

describe('1. kantfysikken slik den tegnes (arenaglasset, V5)', () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  beforeAll(() => {
    act(() => {
      tree = ReactTestRenderer.create(<ArenaOptics cornerRadius={24} />);
    });
  });
  afterAll(() => act(() => tree.unmount()));

  it('er atmosfære, ikke innhold: ingen trykk, skjult for skjermleser, fyller flaten', () => {
    const wrap = tree.root.findByProps({testID: 'glass-optics'});
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.accessibilityElementsHidden).toBe(true);
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('materialet: to teksturer med eget utsnitt, klippet til radiusen', () => {
    const wrap = tree.root.findByProps({testID: 'glass-optics'});
    const flat = StyleSheet.flatten(wrap.props.style);
    expect(flat.overflow).toBe('hidden');
    expect(flat.borderRadius).toBe(24);
    const lightTex = tree.root.findByProps({testID: 'frost-light'});
    const darkTex = tree.root.findByProps({testID: 'frost-dark'});
    expect(StyleSheet.flatten(lightTex.props.style).opacity).toBe(
      FEED_FROST.light,
    );
    expect(StyleSheet.flatten(darkTex.props.style).opacity).toBe(
      FEED_FROST.dark,
    );
    expect(StyleSheet.flatten(lightTex.props.style).width).toBe(
      `${Math.round(FEED_FROST.scale * 100)}%`,
    );
    expect(lightTex.props.resizeMode).toBe('cover');
  });

  it('fade, opptak, neon-refleks og høylyslinje som fyll; kantene som strøk', () => {
    const fills = tree.root
      .findAllByType(Rect)
      .filter(r => r.props.fill && r.props.fill !== 'none')
      .map(r => r.props.fill);
    expect(fills).toEqual([
      'url(#goFade)',
      'url(#goUptake)',
      'url(#goNeon)',
      'url(#goHighlight)',
    ]);
    // Høylyslinjen: kantbredden under kanten, tyngdepunkt venstre (0,32).
    const highlight = tree.root
      .findAllByType(Rect)
      .find(r => r.props.fill === 'url(#goHighlight)')!;
    expect(highlight.props.y).toBe(FEED_EDGES.light.width);
    expect(highlight.props.height).toBe(FEED_EDGES.light.width);
    expect(tree.root.findAllByType(RadialGradient)).toHaveLength(2);
    const clip = tree.root.findByType(ClipPath);
    expect(clip.findByType(Rect).props).toEqual(
      expect.objectContaining({rx: 24, ry: 24}),
    );
    const strokes = tree.root
      .findAllByType(Rect)
      .filter(r => r.props.stroke)
      .map(r => [r.props.stroke, r.props.strokeWidth, r.props.x, r.props.rx]);
    expect(strokes).toEqual([
      ['url(#goEdgeDark)', FEED_EDGES.dark.width * 2, '0', 24],
      ['url(#goEdgeLight)', FEED_EDGES.light.width * 2, '0', 24],
      [
        'url(#goGlint)',
        FEED_EDGES.glint.width,
        FEED_EDGES.glint.inset,
        24 - FEED_EDGES.glint.inset,
      ],
    ]);
  });

  it('kantlyset fra øvre venstre, den mørke kanten fra nedre høyre, høylyset bare i hjørnet', () => {
    const byId = (id: string) =>
      tree.root.findAllByType(LinearGradient).find(g => g.props.id === id)!;
    expect(byId('goEdgeLight').props).toEqual(
      expect.objectContaining({x1: '0%', y1: '0%', x2: '100%', y2: '100%'}),
    );
    expect(byId('goEdgeDark').props).toEqual(
      expect.objectContaining({x1: '100%', y1: '100%', x2: '0%', y2: '0%'}),
    );
    expect(byId('goGlint').props).toEqual(
      expect.objectContaining({
        x2: pct(FEED_EDGES.glint.reach),
        y2: pct(FEED_EDGES.glint.reach),
      }),
    );
  });
});

describe('1b. sølvglasset slik det tegnes (kandidaten, Brage 2026-09-06)', () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  beforeAll(() => {
    act(() => {
      tree = ReactTestRenderer.create(
        <SilverOptics cornerRadius={24} size={{width: 361, height: 200}} />,
      );
    });
  });
  afterAll(() => act(() => tree.unmount()));

  it('er atmosfære, ikke innhold: ingen trykk, skjult for skjermleser, klippet til radiusen', () => {
    const wrap = tree.root.findByProps({testID: 'glass-optics'});
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.accessibilityElementsHidden).toBe(true);
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
    const flat = StyleSheet.flatten(wrap.props.style);
    expect(flat.overflow).toBe('hidden');
    expect(flat.borderRadius).toBe(24);
  });

  it('kroppen er tett sølvhvit; dybde, Heia-lys og frost er ellipser i pikselrom under Gauss-blur', () => {
    const base = tree.root.findByProps({testID: 'silver-base'});
    expect(base.props.fill).toBe(SILVER.pearl);
    expect(base.props.fillOpacity).toBe(SILVER.base);
    expect(base.props.width).toBe(361);
    const depth = tree.root.findByProps({testID: 'silver-depth'});
    expect(depth.props.filter).toBe('url(#svDepth)');
    expect(depth.findAllByType(Ellipse)).toHaveLength(SILVER.depth.length);
    const heia = tree.root.findByProps({testID: 'silver-heia'});
    expect(heia.findAllByType(Ellipse)).toHaveLength(SILVER.heia.length);
    const frost = tree.root.findByProps({testID: 'silver-frost'});
    expect(frost.props.filter).toBe('url(#svFrost)');
    expect(frost.findAllByType(Ellipse)).toHaveLength(SILVER.frost.length);
    const blurs = tree.root
      .findAllByType(FeGaussianBlur)
      .map(b => b.props.stdDeviation);
    expect(blurs).toEqual([
      SILVER.blur.depth,
      SILVER.blur.frost,
      SILVER.blur.rim,
      SILVER.blur.shade,
    ]);
    // Ingen strukket 1000-rom: ingenting skalerer med kortets høyde.
    expect(
      tree.root.findAllByProps({preserveAspectRatio: 'none'}),
    ).toHaveLength(0);
    expect(tree.root.findAllByType(RadialGradient)).toHaveLength(0);
  });

  it('silkekartene: 420 pt-fliser (@2x) som stablede, speilvendte kopier — aldri `repeat`, toppen aldri under kortets topp', () => {
    const waves = tree.root.findAllByProps({testID: 'silk-wave'});
    const specs = tree.root.findAllByProps({testID: 'silk-spec'});
    expect(waves.length).toBeGreaterThanOrEqual(1);
    expect(specs.length).toBe(waves.length);
    for (const img of [...waves, ...specs]) {
      expect(img.props.resizeMode).toBe('cover');
      const st = StyleSheet.flatten(img.props.style);
      expect(st.width).toBe(361);
      expect(st.height).toBe(SILVER.silk.tile);
      expect(st.top).toBeLessThan(200);
    }
    const first = StyleSheet.flatten(waves[0].props.style);
    expect(first.top).toBeLessThanOrEqual(0);
    expect(first.top).toBeGreaterThanOrEqual(-SILVER.silk.tile);
    expect(first.opacity).toBe(SILVER.silk.wave);
    expect(StyleSheet.flatten(specs[0].props.style).opacity).toBe(
      SILVER.silk.spec,
    );
    const light = tree.root.findByProps({testID: 'frost-light'});
    expect(StyleSheet.flatten(light.props.style).opacity).toBe(
      SILVER.cloud.light,
    );
  });

  it('gradientene har DIREKTE Stop-barn (simulatorfunn: en hjelpekomponent gir null stopp → svart)', () => {
    for (const g of tree.root.findAllByType(LinearGradient)) {
      const kids = React.Children.toArray(g.props.children).flat();
      expect(kids.length).toBeGreaterThanOrEqual(2);
      for (const k of kids) {
        expect(React.isValidElement(k) && k.type).toBe(Stop);
      }
    }
  });

  it('myk skulder: frostbånd + skygge + grønn glød er uskarpe, ytterkanten er skarp; ingen ramme, ingen rette striper', () => {
    const wrap = tree.root.findByProps({testID: 'glass-optics'});
    const band = wrap.findByProps({testID: 'silver-rim-band'});
    expect(band.props.filter).toBe('url(#svRim)');
    expect(band.props.strokeWidth).toBe(SILVER.rim.band.width * 2);
    expect(wrap.findByProps({testID: 'silver-rim-shade'}).props.filter).toBe(
      'url(#svShade)',
    );
    expect(wrap.findByProps({testID: 'silver-rim-glow'}).props.filter).toBe(
      'url(#svShade)',
    );
    const edge = wrap.findByProps({testID: 'silver-edge'});
    expect(edge.props.filter).toBeUndefined();
    expect(edge.props.strokeWidth).toBe(SILVER.rim.edge.width);
    const highlight = wrap.findByProps({testID: 'silver-highlight'});
    expect(highlight.props.y).toBe(SILVER.highlight.width);
    expect(wrap.findAllByProps({testID: 'silver-band'})).toHaveLength(0);
    expect(wrap.findAllByProps({testID: 'silver-lip'})).toHaveLength(0);
    expect(
      wrap
        .findAllByType(Rect)
        .filter(r =>
          String(r.props.testID ?? '').startsWith('silver-shoulder'),
        ),
    ).toHaveLength(0);
  });

  it('uten målt størrelse tegnes ingenting — onLayout måler kortet først', () => {
    let bare!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      bare = ReactTestRenderer.create(<SilverOptics cornerRadius={24} />);
    });
    const wrap = bare.root.findByProps({testID: 'glass-optics'});
    expect(typeof wrap.props.onLayout).toBe('function');
    expect(bare.root.findAllByType(Rect)).toHaveLength(0);
    act(() => bare.unmount());
  });
});

describe('2. native-grenen (kildesjekk)', () => {
  it('innholdskortene får REGULAR systemglass (frost: perlemint på 0,55 — prototypen, vedtatt 2026-09-06)', () => {
    expect(GLASS_STYLE).toEqual({card: 'regular', important: 'regular'});
    expect(glassSrc).toMatch(
      /glassStyle=\{GLASS_STYLE\[variant\] \?\? 'regular'\}/,
    );
  });

  it('refraksjonen sendes med grunnens id og Brages tall — kun for card/important', () => {
    expect(glassSrc).toMatch(
      /const contentCard = variant === 'card' \|\| variant === 'important';\s*const opticsVariant = optics && contentCard \? variant : undefined;\s*const refractive = refraction && contentCard && FEED_REFRACTION\.enabled;/,
    );
    expect(glassSrc).toMatch(
      /refraction=\{refractive\}\s*backdropSourceID=\{BACKDROP_SOURCE_ID\}\s*refractionStrength=\{FEED_REFRACTION\.strength\}\s*refractionZone=\{FEED_REFRACTION\.zone\}\s*refractionScale=\{FEED_REFRACTION\.scale\}\s*refractionBlur=\{FEED_REFRACTION\.blur\}\s*refractionSaturation=\{FEED_REFRACTION\.saturation\}\s*refractionParallax=\{FEED_REFRACTION\.parallax\}\s*refractionLive=\{FEED_REFRACTION\.live\}\s*frost=\{frosted\}\s*frostLight=\{FEED_FROST\.light\}\s*frostDark=\{FEED_FROST\.dark\}\s*frostTop=\{FEED_FROST\.top\}\s*frostBottom=\{FEED_FROST\.bottom\}\s*frostEdge=\{FEED_FROST\.edge\}\s*frostShadow=\{FEED_FROST\.shadow\}\s*frostScale=\{FEED_FROST\.scale\}\s*specular=\{specular\}\s*pressed=\{pressed\}>/,
    );
    expect(glassSrc).toMatch(
      /const frosted = refraction && contentCard && FEED_FROST\.native;/,
    );
    expect(glassSrc).toMatch(
      /const specular = refraction && contentCard \? FEED_FROST\.specular : 0;/,
    );
    expect(BACKDROP_SOURCE_ID).toBe('daylight-ground');
  });

  it('kantene ligger FØR innerboksen; skyggen: frost i det native laget (cardShadow), ellers på en wrapper — kun med `optics`', () => {
    expect(glassSrc).toMatch(
      /pressed=\{pressed\}>\s*\{\/\*[\s\S]*?\*\/\}\s*\{opticsVariant !== undefined && \(\s*<GlassOptics cornerRadius=\{cornerRadius\} \/>\s*\)\}\s*<View\s+style=\{\[\s*styles\.surface,/,
    );
    expect(glassSrc).toMatch(
      /return opticsVariant !== undefined && FEED_MATERIAL !== 'frost' \? \(\s*<View style=\{\[styles\.opticsShadow, \{borderRadius: cornerRadius\}\]\}>\s*\{node\}\s*<\/View>\s*\) : \(\s*node\s*\);/,
    );
    // FROST: skyggen bor i det native laget så den krymper med trykket
    // (Brage 2026-09-06: «skygge rundt kortet når man trykker»).
    expect(glassSrc).toMatch(
      /cardShadow=\{\s*opticsVariant !== undefined && FEED_MATERIAL === 'frost'\s*\?\s*FEED_SHADOW\.color\s*:\s*undefined\s*\}/,
    );
    expect(nativeHeader).toMatch(/UIColor \*cardShadow;/);
    expect(managerSrc).toMatch(
      /RCT_EXPORT_VIEW_PROPERTY\(cardShadow, UIColor\)/,
    );
    expect(glassSrc).toMatch(
      /opticsShadow: \{\s*boxShadow:\s*FEED_MATERIAL === 'silver' \? \[\.\.\.SILVER\.shadow\] : \[FEED_SHADOW\],\s*\}/,
    );
    expect(FEED_SHADOW.color).toBe('rgba(11, 59, 42, 0.22)');
  });

  it('A2-faden og V2-feltene er borte', () => {
    expect(glassSrc).not.toMatch(/DirectionalFade|GLASS_FADE|FADE_COLOR/);
  });

  it('fallback-grenen tegner verken kant eller refraksjon', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<LiquidGlassSurface optics refraction />);
    });
    expect(
      tree.root.findAll(n => n.props?.testID === 'glass-optics'),
    ).toHaveLength(0);
    act(() => tree.unmount());
  });
});

describe('3. native-viewet (kildesjekk av .h/.m/manager)', () => {
  it('eksporterer alle refraksjonspropene', () => {
    for (const [name, type] of [
      ['glassStyle', 'NSString'],
      ['refraction', 'BOOL'],
      ['backdropSourceID', 'NSString'],
      ['refractionStrength', 'CGFloat'],
      ['refractionZone', 'CGFloat'],
      ['refractionScale', 'CGFloat'],
      ['refractionBlur', 'CGFloat'],
      ['refractionSaturation', 'CGFloat'],
      ['refractionParallax', 'CGFloat'],
      ['refractionLive', 'BOOL'],
      ['frost', 'BOOL'],
      ['frostLight', 'CGFloat'],
      ['frostDark', 'CGFloat'],
      ['frostTop', 'CGFloat'],
      ['frostBottom', 'CGFloat'],
      ['frostEdge', 'CGFloat'],
      ['frostShadow', 'CGFloat'],
      ['frostScale', 'CGFloat'],
      ['specular', 'CGFloat'],
    ]) {
      expect(managerSrc).toContain(
        `RCT_EXPORT_VIEW_PROPERTY(${name}, ${type})`,
      );
      expect(nativeHeader).toMatch(new RegExp(`\\b${name};`));
    }
  });

  it('spekularbåndet: kun en lagposisjon per scroll-hendelse, aldri Core Image', () => {
    const start = nativeSrc.indexOf('- (void)updateSpecular');
    const end = nativeSrc.indexOf('- (void)setSpecular:');
    expect(start).toBeGreaterThan(0);
    const body = nativeSrc.slice(start, end);
    expect(body).toMatch(
      /_specularLayer\.position = CGPointMake\(x, CGRectGetMidY\(b\)\);/,
    );
    expect(body).not.toMatch(
      /CIImage|CIFilter|createCGImage|startTaskToRender/,
    );
    expect(nativeSrc).toMatch(
      /\[self updateSpecular\];\s*if \(!_refraction\) \{\s*return;/,
    );
  });

  it('Clear + arena-dimming, tint nil ved alfa 0, sampler grunnen via nativeId og observerer scrollen', () => {
    expect(nativeSrc).toMatch(/UIGlassEffectStyleClear/);
    expect(nativeSrc).toMatch(/effectWithStyle:style\]/);
    expect(nativeSrc).toMatch(
      /glass\.tintColor = alpha > 0\.005 \? _glassTint : nil;/,
    );
    expect(nativeSrc).toMatch(/@selector\(nativeId\)/);
    expect(nativeSrc).toMatch(
      /drawViewHierarchyInRect:bounds afterScreenUpdates:NO/,
    );
    expect(nativeSrc).toMatch(/forKeyPath:@"contentOffset"/);
    expect(nativeSrc).toMatch(/CIBumpDistortion/);
  });

  it('ytelse: én CIContext, delt frost-tekstur, GPU → IOSurface, aldri blur per ramme', () => {
    // Én Metal-context, opprettet én gang.
    expect(nativeSrc.match(/contextWithMTLDevice:/g)).toHaveLength(1);
    expect(nativeSrc).toMatch(/if \(gContext == nil\)/);
    // Blur og metning bakes i den delte teksturen (frostedBackdropFor), ikke i
    // per-kort-kjeden (updateRefraction).
    const frostStart = nativeSrc.indexOf('+ (CIImage *)frostedBackdropFor:');
    const updateStart = nativeSrc.indexOf('- (void)updateRefraction');
    expect(frostStart).toBeGreaterThan(0);
    expect(updateStart).toBeGreaterThan(frostStart);
    const frostBody = nativeSrc.slice(frostStart, updateStart);
    // Bare selve metoden: HeiaPearlView ligger etter og har sine egne
    // (engangs-) blur/CGImage-kall ved dekoding og kantbilder.
    const updateEnd = nativeSrc.indexOf('#pragma mark - Trykk', updateStart);
    const updateBody = nativeSrc.slice(updateStart, updateEnd);
    expect(frostBody).toMatch(/imageByApplyingGaussianBlurWithSigma:/);
    expect(frostBody).toMatch(/CIColorControls/);
    expect(updateBody).not.toMatch(/imageByApplyingGaussianBlurWithSigma:/);
    expect(updateBody).not.toMatch(/createCGImage/);
    // Aldri snapshot midt i en scroll; gjentaksplan for sen tegning.
    expect(frostBody).toMatch(/if \(!due \|\| !idle\)/);
    expect(nativeSrc).toMatch(/!sv\.isDragging && !sv\.isDecelerating/);
    // GPU-rendering rett i lagets contents.
    expect(updateBody).toMatch(
      /CIRenderDestination alloc\] initWithIOSurface:/,
    );
    expect(updateBody).toMatch(/startTaskToRender:/);
    expect(nativeSrc).toMatch(/_backdropView\.layer\.contents = surface;/);
    // Hopper over kort som ikke har flyttet seg og kort utenfor skjermen.
    expect(updateBody).toMatch(/kMoveEpsilon/);
    expect(updateBody).toMatch(
      /CGRectIntersectsRect\(onScreen, self\.window\.bounds\)/,
    );
    // Intern renderskala 1×.
    expect(nativeSrc).toMatch(/kCaptureScale = 1\.0/);
  });

  it('frosten: delte støyteksturer laget én gang, eget utsnitt per kort, statiske lag over sheen og under trykklyset', () => {
    expect(nativeSrc).toMatch(/CIRandomGenerator/);
    expect(nativeSrc).toMatch(/if \(gCloudWhite != NULL\) \{\s*return;/);
    expect(nativeSrc).toMatch(
      /_cloudLight\.contentsRect = \[self cloudRectWithSalt:1\];/,
    );
    expect(nativeSrc).toMatch(
      /_cloudDark\.contentsRect = \[self cloudRectWithSalt:2\];/,
    );
    expect(nativeSrc).toMatch(/_edgeLight\.mask = _edgeLightMask;/);
    expect(nativeSrc).toMatch(/self\.layer\.shadowPath = shadow;/);
    const sheenAdd = nativeSrc.indexOf(
      '[_effectView.contentView addSubview:_sheenView]',
    );
    const frostAdd = nativeSrc.indexOf(
      '[_effectView.contentView addSubview:_frostView]',
    );
    const lightAdd = nativeSrc.indexOf(
      '[_effectView.contentView addSubview:_lightView]',
    );
    expect(sheenAdd).toBeGreaterThan(0);
    expect(frostAdd).toBeGreaterThan(sheenAdd);
    expect(lightAdd).toBeGreaterThan(frostAdd);
  });

  it('innholdet deformeres aldri: refraksjonen ligger BAK glasset, glasset bak RN-barna', () => {
    expect(nativeSrc).toMatch(
      /\[self sendSubviewToBack:_effectView\];\s*\[self sendSubviewToBack:_backdropView\];/,
    );
    expect(nativeSrc).not.toMatch(/_refractionLayer|_refractionMask|kRimInset/);
  });
});

describe('4. hvem som får hva', () => {
  it('feedkortet: materiallaget (optics) PÅ og refraksjon-propen på begge lyse grener', () => {
    expect(feedSrc).toMatch(
      /variant=\{glassVariant\}\s+pressed=\{pressed\}\s+optics=\{FEED_OPTICS_EDGES\}\s+refraction>/,
    );
    expect(feedSrc).toMatch(
      /variant=\{glassVariant\}\s+optics=\{FEED_OPTICS_EDGES\}\s+refraction>/,
    );
    expect(FEED_OPTICS_EDGES).toBe(true);
    expect(FEED_FROST.native).toBe(false);
  });

  it('tråden: kant på originalinnlegget og skjelettet — ingen refraksjon, aldri dokken', () => {
    expect(threadSrc.match(/styles\.postCard\} optics>/g)).toHaveLength(2);
    expect(threadSrc).not.toMatch(/\brefraction\b/);
    const dock = threadSrc.match(
      /<LiquidGlassSurface\s+cornerRadius=\{0\}[\s\S]*?>/,
    );
    expect(dock).not.toBeNull();
    expect(dock![0]).not.toMatch(/\boptics\b/);
  });

  it('grunnen bærer id-en; kalibreringsstripene er BORTE (Brage: fjern helt)', () => {
    expect(groundSrc).toMatch(/nativeID=\{BACKDROP_SOURCE_ID\}/);
    expect(groundSrc).not.toMatch(/CALIBRATION|CalibrationStripes|<Line\b/);
  });

  it('Brages tall: kantlinse 6–12 pt, soner 30–90, forstørrelse 1,03–1,06, parallakse 0 mens laggen isoleres', () => {
    expect(FEED_REFRACTION.strength).toBeGreaterThanOrEqual(6);
    expect(FEED_REFRACTION.strength).toBeLessThanOrEqual(12);
    expect(FEED_REFRACTION.zone).toBeGreaterThanOrEqual(30);
    expect(FEED_REFRACTION.zone).toBeLessThanOrEqual(90);
    expect(FEED_REFRACTION.scale).toBeGreaterThanOrEqual(1.03);
    expect(FEED_REFRACTION.scale).toBeLessThanOrEqual(1.06);
    expect(FEED_REFRACTION.parallax).toBe(0);
    expect(FEED_REFRACTION.blur).toBeGreaterThan(0);
    // AV: usynlig over den jevne grunnen (0,04 → 3/255), koster GPU per ramme.
    expect(FEED_REFRACTION.enabled).toBe(false);
    expect(FEED_FROST.enabled).toBe(true);
  });
});
