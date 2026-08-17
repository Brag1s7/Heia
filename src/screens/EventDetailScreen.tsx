import React, {useCallback, useEffect, useState} from 'react';
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
import {colors, typography, spacing, radius, fonts, shadows} from '../theme';
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
  ScoreBoard,
  StadiumSurface,
  StatusPill,
  TeamBadge,
  ReporterActions,
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
import {MapPin} from '../components/icons';
import type {PillKind} from '../components/StatusPill';
import type {ReporterActionType} from '../components/ReporterActions';
import {useAuth, useActiveTeam, useNotifications} from '../context';
import {getTeamMembers, type TeamMember} from '../lib/api/members';
import {
  getEventDetail,
  getTournamentMatches,
  setRsvp,
  setMatchCancelled,
  setMatchReporter,
  startMatch,
  reportMatchEvent,
  subscribeToMatch,
  type ReportMatchEventInput,
} from '../lib/api/events';
import {createImagePost, getMatchPhotos, type MatchPhoto} from '../lib/api/feed';
import {pickTeamImage, type PickedImage} from '../lib/media';
import {isTeamAdmin} from '../shared/roles';
import {dayRangeLabel} from '../shared/calendar';
import {eventIsUpcoming} from '../shared/eventForm';
import type {
  EventAttendee,
  EventType,
  HeiaEvent,
  HeiaEventDetail,
  HomeStackParamList,
  RSVPStatus,
  RSVPSummary,
} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

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

  const [event, setEvent] = useState<HeiaEventDetail | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myStatus, setMyStatus] = useState<RSVPStatus>('venter');
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
  const [reporterId, setReporterId] = useState<string | undefined>(undefined);
  const [pendingPhoto, setPendingPhoto] = useState<PickedImage | null>(null);
  const [publishingPhoto, setPublishingPhoto] = useState(false);
  const [matchPhotos, setMatchPhotos] = useState<MatchPhoto[]>([]);
  const [galleryPhotoId, setGalleryPhotoId] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!activeTeamSpaceId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const detail = await getEventDetail(eventId, activeTeamSpaceId);
      setEvent(detail);
      setMyStatus(detail.rsvp.myStatus);
      setReporterId(detail.reporterId);
    } catch {
      setError('Kunne ikke laste hendelsen.');
    } finally {
      setLoading(false);
    }
  }, [eventId, activeTeamSpaceId]);

  // ⚠️ Ved FOKUS, ikke ved mount. Redigeringsmodalen lukker seg tilbake hit
  // (2026-08-07), og med en ren mount-effekt ville siden stått igjen med den
  // gamle datoen etter at man nettopp hadde flyttet den. Første fokus skjer
  // sammen med monteringen, så åpningen er uendret.
  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

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

  // Medlemslisten brukes kun av kampreporter-UI-et, så vi henter den først når
  // vi vet at hendelsen er en kamp — en trening skal ikke koste et RPC-kall.
  // Feiler den, lever resten av skjermen videre: `reporter` faller tilbake på
  // et navnløst medlem i stedet for å påstå at rollen er ledig.
  const isMatchEvent = event?.matchSessionId != null;
  useEffect(() => {
    if (!activeTeamSpaceId || !isMatchEvent) return;

    let cancelled = false;
    getTeamMembers(activeTeamSpaceId)
      .then(members => {
        if (!cancelled) setTeamMembers(members);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeTeamSpaceId, isMatchEvent]);

  // Kampbilder. Feiler kallet lever resten av kampsiden videre — et manglende
  // bilde skal aldri stå i veien for stillingen.
  const loadPhotos = useCallback(async () => {
    if (!isMatchEvent) return;
    try {
      setMatchPhotos(await getMatchPhotos(eventId));
    } catch {
      // Stille: stripa vises bare når det finnes bilder.
    }
  }, [eventId, isMatchEvent]);

  // Fokus, ikke mount: skjermen kan stå montert i en bakgrunnsstack
  // (EventDetail finnes i tre stacks) — den skal ikke hente bilder derfra.
  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  // Kampen er i gang (også i pause — da telles minuttene fortsatt).
  const isUnderway =
    event?.matchStatus === 'live' || event?.matchStatus === 'halfTime';
  const liveMatchSessionId = isUnderway ? event?.matchSessionId : undefined;

  // Dette er hele grunnen til at en forelder kan følge med: uten abonnementet
  // ville stillingen stått stille til hun selv dro for å oppdatere.
  //
  // Realtime-hygienen (fase A): FOKUS-bundet (skjermen står i tre stacks —
  // en bakgrunnsinstans skal ikke arbeide), DEBOUNCED (ett mål = tre
  // meldinger i én transaksjon = ÉN refetch), og SPLITTET (stilling og
  // kampbilder har hver sin sti — et mål re-laster aldri bildene).
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
      const unsubscribe = subscribeToMatch(liveMatchSessionId, eventId, {
        onMatchChange: () => {
          if (eventTimer) clearTimeout(eventTimer);
          eventTimer = setTimeout(loadEvent, 400);
        },
        onPhotoPost: () => {
          if (photoTimer) clearTimeout(photoTimer);
          photoTimer = setTimeout(loadPhotos, 400);
        },
      });
      return () => {
        if (eventTimer) clearTimeout(eventTimer);
        if (photoTimer) clearTimeout(photoTimer);
        unsubscribe();
      };
    }, [liveMatchSessionId, eventId, loadEvent, loadPhotos]),
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

  if (loading) {
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

  if (error || !event) {
    return (
      <View style={styles.screen}>
        <BackBar title="Hendelse" />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {error ?? 'Fant ikke hendelsen.'}
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
  const finishedMatchEvents = event.matchEvents ?? [];

  const attendees = event.attendees;

  // Serveren teller allerede mitt svar. Vis derfor mitt valg som en endring
  // fra det lagrede svaret: trekk fra det gamle, legg til det nye.
  const rsvp = applyMyStatus(event.rsvp, myStatus);

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

  // Svaret vises med én gang og lagres i bakgrunnen. Refetchen etterpå er det
  // som får deg inn i oppmøtelisten — den kan vi ikke gjette oss til lokalt.
  const handleRsvp = async (status: RSVPStatus) => {
    if (savingRsvp || status === myStatus) return;

    const previous = myStatus;
    setMyStatus(status);
    setSavingRsvp(true);
    try {
      await setRsvp(eventId, status);
      await loadEvent();
    } catch {
      setMyStatus(previous);
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
        await setMatchCancelled(eventId, next);
        await loadEvent();
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
      await loadEvent();
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
      await loadEvent();
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
      await loadPhotos();
    } catch {
      Alert.alert(
        'Kunne ikke legge ut bildet',
        'Sjekk nettforbindelsen og prøv igjen.',
      );
    } finally {
      setPublishingPhoto(false);
    }
  };

  // Samme mønster som handleRsvp: vis valget med én gang, lagre, refetch.
  // `loadEvent` svelger sine egne feil, så catch-en fyrer kun når selve
  // skrivingen feiler — rollbacken kan ikke bli falsk-positiv.
  const handleSelectReporter = async (userId: string) => {
    setReporterSheetVisible(false);
    if (savingReporter || userId === reporterId || !event.matchSessionId) {
      return;
    }

    const previous = reporterId;
    setReporterId(userId);
    setSavingReporter(true);
    try {
      await setMatchReporter(event.matchSessionId, userId);
      // Ingen banner: `setReporterId` over har allerede oppdatert ReporterBar
      // med det nye navnet. Banneret er for nyheter fra andre, ikke et ekko
      // av det du selv nettopp gjorde.
      await loadEvent();
    } catch {
      setReporterId(previous);
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
    const matchEvents = event.matchEvents ?? [];

    return (
      <View style={styles.screen}>
        <BackBar title="Hendelse" />
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing['3xl'],
          }}>
          {/* Scoreboard */}
          <View style={styles.section}>
            <ScoreBoard
              homeTeam={teamName}
              awayTeam={event.opponent}
              homeScore={event.score.home}
              awayScore={event.score.away}
              matchStatus={event.matchStatus!}
              minute={matchMinute}
            />
          </View>

          {/* Reporter-bar */}
          <View style={styles.section}>
            <ReporterBar
              reporter={reporter}
              isAdmin={isCurrentUserAdmin}
              isMe={isCurrentUserReporter}
              onChangeReporter={() => setReporterSheetVisible(true)}
            />
          </View>

          {/* Kampvarsler for tilskuere (ikke reporter) */}
          {!isCurrentUserReporter && (
            <View style={styles.section}>
              <Card>
                <View style={styles.notificationRow}>
                  <View style={styles.notificationInfo}>
                    <Text style={styles.notificationTitle}>
                      Du følger kampen direkte
                    </Text>
                    <Text style={styles.notificationDesc}>
                      Stillingen og kampforløpet oppdaterer seg av seg selv.
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          )}

          {/* Reporter-verktøy — kun synlig for aktiv reporter */}
          {isCurrentUserReporter && (
            <View style={styles.section}>
              <ReporterActions
                onAction={handleReporterAction}
                isPaused={event.matchStatus === 'halfTime'}
                onPhoto={handlePickPhoto}
              />
            </View>
          )}

          {/* Kampforløp — bildene ligger i forløpet, ikke i en egen seksjon.
              Under kampen skal ingenting konkurrere med stillingen. */}
          <SectionHeader title="Kampforløp" />
          <View style={styles.timeline}>
            <MatchTimeline
              matchEvents={matchEvents}
              photos={matchPhotos}
              startedAt={event.startedAt}
              newestFirst
              onPressPhoto={photo => setGalleryPhotoId(photo.id)}
            />
          </View>
        </ScrollView>

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
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // VANLIG EVENT-MODUS (trening, sosialt, kommende kamp) + KAMPRAPPORT
  // -----------------------------------------------------------------------
  // Kamprapporten snur rekkefølgen: resultatet ER historien på en spilt kamp,
  // så scoreboardet møter deg først og «hvor og når» demoteres til én linje.
  // Før åpnet siden med et administrativt infokort, og selve kampen lå under.
  const showReport = isFinishedMatch && !!event.score && !!event.opponent;

  const whenWhere = [
    formatDateLong(event.startTime),
    formatTime(event.startTime),
    event.location,
  ]
    .filter(Boolean)
    .join(' · ');

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
      {showReport ? (
        <View style={styles.report}>
          <ScoreBoard
            homeTeam={teamName}
            awayTeam={event.opponent!}
            homeScore={event.score!.home}
            awayScore={event.score!.away}
            matchStatus={event.matchStatus!}
          />
          <Text style={styles.reportTitle}>{event.title}</Text>
          <Text style={styles.reportMeta}>{whenWhere}</Text>
          {event.description && (
            <Text style={styles.description}>{event.description}</Text>
          )}
        </View>
      ) : isUpcomingMatch && event.opponent ? (
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
          <>
            <SectionHeader title="Kampforløp" />
            <View style={styles.timeline}>
              <MatchTimeline
                matchEvents={finishedMatchEvents}
                photos={matchPhotos}
                startedAt={event.startedAt}
                onPressPhoto={photo => setGalleryPhotoId(photo.id)}
              />
            </View>
          </>
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
      {(!showReport || attendees.coming.length > 0) && (
        <AttendanceSection
          title={
            showReport
              ? `Påmeldt (${attendees.coming.length})`
              : `Kommer (${attendees.coming.length})`
          }
          users={attendees.coming}
          emptyText="Ingen har svart ennå"
        />
      )}
      {attendees.notComing.length > 0 && !showReport && (
        <AttendanceSection
          title={`Kan ikke (${attendees.notComing.length})`}
          users={attendees.notComing}
        />
      )}
      {attendees.pending.length > 0 && !showReport && (
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
  timeline: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notificationInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  notificationTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  notificationDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
  // Kamprapportens topp: resultatet først, «hvor og når» som undertekst.
  report: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  reportTitle: {
    ...typography.heading2,
    marginTop: spacing.lg,
  },
  reportMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
