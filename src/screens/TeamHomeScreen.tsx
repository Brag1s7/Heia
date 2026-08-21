import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
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
import {isSystemMatchPost} from '../shared/matchEngagement';
import {getLiveMatch} from '../lib/api/events';
import {useTeamEvents, teamEventsKey} from '../lib/queries/events';
import {
  useTeamFeed,
  teamFeedKey,
  patchFeedItem,
  removeFeedItem,
  invalidateFeed,
  markFeedStale,
  adjustFeedItemCounts,
  applyFeedPostUpdate,
  refetchFeedFirstPage,
} from '../lib/queries/feed';
import {useScreenFocusRefetch} from '../lib/queries/useScreenFocusRefetch';
import {tournamentTitleFor} from '../shared/calendarList';
import {
  getTeamSupportSummary,
  type TeamSupportSummary,
} from '../lib/api/payments';
import {
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
import {avatarRef} from '../lib/media/avatar';
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
      authorAvatarPath: item.author.avatarPath,
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

interface FeedRowProps {
  item: FeedItem;
  canBroadcast: boolean;
  onOpenMatch: (eventId: string) => void;
  onExpandImage: (item: FeedItem) => void;
  onHeia: (item: FeedItem) => void;
  onComment: (item: FeedItem) => void;
  onUnpin: (item: FeedItem) => void;
  onMore: (item: FeedItem) => void;
}

/**
 * Én feed-rad, memoisert for virtualiseringen (B2): compose-feltet bor i
 * ListHeaderComponent, så hvert tastetrykk re-rendrer skjermen — uten memo
 * ville hele den synlige feeden re-rendret per tegn. Forelderen sender
 * STABILE callbacks som tar `item` som argument; closurene her gjenskapes
 * kun når raden selv re-rendres.
 */
const FeedRow = React.memo(function FeedRow({
  item,
  canBroadcast,
  onOpenMatch,
  onExpandImage,
  onHeia,
  onComment,
  onUnpin,
  onMore,
}: FeedRowProps) {
  const matchId = openableMatchId(item);
  return (
    <View style={styles.cardWrap}>
      <FeedCard
        item={item}
        onPress={matchId ? () => onOpenMatch(matchId) : undefined}
        onExpandImage={item.media ? () => onExpandImage(item) : undefined}
        onHeia={() => onHeia(item)}
        onComment={() => onComment(item)}
        // Kun trener/lagleder — RLS («Admins can moderate posts»)
        // ville uansett avvist andre.
        onUnpin={canBroadcast && item.isPinned ? () => onUnpin(item) : undefined}
        onMore={() => onMore(item)}
      />
    </View>
  );
});

const feedKeyExtractor = (item: FeedItem) => item.id;

// Stabil tom-referanse: `data ?? []` inline ville gitt nytt array per render
// og re-rendret FlatList-en til ingen nytte.
const EMPTY_FEED: FeedItem[] = [];

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

  const [liveMatch, setLiveMatch] = useState<HeiaEvent | null>(null);
  // Hendelsene deles med Kalender via query-cachen (B2/P7) — én henting
  // for begge faner, og en 👏-burst i feeden refetcher ikke lenger
  // kalenderdata. Feiler hentingen er data undefined → heroene skjules,
  // samme «sekundært, blokkerer aldri feeden»-oppførsel som før.
  const eventsQuery = useTeamEvents(activeTeamSpaceId);
  useScreenFocusRefetch(teamEventsKey(activeTeamSpaceId ?? ''));
  // Feeden bor også i query-cachen (B2): useInfiniteQuery over cursoren
  // get_team_feed har hatt ubrukt siden 00029. `data` er den flate,
  // dedupede visningslista (select i queries/feed) — sidestrukturen bor i
  // cachen. Skjelett kun ved isPending (første last per lag, cache-kaldt);
  // resync og refetch er stille, som før. Fokus-resync følger 60 s-regelen.
  const feedQuery = useTeamFeed(activeTeamSpaceId, myId);
  useScreenFocusRefetch(teamFeedKey(activeTeamSpaceId ?? ''));
  const feed = feedQuery.data ?? EMPTY_FEED;
  const {
    refetch: refetchFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = feedQuery;
  const refetchEvents = eventsQuery.refetch;

  const nextEvents = useMemo(
    () => pickNextEvents(eventsQuery.data ?? [], 3),
    [eventsQuery.data],
  );
  // Turneringsnavn per kamp-id. Turnerings-CONTAINEREN vises aldri på Hjem
  // (pickNextEvents hopper over den) — dette er det ENESTE stedet en turnering
  // nevnes her, som en liten etikett på kampens eget kort.
  const tournamentTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const event of nextEvents) {
      const tournament = tournamentTitleFor(event, eventsQuery.data ?? []);
      if (tournament) titles[event.id] = tournament;
    }
    return titles;
  }, [nextEvents, eventsQuery.data]);
  const [supportSummary, setSupportSummary] =
    useState<TeamSupportSummary | null>(null);
  const [composeText, setComposeText] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [posting, setPosting] = useState(false);
  const [fullscreenItem, setFullscreenItem] = useState<FeedItem | null>(null);
  // «Varsle hele laget» — festes øverst i feeden + gir alle et varsel.
  const [broadcast, setBroadcast] = useState(false);

  // Heroene (live kamp + lagkassa) er sekundære og feiler stille — de
  // blokkerer aldri feeden. De bor fortsatt i lokal state: to småkall uten
  // paginering; B3 flytter dem videre ved behov.
  const loadHeroes = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    const [live, support] = await Promise.all([
      getLiveMatch(activeTeamSpaceId).catch(() => null),
      getTeamSupportSummary(activeTeamSpaceId).catch(() => null),
    ]);
    setLiveMatch(live);
    setSupportSummary(support);
  }, [activeTeamSpaceId]);

  // FOKUS-bundet abonnement (fase A, F19-fiksen): en TeamHome bak kampsiden
  // eller en annen fane skal hverken lytte eller refetche; ved blur rives
  // kanal og ventende debounce. Feedens fokus-RESYNC eies nå av
  // useScreenFocusRefetch (60 s-regelen) — heroene hentes fortsatt per fokus.
  //
  // Payload-først (B3, P6-tabellen): 👏 og kommentarer justerer tellerne
  // RETT i cachen (null kall — før kostet en 👏-burst full refetch + heroer),
  // post-endringer patcher/fjerner raden, og kun et NYTT innlegg havner i
  // debouncen (00025: én burst = ÉN henting) — som nå henter KUN side 1.
  // Full invalidering er igjen for to unntak: fallback (payload manglet
  // felter — hygienen fra A som sikkerhetsnett) og resync (kanalen har vært
  // nede; hendelser kan være tapt, P6-reconnect-raden).
  useFocusEffect(
    useCallback(() => {
      if (!activeTeamSpaceId) return;
      loadHeroes();
      let timer: ReturnType<typeof setTimeout> | null = null;
      // 'full' slår 'top': har én hendelse i vinduet krevd full refetch,
      // skal debouncen ikke nedgradere den til en side 1-henting.
      let pending: 'top' | 'full' = 'top';
      const schedule = (mode: 'top' | 'full') => {
        if (mode === 'full') pending = 'full';
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          if (pending === 'full') {
            invalidateFeed(activeTeamSpaceId);
          } else {
            refetchFeedFirstPage(activeTeamSpaceId, myId);
          }
          pending = 'top';
          // Heroene (live kamp + lagkassa) rir kun på post-hendelser:
          // match_start/-end/resultat ER feed-poster, mens en 👏 aldri
          // endrer dem.
          loadHeroes();
        }, 400);
      };
      const unsubscribe = subscribeToFeed(activeTeamSpaceId, myId, evt => {
        switch (evt.kind) {
          case 'reaction':
            adjustFeedItemCounts(activeTeamSpaceId, evt.postId, {
              heia: evt.delta,
            });
            break;
          case 'commentDelta':
            adjustFeedItemCounts(activeTeamSpaceId, evt.postId, {
              comments: evt.delta,
            });
            break;
          case 'postUpdate': {
            const applied = applyFeedPostUpdate(activeTeamSpaceId, evt.row);
            // pinChanged: pinnede poster resorteres øverst (00029) — en
            // patch-in-place kan ikke flytte raden, så side 1 må hentes.
            // miss + is_pinned: posten ligger utenfor lastede sider men
            // hører nå hjemme øverst — samme henting dekker den.
            if (
              applied === 'pinChanged' ||
              (applied === 'miss' && evt.row.is_pinned)
            ) {
              schedule('top');
            }
            break;
          }
          case 'postNew':
            schedule('top');
            break;
          case 'fallback':
            schedule('full');
            break;
          case 'resync':
            // Reconnect er sjeldent og alvorlig (tapte hendelser) — hent
            // straks, uten debounce.
            invalidateFeed(activeTeamSpaceId);
            loadHeroes();
            break;
        }
      });
      return () => {
        if (timer) {
          clearTimeout(timer);
          // Blur midt i debounce-vinduet: hendelsen er KJENT, men F19 sier
          // ingen henting mens skjermen er ubevoktet. Marker stale uten
          // fetch — fokus-broen resyncer straks ved retur, uavhengig av
          // 60 s-regelen.
          markFeedStale(activeTeamSpaceId);
        }
        unsubscribe();
      };
    }, [activeTeamSpaceId, loadHeroes, myId]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Eksplisitt brukerhandling hopper over staleTime (refetch, ikke
    // invalidate) — og henter også heroene.
    Promise.all([refetchFeed(), refetchEvents(), loadHeroes()]).finally(() =>
      setRefreshing(false),
    );
  }, [refetchFeed, refetchEvents, loadHeroes]);

  const handleToggleHeia = useCallback(
    async (post: FeedItem) => {
      if (!activeTeamSpaceId) return;
      const wasReacted = post.iReacted ?? false;
      const delta = wasReacted ? -1 : 1;
      // Optimistisk oppdatering rett i query-cachen — snappy, og trygt å
      // reversere ved feil.
      patchFeedItem(activeTeamSpaceId, post.id, p => ({
        ...p,
        iReacted: !wasReacted,
        heiaCount: Math.max(0, (p.heiaCount ?? 0) + delta),
      }));
      try {
        await toggleReaction(post.id, wasReacted);
      } catch {
        // Reverter til forrige tilstand.
        patchFeedItem(activeTeamSpaceId, post.id, p => ({
          ...p,
          iReacted: wasReacted,
          heiaCount: Math.max(0, (p.heiaCount ?? 0) - delta),
        }));
      }
    },
    [activeTeamSpaceId],
  );

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
      await refetchFeed();
    } catch (e: any) {
      // Dev-bygg viser årsaken rett i alerten (upload-helperen legger
      // serverens svar i meldingen); prod beholder den rolige varianten.
      if (__DEV__) console.warn('[compose] publisering feilet:', e);
      Alert.alert(
        'Kunne ikke publisere',
        __DEV__ && e?.message ? String(e.message) : 'Prøv igjen om litt.',
      );
    } finally {
      setPosting(false);
    }
  }, [
    activeTeamSpaceId,
    canPost,
    composeText,
    selectedImage,
    posting,
    refetchFeed,
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
              if (!activeTeamSpaceId) return;
              // Optimistisk: markøren forsvinner med én gang. Refetchen
              // etterpå resorterer (posten skal ned fra toppen) — og
              // reverterer samtidig om skrivet feilet.
              patchFeedItem(activeTeamSpaceId, post.id, p => ({
                ...p,
                isPinned: false,
              }));
              try {
                await unpinPost(post.id);
              } catch {
                Alert.alert('Kunne ikke løsne', 'Prøv igjen om litt.');
              }
              invalidateFeed(activeTeamSpaceId);
            },
          },
        ],
      );
    },
    [activeTeamSpaceId],
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
              if (!activeTeamSpaceId) return;
              removeFeedItem(activeTeamSpaceId, post.id);
              try {
                await deletePost(post.id);
              } catch {
                Alert.alert('Kunne ikke slette', 'Prøv igjen om litt.');
              }
              invalidateFeed(activeTeamSpaceId);
            },
          },
        ],
      );
    },
    [activeTeamSpaceId],
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
      // ⚠️ SYSTEMETS KAMPPOSTER KAN IKKE SLETTES HERFRA (P3, skive 8).
      // «Slett innlegget» var en LØGN på et mål: posten forsvant, men
      // stillingen sto på 2–1, hendelsen sto i kampforløpet og varselet lå i
      // innboksen — brukeren trodde hun hadde angret. Basen avviser det nå
      // (`soft_delete_post`, 00075); her fjernes knappen, så den aldri
      // TILBYS. Et kampBILDE er brukerens eget innhold og beholder sin.
      if ((own || canBroadcast) && !isSystemMatchPost(post.type)) {
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

  const handleOpenMatch = useCallback(
    (eventId: string) => {
      navigation.navigate('EventDetail', {eventId});
    },
    [navigation],
  );

  const handleExpandImage = useCallback((item: FeedItem) => {
    setFullscreenItem(item);
  }, []);

  const handleComment = useCallback(
    (item: FeedItem) => {
      navigation.navigate('Comments', {
        postId: item.id,
        teamSpaceId: item.teamSpaceId,
      });
    },
    [navigation],
  );

  const renderFeedItem = useCallback(
    ({item}: {item: FeedItem}) => (
      <FeedRow
        item={item}
        canBroadcast={canBroadcast}
        onOpenMatch={handleOpenMatch}
        onExpandImage={handleExpandImage}
        onHeia={handleToggleHeia}
        onComment={handleComment}
        onUnpin={handleUnpin}
        onMore={handlePostActions}
      />
    ),
    [
      canBroadcast,
      handleOpenMatch,
      handleExpandImage,
      handleToggleHeia,
      handleComment,
      handleUnpin,
      handlePostActions,
    ],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  // ⚠️ ELEMENT, ikke inline funksjonskomponent: som `ListHeaderComponent={()
  // => …}` ville headeren REMOUNTET ved hver render — TextInput-en hadde
  // mistet fokus og tastaturet lukket seg midt i skrivingen. Et element
  // rekonsilieres på type, så compose-feltet beholder identiteten sin.
  const listHeader = (
    <>
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

      {/* Compose — avsender + rundt felt + bildeknapp (A v2)
          ⚠️ DETTE ER «DEL MED LAGET»-INNGANGEN, OG DEN ER PERMANENT (P4,
          skive 10). Den ligger i `ListHeaderComponent`, som tegnes OVER
          `ListEmptyComponent` — altså finnes den både når feeden er full og
          når den er tom, for alle roller. Det var nettopp denne
          permanensen som gjorde det forsvarlig å fjerne den generiske
          «+»-knappen fra tab-baren til fordel for kampknappen. Flytter du
          den inn i en tilstand, mister laget sin eneste vei til å skrive. */}
      <View style={styles.composeCard}>
        <View style={styles.composeRow}>
          <Avatar
            name={profile?.displayName ?? 'Du'}
            media={avatarRef(profile?.avatarPath)}
            color={profile?.avatarColor}
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
              // Placeholder leses av VoiceOver, men den er en oppfordring —
              // ikke navnet på handlingen. Labelen gir feltet produktordet,
              // det samme som valgarket het før det ble erstattet.
              accessibilityLabel="Del med laget"
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
    </>
  );

  // Vises kun når lista er tom — har feeden data, beholdes den også når en
  // refetch feiler (behold-ved-feil, samme regel som kalenderen).
  const listEmpty = feedQuery.isPending ? (
    <View style={styles.feedSkeleton}>
      <FeedCardSkeleton />
      <FeedCardSkeleton />
      <FeedCardSkeleton />
    </View>
  ) : feedQuery.isError ? (
    <View style={styles.emptyFeed}>
      <Text style={styles.emptyText}>
        Kunne ikke laste feeden. Dra ned for å prøve igjen.
      </Text>
    </View>
  ) : (
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
  );

  return (
    <>
    {/* Fast header + separat scrollflate — samme mønster som Kalender og
        Varsler: TeamHeader er søsken OVER lista, ikke inni den. Lista er
        FlatList (B2): kun det synlige vinduet av feeden er montert, og
        onEndReached henter neste side via cursoren. */}
    <View style={styles.screen}>
      {/* ⚠️ KILDEBEVARENDE (Brage 2026-08-21): snarveien er en HJEM-inngang
          til den samme `SeasonScreen` som Kamp-fanen har som rot. Du kom fra
          Hjem, Hjem forblir valgt, og «tilbake» fører til Hjem. Et fanebytte
          her ville vært en tilbakeknapp som teleporterer — nettopp det
          modellen forbyr. */}
      <TeamHeader onSeasonPress={() => navigation.navigate('Season')} />
      <FlatList
        data={feed}
        renderItem={renderFeedItem}
        keyExtractor={feedKeyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.feedFooter} color={colors.heia} />
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Ingen horisontal padding her — karusellen i headeren er full
        // bredde; radene har sin egen (cardWrap).
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
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
  feedFooter: {
    paddingVertical: spacing.lg,
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
