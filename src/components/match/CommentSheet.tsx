import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../../theme';
import {useReducedMotion} from '../useReducedMotion';
import {CommentThread} from '../CommentThread';

/**
 * SAMTALEN OM ETT ØYEBLIKK — som bunnark OVER kampen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR ARK OG IKKE EN SKJERM (skive 4.1)
 *
 * Skive 4 navigerte til `CommentsScreen`. Det er riktig fra feeden, og feil
 * fra kampen: en pågående kamp er noe du STÅR I, og å bli skjøvet ut av den
 * for å lese en kommentar er å forlate kampen. Her er prototypen faktisk
 * fasit for INTERAKSJONEN — samtalen kommer opp foran kampen, og du drar den
 * ned igjen og er fortsatt der du var. Stillingen står bak hele tiden.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ BEVEGELSEN ER EGEN, IKKE `animationType="slide"` (telefontest 4.2)
 *
 * Brage: arket «kommer opp altfor aggressivt». Systemets slide-animasjon er
 * rask og lineær i enden — den KASTER arket opp. En samtale skal gli inn og
 * lande, ikke slå. Derfor `animationType="none"` og vår egen `Animated`-
 * bevegelse med `Easing.out(Easing.cubic)`: full fart i starten, myk
 * landing. Samme verktøy som `DateField` og `MatchPulseCard` alt bruker —
 * ingen ny pakke. (Driveren er JS her og ikke native; se `DRIVER` under.)
 *
 * `useReducedMotion` fjerner glidningen, men ikke arket: er innstillingen
 * på, står det bare der. «Reduser bevegelse fjerner bevegelsen, ikke
 * innholdet» — samme regel som SEIER-pillen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ BAKGRUNNEN ER IKKE SVART (telefontest 4.2)
 *
 * `rgba(0,0,0,0.5)` — mønsteret fra `MatchPhotoSheet` — la en svart vask
 * over den grønne verdenen og slukket den. Kampen skal fortsatt være DER bak
 * arket; det er hele grunnen til at dette er et ark. Nå kampens eget scrim
 * (`#081B13`, samme som `MatchTimeline` og `MatchPhotoRail` bruker) på 0.32:
 * det SENKER verdenen i stedet for å male over den. Og det toner inn med
 * arket, i stedet for å slå på med én gang.
 *
 * ---------------------------------------------------------------------------
 * ARKET ER LYST, OG DET ER MED VILJE
 *
 * Et ark er ikke en flate I verdenen — det ligger OVER den, med verdenen
 * synlig rundt. Krem er Heias lyse LESEFLATE (Brage 2026-08-21), og en tråd
 * er lesing. Arket arver derfor kommentartrådens egen flate uendret, i
 * stedet for å få en mørk tvilling som ville vært en ny kommentarløsning.
 */

/**
 * ⚠️ JS-DRIVER, IKKE NATIVE — og det er et bevisst unntak (4.3).
 *
 * Resten av appen animerer `transform`/`opacity` på native driver, og det er
 * riktig for fyr-og-glem-bevegelser (`DateField`, `MatchPulseCard`). Her
 * følger den samme verdien FINGEREN, og fingeren kommer inn gjennom
 * `PanResponder` — altså fra JS-tråden uansett. Med native driver må hver
 * `setValue` under draget krysse brua til den native grafen, og det er
 * nettopp den kombinasjonen (native tween + JS `setValue` på samme node) som
 * gjør et bunnark-drag upålitelig.
 *
 * Prisen er at åpne-/lukkebevegelsen på 340 ms kjører på JS-tråden. Den er
 * ett `transform` på én flate, på en skjerm som ellers står stille.
 */
const DRIVER = false;

/** Inn: full fart først, myk landing. Ut: raskere, den skal komme seg vekk. */
const OPEN_MS = 340;
const CLOSE_MS = 210;

