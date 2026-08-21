import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fonts, matchColors, spacing} from '../../theme';
import {BackBar} from '../BackBar';
import {useReducedMotion} from '../useReducedMotion';
import {matchPulseClock, matchScoreA11yLabel} from '../../shared/matchCopy';
import type {MatchArenaPhase} from './MatchArena';

/**
 * KAMPENS TOPPFLATE — navlinja som BLIR stillingen når du blar nedover.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ RUNDE 1 BRUKTE `stickyHeaderIndices`, OG TELEFONEN AVVISTE DEN.
 * (Brage 2026-08-21: «den forsvinner ikke smooth når man blar opp og den
 * kommer for sent når man blar ned».)
 *
 * Begge feilene hadde ÉN årsak, og den lå i mekanikken selv:
 * **`stickyHeaderIndices` fester baren til en posisjon i INNHOLDET, ikke i
 * skjermen.** `ScrollViewStickyHeader.js` regner
 * `translateY = max(0, scrollY − layoutY)`. Blar du tilbake forbi
 * festepunktet blir translateY 0 i samme frame, og baren HOPPER ned til der
 * den bor i innholdet — rett under arenaen, midt på skjermen — hvor fadet så
 * spilles av. Den gled ikke bort; den teleporterte og løste seg opp.
 * Og «for sent nedover» var samme sak speilvendt: ankeret lå UNDER hele
 * arenaen, så den kunne ikke feste seg før ~430 pt var rullet. Prototypen
 * slår til på 190 fordi dens bar er forankret i SKJERMKANTEN
 * (`position: absolute; top: 0`).
 *
 * ⚠️ INGEN TERSKELJUSTERING KUNNE RETTET DET. Derfor er baren nå toppchrome
 * og ikke en seksjonsoverskrift — og da finnes det ikke lenger noen posisjon
 * i innholdet å snappe tilbake til. Inn og ut er symmetrisk av KONSTRUKSJON.
 *
 * ---------------------------------------------------------------------------
 * HEADEREN BLIR BAREN (Brages valg, runde 2)
 *
 * Chevronen står stille hele veien — den er den samme knappen før og etter,
 * så det finnes aldri et øyeblikk uten tilbakevei, og aldri to tilbakeknapper
 * i treet. Det som SKIFTER er hva raden sier: «Tilbake · Kampen» toner ut,
 * «● Stange G10 6–2 Kåffa · SLUTT» toner inn, i nøyaktig samme rad.
 *
 * ⚠️ REKKEFØLGEN I JSX ER FUNKSJONELL, IKKE KOSMETIKK.
 * Platen må stå FØR `BackBar`, ellers maler den — ugjennomsiktig — rett over
 * chevronen når den toner inn, og tilbakeknappen forsvinner nøyaktig i det
 * baren kommer. Det var runde 2s ene feil (Brage: «Burde det være en
 * tilbakeknapp på den headeren som dukker opp?» — den VAR der, den lå bare
 * begravd). Rekkefølgen er: plate → brikke → BackBar → stillingen.
 *
 * ⚠️ BRIKKEN BAK CHEVRONEN toner inn sammen med baren. Når ordet «Tilbake»
 * er borte, står glyfen alene, og en naken pil på en tett rad leser som
 * dekor og ikke som en knapp. Prototypens `.sb-back` løser det med en rund
 * flate — den er dekor og ligger UNDER `BackBar`, så den ekte trykkflaten og
 * VoiceOver-stoppet er fortsatt `BackBar` sitt ene.
 *
 * ⚠️⚠️ DE TO LAGENE TONER I HVER SITT BÅND — DE KRYSSTONER IKKE.
 * Runde 3s feil (Brage: «den fader over det som allerede er der. jeg vil at
 * den skal gå over det som står fra før av, slik som html også gjør»):
 * «Tilbake · Kampen» og stillingen lå i SAMME bånd, så midtveis sto begge på
 * 50 % oppå hverandre og var uleselige. **Å gjøre platen mer ugjennomsiktig
 * ville ikke hjulpet** — en plate som selv toner inn er halvt gjennomsiktig
 * på halvveien, uansett hvor solid den er på slutten.
 *
 * Grunnen til at HTML-en ikke har problemet er strukturell: DER har navlinja
 * allerede rullet vekk når baren kommer, så det finnes ingenting bak den.
 * Vi løser det samme med tid i stedet for plass: det gamle er HELT borte
 * (0–45 % av båndet) før det nye begynner å komme (50–100 %). Mellom dem er
 * headeren tom bortsett fra chevronen — nøyaktig som en iOS-storTittel som
 * kollapser.
 *
 * ⚠️ TONINGEN DRIVES AV SCROLL-POSISJONEN PÅ NATIVE DRIVER, ikke av en
 * boolsk bryter med en `Animated.timing` etterpå. Det er hele grunnen til at
 * den er myk: det finnes ingen forsinkelse å ta igjen, og veien ut er den
 * samme veien inn baklengs. Den boolske `shown` finnes fortsatt, men styrer
 * BARE tilgjengelighet — aldri noe man ser.
 *
 * ⚠️ BAREN BLOKKERER IKKE TRYKK, OG TRENGER IKKE. `ScrollView`-en begynner
 * under denne raden, så det ruller aldri innhold under den. Begge lagene er
 * `pointerEvents="none"` med vilje: da forblir chevronen UNDER dem levende.
 * Runde 1 måtte sende `pointerEvents` gjennom slot-stilen for å hindre at en
 * usynlig bar spiste trykk på reporterraden; det problemet finnes ikke lenger.
 */

