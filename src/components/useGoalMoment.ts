import {useEffect, useRef} from 'react';
import {Animated, Easing} from 'react-native';
import {useReducedMotion} from './useReducedMotion';

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
  const reducedMotion = useReducedMotion();
  const bounce = useRef<Animated.CompositeAnimation | null>(null);
  const flood = useRef<Animated.CompositeAnimation | null>(null);
  // ⚠️ SPEILET, IKKE EN DEP. Ligger `reducedMotion` i måleffektens deps, kjører
  // hele effekten på nytt når innstillingen endres — og da måtte opprydningen
  // stoppet feiringen midt i fadet. Den ville blitt stående på en halv
  // opacity for alltid: en verden som lyser til appen lukkes.
  const rm = useRef(reducedMotion);

  // ⚠️ INNSTILLINGEN KAN SLÅS PÅ MENS SPRETTEN GÅR. `useReducedMotion` lytter
  // på endringer, og da må en ALLEREDE LØPENDE animasjon dø her og nå — ikke
  // bare utebli neste gang. Uten dette ville tallet fortsatt å sprette
  // ferdig etter at brukeren ba om ro, og verdien kunne blitt stående på
  // 1.3 hvis stoppet traff midt i sekvensen. Derfor settes sluttverdien
  // EKSPLISITT etter stoppet.
  useEffect(() => {
    rm.current = reducedMotion;
    if (!reducedMotion) {
      return;
    }
    bounce.current?.stop();
    bounce.current = null;
    scoreScale.stopAnimation();
    scoreScale.setValue(1);
  }, [reducedMotion, scoreScale]);

  useEffect(() => {
    const last = prev.current;
    prev.current = {home, away};
    const usScored = home > last.home;
    const themScored = away > last.away;
    if (!usScored && !themScored) {
      return;
    }

    // Sprett: raskt opp, fjærende tilbake. Vårt mål spretter høyest.
    // Faller helt bort med Reduce Motion — tallet skifter, det hopper ikke.
    if (!rm.current) {
      scoreScale.setValue(1);
      bounce.current = Animated.sequence([
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
      ]);
      bounce.current.start();
    }

    if (usScored) {
      celebrate.setValue(0);
      flood.current = Animated.sequence([
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
      ]);
      flood.current.start();
    }

    // ⚠️ INGEN ANIMASJON SKAL OVERLEVE KOMPONENTEN. Uten dette kjørte
    // fjæren videre etter at kampskjermen var forlatt, og forsøkte å
    // koble seg til en `View` som ikke fantes lenger. Neste mål setter
    // uansett begge verdiene eksplisitt før det starter på nytt.
    return () => {
      bounce.current?.stop();
      flood.current?.stop();
    };
  }, [home, away, scoreScale, celebrate]);

  return {scoreScale, celebrate};
}
