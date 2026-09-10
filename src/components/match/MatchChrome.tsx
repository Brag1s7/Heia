import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, matchColors, radius, spacing} from '../../theme';
import {ChevronUp} from '../icons';
import {MATCH_TOP_BAR_H} from './MatchTopBar';
import {
  MatchViewTabs,
  MATCH_VIEW_TABS_H,
  type MatchViewKey,
} from './MatchViewTabs';
import type {MatchPhoto} from '../../lib/api/feed';
import type {MatchEvent} from '../../shared/types';

/**
 * KAMPENS CHROME UNDER TOPPBAREN — visningsfanene som fester seg, sløret bak
 * dem, og «1 ny hendelse».
 *
 * ---------------------------------------------------------------------------
 * FANENE ER SKJERMFORANKRET, IKKE `stickyHeaderIndices`
 *
 * Samme lærdom som toppbaren (se `MatchTopBar`): en sticky header i
 * `ScrollView` festes til en posisjon i INNHOLDET og snapper tilbake dit.
 * Fanene ligger derfor som chrome over lista, og følger innholdet med
 * `translateY = clamp(tabsY − scrollY, 0)` på native driver: de glir med
 * scorekortet til de når festepunktet under scorelinja, og står der. Inn og
 * ut er symmetrisk av konstruksjon; leseposisjonen røres aldri.
 *
 * I innholdet ligger en tom PLASSHOLDER med fanenes høyde på samme sted, så
 * lista flyter riktig. Den måles (`onTabsLayout`) fordi scorekortets høyde
 * varierer med tekststørrelse og stablet layout.
 *
 * ---------------------------------------------------------------------------
 * SLØRET
 *
 * Når toppen er kompakt passerer kortene under fanene. Et slør i grunnfargen
 * (tett, `matchColors.dayVeil`) toner inn bak fanene i det de fester seg, så
 * score og faner aldri blir utydelige av det som passerer.
 *
 * ---------------------------------------------------------------------------
 * «1 NY HENDELSE» — TEKSTEN FLYTTER SEG IKKE MENS DU LESER
 *
 * Har brukeren scrollet forbi festepunktet (`reading`), holdes nye
 * innsettinger tilbake (`useHeldMatchData`), og pillen under fanene sier hvor
 * mange som venter. Trykk fletter dem inn og går til toppen. Stillingen og
 * kampstatusen kommer fra `event.score`, ikke fra lista — de oppdateres
 * uansett. Oppdateringer av rader som alt vises (korrigert mål, nye
 * reaksjoner) flyter alltid inn; det er bare STRUKTUREN som holdes.
 */

/** Luft mellom scorelinja og fanene, og under fanene. */
export const MATCH_TABS_GAP = 8;

/** Plassholderens høyde i innholdet — fanene + luft under. */
export const MATCH_TABS_SLOT_H = MATCH_VIEW_TABS_H + MATCH_TABS_GAP;

/** Hvor langt forbi festepunktet man må ha scrollet for å «lese». */
const READING_SLACK = 24;

export interface MatchChrome {
  onTabsLayout: (event: LayoutChangeEvent) => void;
  tabsTranslate: Animated.AnimatedInterpolation<number>;
  veilOpacity: Animated.AnimatedInterpolation<number>;
  /** Scrollet forbi festepunktet — lista holdes. */
  reading: boolean;
}