/** Dratt lenger enn dette, eller sluppet med fart, betyr «lukk». */
const DISMISS_RATIO = 0.28;
/** px/ms. 0.5 fanger «litt fort», ikke bare et bevisst kast. */
const DISMISS_VELOCITY = 0.5;

/**
 * ⚠️ FARTSGULV OG -TAK FOR UTGLIDNINGEN (4.4).
 *
 * Slipper du arket med fart, skal det FORTSETTE i den farten — ikke stoppe
 * og ta sats på nytt. Gulvet hindrer at et treigt slipp blir en sniglefart;
 * taket hindrer at det blir stående lenge nok til å føles som en animasjon
 * man venter på.
 */
const FLICK_FLOOR = 1.2; // px/ms
const FLICK_MIN_MS = 130;
const FLICK_MAX_MS = 360;

interface CommentSheetProps {
  /** Posten samtalen hører til. `null` lukker arket. */
  postId: string | null;
  teamSpaceId: string;
  onClose: () => void;
  /**
   * `match` (standard): det telefongodkjente arket over kampen — fast 78 %,
   * dra ned lukker. `feed`: arket fra Hjem — hviler på 68 %, dras til full
   * høyde (safe area + 8), tastaturet utvider det. Se `ExpandableCommentSheet`.
   */
  variant?: 'match' | 'feed';
  /**
   * «Se kampen ›» på kampkortet i tråden. Arket glir ned FØR kampen åpnes,
   * så det ikke står igjen over den. Utelatt i kampen (du står allerede der).
   */
  onOpenMatch?: (eventId: string) => void;
}

/**
 * Inngangen. `variant` velger mellom det låste kamparket og feedarket — to
 * komponenter, ikke én med grener, så kampens telefongodkjente oppførsel
 * ikke kan endres ved et uhell fra Hjem-siden (Brage 2026-09-03).
 */
export function CommentSheet(props: CommentSheetProps) {
  return props.variant === 'feed' ? (
    <ExpandableCommentSheet {...props} />
  ) : (
    <FixedCommentSheet {...props} />
  );
}

