import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {OPAL} from '../components/OpalSurface';
import {
  GLASS_FIELD,
  LiquidGlassSurface,
} from '../components/LiquidGlassSurface';
import {
  ProfilPage,
  Button,
  Skeleton,
  TeamColorPicker,
  useBottomContentPadding,
} from '../components';
import {useAuth, useActiveTeam, useOnboarding} from '../context';
import {searchClubs, getSports, getCachedSports} from '../lib/api/teams';
import {TEAM_COLORS} from '../shared/teamColors';
import type {Sport, ClubSearchResult, CreateTeamPayload} from '../lib/types';
import type {OnboardingStackParamList} from '../shared/types';

// Brukes både i onboarding-stacken og fra Profil («Opprett et nytt lag»).
type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'CreateTeam'>;

type SelectedClub = {id?: string; name: string};

/** «Ottestad IL» → «OI», ett ord → to første tegn. */
function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

// Logo ved klubbnavnet i dropdownen — dette ER dedup-incentivet (P4): folk
// gjenbruker klubben når de SER den ferdig med logo, i stedet for å opprette
// en duplikat. Initial-sirkel som fallback.
function ClubBadge({name, logoUrl}: {name: string; logoUrl: string | null}) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <Image
        source={{uri: logoUrl}}
        style={styles.clubBadge}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.clubBadge, styles.clubBadgeFallback]}>
      <Text style={styles.clubBadgeText}>{clubInitials(name)}</Text>
    </View>
  );
}

