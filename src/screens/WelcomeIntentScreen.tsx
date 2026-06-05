import React, {useEffect} from 'react';
import {View, Text, Pressable, StyleSheet, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {useAuth, useOnboarding} from '../context';
import {getSports} from '../lib/api/teams';
import type {OnboardingStackParamList} from '../shared/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WelcomeIntent'>;

export function WelcomeIntentScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {session} = useAuth();
  const {lastError, setLastError} = useOnboarding();

  // Forhåndslast idretter (cachet) så CreateTeam-velgeren er klar uten spinner.
  useEffect(() => {
    getSports().catch(() => {});
  }, []);

  const go = (action: () => void) => {
    setLastError(null);
    action();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.content, {paddingTop: insets.top + spacing['5xl']}]}>
        <Image
          source={require('../assets/images/logo-dark.png')}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  logo: {
    width: 240,
    height: 240,
  },
  tagline: {
    ...typography.heading3,
    color: colors.surface,
    opacity: 0.6,
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
  buttonPrimary: {
    backgroundColor: colors.heia,
  },
  buttonPrimaryText: {
    ...typography.heading3,
    color: colors.textPrimary,
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
});
