import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {BackBar, Button, StadiumSurface} from '../components';
import {useAuth} from '../context';
import {authErrorMessage} from '../shared/authErrors';
import type {OnboardingStackParamList} from '../shared/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'VerifyEmail'>;

/**
 * 6-sifret kode fra e-post — broen uten deep links (native-runden er
 * ikke gjort, og kode-i-app er uansett enkleste flyt på telefon).
 *
 * 'signup': bekreft ny konto. 'recovery': kode + nytt passord i ett.
 * Begge ender i session via verifyOtp — RootNavigator bytter til appen
 * av seg selv, skjermen navigerer aldri videre.
 */
export function VerifyEmailScreen({route}: Props) {
  const insets = useSafeAreaInsets();
  const {flow, email} = route.params;
  const {
    confirmSignup,
    resendSignupCode,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isRecovery = flow === 'recovery';

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (isRecovery) {
        await confirmPasswordReset(email, code.trim(), newPassword);
      } else {
        await confirmSignup(email, code.trim());
      }
      // Session er satt → RootNavigator tar over. La spinneren stå.
    } catch (e) {
      // Fallbacken dekker den vanlige saken; authErrorMessage slipper en mer
      // presis feil (svakt passord, rate limit) forbi når den finnes.
      setError(
        authErrorMessage(
          e,
          'Feil eller utløpt kode — sjekk sifrene, eller be om en ny.',
        ),
      );
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResent(false);
    try {
      if (isRecovery) {
        await requestPasswordReset(email);
      } else {
        await resendSignupCode(email);
      }
      setResent(true);
    } catch (e) {
      // Typisk rate limit («For security purposes …») — si det rolig.
      setError(authErrorMessage(e, 'Vent litt før du ber om en ny kode.'));
    }
  };

  const canSubmit =
    code.trim().length === 6 &&
    (!isRecovery || newPassword.length >= 6) &&
    !submitting;

  return (
    /* Samme mørke grunn som innloggingen og velkomstskjermen — hele
       utlogget-sekvensen er én flate (se AuthScreen). */
    <StadiumSurface style={styles.flex} bordered={false}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar variant="stadium" />
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: spacing.lg,
              paddingBottom: insets.bottom + spacing['3xl'],
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {isRecovery ? 'Nytt passord' : 'Sjekk e-posten din'}
          </Text>
          <Text style={styles.subtitle}>
            Vi har sendt en 6-sifret kode til {email}
          </Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kode</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="123456"
                placeholderTextColor={colors.stadiumDim}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoFocus
              />
            </View>

            {isRecovery && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nytt passord</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minst 6 tegn"
                  placeholderTextColor={colors.stadiumDim}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
              </View>
            )}
          </View>

          {error && (
            <Text
              style={styles.error}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          {resent && !error && (
            <Text style={styles.resent} accessibilityLiveRegion="polite">
              Ny kode er på vei 💚
            </Text>
          )}

          {/* Knappen beholder plassen sin og laster i seg selv. Her betyr det
            ekstra mye: ved suksess blir skjermen STÅENDE til RootNavigator
            bytter (se handleSubmit), så en spinner uten kontekst ville vært
            det siste bildet av registreringen. */}
          <Button
            title={isRecovery ? 'Sett nytt passord' : 'Bekreft'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            size="lg"
          />

          <Pressable
            onPress={handleResend}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Send koden på nytt"
            accessibilityState={{disabled: submitting}}>
            <Text style={styles.resendLink}>Send koden på nytt</Text>
          </Pressable>

          {!isRecovery && (
            <Text style={styles.hint}>
              Får du ingen kode? Kanskje du allerede har en konto — gå tilbake
              og logg inn i stedet.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </StadiumSurface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    borderRadius: 0,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing['2xl'],
    flexGrow: 1,
  },
  title: {
    ...typography.heading1,
    color: colors.stadiumText,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.stadiumDim,
    marginBottom: spacing['3xl'],
  },
  // Speiler AuthScreen-formens språk (uppercase-etiketter, kantede felt).
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
    color: colors.stadiumDim,
  },
  input: {
    ...typography.input,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stadiumEdge,
    color: colors.stadiumText,
  },
  codeInput: {
    ...typography.input,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stadiumEdge,
    color: colors.stadiumText,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  error: {
    ...typography.bodySmall,
    // colors.error (#EF4444) faller til 3,7:1 mot gradientens nedre ende
    // (#143126). colors.live er samme betydning og måler 4,6:1.
    color: colors.live,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  resent: {
    ...typography.bodySmall,
    color: colors.stadiumDim,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  resendLink: {
    ...typography.bodySmall,
    color: colors.stadiumDim,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.caption,
    color: colors.stadiumDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
