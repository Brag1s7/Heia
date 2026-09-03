import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, Button, Skeleton, TeamBadge, useBottomContentPadding} from '../components';
import {Check} from '../components/icons';
import {useAuth, useActiveTeam, useOnboarding} from '../context';
import {lookupInviteCode, getMyTeamHistory} from '../lib/api/teams';
import {
  assessReentry,
  type ReentryAssessment,
} from '../shared/teamReentry';
import {ROLE_LABELS} from '../shared/roles';
import type {InviteCodeResult, MemberRole} from '../lib/types';
import type {OnboardingStackParamList} from '../shared/types';

// Skjermen brukes både i onboarding-stacken og fra Profil («Bli med i et lag
// til»), så navigasjonen hentes via hooks i stedet for skjerm-props.
type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'JoinTeamCode'>;
type Route = RouteProp<OnboardingStackParamList, 'JoinTeamCode'>;

type JoinRole = Extract<MemberRole, 'forelder' | 'supporter' | 'trener'>;

const ROLES: {key: JoinRole; label: string; description: string}[] = [
  {key: 'forelder', label: 'Forelder', description: 'Følger barnet'},
  {key: 'supporter', label: 'Supporter', description: 'Heier på laget'},
  {key: 'trener', label: 'Trener', description: 'Leder laget'},
];

