import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
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
import {getEventsForTeamSpace} from '../data/teamData';
import {getTeamFeed, createTextPost} from '../lib/api/feed';
import type {FeedItem, HomeStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'TeamHome'>;

export function TeamHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);
  const {activeTeamSpace, activeTeamSpaceId} = useActiveTeam();
  const {justCreatedTeamSpaceId, clearJustCreated} = useOnboarding();

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeText, setComposeText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      const items = await getTeamFeed(activeTeamSpaceId);
      setFeed(items);
    } catch (e) {
      setError('Kunne ikke laste feeden. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId]);

  // Last feed når aktivt lag endres.
  useEffect(() => {
    setLoading(true);
    loadFeed();
  }, [loadFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  const handlePost = useCallback(async () => {
    if (!activeTeamSpaceId || composeText.trim().length === 0 || posting) return;
    setPosting(true);
    try {
      await createTextPost(activeTeamSpaceId, composeText);
      setComposeText('');
      await loadFeed();
    } catch (e) {
      Alert.alert('Kunne ikke publisere', 'Prøv igjen om litt.');
    } finally {
      setPosting(false);
    }
  }, [activeTeamSpaceId, composeText, posting, loadFeed]);

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

  // Finn live kamp (fortsatt mock — events kommer i Fase 3)
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

      {/* Compose — skriv en enkel tekstpost */}
      <View style={styles.composeCard}>
        <TextInput
          style={styles.composeInput}
          value={composeText}
          onChangeText={setComposeText}
          placeholder="Del noe med laget…"
          placeholderTextColor={colors.textTertiary}
          multiline
          editable={!posting}
        />
        <View style={styles.composeActions}>
          <Button
            title="Publiser"
            onPress={handlePost}
            disabled={composeText.trim().length === 0}
            loading={posting}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.feedLoader}
          color={colors.heia}
        />
      ) : error ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Ingen aktivitet ennå</Text>
          <Text style={styles.emptyText}>
            Skriv den første meldingen, eller inviter foreldre og spillere så
            blir laget levende.
          </Text>
          <Button
            title="Inviter laget"
            onPress={() => navigation.navigate('Invite')}
          />
        </View>
      ) : (
        feed.map(item => (
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
  composeCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  composeInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  feedLoader: {
    marginTop: spacing.xl,
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
