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
import {LiquidGlassSurface} from '../LiquidGlassSurface';
import {TeamBadge} from '../TeamBadge';
import {useReducedMotion} from '../useReducedMotion';
import {matchPulseClock, matchScoreA11yLabel} from '../../shared/matchCopy';
import type {MatchArenaPhase} from './MatchArena';

/**
 * KAMPENS TOPPFLATE — navlinja som BLIR den kompakte scorelinja når du blar.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ RUNDE 1 BRUKTE `stickyHeaderIndices`, OG TELEFONEN AVVISTE DEN.
 * (Brage 2026-08-21: «den forsvinner ikke smooth når man blar opp og den
 * kommer for sent når man blar ned».) `stickyHeaderIndices` fester baren til
 * en posisjon i INNHOLDET, ikke i skjermen: blar du tilbake forbi
 * festepunktet hopper den ned til der den bor i innholdet. Ingen terskel
 * kunne rettet det. Derfor er baren TOPPCHROME, forankret i skjermkanten,
 * og krysstoningen følger scrollen på native driver — inn og ut er
 * symmetrisk av konstruksjon. Samme regel gjelder visningsfanene
 * (`MatchChrome`).
 *
 * ---------------------------------------------------------------------------
 * RUNDE 2 (2026-09-07): KAPSELEN
 *
 * Toppen er én rad som SKIFTER innhold. Chevronen står stille hele veien og
 * er den samme knappen før og etter. Det som skifter: «Tilbake · Kampen»
 * (mørkt blekk på den lyse grunnen) toner ut; en kapsel i kampens mørke
 * glass (`barMatch`) toner inn med lagmerke, stilling og «● NÅ 54′ / 2.
 * omgang». Chevronen beholder mørkt blekk — en lys brikke toner inn bak
 * den SAMMEN MED kapselen, så den er en knapp også på det mørke glasset.
 *
 * ⚠️ BRIKKEN FØLGER KAPSELEN, IKKE «ALLTID DER». Runde 2 lot den stå fast,
 * og telefonen viste hvorfor det var feil (Brage 2026-09-08): på den lyse
 * grunnen ble den en grå sirkel rundt chevronen mens «Tilbake» rant inn i
 * kanten på den. I ro er knappen «‹ Tilbake» som på alle andre skjermer;
 * ordet er tonet helt bort (`LAG.ut`) før brikken begynner å komme
 * (`LAG.inn`), så de to møtes aldri.
 *
 * ⚠️ BRIKKEN SENTRERES PÅ STREKEN, IKKE PÅ GLYFBOKSEN. `BackBar` legger
 * glyfen på `INSET + spacing.md − 4` = 20 pt; lucide-chevronen bor i midten
 * av den 26 pt brede boksen (stroke 9–15 av 24), så streken er sentrert om
 * 33 pt. MÅLT på simulatoren: 32,8 pt. Brikken (34 pt) står derfor på
 * `INSET + 4`. Runde 2 antok `spacing.md` = 16 og bommet 3 pt.
 *
 * Ingen egen «Kampen»-rad når toppen er kompakt: tittelen ER borte.
 *
 * REKKEFØLGEN I JSX ER FUNKSJONELL: kapselen (dekor) FØR `BackBar`, så
 * glasset aldri maler over den ekte knappen.
 */

interface MatchTopBarProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  phase: MatchArenaPhase;
  /** Kampminuttet NÅ. Prop, aldri egen utregning. */
  minute?: number;
  /** Er andre omgang i gang? Utledes av kampforløpet hos kalleren. */
  secondHalf?: boolean;
  /** 0 = navlinje, 1 = stilling. Fra `useMatchTopBar`. */
  progress: Animated.AnimatedInterpolation<number>;
  /** Kun tilgjengelighet — se toppkommentaren. */
  shown: boolean;
}

/** Kapselens høyde. Toppflaten er `insets.top + MATCH_TOP_BAR_H` høy. */
export const MATCH_TOP_BAR_H = 56;

/** Kapselens sidemarg — samme som tab-kapselen. */
const INSET = 12;

/**
 * Tonen inn/ut er FORSKJØVET så «Tilbake · Kampen» er helt borte før
 * stillingen kommer — ellers ligger to tekster oppå hverandre midt i
 * bevegelsen.
 */
const LAG = {ut: 0.45, inn: 0.5} as const;

