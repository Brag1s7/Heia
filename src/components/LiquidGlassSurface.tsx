import React, {useEffect, useState} from 'react';
import {
  Platform,
  StyleSheet,
  View,
  requireNativeComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {radius, shadows} from '../theme';
import {OpalSurface} from './OpalSurface';
import {useMaterialAccessibility} from './useMaterialAccessibility';

/**
 * LIQUID GLASS — isolert iOS-prototype (Brage 2026-09-02): ekte systemblur og
 * refraksjon (`UIGlassEffect`, iOS 26) bak ikke-festede FeedCards. Brage
 * opphevet blur-sperren for AKKURAT denne flaten etter at fire SVG-runder
 * fortsatt leste som en flat, lys flate på telefonen.
 *
 * Native: `ios/Heia2/HeiaLiquidGlassView.{h,m}` + `HeiaLiquidGlassViewManager.m`
 * (legacy view manager gjennom RN 0.83s interop-lag — ingen codegen, ingen
 * ny pakke, ingen pod install). Systemet eier blur, kant og trykkrespons;
 * ett delt sheen-lag glir svakt ved press. Ingen loop.
 *
 * Portene:
 *   • kun iOS ≥ 26 — eldre iOS og Android får dagens `OpalSurface`
 *   • Reduce Transparency → `OpalSurface` (solid, lesbar fallback)
 *   • padding-boksen er identisk med OpalSurface/`styles.card` (1 pt
 *     gjennomsiktig kant + radius xl), så layout og innhold er uendret
 *   • blekket er fortsatt OPAL.ink* i FeedCard (kontrastporten)
 *   • ingen bakgrunn, tokens eller globale flater rørt
 */
export const FEED_LIQUID_GLASS_AB = true;

/**
 * ÉN komponent, tre varianter (Brage 2026-09-02, godkjent): materialvekt
 * koder hierarki (Emil-linsa), tynt glass til kontroller og tykkere glass til
 * større innholdsflater (HIG). Alfa = styrke; fargen er alltid en perle,
 * aldri hvitt fyll og aldri krem.
 *
 *   card       feedkortet (LÅST): nesten fargeløs perlegrå 0,34 — bakgrunnen
 *              eier Heia-minten, glasset låner grønt kun gjennom blur.
 *              Mål ~75 % perle / 25 % grunn. Full sheen, trykkrespons på.
 *   control    compose-boksen: «tynt, lyst og nøytralt kontrollglass» —
 *              nesten hvit 0,20 (~60 % grunn), halv sheen, INGEN trykk-
 *              respons (feltet og kameraknappen er kontrollene).
 *   important  festet VIKTIG-kort: «varmere og mer solid opalglass» — varm
 *              perle (sun-tonen med metningen ned) 0,52 (~85 % perle), full
 *              sheen, trykkrespons på (åpner kommentartråden). Gullpillen
 *              bærer aksenten; INGEN uniform gullkant (leser som annonse/
 *              advarsel — Brage). Ikke mørkt, ikke cardSun-papir.
 */
export type GlassVariant =
  | 'card'
  | 'control'
  | 'important'
  | 'bar'
  | 'barMatch'
  | 'sheet'
  | 'panel';

export const GLASS = {
  card: {tint: 'rgba(233, 235, 234, 0.34)', sheen: 0.18, interactive: true},
  control: {tint: 'rgba(244, 246, 245, 0.2)', sheen: 0.09, interactive: false},
  important: {
    tint: 'rgba(246, 240, 226, 0.52)',
    sheen: 0.18,
    interactive: true,
  },
  /**
   * TAB-BAREN (Brage 2026-09-03, godkjent; sluttrunde: 0,30 → 0,34, samme
   * nøytrale perle): lys perle — tykkere enn
   * kontrollglasset (den bærer tekst nederst over det dype hjørnet), tynnere
   * enn kortet (chrome skal ikke eie minten). Nesten ingen sheen: chrome
   * skinner ikke. Fanene er kontrollene — ingen trykkrespons i glasset.
   */
  bar: {tint: 'rgba(244, 246, 245, 0.34)', sheen: 0.06, interactive: false},
  /**
   * SAMME BAR PÅ KAMPSIDEN: mørkt, transparent stadionglass — arenaBottom
   * som tint (designregelen: mørkt glass kjennetegner kamp). JS-only
   * første forsøk: kun tinten byttes, geometrien er identisk. Blekket i
   * baren er opalhvitt (`matchColors.text`/`dim`) i denne varianten.
   */
  barMatch: {tint: 'rgba(29, 70, 51, 0.62)', sheen: 0.06, interactive: false},
  /**
   * ARKENE (Brage 2026-09-03): månedsvisningen fra «Måned», «Ny hendelse»
   * («+ Ny» på Kalender og «Ny kamp» fra Sesongen). «Ganske tungt glass»:
   * den tyngste perlen i familien, 0,80 — rutenettet og skjemaet skal være
   * ekstremt lesbart, men grunnen skal fortsatt farge flaten (over neon blir
   * arket lys mint, over teal kjølig perle). Lite sheen: et ark skinner
   * ikke. Ingen scrim over siden bak — arket er et parallelt panel, ikke en
   * blokkerende oppgave (Emil: «dim to focus, separate to keep flow»).
   * Blekket på arket er OPAL.ink* (kontrastporten i glassSheet.test).
   */
  sheet: {tint: 'rgba(244, 246, 245, 0.8)', sheen: 0.1, interactive: false},
  /**
   * PROFILS GRUPPER (Brage 2026-09-04: «kantene ser billige ut og boksene er
   * for hvite … mer glassaktig, som resten av appen»): lagkortene,
   * action-gruppa og menygruppene er SAMME glass som feedkortet — samme
   * perle, samme alfa, samme sheen — så Profil og Hjem er ett materiale.
   * Eneste forskjell: INGEN trykkrespons i glasset, for radene inni er
   * kontrollene (samme grunn som `sheet` på Varsler). Lagkortene, som
   * trykkes som én flate, bruker `card` direkte. Den matte svg-opalen med
   * kantring (`OpalSurface panel`) er nå bare fallbacken uten glass.
   */
  panel: {tint: 'rgba(233, 235, 234, 0.34)', sheen: 0.18, interactive: false},
  /**
   * Solid varm perle for `important` uten glass (Android / Reduce
   * Transparency / eldre iOS): tinten over lysfelt-grunnen regnet ut til én
   * flat farge, så materialretningen beholdes — IKKE det mettede
   * `colors.sun`-papiret. Kanten er goldInk-blekk, svakt.
   */
  importantSolid: '#F4F1E6',
  importantSolidEdge: 'rgba(92, 74, 0, 0.14)',
  /** Solid perle for baren uten glass (= OPAL.solid) + svak heiaDeep-kant. */
  barSolid: '#EFF3F1',
  barSolidEdge: 'rgba(8, 57, 46, 0.1)',
  /** Solid arena for kampbaren uten glass + svak opalhvit kant. */
  barMatchSolid: '#1D4633',
  barMatchSolidEdge: 'rgba(234, 255, 246, 0.16)',
  /** Solid perle for arkene uten glass (= OPAL.solid) + svak heiaDeep-kant. */
  sheetSolid: '#EFF3F1',
  sheetSolidEdge: 'rgba(8, 57, 46, 0.12)',
  /**
   * KANTEN PÅ DEN SCROLL-TRYGGE FLATEN (`unbounded`): en lys hårlinje som
   * leser som materialets kant, ikke som en ramme, pluss en litt lysere
   * strek langs toppen — lyset som treffer flaten der den begynner.
   * Erstatter den optiske kanten UIGlassEffect ellers tegner selv.
   */
  unboundedEdge: 'rgba(255, 255, 255, 0.38)',
  unboundedTop: 'rgba(255, 255, 255, 0.55)',
} as const;

/**
 * FELTFLATEN PÅ GLASS (Brage 2026-09-03, «Ny hendelse»; delt fra 2026-09-04
 * med Profils undersider): et tekstfelt på et glasspanel er lyst og
 * halvgjennomsiktig med en svak blekk-kant — ikke en hvit boks. Voktet i
 * `__tests__/glassSheet.test.tsx` via `NewEventScreen.FIELD`.
 */
export const GLASS_FIELD = {
  fill: 'rgba(255, 255, 255, 0.55)',
  edge: 'rgba(5, 44, 35, 0.12)',
} as const;

/**
 * Flat fallback per variant (Android / Reduce Transparency / eldre iOS).
 * Kort og kontrollglass går til `OpalSurface`; disse tre er én flat View.
 */
const SOLID: Partial<Record<GlassVariant, {fill: string; edge: string}>> = {
  important: {fill: GLASS.importantSolid, edge: GLASS.importantSolidEdge},
  bar: {fill: GLASS.barSolid, edge: GLASS.barSolidEdge},
  barMatch: {fill: GLASS.barMatchSolid, edge: GLASS.barMatchSolidEdge},
  sheet: {fill: GLASS.sheetSolid, edge: GLASS.sheetSolidEdge},
};

interface NativeProps extends ViewProps {
  cornerRadius: number;
  glassTint: string;
  pressed: boolean;
  sheenOpacity: number;
  interactive: boolean;
}

const iosMajor =
  Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const LIQUID_GLASS_SUPPORTED = iosMajor >= 26;

// `requireNativeComponent` registrerer viewet i RN-registeret én gang per
// app-økt; Fast Refresh evaluerer denne modulen på nytt og ville kastet
// «Tried to register two views with the same name». Derfor caches
// komponenten globalt, som RN-biblioteker gjør.
type GlassGlobal = {__heiaLiquidGlass?: React.ComponentType<NativeProps>};
const glassGlobal = globalThis as unknown as GlassGlobal;
const NativeGlass = LIQUID_GLASS_SUPPORTED
  ? (glassGlobal.__heiaLiquidGlass ??= requireNativeComponent<NativeProps>(
      'HeiaLiquidGlassView',
    ))
  : null;

interface LiquidGlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Ytre ramme rundt glasset — for MARGER. `style` treffer innerboksen (der
   * padding hører hjemme); en margin der ville ligget inni glasset.
   */
  wrapStyle?: StyleProp<ViewStyle>;
  pressed?: boolean;
  /** Materialvariant — se `GLASS`. Default = feedkortet. */
  variant?: GlassVariant;
  /** Hjørneradius — kort = radius.xl (default), kantlinjer/bar = 0. */
  cornerRadius?: number;
  /**
   * Fyll forelderen (absoluteFill) i stedet for å måle seg etter barna.
   * Tab-barens kapsel: glasset er bakgrunnen, fanene legges ut av
   * biblioteket OVER den.
   */
  fill?: boolean;
  /**
   * FLATEN KAN BLI VILKÅRLIG HØY (Brage 2026-09-04, kritisk telefonfunn:
   * «glassflaten på Varsler forsvinner under scroll»).
   *
   * ROTÅRSAKEN, ikke symptomet: både `UIGlassEffect` (et backdrop-lag) og
   * `OpalSurface` (svg) er TEKSTURBASERTE materialer — de må rasteres i
   * flatens fulle størrelse. Alle andre glassflater i Heia er avgrenset til
   * omtrent én skjerm (feedkort, ark, tab-bar). Varsler-lista er den første
   * som IKKE er det: `groupByAge` har bare tre bolker, så «Tidligere» samler
   * alt eldre enn i dag og VOKSER med pagineringen (50 rader per side). Én
   * side er ~3400 pt, tre sider ~10200 pt — langt over det et backdrop kan
   * komponeres inn i (Metals tekstur-tak er 8192 px, og skjermen er 852 pt).
   * Da faller effekten ut, og radene står igjen rett på grunnen.
   *
   * LØSNINGEN beholder materialet, men uten teksturen: flaten tegnes som
   * gjennomskinnelig tint + kanter, som er gratis i alle høyder. Det koster
   * ingenting visuelt her, fordi det ikke er noe å blurre: dagslysgrunnen er
   * en jevn gradient, og den STÅR STILLE bak flaten (radene ruller inni
   * den). Å blurre en jevn gradient gir den samme gradienten tilbake —
   * glasskarakteren kommer fra tinten og kantene, ikke fra uskarpheten.
   */
  unbounded?: boolean;
  /**
   * INNHOLD SOM KOMMER SENT (Brage 2026-09-04: «idrettene kommer opp først
   * hvis man for eks velger en farge»). Glasset er en legacy native view
   * gjennom Fabrics interop-lag, og barn som monteres i en SENERE commit enn
   * glasset selv (asynkrone data: idretter, søketreff) vises ikke før neste
   * commit som oppdaterer noe under glasset — hvilken som helst prop, som
   * fargevalget gjorde. Send en verdi som endrer seg når slikt innhold
   * kommer eller går; flaten planlegger da selv én harmløs oppdatering
   * under glasset i neste ramme (`GlassNudge`). Statisk innhold trenger
   * det ikke.
   */
  contentVersion?: string | number;
  /**
   * INNHOLDET UTENFOR NATIVE-VIEWET (Brage 2026-09-04, «Opprett lag»:
   * idrettspillene — en flexWrap-rad — var usynlige inne i glasset selv når
   * de ble montert sammen med det, og dukket opp først ved en senere
   * oppdatering). Med `detached` er glasset en absolutt bakgrunn BAK
   * innholdet, og innholdet er vanlige Fabric-views som søsken over — samme
   * oppsett som feedens tab-bar (`fill`) og det som viste Varsler-radene
   * feilfritt. Prisen: ingen native trykkrespons (irrelevant for
   * ikke-interaktive varianter). Bruk det på flater med skjema og dynamisk
   * innhold. Fallback-grenene er upåvirket (vanlige views uansett).
   */
  detached?: boolean;
  children?: React.ReactNode;
}

