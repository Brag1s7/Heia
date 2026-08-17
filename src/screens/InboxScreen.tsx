import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  LayoutAnimation,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  ListRowSkeleton,
  MatchPulseCard,
  NotificationRow,
  SectionHeader,
  TeamHeader,
} from '../components';
import {Ball, Megaphone} from '../components/icons';
import {useActiveTeam, useNotifications} from '../context';
import {getNotifications} from '../lib/api/notifications';
import {buildEntries, groupByAge} from '../shared/inbox';
import type {Entry, HeiaNotification} from '../shared/inbox';
import {getLiveMatch} from '../lib/api/events';
import type {HeiaEvent} from '../shared/types';
import type {InboxStackParamList, RootTabParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<InboxStackParamList, 'InboxList'>;

export function InboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeTeamSpace} = useActiveTeam();
  const {unreadCount, refreshUnread, markRead, markAllRead, liveNonce} =
    useNotifications();

  const [items, setItems] = useState<HeiaNotification[]>([]);
  const [liveMatch, setLiveMatch] = useState<HeiaEvent | null>(null);
  // Kampklokka må TIKKE. Var minuttet regnet ut én gang ved render, frøs
  // stripa på minuttet skjermen ble åpnet — og sa «6′» mens kampen var på 20.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamName = activeTeamSpace?.displayName ?? 'laget';
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      // Live-kampen hentes ved siden av varslene: stripa skal stå der også
      // når du har lest alle kamphendelsene. Feiler den, mister vi bare
      // stripa — varslene er hovedsaken.
      const [notifications, live] = await Promise.all([
        getNotifications(activeTeamSpaceId),
        getLiveMatch(activeTeamSpaceId).catch(() => null),
      ]);
      // Myk innlasting: nye rader glir inn i stedet for å hoppe. Kun ved
      // OPPDATERING — førstegangslasting går fra skjelett til liste, og der
      // ville animasjonen bare føltes treg.
      if (!firstLoad.current) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'),
        );
      }
      firstLoad.current = false;
      setItems(notifications);
      setLiveMatch(live);
      // Lista er sannheten — hold badgen i takt med det du faktisk ser.
      refreshUnread();
    } catch {
      setError('Kunne ikke laste varsler. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId, refreshUnread]);

  // Fokus-gating (fase A, F16-fiksen): skjermen står montert bak de andre
  // fanene, og lastet før på HVERT varsel — også når ingen så på. Nå: last
  // ved fokus (det dekker alt som kom mens skjermen var ubevoktet), og
  // regn varslene frem til nå som håndtert.
  const isFocused = useIsFocused();
  const handledNonceRef = useRef(0);
  const nonceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveNonceRef = useRef(liveNonce);
  liveNonceRef.current = liveNonce;

  useFocusEffect(
    useCallback(() => {
      handledNonceRef.current = liveNonceRef.current;
      load();
      return () => {
        if (nonceTimerRef.current) {
          clearTimeout(nonceTimerRef.current);
          nonceTimerRef.current = null;
        }
      };
    }, [load]),
  );

  // Står du på skjermen når varselet kommer, skal raden dukke opp av seg
  // selv. Kanalen bor i NotificationsContext — den teller opp liveNonce.
  // Debounced: en burst (mål + kommentar i samme sekund) blir ÉN reload.
  useEffect(() => {
    if (!isFocused || liveNonce === handledNonceRef.current) return;
    handledNonceRef.current = liveNonce;
    if (nonceTimerRef.current) clearTimeout(nonceTimerRef.current);
    nonceTimerRef.current = setTimeout(() => {
      nonceTimerRef.current = null;
      load();
    }, 400);
  }, [isFocused, liveNonce, load]);

  // Tikker kun når en kamp faktisk pågår — ingen timer i bakgrunnen ellers.
  useEffect(() => {
    if (!liveMatch) {
      return;
    }
    const id = setInterval(() => setNowTick(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [liveMatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const markLocalRead = useCallback(
    (ids: string[]) => {
      const unreadIds = ids.filter(
        id => items.find(n => n.id === id)?.readAt === null,
      );
      if (unreadIds.length === 0) return;
      const now = new Date();
      setItems(prev =>
        prev.map(n => (unreadIds.includes(n.id) ? {...n, readAt: now} : n)),
      );
      markRead(unreadIds);
    },
    [items, markRead],
  );

  const openEvent = useCallback(
    (eventId: string, ids: string[]) => {
      markLocalRead(ids);
      navigation.navigate('EventDetail', {eventId});
    },
    [markLocalRead, navigation],
  );

  const handlePress = useCallback(
    (item: HeiaNotification) => {
      markLocalRead([item.id]);

      // Klubbdør-varsler (00047) peker inn i Profil-stacken — godkjenningen
      // bor i Klubbbetalinger, lagets status i «Støtte fra supportere».
      if (item.targetScreen) {
        navigation
          .getParent<NavigationProp<RootTabParamList>>()
          ?.navigate('ProfilStack', {
            screen:
              item.targetScreen === 'club_payments'
                ? 'ClubPayments'
                : 'SupportSetup',
          });
        return;
      }

      // Kampvarsler bærer event_id (feed-posten fra report_match_event),
      // vanlige poster bare feed_post_id → kommentartråden er posten.
      if (item.eventId) {
        navigation.navigate('EventDetail', {eventId: item.eventId});
      } else if (item.feedPostId) {
        const teamSpaceId = item.teamSpaceId ?? activeTeamSpaceId;
        if (teamSpaceId) {
          navigation.navigate('Comments', {
            postId: item.feedPostId,
            teamSpaceId,
          });
        }
      }
      // Uten mål: trykket markerer bare som lest.
    },
    [navigation, markLocalRead, activeTeamSpaceId],
  );

  const handleMarkAll = useCallback(() => {
    const now = new Date();
    setItems(prev => prev.map(n => (n.readAt ? n : {...n, readAt: now})));
    markAllRead();
  }, [markAllRead]);

  const entries = useMemo(() => buildEntries(items), [items]);

  // Kampen som pågår løftes ØVERST og ut av bolkene — den er ikke «noe som
  // skjedde», den skjer nå. Resten av kampene blir resultatkort i sin bolk.
  const liveSessionId = liveMatch?.matchSessionId ?? null;
  const liveEntry = useMemo(
    () =>
      liveSessionId
        ? (entries.find(
            e => e.kind === 'match' && e.sessionId === liveSessionId,
          ) as Extract<Entry, {kind: 'match'}> | undefined)
        : undefined,
    [entries, liveSessionId],
  );

  const sections = useMemo(
    () => groupByAge(entries.filter(e => e !== liveEntry)),
    [entries, liveEntry],
  );

  const isPaused = liveMatch?.matchStatus === 'halfTime';
  const liveMinute =
    liveMatch && !isPaused && liveMatch.startedAt
      ? Math.max(
          0,
          Math.floor((nowTick - liveMatch.startedAt.getTime()) / 60000),
        )
      : null;

  // Stillingen på live-stripa når ingen kamphendelser er varslet ennå
  // (eller alle er lest): kampen finnes, og da skal stripa stå.
  const liveItems: HeiaNotification[] = useMemo(() => {
    if (liveEntry) return liveEntry.items;
    if (!liveMatch?.matchSessionId) return [];
    return [
      {
        id: `live-${liveMatch.matchSessionId}`,
        category: 'match_live',
        title: teamName,
        body: '',
        createdAt: liveMatch.startedAt ?? new Date(),
        readAt: new Date(),
        eventId: liveMatch.id,
        match: {
          sessionId: liveMatch.matchSessionId,
          eventType: 'melding',
          minute: null,
          teamSide: null,
          homeScore: liveMatch.score?.home ?? 0,
          awayScore: liveMatch.score?.away ?? 0,
          opponent: liveMatch.opponent ?? null,
        },
      },
    ];
  }, [liveEntry, liveMatch, teamName]);

  if (!activeTeamSpaceId) return null;

  const renderEntry = (entry: Entry) =>
    entry.kind === 'match' ? (
      <View key={entry.key} style={styles.matchSlot}>
        <MatchPulseCard
          items={entry.items}
          teamName={teamName}
          onPress={() => {
            const eventId = entry.items.find(i => i.eventId)?.eventId;
            if (eventId) {
              openEvent(
                eventId,
                entry.items.map(i => i.id),
              );
            }
          }}
        />
      </View>
    ) : null;

  return (
    <View style={styles.screen}>
      <TeamHeader />
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Varsler</Text>
            {/* Underteksten skal si det som ER sant nå — og hvilket lag det
                gjelder, siden varslene er lag-avgrenset. */}
            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} ${
                    unreadCount === 1 ? 'ny' : 'nye'
                  } fra ${teamName}`
                : items.length > 0
                ? 'Du er oppdatert'
                : `Alt som skjer i ${teamName}`}
            </Text>
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Merk alle varsler som lest">
              <Text style={styles.headerAction}>Merk alle som lest</Text>
            </Pressable>
          )}
        </View>

        {/* Kampen som pågår — kompakt status, eller det utvidede målkortet
            hvis det nyeste uleste er vårt mål. ÉN stadionflate, aldri to. */}
        {liveMatch && liveItems.length > 0 && (
          <View style={styles.matchSlot}>
            <MatchPulseCard
              items={liveItems}
              teamName={teamName}
              isLive
              paused={isPaused}
              liveMinute={liveMinute}
              onPress={() =>
                openEvent(
                  liveMatch.id,
                  liveItems.map(i => i.id),
                )
              }
            />
          </View>
        )}

        {loading ? (
          <View style={[styles.list, styles.standalone]}>
            <ListRowSkeleton />
            <ListRowSkeleton />
            <ListRowSkeleton />
            <ListRowSkeleton showBorder={false} />
          </View>
        ) : error ? (
          <View style={[styles.emptyCard, styles.standalone]}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          /* Tom skjerm er en invitasjon, ikke en beskjed om ingenting. */
          <View style={[styles.emptyCard, styles.standalone]}>
            <View style={styles.emptyIcons}>
              <View style={[styles.emptyIcon, {backgroundColor: colors.liveSoft}]}>
                <Ball size={18} color={colors.liveInk} strokeWidth={2} />
              </View>
              <View style={[styles.emptyIcon, {backgroundColor: colors.sun}]}>
                <Megaphone size={18} color={colors.goldInk} />
              </View>
              <View style={[styles.emptyIcon, {backgroundColor: colors.heiaTint}]}>
                <Text style={styles.emptyEmoji}>👏</Text>
              </View>
            </View>
            <Text style={styles.emptyTitle}>Her blir det liv</Text>
            <Text style={styles.emptyText}>
              Mål, kampstart, trenerbeskjeder og applaus fra laget havner her
              — også når du ikke rakk å se dem.
            </Text>
          </View>
        ) : (
          sections.map(section => {
            // Radene samles i ett kort per sammenhengende kjede; kampkort
            // står for seg selv med luft rundt.
            const blocks: React.ReactNode[] = [];
            let run: Extract<Entry, {kind: 'row'}>[] = [];

            const flushRun = () => {
              if (run.length === 0) return;
              const rows = run;
              run = [];
              blocks.push(
                <View key={`rows-${rows[0].key}`} style={styles.list}>
                  {rows.map((entry, i) => (
                    <NotificationRow
                      key={entry.key}
                      item={entry.item}
                      showBorder={i < rows.length - 1}
                      onPress={() => handlePress(entry.item)}
                    />
                  ))}
                </View>,
              );
            };

            for (const entry of section.entries) {
              if (entry.kind === 'row') {
                run.push(entry);
              } else {
                flushRun();
                blocks.push(renderEntry(entry));
              }
            }
            flushRun();

            return (
              <View key={section.label}>
                <SectionHeader title={section.label} />
                {blocks}
              </View>
            );
          })
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
  // Luften under headeren kommer fra SectionHeaders eget topp-rom («Nå»
  // osv.); tilstander uten seksjoner bruker `standalone` i stedet.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  standalone: {
    marginTop: spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  headerAction: {
    ...typography.bodySmall,
    color: colors.heiaInk,
    fontWeight: '600',
  },
  matchSlot: {
    marginTop: spacing.xl,
  },
  list: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  emptyIcons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 17,
  },
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
