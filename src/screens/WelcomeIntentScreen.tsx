import React, {useEffect, useState} from 'react';
import {View, Text, Pressable, StyleSheet, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {StadiumSurface} from '../components';
import {useAuth, useOnboarding} from '../context';
import {confirmDeleteAccount} from '../lib/account';
import {getSports} from '../lib/api/teams';
import type {OnboardingStackParamList} from '../shared/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WelcomeIntent'>;

export function WelcomeIntentScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {session, signOut} = useAuth();
  const {lastError, setLastError} = useOnboarding();
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Forhåndslast idretter (cachet) så CreateTeam-velgeren er klar uten spinner.
  useEffect(() => {
    getSports().catch(() => {});
  }, []);

  const go = (action: () => void) => {
    setLastError(null);
    action();
  };

  return (
    <StadiumSurface style={styles.screen} bordered={false}>
      <View style={[styles.content, {paddingTop: insets.top + spacing['5xl']}]}>
        {/* Beskåret, gjennomsiktig lockup. `logo-dark.png` har koksgrå
            bakgrunn bakt inn i rasteret og tegnet en hard grå boks midt på
            stadionflaten. `logo-icon.png` er gjennomsiktig, men har så mye tom
            luft rundt merket at `contain` krymper det til en tredjedel. */}
        <Image
          source={require('../assets/images/logo-wordmark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Idrettsglede for alle</Text>
      </View>

      <View
        style={[
          styles.actions,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}>
        {lastError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}

        {/* Innlogget uten lag: skjermen må forklare seg selv — ellers er
            den identisk med utlogget-tilstanden og ser ut som om
            innloggingen ikke virket. */}
        {session && (
          <Text style={styles.signedInText}>
            Innlogget som {session.user.email} — nå mangler bare laget.
          </Text>
        )}

        <Pressable
          style={({pressed}) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => go(() => navigation.navigate('JoinTeamCode'))}>
          <Text style={styles.buttonPrimaryText}>Bli med i lag</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [
            styles.button,
            styles.buttonSecondary,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => go(() => navigation.navigate('CreateTeam'))}>
          <Text style={styles.buttonSecondaryText}>Opprett lag</Text>
        </Pressable>

        {!session && (
          <Pressable
            style={styles.loginLink}
            onPress={() => go(() => navigation.navigate('Auth', {mode: 'login'}))}>
            <Text style={styles.loginText}>Jeg har konto · Logg inn</Text>
          </Pressable>
        )}

        {/* Kontosletting MÅ være nåbar også uten lag (Apple 5.1.1(v) —
            reviewere tester med fersk, lagløs konto). Rolig stil her,
            dramaet bor i dialogene (delt flyt med Profil). */}
        {session &&
          (deletingAccount ? (
            <Text style={styles.accountStatus}>Sletter kontoen din …</Text>
          ) : (
            <View style={styles.accountRow}>
              <Pressable
                onPress={() => go(() => signOut())}
                disabled={deletingAccount}>
                <Text style={styles.accountLink}>Logg ut</Text>
              </Pressable>
              <Text style={styles.accountDot}>·</Text>
              <Pressable
                onPress={() =>
                  confirmDeleteAccount({
                    setDeleting: setDeletingAccount,
                    signOut,
                  })
                }
                disabled={deletingAccount}>
                <Text style={styles.accountLink}>Slett konto</Text>
              </Pressable>
            </View>
          ))}
      </View>
    </StadiumSurface>
  );
}

const styles = StyleSheet.create({
  // Stadionflaten (A v2) — appens første møte bærer kamp-signaturen,
  // nå med ekte flomlys-gradienter i full skjerm.
  screen: {
    flex: 1,
    borderRadius: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  logo: {
    // Merkets eget sideforhold (1983×1025 ≈ 1.935) — ingen tom luft å fylle.
    width: 260,
    height: 134,
  },
  tagline: {
    ...typography.heading3,
    color: colors.stadiumDim,
    marginTop: spacing.sm,
  },
  actions: {
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.surface,
    textAlign: 'center',
  },
  button: {
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  // Hovedhandlingen — mintfyll + heiaDeep-tekst (A v2-knapperegelen).
  buttonPrimary: {
    backgroundColor: colors.heia,
  },
  buttonPrimaryText: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
  },
  buttonSecondaryText: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  loginText: {
    ...typography.body,
    color: colors.surface,
    opacity: 0.7,
  },
  // Innlogget-uten-lag: identitet + hva som mangler, i loginText-språket.
  signedInText: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  accountStatus: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  accountLink: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.7,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  accountDot: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.5,
  },
});