/** Kamparket — fast 78 %. Telefongodkjent 4.4; URØRT av feed-skiva. */
function FixedCommentSheet({postId, teamSpaceId, onClose}: CommentSheetProps) {
  const {height} = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const open = postId !== null;

  // 0 = arket ligger på plass, `height` = helt nede. Én verdi bærer BÅDE
  // åpningen og fingeren, så en drag midt i animasjonen ikke slåss mot den.
  const translateY = useRef(new Animated.Value(height)).current;

  // Bakgrunnen følger arket hele veien: den toner inn når det kommer opp, og
  // ut igjen mens du drar det ned. Da vet fingeren hva som kommer til å skje.
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Refs, ikke state: brukes inne i PanResponder, som lages ÉN gang.
  const heightRef = useRef(height);
  heightRef.current = height;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  // Hvor langt ned arket ligger akkurat nå. Ren ref, ikke `__getValue()`:
  // sistnevnte er privat API, og dette er uansett kun fingerens tall.
  const dragY = useRef(0);

  /**
   * UT AV SKJERMEN.
   *
   * ⚠️ `flickSpeed` (px/ms) er hele forskjellen på 4.3 og 4.4. Uten den kjørte
   * ALLE utganger `Easing.in(Easing.cubic)` — en kurve som starter på
   * NULL fart. Slapp du arket i bevegelse, stoppet det altså helt opp og tok
   * sats på nytt, og det er det Brage kjente som et rykk.
   *
   * Kommer bevegelsen fra fingeren, fortsetter vi LINEÆRT i fingerens egen
   * fart: varigheten regnes ut av hvor langt det er igjen delt på farten, så
   * det ikke finnes noe fartssprang i slippøyeblikket i det hele tatt.
   * Den brå stoppen på slutten ser ingen — arket er utenfor skjermen da.
   *
   * Kommer den fra et TRYKK (bakgrunn, Android-tilbake, slettet innlegg),
   * står arket stille, og da er det riktig å ta av: `Easing.in` beholdes der.
   */
  const slideOut = useRef((then: () => void, flickSpeed?: number) => {
    const remaining = Math.max(1, heightRef.current - dragY.current);
    const fromFinger = flickSpeed !== undefined;
    const duration = reduceRef.current
      ? 0
      : fromFinger
      ? Math.min(
          FLICK_MAX_MS,
          Math.max(FLICK_MIN_MS, remaining / Math.max(flickSpeed, FLICK_FLOOR)),
        )
      : CLOSE_MS;

    Animated.timing(translateY, {
      toValue: heightRef.current,
      duration,
      easing: fromFinger ? Easing.linear : Easing.in(Easing.cubic),
      useNativeDriver: DRIVER,
    }).start(({finished}) => {
      if (finished) {
        dragY.current = 0;
        then();
      }
    });
  }).current;

  /** Alle veier ut går herfra, så arket aldri forsvinner med et klipp. */
  const requestClose = () => slideOut(() => closeRef.current());

  useEffect(() => {
    if (!open) return;
    dragY.current = 0;
    translateY.setValue(reduceMotion ? 0 : heightRef.current);
    Animated.timing(translateY, {
      toValue: 0,
      duration: reduceMotion ? 0 : OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: DRIVER,
    }).start();
  }, [open, translateY, reduceMotion]);

  /**
   * DRA NED FRA TOPPEN FOR Å LUKKE (Brages ønske, telefontest 4.2 og 4.3).
   *
   * Gesten bor på HODET (håndtaket + tittelen), ikke på hele arket: under
   * ligger en scrollende tråd, og en drag-to-dismiss over den ville kjempet
   * med scrollen på hver eneste sveip.
   *
   * ---------------------------------------------------------------------
   * ⚠️ HVORFOR DEN MÅ KLAMRE SEG TIL BERØRINGEN FRA FØRSTE ØYEBLIKK (4.3)
   *
   * Første forsøk hadde BARE `onMoveShouldSetPanResponder` med en terskel på
   * 4 pt — «ikke gjør et trykk om til en drag». Det er riktig tanke på en
   * flate med knapper, og feil her: hodet har ingenting å trykke på, så det
   * eneste terskelen gjorde var å gjøre gesten upålitelig. Berøringen starter
   * som regel på `Text`-en («Kommentarer»), og da må responderen vinnes
   * gjennom en forhandling som andre lag i treet kan komme i veien for.
   *
   * Nå tar hodet responderen ALLEREDE VED BERØRING, og i capture-fasen — før
   * barna får spørsmålet. Det er trygt nettopp fordi det ikke finnes noe å
   * trykke på der, og det er slik et bunnark-håndtak normalt bygges.
   *
   * `onPanResponderTerminationRequest: false` er den andre halvparten: uten
   * den kan et annet lag be om å få overta MIDT i draget, og arket blir
   * hengende halvveis nede.
   *
   * Oppover (`dy < 0`) klemmes til 0 — arket har ingen ekstra høyde å gå til.
   */
  const pan = useMemo(() => {
    const springBack = () => {
      dragY.current = 0;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: DRIVER,
        bounciness: 0,
        speed: 14,
      }).start();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      // Berøring av hodet (trykk ELLER drag) lukker tastaturet med én gang
      // — hodet er «utenfor tastaturet» (Brage 2026-09-03).
      onPanResponderGrant: () => Keyboard.dismiss(),
      onPanResponderMove: (_e, g) => {
        const y = Math.max(0, g.dy);
        // Posisjonen huskes: utglidningen må vite hvor langt det er IGJEN,
        // ellers regner den varigheten fra full høyde og går for sakte.
        dragY.current = y;
        translateY.setValue(y);
      },
      onPanResponderRelease: (_e, g) => {
        const farEnough = g.dy > heightRef.current * DISMISS_RATIO;
        const fastEnough = g.vy > DISMISS_VELOCITY;
        if (farEnough || fastEnough) {
          // Fingerens fart følger med ut — se `slideOut`. Uten den stopper
          // arket helt opp i slippøyeblikket og tar sats på nytt.
          slideOut(() => closeRef.current(), Math.max(0, g.vy));
          return;
        }
        // Ikke langt nok — og et rent TRYKK lander også her (dy ≈ 0), så
        // det blir en no-op i stedet for at arket rikker på seg.
        springBack();
      },
      // Avbrutt gest (innkommende samtale, systemgest) skal ikke etterlate
      // arket halvveis nede.
      onPanResponderTerminate: springBack,
    });
  }, [translateY, slideOut]);

  return (
    <Modal
      visible={open}
      transparent
      // Bevegelsen er vår egen — se filhodet.
      animationType="none"
      // Android-tilbake. Uten denne er arket en blindvei på Android:
      // systemgesten lukker ingenting, og brukeren sitter fast i tråden.
      onRequestClose={requestClose}>
      <View style={styles.overlay}>
        {/* Trykk utenfor lukker. Egen a11y-label, ellers er den et stort
            navnløst trykkfelt VoiceOver leser før selve innholdet. */}
        <Animated.View
          style={[styles.backdrop, {opacity: backdropOpacity}]}
          pointerEvents="box-none">
          <Pressable
            style={styles.backdropHit}
            accessibilityRole="button"
            accessibilityLabel="Lukk kommentarene"
            onPress={requestClose}
          />
        </Animated.View>

        {/* Ingen KeyboardAvoidingView: tastaturet eies av trådens
            composer-dokk (keyboard.tsx). Rammen (78 %) er uendret. */}
        <View style={styles.wrap} pointerEvents="box-none">
          {/* ⚠️ `accessibilityViewIsModal` (iOS): uten den fortsetter
              VoiceOver å lese KAMPEN bak arket, og fokus vandrer mellom to
              lag som visuelt ikke finnes samtidig. Android får det samme av
              Modal-en selv. */}
          <Animated.View
            style={[styles.sheet, {transform: [{translateY}]}]}
            accessibilityViewIsModal
            accessibilityLabel="Kommentarer">
            {/* HODET — og gripeflaten. Hele denne bærer gesten. */}
            {/* ⚠️ `collapsable={false}`: på Android kan en View som bare
                bærer layout bli optimalisert BORT av det native treet — og
                da forsvinner treffområdet sammen med den. */}
            <View {...pan.panHandlers} collapsable={false} style={styles.head}>
              <View style={styles.handle} />
              <Text style={styles.title} accessibilityRole="header">
                Kommentarer
              </Text>
            </View>
            {/* Nøkkelen på postId: bytter du øyeblikk uten at arket lukkes,
                skal tråden lastes på nytt og ikke vise forrige samtale. */}
            {postId !== null && (
              <CommentThread
                key={postId}
                postId={postId}
                teamSpaceId={teamSpaceId}
                // Slettet innlegg = ingen tråd igjen. Arket lukker seg i
                // stedet for å bli stående tomt over kampen.
                onPostDeleted={requestClose}
              />
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * FEEDARKET — kommentarer fra Hjem (2026-09-03).
 *
 * Fra feeden skjøv `Comments`-ruta deg ut av Hjem, skjulte tab-baren og
 * mistet feedposisjonen. Nå kommer samtalen opp som et ark OVER feeden, og
 * du er der du var når det går ned igjen. Ruta lever videre for varsler og
 * deeplinks.
 *
 * GEOMETRIEN (Brage): hviler på 68 % av skjermen, dras til full høyde
 * (safe area + 8 pt), tastaturet utvider til full, swipe ned lukker.
 *
 * ⚠️ ANIMERT `top`, IKKE `transform` — og det er med vilje. Kamparket er
 * en fast boks som forskyves; her ENDRER arket høyde, og skrivefeltet skal
 * alltid sitte i synlig bunn. Med en transform ville bunnen av arket
 * (og skrivefeltet) ligget utenfor skjermen på hvilepunktet. `top` gir
 * layout per frame under draget, på JS-tråden (driveren er JS uansett, se
 * `DRIVER`). Godkjent for prototypen; SKAL telefontestes med lang tråd,
 * rask dragging, scrolling og tastatur. Hakker den: ikke commit, foreslå
 * UI-tråd/native.
 *
 * Gesten bor på HODET som i kamparket; lista scroller fritt. Prisen er at
 * du drar i hodet for å utvide, ikke i tråden — det er svaret på den
 * kjente capture-risikoen (PanResponder i hodet vs. scroll ved delvis
 * høyde).
 *
 * SCRIMMET er ikke kampens grønne 0,32 — Hjem er dagslys. Nøytralt
 * Heia-blekk (#08392E, opalens blekkfarge) på 0,24 (Brage).
 * ──────────────────────────────────────────────────────────────────────── */

/** Hvilepunktet: så stor andel av skjermen arket dekker når det åpner. */
export const FEED_SHEET_REST_RATIO = 0.68;
/** Full høyde stopper her under safe area-toppen. */
export const FEED_SHEET_TOP_GAP = 8;
/** Heia-blekk (#08392E) — lettere og nøytralt over dagslysgrunnen. */
export const FEED_SHEET_SCRIM = 'rgba(8, 57, 46, 0.24)';

/**
 * UTGLIDNINGEN I FEEDARKET (Brage 2026-09-03: «smoothere, nesten like fort
 * som når man trykker utenfor»). Kamparkets regel (lineært i fingerens
 * fart, gulv 1,2 px/ms, tak 360 ms) ga her en flat, treg glidning fra
 * hvilepunktet: ~580 px igjen på 360 ms. Nå:
 *   · sakte slipp (under `fastFloor`): arket står i praksis stille → SAMME
 *     bevegelse som bakgrunnstrykket (CLOSE_MS, ease-in). Det er følelsen
 *     Brage liker.
 *   · ekte kast: fortsetter lineært i fingerens fart, men aldri lenger enn
 *     `maxMs` — kastet skal komme seg vekk, ikke seile.
 */
export const FEED_CLOSE = {
  /** px/ms. Under dette regnes slippet som «stillestående». */
  fastFloor: 1.0,
  minMs: 120,
  maxMs: 240,
} as const;

/** Varighet + kurve for lukking i feedarket. Ren funksjon — testbar. */
export function feedCloseTiming(
  remainingPx: number,
  flickSpeed: number | undefined,
): {duration: number; linear: boolean} {
  const fast = flickSpeed !== undefined && flickSpeed >= FEED_CLOSE.fastFloor;
  if (!fast) return {duration: CLOSE_MS, linear: false};
  return {
    duration: Math.min(
      FEED_CLOSE.maxMs,
      Math.max(FEED_CLOSE.minMs, remainingPx / flickSpeed),
    ),
    linear: true,
  };
}

function ExpandableCommentSheet({
  postId,
  teamSpaceId,
  onClose,
  onOpenMatch,
}: CommentSheetProps) {
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const open = postId !== null;

  // Tre posisjoner for arkets OVERKANT: full, hvile, lukket (= skjermhøyde).
  const fullTop = insets.top + FEED_SHEET_TOP_GAP;
  const restTop = Math.max(fullTop, height * (1 - FEED_SHEET_REST_RATIO));

  const top = useRef(new Animated.Value(height)).current;
  // Scrimmet er fullt på hvilepunktet og alt over; tones ut mens arket
  // dras ned mot lukket, så fingeren vet hva som kommer.
  const backdropOpacity = top.interpolate({
    inputRange: [restTop, height],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Refs, ikke state: brukes inne i PanResponder og lyttere som lages én gang.
  const geom = useRef({height, fullTop, restTop});
  geom.current = {height, fullTop, restTop};
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openMatchRef = useRef(onOpenMatch);
  openMatchRef.current = onOpenMatch;
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  /** Hvor overkanten er akkurat nå (målet, under animasjon). Ren ref. */
  const posY = useRef(height);
  /** Hvor draget startet — bevegelsen legges oppå den. */
  const dragStart = useRef(height);

  /** UT AV SKJERMEN — se `feedCloseTiming` (rask som bakgrunnstrykket). */
  const slideOut = useRef((then: () => void, flickSpeed?: number) => {
    const {height: h} = geom.current;
    const remaining = Math.max(1, h - posY.current);
    const {duration, linear} = feedCloseTiming(remaining, flickSpeed);
    posY.current = h;
    Animated.timing(top, {
      toValue: h,
      duration: reduceRef.current ? 0 : duration,
      easing: linear ? Easing.linear : Easing.in(Easing.cubic),
      useNativeDriver: DRIVER,
    }).start(({finished}) => {
      if (finished) then();
    });
  }).current;

  /** Til full eller hvile — samme fjær som kamparkets `springBack`. */
  const snapTo = useRef((target: number) => {
    posY.current = target;
    if (reduceRef.current) {
      top.setValue(target);
      return;
    }
    Animated.spring(top, {
      toValue: target,
      useNativeDriver: DRIVER,
      bounciness: 0,
      speed: 14,
    }).start();
  }).current;

  const requestClose = () => slideOut(() => closeRef.current());
  // «Se kampen ›»: ned først, så kampen — arket skal ikke stå over den.
  const handleOpenMatch = (eventId: string) =>
    slideOut(() => {
      closeRef.current();
      openMatchRef.current?.(eventId);
    });

  useEffect(() => {
    if (!open) return;
    const {height: h, restTop: r} = geom.current;
    top.setValue(reduceMotion ? r : h);
    posY.current = r;
    Animated.timing(top, {
      toValue: r,
      duration: reduceMotion ? 0 : OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: DRIVER,
    }).start();
  }, [open, top, reduceMotion]);

  /**
   * TASTATURET UTVIDER (Brage). Skriver du, får samtalen hele skjermen.
   * Selve overlappen eies av trådens composer-dokk (keyboard.tsx) — dette
   * er bare snappet til full høyde. Tidligere lå en KeyboardAvoidingView
   * her, og den regnet feil: RN måler `frame.y` relativt til forelderen,
   * som er 0 inne i dette absolutt plasserte arket (se keyboard.tsx).
   * iOS varsler FØR tastaturet kommer (og sier hvor lenge det bruker), så
   * arket og tastaturet beveger seg sammen; Android har bare `Did`.
   * Arket blir stående fullt når tastaturet går ned — det skal ikke hoppe.
   */
  useEffect(() => {
    if (!open) return;
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        const {fullTop: f} = geom.current;
        if (posY.current <= f) return;
        posY.current = f;
        Animated.timing(top, {
          toValue: f,
          duration: reduceRef.current ? 0 : e.duration || OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: DRIVER,
        }).start();
      },
    );
    return () => sub.remove();
  }, [open, top]);

  /**
   * DRA I HODET: opp til full, ned til hvile, videre ned lukker. Samme
   * capture-regler og terskler som kamparket (4.3/4.4) — appen skal ha ÉN
   * dra-følelse. Overkanten klemmes mellom `fullTop` og skjermhøyden.
   */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStart.current = posY.current;
          // Berøring av hodet (trykk ELLER drag) lukker tastaturet med én
          // gang — hodet er «utenfor tastaturet» (Brage 2026-09-03).
          Keyboard.dismiss();
        },
        onPanResponderMove: (_e, g) => {
          const {height: h, fullTop: f} = geom.current;
          const y = Math.min(h, Math.max(f, dragStart.current + g.dy));
          posY.current = y;
          top.setValue(y);
        },
        onPanResponderRelease: (_e, g) => {
          const {height: h, fullTop: f, restTop: r} = geom.current;
          const y = posY.current;
          const startedAtRest = dragStart.current >= r - 1;
          // Kast opp: full.
          if (g.vy < -DISMISS_VELOCITY) {
            snapTo(f);
            return;
          }
          // Kast ned: fra hvile lukker det; fra full lander det på hvile
          // (med mindre det alt er dratt forbi hvilepunktet).
          if (g.vy > DISMISS_VELOCITY) {
            if (startedAtRest || y > r) {
              slideOut(() => closeRef.current(), Math.max(0, g.vy));
            } else {
              snapTo(r);
            }
            return;
          }
          // Sluppet: langt nok under hvile lukker (28 % av arkets høyde),
          // ellers nærmeste av full/hvile. Et rent trykk (dy ≈ 0) lander
          // på der det var — en no-op.
          if (y > r + (h - r) * DISMISS_RATIO) {
            slideOut(() => closeRef.current(), Math.max(0, g.vy));
            return;
          }
          snapTo(Math.abs(y - f) < Math.abs(y - r) ? f : r);
        },
        onPanResponderTerminate: () => {
          const {fullTop: f, restTop: r} = geom.current;
          snapTo(dragStart.current >= r - 1 ? r : f);
        },
      }),
    [top, slideOut, snapTo],
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={requestClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            styles.backdropFeed,
            {opacity: backdropOpacity},
          ]}
          pointerEvents="box-none">
          <Pressable
            style={styles.backdropHit}
            accessibilityRole="button"
            accessibilityLabel="Lukk kommentarene"
            onPress={requestClose}
          />
        </Animated.View>

        {/* Arket er forankret i bunnen og får overkanten animert — slik
            ENDRER det høyde, og tråden + skrivefeltet får alltid riktig
            plass. Ingen KeyboardAvoidingView — dokken eier tastaturet. */}
        <Animated.View
          style={[styles.sheetFloating, {top}]}
          accessibilityViewIsModal
          accessibilityLabel="Kommentarer">
          <View style={styles.fill}>
            <View {...pan.panHandlers} collapsable={false} style={styles.head}>
              <View style={styles.handle} />
              <Text style={styles.title} accessibilityRole="header">
                Kommentarer
              </Text>
            </View>
            {postId !== null && (
              <CommentThread
                key={postId}
                postId={postId}
                teamSpaceId={teamSpaceId}
                onPostDeleted={requestClose}
                onOpenMatch={onOpenMatch ? handleOpenMatch : undefined}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // ⚠️ IKKE SVART. Kampens eget scrim — det senker den grønne verdenen i
  // stedet for å male over den, så kampen fortsatt er DER bak arket.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 27, 19, 0.32)',
  },
  // Eget trykkfelt inni det animerte laget: en Pressable rundt ALT ville
  // svelget trykk i selve tråden.
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  // Feedarket: Heia-blekk, lettere — Hjem er dagslys, ikke arena.
  backdropFeed: {
    backgroundColor: FEED_SHEET_SCRIM,
  },
  // Feedarket: forankret i bunnen, `top` animeres (se ExpandableCommentSheet).
  sheetFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  wrap: {
    // Fast andel av skjermen, ikke innholdsstyrt høyde: en tom tråd og en
    // tråd med tolv replikker skal ikke gi to ulike ark, og skrivefeltet
    // skal alltid sitte på samme sted.
    height: '78%',
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  // Gripeflaten. Raus nok til at tommelen treffer uten å sikte.
  head: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
  },
  title: {
    ...typography.heading3,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