export function CreateTeamScreen() {
  const bottomPad = useBottomContentPadding();
  const navigation = useNavigation<Nav>();
  const {session} = useAuth();
  const {userMemberships} = useActiveTeam();
  const {setPendingAction, executeCreate} = useOnboarding();

  // Se JoinTeamCodeScreen: har vi alt et lag, må vi lukke skjermen selv.
  const hadTeam = userMemberships.length > 0;

  const [teamName, setTeamName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  // Forhåndsvalgt tilfeldig palettfarge — sprer fargene mellom lag i stedet
  // for at alle blir stående på samme default. Kan byttes på Profil senere.
  const [teamColor, setTeamColor] = useState(
    () => TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)].value,
  );
  const [sports, setSports] = useState<Sport[]>(() => getCachedSports() ?? []);
  const [sportSlug, setSportSlug] = useState<string | null>(null);
  const [sportsLoading, setSportsLoading] = useState(
    () => getCachedSports() === null,
  );
  const [sportsError, setSportsError] = useState(false);
  const [sportsReloadKey, setSportsReloadKey] = useState(0);

  const [clubQuery, setClubQuery] = useState('');
  const [clubResults, setClubResults] = useState<ClubSearchResult[]>([]);
  const [clubSearching, setClubSearching] = useState(false);
  const [selectedClub, setSelectedClub] = useState<SelectedClub | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Last idretter (offentlig referansedata)
  useEffect(() => {
    let active = true;
    setSportsLoading(true);
    setSportsError(false);
    getSports()
      .then(s => {
        if (active) {
          setSports(s);
        }
      })
      .catch(() => {
        if (active) {
          setSportsError(true);
        }
      })
      .finally(() => {
        if (active) {
          setSportsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [sportsReloadKey]);

  // Klubb-autocomplete (debounced)
  useEffect(() => {
    if (selectedClub) {
      return;
    }
    const q = clubQuery.trim();
    if (q.length < 2) {
      setClubResults([]);
      return;
    }
    let active = true;
    setClubSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchClubs(q);
        if (active) {
          setClubResults(res);
        }
      } catch {
        if (active) {
          setClubResults([]);
        }
      } finally {
        if (active) {
          setClubSearching(false);
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [clubQuery, selectedClub]);

  const pickExistingClub = (c: ClubSearchResult) => {
    setSelectedClub({id: c.id, name: c.name});
    setClubQuery(c.name);
    setClubResults([]);
  };

  const createNewClub = () => {
    const name = clubQuery.trim();
    if (name.length === 0) {
      return;
    }
    setSelectedClub({name});
    setClubResults([]);
  };

  const clearClub = () => {
    setSelectedClub(null);
    setClubQuery('');
    setClubResults([]);
  };

  const canSubmit =
    teamName.trim().length > 0 &&
    !!sportSlug &&
    ageGroup.trim().length > 0 &&
    !!selectedClub &&
    !submitting;

  const handleCreate = async () => {
    if (!canSubmit || !selectedClub || !sportSlug) {
      return;
    }
    const payload: CreateTeamPayload = {
      teamName: teamName.trim(),
      sport: sportSlug,
      ageGroup: ageGroup.trim(),
      clubId: selectedClub.id,
      clubName: selectedClub.id ? undefined : selectedClub.name,
      color: teamColor,
    };

    // Auth-before-commit: gjest lagrer intent og autentiserer først.
    if (!session) {
      setPendingAction({type: 'create', payload});
      navigation.navigate('Auth', {mode: 'register'});
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // executeCreate oppdaterer memberships → AppNavigator bytter til MainTabs.
      await executeCreate(payload);
      if (hadTeam) {
        navigation.goBack();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Kunne ikke opprette laget.');
      setSubmitting(false);
    }
  };

  const showCreateRow =
    !selectedClub &&
    clubQuery.trim().length >= 2 &&
    !clubResults.some(
      c => c.name.toLowerCase() === clubQuery.trim().toLowerCase(),
    );

  return (
    <ProfilPage keyboard>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, {paddingBottom: bottomPad}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Opprett lag</Text>
        <Text style={styles.subtitle}>
          Lag et eget rom for laget. Du blir trener og får en invitasjonskode å
          dele.
        </Text>

        {/* SKJEMAET PÅ ETT PANEL (ProfilPage, 2026-09-04): feltene og
            etikettene står i glasset — én flate, ett blekk — i stedet for
            spredt over grunnens fargereise. */}
        <LiquidGlassSurface
          variant="sheet"
          detached
          style={styles.formPanel}
          // Alt som monteres SENT inne i arket (se `contentVersion`):
          // idrettene, klubbtreffene, valgt klubb, feiltekster.
          contentVersion={[
            sportsLoading,
            sportsError,
            sports.length,
            clubSearching,
            clubResults.length,
            selectedClub?.name ?? '',
            error ?? '',
          ].join('|')}>
          {/* Lagnavn */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Lagnavn</Text>
            <TextInput
              style={styles.input}
              placeholder="F.eks. Ridabu G10"
              placeholderTextColor={OPAL.inkTertiary}
              value={teamName}
              onChangeText={setTeamName}
              autoCapitalize="words"
            />
          </View>

          {/* Klubb */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Klubb</Text>
            {selectedClub ? (
              <View style={styles.selectedClub}>
                <Text style={styles.selectedClubText}>
                  {selectedClub.name}
                  {selectedClub.id ? '' : '  (ny klubb)'}
                </Text>
                <Pressable onPress={clearClub} hitSlop={8}>
                  <Text style={styles.changeText}>Endre</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Søk etter klubb…"
                  placeholderTextColor={OPAL.inkTertiary}
                  value={clubQuery}
                  onChangeText={setClubQuery}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {(clubResults.length > 0 || showCreateRow || clubSearching) && (
                  <View style={styles.dropdown}>
                    {clubSearching && clubResults.length === 0 && (
                      <Text style={styles.dropdownHint}>Søker…</Text>
                    )}
                    {clubResults.map(c => (
                      <Pressable
                        key={c.id}
                        style={styles.dropdownRow}
                        onPress={() => pickExistingClub(c)}>
                        <ClubBadge name={c.name} logoUrl={c.logoUrl} />
                        <Text style={styles.dropdownText}>{c.name}</Text>
                      </Pressable>
                    ))}
                    {showCreateRow && (
                      <Pressable
                        style={styles.dropdownRow}
                        onPress={createNewClub}>
                        <Text style={styles.dropdownCreate}>
                          + Opprett «{clubQuery.trim()}»
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Idrett */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Idrett</Text>
            {sportsLoading ? (
              <View style={styles.sportRow}>
                <Skeleton width={92} height={36} round style={styles.bone} />
                <Skeleton width={104} height={36} round style={styles.bone} />
                <Skeleton width={80} height={36} round style={styles.bone} />
              </View>
            ) : sportsError ? (
              <Pressable onPress={() => setSportsReloadKey(k => k + 1)}>
                <Text style={styles.retryText}>
                  Kunne ikke laste idretter. Trykk for å prøve igjen.
                </Text>
              </Pressable>
            ) : sports.length === 0 ? (
              <Text style={styles.emptyHint}>Ingen idretter tilgjengelig.</Text>
            ) : (
              <View style={styles.sportRow}>
                {sports.map(s => {
                  const selected = sportSlug === s.slug;
                  return (
                    <Pressable
                      key={s.id}
                      style={[
                        styles.sportPill,
                        selected && styles.sportPillSelected,
                      ]}
                      onPress={() => setSportSlug(s.slug)}>
                      <Text
                        style={[
                          styles.sportPillText,
                          selected && styles.sportPillTextSelected,
                        ]}>
                        {s.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Alder / kull */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Alder / kull</Text>
            <TextInput
              style={styles.input}
              placeholder="F.eks. G10, 2015"
              placeholderTextColor={OPAL.inkTertiary}
              value={ageGroup}
              onChangeText={setAgeGroup}
              autoCapitalize="characters"
            />
          </View>

          {/* Lagfarge */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Lagfarge</Text>
            <TeamColorPicker value={teamColor} onChange={setTeamColor} />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title="Opprett lag"
            onPress={handleCreate}
            disabled={!canSubmit}
            loading={submitting}
            size="lg"
            style={{marginTop: spacing.xl}}
          />
        </LiquidGlassSurface>
      </ScrollView>
    </ProfilPage>
  );
}

// Undersiden (ProfilPage): overskriften i reisens mørke topp → stadionblekk;
// skjemaet på ett panel → OPAL-blekk og GLASS_FIELD-felt.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Samme marger som InviteScreen, så overskriften lander likt under headeren.
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  formPanel: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  // Bones i blekk-tint: standardbonen (surfaceMuted) er usynlig på perlen.
  bone: {
    backgroundColor: 'rgba(8, 57, 46, 0.1)',
  },
  title: {
    ...typography.heading1,
    color: colors.stadiumText,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(234, 255, 246, 0.8)',
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: OPAL.inkSecondary,
  },
  input: {
    ...typography.input,
    backgroundColor: GLASS_FIELD.fill,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: GLASS_FIELD.edge,
    color: colors.textPrimary,
  },
  selectedClub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.heia,
  },
  selectedClubText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  changeText: {
    ...typography.bodySmall,
    color: OPAL.inkSecondary,
    fontWeight: '600',
  },
  // Treffslista under klubbsøket: tettere feltflate, så radene leses.
  dropdown: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: GLASS_FIELD.edge,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  dropdownHint: {
    ...typography.bodySmall,
    color: OPAL.inkTertiary,
    padding: spacing.md,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OPAL.hairline,
  },
  dropdownText: {
    ...typography.body,
    flexShrink: 1,
  },
  clubBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
  },
  clubBadgeFallback: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  // heiaInk — mint-toner er kun fyll på lys flate (A v2-regel).
  dropdownCreate: {
    ...typography.body,
    color: colors.heiaInk,
    fontWeight: '600',
  },
  sportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sportPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: GLASS_FIELD.edge,
    backgroundColor: GLASS_FIELD.fill,
  },
  sportPillSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  sportPillText: {
    ...typography.body,
    color: OPAL.inkSecondary,
  },
  sportPillTextSelected: {
    color: colors.heiaInk,
    fontWeight: '700',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: OPAL.inkTertiary,
  },
});
