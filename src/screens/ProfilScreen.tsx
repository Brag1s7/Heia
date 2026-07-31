import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Linking,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, CommonActions} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar, ListRow, TeamColorSheet} from '../components';
import {useAuth, useActiveTeam} from '../context';
import {isTeamAdmin, ROLE_LABELS} from '../shared/roles';
import {
  isPushAvailable,
  getPushPermission,
  enablePush,
  type PushPermission,
} from '../lib/push';
import {updateProfile, updateTeamColor} from '../lib/api';
import type {ProfilStackParamList} from '../shared/types';

// Undertekst på «Varslinger»-raden per status.
const PUSH_SUBTITLE: Record<PushPermission, string> = {
  authorized: 'På — du får beskjed når laget scorer',
  denied: 'Av — trykk for å skru på i Innstillinger',
  undetermined: 'Trykk for å skru på',
  unavailable: 'Utilgjengelig på denne enheten',
};

type Nav = NativeStackNavigationProp<ProfilStackParamList, 'Profil'>;

export function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const {profile, signOut, refreshProfile} = useAuth();
  const {
    activeTeamSpaceId,
    userMemberships,
    setActiveTeamSpace,
    refreshMemberships,
  } = useActiveTeam();
  const navigation = useNavigation<Nav>();

  const [colorSheetVisible, setColorSheetVisible] = useState(false);

  // Varsel-status. Oppdateres når skjermen mountes og hver gang appen kommer i
  // forgrunn igjen (bytter du i iOS-Innstillinger og kommer tilbake, stemmer den).
  const [pushPerm, setPushPerm] = useState<PushPermission>('unavailable');
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getPushPermission().then(p => mounted && setPushPerm(p));
    };
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const handleNotifications = useCallback(async () => {
    if (pushPerm === 'undetermined') {
      // Første gang: dette viser systemdialogen.
      const next = await enablePush();
      setPushPerm(next);
      if (next === 'denied') {
        Alert.alert(
          'Varsler er avslått',
          'Du kan skru dem på igjen under Innstillinger → Heia → Varsler.',
          [
            {text: 'Ikke nå', style: 'cancel'},
            {text: 'Åpne Innstillinger', onPress: () => Linking.openSettings()},
          ],
        );
      }
    } else {
      // Alt bestemt (på eller av) → iOS lar oss ikke spørre igjen, så vi sender
      // brukeren til Innstillinger der de kan endre valget.
      Linking.openSettings();
    }
  }, [pushPerm]);

  // Nummeret er hele grunnen til at lagoversikten kan brukes til å nå noen —
  // uten et sted å skrive det inn står telefonkolonnen tom for alle.
  // Alert.prompt finnes bare på iOS; Android får en egen flate den dagen.
  const handlePhone = useCallback(() => {
    Alert.prompt(
      'Telefonnummer',
      'Trenere og lagledere kan nå deg. Resten av laget ser det ikke.',
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Lagre',
          onPress: async (value?: string) => {
            const trimmed = (value ?? '').trim();
            try {
              await updateProfile({phone: trimmed.length > 0 ? trimmed : null});
              await refreshProfile();
            } catch {
              Alert.alert('Kunne ikke lagre', 'Prøv igjen om litt.');
            }
          },
        },
      ],
      'plain-text',
      profile?.phone ?? '',
      'phone-pad',
    );
  }, [profile?.phone, refreshProfile]);

  // Trykk på swatch = lagre og lukk (ReporterSheet-mønsteret). Fargen leses
  // via context overalt (lagmerke, scoreboard, «oss»-stripe, laglisten), så
  // refreshMemberships() er alt som trengs for at den skifter i hele appen.
  const handleColorSelect = useCallback(
    async (color: string) => {
      setColorSheetVisible(false);
      if (!activeTeamSpaceId) return;
      try {
        await updateTeamColor(activeTeamSpaceId, color);
        await refreshMemberships();
      } catch (e: any) {
        Alert.alert(
          'Kunne ikke lagre fargen',
          e?.message ?? 'Prøv igjen om litt.',
        );
      }
    },
    [activeTeamSpaceId, refreshMemberships],
  );

  if (!profile) return null;

  const activeMembership = userMemberships.find(
    m => m.teamSpaceId === activeTeamSpaceId,
  );
  const roleName = activeMembership
    ? ROLE_LABELS[activeMembership.role]
    : 'Forelder';
  const isTrener = isTeamAdmin(activeMembership?.role);

  function handleTeamSwitch(teamSpaceId: string) {
    if (teamSpaceId === activeTeamSpaceId) return;
    setActiveTeamSpace(teamSpaceId);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'HjemStack'}],
      }),
    );
  }

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}>
      {/* Profil-seksjon */}
      <View
        style={[
          styles.profileSection,
          {paddingTop: insets.top + spacing['2xl']},
        ]}>
        <Avatar name={profile.displayName} size="lg" />
        <Text style={styles.userName}>{profile.displayName}</Text>
        <View style={styles.roleRow}>
          <View
            style={[
              styles.roleBadge,
              isTrener ? styles.roleBadgeTrener : styles.roleBadgeForelder,
            ]}>
            <Text
              style={[
                styles.roleBadgeText,
                isTrener
                  ? styles.roleBadgeTrenerText
                  : styles.roleBadgeForelderText,
              ]}>
              {roleName}
            </Text>
          </View>
        </View>
      </View>

      {/* Dine lag */}
      {userMemberships.length > 0 && (
        <View style={styles.teamsSection}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionDash} />
            <Text style={styles.sectionTitle}>Dine lag</Text>
          </View>
          {userMemberships.map(m => {
            const isActive = m.teamSpaceId === activeTeamSpaceId;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleTeamSwitch(m.teamSpaceId)}
                style={({pressed}) => [
                  styles.teamCard,
                  isActive && styles.teamCardActive,
                  pressed && styles.teamCardPressed,
                ]}>
                <View
                  style={[
                    styles.teamDot,
                    {backgroundColor: m.teamSpace.color},
                  ]}
                />
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>
                    {m.teamSpace.displayName}
                  </Text>
                  <Text style={styles.teamMeta}>
                    {m.team.ageGroup} · {ROLE_LABELS[m.role]}
                  </Text>
                </View>
                {isActive && <Text style={styles.activeCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Meny */}
      <View style={styles.menuSection}>
        {Platform.OS === 'ios' && (
          <ListRow
            icon={<Text style={styles.menuIcon}>{'  '}</Text>}
            title="Telefonnummer"
            subtitle={profile.phone ?? 'Legg til så trenerne når deg'}
            onPress={handlePhone}
          />
        )}
        {activeMembership && (
          <ListRow
            icon={<Text style={styles.menuIcon}>{'  '}</Text>}
            title="Lagoversikt"
            subtitle="Se hvem som er med i laget"
            onPress={() => navigation.navigate('TeamMembers')}
          />
        )}
        {activeMembership && isTrener && (
          <ListRow
            icon={
              <View
                style={[
                  styles.colorDot,
                  {
                    backgroundColor:
                      activeMembership.teamSpace.color ||
                      colors.textSecondary,
                  },
                ]}
              />
            }
            title="Lagfarge"
            subtitle="Fargen laget spiller i"
            onPress={() => setColorSheetVisible(true)}
          />
        )}
        <ListRow
          icon={<Text style={styles.menuIcon}>{'  '}</Text>}
          title="Bli med i et lag"
          subtitle="Har du fått en invitasjonskode?"
          onPress={() => navigation.navigate('JoinTeamCode')}
        />
        <ListRow
          icon={<Text style={styles.menuIcon}>{'  '}</Text>}
          title="Opprett et nytt lag"
          subtitle="Du blir trener for laget"
          onPress={() => navigation.navigate('CreateTeam')}
        />
        {activeMembership && (
          <ListRow
            icon={<Text style={styles.menuIcon}>{'  '}</Text>}
            title="Inviter til laget"
            subtitle="Del invitasjonskoden"
            onPress={() => navigation.navigate('Invite')}
          />
        )}
        {isPushAvailable() && (
          <ListRow
            icon={<Text style={styles.menuIcon}>🔔</Text>}
            title="Varslinger"
            subtitle={PUSH_SUBTITLE[pushPerm]}
            onPress={handleNotifications}
          />
        )}
        <ListRow
          icon={<Text style={styles.menuIcon}>{'  '}</Text>}
          title="Logg ut"
          subtitle="Logg ut av Heia"
          onPress={signOut}
        />
        <ListRow
          icon={<Text style={styles.menuIcon}>{'  '}</Text>}
          title="Om Heia"
          subtitle="v0.1.0"
          showBorder={false}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Image
          source={require('../assets/images/logo-green.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerTagline}>Idrettsglede for alle</Text>
      </View>
    </ScrollView>
    <TeamColorSheet
      visible={colorSheetVisible}
      current={activeMembership?.teamSpace.color ?? null}
      onSelect={handleColorSelect}
      onClose={() => setColorSheetVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileSection: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  userName: {
    ...typography.heading2,
    marginTop: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  roleBadgeTrener: {
    backgroundColor: 'rgba(2, 255, 171, 0.15)',
  },
  roleBadgeForelder: {
    backgroundColor: colors.background,
  },
  roleBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  roleBadgeTrenerText: {
    color: colors.heiaInk,
  },
  roleBadgeForelderText: {
    color: colors.textSecondary,
  },
  teamsSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  // Valgt skifter FLATE, ikke bare ramme (A v2-regelen fra RSVP-knappene).
  teamCardActive: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  teamCardPressed: {
    opacity: 0.7,
  },
  teamDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    ...typography.heading3,
  },
  teamMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // heiaInk — mint er kun fyll på lys flate (A v2-regel).
  activeCheck: {
    fontSize: 18,
    color: colors.heiaInk,
    fontWeight: '700',
  },
  menuSection: {
    backgroundColor: colors.surface,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  menuIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  // Sentrert i samme 32 px-slot som menuIcon (marginHorizontal = (32−20)/2).
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    marginHorizontal: 6,
    alignSelf: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.xs,
  },
  footerLogo: {
    width: 100,
    height: 100,
  },
  footerTagline: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
