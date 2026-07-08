import React from 'react';
import {View, Text, ScrollView, Pressable, StyleSheet, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar, ListRow} from '../components';
import {useAuth, useActiveTeam} from '../context';

export function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const {profile, signOut} = useAuth();
  const {activeTeamSpaceId, userMemberships, setActiveTeamSpace} =
    useActiveTeam();
  const navigation = useNavigation();

  if (!profile) return null;

  const activeMembership = userMemberships.find(
    m => m.teamSpaceId === activeTeamSpaceId,
  );
  const roleName =
    activeMembership?.role === 'trener' ? 'Trener' : 'Forelder';
  const isTrener = activeMembership?.role === 'trener';

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
          <Text style={styles.sectionTitle}>Dine lag</Text>
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
                    {m.team.ageGroup} ·{' '}
                    {m.role === 'trener' ? 'Trener' : 'Forelder'}
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
        {activeMembership && (
          <ListRow
            icon={<Text style={styles.menuIcon}>{'  '}</Text>}
            title="Inviter til laget"
            subtitle="Del invitasjonskoden"
            onPress={() => navigation.navigate('Invite' as never)}
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
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  teamCardActive: {
    borderWidth: 2,
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
  activeCheck: {
    fontSize: 18,
    color: colors.heiaPressed,
    fontWeight: '700',
  },
  menuSection: {
    backgroundColor: colors.surface,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  menuIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
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
