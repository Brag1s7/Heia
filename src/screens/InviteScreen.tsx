import React from 'react';
import {Text, ScrollView, StyleSheet} from 'react-native';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {colors, typography, spacing} from '../theme';
import {
  ProfilPage,
  InviteCodeCard,
  useBottomContentPadding,
} from '../components';
import {useActiveTeam} from '../context';
import type {HomeStackParamList} from '../shared/types';

type InviteRoute = RouteProp<HomeStackParamList, 'Invite'>;

export function InviteScreen() {
  const bottomPad = useBottomContentPadding();
  const route = useRoute<InviteRoute>();
  const firstTime = route.params?.firstTime ?? false;
  const {activeTeamSpace} = useActiveTeam();

  if (!activeTeamSpace) return null;

  return (
    <ProfilPage title="Inviter">
      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: bottomPad}]}>
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
    </ProfilPage>
  );
}

// Overskriften står i reisens mørke topp (ProfilPage) → stadionblekk.
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading1,
    color: colors.stadiumText,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(234, 255, 246, 0.8)',
    marginBottom: spacing.lg,
  },
});
