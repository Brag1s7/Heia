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
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {BackBar, Button, StadiumSurface} from '../components';
import {useAuth} from '../context';
import {authErrorMessage} from '../shared/authErrors';
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
    } catch (e) {
      // Supabase-feilene er ENGELSKE. Rå `e.message` sto her og sendte dem
      // rett ut i en norsk flyt — ufarlig så lenge de i praksis var «feil
      // e-post eller passord», men passordreglene (minstelengde, og
      // HaveIBeenPwned-sjekken når den skrus på) treffer helt vanlige
      // foreldre midt i registreringen.
      setError(authErrorMessage(e));
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
    } catch (e) {
      // Typisk rate limit — Supabase-teksten er engelsk og kryptisk.
      setError(
        authErrorMessage(
          e,
          'Fikk ikke sendt kode akkurat nå — prøv igjen om litt',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && !submitting;

  return (
    /* ⚠️ SAMME FLATE SOM RESTEN AV UTLOGGET-SEKVENSEN (Brage 2026-09-07:
       «samme bakgrunn på logg inn siden som de to andre når man ikke er
       logget inn»). Ikon → LaunchScreen.storyboard → BootScreen →
       WelcomeIntent er én sammenhengende mørk stadionflate; innloggingen lå
       som et hvitt blink midt i den. Nå bærer den samme grunn, og blekket
       følger stadionvokabularet (stadiumText/stadiumDim), ikke krem-appens.
       Statuslinjen må lyses opp mens skjermen står — App.tsx sitt
       `dark-content` er skrevet for kremflaten. */
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
          <View style={styles.tabRow} accessibilityRole="tablist">
            <Pressable
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{selected: mode === 'login'}}
              accessibilityLabel="Logg inn"
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
              accessibilityRole="tab"
              accessibilityState={{selected: mode === 'register'}}
              accessibilityLabel="Registrer deg"
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
                  placeholderTextColor={colors.stadiumDim}
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
                placeholderTextColor={colors.stadiumDim}
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
                placeholderTextColor={colors.stadiumDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
              {mode === 'login' && (
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Glemt passordet? Send meg en kode">
                  <Text style={styles.forgotLink}>Glemt passordet?</Text>
                </Pressable>
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

            {/* Knappen BYTTES ikke ut med en spinner: da forsvinner handlingen
              du nettopp trykket på, og alt under hopper oppover. Button har
              sin egen laste-tilstand — flaten står stille. */}
            <Button
              title={mode === 'login' ? 'Logg inn' : 'Opprett konto'}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              size="lg"
            />

            {/* Samtykket må stå FØR kontoen opprettes — vilkårene påstår det,
              og App Store-reviewen ser etter lenkene. Sidene ligger på
              heiaapp.no og åpnes i Safari. */}
            {mode === 'register' && (
              <Text style={styles.consent}>
                Ved å opprette konto godtar du{' '}
                <Text
                  style={styles.consentLink}
                  accessibilityRole="link"
                  accessibilityLabel="Vilkår for bruk, åpnes i nettleser"
                  onPress={() => Linking.openURL(TERMS_URL)}>
                  vilkårene
                </Text>{' '}
                og{' '}
                <Text
                  style={styles.consentLink}
                  accessibilityRole="link"
                  accessibilityLabel="Personvernerklæring, åpnes i nettleser"
                  onPress={() => Linking.openURL(PRIVACY_URL)}>
                  personvernerklæringen
                </Text>
                . Du må være minst 13 år.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StadiumSurface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    // Stadionflaten eier bakgrunnen — ingen egen farge her, ellers ville
    // gradientene ligget under en solid plate.
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
  // Ingen kortskygge på stadionflaten: en skygge trenger en lys grunn å
  // falle på. Sporet er en dempet fordypning i flaten i stedet.
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing['2xl'],
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
    color: colors.stadiumDim,
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
  error: {
    ...typography.bodySmall,
    // colors.error (#EF4444) faller til 3,7:1 mot gradientens nedre ende
    // (#143126). colors.live er samme betydning og måler 4,6:1.
    color: colors.live,
    textAlign: 'center',
  },
  consent: {
    ...typography.caption,
    color: colors.stadiumDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  consentLink: {
    color: colors.stadiumText,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotLink: {
    ...typography.bodySmall,
    color: colors.stadiumDim,
    fontWeight: '600',
    textDecorationLine: 'underline',
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
});
