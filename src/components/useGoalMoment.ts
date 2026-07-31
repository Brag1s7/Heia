import {useEffect, useRef} from 'react';
import {Animated, Easing} from 'react-native';

// ---------------------------------------------------------------------------
// MÅL-øyeblikket (P2 i design-polish-planen). Scoren spretter når den endres,
// og mål for OSS får i tillegg en kort mint-glød over stadionflaten.
// Endringen oppdages fra props — derfor fyrer animasjonen også hos foreldre
// som får ny stilling via realtime-refetch, ikke bare hos reporteren.
// Mål imot får kun spretten: det er informasjon, ikke feiring (og aldri coral).
// Ren RN Animated med native driver — ingen reanimated.
// ---------------------------------------------------------------------------

/** Feirings-vasken over stadionflaten — mint, litt sterkere enn heiaSoft
 *  fordi den ligger på mørk bunn. */
export const GOAL_CELEBRATION_TINT = 'rgba(2, 255, 171, 0.18)';

export function useGoalMoment(home: number, away: number) {
  const scoreScale = useRef(new Animated.Value(1)).current;
  const celebrate = useRef(new Animated.Value(0)).current;
  const prev = useRef({home, away});

  useEffect(() => {
    const last = prev.current;
    prev.current = {home, away};
    const usScored = home > last.home;
    const themScored = away > last.away;
    if (!usScored && !themScored) {
      return;
    }

    // Sprett: raskt opp, fjærende tilbake. Vårt mål spretter høyest.
    scoreScale.setValue(1);
    Animated.sequence([
      Animated.timing(scoreScale, {
        toValue: usScored ? 1.3 : 1.15,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scoreScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    if (usScored) {
      celebrate.setValue(0);
      Animated.sequence([
        Animated.timing(celebrate, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(60),
        Animated.timing(celebrate, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [home, away, scoreScale, celebrate]);

  return {scoreScale, celebrate};
}