/** Se `contentVersion`: én oppdaterings-mutasjon under glasset per endring. */
function GlassNudge({version}: {version: string | number}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTick(t => t + 1));
    return () => cancelAnimationFrame(id);
  }, [version]);
  return (
    <View
      testID="glass-nudge"
      pointerEvents="none"
      style={[styles.nudge, tick % 2 === 1 && styles.nudgeOdd]}
    />
  );
}

export function LiquidGlassSurface({
  wrapStyle,
  ...props
}: LiquidGlassSurfaceProps) {
  const node = <GlassSurface {...props} />;
  return wrapStyle ? <View style={wrapStyle}>{node}</View> : node;
}

function GlassSurface({
  style,
  pressed = false,
  variant = 'card',
  cornerRadius = radius.xl,
  fill = false,
  unbounded = false,
  contentVersion,
  detached = false,
  children,
}: Omit<LiquidGlassSurfaceProps, 'wrapStyle'>) {
  const {reduceTransparency} = useMaterialAccessibility();
  const glass = GLASS[variant];
  const fillStyle = fill ? StyleSheet.absoluteFill : null;

  // Se `unbounded`: ingen native backdrop, ingen svg — bare tint og kanter,
  // så flaten er like stabil på rad 9 som på rad 900.
  if (unbounded) {
    const solid = SOLID[variant];
    return (
      <View
        testID={`glass-unbounded-${variant}`}
        style={[
          styles.solid,
          {
            borderRadius: cornerRadius,
            backgroundColor:
              reduceTransparency && solid ? solid.fill : glass.tint,
            borderColor:
              reduceTransparency && solid ? solid.edge : GLASS.unboundedEdge,
          },
          fillStyle,
          style,
        ]}>
        {children}
        {/* Lyset langs overkanten — materialets specular, ikke en ramme.
            Ligger over barna så en rad aldri dekker den, og er klippet av
            flatens egen radius. */}
        {!reduceTransparency && (
          <View
            testID="glass-unbounded-top"
            pointerEvents="none"
            style={styles.unboundedTop}
          />
        )}
      </View>
    );
  }

  if (!FEED_LIQUID_GLASS_AB || !NativeGlass || reduceTransparency) {
    const solid = SOLID[variant];
    // Profils grupper uten glass: opalens panel-kantfysikk, ikke kortets.
    if (variant === 'panel') {
      return (
        <OpalSurface variant="panel" style={style} pressed={pressed}>
          {children}
        </OpalSurface>
      );
    }
    if (solid) {
      return (
        <View
          testID={`glass-solid-${variant}`}
          style={[
            styles.solid,
            variant === 'important' && shadows.cardResting,
            {
              borderRadius: cornerRadius,
              backgroundColor: solid.fill,
              borderColor: solid.edge,
            },
            fillStyle,
            style,
          ]}>
          {children}
        </View>
      );
    }
    return (
      <OpalSurface style={style} pressed={pressed}>
        {children}
      </OpalSurface>
    );
  }
  if (detached) {
    return (
      <View style={[styles.detached, fillStyle]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NativeGlass
            style={[
              styles.glass,
              {borderRadius: cornerRadius},
              StyleSheet.absoluteFill,
            ]}
            cornerRadius={cornerRadius}
            glassTint={glass.tint}
            sheenOpacity={glass.sheen}
            interactive={false}
            pressed={pressed}
          />
        </View>
        <View style={[styles.surface, {borderRadius: cornerRadius}, style]}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <NativeGlass
      style={[styles.glass, {borderRadius: cornerRadius}, fillStyle]}
      cornerRadius={cornerRadius}
      glassTint={glass.tint}
      sheenOpacity={glass.sheen}
      interactive={glass.interactive}
      pressed={pressed}>
      <View
        style={[
          styles.surface,
          {borderRadius: cornerRadius},
          fillStyle,
          style,
        ]}>
        {children}
        {contentVersion !== undefined && (
          <GlassNudge version={contentVersion} />
        )}
      </View>
    </NativeGlass>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.xl,
  },
  surface: {
    borderRadius: radius.xl,
    // Samme padding-boks som OpalSurface: 1 pt gjennomsiktig kant.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Flat fallback (important/bar/barMatch) OG den scroll-trygge flaten.
  // Samme padding-boks: 1 pt kant. Fyll og kant settes per variant.
  solid: {
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  // `detached`: rammen måler seg etter innholdet; glasset fyller den bak.
  detached: {
    borderRadius: radius.xl,
  },
  // GlassNudge: null høyde, aldri synlig — bare en prop som kan endres.
  nudge: {
    height: 0,
    opacity: 1,
  },
  nudgeOdd: {
    opacity: 0.99,
  },
  unboundedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GLASS.unboundedTop,
  },
});
