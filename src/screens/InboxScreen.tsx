import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
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
import {buildEntries, groupByAge, mergeNotifications} from '../shared/inbox';
import type {Entry, HeiaNotification} from '../shared/inbox';
import {getLiveMatch} from '../lib/api/events';
import type {HeiaEvent} from '../shared/types';
import type {InboxStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<InboxStackParamList, 'InboxList'>;

/** Én side varsler — både første last og hver eldre side bakover. */
const PAGE_SIZE = 50;

/**
 * FlatList-enhetene (B2): seksjonene flates til blokker — overskrift,
 * sammenhengende kjede av rader (ETT kort, så rammespråket består), eller
 * kampkort. Blokk-granulariteten holder virtualiseringen enkel uten å
 * splitte kortenes border/overflow per rad.
 */
type InboxBlock =
  | {kind: 'section'; key: string; label: string}
  | {kind: 'rows'; key: string; rows: Extract<Entry, {kind: 'row'}>[]}
  | {kind: 'match'; key: string; entry: Extract<Entry, {kind: 'match'}>};

const blockKeyExtractor = (block: InboxBlock) => block.key;

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
  // Paginering bakover (B2): satt når siste henting fylte en hel side —
  // da kan det finnes eldre.
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const teamName = activeTeamSpace?.displayName ?? 'laget';
  const firstLoad = useRef(true);
  // Flette-kallene trenger nyeste/eldste rad uten å avhenge av `items` i
  // dep-arrayene sine — ellers ville fokus-effekten revet og bygget
  // abonnementsløpet ved hver liste-endring.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const loadedTeamRef = useRef<string | null>(null);
  // Sekvensvern for alt asynkront mot `items`: telleren bumpes ved lagbytte
  // og ved hver nullstilling, og et svar som landet ETTER at verden gikk
  // videre forkastes. Uten dette kunne et tregt svar fra forrige lag (eller
  // en loadOlder i flukt under pull-to-refresh) flettet seg inn i en liste
  // det ikke hører hjemme i.
  const listGenRef = useRef(0);
  useEffect(() => {
    listGenRef.current++;
  }, [activeTeamSpaceId]);

  const load = useCallback(
    async (opts?: {reset?: boolean}) => {
      if (!activeTeamSpaceId) return;
      setError(null);
      const gen = listGenRef.current;
      const isNewTeam = loadedTeamRef.current !== activeTeamSpaceId;
      try {
        // Live-kampen hentes ved siden av varslene: stripa skal stå der også
        // når du har lest alle kamphendelsene. Feiler den, mister vi bare
        // stripa — varslene er hovedsaken.
        const [notifications, live] = await Promise.all([
          getNotifications(activeTeamSpaceId, {limit: PAGE_SIZE}),
          getLiveMatch(activeTeamSpaceId).catch(() => null),
        ]);
        if (gen !== listGenRef.current) return;
        const existing = itemsRef.current;
        // HULL-VAKTEN: kom det MER enn en full side siden sist (helgecup,
        // en uke i bakgrunn), overlapper ikke de hentede radene lista —
        // radene mellom ville aldri blitt hentet, og flettingen hadde
        // skjult hullet for alltid. Disjunkt tidsrom → nullstill i stedet.
        const disjoint =
          existing.length > 0 &&
          notifications.length === PAGE_SIZE &&
          notifications[notifications.length - 1].createdAt.getTime() >
            existing[0].createdAt.getTime();
        // Myk innlasting: nye rader glir inn i stedet for å hoppe. Kun ved
        // reell endring — en armert animasjon uten layout-endring blir
        // hengende og «konsumeres» av neste virtualiserings-mount under
        // scrolling. (Og aldri ved førstegangslast: skjelett → liste skal
        // ikke føles treg.)
        const existingIds = new Set(existing.map(n => n.id));
        const hasChanges = notifications.some(n => !existingIds.has(n.id));
        if (!firstLoad.current && hasChanges) {
          LayoutAnimation.configureNext(
            LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'),
          );
        }
        firstLoad.current = false;
        loadedTeamRef.current = activeTeamSpaceId;
        if (opts?.reset || isNewTeam || disjoint) {
          // Lagbytte, pull-to-refresh og hull-vakten NULLSTILLER — to lags
          // varsler skal aldri blandes, og eksplisitt refresh er «tilbake
          // til toppen».
          setItems(notifications);
          setHasOlder(notifications.length === PAGE_SIZE);
          listGenRef.current++;
        } else {
          // Vanlig fokus-resync FLETTER: de nyeste 50 friskes opp (readAt
          // fra andre enheter følger med), mens eldre sider brukeren har
          // scrollet frem beholdes — lista hopper ikke under fingeren.
          setItems(prev => mergeNotifications(prev, notifications));
        }
        setLiveMatch(live);
        // Lista er sannheten — hold badgen i takt med det du faktisk ser.
        refreshUnread();
      } catch {
        if (gen !== listGenRef.current) return;
        // Feilet LAGBYTTE skal ikke bli stående og vise forrige lags varsler
        // under det nye lagets header — tøm, så feilkortet (ListEmpty) vises
        // og neste fokus prøver på nytt.
        if (isNewTeam && itemsRef.current.length > 0) {
          setItems([]);
          setHasOlder(false);
          listGenRef.current++;
        }
        setError('Kunne ikke laste varsler. Dra ned for å prøve igjen.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTeamSpaceId, refreshUnread],
  );

  // Inkrementell resync (B2): et realtime-varsel mens du STÅR på skjermen
  // henter kun rader nyere enn nyeste kjente — 1–2 rader i en målburst, ikke
  // hele førstesiden på nytt. Full side nyere = mulig hull mot lista → full
  // last i stedet (hull-vakten i load() nullstiller da). Feil er stille;
  // neste fokus/refresh dekker.
  const loadNewer = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    const newest = itemsRef.current[0];
    if (!newest || loadedTeamRef.current !== activeTeamSpaceId) {
      await load();
      return;
    }
    const gen = listGenRef.current;
    try {
      const [fresh, live] = await Promise.all([
        getNotifications(activeTeamSpaceId, {
          limit: PAGE_SIZE,
          after: newest.createdAt,
        }),
        getLiveMatch(activeTeamSpaceId).catch(() => null),
      ]);
      if (gen !== listGenRef.current) return;
      if (fresh.length >= PAGE_SIZE) {
        await load();
        return;
      }
      if (fresh.length > 0) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'),
        );
        setItems(prev => mergeNotifications(prev, fresh));
      }
      setLiveMatch(live);
      // Badgen: +1 skjedde alt lokalt i NotificationsContext (B3, P6 —
      // «ingen count-spørring» per varsel); full load() og lest-markeringer
      // resyncer fasit.
    } catch {
      // Stille — realtime-resync er best effort.
    }
  }, [activeTeamSpaceId, load]);

  // Eldre sider på scroll (B2): keyset bakover fra eldste kjente rad.
  // Guardene bor her (ikke i onEndReached) så en rask dobbel-trigger aldri
  // gir to parallelle hentinger — og lag-vakten sikrer at vi aldri paginerer
  // videre på en liste som tilhører et annet lag enn det aktive.
  const loadOlder = useCallback(async () => {
    if (!activeTeamSpaceId || loadingOlder || !hasOlder) return;
    if (loadedTeamRef.current !== activeTeamSpaceId) return;
    const oldest = itemsRef.current[itemsRef.current.length - 1];
    if (!oldest) return;
    const gen = listGenRef.current;
    setLoadingOlder(true);
    try {
      const older = await getNotifications(activeTeamSpaceId, {
        limit: PAGE_SIZE,
        before: oldest.createdAt,
      });
      if (gen !== listGenRef.current) return;
      setHasOlder(older.length === PAGE_SIZE);
      if (older.length > 0) {
        setItems(prev => mergeNotifications(prev, older));
      }
    } catch {
      // Stille — neste onEndReached prøver igjen.
    } finally {
      setLoadingOlder(false);
    }
  }, [activeTeamSpaceId, loadingOlder, hasOlder]);

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
  // Debounced: en burst (mål + kommentar i samme sekund) blir ÉN henting —
  // og den hentingen er nå inkrementell (loadNewer).
  useEffect(() => {
    if (!isFocused || liveNonce === handledNonceRef.current) return;
    handledNonceRef.current = liveNonce;
    if (nonceTimerRef.current) clearTimeout(nonceTimerRef.current);
    nonceTimerRef.current = setTimeout(() => {
      nonceTimerRef.current = null;
      loadNewer();
    }, 400);
  }, [isFocused, liveNonce, loadNewer]);

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
    load({reset: true});
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

      // Klubbdør-varsler (00047) og rollevarsler (00067) peker på en fast
      // skjerm — de åpnes i varselstacken så «Tilbake» går til lista.
      if (item.targetScreen) {
        navigation.navigate(
          item.targetScreen === 'club_payments'
            ? 'ClubPayments'
            : item.targetScreen === 'team_members'
              ? 'TeamMembers'
              : 'SupportSetup',
        );
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

  // Seksjonene → flate FlatList-blokker. Samme kjede-logikk som før:
  // sammenhengende rader samles i ETT kort, kampkort står for seg selv.
  const blocks = useMemo(() => {
    const out: InboxBlock[] = [];
    for (const section of sections) {
      out.push({
        kind: 'section',
        key: `section-${section.label}`,
        label: section.label,
      });
      let run: Extract<Entry, {kind: 'row'}>[] = [];
      const flushRun = () => {
        if (run.length === 0) return;
        out.push({kind: 'rows', key: `rows-${run[0].key}`, rows: run});
        run = [];
      };
      for (const entry of section.entries) {
        if (entry.kind === 'row') {
          run.push(entry);
        } else {
          flushRun();
          out.push({kind: 'match', key: entry.key, entry});
        }
      }
      flushRun();
    }
    return out;
  }, [sections]);

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

  const renderBlock = useCallback(
    ({item}: {item: InboxBlock}) => {
      if (item.kind === 'section') {
        return <SectionHeader title={item.label} />;
      }
      if (item.kind === 'match') {
        const entry = item.entry;
        return (
          <View style={styles.matchSlot}>
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
        );
      }
      // Radene samles i ett kort per sammenhengende kjede.
      return (
        <View style={styles.list}>
          {item.rows.map((entry, i) => (
            <NotificationRow
              key={entry.key}
              item={entry.item}
              showBorder={i < item.rows.length - 1}
              onPress={() => handlePress(entry.item)}
            />
          ))}
        </View>
      );
    },
    [teamName, openEvent, handlePress],
  );

  if (!activeTeamSpaceId) return null;

  // ELEMENT, ikke inline komponent — samme remount-regel som TeamHome.
  const listHeader = (
    <>
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
    </>
  );

  // Kun når blokk-lista er tom. `items.length`-vakten skiller «ingen varsler»
  // fra «alle varsler bor i live-stripa i headeren» — der skal flaten under
  // stå tom, ikke vise invitasjonskortet.
  const listEmpty = loading ? (
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
  ) : null;

  return (
    <View style={styles.screen}>
      <TeamHeader />
      <FlatList
        data={blocks}
        renderItem={renderBlock}
        keyExtractor={blockKeyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          loadingOlder ? (
            <ActivityIndicator
              style={styles.footerSpinner}
              color={colors.heia}
            />
          ) : null
        }
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }
      />
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
  footerSpinner: {
    paddingVertical: spacing.lg,
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
