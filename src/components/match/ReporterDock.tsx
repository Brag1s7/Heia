import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, PanResponder, StyleSheet, View} from 'react-native';
import {matchColors, radius, spacing} from '../../theme';
import {ReporterActions, type ReporterActionType} from '../ReporterActions';
import {useReducedMotion} from '../useReducedMotion';

/** Dokkens høyde, målt. Kampens scroll må gi plass til den når den er åpen. */
export const REPORTER_DOCK_HEIGHT = 230;

/** Inn: myk landing. Ut: raskere. Samme par som `CommentSheet`. */
const OPEN_MS = 300;
const CLOSE_MS = 210;

/**
 * ⚠️ JS-DRIVER, samme bevisste unntak som `CommentSheet` (4.3): verdien
 * følger FINGEREN under draget, og fingeren kommer inn via `PanResponder`,
 * altså fra JS-tråden uansett. En native tween på samme node som får
 * `setValue` under draget gjør bunnark-drag upålitelig.
 */
const DRIVER = false;

/** Dratt lenger enn dette, eller sluppet med fart, betyr «lukk».
 *  Samme terskler som `CommentSheet` — appen skal ha ÉN dra-følelse. */
const DISMISS_RATIO = 0.28;
/** px/ms. 0.5 fanger «litt fort», ikke bare et bevisst kast. */
const DISMISS_VELOCITY = 0.5;

/**
 * SKAL DRAGET LUKKE DOKKEN?
 *
 * Egen funksjon, ikke en linje inne i `PanResponder`: dette ER regelen, og
 * den skal kunne bevises uten en ekte touch-hendelse. `PanResponder` fører
 * sin egen gestureState og lar seg ikke drive fra en syntetisk hendelse.
 *
 * ⚠️ Et rent TRYKK lander her med `dy ≈ 0` og må bli en no-op — ellers ville
 * dokken rikket på seg hver gang noen så vidt berørte håndtaket.
 */
export function shouldDismissDock(dy: number, vy: number): boolean {
  return dy > REPORTER_DOCK_HEIGHT * DISMISS_RATIO || vy > DISMISS_VELOCITY;
}

interface ReporterDockProps {
  open: boolean;
  onAction: (type: ReporterActionType) => void;
  isPaused: boolean;
  onPhoto: () => void;
  /** Dratt ned, eller lukket av seg selv etter en fullført handling. */
  onClose: () => void;
}

/**
 * REPORTERENS VERKTØY — dokken over tab-baren (P4, skive 10).
 *
 * ---------------------------------------------------------------------------
 * HVORFOR PANELET FLYTTET HIT
 *
 * Fram til skive 10 lå `ReporterActions` FAST i kampskjermen, mellom
 * reporterlinja og pulsen. Det betydde at kampens mest tidskritiske
 * handling — «Mål oss» — lå et sted man måtte scrolle for å finne, mens den
 * grønne «+» i baren gjorde noe helt annet.
 *
 * Nå er baren kampknappen, og RAPPORTER åpner verktøyet der tommelen
 * allerede er. Prototypens `.repdock` er fasit for oppførselen: den glir opp
 * fra bunnen, dekker ikke arenaen, og lukkes med den samme knappen (som da
 * sier LUKK).
 *
 * ⚠️ INNHOLDET ER UENDRET. Samme `ReporterActions` med `variant="match"`,
 * samme seks handlinger, samme bildeknapp. Dokken er en PLASSERING, ikke et
 * nytt verktøy — hadde den vært en ny komponent, ville de seks handlingene
 * fått en andre implementasjon å drifte fra.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DEN BOR INNE I KAMPSKJERMEN, IKKE OVER TAB-BAREN.
 *
 * `bottom: 0` her er skjermflatens bunn, altså rett over baren — nøyaktig
 * der prototypens `bottom: 92px` lander. Det holder dokken i kampens verden
 * og gjør at all tilstand (åpen/lukket, pause, bildevelger) blir liggende
 * hos `EventDetailScreen`, som eier den fra før.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DEN KAN DRAS NED (Brage 2026-08-21, telefonen: «nesten som et
 * kommentarfelt»).
 *
 * Tersklene og driver-valget er ARVET FRA `CommentSheet`, ikke funnet på
 * nytt: den er telefontestet gjennom skive 4.2–4.4, og lærdommen der var at
 * en verdi som følger FINGEREN må ligge på JS-driveren. Fingeren kommer inn
 * via `PanResponder`, altså fra JS-tråden uansett; en native tween på samme
 * node som får `setValue` under draget gjør bunnark-drag upålitelig.
 *
 * Draget ligger på HÅNDTAKET, ikke på hele dokken: under håndtaket sitter
 * «Mål oss», og et drag som startet der ville stjålet trykket i kampens mest
 * tidskritiske øyeblikk.
 */