/** Motstandermerket: initialer på skifer. Aldri lagfarge, aldri coral. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

export function MatchTopBar({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  phase,
  minute,
  secondHalf,
  progress,
  shown,
}: MatchTopBarProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const clock = matchPulseClock({phase, minute});
  const label = `${matchScoreA11yLabel({
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
  })} ${clock.a11y}`;

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
  const senk = reducedMotion
    ? 0
    : progress.interpolate({
        inputRange: [0, LAG.inn, 1],
        outputRange: [-8, -8, 0],
      });

  const half =
    phase === 'live' && secondHalf !== undefined
      ? `${secondHalf ? '2.' : '1.'} omgang`
      : null;

  return (
    <View style={{height: insets.top + MATCH_TOP_BAR_H}}>
      {/* Kapselen — kampens mørke glass. Dekor: FØRST i treet. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.capsule, {top: insets.top, opacity: inn}]}>
        <LiquidGlassSurface
          variant="barMatch"
          cornerRadius={MATCH_TOP_BAR_H / 2}
          fill
        />
      </Animated.View>

      {/* Brikken bak chevronen — kommer med kapselen, så den mørke
          chevronen er en knapp også på det mørke glasset. Dekor: FØR
          `BackBar`. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.chevronChip, {top: insets.top + 11, opacity: inn}]}
      />

      {/* Den ekte knappen + «Tilbake · Kampen». BackBar legger selv på
          insets.top; de 6 pt-ene sentrerer 44-raden i 56-kapselen. */}
      <View style={styles.backWrap}>
        <BackBar title="Kampen" labelOpacity={ut} labelsHidden={shown} />
      </View>

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
        <View style={styles.side}>
          <TeamBadge
            size={30}
            cornerRadius={9}
            fontSize={9}
            logoPlate
            name={homeTeam}
            style={styles.usPlate}
          />
          <Text style={styles.score} maxFontSizeMultiplier={1.3}>
            {homeScore}
          </Text>
        </View>

        <View style={styles.mid}>
          <View style={styles.clockRow}>
            <View style={[styles.dot, DOT[phase]]} />
            <Text
              style={styles.clock}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
              {clock.text}
            </Text>
          </View>
          {half && (
            <Text
              style={styles.half}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
              {half}
            </Text>
          )}
        </View>

        <View style={[styles.side, styles.sideRight]}>
          <Text style={styles.score} maxFontSizeMultiplier={1.3}>
            {awayScore}
          </Text>
          <View style={styles.themPlate}>
            <Text style={styles.themInitials} maxFontSizeMultiplier={1.2}>
              {initials(awayTeam)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Statusprikken: coral = LIVE, gull = pause, dempet = slutt. Statisk. */
const DOT: Record<MatchArenaPhase, {backgroundColor: string}> = {
  live: {backgroundColor: colors.live},
  paused: {backgroundColor: colors.gold},
  finished: {backgroundColor: matchColors.dim},
};

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    height: MATCH_TOP_BAR_H,
    borderRadius: MATCH_TOP_BAR_H / 2,
    overflow: 'hidden',
  },
  // Sentrert om chevronSTREKEN (33 pt), se toppkommentaren.
  chevronChip: {
    position: 'absolute',
    left: INSET + 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  backWrap: {
    paddingTop: 6,
    paddingHorizontal: INSET,
  },
  row: {
    position: 'absolute',
    left: INSET + 48,
    right: INSET + 12,
    height: MATCH_TOP_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  usPlate: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  themPlate: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: matchColors.opponent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  themInitials: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.94)',
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.heia,
    includeFontPadding: false,
  },
  mid: {
    alignItems: 'center',
    flexShrink: 0,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  clock: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 0.8,
    color: matchColors.text,
  },
  half: {
    marginTop: 1,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
});

// ---------------------------------------------------------------------------
// MEKANIKKEN
// ---------------------------------------------------------------------------

/**
 * Terskelen for tilgjengelighet: der stillingen er «vist». Kun a11y — det
 * synlige går på native driver og trenger ingen terskel.
 */
export function matchTopBarThreshold(arenaHeight: number): number {
  const {start, end} = bandFor(arenaHeight);
  return start + (end - start) * 0.8;
}

/**
 * Båndet krysstoningen spiller i, som andel av scorekortets høyde: den
 * starter når kortet er nesten halvveis ute og er ferdig før det er borte.
 * MÅLES, fordi høyden varierer med stablet layout og tekststørrelse.
 */
function bandFor(arenaHeight: number): {start: number; end: number} {
  const h = arenaHeight || 240;
  return {start: h * 0.35, end: h * 0.7};
}

export function useMatchTopBar(): {
  progress: Animated.AnimatedInterpolation<number>;
  shown: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onArenaLayout: (event: LayoutChangeEvent) => void;
  /** Rå scrollposisjon på native driver — chromen under deler den. */
  scrollY: Animated.Value;
  /** Målt høyde på scorekortet (0 til første layout). */
  arenaHeight: number;
} {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const [arenaHeight, setArenaHeight] = useState(0);
  const arenaRef = useRef(0);

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

  const onScroll = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
        useNativeDriver: true,
        // Det SYNLIGE går på native driver; lytteren flytter bare
        // tilgjengelighetsgrensen (med ±12 pt dødsone mot flimring).
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

  return {progress, shown, onScroll, onArenaLayout, scrollY, arenaHeight};
}
