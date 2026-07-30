import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Button} from '../components';
import {useAuth, useActiveTeam, useOnboarding} from '../context';
import {lookupInviteCode} from '../lib/api/teams';
import type {InviteCodeResult, MemberRole} from '../lib/types';
import type {OnboardingStackParamList} from '../shared/types';

// Skjermen brukes både i onboarding-stacken og fra Profil («Bli med i et lag
// til»), så navigasjonen hentes via hooks i stedet for skjerm-props.
type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'JoinTeamCode'>;
type Route = RouteProp<OnboardingStackParamList, 'JoinTeamCode'>;

type JoinRole = Extract<MemberRole, 'forelder' | 'trener'>;

const ROLES: {key: JoinRole; label: string; description: string}[] = [
  {key: 'forelder', label: 'Forelder', description: 'Følger barnet'},
  {key: 'trener', label: 'Trener', description: 'Leder laget'},
];

export function JoinTeamCodeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {session} = useAuth();
  const {userMemberships} = useActiveTeam();
  const {setPendingAction, executeJoin} = useOnboarding();

  // Har brukeren alt et lag, bytter ikke AppNavigator skjerm for oss —
  // da står vi i Profil-stacken og må lukke skjermen selv.
  const hadTeam = userMemberships.length > 0;

  const [code, setCode] = useState(route.params?.prefillCode ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteCodeResult | null>(null);
  const [role, setRole] = useState<JoinRole>('forelder');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const runLookup = useCallback(async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (c.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await lookupInviteCode(c);
      if (!r) {
        setError('Fant ingen aktivt lag med denne koden.');
      } else {
        setResult(r);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-oppslag hvis vi kom inn med en forhåndsutfylt kode (invite-link senere).
  useEffect(() => {
    const pre = route.params?.prefillCode;
    if (pre) {
      runLookup(pre);
    }
  }, [route.params?.prefillCode, runLookup]);

  const onChangeCode = (text: string) => {
    setCode(text);
    if (result) {
      setResult(null);
    }
    if (error) {
      setError(null);
    }
  };

  const handleContinue = async () => {
    if (!result) {
      return;
    }
    const normalizedCode = code.trim().toUpperCase();

    // Auth-before-commit: gjest lagrer intent og autentiserer først.
    if (!session) {
      setPendingAction({type: 'join', inviteCode: normalizedCode, role});
      navigation.navigate('Auth', {mode: 'register'});
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // executeJoin oppdaterer memberships → AppNavigator bytter til MainTabs.
      await executeJoin(normalizedCode, role);
      if (hadTeam) {
        navigation.goBack();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Kunne ikke bli med i laget.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Tilbake-knappen kommer fra stack-headeren, som overalt ellers. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Bli med i laget</Text>
        <Text style={styles.subtitle}>Skriv inn invitasjonskoden du har fått</Text>

        <TextInput
          style={styles.codeInput}
          placeholder="F.eks. ABCD2345"
          placeholderTextColor={colors.textTertiary}
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />

        {loading ? (
          <ActivityIndicator
            color={colors.heia}
            style={{marginTop: spacing.xl}}
          />
        ) : (
          !result && (
            <Button
              title="Finn lag"
              onPress={() => runLookup(code)}
              disabled={code.trim().length === 0}
              size="lg"
              style={{marginTop: spacing.lg}}
            />
          )
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {result && (
          <View style={styles.resultBlock}>
            <View style={styles.teamCard}>
              <View
                style={[styles.teamDot, {backgroundColor: result.color}]}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{result.displayName}</Text>
                <Text style={styles.teamMeta}>
                  {result.clubName} · {result.sport} · {result.memberCount}{' '}
                  {result.memberCount === 1 ? 'medlem' : 'medlemmer'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Din rolle</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => {
                const selected = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    style={[styles.roleCard, selected && styles.roleCardSelected]}
                    onPress={() => setRole(r.key)}>
                    <Text style={styles.roleLabel}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.description}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              title="Bli med"
              onPress={handleContinue}
              loading={submitting}
              size="lg"
              style={{marginTop: spacing.xl}}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Samme marger som InviteScreen, så overskriften lander likt under headeren.
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.heading1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing['2xl'],
  },
  codeInput: {
    ...typography.heading2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 4,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  resultBlock: {
    marginTop: spacing['2xl'],
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  teamDot: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    ...typography.heading3,
  },
  teamMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  roleCardSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  roleLabel: {
    ...typography.heading3,
  },
  roleDesc: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
