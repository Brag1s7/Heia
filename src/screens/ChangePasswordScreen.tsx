import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {BackBar, Button, useBottomContentPadding} from '../components';
import {Check} from '../components/icons';
import {useAuth} from '../context';
import {authErrorMessage} from '../shared/authErrors';

/** Samme minstelengde som registrering (AuthScreen) og
 *  `minimum_password_length` i config.toml. Ingen egen regel her. */
const MIN_PASSWORD = 6;

type Step = 'change' | 'recovery' | 'done';

/**
 * «Passord og sikkerhet» — Profil → Konto.
 *
 * SIKKERHETSGRENSEN LIGGER PÅ SERVEREN. Dashboard-bryteren «Require current
 * password when updating» er PÅ, så GoTrue krever og validerer
 * `current_password` i samme forespørsel som passordbyttet (se
 * `changePassword` i UserContext). Skjermen her er derfor en ren flate: den
 * kan ikke omgås ved å kalle noe annet, fordi det ikke er den som vokter.
 *
 * TO VEIER UT, fordi begge trengs:
 *  1. «change» — du kan det gamle passordet. Ett kall, server validerer.
 *  2. «recovery» — du har glemt det. GJENBRUKER den eksisterende
 *     glemt-passord-flyten (6-sifret e-postkode), som GoTrue eksplisitt
 *     unntar fra current_password-kravet (`!session.IsRecovery()`).
 *
 *     ⚠️ Uten (2) var dette en blindvei: `VerifyEmailScreen` bor KUN i
 *     OnboardingStack, så en innlogget bruker som ikke husker passordet sitt
 *     måtte logget UT for å komme videre. `requestPasswordReset` og
 *     `confirmPasswordReset` krever ingen utlogging — de gjenbrukes rett her.
 */
export function ChangePasswordScreen() {
  const bottomPad = useBottomContentPadding();
  const navigation = useNavigation();
  const {session, changePassword, requestPasswordReset, confirmPasswordReset} =
    useAuth();

  const email = session?.user?.email ?? '';

  const [step, setStep] = useState<Step>('change');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = repeat.length > 0 && next !== repeat;

  const handleChange = useCallback(async () => {
    setError(null);
    if (next !== repeat) {
      setError('De to nye passordene er ikke like.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      setStep('done');
    } catch (e) {
      // Feil nåværende passord ender her — og INGENTING er endret, fordi
      // serveren avviste hele forespørselen før den rørte passordet.
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [changePassword, current, next, repeat]);

  /** Bytter til recovery-sporet og sender koden med én gang, slik at
   *  skjermen aldri sier «vi har sendt …» uten at det stemmer
   *  (samme regel som AuthScreen). */
  const handleForgot = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!email) {
      setError('Fant ingen e-postadresse på kontoen din.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setStep('recovery');
      setNotice(`Vi har sendt en 6-sifret kode til ${email}`);
    } catch (e) {
      setError(authErrorMessage(e, 'Fikk ikke sendt kode nå — prøv igjen.'));
    } finally {
      setSubmitting(false);
    }
  }, [email, requestPasswordReset]);

  const handleRecovery = useCallback(async () => {
    setError(null);
    if (next !== repeat) {
      setError('De to nye passordene er ikke like.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(email, code.trim(), next);
      setStep('done');
    } catch (e) {
      setError(
        authErrorMessage(
          e,
          'Feil eller utløpt kode — sjekk sifrene, eller be om en ny.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [confirmPasswordReset, email, code, next, repeat]);

  const handleResend = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(email);
      setNotice('Ny kode er på vei 💚');
    } catch (e) {
      setError(authErrorMessage(e, 'Vent litt før du ber om en ny kode.'));
    }
  }, [email, requestPasswordReset]);

  const strongEnough = next.length >= MIN_PASSWORD;
  const canChange =
    current.length > 0 && strongEnough && next === repeat && !submitting;
  const canRecover =
    code.trim().length === 6 && strongEnough && next === repeat && !submitting;

  // ------------------------------------------------------------------ ferdig
  if (step === 'done') {
    return (
      <View style={styles.flex}>
        <BackBar />
        <View
          style={[
            styles.doneWrap,
            {paddingBottom: bottomPad},
          ]}>
          <View style={styles.doneMark}>
            <Check size={30} color={colors.heiaInk} strokeWidth={3} />
          </View>
          <Text style={styles.title}>Passordet er endret</Text>
          <Text style={styles.subtitle}>
            Du er fortsatt logget inn her. Neste gang du logger inn, bruker du
            det nye passordet.
          </Text>
          <Button
            title="Ferdig"
            onPress={() => navigation.goBack()}
            size="lg"
          />
        </View>
      </View>
    );
  }

  const isRecovery = step === 'recovery';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing.lg,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {isRecovery ? 'Nytt passord' : 'Endre passord'}
        </Text>
        <Text style={styles.subtitle}>
          {isRecovery
            ? `Skriv inn koden vi sendte til ${email}, og velg et nytt passord.`
            : 'Skriv inn det nåværende passordet ditt, og velg et nytt.'}
        </Text>

        <View style={styles.form}>
          {isRecovery ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kode fra e-post</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="123456"
                placeholderTextColor={colors.textTertiary}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nåværende passord</Text>
              <TextInput
                style={styles.input}
                placeholder="Passordet du bruker i dag"
                placeholderTextColor={colors.textTertiary}
                value={current}
                onChangeText={setCurrent}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                autoFocus
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nytt passord</Text>
            <TextInput
              style={styles.input}
              placeholder={`Minst ${MIN_PASSWORD} tegn`}
              placeholderTextColor={colors.textTertiary}
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Gjenta nytt passord</Text>
            <TextInput
              style={[styles.input, mismatch && styles.inputError]}
              placeholder="Samme en gang til"
              placeholderTextColor={colors.textTertiary}
              value={repeat}
              onChangeText={setRepeat}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {/* Sies mens du skriver, ikke først når du trykker — det er her
                feilen faktisk oppstår. */}
            {mismatch && (
              <Text style={styles.hintError}>
                De to passordene er ikke like.
              </Text>
            )}
          </View>
        </View>

        {error && (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {notice && !error && (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        )}

        <Button
          title={isRecovery ? 'Sett nytt passord' : 'Endre passord'}
          onPress={isRecovery ? handleRecovery : handleChange}
          disabled={isRecovery ? !canRecover : !canChange}
          loading={submitting}
          size="lg"
        />

        {isRecovery ? (
          <Pressable
            onPress={handleResend}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Send koden på nytt"
            accessibilityState={{disabled: submitting}}>
            <Text style={styles.link}>Send koden på nytt</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleForgot}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Glemt nåværende passord? Send meg en kode"
            accessibilityState={{disabled: submitting}}>
            <Text style={styles.link}>Glemt nåværende passord?</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing['2xl'],
    flexGrow: 1,
  },
  title: {
    ...typography.heading1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing['3xl'],
  },
  form: {
    gap: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  input: {
    ...typography.input,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  codeInput: {
    ...typography.input,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  hintError: {
    ...typography.caption,
    color: colors.error,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  notice: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },
  doneWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  doneMark: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.heiaSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
