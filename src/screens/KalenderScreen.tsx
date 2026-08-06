import React, {useCallback, useRef, useState} from 'react';
import {View, Text, ScrollView, StyleSheet, RefreshControl} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  EventCard,
  EventCardSkeleton,
  LiveBadge,
  Skeleton,
  TeamHeader,
  TournamentDayCard,
} from '../components';
import {useActiveTeam} from '../context';
import {getTeamEvents} from '../lib/api/events';
import {dayKey, startOfDay} from '../shared/calendar';
import {
  buildCalendarRows,
  splitByTime,
  type CalendarRow,
} from '../shared/calendarList';
import type {KalenderStackParamList, HeiaEvent} from '../shared/types';

type Nav = NativeStackNavigationProp<KalenderStackParamList, 'KalenderList'>;
type Route = RouteProp<KalenderStackParamList, 'KalenderList'>;

/** «August», eller «Januar 2027» når måneden bor i et annet år. */
function formatMonthLabel(date: Date): string {
  const month = date.toLocaleDateString('nb-NO', {month: 'long'});
  const capped = month.charAt(0).toUpperCase() + month.slice(1);
  return date.getFullYear() === new Date().getFullYear()
    ? capped
    : `${capped} ${date.getFullYear()}`;
}

function getSectionLabel(date: Date): string {
  const today = startOfDay(new Date()).getTime();
  const eventDay = startOfDay(date).getTime();
  const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Tidligere';
  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  if (diffDays <= 7) return 'Denne uken';
  // Lenger frem sier «Kommende» ingenting — månedsnavnet gir kalenderen
  // rytme (P9): August, September … som egne seksjoner.
  return formatMonthLabel(date);
}

/** Grupperer en kronologisk liste i sammenhengende seksjoner. */
function groupIntoSections(
  rows: CalendarRow[],
): {label: string; rows: CalendarRow[]}[] {
  const sections: {label: string; rows: CalendarRow[]}[] = [];
  let currentLabel = '';
  for (const row of rows) {
    const label = getSectionLabel(row.date);
    if (label !== currentLabel) {
      currentLabel = label;
      sections.push({label, rows: [row]});
    } else {
      sections[sections.length - 1].rows.push(row);
    }
  }
  return sections;
}

/** Kampene en rad representerer — brukes til LIVE-merket i seksjonstittelen. */
function rowEvents(row: CalendarRow): HeiaEvent[] {
  return row.kind === 'event' ? [row.event] : row.matches;
}

export function KalenderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {activeTeamSpaceId} = useActiveTeam();

  const [events, setEvents] = useState<HeiaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Å bli sendt hit fra «Turneringen er opprettet» skal lande PÅ turneringen,
  // ikke på toppen av lista. Vi måler radens y-posisjon når den legges ut og
  // ruller dit — en ScrollView kan ikke hoppe til et element uten det.
  const scrollRef = useRef<ScrollView>(null);
  const focusDate = route.params?.focusDate;
  const focusOffset = useRef<number | null>(null);
  const hasScrolled = useRef(false);

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

  // Ny målrute = nytt forsøk på å rulle.
  useFocusEffect(
    useCallback(() => {
      hasScrolled.current = false;
      focusOffset.current = null;
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const scrollToFocusIfReady = useCallback(() => {
    if (hasScrolled.current || focusOffset.current === null) return;
    hasScrolled.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, focusOffset.current - spacing['3xl']),
      animated: true,
    });
  }, []);

  if (!activeTeamSpaceId) return null;

  const {upcoming, past} = splitByTime(buildCalendarRows(events));
  const sections = groupIntoSections([...upcoming, ...past]);

  const openEvent = (eventId: string) =>
    navigation.navigate('EventDetail', {eventId});

  return (
    <View style={styles.screen}>
      <TeamHeader />
      <ScrollView
        ref={scrollRef}
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
                  section.rows
                    .flatMap(rowEvents)
                    .some(e => e.matchStatus === 'live') && <LiveBadge />}
              </View>
              {section.rows.map((row, index) => {
                const prev = index > 0 ? section.rows[index - 1] : null;
                // Arkivet ruller bakover i tid — en dempet månedsetikett når
                // måneden bytter gir rytme uten å rope (fremover er månedene
                // egne seksjoner, så dette gjelder kun «Tidligere»).
                const monthBreak =
                  section.label === 'Tidligere' &&
                  prev !== null &&
                  (prev.date.getMonth() !== row.date.getMonth() ||
                    prev.date.getFullYear() !== row.date.getFullYear());
                const isPast = section.label === 'Tidligere';
                const isFocus =
                  focusDate !== undefined && dayKey(row.date) === focusDate;

                return (
                  <React.Fragment key={row.key}>
                    {monthBreak && (
                      <Text style={styles.monthDivider}>
                        {formatMonthLabel(row.date)}
                      </Text>
                    )}
                    <View
                      style={styles.cardWrap}
                      onLayout={
                        isFocus
                          ? e => {
                              focusOffset.current = e.nativeEvent.layout.y;
                              scrollToFocusIfReady();
                            }
                          : undefined
                      }>
                      {row.kind === 'tournamentDay' ? (
                        <TournamentDayCard
                          row={row}
                          past={isPast}
                          onPressTournament={() => openEvent(row.tournament.id)}
                          onPressMatch={openEvent}
                        />
                      ) : (
                        <EventCard
                          event={row.event}
                          featured={row.event.matchStatus === 'live'}
                          past={isPast}
                          onPress={() => openEvent(row.event.id)}
                        />
                      )}
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
