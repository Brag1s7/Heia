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
  Alert,
  type AlertButton,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {
  SectionHeader,
  FeedCard,
  Button,
  LiveMatchBanner,
  NextEventCarousel,
  TeamHeader,
  MatchPhotoGallery,
  Avatar,
  FeedCardSkeleton,
} from '../components';
import {Camera, Check} from '../components/icons';
import {useActiveTeam, useOnboarding, useAuth} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {getLiveMatch, getTeamEvents} from '../lib/api/events';
import {tournamentTitleFor} from '../shared/calendarList';
import {
  getTeamSupportSummary,
  type TeamSupportSummary,
} from '../lib/api/payments';
import {
  getTeamFeed,
  createTextPost,
  createImagePost,
  toggleReaction,
  unpinPost,
  deletePost,
  subscribeToFeed,
  type MatchPhoto,
} from '../lib/api/feed';
import {pickTeamImage, type PickedImage} from '../lib/media';
import {promptReport} from '../lib/moderation';
import type {
  FeedItem,
  HeiaEvent,
  HomeStackParamList,
  RootTabParamList,
} from '../shared/types';

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
  if (!item.media) return [];
  return [
    {
      id: item.id,
      media: item.media,
      caption: item.content || undefined,
      authorName: item.author.name,
      authorAvatarUrl: item.author.avatarUrl,
      createdAt: item.createdAt,
    },
  ];
}

/**
 * Hendelsene til hero-karusellen: de neste `limit` som ikke er over.
 * `getTeamEvents` leverer stigende på starttid; en hendelse uten sluttid
 * regnes som ferdig 2 t etter start. Live kamp håndteres separat og vinner.
 *
 * ⚠️ Turnerings-CONTAINEREN hoppes over (Brage 2026-08-06). Hjem viser den
 * neste eller aktive KAMPEN, med turneringen som en liten etikett på kortet —
 * ikke et eget turneringskort ved siden av. Ellers ville en cup-helg gitt to
 * hovedøyeblikk som konkurrerte om samme plass.
 */
