import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text} from 'react-native';
import {matchColors, radius, spacing} from '../../theme';
import {useReducedMotion} from '../useReducedMotion';

/**
 * BEKREFTELSEN I KAMPVERDENEN (skive 10.1).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DEN FINNES
 *
 * Brage, etter telefontesten 2026-08-21: «Når man har trykket på mål,
 * kommentar, pause, bilde og fortsett burde hele docken gå ned av seg selv
 * og komme en slags bekreftelse på at det er fullført.»
 *
 * Reporteren står midt i kampens mest tidskritiske øyeblikk. Uten et svar
 * må hun LETE i forløpet for å vite om målet gikk gjennom — og i mellomtiden
 * er hun tilbøyelig til å trykke en gang til.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DEN ER IKKE `NotificationBanner`.
 *
 * Banneret er nyheter fra ANDRE, det bor over fanene og følger deg gjennom
 * hele appen. Dette er kvitteringen på din EGEN handling, den bor i kampens
 * verden, og den forsvinner av seg selv. To ulike ting skal ikke se like ut.
 *
 * Formen er prototypens `.toast`: en mørk, smal pille like over tab-baren —
 * der dokken nettopp forsvant.
 */

/** Hvor lenge kvitteringen står. Kort nok til å ikke være i veien. */
const VISIBLE_MS = 1900;

/**
 * ⚠️ KVITTERINGEN VENTER PÅ AT DOKKEN HAR GÅTT (Brage 2026-08-21: «varselet
 * om at det er oppdatert kommer litt rart»).
 *
 * Den overtar PLASSEN dokken nettopp forlot. Kommer den samtidig, krysser to
 * flater hverandre i samme rute og det leses som rot. Ventetiden er dokkens
 * utglidning (`CLOSE_MS`), så bevegelsene blir en STAFETT: én går ned, én
 * kommer opp.
 */
const HANDOFF_MS = 210;

interface MatchToastProps {
  /** Teksten. `null` = ingenting å vise. */
  message: string | null;
  onHidden: () => void;
}

export function MatchToast({message, onHidden}: MatchToastProps) {
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  // Den STIGER inn nedenfra — samme retning dokken forsvant i, så den leses
  // som en avløser og ikke som noe nytt som dukket opp.
  const rise = useRef(new Animated.Value(10)).current;
  // Uten refen ville en ny timer fanget forrige `onHidden` i closuren sin.
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (!message) return;

    const show = Animated.sequence([
      Animated.delay(reducedMotion ? 0 : HANDOFF_MS),
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: reducedMotion ? 0 : 180,
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: reducedMotion ? 0 : 180,
          useNativeDriver: true,
        }),
      ]),
    ]);
    show.start();

    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: reducedMotion ? 0 : 180,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          rise.setValue(10);
          onHiddenRef.current();
        }
      });
    }, VISIBLE_MS + HANDOFF_MS);

    return () => {
      clearTimeout(timer);
      show.stop();
    };
  }, [message, fade, rise, reducedMotion]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      // ⚠️ `polite`, ikke `assertive`: kvitteringen skal ikke avbryte en
      // reporter som er midt i å lese kampforløpet med VoiceOver.
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={message}
      style={[styles.toast, {opacity: fade, transform: [{translateY: rise}]}]}>
      <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.6}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    // Like over tab-baren — der dokken nettopp gled ned.
    bottom: spacing.md,
    alignSelf: 'center',
    alignItems: 'center',
    // Prototypens mørke glass. Tokens, ikke rå rgba.
    backgroundColor: matchColors.groundTop,
    borderWidth: 1,
    borderColor: matchColors.chalkStrong,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: {
    color: matchColors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
