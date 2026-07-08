import React from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {colors, typography, spacing} from '../theme';
import {InviteCodeCard} from '../components';
import {useActiveTeam} from '../context';
import type {HomeStackParamList} from '../shared/types';

type InviteRoute = RouteProp<HomeStackParamList, 'Invite'>;

export function InviteScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<InviteRoute>();
  const firstTime = route.params?.firstTime ?? false;
  const {activeTeamSpace} = useActiveTeam();

  if (!activeTeamSpace) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {paddingBottom: insets.bottom + spacing['3xl']},
      ]}>
      <Text style={styles.title}>
        {firstTime ? 'Laget er klart! 🎉' : 'Inviter til laget'}
      </Text>
      <Text style={styles.subtitle}>
        {firstTime
          ? `${activeTeamSpace.displayName} er opprettet. Inviter foreldre og spillere så blir laget levende.`
          : `Få flere inn i ${activeTeamSpace.displayName}.`}
      </Text>

      <InviteCodeCard
        teamName={activeTeamSpace.displayName}
        inviteCode={activeTeamSpace.inviteCode}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