export function JoinTeamCodeScreen() {
  const bottomPad = useBottomContentPadding();
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

  // §3a/b-portene (FORLAT-LAG-DORMANT, 00067): egne medlemsrader i laget
  // (alle statuser er lesbare — 00066) avgjør hva flaten skal tilby FØR
  // knappen trykkes. Serveren håndhever uansett — dette er UX-siden.
  // null = ukjent (gjest, eller henting pågår/feilet mot eldre DB).
  const [reentry, setReentry] = useState<ReentryAssessment | null>(null);
  const userId = session?.user?.id;
  useEffect(() => {
    let cancelled = false;
    setReentry(null);
    if (!result || !userId) {
      return;
    }
    getMyTeamHistory(userId, result.id)
      .then(rows => {
        if (!cancelled) {
          setReentry(assessReentry(rows));
        }
      })
      .catch(() => {
        // Uten historikk-svar: behandle som ukjent bruker — serveren er
        // porten, flaten skal bare ikke love noe den ikke vet.
        if (!cancelled) {
          setReentry(assessReentry([]));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [result, userId]);

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

  // Portenes UX-avledning. `hasActiveAdmin === false` = laget er låst
  // (§3a — ingen aktiv lagadmin); undefined (eldre DB) = behandle som åpent.
  const locked = result?.hasActiveAdmin === false;
  // §3b: siste episode var en fjerning → koden virker aldri, i noe lag.
  const blockedRemoved = !!reentry?.blockedRemoved;
  // Låst lag + kjent historikk uten adgang: ærlig stopp med kontaktvei.
  const lockedOut =
    locked &&
    !!session &&
    reentry !== null &&
    !reentry.resident &&
    !reentry.leftVoluntarily &&
    reentry.reopenRole === null;
  // §3f-2: «Gjenåpne laget» vises kun i låst lag, for kvalifisert historikk.
  const reopenRole = locked ? (reentry?.reopenRole ?? null) : null;
  const canJoin = !blockedRemoved && !lockedOut;

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
      const joined = await executeJoin(normalizedCode, role);
      // §5: «Jeg er trener» ga aktivt medlemskap som supporter + stående
      // forespørsel — det skal sies med en gang, ikke oppdages i rosteret.
      if (joined.pendingRole === 'trener') {
        Alert.alert(
          'Du er med i laget',
          'En trener eller lagleder godkjenner trenerrollen din — til da er du med som supporter.',
        );
      }
      if (hadTeam) {
        navigation.goBack();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Kunne ikke bli med i laget.');
      setSubmitting(false);
    }
  };

  // «Gjenåpne laget» (§3f-2) — uttrykkelig valg som gjeninnsetter den gamle
  // trener-/laglederrollen i samme bevisste handling. Vaktes server-side av
  // §3b-historikken; flaten viser valget kun når den SER myndigheten.
  const handleReopen = async () => {
    if (!result || !session) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await executeJoin(code.trim().toUpperCase(), 'forelder', {reopen: true});
      if (hadTeam) {
        navigation.goBack();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Kunne ikke gjenåpne laget.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <BackBar />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: bottomPad},
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

        {!result && (
          <Button
            title="Finn lag"
            onPress={() => runLookup(code)}
            disabled={code.trim().length === 0}
            loading={loading}
            size="lg"
            style={{marginTop: spacing.lg}}
          />
        )}

        {/* Skjelettet har SAMME geometri som lagkortet under, så laget glir
            inn i formen som allerede står der i stedet for å dukke opp under
            en spinner. Dette er øyeblikket forelderen finner laget sitt. */}
        {loading && (
          <View
            style={styles.resultBlock}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Søker etter laget">
            <View style={styles.teamCard}>
              <Skeleton width={44} height={44} style={styles.badgeBone} />
              <View style={styles.teamInfoBones}>
                <Skeleton width="55%" height={18} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          </View>
        )}

        {error && (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        {result && (
          <View style={styles.resultBlock}>
            <View style={styles.teamCard}>
              {/* Lagets eget merke — TeamBadge eier kjeden laglogo →
                  klubblogo → initialer på lagfarge. Fargeflaten var det ene
                  stedet i appen der merket ikke fikk vises. */}
              <TeamBadge
                name={result.displayName}
                logoUrl={result.logoUrl}
                color={result.color}
                size={44}
                cornerRadius={radius.sm}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{result.displayName}</Text>
                <Text style={styles.teamMeta}>
                  {result.clubName} · {result.sport} · {result.memberCount}{' '}
                  {result.memberCount === 1 ? 'medlem' : 'medlemmer'}
                </Text>
              </View>
            </View>

            {/* §3b: fjernet sist → ærlig stopp, aldri en død knapp. */}
            {blockedRemoved && (
              <Text style={styles.stopText} accessibilityRole="alert">
                Du ble fjernet fra dette laget. En trener eller lagleder må
                slippe deg inn igjen.
              </Text>
            )}

            {/* §3a: låst lag uten adgangsgivende historikk. */}
            {!blockedRemoved && lockedOut && (
              <Text style={styles.stopText} accessibilityRole="alert">
                Dette laget tar ikke imot nye medlemmer akkurat nå. Ta kontakt
                på hello@heiaapp.no hvis du mener dette er feil.
              </Text>
            )}

            {/* Gjest mot låst lag: serveren er porten — men si det ærlig,
                så ingen registrerer seg forgjeves uten grunn. */}
            {canJoin && locked && !session && (
              <Text style={styles.noteText}>
                Dette laget har ingen aktiv trener akkurat nå. Har du vært
                medlem før, kan du logge inn og fortsette — ellers kan du ta
                kontakt på hello@heiaapp.no.
              </Text>
            )}

            {/* §3f-2: «Gjenåpne laget» — et UTTRYKKELIG valg over rollelista,
                aldri en bivirkning av vanlig innmelding. */}
            {canJoin && reopenRole && (
              <View style={styles.reopenCard}>
                <Text style={styles.reopenTitle}>Gjenåpne laget</Text>
                <Text style={styles.reopenBody}>
                  Du var{' '}
                  {(
                    ROLE_LABELS[reopenRole as keyof typeof ROLE_LABELS] ??
                    reopenRole
                  ).toLowerCase()}{' '}
                  her og meldte deg ut selv. Du kan gjenåpne laget og få
                  rollen tilbake — eller bli med som vanlig under.
                </Text>
                <Button
                  title="Gjenåpne laget"
                  onPress={handleReopen}
                  loading={submitting}
                  size="lg"
                  style={{marginTop: spacing.md}}
                />
              </View>
            )}

            {canJoin && (
              <>
                <Text style={styles.sectionLabel}>Din rolle</Text>
                {/* Rollene sto som tre kort side om side, og «Supporter» brøt
                    over to linjer på en tredjedels skjermbredde. Fullbredde-
                    rader løser det permanent: ordene kan ikke klemmes,
                    beskrivelsen får plass ved siden av, og valget tåler
                    forstørret skrift (der 3-kolonners kort uansett ville
                    sprukket). */}
                <View style={styles.roleList} accessibilityRole="radiogroup">
                  {ROLES.map(r => {
                    const selected = role === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        style={[
                          styles.roleRow,
                          selected && styles.roleRowSelected,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{selected, checked: selected}}
                        accessibilityLabel={`${r.label} — ${r.description}`}
                        onPress={() => setRole(r.key)}>
                        <View style={styles.roleText}>
                          <Text style={styles.roleLabel}>{r.label}</Text>
                          <Text style={styles.roleDesc}>{r.description}</Text>
                        </View>
                        <View
                          style={[
                            styles.roleMark,
                            selected && styles.roleMarkOn,
                          ]}>
                          {selected && (
                            <Check
                              size={14}
                              color={colors.heiaDeep}
                              strokeWidth={3}
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* §5: koden gir aldri trenerrollen direkte — si det FØR
                    valget bekreftes, ikke som en overraskelse etterpå. */}
                {role === 'trener' && (
                  <Text style={styles.noteText}>
                    En trener eller lagleder i laget godkjenner deg — til da
                    er du med som supporter.
                  </Text>
                )}

                <Button
                  title="Bli med"
                  onPress={handleContinue}
                  loading={submitting}
                  size="lg"
                  style={{marginTop: spacing.xl}}
                />
              </>
            )}
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
  // Skjelettets utgave av lagmerket — samme flate, bonen eier fargen.
  badgeBone: {
    borderRadius: radius.sm,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  // Som teamInfo, men bones trenger luft der teksten har linjehøyde.
  teamInfoBones: {
    flex: 1,
    gap: spacing.sm,
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
  // Portenes stopptekst — informasjon med kontaktvei, ikke en feilfarge:
  // brukeren har ikke gjort noe galt.
  stopText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xl,
    lineHeight: 22,
  },
  noteText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  // «Gjenåpne laget» (§3f-2) — eget kort så det uttrykkelige valget aldri
  // blandes med rollelista under.
  reopenCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.heia,
    padding: spacing.lg,
  },
  reopenTitle: {
    ...typography.heading3,
  },
  reopenBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  roleList: {
    gap: spacing.md,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  roleRowSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  roleText: {
    flex: 1,
    gap: 2,
  },
  roleLabel: {
    ...typography.heading3,
  },
  roleDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  // Radioprikken: tom ring til den er valgt, da mintfylt med hake.
  roleMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMarkOn: {
    backgroundColor: colors.heia,
    borderColor: colors.heia,
  },
});
