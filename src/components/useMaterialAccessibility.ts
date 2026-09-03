import {useEffect, useState} from 'react';
import {AccessibilityInfo, Platform} from 'react-native';

/**
 * Systemets to MATERIAL-brytere — det stadionglasset (og senere opalen)
 * svarer på. Speiler `useReducedMotion`: engangslesing + lytter, så en bryter
 * som slås på mens appen står åpen slår gjennom uten omstart.
 *
 *   reduceTransparency  iOS «Reduser gjennomsiktighet». Materialet blir
 *                       solid (ingen bakgrunnsfarge gjennom flaten).
 *   increaseContrast    iOS «Øk kontrast» (darkerSystemColors) /
 *                       Android «Tekst med høy kontrast». Kanten forsterkes
 *                       og refleksene halveres.
 *
 * ⚠️ PLATTFORMPORTEN ER IKKE PYNT. Verifisert mot RN 0.83.1
 * (Libraries/Components/AccessibilityInfo/AccessibilityInfo.js):
 * `isDarkerSystemColorsEnabled()` på Android og `isHighTextContrastEnabled()`
 * på iOS gjør `return Promise.resolve(false)` INNE I promise-executoren, så
 * det ytre løftet løses ALDRI. Kall dem bare på plattformen som eier dem.
 * `isReduceTransparencyEnabled()` løser korrekt `false` på Android, men
 * hoppes over av samme grunn — Android har ingen slik bryter.
 * Eventnavnene er hentet fra AccessibilityInfo.d.ts i samme versjon:
 * reduceTransparencyChanged / darkerSystemColorsChanged (iOS),
 * highTextContrastChanged (Android).
 *
 * Avviste løfter (native manager mangler, f.eks. i et testmiljø) svelges —
 * materialet faller da til standardutseendet, som er det trygge.
 */
export interface MaterialAccessibility {
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

type Subscription = ReturnType<typeof AccessibilityInfo.addEventListener>;

export function useMaterialAccessibility(): MaterialAccessibility {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const guard = (set: (value: boolean) => void) => (value: boolean) => {
      if (!cancelled) set(value);
    };
    const ignore = () => {};
    const subscriptions: Subscription[] = [];

    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled().then(
        guard(setReduceTransparency),
        ignore,
      );
      AccessibilityInfo.isDarkerSystemColorsEnabled().then(
        guard(setIncreaseContrast),
        ignore,
      );
      subscriptions.push(
        AccessibilityInfo.addEventListener(
          'reduceTransparencyChanged',
          setReduceTransparency,
        ),
        AccessibilityInfo.addEventListener(
          'darkerSystemColorsChanged',
          setIncreaseContrast,
        ),
      );
    } else if (Platform.OS === 'android') {
      AccessibilityInfo.isHighTextContrastEnabled().then(
        guard(setIncreaseContrast),
        ignore,
      );
      subscriptions.push(
        AccessibilityInfo.addEventListener(
          'highTextContrastChanged',
          setIncreaseContrast,
        ),
      );
    }

    return () => {
      cancelled = true;
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  return {reduceTransparency, increaseContrast};
}