interface MatchTopBarProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  phase: MatchArenaPhase;
  /** Kampminuttet NÅ. Prop, aldri egen utregning. */
  minute?: number;
  /** 0 = navlinje, 1 = stilling. Fra `useMatchTopBar`. */
  progress: Animated.AnimatedInterpolation<number>;
  /** Kun tilgjengelighet — se toppkommentaren. */
  shown: boolean;
}

export function MatchTopBar({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  phase,
  minute,
  progress,
  shown,
}: MatchTopBarProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const clock = matchPulseClock({phase, minute});

  // ÉN samlet setning: lag, stilling og status. Ingen `accessibilityLiveRegion`
  // — en bar som annonserte seg selv hvert minutt ville avbrutt lesingen av
  // kampforløpet med et tall ingen ba om.
  const label = `${matchScoreA11yLabel({
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
  })} ${clock.a11y}`;

  // ⚠️ REDUCE MOTION BYTTER HARDT. En krysstoning som følger fingeren er
  // fortsatt bevegelse utløst av scroll, og prototypen gjør det samme
  // (`body.rm .stickybar { transition: opacity .1s; transform: none }`).
  // Da er `shown` — den samme terskelen tilgjengeligheten bruker — det
  // eneste som styrer, og ingen interpolasjon er koblet til i det hele tatt.
  const inn = reducedMotion
    ? shown
      ? 1
      : 0
    : progress.interpolate({
        inputRange: [0, LAG.inn, 1],
        outputRange: [0, 0, 1],
      });
  const ut = reducedMotion
    ? shown
      ? 0
      : 1
    : progress.interpolate({
        inputRange: [0, LAG.ut, 1],
        outputRange: [1, 0, 0],
      });
  // Stillingen kommer NEDOVER inn i en tom header — den arver ikke plassen
  // fra noe som fortsatt står der.
  const senk = reducedMotion
    ? 0
    : progress.interpolate({
        inputRange: [0, LAG.inn, 1],
        outputRange: [-10, -10, 0],
      });

  return (
    <View>
      {/* Platen. Grunnens EGEN topptone, så toppen ikke blir et kort som
          ligger oppå verdenen — det eneste som egentlig SES er krittstreken
          nederst, og den er nok: den sier at toppen nå er sin egen flate.
          ⚠️ FØRST i treet: den maler ellers over chevronen. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.plate, {height: insets.top + BAR_H, opacity: inn}]}
      />

      {/* Brikken bak chevronen — ren dekor, under den ekte knappen. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.chevronChip, {top: insets.top + 7, opacity: inn}]}
      />

      <BackBar
        title="Kampen"
        variant="match"
        labelOpacity={ut}
        labelsHidden={shown}
      />

      <Animated.View
        pointerEvents="none"
        accessible={shown}
        accessibilityLabel={shown ? label : undefined}
        accessibilityElementsHidden={!shown}
        importantForAccessibility={shown ? 'yes' : 'no-hide-descendants'}
        style={[
          styles.row,
          {top: insets.top, opacity: inn, transform: [{translateY: senk}]},
        ]}>
        <View style={[styles.dot, DOT[phase]]} />

        <View style={styles.teams}>
          <Text
            style={styles.team}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}>
            {homeTeam}
          </Text>
          <Text
            style={styles.score}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}>
            {homeScore}–{awayScore}
          </Text>
          <Text
            style={styles.team}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}>
            {awayTeam}
          </Text>
        </View>

        <Text
          style={styles.clock}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}>
          {clock.text}
        </Text>
      </Animated.View>
    </View>
  );
}

/** `BackBar`s egen radhøyde. Toppflaten er den SAMME raden, ikke en ny. */
const BAR_H = 44;

/**
 * De to lagenes plass i båndet. `ut` er ferdig FØR `inn` begynner — det er
 * hele poenget, se toppkommentaren. Glippen på 5 % er med vilje liten: den
 * skal leses som et bytte, ikke som et hull.
 */
const LAG = {ut: 0.45, inn: 0.5} as const;

/**
 * Der stillingen er kommet langt nok til å VÆRE innholdet i raden. Brukes
 * bare av tilgjengeligheten — det synlige følger scroll-posisjonen direkte.
 * Eksportert så testene slipper å utlede formelen på nytt: to kilder til
 * samme terskel er to terskler som kan drifte fra hverandre.
 */
export function matchTopBarThreshold(arenaHeight: number): number {
  const {start, end} = bandFor(arenaHeight);
  return start + (end - start) * 0.8;
}

/**
 * Chevronen ligger fra ~8 til ~34 pt. Stillingen begynner utenfor den, så de
 * to aldri kolliderer — heller ikke når «Tilbake» er tonet bort og ordet
 * ikke lenger holder plassen.
 */
const CHEVRON_LANE = 40;

/**
 * Prikken er STILLESTÅENDE. `LiveBadge` puster allerede i arenaen, og to
 * pulserende prikker i samme skjermbilde ville lest som to kamper. Coral
 * betyr LIVE og ingenting annet (låst fargesemantikk).
 */
const DOT: Record<MatchArenaPhase, {backgroundColor: string}> = {
  live: {backgroundColor: colors.live},
  paused: {backgroundColor: colors.gold},
  finished: {backgroundColor: matchColors.dim},
};

const styles = StyleSheet.create({
  plate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: matchColors.groundTop,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: matchColors.chalkFaint,
  },
  // Chevronglyfen starter på x=8 og er 26 bred, altså senter 21. Brikken er
  // 30 og sentreres om den.
  chevronChip: {
    position: 'absolute',
    left: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: matchColors.chalkFaint,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: CHEVRON_LANE,
    paddingRight: spacing.xl,
  },
  // Lagnavnene deler det som blir til overs; stillingen og klokka gjør ikke.
  teams: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  // ⚠️ ARENAENS EGEN STEMME (`MatchArena.styles.teamName`), ikke prototypens
  // 13 px. Baren er et komprimert ekko av hodet — samme lag skal ikke ha to
  // ulike stemmer i samme rull. Begge lagnavn har SAMME blekk, også her:
  // arenaen skiller lagene med merket (lagfarge vs. skifer), aldri med
  // tekstfargen.
  team: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: matchColors.text,
  },
  // ⚠️ Displayfont ⇒ ALDRI `fontWeight` ved siden av. Fila ER vekten.
  score: {
    flexShrink: 0,
    fontSize: 19,
    fontFamily: fonts.display,
    color: colors.heia,
  },
  clock: {
    flexShrink: 0,
    fontSize: 13,
    fontFamily: fonts.display,
    color: matchColors.dim,
  },
  dot: {
    flexShrink: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

/**
 * Krysstoningen, delt av `LiveMatch` og `FinishedMatch`.
 *
 * ⚠️ BÅNDET MÅLES, DET GJETTES IKKE. Arenaen er ikke like høy i en live kamp
 * og i en rapport, og den vokser med Dynamic Type og med et langt lagnavn.
 * Et fast tall (prototypens 190) ville truffet feil sted på halvparten av
 * kampene. Vi måler arenaens faktiske høyde og legger båndet der stillingen
 * forlater toppen — samme regel som 3.1 slo fast for alt som ligger over
 * innhold av variabel høyde: MÅL raden, ikke regn den ut.
 *
 * ⚠️ TERSKELTILSTANDEN LIGGER I EN REF. En `onScroll`-handler som
 * sammenligner mot state, leser den fra closuren den ble laget i. Med ±12 pt
 * dødbånd rundt midten kan en fling som lander på terskelen ikke gi to
 * tilstander i to påfølgende frames.
 */
function bandFor(arenaHeight: number): {start: number; end: number} {
  const h = arenaHeight || 420;
  return {start: h * 0.45, end: h * 0.68};
}

export function useMatchTopBar(): {
  progress: Animated.AnimatedInterpolation<number>;
  shown: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onArenaLayout: (event: LayoutChangeEvent) => void;
} {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const [arenaHeight, setArenaHeight] = useState(0);
  // ⚠️ SAMME TALL, TO STEDER, MED VILJE. Interpolasjonen MÅ bygges på nytt
  // når høyden endres (inndataområdet er en del av noden), men lytteren skal
  // IKKE — se `onScroll`.
  const arenaRef = useRef(0);

  // Stillingen sitter omtrent midt i arenaen. Båndet starter når den er på
  // vei ut av toppen og er ferdig like etter at den er borte — 420 er bare
  // et fornuftig anslag i den ene framen før målingen kommer.
  const band = useMemo(() => bandFor(arenaHeight), [arenaHeight]);

  const progress = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [band.start, band.end],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY, band],
  );

  const onArenaLayout = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    arenaRef.current = h;
    setArenaHeight(h);
  }, []);

  // ⚠️ STABIL — `[scrollY]` og ingenting mer. `Animated.event` med native
  // driver er ikke en funksjon, men et OBJEKT som hektes på native side; en
  // ny identitet river den koblingen ned og opp igjen. Målingen av arenaen
  // kommer én frame etter monteringen, så en `band` i deps ville gjort
  // nettopp det, hver gang. Båndet leses derfor fra ref-en i stedet.
  const onScroll = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
        useNativeDriver: true,
        // ⚠️ Det SYNLIGE går på native driver; denne lytteren gjør ingenting
        // annet enn å flytte tilgjengelighetsgrensen. Henger JS-tråden, blir
        // krysstoningen like myk uansett.
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = event.nativeEvent.contentOffset.y;
          const grense = matchTopBarThreshold(arenaRef.current);
          const next = shownRef.current ? y > grense - 12 : y >= grense + 12;
          if (next !== shownRef.current) {
            shownRef.current = next;
            setShown(next);
          }
        },
      }),
    [scrollY],
  );

  return {progress, shown, onScroll, onArenaLayout};
}
