import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {colors, radius, spacing, typography} from '../../theme';
import {Button} from '../Button';
import {ListRow} from '../ListRow';
import {Ban, Check} from '../icons';
import type {MatchEvent} from '../../shared/types';

/**
 * KORRIGER MÅL — reporterens og lagadmins domenehandling (skive 8).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DETTE ER IKKE «REDIGER/SLETT INNLEGG», OG SPRÅKET MÅ VISE DET.
 *
 * Den generiske sletteveien i feeden er stengt for målposter (00075), fordi
 * den var en LØGN: posten forsvant, men stillingen sto på 2–1, hendelsen sto
 * i kampforløpet og varselet lå i innboksen. Brukeren trodde hun hadde
 * angret. Derfor heter handlingene her «Lagre rettelsen» og «Annuller målet»
 * — de handler om MÅLET, ikke om et innlegg.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR ET LYST ARK MIDT I DEN GRØNNE VERDENEN
 *
 * Kampens frosne retning forbyr hvite flater i SELVE KAMPEN. Et ark er ikke
 * kampen — det legger seg foran den, og `MatchPhotoSheet` har allerede
 * etablert nøyaktig dette mønsteret fra samme skjerm: reporterens verktøy
 * kommer opp som et lyst ark, kampen ligger urørt bak. Autoritetsregelen sier
 * at Heias eksisterende komponenter bestemmer; her er de `Modal` + `Button` +
 * `ListRow` + valgradene fra bildearket.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ARKET EIER INGEN SANNHET. Stillingen regnes ut på serveren
 * (`correct_match_goal` teller målhistorikken opp på nytt), og arket viser
 * den ikke engang. Å vise «2–1 blir 1–1» her ville vært en gjetning som kan
 * være feil i det øyeblikket en annen reporter skriver et mål.
 */

interface GoalCorrectionSheetProps {
  visible: boolean;
  /** Målet som korrigeres. Arket monteres med `key={event.id}`, se skjermen. */
  event: MatchEvent;
  /** Motstanderens navn — «Mål for Vålerenga» sier mer enn «Mål imot». */
  opponent: string;
  saving?: boolean;
  onSave: (input: {
    teamSide: 'home' | 'away';
    playerName: string;
    description: string;
  }) => void;
  /** Bekreftelsen ligger HER, ikke i skjermen — se `confirmCancel`. */
  onCancelGoal: () => void;
  onClose: () => void;
}

export function GoalCorrectionSheet({
  visible,
  event,
  opponent,
  saving = false,
  onSave,
  onCancelGoal,
  onClose,
}: GoalCorrectionSheetProps) {
  // ⚠️ INITIALISERES ÉN GANG, FRA `key`-EN I SKJERMEN. En `useEffect` som
  // synkroniserte mot props ville overskrevet det reporteren skriver i det
  // realtime leverer en oppdatering av den samme raden.
  const [side, setSide] = useState<'home' | 'away'>(
    event.teamSide === 'away' ? 'away' : 'home',
  );
  const [player, setPlayer] = useState(event.player ?? '');
  const [note, setNote] = useState(event.note ?? '');

  const confirmCancel = () => {
    Alert.alert(
      'Annullere målet?',
      'Målet fjernes fra kampforløpet og feeden, og stillingen regnes ut på nytt. Bilder laget har lagt ut blir liggende.',
      [
        {text: 'Behold målet', style: 'cancel'},
        {text: 'Annuller målet', style: 'destructive', onPress: onCancelGoal},
      ],
    );
  };

  const options: {value: 'home' | 'away'; label: string}[] = [
    {value: 'home', label: 'Mål for oss'},
    {value: 'away', label: `Mål for ${opponent}`},
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Korriger mål</Text>
            {/* Hvilket mål vi står i. Uten minuttet er arket løsrevet fra
                raden man trykket på. */}
            <Text style={styles.subtitle}>{event.minute}′ i kampen</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Hvem scoret?</Text>
              {options.map(opt => {
                const selected = side === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSide(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{checked: selected}}
                    style={({pressed}) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}>
                    <Text style={styles.optionText} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {selected && (
                      <Check
                        size={17}
                        color={colors.heiaInk}
                        strokeWidth={2.4}
                      />
                    )}
                  </Pressable>
                );
              })}

              <Text style={styles.label}>Målscorer</Text>
              <TextInput
                style={styles.input}
                placeholder="Navn (valgfritt)"
                placeholderTextColor={colors.textTertiary}
                value={player}
                onChangeText={setPlayer}
                accessibilityLabel="Målscorer"
                returnKeyType="next"
              />

              <Text style={styles.label}>Beskrivelse</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Hva skjedde? (valgfritt)"
                placeholderTextColor={colors.textTertiary}
                value={note}
                onChangeText={setNote}
                accessibilityLabel="Beskrivelse av målet"
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.actions}>
              <Button
                title="Avbryt"
                variant="ghost"
                onPress={onClose}
                disabled={saving}
                style={styles.action}
              />
              <Button
                title={saving ? 'Lagrer…' : 'Lagre rettelsen'}
                variant="primary"
                onPress={() =>
                  onSave({
                    teamSide: side,
                    playerName: player.trim(),
                    description: note.trim(),
                  })
                }
                disabled={saving}
                style={styles.action}
              />
            </View>

            {/* ⚠️ ANNULLERING LIGGER UNDER EN STREK, IKKE VED SIDEN AV
                «Lagre». Den er ikke den andre halvdelen av et valg — den er
                en handling med en helt annen konsekvens, og Heias mønster for
                dem er en egen rad nederst (jf. «Forlat laget» i Profil) med
                bekreftelse i en destruktiv Alert. */}
            <View style={styles.divider} />
            <ListRow
              icon={<Ban size={20} color={colors.textSecondary} />}
              title="Annuller målet"
              subtitle="Målet fjernes, stillingen regnes om"
              onPress={saving ? undefined : confirmCancel}
              showBorder={false}
            />

            {saving && (
              <ActivityIndicator
                color={colors.heiaPressed}
                style={styles.spinner}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    ...typography.heading3,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginTop: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  optionSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  optionPressed: {
    backgroundColor: colors.background,
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  input: {
    // typography.input, ikke body: lineHeight i et TextInput trigger
    // iOS-buggen der teksten rendres feil mens man skriver (RN #41240).
    ...typography.input,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 64,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  spinner: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
  },
});
