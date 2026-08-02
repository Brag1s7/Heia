import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar, BackBar, ListRowSkeleton, Skeleton} from '../components';
import {MoreHorizontal} from '../components/icons';
import {useAuth, useActiveTeam} from '../context';
import {isTeamAdmin, ROLE_LABELS} from '../shared/roles';
import {
  getTeamMembers,
  removeTeamMember,
  type TeamMember,
} from '../lib/api/members';
import type {ProfilStackParamList, UserRole} from '../shared/types';

type Nav = NativeStackNavigationProp<ProfilStackParamList, 'TeamMembers'>;

/**
 * Seksjonene lagoversikten deles i. Trener/lagleder/admin står sammen fordi
 * det er «de som styrer laget» sett fra en forelder — rollen står som badge
 * på raden uansett.
 */
const SECTIONS: {title: string; roles: UserRole[]}[] = [
  {title: 'Trenere og lagledere', roles: ['trener', 'lagleder', 'admin']},
  {title: 'Foreldre', roles: ['forelder']},
  {title: 'Spillere', roles: ['spiller']},
];

/** Underteksten på en rad: hvilke barn personen følger, ellers rollen. */
function subtitleFor(member: TeamMember): string {
  if (member.childNames.length > 0) {
    const names =
      member.childNames.length === 1
        ? member.childNames[0]
        : `${member.childNames.slice(0, -1).join(', ')} og ${
            member.childNames[member.childNames.length - 1]
          }`;
    return `${ROLE_LABELS[member.role]} til ${names}`;
  }
  return ROLE_LABELS[member.role];
}