function pickNextEvents(events: HeiaEvent[], limit: number): HeiaEvent[] {
  const now = Date.now();
  const upcoming: HeiaEvent[] = [];
  for (const e of events) {
    if (e.type === 'turnering') continue;
    // Avlyst er ikke et hovedøyeblikk — og en kamp som alt er SPILT skal
    // ikke stå som «neste» selv om det planlagte avsparket er frem i tid.
    if (e.matchStatus === 'cancelled' || e.matchStatus === 'finished') continue;
    const end = e.endTime ?? new Date(e.startTime.getTime() + 2 * 3600000);
    if (end.getTime() >= now) {
      upcoming.push(e);
      if (upcoming.length >= limit) break;
    }
  }
  return upcoming;
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
  const {profile, session} = useAuth();
  const {justCreatedTeamSpaceId, clearJustCreated} = useOnboarding();
  const canBroadcast = isTeamAdmin(activeRole);
  const myId = session?.user?.id;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [liveMatch, setLiveMatch] = useState<HeiaEvent | null>(null);
  const [nextEvents, setNextEvents] = useState<HeiaEvent[]>([]);
  // Turneringsnavn per kamp-id. Turnerings-CONTAINEREN vises aldri på Hjem
  // (pickNextEvents hopper over den) — dette er det ENESTE stedet en turnering
  // nevnes her, som en liten etikett på kampens eget kort.
  const [tournamentTitles, setTournamentTitles] = useState<
    Record<string, string>
  >({});
  const [supportSummary, setSupportSummary] =
    useState<TeamSupportSummary | null>(null);
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
    // Lagkassa-kortet i karusellen (fase 5) — sekundært, som heroene.
    const supportPromise = getTeamSupportSummary(activeTeamSpaceId).catch(
      () => null,
    );
    try {
      const [items, live, events, support] = await Promise.all([
        getTeamFeed(activeTeamSpaceId, myId),
        livePromise,
        eventsPromise,
        supportPromise,
      ]);
      setFeed(items);
      setLiveMatch(live);
      const upcoming = pickNextEvents(events, 3);
      setNextEvents(upcoming);
      const titles: Record<string, string> = {};
      for (const event of upcoming) {
        const tournament = tournamentTitleFor(event, events);
        if (tournament) titles[event.id] = tournament;
      }
      setTournamentTitles(titles);
      setSupportSummary(support);
    } catch {
      setError('Kunne ikke laste feeden. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId, myId]);

  // FOKUS-bundet lasting + abonnement (fase A, F19-fiksen): en TeamHome bak
  // kampsiden eller en annen fane skal hverken lytte eller refetche. Ved
  // fokus lastes ferskt (fanger det som skjedde mens skjermen var ubevoktet
  // — abonnementet var jo nede), ved blur rives kanal og ventende debounce.
  // Skjelettet vises kun første gang per lag; resync ved re-fokus er stille.
  //
  // Debounce på realtime (00025): én burst med 👏 fra flere foreldre skal
  // bli ÉN refetch, ikke ti. loadFeed setter ikke `loading`, så
  // oppdateringen skjer uten at spinneren blinker.
  const loadedTeamRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!activeTeamSpaceId) return;
      if (loadedTeamRef.current !== activeTeamSpaceId) {
        loadedTeamRef.current = activeTeamSpaceId;
        setLoading(true);
      }
      loadFeed();
      let timer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = subscribeToFeed(activeTeamSpaceId, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(loadFeed, 400);
      });
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    }, [activeTeamSpaceId, loadFeed]),
  );

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

  // Sletting er soft delete i DB-en (00041) — forfatter eller trener/lagleder.
  // Optimistisk: posten forsvinner med én gang, refetch rydder uansett opp.
  const handleDeletePost = useCallback(
    (post: FeedItem) => {
      Alert.alert(
        'Slette innlegget?',
        'Innlegget fjernes fra feeden for hele laget.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Slett',
            style: 'destructive',
            onPress: async () => {
              setFeed(prev => prev.filter(p => p.id !== post.id));
              try {
                await deletePost(post.id);
              } catch {
                Alert.alert('Kunne ikke slette', 'Prøv igjen om litt.');
              }
              await loadFeed();
            },
          },
        ],
      );
    },
    [loadFeed],
  );

  // ⋯-menyen (Apple 1.2): eget innlegg → slett; andres → rapporter;
  // trener/lagleder → begge. Databasen er vakten — menyen bare speiler den.
  const handlePostActions = useCallback(
    (post: FeedItem) => {
      const own = !!myId && post.author.id === myId;
      const buttons: AlertButton[] = [];
      if (!own) {
        buttons.push({
          text: 'Rapporter til Heia',
          onPress: () => promptReport('feed_post', post.id),
        });
      }
      if (own || canBroadcast) {
        buttons.push({
          text: 'Slett innlegget',
          style: 'destructive',
          onPress: () => handleDeletePost(post),
        });
      }
      buttons.push({text: 'Avbryt', style: 'cancel'});
      Alert.alert(
        own ? 'Innlegget ditt' : `Innlegg fra ${post.author.name}`,
        undefined,
        buttons,
      );
    },
    [myId, canBroadcast, handleDeletePost],
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
    {/* Fast header + separat scrollflate — samme mønster som Kalender og
        Varsler: TeamHeader er søsken OVER ScrollView, ikke inni den. */}
    <View style={styles.screen}>
      <TeamHeader onSeasonPress={() => navigation.navigate('Season')} />
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>

      {/* HERO — dagens hovedøyeblikk: live kamp slår neste aktivitet.
          Hverdagsmodus = karusell over de neste hendelsene + kalender-kort;
          karusellens sider eier skjermmargen selv (full bredde her). */}
      {liveMatch ? (
        <View style={styles.section}>
          <LiveMatchBanner
            event={liveMatch}
            onPress={() =>
              navigation.navigate('EventDetail', {eventId: liveMatch.id})
            }
          />
        </View>
      ) : nextEvents.length > 0 || supportSummary ? (
        <View style={styles.carouselSection}>
          <NextEventCarousel
            events={nextEvents}
            tournamentTitles={tournamentTitles}
            onEventPress={e =>
              navigation.navigate('EventDetail', {eventId: e.id})
            }
            onOpenCalendar={() =>
              navigation
                .getParent<NavigationProp<RootTabParamList>>()
                ?.navigate('KalenderStack')
            }
            lagkassa={supportSummary}
            onOpenLagkassa={() => navigation.navigate('Lagkassa')}
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
        <View style={styles.feedSkeleton}>
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </View>
      ) : error ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Stille her ennå …</Text>
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
                item.media ? () => setFullscreenItem(item) : undefined
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
              onMore={() => handlePostActions(item)}
            />
          </View>
          );
        })
      )}

      </ScrollView>
    </View>

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
  carouselSection: {
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
  feedSkeleton: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
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
});
