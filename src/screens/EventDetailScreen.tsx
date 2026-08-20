import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  colors,
  typography,
  spacing,
  radius,
  fonts,
  shadows,
  matchColors,
} from '../theme';
import {
  BackBar,
  Card,
  Button,
  RSVPBar,
  SectionHeader,
  Avatar,
  ListRow,
  EventCard,
  HeroSurface,
  StadiumSurface,
  StatusPill,
  TeamBadge,
  ReporterModal,
  ReporterBar,
  ReporterSheet,
  MatchPhotoSheet,
  MatchPhotoRail,
  MatchPhotoGallery,
  MatchTimeline,
  Skeleton,
  SkeletonCard,
} from '../components';
import {FinishedMatch} from '../components/match/FinishedMatch';
import {LiveMatch} from '../components/match/LiveMatch';
import {MapPin} from '../components/icons';
import type {PillKind} from '../components/StatusPill';
import type {ReporterActionType} from '../components/ReporterActions';
import {useAuth, useActiveTeam, useNotifications} from '../context';
import type {TeamAuthor, TeamMember} from '../lib/api/members';
import {useTeamAuthors, useTeamMembers} from '../lib/queries/members';
import {
  applyMatchEventInsert,
  applyMatchSessionUpdate,
  eventDetailKey,
  invalidateEventDetail,
  invalidateMatchPhotos,
  markEventDetailStale,
  markMatchPhotosStale,
  matchPhotosKey,
  patchEventDetail,
  useEventDetail,
  useMatchPhotos,
} from '../lib/queries/eventDetail';
import {useScreenFocusRefetch} from '../lib/queries/useScreenFocusRefetch';
import {
  getTournamentMatches,
  setRsvp,
  setMatchCancelled,
  setMatchReporter,
  startMatch,
  reportMatchEvent,
  subscribeToMatch,
  type ReportMatchEventInput,
} from '../lib/api/events';
import {createImagePost, type MatchPhoto} from '../lib/api/feed';
import {pickTeamImage, type PickedImage} from '../lib/media';
import {isTeamAdmin} from '../shared/roles';
import {dayRangeLabel} from '../shared/calendar';
import {eventIsUpcoming} from '../shared/eventForm';
import type {
  EventAttendee,
  EventType,
  HeiaEvent,
  MatchEvent,
  HomeStackParamList,
  RSVPStatus,
  RSVPSummary,
} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

// Stabile tomme referanser: `?? []` ville gitt railens FlatList ny data-ref
// hver render (minuttickeren re-rendrer skjermen hvert 30. sekund på live).
const NO_MEMBERS: TeamMember[] = [];
const NO_AUTHORS: TeamAuthor[] = [];
const NO_PHOTOS: MatchPhoto[] = [];
// ⚠️ `length` er IKKE eneste sannhet (se PulseCurve-regelen i handoffen) —
// men referansen må uansett være stabil, ellers regner hver memo nedstrøms
// på nytt ved hvert minutt-tick.
const NO_MATCH_EVENTS: MatchEvent[] = [];

const dayNamesLong = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];
const monthNamesLong = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
];

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Samme type-pill som kortene på Hjem og i kalenderen — infokortet er samme
// hero-flate (Brages retning 2026-07-31), og pillen bærer typefargen.
const typePill: Record<EventType, {kind: PillKind; label: string}> = {
  trening: {kind: 'trening', label: 'Trening'},
  kamp: {kind: 'kamp', label: 'Kamp'},
  turnering: {kind: 'turnering', label: 'Turnering'},
  sosialt: {kind: 'sosialt', label: 'Sosialt'},
  annet: {kind: 'neutral', label: 'Hendelse'},
};

/** Samme forkorting som ScoreBoard/TeamBadge — motstandermerket på platta. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

function formatDateLong(date: Date): string {
  const day = dayNamesLong[date.getDay()];
  const dateNum = date.getDate();
  const month = monthNamesLong[date.getMonth()];
  return `${day} ${dateNum}. ${month}`;
}

/** `ReporterActions`-knappene → det `report_match_event` faktisk godtar. */
const ACTION_TO_EVENT: Record<ReporterActionType, ReportMatchEventInput> = {
  mål_oss: {type: 'mål', teamSide: 'home'},
  mål_dem: {type: 'mål', teamSide: 'away'},
  pause: {type: 'pause'},
  andre_omgang: {type: 'andre_omgang'},
  slutt: {type: 'slutt'},
  melding: {type: 'melding'},
};


/**
 * RPC-ene kaster med engelske meldinger. Oversett de vi kan handle på, og fall
 * tilbake på noe generelt — en rå Postgres-feil hjelper ingen på sidelinjen.
 */
function matchErrorText(e: unknown, fallback: string): string {
  const message = (e as {message?: string} | null)?.message ?? '';
  if (message.includes('Match already started')) {
    return 'Kampen er allerede i gang.';
  }
  if (message.includes('Match is not underway')) {
    return 'Kampen er ikke i gang lenger.';
  }
  if (message.includes('Match is not paused')) {
    return 'Kampen er alt i gang.';
  }
  if (message.includes('Match is not live')) {
    return 'Kampen er alt i pause.';
  }
  // Avlysning (00057). Begge to betyr at noen andre rakk å endre statusen
  // først — beskjeden må si HVA som gjelder nå, ikke bare at det gikk galt.
  if (message.includes('Only a scheduled match can be cancelled')) {
    return 'Kampen er alt i gang eller ferdigspilt.';
  }
  if (message.includes('Match is not cancelled')) {
    return 'Kampen er ikke avlyst.';
  }
  if (
    message.includes('Access denied') ||
    message.includes('Only coaches, team leaders and admins')
  ) {
    return 'Du har ikke tilgang til å gjøre dette.';
  }
  return fallback;
}

/**
 * Speiler brukerens valg i tallene uten å telle svaret to ganger:
 * `base` er serverens summer, der `base.myStatus` allerede er med.
 * Holder tallene riktige mens svaret er på vei til serveren.
 */
