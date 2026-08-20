import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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
}

export function CommentSheet({
  postId,
  teamSpaceId,
  onClose,
}: CommentSheetProps) {
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrap}
          pointerEvents="box-none">
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
        </KeyboardAvoidingView>
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