export function useMatchChrome(scrollY: Animated.Value): MatchChrome {
  const [tabsY, setTabsY] = useState(0);
  const tabsYRef = useRef(0);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);

  const onTabsLayout = useCallback((event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    if (y !== tabsYRef.current) {
      tabsYRef.current = y;
      setTabsY(y);
    }
  }, []);

  // Festepunktet i scrollkoordinater: der fanene når plassen under linja.
  const pin = Math.max(1, tabsY - MATCH_TABS_GAP);

  /**
   * ⚠️ FANENE MÅ FØLGE MED I OVERSCROLL (Brage 2026-09-10: «blar man oppover
   * så flytter alt seg utenom den baren med referat/hendelser»).
   *
   * `extrapolate: 'clamp'` klemte BEGGE ender. Når man drar forbi toppen blir
   * `scrollY` NEGATIV, og fanene ble stående stille mens hele innholdet
   * spratt nedover — de løsnet fra scorekortet de ligger under.
   *
   * Venstre side skal EXTEND: for `scrollY < 0` blir `translateY = pin −
   * scrollY`, altså nøyaktig samme bevegelse som innholdet. Høyre side
   * beholder `clamp` — DET er festepunktet, og hele grunnen til at fanene er
   * skjermforankret chrome i stedet for `stickyHeaderIndices`.
   */
  const tabsTranslate = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, pin],
        outputRange: [pin, 0],
        extrapolateLeft: 'extend',
        extrapolateRight: 'clamp',
      }),
    [scrollY, pin],
  );

  const veilOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [Math.max(0, pin - 28), pin],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY, pin],
  );

  // Lesetilstanden trenger JS, men bare som en grense med dødsone — det
  // synlige går på native driver.
  useEffect(() => {
    const id = scrollY.addListener(({value}) => {
      const grense = tabsYRef.current - MATCH_TABS_GAP + READING_SLACK;
      const next = readingRef.current ? value > grense - 12 : value >= grense;
      if (next !== readingRef.current) {
        readingRef.current = next;
        setReading(next);
      }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  return {onTabsLayout, tabsTranslate, veilOpacity, reading};
}

interface MatchChromeOverlayProps {
  chrome: MatchChrome;
  view: MatchViewKey;
  onChangeView: (next: MatchViewKey) => void;
  /** Nye hendelser som venter mens brukeren leser. */
  pending: number;
  onFlush: () => void;
}

export function MatchChromeOverlay({
  chrome,
  view,
  onChangeView,
  pending,
  onFlush,
}: MatchChromeOverlayProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + MATCH_TOP_BAR_H;
  const showPill = pending > 0 && chrome.reading;

  return (
    <>
      {/* Sløret — kun der kortene passerer under fanene. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.veil,
          {
            top,
            height: MATCH_TABS_GAP + MATCH_TABS_SLOT_H,
            opacity: chrome.veilOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.tabs,
          {
            top: top + MATCH_TABS_GAP,
            transform: [{translateY: chrome.tabsTranslate}],
          },
        ]}>
        <MatchViewTabs value={view} onChange={onChangeView} />
        {showPill && (
          <View style={styles.pillRow}>
            <Pressable
              onPress={onFlush}
              accessibilityRole="button"
              accessibilityLabel={
                pending === 1
                  ? 'Én ny hendelse. Vis den og gå til toppen.'
                  : `${pending} nye hendelser. Vis dem og gå til toppen.`
              }
              accessibilityLiveRegion="polite"
              style={({pressed}) => [
                styles.pill,
                pressed && styles.pillPressed,
              ]}>
              <ChevronUp size={16} color={colors.heiaDeep} strokeWidth={2.6} />
              <Text style={styles.pillText} maxFontSizeMultiplier={1.3}>
                {pending === 1 ? '1 ny hendelse' : `${pending} nye hendelser`}
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </>
  );
}

/**
 * Holder listas STRUKTUR mens brukeren leser. Rader som alt vises oppdateres
 * alltid (korrigert mål, ny tekst); nye rader og slettinger venter til
 * `flush` — eller til brukeren er tilbake ved toppen.
 */
export function useHeldMatchData(
  live: {matchEvents: MatchEvent[]; photos: MatchPhoto[]},
  hold: boolean,
): {
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  pending: number;
  flush: () => void;
} {
  const [held, setHeld] = useState(live);
  const heldRef = useRef(live);

  useEffect(() => {
    if (!hold) {
      heldRef.current = live;
      setHeld(live);
    }
  }, [hold, live]);

  const flush = useCallback(() => {
    heldRef.current = live;
    setHeld(live);
  }, [live]);

  return useMemo(() => {
    if (!hold) {
      return {
        matchEvents: live.matchEvents,
        photos: live.photos,
        pending: 0,
        flush,
      };
    }
    const eventsById = new Map(live.matchEvents.map(e => [e.id, e]));
    const photosById = new Map(live.photos.map(p => [p.id, p]));
    const matchEvents = held.matchEvents.map(e => eventsById.get(e.id) ?? e);
    const photos = held.photos.map(p => photosById.get(p.id) ?? p);
    const heldEvents = new Set(held.matchEvents.map(e => e.id));
    const heldPhotos = new Set(held.photos.map(p => p.id));
    const pending =
      live.matchEvents.filter(
        e => !heldEvents.has(e.id) && e.type !== 'avspark',
      ).length + live.photos.filter(p => !heldPhotos.has(p.id)).length;
    return {matchEvents, photos, pending, flush};
  }, [hold, live, held, flush]);
}

const styles = StyleSheet.create({
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: matchColors.dayVeil,
  },
  tabs: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  pillRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pill: {
    minHeight: 36,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.heia,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#08392E',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.heiaDeep,
  },
});
