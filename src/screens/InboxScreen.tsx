import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  ListRowSkeleton,
  NotificationRow,
  SectionHeader,
  TeamHeader,
} from '../components';
import {useActiveTeam, useNotifications} from '../context';
import {getNotifications} from '../lib/api/notifications';
import type {HeiaNotification} from '../lib/api/notifications';
import type {InboxStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<InboxStackParamList, 'InboxList'>;

const DAY_MS = 86_400_000;

/**
 * «I dag / I går / Siste 7 dager / Tidligere» (P6) — ren lesehjelp, ingen ny
 * modell. Radene kommer nyest først fra serveren, så hver bolk er en
 * sammenhengende run og rekkefølgen består.
 */
function groupByAge(
  items: HeiaNotification[],
): {label: string; items: HeiaNotification[]}[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const labelFor = (d: Date): string => {
    const t = d.getTime();
    if (t >= startOfToday) return 'I dag';
    if (t >= startOfToday - DAY_MS) return 'I går';
    if (t >= startOfToday - 7 * DAY_MS) return 'Siste 7 dager';
    return 'Tidligere';
  };

  const sections: {label: string; items: HeiaNotification[]}[] = [];
  for (const item of items) {
    const label = labelFor(item.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      sections.push({label, items: [item]});
    }
  }
  return sections;
}

export function InboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId} = useActiveTeam();
  const {unreadCount, refreshUnread, markRead, markAllRead, liveNonce} =
    useNotifications();

  const [items, setItems] = useState<HeiaNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      setItems(await getNotifications(activeTeamSpaceId));
      // Lista er sannheten — hold badgen i takt med det du faktisk ser.
      refreshUnread();
    } catch {
      setError('Kunne ikke laste varsler. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId, refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Står du på skjermen når varselet kommer, skal raden dukke opp av seg selv.
  // Kanalen bor i NotificationsContext — den teller opp liveNonce.
  useEffect(() => {
    if (liveNonce > 0) {
      load();
    }
  }, [liveNonce, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handlePress = useCallback(
    (item: HeiaNotification) => {
      if (item.readAt === null) {
        // Lokalt først, så raden endrer seg i samme trykk som navigasjonen.
        setItems(prev =>
          prev.map(n => (n.id === item.id ? {...n, readAt: new Date()} : n)),
        );
        markRead([item.id]);
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
    [navigation, markRead, activeTeamSpaceId],
  );

  const handleMarkAll = useCallback(() => {
    const now = new Date();
    setItems(prev => prev.map(n => (n.readAt ? n : {...n, readAt: now})));
    markAllRead();
  }, [markAllRead]);

  const sections = useMemo(() => groupByAge(items), [items]);

  if (!activeTeamSpaceId) return null;

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
            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} ulest${unreadCount === 1 ? '' : 'e'}`
                : 'Alt du har gått glipp av'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAll} hitSlop={8}>
              <Text style={styles.headerAction}>Merk alle som lest</Text>
            </Pressable>
          )}
        </View>

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
          <View style={[styles.emptyCard, styles.standalone]}>
            <Text style={styles.emptyTitle}>Ingen varsler ennå</Text>
            <Text style={styles.emptyText}>
              Mål, kampstart og nye innlegg fra laget havner her — også når du
              ikke rakk å se dem.
            </Text>
          </View>
        ) : (
          /* Bolkene «I dag / I går / …» — mint-strek-etikett + samme enkle
             liste som før, bare delt opp. Ikke kort per varsel. */
          sections.map(section => (
            <View key={section.label}>
              <SectionHeader title={section.label} />
              <View style={styles.list}>
                {section.items.map((item, i) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    showBorder={i < section.items.length - 1}
                    onPress={() => handlePress(item)}
                  />
                ))}
              </View>
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
  // Luften under headeren kommer fra SectionHeaders eget topp-rom («I dag»
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
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
