import React, {useCallback, useMemo} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {
  Avatar,
  BackBar,
  ListRowSkeleton,
  Skeleton,
  useBottomContentPadding,
} from '../components';
import {MoreHorizontal} from '../components/icons';
import {useAuth, useActiveTeam} from '../context';
import {isTeamAdmin, ROLE_LABELS} from '../shared/roles';
import {
  removeMemberAvatar,
  removeTeamMember,
  setMemberRole,
  declineRoleRequest,
  type TeamMember,
} from '../lib/api/members';
import {errorMessage} from '../shared/errorMessage';
import {avatarRef} from '../lib/media/avatar';
import {promptReport} from '../lib/moderation';
import {useTeamMembers, invalidateTeamMembers} from '../lib/queries/members';
import {useScreenFocusRefetch} from '../lib/queries/useScreenFocusRefetch';
import {queryKeys} from '../lib/queries/keys';
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
  {title: 'Supportere', roles: ['supporter']},
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
  const bottomPad = useBottomContentPadding();
  const navigation = useNavigation<Nav>();
  const {session} = useAuth();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();

  // Skjermen hadde egen lokal state og hentet PÅ NYTT ved hvert fokus, med
  // `loading` fra true — så skeletonene kom tilbake hver eneste gang man gikk
  // inn, også rett etter at man var her (A3-dogfood 2026-08-19). Den delte
  // heller ikke data med resten av appen, enda medlemslisten allerede lå i
  // query-cachen fra B2 (kommentartråden bruker den). Nå: samme cache, samme
  // 5-minutters staleTime, og 60 s-regelen ved fokus.
  const {
    data: members = [],
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useTeamMembers(activeTeamSpaceId);
  useScreenFocusRefetch(queryKeys.members(activeTeamSpaceId ?? ''));

  const myId = session?.user?.id;
  const amAdmin = isTeamAdmin(activeRole);

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
              invalidateTeamMembers(activeTeamSpaceId);
            },
          },
        ],
      );
    },
    [activeTeamSpaceId, activeTeamSpace],
  );

  // Rollemenyen (00067): synlig rolleadministrasjon — set_member_role er
  // vakten (kun personlige rader, aldri spillere, laget kan aldri stå uten
  // aktiv trener/lagleder), UI-et speiler den. Dette er også veien siste-
  // admin-vakten i «Forlat laget» deep-linker til: overdra rollen først.
  const handleChangeRole = useCallback(
    (member: TeamMember) => {
      if (!activeTeamSpaceId) return;
      const choices: UserRole[] = ['trener', 'lagleder', 'forelder', 'supporter'];
      Alert.alert(
        `Endre rollen til ${member.name}`,
        `Rollen er ${ROLE_LABELS[member.role].toLowerCase()} i dag.`,
        [
          ...choices
            .filter(r => r !== member.role)
            .map(r => ({
              text: ROLE_LABELS[r],
              onPress: async () => {
                try {
                  await setMemberRole(activeTeamSpaceId, member.id, r);
                } catch (e) {
                  Alert.alert('Kunne ikke endre rollen', errorMessage(e));
                }
                invalidateTeamMembers(activeTeamSpaceId);
              },
            })),
          {text: 'Avbryt', style: 'cancel' as const},
        ],
      );
    },
    [activeTeamSpaceId],
  );

  // Trenerforespørselen (§5): «Jeg er trener» i join-flyten ga supporter +
  // stående forespørsel. Godkjenn = set_member_role('trener'); avslå nuller
  // forespørselen — begge gir personen beskjed via varsel (RPC-ene).
  const handleRoleRequest = useCallback(
    (member: TeamMember) => {
      if (!activeTeamSpaceId) return;
      Alert.alert(
        `${member.name} vil bli trener`,
        'Godkjenner du, får personen trenerrollen med en gang. Avslår du, blir personen værende som supporter.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Avslå',
            style: 'destructive',
            onPress: async () => {
              try {
                await declineRoleRequest(activeTeamSpaceId, member.id);
              } catch (e) {
                Alert.alert('Kunne ikke avslå', errorMessage(e));
              }
              invalidateTeamMembers(activeTeamSpaceId);
            },
          },
          {
            text: 'Godkjenn som trener',
            onPress: async () => {
              try {
                await setMemberRole(activeTeamSpaceId, member.id, 'trener');
              } catch (e) {
                Alert.alert('Kunne ikke godkjenne', errorMessage(e));
              }
              invalidateTeamMembers(activeTeamSpaceId);
            },
          },
        ],
      );
    },
    [activeTeamSpaceId],
  );

  // Profilbilde-moderasjon (00068). To knapper, to helt ulike myndigheter:
  //
  //  · «Fjern profilbildet» er lagadmins EGEN makt — samme forhold som at
  //    trener/lagleder kan slette andres innlegg (soft_delete_post, 00041).
  //    Alternativet frem til nå var å kaste personen ut av laget for å bli
  //    kvitt et bilde, og det er ikke forholdsmessig.
  //  · «Rapporter profilbildet» er veien til HEIA, og den må stå åpen for
  //    ALLE medlemmer — også når det er treneren selv bildet gjelder.
  //    Uten den er et upassende profilbilde det eneste UGC-et i appen som
  //    ikke kan flagges (Apple 1.2).
  const handleRemoveAvatar = useCallback(
    (member: TeamMember) => {
      if (!activeTeamSpaceId) return;
      Alert.alert(
        `Fjerne profilbildet til ${member.name}?`,
        `${member.name} beholder plassen sin i laget og kan legge inn et nytt bilde selv. Frem til da vises initialer.`,
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Fjern bildet',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMemberAvatar(activeTeamSpaceId, member.id);
              } catch (e) {
                Alert.alert('Kunne ikke fjerne bildet', errorMessage(e));
              }
              invalidateTeamMembers(activeTeamSpaceId);
            },
          },
        ],
      );
    },
    [activeTeamSpaceId],
  );

  // ⋯-menyen samler medlemshandlingene: forespørsel, rollebytte, fjerning.
  const handleMemberActions = useCallback(
    (member: TeamMember) => {
      const canChangeRole = member.role !== 'spiller';
      const canRemove = !isTeamAdmin(member.role);
      const hasAvatar = !!member.avatarPath;
      Alert.alert(member.name, subtitleFor(member), [
        ...(amAdmin && member.requestedRole
          ? [
              {
                text: 'Behandle trenerforespørsel',
                onPress: () => handleRoleRequest(member),
              },
            ]
          : []),
        ...(amAdmin && canChangeRole
          ? [{text: 'Endre rolle', onPress: () => handleChangeRole(member)}]
          : []),
        // Rapportering står FØRST av bildehandlingene for et vanlig medlem,
        // fordi det er den eneste de har.
        ...(hasAvatar
          ? [
              {
                text: 'Rapporter profilbildet',
                onPress: () => promptReport('avatar', member.id),
              },
            ]
          : []),
        ...(amAdmin && hasAvatar
          ? [
              {
                text: 'Fjern profilbildet',
                style: 'destructive' as const,
                onPress: () => handleRemoveAvatar(member),
              },
            ]
          : []),
        ...(amAdmin && canRemove
          ? [
              {
                text: 'Fjern fra laget',
                style: 'destructive' as const,
                onPress: () => handleRemove(member),
              },
            ]
          : []),
        {text: 'Avbryt', style: 'cancel' as const},
      ]);
    },
    [
      amAdmin,
      handleChangeRole,
      handleRemove,
      handleRemoveAvatar,
      handleRoleRequest,
    ],
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

  // Skeletonene er nå FØRSTE besøk — har cachen data, tegnes lista med én gang.
  if (isPending) {
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
      contentContainerStyle={{paddingBottom: bottomPad}}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
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

      {isError && (
        <Text style={styles.error}>
          Kunne ikke laste laget. Dra ned for å prøve igjen.
        </Text>
      )}

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
              // ⋯ samler handlingene (rolle/forespørsel/fjerning/bilde) —
              // hva som faktisk tilbys avgjøres i menyen, vaktene bor i
              // RPC-ene. Et vanlig medlem ser knappen KUN når det finnes et
              // profilbilde å rapportere; ellers ville menyen vært tom.
              const showActions =
                !isMe && (amAdmin || !!member.avatarPath);
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
                  <Avatar
                    media={avatarRef(member.avatarPath)}
                    name={member.name}
                    color={member.avatarColor}
                    size="md"
                  />
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
                  {/* Trenerforespørselen (§5) — kun lagadmin ser og
                      behandler den; chippen er selve inngangen. */}
                  {amAdmin && member.requestedRole === 'trener' && (
                    <Pressable
                      onPress={() => handleRoleRequest(member)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.name} vil bli trener — behandle forespørselen`}
                      style={({pressed}) => [
                        styles.requestChip,
                        pressed && styles.morePressed,
                      ]}>
                      <Text style={styles.requestText}>Vil bli trener</Text>
                    </Pressable>
                  )}
                  {canContact && <Text style={styles.contactIcon}>📞</Text>}
                  {showActions && (
                    <Pressable
                      onPress={() => handleMemberActions(member)}
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
  // Trenerforespørselen skal ses, ikke ropes: mint flate, mørk tekst
  // (A v2-regelen — mint er fyll på lys flate, aldri tekstfarge).
  requestChip: {
    backgroundColor: colors.heiaSoft,
    borderWidth: 1,
    borderColor: colors.heia,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  requestText: {
    ...typography.caption,
    color: colors.heiaInk,
    fontWeight: '700',
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