export function TeamMembersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {session} = useAuth();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myId = session?.user?.id;
  const amAdmin = isTeamAdmin(activeRole);

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      setMembers(await getTeamMembers(activeTeamSpaceId));
    } catch {
      setError('Kunne ikke laste laget. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // RPC-en sorterer allerede etter rollehierarki og navn, så seksjonene kan
  // bare plukke ut sine egne rader og beholde rekkefølgen.
  const sections = useMemo(
    () =>
      SECTIONS.map(s => ({
        title: s.title,
        data: members.filter(m => s.roles.includes(m.role)),
      })).filter(s => s.data.length > 0),
    [members],
  );

  // Fjerning (Apple 1.2, «block abusive users» i lukket lag): kun
  // trener/lagleder, aldri deg selv, aldri andre admins — RPC-en (00041) er
  // vakten, UI-et speiler den. Innholdet personen har delt blir stående.
  const handleRemove = useCallback(
    (member: TeamMember) => {
      if (!activeTeamSpaceId) return;
      const teamName = activeTeamSpace?.displayName ?? 'laget';
      const childPart =
        member.childNames.length > 0 ? ' Barna deres fjernes også.' : '';
      Alert.alert(
        `Fjerne ${member.name} fra laget?`,
        `${member.name} mister tilgangen til ${teamName} med en gang.${childPart} Innlegg og kommentarer de har delt blir stående.`,
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Fjern fra laget',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeTeamMember(activeTeamSpaceId, member.id);
              } catch {
                Alert.alert('Kunne ikke fjerne', 'Prøv igjen om litt.');
              }
              load();
            },
          },
        ],
      );
    },
    [activeTeamSpaceId, activeTeamSpace, load],
  );

  const handleContact = useCallback((member: TeamMember) => {
    const phone = member.phone;
    if (!phone) return;
    // Nummeret er den eneste kontaktveien i appen (ingen DM-er), så vi lar
    // brukeren velge kanal i stedet for å gjette.
    Alert.alert(member.name, phone, [
      {text: 'Avbryt', style: 'cancel'},
      {text: 'Send melding', onPress: () => Linking.openURL(`sms:${phone}`)},
      {text: 'Ring', onPress: () => Linking.openURL(`tel:${phone}`)},
    ]);
  }, []);

  if (!activeTeamSpaceId) return null;

  if (loading) {
    return (
      <View style={styles.screen}>
        <BackBar title="Lagoversikt" />
        {/* Lagnavnet er kjent fra context — bare medlemmene lastes. */}
        <View style={styles.header}>
          <Text style={styles.teamName}>
            {activeTeamSpace?.displayName ?? 'Laget'}
          </Text>
          <Skeleton width={80} height={12} />
        </View>
        <View style={styles.section}>
          <Skeleton width={110} height={11} />
          <View style={styles.card}>
            <ListRowSkeleton />
            <ListRowSkeleton />
            <ListRowSkeleton />
            <ListRowSkeleton showBorder={false} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <BackBar title="Lagoversikt" />
      <ScrollView
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.heia}
        />
      }>
      <View style={styles.header}>
        <Text style={styles.teamName}>
          {activeTeamSpace?.displayName ?? 'Laget'}
        </Text>
        <Text style={styles.count}>
          {members.length === 1 ? '1 medlem' : `${members.length} medlemmer`}
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionDash} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <View style={styles.card}>
            {section.data.map((member, i) => {
              const isMe = member.id === myId;
              const canContact = !!member.phone && !isMe;
              // Speiler RPC-vaktene: aldri deg selv, aldri trener/lagleder.
              const canRemove =
                amAdmin && !isMe && !isTeamAdmin(member.role);
              return (
                <Pressable
                  key={member.id}
                  disabled={!canContact}
                  onPress={() => handleContact(member)}
                  style={({pressed}) => [
                    styles.row,
                    i < section.data.length - 1 && styles.rowBorder,
                    pressed && canContact && styles.rowPressed,
                  ]}>
                  <Avatar uri={member.avatarUrl} name={member.name} size="md" />
                  <View style={styles.rowText}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {isMe && <Text style={styles.you}>deg</Text>}
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {subtitleFor(member)}
                    </Text>
                  </View>
                  {member.status === 'invited' && (
                    <View style={styles.pendingChip}>
                      <Text style={styles.pendingText}>Invitert</Text>
                    </View>
                  )}
                  {canContact && <Text style={styles.contactIcon}>📞</Text>}
                  {canRemove && (
                    <Pressable
                      onPress={() => handleRemove(member)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Flere valg for ${member.name}`}
                      style={({pressed}) => [
                        styles.moreBtn,
                        pressed && styles.morePressed,
                      ]}>
                      <MoreHorizontal
                        size={18}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {/* Inviter hører hjemme her: det er når du ser hvem som mangler at du
          vil hente dem inn. */}
      <View style={styles.section}>
        <Pressable
          onPress={() => navigation.navigate('Invite')}
          style={({pressed}) => [
            styles.inviteCard,
            pressed && styles.rowPressed,
          ]}>
          <Text style={styles.inviteIcon}>＋</Text>
          <View style={styles.rowText}>
            <Text style={styles.inviteTitle}>Inviter til laget</Text>
            <Text style={styles.subtitle}>Del invitasjonskoden</Text>
          </View>
        </Pressable>
      </View>

      {amAdmin && activeRole && (
        <Text style={styles.footnote}>
          Du ser telefonnumre fordi du er{' '}
          {ROLE_LABELS[activeRole].toLowerCase()}. Andre i laget ser dem ikke.
        </Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 2,
  },
  teamName: {
    ...typography.heading2,
  },
  count: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 64,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowPressed: {
    backgroundColor: colors.heiaSoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  you: {
    ...typography.caption,
    color: colors.heiaInk,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  pendingChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pendingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  contactIcon: {
    fontSize: 18,
  },
  moreBtn: {
    padding: 2,
  },
  morePressed: {
    opacity: 0.5,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 64,
    ...shadows.card,
  },
  inviteIcon: {
    fontSize: 22,
    width: 40,
    textAlign: 'center',
    color: colors.heiaInk,
  },
  inviteTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  footnote: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    lineHeight: 18,
  },
});
