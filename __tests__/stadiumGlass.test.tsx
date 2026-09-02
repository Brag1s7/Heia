/**
 * @format
 *
 * STADIONGLASSET — materialprototypen for kommende kamp på Hjem (2026-09-02).
 *
 * Tre ting som ellers bare kan gå galt STILLE:
 *   1. Blekket på glasset må måles mot flaten det faktisk står på — inkludert
 *      under lagfargerefleksen (LØFTET farge), aqua-opptaket og neonrefleksen,
 *      ikke bare på ren arenaTop.
 *   2. Bryteren skal bytte KUN kamp-grenen, og lagfargehooken skal ikke
 *      kalles for trening/sosialt (karusell-testen rendrer uten TeamProvider).
 *   3. Systembryterne: Reduce Transparency gjør basen solid, Increase Contrast
 *      gjør kanten uniform, og hooken kaller ALDRI de getterne som henger for
 *      alltid på feil plattform (RN 0.83-bug, se useMaterialAccessibility).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Platform} from 'react-native';
import {LinearGradient, Rect, Stop} from 'react-native-svg';
import {
  NextEventHero,
  NEXT_MATCH_GLASS_AB,
} from '../src/components/NextEventHero';
import {
  StadiumGlass,
  GLASS,
  liftTeamColor,
  teamReflexStrength,
} from '../src/components/StadiumGlass';
import {StadiumSurface} from '../src/components/StadiumSurface';
import {useMaterialAccessibility} from '../src/components/useMaterialAccessibility';
import {arenaLightCap, TEAM_COLORS} from '../src/shared/teamColors';
import {colors, matchColors} from '../src/theme';
import type {HeiaEvent} from '../src/shared/types';

const mockUseActiveTeam = jest.fn(() => ({
  activeTeamSpace: {id: 'ts-1', displayName: 'Ridabu G10', color: '#1D4ED8'},
}));
jest.mock('../src/context', () => ({
  useActiveTeam: () => mockUseActiveTeam(),
}));

// ---------------------------------------------------------------------------
// Kontrast — samme regnestykke som matchContrast.test.
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

const STOPS = {
  topp: matchColors.arenaTop,
  midt: matchColors.arenaBottom,
  bunn: matchColors.timeline,
};

/** Hjørnet: arenaTop med aqua-opptaket oppå — grunnen refleksen står på. */
const CORNER = over(GLASS.uptakeColor, GLASS.uptake, matchColors.arenaTop);

/**
 * Hvor mye av hjørnelysenes toppstyrke som når nærmeste brødtekst. Begge
 * radialene står i hjørnet: refleksen i (10 %, −12 %) med rx 58 % / ry 84 %
 * og dør ut ved 0,62 — dag-etiketten («I morgen») ligger på r ≈ 0,49 →
 * ≤ 0,25 av toppen; opptaket i (0, 0) med rx 56 % / ry 82 % og dør ut ved
 * 0,70 — samme etikett på r ≈ 0,57 → ≤ 0,20. Sted-linja ligger utenfor
 * begge. 0,35 er margin, ikke måling.
 */
const TEXT_ZONE = 0.35;
/** Grunnen under nærmeste brødtekst: arenaTop med opptakets utløper. */
const TEXT_GROUND = over(
  GLASS.uptakeColor,
  GLASS.uptake * TEXT_ZONE,
  matchColors.arenaTop,
);

