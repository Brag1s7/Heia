import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {
  SectionHeader,
  FeedCard,
  Button,
  LiveMatchBanner,
  NextEventHero,
  TeamHeader,
  MatchPhotoGallery,
  Avatar,
} from '../components';
import {Camera, Check} from '../components/icons';
import {useActiveTeam, useOnboarding, useAuth} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {getLiveMatch, getTeamEvents} from '../lib/api/events';
import {
  getTeamFeed,
  createTextPost,
  createImagePost,
  toggleReaction,
  unpinPost,
  subscribeToFeed,
  type MatchPhoto,
} from '../lib/api/feed';
import {pickTeamImage, type PickedImage} from '../lib/media';
import type {FeedItem, HeiaEvent, HomeStackParamList} from '../shared/types';

/** Valgt bilde i compose-boksen: preview-uri + payload for opplasting. */
type SelectedImage = PickedImage;

/**
 * Kampen er hovedobjektet: feeden viser høydepunktene, kampsiden samler hele
 * historien. Derfor åpner alt som hører til en kamp kampsiden.
 *
 * Vanlige meldinger, påminnelser og bilder uten kampkobling fører ingen
 * steder — de ER innholdet, og et kort som ikke går noe sted skal heller
 * ikke se trykkbart ut.
 */
function openableMatchId(item: FeedItem): string | undefined {
  const isMatchPost =
    item.type === 'match_start' ||
    item.type === 'match_event' ||
    item.type === 'match_end' ||
    item.type === 'resultat' ||
    // Kampbilder er vanlige bildeposter — det er event_id som gjør dem
    // til kampens egne (se createImagePost).
    item.type === 'bilde';

  return isMatchPost ? item.eventId : undefined;
}

/**
 * Feed-bilde → formen galleriet allerede viser. Galleriet er bygget for
 * kampbilder, men trenger bare bilde, tekst og hvem som la det ut — og det
 * har en bildepost også.
 */
function toGalleryPhoto(item: FeedItem): MatchPhoto[] {
  if (!item.imageUrl) return [];
  return [
    {
      id: item.id,
      imageUrl: item.imageUrl,
      caption: item.content || undefined,
      authorName: item.author.name,
      authorAvatarUrl: item.author.avatarUrl,
      createdAt: item.createdAt,
    },
  ];
}

/**
 * Dagens hovedøyeblikk til heroen: første hendelse som ikke er over.
 * `getTeamEvents` leverer stigende på starttid; en hendelse uten sluttid
 * regnes som ferdig 2 t etter start. Live kamp håndteres separat og vinner.
 */
function pickNextEvent(events: HeiaEvent[]): HeiaEvent | null {
  const now = Date.now();
  for (const e of events) {
    // Avlyst er ikke et hovedøyeblikk — og en kamp som alt er SPILT skal
    // ikke stå som «neste» selv om det planlagte avsparket er frem i tid.
    if (e.matchStatus === 'cancelled' || e.matchStatus === 'finished') continue;
    const end = e.endTime ?? new Date(e.startTime.getTime() + 2 * 3600000);
    if (end.getTime() >= now) return e;
  }
  return null;
}

type Nav = NativeStackNavigationProp<HomeStackParamList, 'TeamHome'>;
type Route = RouteProp<HomeStackParamList, 'TeamHome'>;

