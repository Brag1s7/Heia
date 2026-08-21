import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  colors,
  matchColors,
  typography,
  spacing,
  radius,
  fonts,
} from '../theme';
import {useReducedMotion} from './useReducedMotion';
import type {ReporterActionType} from './ReporterActions';

/**
 * REPORTERENS TEKSTFELT — «hvem scoret», «hva skjedde».
 *
 * ---------------------------------------------------------------------------
 * ⚠️ BEVEGELSEN ER EGEN, IKKE `animationType` (telefontest, Brage 2026-08-21)
 *
 * «Når man trykker på hva som helst av knappene på rapporter siden så fader
 * det opp stygt og det kommer en svart fade over når den dras opp.»
 *
 * To feil i ett:
 *   1. `animationType="slide"` på en `transparent` Modal flytter HELE
 *      innholdet — inkludert det fullskjerms mørke sløret. Da sveiper et
 *      svart rektangel oppover skjermen. Sløret skal TONE, arket skal GLI,
 *      og det er to forskjellige bevegelser på to forskjellige lag.
 *   2. Sløret var `rgba(0,0,0,0.5)` — en svart vask som slukket den grønne
 *      verdenen bak. Nøyaktig det `CommentSheet` fikk avvist i 4.2.
 *
 * Løsningen er den samme som ble godkjent der: `animationType="none"`,
 * kampens eget slør (`#081B13` på 0.32) som toner inn MED arket, og
 * `Easing.out(Easing.cubic)` — full fart i starten, myk landing. Et ark skal
 * lande, ikke slå.
 *
 * ⚠️ Og det GLIR UT igjen. Før forsvant det med et klipp i det handlingen
 * ble sendt, midt i at dokken under også beveget seg — «lukker boksen seg
 * rart». Nå går arket ut FØRST, som en egen bevegelse.
 */

/** Inn: full fart først, myk landing. Ut: raskere, den skal komme seg vekk. */
const OPEN_MS = 300;
const CLOSE_MS = 190;

/**
 * ⚠️ JS-DRIVER, samme unntak som `CommentSheet` (4.3). Arket ligger over en
 * skjerm som står stille, og `KeyboardAvoidingView` flytter beholderen i
 * samme øyeblikk — en native tween på samme node blir upålitelig da.
 */
const DRIVER = false;

interface ReporterModalProps {
  visible: boolean;
  actionType: ReporterActionType;
  onSubmit: (description: string) => void;
  onCancel: () => void;
}

/**
 * ⚠️ TITTELEN ER ØYEBLIKKET, IKKE SKJEMAETS NAVN (Brage 2026-08-21:
 * «ser så billig ut»).
 *
 * «Mål for oss» over «Kort beskrivelse (valgfritt)» over en blek gråboks er
 * et ADMIN-SKJEMA. Det er ikke det som skjer: laget har akkurat scoret, og
 * reporteren har to sekunder. Tittelen står derfor i displayfonten som
 * resten av kampens tall, og feltet har ÉN etikett — plassholderen — i
 * stedet for to som sier det samme.
 *
 * Pause og «andre omgang» åpner aldri arket (rene av/på-trykk), men
 * Record-en må dekke hele unionen.
 */
const actionTitles: Record<ReporterActionType, string> = {
  mål_oss: 'MÅL!',
  mål_dem: 'MÅL IMOT',
  pause: 'PAUSE',
  andre_omgang: 'ANDRE OMGANG',
  slutt: 'SLUTT',
  melding: 'OPPDATERING',
};

/** Plassholderen ER etiketten. Én linje, ikke to. */
const actionPlaceholders: Record<ReporterActionType, string> = {
  mål_oss: 'Hvem scoret? (valgfritt)',
  mål_dem: 'Hva skjedde? (valgfritt)',
  pause: '',
  andre_omgang: '',
  slutt: '',
  melding: 'Skriv til laget …',
};