export function ReporterDock({
  open,
  onAction,
  isPaused,
  onPhoto,
  onClose,
}: ReporterDockProps) {
  const reducedMotion = useReducedMotion();
  const translateY = useRef(
    new Animated.Value(open ? 0 : REPORTER_DOCK_HEIGHT),
  ).current;
  // Refen, ikke propen: `PanResponder` bygges én gang, og closuren ville
  // ellers holdt på den aller første `onClose`.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (reducedMotion) {
      // Ingen glid: dokken er der, eller den er det ikke. Bevegelsen er det
      // som fjernes — aldri handlingen.
      translateY.stopAnimation();
      translateY.setValue(open ? 0 : REPORTER_DOCK_HEIGHT);
      return;
    }
    const anim = Animated.timing(translateY, {
      toValue: open ? 0 : REPORTER_DOCK_HEIGHT,
      duration: open ? OPEN_MS : CLOSE_MS,
      // Inn: full fart først, myk landing. Ut: ta av, den skal vekk.
      // Samme par som `CommentSheet` — appen skal ha ÉN bevegelse.
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [open, translateY, reducedMotion]);

  const springBack = useRef(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }).current;

  /**
   * ⚠️ GESTEN VIRKET IKKE (Brage 2026-08-21): «Man kan IKKE dra rapporter
   * skiva ned, i tillegg hvis man prøver på dette så er det nesten så man
   * drar seg til venstre ut av kampsiden.»
   *
   * To ting, og de henger sammen:
   *
   *   1. Grepet vant ikke responderen. Nøyaktig lærdommen fra `CommentSheet`
   *      4.3: et håndtak må ta berøringen ALLEREDE VED START, og i
   *      CAPTURE-fasen — før barna får spørsmålet. En terskel på `onMove`
   *      alene gjør gesten upålitelig. Det er trygt her fordi det ikke finnes
   *      noe å trykke på i grepet.
   *   2. Den vannrette komponenten lakk ut til stackens sveip-tilbake. Den
   *      slås nå AV mens dokken er åpen (`gestureEnabled` i
   *      `EventDetailScreen`) — et ark som ligger over skjermen skal eie
   *      gesten sin, ikke dele den med navigasjonen.
   *
   * Grepet er dessuten 44 pt høyt nå. Det var 28, og en 4 pt strek i et
   * 28 pt felt må man sikte på.
   */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Uten denne kan et annet lag be om å overta MIDT i draget, og
        // dokken blir hengende halvveis nede.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          // Kun nedover. Å dra dokken OPP ville avdekket grunnen bak den.
          translateY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissDock(g.dy, g.vy)) {
            // Lukkingen eies av skjermen (knappen i baren skal si RAPPORTER
            // igjen), så vi melder fra og lar `open` styre utglidningen.
            closeRef.current();
            return;
          }
          // Ikke langt nok — og et rent TRYKK lander også her (dy ≈ 0), så
          // det blir en no-op i stedet for at dokken rikker på seg.
          springBack();
        },
        // Avbrutt gest (innkommende samtale, systemgest) skal ikke etterlate
        // dokken halvveis nede.
        onPanResponderTerminate: springBack,
      }),
    [translateY, springBack],
  );

  return (
    <Animated.View
      // Lukket dokk skal ikke stjele trykk fra forløpet under den.
      pointerEvents={open ? 'auto' : 'none'}
      style={[
        styles.dock,
        {
          transform: [{translateY}],
          // ⚠️ DETTE ER FEILEN BAK «rapporter skjermen går stygt ned», og den
          // sto her lenger enn den skulle: `opacity: open ? 1 : 0` SNAPPET
          // til 0 i samme øyeblikk `open` ble false, mens `translateY`
          // fortsatt animerte. Dokken forsvant altså med et KLIPP i stedet
          // for å gli. Nå er opacity AVLEDET av den samme animerte verdien,
          // så de to ikke kan komme i utakt.
          opacity: translateY.interpolate({
            inputRange: [0, REPORTER_DOCK_HEIGHT],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
        },
      ]}>
      {/* Håndtaket er både affordansen og gripeflaten. Samme form som
          arkene i appen bruker, så «dra meg ned» er gjenkjennelig. */}
      <View
        {...pan.panHandlers}
        // 44 pt trykkflate rundt en 4 pt strek — grepet skal treffes uten
        // at man sikter.
        style={styles.grip}
        accessibilityRole="button"
        accessibilityLabel="Lukk rapporteringsverktøyet"
        accessibilityHint="Dra ned for å lukke">
        <View style={styles.handle} />
      </View>

      <View importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}>
        <ReporterActions
          variant="match"
          onAction={onAction}
          isPaused={isPaused}
          onPhoto={onPhoto}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 0,
    // Mørk glassflate i kampens egen verden. Tokens, ikke prototypens rå
    // rgba() — `pulse` er det tredje rommets tone, og dokken er nabo til det.
    backgroundColor: matchColors.pulse,
    borderWidth: 1,
    borderColor: matchColors.chalk,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    // Skygge OPPOVER: dokken kommer nedenfra og skal løfte seg fra grunnen.
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: -12},
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 12,
  },
  grip: {
    // 44 pt. Var 28, og en 4 pt strek i et 28 pt felt må man SIKTE på —
    // midt i en kamp treffer man ikke.
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: matchColors.chalkStrong,
  },
});