describe('glassets blekk holder på hele flaten', () => {
  it.each(Object.entries(STOPS))(
    '%s: 7:1 for hovedtekst, 4.5:1 for dempet og for avsparkstiden',
    (_name, surface) => {
      expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(matchColors.dim, surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.heia, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('flaten er dyp grønn, ikke nesten sort — lysere enn StadiumSurface', () => {
    expect(luminance(rgb(matchColors.timeline))).toBeGreaterThan(
      luminance(rgb('#0B1912')),
    );
    expect(luminance(rgb(matchColors.arenaTop))).toBeGreaterThan(
      luminance(rgb(colors.stadium)),
    );
  });

  it('aqua-opptaket alene tar ikke brødteksten under 7:1', () => {
    expect(ratio(matchColors.text, CORNER)).toBeGreaterThanOrEqual(7);
  });

  it.each(TEAM_COLORS.map(c => [c.name, c.value]))(
    'refleksen (%s) er LYS: toppen holder 4.5:1, tekstsonen 7:1',
    (_name, hex) => {
      const lifted = liftTeamColor(hex) as string;
      const strength = teamReflexStrength(hex, false);
      // Refleksen skal tilføre luminans — ellers er den en flekk.
      const peak = over(lifted, strength, CORNER);
      expect(luminance(rgb(peak))).toBeGreaterThan(luminance(rgb(CORNER)));
      // Toppen ligger i hjørnet over pillen: ingen brødtekst, kun pillens
      // 11 px versaler (egen vakt under). 4.5:1 for tekst, 3:1 for neon.
      expect(ratio(matchColors.text, peak)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.heia, peak)).toBeGreaterThanOrEqual(3);
      // Der brødtekst faktisk står: begge hjørnelysene på sonefaktoren.
      const textZone = over(lifted, strength * TEXT_ZONE, TEXT_GROUND);
      expect(ratio(matchColors.text, textZone)).toBeGreaterThanOrEqual(7);
      expect(ratio(matchColors.dim, textZone)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.heia, textZone)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('under neonrefleksen nede til høyre holder hovedteksten 7:1', () => {
    const surface = over(colors.heia, GLASS.neonReflex, matchColors.timeline);
    expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(7);
  });

  it('KAMP-pillen leses også på refleksens topp (verste lag: marineblå)', () => {
    const lifted = liftTeamColor('#12315E') as string;
    const peak = over(lifted, teamReflexStrength('#12315E', false), CORNER);
    const surface = over('#FFFFFF', 0.12, peak);
    // 11 px versal-etikett med sperring: 4.5:1.
    expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('RSVP-fyllet (hvitt) skiller seg fra sporet med 3:1 — ikke-tekst', () => {
    const track = over('#FFFFFF', 0.16, matchColors.timeline);
    const fill = over('#FFFFFF', 0.55, matchColors.timeline);
    expect(ratio(fill, track)).toBeGreaterThanOrEqual(3);
  });
});

describe('liftTeamColor + teamReflexStrength — lys, klemt, aldri gjettet', () => {
  it('løfter alle palettfargene i luminans, og bare mot hvitt', () => {
    for (const {value} of TEAM_COLORS) {
      const lifted = liftTeamColor(value) as string;
      expect(luminance(rgb(lifted))).toBeGreaterThan(luminance(rgb(value)));
      const a = rgb(value);
      const b = rgb(lifted);
      for (let i = 0; i < 3; i++) {
        expect(b[i]).toBe(Math.round(a[i] + (255 - a[i]) * GLASS.teamLift));
      }
    }
  });

  it('ugyldig farge gir null — og ingen refleks', () => {
    expect(liftTeamColor('ikke en farge')).toBeNull();
    expect(liftTeamColor('#FFF')).toBeNull();
    expect(teamReflexStrength(undefined, false)).toBe(0);
    expect(teamReflexStrength('ikke en farge', false)).toBe(0);
  });

  it('taket er Brages maksstyrke, klemmen er arenaens på den LØFTEDE fargen', () => {
    for (const {value} of TEAM_COLORS) {
      const s = teamReflexStrength(value, false);
      expect(s).toBeLessThanOrEqual(GLASS.teamReflex);
      expect(s).toBeLessThanOrEqual(
        arenaLightCap(liftTeamColor(value) as string).peak,
      );
      // Aldri usynlig igjen (Brage): minst 5 % for hele paletten.
      expect(s).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('gult klemmes hardest, marineblått står på taket', () => {
    expect(teamReflexStrength('#FFC53D', false)).toBeLessThan(
      teamReflexStrength('#12315E', false),
    );
    expect(teamReflexStrength('#12315E', false)).toBeCloseTo(
      GLASS.teamReflex,
      5,
    );
  });

  it('Increase Contrast halverer', () => {
    expect(teamReflexStrength('#12315E', true)).toBeCloseTo(
      teamReflexStrength('#12315E', false) / 2,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// Bryteren og grenene
// ---------------------------------------------------------------------------
const base = {
  id: 'ev-1',
  teamSpaceId: 'ts-1',
  startTime: new Date('2026-09-05T18:00:00.000Z'),
  location: 'Black River Park',
  rsvp: {coming: 12, notComing: 2, pending: 4, myStatus: 'pending'},
} as const;
const kamp = {
  ...base,
  type: 'kamp',
  title: 'Kamp mot Storhamar',
  opponent: 'Storhamar',
} as unknown as HeiaEvent;
const trening = {
  ...base,
  type: 'trening',
  title: 'Trening',
} as unknown as HeiaEvent;

async function render(event: HeiaEvent) {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    root = ReactTestRenderer.create(
      <NextEventHero event={event} onPress={() => {}} />,
    );
  });
  return root;
}

const rects = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root.findAllByType(Rect);
const baseRect = (root: ReactTestRenderer.ReactTestRenderer) =>
  rects(root).find(r => r.props.fill === 'url(#sgBase)');
const edgeStops = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root
    .findAllByType(LinearGradient)
    .find(g => g.props.id === 'sgEdge')
    ?.findAllByType(Stop)
    .map(s => s.props.stopOpacity);

describe('NEXT_MATCH_GLASS_AB bytter kun kamp-grenen', () => {
  beforeEach(() => mockUseActiveTeam.mockClear());

  it('bryteren står PÅ i prototypen', () => {
    expect(NEXT_MATCH_GLASS_AB).toBe(true);
  });

  it('kamp → StadiumGlass med lagfargen, ikke StadiumSurface', async () => {
    const root = await render(kamp);
    expect(root.root.findAllByType(StadiumGlass)).toHaveLength(1);
    expect(root.root.findAllByType(StadiumSurface)).toHaveLength(0);
    expect(root.root.findByType(StadiumGlass).props.teamColor).toBe('#1D4ED8');
    expect(mockUseActiveTeam).toHaveBeenCalled();
    // Basen er gjennomskinnelig (0,96) når ingen systembryter står på.
    expect(baseRect(root)?.props.fillOpacity).toBe(GLASS.baseOpacity);
    // Alle lagene tegnes: opptak, LØFTET lagrefleks, neon, høylys, kantlys.
    expect(rects(root).some(r => r.props.fill === 'url(#sgUptake)')).toBe(true);
    expect(rects(root).some(r => r.props.fill === 'url(#sgTeam)')).toBe(true);
    expect(rects(root).some(r => r.props.fill === 'url(#sgNeon)')).toBe(true);
    expect(rects(root).some(r => r.props.fill === 'url(#sgHighlight)')).toBe(
      true,
    );
    const edge = rects(root).find(r => r.props.stroke === 'url(#sgEdge)');
    expect(edge?.props.strokeWidth).toBe(GLASS.edgeWidth * 2);
    expect(edgeStops(root)).toEqual([
      GLASS.edgeTop,
      GLASS.edgeMid,
      GLASS.edgeBottom,
    ]);
    // Refleksen tegnes med den løftede fargen, ikke den rå.
    const teamStop = root.root
      .findAllByType(Stop)
      .find(s => s.props.stopColor === liftTeamColor('#1D4ED8'));
    expect(teamStop?.props.stopOpacity).toBeCloseTo(
      teamReflexStrength('#1D4ED8', false),
      5,
    );
  });

  it('trening → verken glass eller stadion, og konteksten røres ikke', async () => {
    const root = await render(trening);
    expect(root.root.findAllByType(StadiumGlass)).toHaveLength(0);
    expect(root.root.findAllByType(StadiumSurface)).toHaveLength(0);
    expect(mockUseActiveTeam).not.toHaveBeenCalled();
  });

  it('kamp uten lagfarge → glass uten refleks (ingen gjetning)', async () => {
    mockUseActiveTeam.mockReturnValueOnce({
      activeTeamSpace: undefined,
    } as never);
    const root = await render(kamp);
    expect(root.root.findAllByType(StadiumGlass)).toHaveLength(1);
    expect(rects(root).some(r => r.props.fill === 'url(#sgTeam)')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Systembryterne
// ---------------------------------------------------------------------------
describe('compact + pressed (kampkortet deler heroens material-DNA)', () => {
  async function mount(props: {compact?: boolean; pressed?: boolean}) {
    let root!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      root = ReactTestRenderer.create(
        <StadiumGlass {...props}>
          <></>
        </StadiumGlass>,
      );
    });
    await act(async () => {});
    return root;
  }
  const ids = (root: ReactTestRenderer.ReactTestRenderer) =>
    root.root
      .findAllByType(Rect)
      .map(r => r.props.fill ?? r.props.stroke)
      .filter(Boolean);
  const shadowOf = (root: ReactTestRenderer.ReactTestRenderer) => {
    const outer = root.root.findAllByType('View' as never)[0];
    const style = outer.props.style;
    const flatStyle = (
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style
    ) as {
      boxShadow?: Array<{blurRadius: number; color: string}>;
    };
    return flatStyle.boxShadow?.[0];
  };

  it('compact tegner de samme lagene (base, opptak, neon, høylys, kant) — bare skyggen er lettere', async () => {
    const hero = await mount({});
    const compact = await mount({compact: true});
    expect(ids(compact)).toEqual(ids(hero));
    expect(shadowOf(hero)?.blurRadius).toBe(28);
    expect(shadowOf(compact)?.blurRadius).toBe(16);
    expect(shadowOf(compact)?.color).toBe(GLASS.shadowCompact);
    hero.unmount();
    compact.unmount();
  });

  it('pressed legger ett lyst lag inn i glasset; i hvile finnes det ikke', async () => {
    const idle = await mount({compact: true});
    const light = `rgba(255, 255, 255, ${GLASS.pressLight})`;
    const has = (root: ReactTestRenderer.ReactTestRenderer) =>
      root.root.findAllByType('View' as never).some(v => {
        const st = v.props.style;
        const f = Array.isArray(st)
          ? Object.assign({}, ...st.filter(Boolean))
          : st;
        return f?.backgroundColor === light;
      });
    expect(has(idle)).toBe(false);
    idle.unmount();
    const pressed = await mount({compact: true, pressed: true});
    expect(has(pressed)).toBe(true);
    pressed.unmount();
  });
});

describe('useMaterialAccessibility', () => {
  afterEach(() => {
    (AccessibilityInfo.isReduceTransparencyEnabled as jest.Mock).mockClear();
    (AccessibilityInfo.isDarkerSystemColorsEnabled as jest.Mock).mockClear();
    (AccessibilityInfo.isHighTextContrastEnabled as jest.Mock).mockClear();
  });

  it('Reduce Transparency gjør basen solid — flaten slutter å ta opp lys', async () => {
    // Once: getteren er RN-mockens delte jest.fn — en varig mockResolvedValue
    // ville lekket inn i de neste testene.
    (
      AccessibilityInfo.isReduceTransparencyEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
    const root = await render(kamp);
    expect(baseRect(root)?.props.fillOpacity).toBe(1);
  });

  it('Increase Contrast: uniform hvit kant 0,45, reflekser halvert', async () => {
    (
      AccessibilityInfo.isDarkerSystemColorsEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
    const root = await render(kamp);
    expect(edgeStops(root)).toEqual([
      GLASS.edgeContrast,
      GLASS.edgeContrast,
      GLASS.edgeContrast,
    ]);
    const neonStop = root.root
      .findAllByType(Stop)
      .find(s => s.props.stopColor === colors.heia && s.props.stopOpacity > 0);
    expect(neonStop?.props.stopOpacity).toBeCloseTo(GLASS.neonReflex / 2, 5);
  });

  it('på iOS leses RT + darker colors, aldri highTextContrast (henger)', async () => {
    const seen: string[] = [];
    function Probe() {
      const m = useMaterialAccessibility();
      seen.push(`${m.reduceTransparency}/${m.increaseContrast}`);
      return null;
    }
    await act(async () => {
      ReactTestRenderer.create(<Probe />);
    });
    expect(Platform.OS).toBe('ios');
    expect(AccessibilityInfo.isReduceTransparencyEnabled).toHaveBeenCalled();
    expect(AccessibilityInfo.isDarkerSystemColorsEnabled).toHaveBeenCalled();
    expect(AccessibilityInfo.isHighTextContrastEnabled).not.toHaveBeenCalled();
    const events = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls
      .map(c => c[0])
      .filter(name =>
        [
          'reduceTransparencyChanged',
          'darkerSystemColorsChanged',
          'highTextContrastChanged',
        ].includes(name),
      );
    expect(events).toEqual(
      expect.arrayContaining([
        'reduceTransparencyChanged',
        'darkerSystemColorsChanged',
      ]),
    );
    expect(events).not.toContain('highTextContrastChanged');
    expect(seen[seen.length - 1]).toBe('false/false');
  });

  it('på Android leses KUN highTextContrast — de to iOS-getterne henger der', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    function Probe() {
      useMaterialAccessibility();
      return null;
    }
    await act(async () => {
      ReactTestRenderer.create(<Probe />);
    });
    os.restore();
    expect(AccessibilityInfo.isHighTextContrastEnabled).toHaveBeenCalled();
    expect(
      AccessibilityInfo.isReduceTransparencyEnabled,
    ).not.toHaveBeenCalled();
    expect(
      AccessibilityInfo.isDarkerSystemColorsEnabled,
    ).not.toHaveBeenCalled();
  });
});
