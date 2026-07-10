import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {EventCard, LiveBadge, TeamHeader} from '../components';
import {useActiveTeam} from '../context';
import {getTeamEvents} from '../lib/api/events';
import type {KalenderStackParamList, HeiaEvent} from '../shared/types';

type Nav = NativeStackNavigationProp<KalenderStackParamList, 'KalenderList'>;

function getSectionLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return 'Tidligere';
  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  if (diffDays <= 7) return 'Denne uken';
  return 'Kommende';
}

/** Grupperer en kronologisk liste i sammenhengende seksjoner. */
function groupIntoSections(
  events: HeiaEvent[],
): {label: string; events: HeiaEvent[]}[] {
  const sections: {label: string; events: HeiaEvent[]}[] = [];
  let currentLabel = '';
  for (const event of events) {
    const label = getSectionLabel(event.startTime);
    if (label !== currentLabel) {
      currentLabel = label;
      sections.push({label, events: [event]});
    } else {
      sections[sections.length - 1].events.push(event);
    }
  }
  return sections;
}

export function KalenderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId} = useActiveTeam();

  const [events, setEvents] = useState<HeiaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      setEvents(await getTeamEvents(activeTeamSpaceId));
    } catch {
      setError('Kunne ikke laste kalenderen. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId]);

  // Kjører ved mount, når aktivt lag endres, og hver gang skjermen får fokus
  // igjen — en RSVP på detaljskjermen endrer tallene her.
  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  if (!activeTeamSpaceId) return null;

  const sections = groupIntoSections(events);

  return (
    <View style={styles.screen}>
      <TeamHeader />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing['3xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.subtitle}>Kommende hendelser for laget</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.heia} />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ingen hendelser ennå</Text>
            <Text style={styles.emptyText}>
              Treninger, kamper og sosiale samlinger dukker opp her.
            </Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.label}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {section.label === 'I dag' &&
                  section.events.some(e => e.matchStatus === 'live') && (
                    <LiveBadge />
                  )}
              </View>
              {section.events.map(event => (
                <View key={event.id} style={styles.cardWrap}>
                  <EventCard
                    event={event}
                    featured={event.matchStatus === 'live'}
                    onPress={() =>
                      navigation.navigate('EventDetail', {eventId: event.id})
                    }
                  />
                </View>
              ))}
            </View>
          ))
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
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  loader: {
    marginTop: spacing.xl,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