export function ReporterModal({
  visible,
  actionType,
  onSubmit,
  onCancel,
}: ReporterModalProps) {
  const [description, setDescription] = useState('');
  const {height: screenHeight} = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Arket monteres så lenge det er noe å se — også mens det glir UT, ellers
  // ville utgangen vært et klipp.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(reduceMotion ? 0 : screenHeight);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: DRIVER,
        }),
        Animated.timing(scrim, {
          toValue: 1,
          duration: reduceMotion ? 0 : OPEN_MS,
          useNativeDriver: DRIVER,
        }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: reduceMotion ? 0 : CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: DRIVER,
      }),
      Animated.timing(scrim, {
        toValue: 0,
        duration: reduceMotion ? 0 : CLOSE_MS,
        useNativeDriver: DRIVER,
      }),
    ]).start(({finished}) => {
      if (finished) setMounted(false);
    });
    // `mounted` med vilje utenfor: den settes HER, og å lytte på den ville
    // startet utglidningen på nytt i det den ble false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, translateY, scrim, screenHeight, reduceMotion]);

  const handleSubmit = () => {
    // Teksten sendes MED ÉN GANG. Å vente på utglidningen ville forsinket et
    // mål med 200 ms i kampens mest tidskritiske øyeblikk — bevegelsen er
    // pynt, registreringen er ikke.
    Keyboard.dismiss();
    onSubmit(description.trim());
    setDescription('');
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setDescription('');
    onCancel();
  };

  const title = actionTitles[actionType];
  const isComment = actionType === 'melding';
  // Mål imot feires ikke. Skifer, aldri mint — samme regel som
  // `matchColors.opponent` håndhever i forløpet.
  const ink = actionType === 'mål_dem' ? matchColors.opponentInk : colors.heia;

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      // Bevegelsen er vår egen — se filhodet.
      animationType="none"
      onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        {/* ⚠️ Kampens eget slør, ikke svart: verdenen skal SENKES bak arket,
            ikke males over. Trykk utenfor lukker. */}
        <Animated.View style={[styles.scrim, {opacity: scrim}]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View
            style={[styles.sheet, {transform: [{translateY}]}]}
            accessibilityViewIsModal>
            <View style={styles.handle} />
            <Text
              style={[styles.title, {color: ink}]}
              maxFontSizeMultiplier={1.4}>
              {title}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={actionPlaceholders[actionType]}
              placeholderTextColor={matchColors.dim}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              autoFocus
              // Feltet ER handlingen; skjermleseren skal ikke lete etter en
              // egen etikett som ikke finnes.
              accessibilityLabel={actionPlaceholders[actionType]}
            />

            <View style={styles.buttons}>
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="Avbryt"
                style={({pressed}) => [
                  styles.ghost,
                  pressed && styles.ghostPressed,
                ]}>
                <Text style={styles.ghostText}>Avbryt</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isComment && !description.trim()}
                accessibilityRole="button"
                accessibilityLabel="Rapporter"
                accessibilityState={{
                  disabled: isComment && !description.trim(),
                }}
                style={({pressed}) => [
                  styles.primary,
                  isComment && !description.trim() && styles.primaryOff,
                  pressed && styles.primaryPressed,
                ]}>
                <Text style={styles.primaryText}>Rapporter</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    // Kampens eget slør — samme farge `MatchTimeline` og `MatchPhotoRail`
    // bruker. 0.32 SENKER verdenen; 0.5 svart slukket den (4.2).
    backgroundColor: 'rgba(8, 27, 19, 0.32)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  /**
   * ⚠️ MØRKT ARK, IKKE HVITT — OG DET ER EN RETTELSE, IKKE EN SMAKSSAK.
   *
   * `CommentSheet` er lyst med vilje: krem er Heias LESEFLATE, og en tråd er
   * lesing. Dette er noe annet — det er REPORTERENS VERKTØY, og det åpnes
   * fra dokken som allerede er mørkt glass. Et hvitt kort her var det samme
   * bruddet som «Du følger kampen direkte» var i skive 2: hvite kort er
   * admin-språket i Heia, og de hører ikke hjemme midt i kampen.
   */
  sheet: {
    backgroundColor: matchColors.pulse,
    borderTopWidth: 1,
    borderTopColor: matchColors.chalkStrong,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: matchColors.chalkStrong,
    marginBottom: spacing.sm,
  },
  // Øyeblikkets tall-stemme — samme font som stillingen og minuttet.
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  input: {
    // typography.input, ikke body: lineHeight i et TextInput trigger
    // iOS-buggen der teksten rendres feil mens man skriver (RN #41240).
    ...typography.input,
    color: matchColors.text,
    // Krittkant på grunnen — aldri en hvit plate. Samme språk som
    // `ReporterActions` sine kampknapper.
    backgroundColor: 'rgba(234, 255, 246, 0.06)',
    borderWidth: 1,
    borderColor: matchColors.chalk,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 76,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ghost: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: matchColors.chalk,
  },
  ghostPressed: {
    backgroundColor: 'rgba(234, 255, 246, 0.12)',
  },
  ghostText: {
    ...typography.action,
    color: matchColors.dim,
  },
  // Mint fyll med heiaDeep blekk — samme par som «Mål oss» i dokken. Mint
  // ER feiringen, og den er lovlig på stadionmørkt.
  primary: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.heia,
  },
  primaryOff: {
    opacity: 0.4,
  },
  primaryPressed: {
    backgroundColor: colors.heiaPressed,
  },
  primaryText: {
    ...typography.action,
    color: colors.heiaDeep,
  },
});