function applyMyStatus(base: RSVPSummary, myStatus: RSVPStatus): RSVPSummary {
  if (myStatus === base.myStatus) return base;

  const next = {...base, myStatus};
  const bucket = {
    kommer: 'coming',
    kan_ikke: 'notComing',
    venter: 'pending',
  } as const;

  const from = bucket[base.myStatus];
  const to = bucket[myStatus];
  next[from] = Math.max(0, next[from] - 1);
  next[to] += 1;
  return next;
}

export function EventDetailScreen({route, navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {profile: currentUser} = useAuth();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();
  const {eventId} = route.params;

  const teamName = activeTeamSpace?.displayName ?? '';

  // B2: hendelsen bor i query-cachen (P7-nøkkelen ['event', id]).
  // Redigeringsmodal-fella fra 2026-08-07 (lukker seg tilbake hit med gammel
  // dato) dekkes nå av invalideringen: updateEvent invaliderer ['event', id]
  // i api-laget, og observeren her står montert under modalen og refetcher
  // straks — uavhengig av fokus-broens 60 s-regel.
  const eventQuery = useEventDetail(eventId, activeTeamSpaceId);
  const event = eventQuery.data ?? null;
  const refetchEvent = eventQuery.refetch;

  const [savingRsvp, setSavingRsvp] = useState(false);
  const [savingReporter, setSavingReporter] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [startingMatch, setStartingMatch] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reporterModalVisible, setReporterModalVisible] = useState(false);
  const [reporterSheetVisible, setReporterSheetVisible] = useState(false);
  const [selectedActionType, setSelectedActionType] =
    useState<ReporterActionType>('mål_oss');
  const [savingCancelled, setSavingCancelled] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PickedImage | null>(null);
  const [publishingPhoto, setPublishingPhoto] = useState(false);
  const [galleryPhotoId, setGalleryPhotoId] = useState<string | null>(null);

  // Turnering: kampene lastes for seg og refetches ved fokus — «Ny kamp»
  // lukker modalen tilbake hit, og å komme tilbake fra en kamp skal vise
  // ferske stillinger. Feiler kallet lever resten av siden videre.
  const isTournament = event?.type === 'turnering';
  const [tournamentMatches, setTournamentMatches] = useState<HeiaEvent[]>([]);
  const loadTournamentMatches = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      setTournamentMatches(
        await getTournamentMatches(eventId, activeTeamSpaceId),
      );
    } catch {
      // Stille — kamplisten er tom til neste fokus.
    }
  }, [eventId, activeTeamSpaceId]);

  useFocusEffect(
    useCallback(() => {
      if (isTournament) loadTournamentMatches();
    }, [isTournament, loadTournamentMatches]),
  );

  // Medlemslisten brukes kun av kampreporter-UI-et, så den hentes først når
  // vi vet at hendelsen er en kamp — en trening skal ikke koste et RPC-kall
  // (null → enabled: false). Cachen deler 5 min-staleTime med de andre
  // medlemsflatene. Feiler den, lever resten av skjermen videre: `reporter`
  // faller tilbake på et navnløst medlem i stedet for å påstå at rollen er
  // ledig.
  const isMatchEvent = event?.matchSessionId != null;
  // Rosteret brukes KUN av reporter-UI-et (ReporterBar + ReporterSheet), og
  // begge er gatet på live/kommende kamp. Den frosne rapporten trenger det
  // ikke — så den skal heller ikke betale for kallet.
  const needsRoster = isMatchEvent && event?.matchStatus !== 'finished';
  const teamMembers =
    useTeamMembers(needsRoster ? activeTeamSpaceId : null).data ?? NO_MEMBERS;

  // Reporteren bak en oppdatering i kampforløpet. Noden sier HVA som skjedde,
  // avataren sier HVEM.
  //
  // ⚠️ FORFATTERE, IKKE MEDLEMMER. `get_team_members` filtrerer på
  // `status IN ('active','invited')`, så en reporter som forlater laget
  // forsvinner derfra — og da ville hver eneste oppdatering hun skrev mistet
  // navn og avatar i en FROSSET kamprapport. Det er nøyaktig hullet 00067 §2
  // lukket for kommentarfeltet; `get_team_authors` har ingen statusfilter og
  // er derfor riktig kilde for forfatterskap. Samme 5-min-cache.
  const teamAuthors =
    useTeamAuthors(isMatchEvent ? activeTeamSpaceId : null).data ?? NO_AUTHORS;
  const authorsById = useMemo(() => {
    const map = new Map<string, TeamAuthor>();
    for (const a of teamAuthors) map.set(a.id, a);
    return map;
  }, [teamAuthors]);
  const authorFor = useCallback(
    (userId: string) => authorsById.get(userId),
    [authorsById],
  );

  // Kampbilder — egen query-sti (P6-splitten): et mål re-laster aldri
  // bildene. Feiler den, lever kampsiden videre (isError ignoreres bevisst —
  // stripa vises bare når det finnes bilder).
  const photosQuery = useMatchPhotos(eventId, isMatchEvent);
  const matchPhotos = photosQuery.data ?? NO_PHOTOS;
  const refetchPhotos = photosQuery.refetch;

  // Kampen er i gang (også i pause — da telles minuttene fortsatt).
  const isUnderway =
    event?.matchStatus === 'live' || event?.matchStatus === 'halfTime';
  const liveMatchSessionId = isUnderway ? event?.matchSessionId : undefined;

  // ⚠️ KORTET BAK SKJERMEN. Stackens `contentStyle` er krem for alle skjermer
  // (AppNavigator), og det er den flaten som blinker i kantene under push/pop.
  // Mot kampens grunn ville den blinket KREM inn i en mørkegrønn verden.
  // Ruten er delt av alle hendelsestyper, så den kan ikke settes statisk i
  // navigatoren — den må følge hendelsen.
  //
  // Én ærlig begrensning: er detaljen ikke i cachen ved åpning, vet vi ikke at
  // det er en kamp før dataene lander. Da viser skjermen uansett skjelettet
  // sitt på krem, så det er ingen ny feil — bare ikke en fullstendig fiks.
  useEffect(() => {
    navigation.setOptions({
      contentStyle: {
        backgroundColor: isUnderway ? matchColors.groundTop : colors.background,
      },
    });
  }, [navigation, isUnderway]);

  // Fokus-broen (B2): 60 s-regelen fra P6. (Skjermen refetchet før ved HVERT
  // fokus — dette er selve kallbesparelsen i skiven.) Live-kampens behov for
  // ferskvare løses IKKE med lavere staleMs her — en staleMs som flipper når
  // kampen blir live, re-fyrer fokus-effekten og ga dobbelhenting ved åpning
  // (adversariell review 2026-08-17, bevist med ekte timere). I stedet
  // markerer realtime-oppryddingen under cachen stale ved blur: broen ser
  // `isInvalidated` ved retur og resyncer straks, uansett 60 s-regelen.
  useScreenFocusRefetch(eventDetailKey(eventId));
  useScreenFocusRefetch(matchPhotosKey(eventId));

  // Dette er hele grunnen til at en forelder kan følge med: uten abonnementet
  // ville stillingen stått stille til hun selv dro for å oppdatere.
  //
  // Payload-først (B3, P6): ett mål hos tilskuerne er nå to cache-patcher
  // (match_events-append + stilling fra match_sessions-raden) og NULL
  // refetch — før kostet det én debounced get_event_with_rsvp per tilskuer.
  // Refetch-debouncen står igjen som P6s sikkerhetsnett (payload manglet
  // felter, eller detaljen er ikke i cachen ennå) og for resync etter
  // reconnect. Hygienen fra A består: FOKUS-bundet (skjermen står i tre
  // stacks) og SPLITTET (et mål re-laster aldri bildene).
  //
  // Varselet ligger IKKE her lenger: det er `NotificationBanner` over fanene,
  // matet av `notifications`-kanalen. Databasen bestemmer allerede hvem som
  // skal varsles (00023: alle aktive medlemmer unntatt forfatteren), og
  // banneret følger deg gjennom hele appen — med ett unntak: står du HER
  // på en pågående kamp, dempes match_live-banneret (se watchEvent under).
  useFocusEffect(
    useCallback(() => {
      if (!liveMatchSessionId) return;
      let eventTimer: ReturnType<typeof setTimeout> | null = null;
      let photoTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleEventRefetch = () => {
        if (eventTimer) clearTimeout(eventTimer);
        eventTimer = setTimeout(() => {
          eventTimer = null;
          invalidateEventDetail(eventId);
        }, 400);
      };
      const unsubscribe = subscribeToMatch(liveMatchSessionId, eventId, evt => {
        switch (evt.kind) {
          case 'matchEvent':
            if (!applyMatchEventInsert(eventId, evt.row)) {
              scheduleEventRefetch();
            }
            break;
          case 'session':
            if (!applyMatchSessionUpdate(eventId, evt.row)) {
              scheduleEventRefetch();
            }
            break;
          case 'fallback':
            scheduleEventRefetch();
            break;
          case 'photo':
            if (photoTimer) clearTimeout(photoTimer);
            photoTimer = setTimeout(() => {
              photoTimer = null;
              invalidateMatchPhotos(eventId);
            }, 400);
            break;
          case 'resync':
            // Kanalen har vært nede — hendelser kan være tapt. Hent begge
            // stiene straks (P6-reconnect-raden); dette er også broen som
            // lukker reconnect-hullet fokus-broen ikke ser (appen sto jo
            // i fokus hele tiden).
            invalidateEventDetail(eventId);
            invalidateMatchPhotos(eventId);
            break;
        }
      });
      return () => {
        // Live-abonnementet rives (blur/unmount/statusbytte): fra nå av er
        // appen DØV for kampen, så cachen markeres stale — UTEN å hente
        // (F19: observeren står montert bak neste skjerm; markFeedStale-
        // broen). Fokus-broen ser `isInvalidated` ved retur og resyncer
        // straks — det som skjedde i mellomtiden kan aldri bli stående.
        if (eventTimer) clearTimeout(eventTimer);
        if (photoTimer) clearTimeout(photoTimer);
        markEventDetailStale(eventId);
        markMatchPhotosStale(eventId);
        unsubscribe();
      };
    }, [liveMatchSessionId, eventId]),
  );

  // Kampminuttet regnes ut fra started_at, men ingenting re-rendrer skjermen
  // mellom hendelsene — uten denne ville minuttet frosset til neste mål.
  useEffect(() => {
    if (!liveMatchSessionId) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [liveMatchSessionId]);

  // Mens en pågående kamp er I FOKUS her, dempes match_live-banneret for den
  // (NotificationsContext): scoren spretter jo rett foran deg (P2), og
  // banneret ville lagt seg oppå øyeblikket. Fokus, ikke mount — går du
  // videre til kommentarene skal banneret nå deg igjen.
  const {watchEvent} = useNotifications();
  const watchedEventId = isUnderway ? eventId : null;
  useFocusEffect(
    useCallback(() => {
      if (!watchedEventId) return;
      return watchEvent(watchedEventId);
    }, [watchedEventId, watchEvent]),
  );

  if (eventQuery.isLoading) {
    return (
      <View style={styles.screen}>
        <BackBar title="Hendelse" />
        {/* Speiler info-kortet: pill + tittel + metarader. */}
        <View style={styles.section}>
          <SkeletonCard>
            <Skeleton width={72} height={24} style={skeletonStyles.pill} />
            <Skeleton width="70%" height={20} />
            <View style={skeletonStyles.metaLines}>
              <Skeleton width="55%" height={12} />
              <Skeleton width="45%" height={12} />
              <Skeleton width="50%" height={12} />
            </View>
          </SkeletonCard>
        </View>
        <View style={styles.section}>
          <SkeletonCard>
            <Skeleton width="40%" height={14} />
            <Skeleton height={12} />
          </SkeletonCard>
        </View>
      </View>
    );
  }

  // Behold-ved-feil (samme regel som kalenderbolken): en feilet REFETCH river
  // ikke ned en side som alt viser data — feilflaten er kun for tomt utfall.
  if (!event) {
    return (
      <View style={styles.screen}>
        <BackBar title="Hendelse" />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {eventQuery.isError
              ? 'Kunne ikke laste hendelsen.'
              : 'Fant ikke hendelsen.'}
          </Text>
        </View>
      </View>
    );
  }

  const isLiveMatch =
    event.type === 'kamp' &&
    (event.matchStatus === 'live' || event.matchStatus === 'halfTime');
  const isUpcomingMatch =
    event.type === 'kamp' && event.matchStatus === 'upcoming';
  // Kampen er spilt: rapporten skal bli stående. Før dette falt skjermen ned i
  // vanlig event-modus i det «Slutt» ble trykket, og både stillingen og hele
  // kampforløpet forsvant i samme øyeblikk som de var ferdige.
  const isFinishedMatch =
    event.type === 'kamp' && event.matchStatus === 'finished';
  // Avlyst er en egen tilstand, ikke «ferdig»: kampen kan settes opp igjen.
  const isCancelledMatch =
    event.type === 'kamp' && event.matchStatus === 'cancelled';
  // Optimistiske reporterbytter er alt patchet inn i cachen
  // (handleSelectReporter) — event.reporterId ER visningsverdien.
  const reporterId = event.reporterId;
  const isCurrentUserReporter = reporterId === currentUser?.id;
  // Samme rolleregel som is_team_admin() i RLS — en lagleder skal se det
  // samme som en trener.
  const isCurrentUserAdmin = isTeamAdmin(activeRole);
  // Rollen er tildelt så snart `reporterId` finnes. Er medlemslisten ikke lastet
  // ennå (eller feilet), viser vi et navnløst medlem — `undefined` ville tegnet
  // tom-tilstanden «Ingen kampreporter» med «Velg»-knapp, som er direkte feil.
  const reporter = reporterId
    ? (teamMembers.find(u => u.id === reporterId) ?? {
        id: reporterId,
        name: 'Medlem',
      })
    : undefined;

  // Speiler start_match: admin, eller en reporter som alt er utpekt.
  const canStartMatch = isCurrentUserAdmin || isCurrentUserReporter;

  const matchMinute = event.startedAt
    ? Math.max(0, Math.floor((nowMs - event.startedAt.getTime()) / 60_000))
    : undefined;

  // Rapporten leses som en historie: avspark først, slutt sist. Motsatt av
  // live-modus, der det ferskeste skal ligge øverst.
  const finishedMatchEvents = event.matchEvents ?? NO_MATCH_EVENTS;

  const attendees = event.attendees;

  // Optimistiske RSVP-valg er alt patchet inn i cachen (handleRsvp), så
  // event.rsvp ER visningstallene — ingen speil-state å regne sammen.
  const rsvp = event.rsvp;
  const myStatus = rsvp.myStatus;

  // Nøyaktig én knapp er fremhevet av gangen, og den valgte skal skifte flate —
  // ikke bare ramme. `secondary` og `ghost` er begge gjennomsiktige, så et
  // «kan ikke»-valg tegnet som `secondary` ser ut som et uregistrert trykk.
  // «Kommer» er `secondary` (ikke `ghost`) i ubesvart tilstand fordi den er
  // det forventede svaret, og skal invitere til trykk.
  const comingVariant =
    myStatus === 'kommer'
      ? 'primary'
      : myStatus === 'kan_ikke'
        ? 'ghost'
        : 'secondary';
  const notComingVariant = myStatus === 'kan_ikke' ? 'selected' : 'ghost';

  // Svaret vises med én gang (optimistisk patch — applyMyStatus flytter
  // telleren i cachen) og lagres i bakgrunnen. setRsvp invaliderer
  // ['event', id] i api-laget, og refetchen derfra er det som får deg inn i
  // oppmøtelisten — den kan vi ikke gjette oss til lokalt.
  const handleRsvp = async (status: RSVPStatus) => {
    if (savingRsvp || status === myStatus) return;

    const previous = myStatus;
    patchEventDetail(eventId, d => ({
      ...d,
      rsvp: applyMyStatus(d.rsvp, status),
    }));
    setSavingRsvp(true);
    try {
      await setRsvp(eventId, status);
    } catch {
      // applyMyStatus tilbake til forrige svar er eksakt revers av patchen —
      // og en no-op hvis en mellomlandet refetch alt viser serverens fasit.
      patchEventDetail(eventId, d => ({
        ...d,
        rsvp: applyMyStatus(d.rsvp, previous),
      }));
      Alert.alert(
        'Kunne ikke lagre svaret',
        'Sjekk nettforbindelsen og prøv igjen.',
      );
    } finally {
      setSavingRsvp(false);
    }
  };

  /**
   * «Avlys kamp» er en STATUSENDRING, ikke en sletting (00057). Kampen blir
   * stående i kalenderen med «Avlyst»-pill — en forelder som husker at det
   * skulle være kamp skal FINNE svaret. En slettet kamp ser ut som en kamp
   * man har husket feil.
   *
   * Bekreftelsen sier hva som skjer med laget, og den sier sant begge veier:
   * en fremtidig avlysning gir ett tydelig varsel, en avlysning av noe som
   * har vært gir ingenting (samme vakt som resten av endringsvarslene).
   */
  const handleSetCancelled = (next: boolean) => {
    const perform = async () => {
      if (savingCancelled) return;
      setSavingCancelled(true);
      try {
        // setMatchCancelled invaliderer ['event', id] selv — refetchen som
        // flipper statusen er alt i gang når kallet returnerer.
        await setMatchCancelled(eventId, next);
      } catch (e) {
        Alert.alert(
          next ? 'Kunne ikke avlyse kampen' : 'Kunne ikke sette den opp igjen',
          matchErrorText(e, 'Sjekk nettforbindelsen og prøv igjen.'),
        );
      } finally {
        setSavingCancelled(false);
      }
    };

    // Å sette en kamp opp igjen er å angre — det trenger ingen bekreftelse.
    if (!next) {
      perform();
      return;
    }

    const notifies = eventIsUpcoming(event.startTime);
    Alert.alert(
      'Avlyse kampen?',
      `${formatDateLong(event.startTime)} kl. ${formatTime(event.startTime)}. ` +
        (notifies
          ? 'Kampen blir stående i kalenderen som avlyst, og hele laget får beskjed.'
          : 'Kampen blir stående i kalenderen som avlyst. Laget får ingen beskjed — kampen har vært.'),
      [
        {text: 'Avbryt', style: 'cancel'},
        {text: 'Avlys kampen', style: 'destructive', onPress: perform},
      ],
    );
  };

  const handleStartMatch = async () => {
    if (startingMatch) return;
    setStartingMatch(true);
    try {
      await startMatch(eventId);
      // start_match har ingen invalidering i api-laget — hent selv (refetch
      // hopper over staleTime), så skjermen flipper til live-modus nå.
      await refetchEvent();
    } catch (e) {
      Alert.alert(
        'Kunne ikke starte kampen',
        matchErrorText(e, 'Sjekk nettforbindelsen og prøv igjen.'),
      );
    } finally {
      setStartingMatch(false);
    }
  };

  /**
   * Skriver hendelsen, og lar refetchen hente den ferske stillingen — den
   * regnes ut server-side, så vi kan ikke gjette den lokalt. Realtime fyrer
   * også en refetch; den ekstra runden er billig og gjør at reporteren ser
   * hendelsen selv om kanalen skulle svikte.
   */
  const submitAction = async (
    type: ReporterActionType,
    description?: string,
  ) => {
    const sessionId = event.matchSessionId;
    if (savingAction || !sessionId) return;

    setSavingAction(true);
    try {
      await reportMatchEvent(sessionId, {
        ...ACTION_TO_EVENT[type],
        description,
      });
      // Ingen banner til reporteren: hun trykket nettopp knappen, og ser
      // stillingen og kampforløpet oppdatere seg. Varselet går til de andre,
      // via realtime-abonnementet lenger oppe.
      await refetchEvent();
    } catch (e) {
      Alert.alert(
        'Kunne ikke rapportere',
        matchErrorText(e, 'Sjekk nettforbindelsen og prøv igjen.'),
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleReporterAction = (type: ReporterActionType) => {
    // «Slutt» avslutter kampen for hele laget og kan ikke angres i appen.
    if (type === 'slutt') {
      Alert.alert('Avslutte kampen?', 'Kampen settes til ferdig for alle.', [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Avslutt',
          style: 'destructive',
          onPress: () => submitAction('slutt'),
        },
      ]);
      return;
    }

    // Pause og «fortsett» er rene av/på-trykk — ingen tekst å skrive.
    if (type === 'pause' || type === 'andre_omgang') {
      submitAction(type);
      return;
    }

    // Mål og meldinger får si noe mer — hvem scoret, hva skjedde.
    setSelectedActionType(type);
    setReporterModalVisible(true);
  };

  const handleReportSubmit = (description: string) => {
    setReporterModalVisible(false);
    submitAction(selectedActionType, description);
  };

  // Kamera først: reporteren står på sidelinja, og bildet er som regel tatt
  // for to sekunder siden — eller så finnes det ikke.
  const handlePickPhoto = async () => {
    const picked = await pickTeamImage({preferCamera: true});
    if (picked) setPendingPhoto(picked);
  };

  /**
   * Bildet er en vanlig bildepost som bærer `event_id` — derfor havner det
   * både i lagets feed og i kampens egen bildestripe. `matchEventId` er det
   * eneste valgfrie: uten den er det et generelt kampbilde.
   */
  const handlePublishPhoto = async (
    caption: string,
    matchEventId?: string,
  ) => {
    if (!activeTeamSpaceId || !pendingPhoto || publishingPhoto) return;

    setPublishingPhoto(true);
    try {
      await createImagePost({
        teamSpaceId: activeTeamSpaceId,
        content: caption,
        image: pendingPhoto,
        eventId,
        matchEventId,
      });
      setPendingPhoto(null);
      await refetchPhotos();
    } catch {
      Alert.alert(
        'Kunne ikke legge ut bildet',
        'Sjekk nettforbindelsen og prøv igjen.',
      );
    } finally {
      setPublishingPhoto(false);
    }
  };

  // Samme mønster som handleRsvp: vis valget med én gang (optimistisk patch),
  // lagre, refetch. `refetch` svelger sine egne feil, så catch-en fyrer kun
  // når selve skrivingen feiler — rollbacken kan ikke bli falsk-positiv.
  const handleSelectReporter = async (userId: string) => {
    setReporterSheetVisible(false);
    if (savingReporter || userId === reporterId || !event.matchSessionId) {
      return;
    }

    const previous = reporterId;
    patchEventDetail(eventId, d => ({...d, reporterId: userId}));
    setSavingReporter(true);
    try {
      await setMatchReporter(event.matchSessionId, userId);
      // Ingen banner: patchen over har allerede oppdatert ReporterBar med
      // det nye navnet. Banneret er for nyheter fra andre, ikke et ekko av
      // det du selv nettopp gjorde. setMatchReporter invaliderer ikke selv
      // — refetch her, så neste åpning ikke leser et utdatert navn.
      await refetchEvent();
    } catch {
      patchEventDetail(eventId, d => ({...d, reporterId: previous}));
      Alert.alert(
        'Kunne ikke bytte kampreporter',
        'Sjekk nettforbindelsen og prøv igjen.',
      );
    } finally {
      setSavingReporter(false);
    }
  };

  // -----------------------------------------------------------------------
  // LIVE KAMP-MODUS
  // -----------------------------------------------------------------------
  if (isLiveMatch && event.score && event.opponent) {
    const matchEvents = event.matchEvents ?? NO_MATCH_EVENTS;

    return (
      // Kampen er sin egen verden og eier hele skjermen (skive 2). Det som ble
      // igjen her er state, handlere, realtime og modalene — de hører til
      // skjermens livssyklus, ikke til flaten.
      <>
        <LiveMatch
          event={event}
          matchEvents={matchEvents}
          teamName={teamName}
          teamColor={activeTeamSpace?.color || colors.heiaInk}
          minute={matchMinute}
          reporter={reporter}
          isAdmin={isCurrentUserAdmin}
          isReporter={isCurrentUserReporter}
          photos={matchPhotos}
          authorFor={authorFor}
          onChangeReporter={() => setReporterSheetVisible(true)}
          onReporterAction={handleReporterAction}
          onPickPhoto={handlePickPhoto}
          onPressPhoto={photo => setGalleryPhotoId(photo.id)}
        />

        {/* Reporter-modal */}
        <ReporterModal
          visible={reporterModalVisible}
          actionType={selectedActionType}
          onSubmit={handleReportSubmit}
          onCancel={() => setReporterModalVisible(false)}
        />

        {/* Reporter-velger */}
        <ReporterSheet
          visible={reporterSheetVisible}
          members={teamMembers}
          currentReporterId={reporterId}
          onSelect={handleSelectReporter}
          onClose={() => setReporterSheetVisible(false)}
        />

        {/* Kampbilde: tekst + hvilket øyeblikk */}
        <MatchPhotoSheet
          visible={pendingPhoto !== null}
          imageUri={pendingPhoto?.uri ?? null}
          matchEvents={matchEvents}
          publishing={publishingPhoto}
          onPublish={handlePublishPhoto}
          onCancel={() => setPendingPhoto(null)}
        />

        <MatchPhotoGallery
          photos={matchPhotos}
          initialPhotoId={galleryPhotoId}
          onClose={() => setGalleryPhotoId(null)}
        />
      </>
    );
  }

  // -----------------------------------------------------------------------
  // KAMPRAPPORT-MODUS (skive 3)
  // -----------------------------------------------------------------------
  // Den spilte kampen bor i den SAMME verdenen som den live — samme grunn,
  // samme arena, samme forløp, bare roligere. Egen komponent av samme grunn
  // som `LiveMatch`: grenen under deles med trening, sosialt, kommende kamp,
  // turnering og avlyst kamp, og de skal ikke bli grønne av at rapporten ble
  // det.
  if (isFinishedMatch && event.score && event.opponent) {
    return (
      <>
        <FinishedMatch
          event={event}
          matchEvents={finishedMatchEvents}
          teamName={teamName}
          teamColor={activeTeamSpace?.color || colors.heiaInk}
          photos={matchPhotos}
          reporter={reporter}
          isAdmin={isCurrentUserAdmin}
          authorFor={authorFor}
          onPressPhoto={photo => setGalleryPhotoId(photo.id)}
          onEdit={() => navigation.navigate('NewEvent', {eventId})}
        />

        <MatchPhotoGallery
          photos={matchPhotos}
          initialPhotoId={galleryPhotoId}
          onClose={() => setGalleryPhotoId(null)}
        />
      </>
    );
  }

  // -----------------------------------------------------------------------
  // VANLIG EVENT-MODUS (trening, sosialt, kommende kamp)
  // -----------------------------------------------------------------------
  // ⚠️ En FERDIG kamp UTEN stilling eller motstander faller hit. Den er ingen
  // rapport — det finnes ikke noe resultat å vise — men bildene og forløpet
  // skal fortsatt være der, på den lyse flaten som før.

  // En avlyst kamp er ingen kampdag — nøytral «Avlyst»-pill (som kalenderen).
  const infoPill =
    event.type === 'kamp' && event.matchStatus === 'cancelled'
      ? {kind: 'neutral' as PillKind, label: 'Avlyst'}
      : (typePill[event.type] ?? typePill.annet);

  return (
    <View style={styles.screen}>
      <BackBar title="Hendelse" />
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}>
      {isUpcomingMatch && event.opponent ? (
        /* Kampdag (P5B): motstander + avspark fortjener mer enn sort på
           hvitt — en liten stadion-smak, IKKE full ScoreBoard (det er
           live-kampens språk). RSVP og «Start kamp»-flyten består under. */
        <View style={styles.kampdagSection}>
          <StadiumSurface style={styles.kampdag}>
            <View style={styles.kampdagTop}>
              <Text style={styles.kampdagLabel}>Kampdag</Text>
              <Text style={styles.kampdagDay}>
                {formatDateLong(event.startTime)}
              </Text>
            </View>
            {/* Standardtittelen («Kamp mot Lyn») sier ikke mer enn platta
                selv — kun en egen tittel fortjener plassen. */}
            {event.title !== `Kamp mot ${event.opponent}` && (
              <Text style={styles.kampdagTitle}>{event.title}</Text>
            )}
            <View style={styles.kampdagTeams}>
              <View style={styles.kampdagTeamCol}>
                <TeamBadge
                  size={44}
                  cornerRadius={radius.lg}
                  fontSize={13}
                  logoPlate
                  name={teamName}
                  style={styles.kampdagUsRing}
                />
                <Text style={styles.kampdagTeamName} numberOfLines={2}>
                  {teamName}
                </Text>
              </View>
              <View style={styles.kampdagKickoff}>
                <Text style={styles.kampdagTime}>
                  {formatTime(event.startTime)}
                </Text>
                <Text style={styles.kampdagKickoffLabel}>Avspark</Text>
              </View>
              <View style={styles.kampdagTeamCol}>
                <View style={styles.kampdagThemBadge}>
                  <Text style={styles.kampdagThemText}>
                    {initials(event.opponent)}
                  </Text>
                </View>
                <Text style={styles.kampdagTeamName} numberOfLines={2}>
                  {event.opponent}
                </Text>
              </View>
            </View>
            {event.location && (
              <Text style={styles.kampdagMeta}>{event.location}</Text>
            )}
          </StadiumSurface>
          {event.description && (
            <Text style={styles.description}>{event.description}</Text>
          )}
        </View>
      ) : (
        /* Event-info: samme hero-flate som kortene på Hjem og i kalenderen
           (Brages retning 2026-07-31) — mint→krem-gradient med banedekor,
           type-pill og stor tid i displayfonten. Ingen hvite adminflater. */
        <HeroSurface style={styles.infoHero}>
          <View style={styles.infoHeroTop}>
            <StatusPill kind={infoPill.kind} label={infoPill.label} withDot />
            <Text style={styles.infoTime}>
              {/* En turnerings `end_time` bærer SLUTTDATOEN (siste dag
                  23:59), ikke et klokkeslett — «09:00–23:59» ville vært
                  meningsløst. Perioden står i datolinja under i stedet. */}
              {event.type !== 'turnering' && event.endTime
                ? `${formatTime(event.startTime)}–${formatTime(event.endTime)}`
                : formatTime(event.startTime)}
            </Text>
          </View>
          <Text style={styles.infoDate}>
            {event.type === 'turnering'
              ? dayRangeLabel(event.startTime, event.endTime ?? event.startTime)
              : formatDateLong(event.startTime)}
          </Text>
          <Text style={styles.infoTitle}>{event.title}</Text>
          {event.location && (
            <View style={styles.locationRow}>
              <MapPin size={14} color="#41604F" />
              <Text style={styles.locationText}>{event.location}</Text>
            </View>
          )}
          {event.description && (
            <Text style={styles.description}>{event.description}</Text>
          )}
        </HeroSurface>
      )}

      {/* Trenerens to rettelser, rett under det som skal rettes. Kun for
          trener/lagleder/admin — samme regel som RPC-ene vakter med.
          «Avlys» er `ghost`: den er tilgjengelig, men den er ikke det man
          kom hit for. */}
      {isCurrentUserAdmin && (
        <View style={styles.adminActions}>
          <Button
            title="Rediger"
            variant="secondary"
            onPress={() => navigation.navigate('NewEvent', {eventId})}
            style={styles.adminAction}
          />
          {isUpcomingMatch && (
            <Button
              title="Avlys kamp"
              variant="ghost"
              onPress={() => handleSetCancelled(true)}
              disabled={savingCancelled}
              style={styles.adminAction}
            />
          )}
          {isCancelledMatch && (
            <Button
              title="Sett opp igjen"
              variant="secondary"
              onPress={() => handleSetCancelled(false)}
              disabled={savingCancelled}
              style={styles.adminAction}
            />
          )}
        </View>
      )}

      {/* Turnering: dagens kjøreplan. Kampene bor HER — kalenderen viser
          turneringen som ett kort. Hver kamp er en helt vanlig kampside
          (live-rapportering, kamprapport, bilder). */}
      {isTournament && (
        <>
          <SectionHeader
            title={
              tournamentMatches.length > 0
                ? `Kamper (${tournamentMatches.length})`
                : 'Kamper'
            }
          />
          <View style={styles.tournamentList}>
            {tournamentMatches.length === 0 && (
              <Card style={styles.tournamentEmpty}>
                <Text style={styles.tournamentEmptyText}>
                  {isCurrentUserAdmin
                    ? 'Ingen kamper ennå — legg dem inn når kampoppsettet er klart.'
                    : 'Kampene dukker opp her når treneren legger dem inn.'}
                </Text>
              </Card>
            )}
            {tournamentMatches.map(match => (
              <EventCard
                key={match.id}
                event={match}
                featured={match.matchStatus === 'live'}
                onPress={() =>
                  navigation.push('EventDetail', {eventId: match.id})
                }
              />
            ))}
            {isCurrentUserAdmin && (
              <Button
                title="Ny kamp i turneringen"
                variant="secondary"
                onPress={() =>
                  // Turneringens navn OG periode arves ned: kampen åpner på
                  // første cupdag, og sier fra hvis den havner utenfor.
                  navigation.navigate('NewEvent', {
                    parentEventId: eventId,
                    parentTitle: event.title,
                    parentFrom: event.startTime.toISOString(),
                    parentTo: (event.endTime ?? event.startTime).toISOString(),
                  })
                }
              />
            )}
          </View>
        </>
      )}

      {/* Kommende kamp: her utnevnes reporteren, og herfra startes kampen.
          Uten dette kunne ingen bli reporter (ReporterBar fantes kun i
          live-modus), og ingen kamp kunne bli live. */}
      {isUpcomingMatch && (
        <View style={styles.matchSection}>
          <ReporterBar
            reporter={reporter}
            isAdmin={isCurrentUserAdmin}
            isMe={isCurrentUserReporter}
            onChangeReporter={() => setReporterSheetVisible(true)}
          />
          {canStartMatch && (
            <Button
              title={startingMatch ? 'Starter…' : 'Start kamp'}
              variant="primary"
              size="lg"
              onPress={handleStartMatch}
              disabled={startingMatch}
            />
          )}
        </View>
      )}

      {/* Etter kampslutt er bildene det man kommer tilbake for — derfor en
          kompakt inngang øverst. De blir uansett stående i forløpet under. */}
      {isFinishedMatch && (
        <MatchPhotoRail
          photos={matchPhotos}
          onPressPhoto={photo => setGalleryPhotoId(photo.id)}
        />
      )}

      {isFinishedMatch &&
        (finishedMatchEvents.length > 0 || matchPhotos.length > 0) && (
          <View style={styles.timeline}>
            <MatchTimeline
              matchEvents={finishedMatchEvents}
              photos={matchPhotos}
              startedAt={event.startedAt}
              authorFor={authorFor}
              onPressPhoto={photo => setGalleryPhotoId(photo.id)}
            />
          </View>
        )}

      {/* RSVP — meningsløst på en ferdigspilt kamp. */}
      {!isFinishedMatch && (
        <View style={styles.rsvpSection}>
          <RSVPBar rsvp={rsvp} />
          <View style={styles.rsvpButtons}>
            <Button
              title={myStatus === 'kommer' ? 'Du kommer!' : 'Kommer'}
              variant={comingVariant}
              onPress={() => handleRsvp('kommer')}
              disabled={savingRsvp}
              size="lg"
              style={styles.rsvpBtn}
            />
            <Button
              title={myStatus === 'kan_ikke' ? 'Du kan ikke' : 'Kan ikke'}
              variant={notComingVariant}
              onPress={() => handleRsvp('kan_ikke')}
              disabled={savingRsvp}
              size="lg"
              style={styles.rsvpBtn}
            />
          </View>
        </View>
      )}

      {/* Oppmøteliste. På en spilt kamp er «Kommer» fortid, og «Ikke svart»
          er ren støy — påmeldingen blir en enkel deltakerliste i stedet. */}
      <AttendanceSection
        title={`Kommer (${attendees.coming.length})`}
        users={attendees.coming}
        emptyText="Ingen har svart ennå"
      />
      {attendees.notComing.length > 0 && (
        <AttendanceSection
          title={`Kan ikke (${attendees.notComing.length})`}
          users={attendees.notComing}
        />
      )}
      {attendees.pending.length > 0 && (
        <AttendanceSection
          title={`Ikke svart (${attendees.pending.length})`}
          users={attendees.pending}
        />
      )}
      </ScrollView>

      {/* Reporter-velger — treneren utnevner i forkant av kampen. */}
      {isUpcomingMatch && (
        <ReporterSheet
          visible={reporterSheetVisible}
          members={teamMembers}
          currentReporterId={reporterId}
          onSelect={handleSelectReporter}
          onClose={() => setReporterSheetVisible(false)}
        />
      )}

      <MatchPhotoGallery
        photos={matchPhotos}
        initialPhotoId={galleryPhotoId}
        onClose={() => setGalleryPhotoId(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hjelpkomponenter
// ---------------------------------------------------------------------------
function AttendanceSection({
  title,
  users: attendeeList,
  emptyText,
}: {
  title: string;
  users: EventAttendee[];
  emptyText?: string;
}) {
  return (
    <>
      <SectionHeader title={title} />
      {attendeeList.length === 0 && emptyText ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        attendeeList.map((attendee, index) => (
          // En forelder kan svare for flere barn — id alene er ikke unik.
          <ListRow
            key={`${attendee.id}-${attendee.childName ?? 'selv'}`}
            icon={<Avatar name={attendee.childName ?? attendee.name} size="sm" />}
            title={attendee.childName ?? attendee.name}
            subtitle={attendee.childName ? `Meldt av ${attendee.name}` : undefined}
            showBorder={index < attendeeList.length - 1}
          />
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stiler
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  // Kampforløpet er kant-til-kant: hver rad setter sin EGEN venstremarg fra
  // matchGrid, og krittlinja + nodene lever i den margen. En
  // paddingHorizontal her ville forskjøvet hele skinna.
  //
  // ⚠️ KUN KAMPRAPPORTEN IGJEN. Live-kampen ligger nå rett på grunnen
  // (`MatchTimeline ground`), der det fjerde rommet tegnes som et scrim i
  // stedet for en egen flate. Denne bakgrunnen forsvinner når rapporten
  // flytter ned på samme grunn (skive 3).
  timeline: {
    backgroundColor: matchColors.timeline,
    paddingBottom: spacing.lg,
  },
  // Info-kortet (P5B): aksentbåndet ligger kant-i-kant med kortets topp, så
  // paddingen bor i båndet og kroppen — ikke på kortet selv.
  infoHero: {
    margin: spacing.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.cardResting,
  },
  infoHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Klokkeslettet er kortets store tall — displayfonten, aldri fontWeight.
  infoTime: {
    fontSize: 24,
    letterSpacing: -0.3,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  infoDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoTitle: {
    ...typography.heading2,
    marginTop: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    ...typography.body,
    color: '#41604F',
    flex: 1,
  },
  // Kampdag (P5B): mini-stadion før avspark — samme språk som ScoreBoard,
  // men roligere (ingen glød, ingen score).
  kampdagSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  kampdag: {
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.cardResting,
  },
  kampdagTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kampdagLabel: {
    ...typography.label,
    color: colors.stadiumDim,
  },
  kampdagDay: {
    ...typography.caption,
    color: colors.stadiumDim,
  },
  kampdagTitle: {
    ...typography.heading3,
    color: colors.stadiumText,
  },
  kampdagTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kampdagTeamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  kampdagTeamName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stadiumText,
    textAlign: 'center',
    lineHeight: 17,
  },
  kampdagKickoff: {
    alignItems: 'center',
  },
  // Mint på stadionmørk er lov (låst regel gjelder LYSE flater) — men uten
  // glød: gløden er live-scorens signatur, dette er før avspark.
  kampdagTime: {
    fontSize: 32,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.heia,
  },
  kampdagKickoffLabel: {
    ...typography.caption,
    color: colors.stadiumDim,
  },
  kampdagUsRing: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  kampdagThemBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: '#3A4750',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kampdagThemText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  kampdagMeta: {
    ...typography.caption,
    color: colors.stadiumDim,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  matchSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  // Rettelsene ligger på rad under kortet. To knapper deler bredden når
  // kampen kan avlyses; alene fyller «Rediger» raden.
  adminActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  adminAction: {
    flex: 1,
  },
  tournamentList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  tournamentEmpty: {
    padding: spacing.xl,
  },
  tournamentEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rsvpSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rsvpBtn: {
    flex: 1,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});

const skeletonStyles = StyleSheet.create({
  pill: {
    borderRadius: 12,
  },
  metaLines: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
