import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {
  SectionHeader,
  FeedCard,
  Button,
  LiveMatchBanner,
  TeamHeader,
} from '../components';
import {useActiveTeam, useOnboarding} from '../context';
import {
  getEventsForTeamSpace,
  getFeedForTeamSpace,
} from '../data/teamData';
import type {HomeStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'TeamHome'>;

export function TeamHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);
  const {activeTeamSpace, activeTeamSpaceId} = useActiveTeam();
  const {justCreatedTeamSpaceId, clearJustCreated} = useOnboarding();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  // Vis invite-koden én gang rett etter at laget er opprettet.
  useEffect(() => {
    if (
      justCreatedTeamSpaceId &&
      justCreatedTeamSpaceId === activeTeamSpaceId
    ) {
      clearJustCreated();
      navigation.navigate('Invite', {firstTime: true});
    }
  }, [justCreatedTeamSpaceId, activeTeamSpaceId, clearJustCreated, navigation]);

  if (!activeTeamSpace || !activeTeamSpaceId) return null;

  const teamEvents = getEventsForTeamSpace(activeTeamSpaceId);
  const teamFeed = getFeedForTeamSpace(activeTeamSpaceId);

  // Finn live kamp
  const liveMatch = teamEvents.find(
    e => e.type === 'kamp' && e.matchStatus === 'live',
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.heia}
        />
      }>
      {/* Team-header (kompakt) */}
      <TeamHeader />

      {/* Live kamp-banner — HERO */}
      {liveMatch && (
        <View style={styles.section}>
          <LiveMatchBanner
            event={liveMatch}
            onPress={() =>
              navigation.navigate('EventDetail', {eventId: liveMatch.id})
            }
          />
        </View>
      )}

      {/* Feed — hovedinnhold */}
      <SectionHeader title="Siste fra laget" />
      {teamFeed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Ingen aktivitet ennå</Text>
          <Text style={styles.emptyText}>
            Inviter foreldre og spillere så blir laget levende.
          </Text>
          <Button
            title="Inviter laget"
            onPress={() => navigation.navigate('Invite')}
          />
        </View>
      ) : (
        teamFeed.map(item => (
          <View key={item.id} style={styles.cardWrap}>
            <FeedCard item={item} />
          </View>
        ))
      )}

      {/* Støtt laget */}
      <View style={styles.supportCard}>
        <Text style={styles.supportTitle}>
          Støtt {activeTeamSpace.displayName}
        </Text>
        <Text style={styles.supportText}>
          Hjelp laget med å dekke utgifter til kamper, utstyr og sosiale
          arrangementer.
        </Text>
        <Button
          title="Støtt laget"
          variant="secondary"
          onPress={() => navigation.navigate('Support')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyFeed: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  supportCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  supportTitle: {
    ...typography.heading3,
  },
  supportText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
