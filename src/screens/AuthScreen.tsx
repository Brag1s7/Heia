import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, Button} from '../components';
import {useAuth} from '../context';
import {TERMS_URL, PRIVACY_URL} from '../shared/links';
import type {OnboardingStackParamList} from '../shared/types';

type Mode = 'login' | 'register';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Auth'>;

export function AuthScreen({route, navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {signIn, signUp, requestPasswordReset} = useAuth();
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        if (!displayName.trim()) {
          setError('Skriv inn navnet ditt');
          setSubmitting(false);
          return;
        }
        const {needsConfirmation} = await signUp(
          email.trim(),
          password,
          displayName.trim(),
        );
        if (needsConfirmation) {
          navigation.navigate('VerifyEmail', {
            flow: 'signup',
            email: email.trim(),
          });
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: any) {
      setError(e.message || 'Noe gikk galt');
    } finally {
      setSubmitting(false);
    }
  };

  // Koden sendes FØR navigeringen — kodeskjermen skal aldri vise
  // «vi har sendt …» uten at det stemmer.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Skriv inn e-posten din først, så sender vi deg en kode');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      navigation.navigate('VerifyEmail', {
        flow: 'recovery',
        email: email.trim(),
      });
    } catch {
      // Typisk rate limit — Supabase-teksten er engelsk og kryptisk.
      setError('Fikk ikke sendt kode akkurat nå — prøv igjen om litt');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && !submitting;

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
            paddingBottom: insets.bottom + spacing['3xl'],
          },
        ]}
        keyboardShouldPersistTaps="handled">
        {/* Tittel */}
        <Text style={styles.title}>
          {mode === 'login' ? 'Velkommen tilbake' : 'Opprett konto'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Logg inn for å se laget ditt'
            : 'Bli med i Heia'}
        </Text>

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => {
              setMode('login');
              setError(null);
            }}>
            <Text
              style={[
                styles.tabText,
                mode === 'login' && styles.tabTextActive,
              ]}>
              Logg inn
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => {
              setMode('register');
              setError(null);
            }}>
            <Text
              style={[
                styles.tabText,
                mode === 'register' && styles.tabTextActive,
              ]}>
              Registrer deg
            </Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Navn</Text>
              <TextInput
                style={styles.input}
                placeholder="Ditt navn"
                placeholderTextColor={colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>E-post</Text>
            <TextInput
              style={styles.input}
              placeholder="din@epost.no"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Passord</Text>
            <TextInput
              style={styles.input}
              placeholder="Minst 6 tegn"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
            />
            {mode === 'login' && (
              <Pressable onPress={handleForgotPassword} disabled={submitting}>
                <Text style={styles.forgotLink}>Glemt passordet?</Text>
              </Pressable>
            )}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {submitting ? (
            <ActivityIndicator
              size="large"
              color={colors.heia}
              style={styles.loader}
            />
          ) : (
            <Button
              title={mode === 'login' ? 'Logg inn' : 'Opprett konto'}
              onPress={handleSubmit}
              disabled={!canSubmit}
              size="lg"
            />
          )}

          {/* Samtykket må stå FØR kontoen opprettes — vilkårene påstår det,
              og App Store-reviewen ser etter lenkene. Sidene ligger på
              heiaapp.no og åpnes i Safari. */}
          {mode === 'register' && (
            <Text style={styles.consent}>
              Ved å opprette konto godtar du{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL(TERMS_URL)}
              >
                vilkårene
              </Text>{' '}
              og{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL(PRIVACY_URL)}
              >
                personvernerklæringen
              </Text>
              . Du må være minst 13 år.
            </Text>
          )}
        </View>
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing['2xl'],
    ...shadows.card,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.heia,
  },
  tabText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // A v2-knapperegel: mintfyll bærer heiaDeep-tekst.
  tabTextActive: {
    color: colors.heiaDeep,
    fontWeight: '700',
  },
  form: {
    gap: spacing.lg,
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
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.lg,
  },
  consent: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  consentLink: {
    color: colors.textSecondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotLink: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
});
