import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

/**
 * «Reduser bevegelse» i systeminnstillingene.
 *
 * Kalenderen animerer lite, men det den animerer er nettopp det som plager
 * folk med bevegelsesfølsomhet: en rullende liste som flytter seg av seg selv,
 * og en kalender som folder seg ut. Er innstillingen på, hopper vi rett til
 * målet i stedet for å avlyse handlingen.
 *
 * Lytteren er med vilje ikke bare en engangssjekk: innstillingen kan slås på
 * mens appen står åpen, og da skal neste scroll respektere den.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!cancelled) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