export function TeamHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const composeRef = useRef<TextInput>(null);
  const [refreshing, setRefreshing] = useState(false);
  const {activeTeamSpace, activeTeamSpaceId, activeRole} = useActiveTeam();
  const {profile} = useAuth();
  const {justCreatedTeamSpaceId, clearJustCreated} = useOnboarding();
  const canBroadcast = isTeamAdmin(activeRole);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [liveMatch, setLiveMatch] = useState<HeiaEvent | null>(null);
  const [nextEvent, setNextEvent] = useState<HeiaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeText, setComposeText] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [posting, setPosting] = useState(false);
  const [fullscreenItem, setFullscreenItem] = useState<FeedItem | null>(null);
  // «Varsle hele laget» — festes øverst i feeden + gir alle et varsel.
  const [broadcast, setBroadcast] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    // Heroene er sekundære: feiler kamp-/kalenderoppslaget skjuler vi dem
    // heller enn å blokkere feeden.
    const livePromise = getLiveMatch(activeTeamSpaceId).catch(() => null);
    const eventsPromise = getTeamEvents(activeTeamSpaceId).catch(
      () => [] as HeiaEvent[],
    );
    try {
      const [items, live, events] = await Promise.all([
        getTeamFeed(activeTeamSpaceId),
        livePromise,
        eventsPromise,
      ]);
      setFeed(items);
      setLiveMatch(live);
      setNextEvent(pickNextEvent(events));
    } catch {
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

  // Live feed (00025). Debounce: én burst med 👏 fra flere foreldre skal bli
  // ÉN refetch, ikke ti. loadFeed setter ikke `loading`, så oppdateringen
  // skjer uten at spinneren blinker.
  useEffect(() => {
    if (!activeTeamSpaceId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToFeed(activeTeamSpaceId, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadFeed, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [activeTeamSpaceId, loadFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  const handleToggleHeia = useCallback(async (post: FeedItem) => {
    const wasReacted = post.iReacted ?? false;
    const delta = wasReacted ? -1 : 1;
    // Optimistisk lokal oppdatering — snappy, og trygt å reversere ved feil.
    setFeed(prev =>
      prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              iReacted: !wasReacted,
              heiaCount: Math.max(0, (p.heiaCount ?? 0) + delta),
            }
          : p,
      ),
    );
    try {
      await toggleReaction(post.id, wasReacted);
    } catch {
      // Reverter til forrige tilstand.
      setFeed(prev =>
        prev.map(p =>
          p.id === post.id
            ? {
                ...p,
                iReacted: wasReacted,
                heiaCount: Math.max(0, (p.heiaCount ?? 0) - delta),
              }
            : p,
        ),
      );
    }
  }, []);

  // Kamerarullen først: hjemme i sofaen ligger bildet som skal deles allerede
  // der. På sidelinja av en kamp er det motsatt — se `handlePickPhoto` i
  // EventDetailScreen.
  const handlePickImage = useCallback(async () => {
    const picked = await pickTeamImage();
    if (picked) setSelectedImage(picked);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const canPost = composeText.trim().length > 0 || selectedImage !== null;

  const handlePost = useCallback(async () => {
    if (!activeTeamSpaceId || !canPost || posting) return;
    setPosting(true);
    try {
      // Kun trener/lagleder kan varsle — databasen avviser resten (00024),
      // så vi sender aldri flagget videre fra en som ikke har lov.
      const pinned = canBroadcast && broadcast;
      if (selectedImage) {
        await createImagePost({
          teamSpaceId: activeTeamSpaceId,
          content: composeText,
          image: selectedImage,
          pinned,
        });
      } else {
        await createTextPost(activeTeamSpaceId, composeText, pinned);
      }
      setComposeText('');
      setSelectedImage(null);
      setBroadcast(false);
      await loadFeed();
    } catch {
      Alert.alert('Kunne ikke publisere', 'Prøv igjen om litt.');
    } finally {
      setPosting(false);
    }
  }, [
    activeTeamSpaceId,
    canPost,
    composeText,
    selectedImage,
    posting,
    loadFeed,
    canBroadcast,
    broadcast,
  ]);

  // Festede poster blir liggende øverst til noen løsner dem. Spør først —
  // det finnes ingen «fest igjen»-knapp på en eksisterende post.
  const handleUnpin = useCallback(
    (post: FeedItem) => {
      Alert.alert(
        'Løsne fra toppen?',
        'Innlegget blir liggende i feeden, men mister «viktig»-merket og plassen øverst.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Løsne',
            style: 'destructive',
            onPress: async () => {
              // Optimistisk: markøren forsvinner med én gang.
              setFeed(prev =>
                prev.map(p => (p.id === post.id ? {...p, isPinned: false} : p)),
              );
              try {
                await unpinPost(post.id);
              } catch {
                Alert.alert('Kunne ikke løsne', 'Prøv igjen om litt.');
              }
              await loadFeed();
            },
          },
        ],
      );
    },
    [loadFeed],
  );

  // «Del med laget» i +-valgarket sender en ny nonce hit for hvert trykk,
  // så compose-boksen får fokus også når vi allerede står på TeamHome.
  const composeNonce = route.params?.composeNonce;
  useEffect(() => {
    if (composeNonce) {
      composeRef.current?.focus();
    }
  }, [composeNonce]);

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

  return (
    <>
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
      {/* Team-header (kompakt) — med inngangen til sesongflaten */}
      <TeamHeader onSeasonPress={() => navigation.navigate('Season')} />

      {/* HERO — dagens hovedøyeblikk: live kamp slår neste aktivitet */}
      {liveMatch ? (
        <View style={styles.section}>
          <LiveMatchBanner
            event={liveMatch}
            onPress={() =>
              navigation.navigate('EventDetail', {eventId: liveMatch.id})
            }
          />
        </View>
      ) : nextEvent ? (
        <View style={styles.section}>
          <NextEventHero
            event={nextEvent}
            onPress={() =>
              navigation.navigate('EventDetail', {eventId: nextEvent.id})
            }
          />
        </View>
      ) : null}

      {/* Feed — hovedinnhold */}
      <SectionHeader title="Siste fra laget" />

      {/* Compose — avsender + rundt felt + bildeknapp (A v2) */}
      <View style={styles.composeCard}>
        <View style={styles.composeRow}>
          <Avatar
            name={profile?.displayName ?? 'Du'}
            uri={profile?.avatarUrl ?? undefined}
            size="md"
          />
          <View style={styles.composeField}>
            <TextInput
              ref={composeRef}
              style={styles.composeInput}
              value={composeText}
              onChangeText={setComposeText}
              placeholder="Del noe med laget …"
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={!posting}
            />
          </View>
          <Pressable
            style={({pressed}) => [
              styles.cameraChip,
              pressed && styles.cameraChipPressed,
            ]}
            onPress={handlePickImage}
            hitSlop={8}
            disabled={posting}
            accessibilityRole="button"
            accessibilityLabel="Legg til bilde">
            <Camera size={19} color={colors.heiaInk} />
          </Pressable>
        </View>
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Image
              source={{uri: selectedImage.uri}}
              style={styles.previewThumb}
              resizeMode="cover"
            />
            <Pressable
              style={styles.removeImageBtn}
              onPress={handleRemoveImage}
              hitSlop={8}
              disabled={posting}>
              <Text style={styles.removeImageText}>Fjern bilde</Text>
            </Pressable>
          </View>
        )}
        {/* Kringkasting er trenerens verktøy: vanlige innlegg varsler ikke,
            så dette er måten å si «dette må alle få med seg».
            Vises først når noe er i ferd med å publiseres — rolig composer. */}
        {canBroadcast && (canPost || posting) && (
          <Pressable
            style={[styles.broadcastRow, broadcast && styles.broadcastRowOn]}
            onPress={() => setBroadcast(v => !v)}
            disabled={posting}
            accessibilityRole="switch"
            accessibilityState={{checked: broadcast}}>
            <View style={[styles.broadcastBox, broadcast && styles.broadcastBoxOn]}>
              {broadcast && (
                <Check size={14} color={colors.heiaInk} strokeWidth={3} />
              )}
            </View>
            <View style={styles.broadcastText}>
              <Text style={styles.broadcastTitle}>🔔 Varsle hele laget</Text>
              <Text style={styles.broadcastHint}>
                Festes øverst i feeden og gir alle et varsel
              </Text>
            </View>
          </Pressable>
        )}
        {(canPost || posting) && (
          <View style={styles.composeActions}>
            <Button
              title="Publiser"
              onPress={handlePost}
              disabled={!canPost}
              loading={posting}
            />
          </View>
        )}
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
        feed.map(item => {
          const matchId = openableMatchId(item);
          return (
          <View key={item.id} style={styles.cardWrap}>
            <FeedCard
              item={item}
              onPress={
                matchId
                  ? () =>
                      navigation.navigate('EventDetail', {eventId: matchId})
                  : undefined
              }
              onExpandImage={
                item.imageUrl ? () => setFullscreenItem(item) : undefined
              }
              onHeia={() => handleToggleHeia(item)}
              onComment={() =>
                navigation.navigate('Comments', {
                  postId: item.id,
                  teamSpaceId: activeTeamSpaceId,
                })
              }
              // Kun trener/lagleder — RLS («Admins can moderate posts»)
              // ville uansett avvist andre.
              onUnpin={
                canBroadcast && item.isPinned
                  ? () => handleUnpin(item)
                  : undefined
              }
            />
          </View>
          );
        })
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

    {/* Fullskjerm bilde — åpnes kun av forstørr-ikonet, aldri av korttrykket. */}
    <MatchPhotoGallery
      photos={fullscreenItem ? toGalleryPhoto(fullscreenItem) : []}
      initialPhotoId={fullscreenItem?.id ?? null}
      onClose={() => setFullscreenItem(null)}
    />
    </>
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
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  composeField: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  composeInput: {
    ...typography.input,
    color: colors.textPrimary,
    minHeight: 24,
    maxHeight: 120,
    padding: 0,
    textAlignVertical: 'top',
  },
  cameraChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.heiaTint,
  },
  cameraChipPressed: {
    opacity: 0.7,
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  broadcastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  broadcastRowOn: {
    backgroundColor: colors.heiaSoft,
  },
  broadcastBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  broadcastBoxOn: {
    borderColor: colors.heiaInk,
  },
  broadcastText: {
    flex: 1,
    gap: 1,
  },
  broadcastTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  broadcastHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  imagePreview: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  previewThumb: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  removeImageBtn: {
    paddingVertical: spacing.xs,
  },
  removeImageText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  feedLoader: {
    marginTop: spacing.xl,
  },
  emptyFeed: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
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
    marginBottom: spacing.sm,
  },
  supportCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
