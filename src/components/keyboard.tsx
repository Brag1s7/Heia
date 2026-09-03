import {useEffect, useRef} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type ScrollViewProps,
} from 'react-native';
import {useReducedMotion} from './useReducedMotion';

/**
 * TASTATURSYSTEMET (2026-09-03) — for flater der man SKRIVER og SENDER:
 * kommentartråden (CommentSheet ×2 + CommentsScreen) og «Del noe med laget».
 *
 * ⚠️ REGELEN: nøyaktig ÉN eier av tastatur-overlappen per skjerm — og
 * INGEN layout-animasjon i JS.
 *
 *   · Tråden: composer-dokken løftes med en NATIVE-DREVET transform
 *     (`useKeyboardLift`), og lista bruker RN sin egen native
 *     `automaticallyAdjustKeyboardInsets`. Begge kjører på UI-tråden med
 *     tastaturets varighet. Verten (ark/skjerm) har ingen
 *     KeyboardAvoidingView.
 *   · Feeden: komponisten ligger INNI lista → lista eier det, samme
 *     `automaticallyAdjustKeyboardInsets` (vindusbasert, ruller det
 *     fokuserte feltet fram).
 *   · Android: `windowSoftInputMode="adjustResize"` (manifestet) krymper
 *     vinduet — og RN-Modal-en sin dialog gjør det samme. Løftet er 0 der.
 *
 * ⚠️ HVORFOR IKKE KeyboardAvoidingView / LayoutAnimation (rotårsakene,
 * RN 0.83-kilden):
 *   1. KAV regner `frame.y + frame.height − keyboardY` med `frame` fra
 *      `onLayout` — RELATIVT TIL FORELDEREN. Inne i et absolutt plassert
 *      ark er `frame.y` 0, og den fant ~70 pt overlapp der tastaturet
 *      dekket ~340 (feltet lå bak tastaturet, telefonbilde 1).
 *   2. KAV og `Keyboard.scheduleLayoutAnimation` animerer LAYOUT via
 *      LayoutAnimation med type «keyboard». På FABRIC finnes ingen kurve
 *      for den typen — `animations/utils.cpp` faller til lineær — og hele
 *      kjeden går via JS-tråden med per-frame layout. Det var «sakte» og
 *      «hakkete» (telefonbilde 2 og 3). Instagram-følelsen (feltet i samme
 *      bevegelse som tastaturet) krever at INGENTING går via JS per frame:
 *      én JS-hendelse ved start, resten på UI-tråden. Det er dette.
 *
 * ⚠️ InputAccessoryView er valgt BORT: RN 0.83 dokumenterer kjente
 * problemer med multiline og bottom tab bar. Går heller ikke dette godt
 * nok på telefonen, er neste steg native UIKeyboardLayoutGuide — ikke
 * flere JS-varianter.
 */

/** Scroll-props for skriveflater: første trykk på Send/Publiser går til
 *  knappen (ikke til å lukke tastaturet); trykk på alt annet lukker det,
 *  og ethvert drag lukker det med én gang. Selve lukkingen VED BERØRING
 *  gjør tråden med `onTouchStart` (én regel for trykk, hold og drag). */
export const WRITING_SCROLL_PROPS = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
} as const satisfies ScrollViewProps;

/** Tastaturets overlapp over skjermbunnen fra dets egen ramme. 0 = nede. */
export function keyboardInsetFromEvent(
  e: KeyboardEvent | null | undefined,
  windowHeight: number,
): number {
  const end = e?.endCoordinates;
  if (!end) return 0;
  return Math.max(0, windowHeight - end.screenY);
}

/**
 * Hvor langt dokken løftes (negativ translateY). Dokken har alltid safe
 * area i egen bunnpadding; tastaturet DEKKER safe area, så løftet er
 * tastaturet minus safe area — safe area telles nøyaktig én gang.
 */
export function composerLift(
  keyboardInset: number,
  safeBottom: number,
): number {
  return -Math.max(0, keyboardInset - safeBottom);
}

/** Tastaturets egen varighet; iOS gir 250 ms som regel. */
export function keyboardDuration(e: KeyboardEvent): number {
  return e.duration && e.duration > 0 ? e.duration : 250;
}

/** UIKit sin tastaturkurve er rask ut av start og demper inn. */
export const KEYBOARD_EASING = Easing.bezier(0.38, 0.7, 0.125, 1);

/**
 * Native-drevet løft for en composer forankret i skjermbunnen.
 * Returnerer én `Animated.Value` (px, ≤ 0) som følger tastaturet:
 * `keyboardWillChangeFrame` (vis/skjul/ny høyde, forslagslinja inkludert)
 * + `keyboardWillHide` som sikring; like verdier ignoreres, så én
 * overgang aldri startes to ganger. Reduce Motion: hopp, ingen bevegelse.
 * Android: alltid 0 — vinduet eier det (adjustResize).
 */
export function useKeyboardLift(safeBottom: number): Animated.Value {
  const lift = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const refs = useRef({safeBottom, reduceMotion, last: 0});
  refs.current.safeBottom = safeBottom;
  refs.current.reduceMotion = reduceMotion;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const onFrame = (e: KeyboardEvent) => {
      const next = composerLift(
        keyboardInsetFromEvent(e, Dimensions.get('window').height),
        refs.current.safeBottom,
      );
      if (next === refs.current.last) return;
      refs.current.last = next;
      Animated.timing(lift, {
        toValue: next,
        duration: refs.current.reduceMotion ? 0 : keyboardDuration(e),
        easing: KEYBOARD_EASING,
        useNativeDriver: true,
      }).start();
    };
    const subs = [
      Keyboard.addListener('keyboardWillChangeFrame', onFrame),
      Keyboard.addListener('keyboardWillHide', onFrame),
    ];
    return () => subs.forEach(s => s.remove());
  }, [lift]);

  return lift;
}
