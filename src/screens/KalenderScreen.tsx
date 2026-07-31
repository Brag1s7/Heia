import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  EventCard,
  EventCardSkeleton,
  LiveBadge,
  Skeleton,
  TeamHeader,
} from '../components';
import {useActiveTeam} from '../context';
import {getTeamEvents} from '../lib/api/events';
import type {KalenderStackParamList, HeiaEvent} from '../shared/types';

type Nav = NativeStackNavigationProp<KalenderStackParamList, 'KalenderList'>;

/** Midnatt samme dag — så en kamp kl. 09:00 er «i dag» hele dagen, ikke «tidligere». */
function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function isPast(date: Date): boolean {
  return startOfDay(date) < startOfDay(new Date());
}

/** «August», eller «Januar 2027» når måneden bor i et annet år. */
function formatMonthLabel(date: Date): string {
  const month = date.toLocaleDateString('nb-NO', {month: 'long'});
  const capped = month.charAt(0).toUpperCase() + month.slice(1);
  return date.getFullYear() === new Date().getFullYear()
    ? capped
    : `${capped} ${date.getFullYear()}`;
}

function getSectionLabel(date: Date): string {
  const today = startOfDay(new Date());
  const eventDay = startOfDay(date);
  const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Tidligere';
  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  if (diffDays <= 7) return 'Denne uken';
  // Lenger frem sier «Kommende» ingenting — månedsnavnet gir kalenderen
  // rytme (P9): August, September … som egne seksjoner.
  return formatMonthLabel(date);
}

/**
 * Kalenderen skal åpne på det som kommer, ikke på det som var.
 *
 * `getTeamEvents` gir alt stigende etter starttid, og da havner hele lagets
 * historikk ØVERST — «Tidligere» først, og en ny hendelse du nettopp opprettet
 * nederst, under alt som har skjedd. Her flyttes fortiden ned og snus, så det
 * som var sist ligger først i arkivet: det er forrige lørdags kamp man leter
 * etter, ikke den fra september.
 *
 * Fortiden slettes IKKE fra lista — gamle kamper bærer nå kamprapport og
 * bilder, og er verdt å komme tilbake til.
 */
function orderForCalendar(events: HeiaEvent[]): HeiaEvent[] {
  const upcoming: HeiaEvent[] = [];
  const past: HeiaEvent[] = [];
  for (const event of events) {
    // Samme dag-grense som getSectionLabel, ellers kunne en hendelse tidligere
    // i dag blitt sortert som fortid men merket «I dag» — og seksjonene ville
    // dukket opp to ganger.
    (isPast(event.startTime) ? past : upcoming).push(event);
  }
  return [...upcoming, ...past.reverse()];
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

  const sections = groupIntoSections(orderForCalendar(events));

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
          <>
            <View style={styles.sectionHeader}>
              <Skeleton width={90} height={11} />
            </View>
            <View style={styles.cardWrap}>
              <EventCardSkeleton />
            </View>
            <View style={styles.cardWrap}>
              <EventCardSkeleton />
            </View>
            <View style={styles.cardWrap}>
              <EventCardSkeleton />
            </View>
          </>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Kalenderen er tom</Text>
            <Text style={styles.emptyText}>
              Treninger, kamper og det sosiale dukker opp her når laget
              planlegger noe.
            </Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.label}>
              <View style={styles.sectionHeader}>
                {/* Mint-streken er seksjonsetikettens merkevaredetalj (A v2) —
                    samme uttrykk som SectionHeader, men med plass til LiveBadge. */}
                <View style={styles.sectionDash} />
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {section.label === 'I dag' &&
                  section.events.some(e => e.matchStatus === 'live') && (
                    <LiveBadge />
                  )}
              </View>
              {section.events.map((event, index) => {
                const prev = index > 0 ? section.events[index - 1] : null;
                // Arkivet ruller bakover i tid — en dempet månedsetikett når
                // måneden bytter gir rytme uten å rope (fremover er månedene
                // egne seksjoner, så dette gjelder kun «Tidligere»).
                const monthBreak =
                  section.label === 'Tidligere' &&
                  prev !== null &&
                  (prev.startTime.getMonth() !== event.startTime.getMonth() ||
                    prev.startTime.getFullYear() !==
                      event.startTime.getFullYear());
                return (
                  <React.Fragment key={event.id}>
                    {monthBreak && (
                      <Text style={styles.monthDivider}>
                        {formatMonthLabel(event.startTime)}
                      </Text>
                    )}
                    <View style={styles.cardWrap}>
                      <EventCard
                        event={event}
                        featured={event.matchStatus === 'live'}
                        past={section.label === 'Tidligere'}
                        onPress={() =>
                          navigation.navigate('EventDetail', {
                            eventId: event.id,
                          })
                        }
                      />
                    </View>
                  </React.Fragment>
                );
              })}
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
  emptyCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Stillere enn seksjonsetiketten (ingen mint-strek, tertiær) — rytme i
  // arkivet, ikke et nytt rop.
  monthDivider: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
});
