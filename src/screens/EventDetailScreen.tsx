import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, ScrollView, StyleSheet, Alert} from 'react-native';
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
  Card,
  Button,
  RSVPBar,
  SectionHeader,
  Avatar,
  EventCard,
  HeroSurface,
  LiquidGlassSurface,
  ProfilPage,
  StadiumGlass,
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
  useBottomContentPadding,
} from '../components';
// ⚠️ DIREKTE, ikke fra barrelen: `OPAL` leses i `StyleSheet.create`, altså
// ved MODUL-LASTING. Tester som mocker hele `../components` (tabBar) ville
// da fått `undefined.inkSecondary`. Samme grep som `SectionHeader`.
import {OPAL} from '../components/OpalSurface';
import {FinishedMatch} from '../components/match/FinishedMatch';
import {LiveMatch} from '../components/match/LiveMatch';
import {MatchEngagementRow} from '../components/match/MatchEngagementRow';
import {CommentSheet} from '../components/match/CommentSheet';
import {GoalCorrectionSheet} from '../components/match/GoalCorrectionSheet';
import {MapPin} from '../components/icons';
import type {PillKind} from '../components/StatusPill';
import type {ReporterActionType} from '../components/ReporterActions';
import {
  useAuth,
  useActiveTeam,
  useMatchPresence,
  useNotifications,
} from '../context';
import {invalidateLiveMatch} from '../lib/queries/liveMatch';
import {cheerOnMoment} from '../lib/queries/matchHeia';
import type {TeamAuthor, TeamMember} from '../lib/api/members';
import {useTeamAuthors, useTeamMembers} from '../lib/queries/members';
import {
  adjustMatchEngagement,
  applyMatchEventInsert,
  applyMatchEventUpdate,
  applyMatchEventDelete,
  applyMatchSessionUpdate,
  eventDetailKey,
  invalidateEventDetail,
  invalidateMatchEngagement,
  invalidateMatchPhotos,
  markEventDetailStale,
  markMatchEngagementStale,
  markMatchPhotosStale,
  matchEngagementKey,
  matchPhotosKey,
  patchEventDetail,
  useEventDetail,
  useMatchEngagement,
  useMatchPhotos,
} from '../lib/queries/eventDetail';
import {patchFeedItem} from '../lib/queries/feed';
import {useScreenFocusRefetch} from '../lib/queries/useScreenFocusRefetch';
import {
  getTournamentMatches,
  setRsvp,
  setMatchCancelled,
  setMatchReporter,
  startMatch,
  reportMatchEvent,
  subscribeToMatch,
  correctMatchGoal,
  type ReportMatchEventInput,
} from '../lib/api/events';
import {
  createImagePost,
  toggleReaction,
  type MatchPhoto,
} from '../lib/api/feed';
import {pickTeamImage, type PickedImage} from '../lib/media';
import {isTeamAdmin} from '../shared/roles';
import {
  allowsHeia,
  buildMatchEngagement,
  canCorrectGoal,
  newestHeiableMoment,
  showsEngagement,
  type MatchFeedPost,
} from '../shared/matchEngagement';
import {
  matchCommentA11yLabel,
  matchCorrectA11yLabel,
  matchHeiaA11yLabel,
} from '../shared/matchCopy';
import {GRID_FONT_CAP} from '../shared/matchGridGeometry';
import {matchMinute as matchMinute_} from '../shared/matchClock';
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
const NO_MATCH_FEED: MatchFeedPost[] = [];

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
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
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
 * KVITTERINGEN PÅ EN FULLFØRT HANDLING (skive 10.1).
 *
 * ⚠️ FORTID, IKKE IMPERATIV. «Mål registrert», ikke «Registrer mål» — teksten
 * er et SVAR på noe som er gjort, og en imperativ ville lest som en ny knapp.
 * Samme skille som `ACTION_A11Y` i `ReporterActions` gjør motsatt vei: der
 * beskriver den hva knappen SKAL gjøre.
 */
const ACTION_DONE: Record<ReporterActionType, string> = {
  mål_oss: 'Mål registrert',
  mål_dem: 'Mål imot registrert',
  pause: 'Kampen er satt i pause',
  andre_omgang: 'Andre omgang i gang',
  slutt: 'Kampen er avsluttet',
  melding: 'Oppdateringen er delt',
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
  const bottomPad = useBottomContentPadding();
  const {profile: currentUser} = useAuth();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();
  const {eventId} = route.params;

  const teamName = activeTeamSpace?.displayName ?? '';
  // Brukes til å filtrere bort mitt eget realtime-ekko på HEIA (skive 4).
  const myId = currentUser?.id;

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
  // Samtalen om ett øyeblikk, som bunnark OVER kampen (skive 4.1) — ikke en
  // skjerm man sendes bort til. `null` = arket er lukket.
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  // «Korriger mål» (skive 8) — målet som rettes, eller null når arket er
  // lukket. Arket monteres med `key={id}`, så feltene alltid starter fra den
  // ferske raden og aldri fra forrige mål man åpnet.
  const [correctingGoalId, setCorrectingGoalId] = useState<string | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);

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

  // ---------------------------------------------------------------------
  // KAMPENS ENGASJEMENT (skive 4) — HEIA og kommentarer per øyeblikk.
  //
  // Den fjerde RPC-en på kampskjermen, og et bevisst valg: koblingen mellom
  // øyeblikket og den kanoniske feed-posten (00071) er hele skiva, og egen
  // sti betyr at et HEIA aldri koster en re-lasting av kampforløpet.
  // Feiler den, lever kampen videre — linja tegnes med nuller og disablede
  // knapper i stedet for å ta ned skjermen.
  // ---------------------------------------------------------------------
  const matchFeed =
    useMatchEngagement(eventId, isMatchEvent).data ?? NO_MATCH_FEED;
  const engagement = useMemo(
    () => buildMatchEngagement(matchFeed),
    [matchFeed],
  );

  const handleMatchHeia = useCallback(
    async (postId: string, currentlyReacted: boolean) => {
      const delta = currentlyReacted ? -1 : 1;
      // Optimistisk rett i cachen — et HEIA skal kjennes i samme sekund som
      // fingeren treffer, ikke etter en rundtur.
      adjustMatchEngagement(eventId, postId, {
        heia: delta,
        iReacted: !currentlyReacted,
      });
      // ⚠️ FEEDEN VISER DEN SAMME POSTEN. Uten denne patchen ville et HEIA
      // gitt i kampen stått ureagert i feeden til neste refetch — samme
      // post, to tall. En no-op når feeden ikke er i cachen.
      const patchFeed = (reacted: boolean, d: 1 | -1) => {
        if (!activeTeamSpaceId) return;
        patchFeedItem(activeTeamSpaceId, postId, p => ({
          ...p,
          iReacted: reacted,
          heiaCount: Math.max(0, (p.heiaCount ?? 0) + d),
        }));
      };
      patchFeed(!currentlyReacted, delta);
      try {
        await toggleReaction(postId, currentlyReacted);
      } catch {
        adjustMatchEngagement(eventId, postId, {
          heia: -delta,
          iReacted: currentlyReacted,
        });
        patchFeed(currentlyReacted, -delta as 1 | -1);
      }
    },
    [eventId, activeTeamSpaceId],
  );

  /**
   * HEIA FRA KAMPKNAPPEN — LEGG TIL, ALDRI FJERN (skive 10).
   *
   * Selve mekanikken (pending-låsen, den idempotente skrivingen og
   * cache-patchene) bor i `cheerOnMoment`, ikke her: låsen må overleve at
   * skjermen rendrer på nytt midt i kallet, og den skal kunne bevises uten
   * å montere en kampskjerm. Se `src/lib/queries/matchHeia.ts`.
   *
   * `handleMatchHeia` over står urørt — i `MatchEngagementRow` ER av/på
   * riktig oppførsel.
   */
  const handleTabHeia = useCallback(
    (postId: string) =>
      cheerOnMoment({eventId, teamSpaceId: activeTeamSpaceId, postId}),
    [eventId, activeTeamSpaceId],
  );

  const closeReporterDock = useCallback(() => setReporterDockOpen(false), []);

  /**
   * ⚠️ STABILE IDENTITETER, IKKE PYNT. `MatchPulse` og `MatchTimeline` er
   * memoisert nettopp for at reporterdokkens av/på ikke skal koste en ny
   * SVG-kurve og en ny bildefletting midt i animasjonen. En inline
   * `photo => setGalleryPhotoId(photo.id)` er et NYTT objekt hver render, og
   * ville gjort begge memoene verdiløse.
   */
  const openGalleryPhoto = useCallback(
    (photo: MatchPhoto) => setGalleryPhotoId(photo.id),
    [],
  );
  const openReporterSheet = useCallback(
    () => setReporterSheetVisible(true),
    [],
  );
  const clearMatchToast = useCallback(() => setMatchToast(null), []);

  // ⚠️ ARK, IKKE NAVIGASJON. Fra kampen skal samtalen komme opp FORAN
  // kampen: en pågående kamp er noe du står i, og å bli skjøvet ut av den
  // for å lese en kommentar er å forlate den. `CommentsScreen` lever videre
  // for feedens og varslenes innganger — det er SAMME tråd (`CommentThread`),
  // bare en annen ramme.
  const handleMatchComment = useCallback((postId: string) => {
    setCommentPostId(postId);
  }, []);

  /**
   * ⚠️ HVEM SOM KAN KORRIGERE — samme regel som `correct_match_goal` (00075)
   * håndhever: kampens reporter, eller en lagadmin. Regnes HER, og ikke
   * sammen med de andre rolleflaggene lenger nede, fordi `renderEngagement`
   * under trenger den.
   *
   * Serveren er fasit; dette avgjør bare om knappen TEGNES. En flate som
   * viser en handling brukeren ikke har lov til, er en flate som lyver.
   */
  const canCorrectGoals =
    event?.type === 'kamp' &&
    (event.reporterId === myId || isTeamAdmin(activeRole));

  /**
   * Én engasjementslinje, eller ingenting.
   *
   * ⚠️ TRE REGLER, OG ALLE TRE ER PRODUKT, IKKE VISNING:
   *   · Rytmemarkørene (avspark/pause/2. omgang/slutt) HAR feed-poster, men
   *     får aldri en linje — de er kampens gater, ikke øyeblikk.
   *   · Mål IMOT får kommentarer, aldri HEIA (P1, låst).
   *   · Et frittstående kampbilde er sin egen post; `MatchPhoto.id` ER
   *     post-id-en, så det trenger ikke det kanoniske valget.
   * Reglene bor i `shared/matchEngagement` så de kan testes uten en skjerm.
   */
  const renderEngagement = useCallback(
    ({event: ev, photo}: {event?: MatchEvent; photo?: MatchPhoto}) => {
      if (photo) {
        const entry = engagement.byPost.get(photo.id);
        return (
          <MatchEngagementRow
            engagement={entry}
            canHeia
            heiaLabel={matchHeiaA11yLabel({
              subject: 'photo',
              count: entry?.heiaCount ?? 0,
            })}
            commentLabel={matchCommentA11yLabel({
              subject: 'photo',
              count: entry?.commentCount ?? 0,
            })}
            fontCap={GRID_FONT_CAP}
            variant="card"
            onHeia={handleMatchHeia}
            onComment={handleMatchComment}
          />
        );
      }
      if (!ev || !showsEngagement(ev)) {
        return null;
      }
      const entry = engagement.byMatchEvent.get(ev.id);
      // ⚠️ KUN MÅL, og kun for den som har lov. `canCorrectGoal` er den samme
      // regelen serveren håndhever — rytmemarkørene eier kampuret, og en
      // melding har ingen stilling å regne om.
      const correctable = canCorrectGoals && canCorrectGoal(ev);
      return (
        <MatchEngagementRow
          engagement={entry}
          canHeia={allowsHeia(ev)}
          onCorrect={correctable ? () => setCorrectingGoalId(ev.id) : undefined}
          correctLabel={
            correctable
              ? matchCorrectA11yLabel({subject: ev, minute: ev.minute})
              : undefined
          }
          heiaLabel={matchHeiaA11yLabel({
            subject: ev,
            minute: ev.minute,
            count: entry?.heiaCount ?? 0,
          })}
          commentLabel={matchCommentA11yLabel({
            subject: ev,
            minute: ev.minute,
            count: entry?.commentCount ?? 0,
          })}
          fontCap={GRID_FONT_CAP}
          variant="card"
          onHeia={handleMatchHeia}
          onComment={handleMatchComment}
        />
      );
    },
    [engagement, handleMatchHeia, handleMatchComment, canCorrectGoals],
  );

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
  useScreenFocusRefetch(matchEngagementKey(eventId));

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
      let engagementTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleEngagementRefetch = () => {
        if (engagementTimer) clearTimeout(engagementTimer);
        engagementTimer = setTimeout(() => {
          engagementTimer = null;
          invalidateMatchEngagement(eventId);
        }, 400);
      };
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
          // KORRIGERINGEN (skive 8). Rettelsen byttes ut PÅ PLASS og
          // annulleringen fjernes; stillingen kommer for seg som `session`,
          // ferdig omregnet av serveren.
          case 'matchEventUpdate':
            if (!applyMatchEventUpdate(eventId, evt.row)) {
              scheduleEventRefetch();
            }
            // Ble målet et mål IMOT, er HEIA-ene slettet i basen (00075).
            // Tellerne står igjen med gamle tall til engasjementet hentes.
            scheduleEngagementRefetch();
            break;
          case 'matchEventDelete':
            if (!applyMatchEventDelete(eventId, evt.id)) {
              scheduleEventRefetch();
            }
            scheduleEngagementRefetch();
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
          case 'engagementPost':
            // Et ferskt øyeblikk fikk nettopp sin kanoniske post. Debounced,
            // for et mål skriver flere rader i samme transaksjon.
            scheduleEngagementRefetch();
            break;
          case 'reaction':
            // ⚠️ EGET EKKO FILTRERES HER, IKKE I KANALEN. Trykket mitt er
            // alt applisert optimistisk; ekkoet ville talt to ganger.
            // Filteret står her fordi `acquireChannel` deler kanalen, og en
            // «hvem er jeg» fanget i oppsettet ville tilhørt den første
            // abonnenten for alltid.
            if (evt.userId !== myId) {
              adjustMatchEngagement(eventId, evt.postId, {heia: evt.delta});
            }
            break;
          case 'commentDelta':
            // Ingen avsenderfilter: kommentarer skrives i `CommentsScreen`,
            // og mens den er åpen er kampen ute av fokus — abonnementet her
            // er revet, så mitt eget ekko kan aldri nå denne linja.
            adjustMatchEngagement(eventId, evt.postId, {
              comments: evt.delta,
            });
            break;
          case 'resync':
            // Kanalen har vært nede — hendelser kan være tapt. Hent begge
            // stiene straks (P6-reconnect-raden); dette er også broen som
            // lukker reconnect-hullet fokus-broen ikke ser (appen sto jo
            // i fokus hele tiden).
            invalidateEventDetail(eventId);
            invalidateMatchPhotos(eventId);
            invalidateMatchEngagement(eventId);
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
        if (engagementTimer) clearTimeout(engagementTimer);
        markEventDetailStale(eventId);
        markMatchPhotosStale(eventId);
        markMatchEngagementStale(eventId);
        unsubscribe();
      };
    }, [liveMatchSessionId, eventId, myId]),
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

  // -----------------------------------------------------------------------
  // KAMPKNAPPEN I TAB-BAREN (P4, skive 10)
  //
  // Skjermen MELDER SEG PÅ med det bare den vet: om jeg er reporter, om
  // dokken står åpen, og hva som er det nyeste øyeblikket å heie på. Baren
  // regner ingenting selv — se `src/context/MatchButtonContext.tsx`.
  // -----------------------------------------------------------------------
  const [reporterDockOpen, setReporterDockOpen] = useState(false);
  // Kvitteringen på reporterens EGEN handling (skive 10.1). Se `MatchToast`.
  const [matchToast, setMatchToast] = useState<string | null>(null);

  // Hook-trygg utgave: rolleflaggene lenger nede regnes etter early-returnene.
  const iAmReporter = !!myId && event?.reporterId === myId;

  /**
   * ⚠️ DOKKEN NULLSTILLES I FIRE TILFELLER, IKKE ETT.
   *
   *   · kampen avsluttes eller avlyses  (`isUnderway`)
   *   · man bytter til en annen kamp    (`eventId`)
   *   · man MISTER reporterrollen       (`iAmReporter`) — en lagadmin kan
   *     bytte reporter midt i kampen (`setMatchReporter`, patchet
   *     optimistisk inn i cachen). Uten dette ville den avsatte reporteren
   *     sittet igjen med et åpent verktøy til en kamp hun ikke rapporterer.
   *   · blur — se fokus-effekten under.
   *
   * Prototypen gjør det samme: `S.repOpen=false` ved hvert fasebytte.
   */
  useEffect(() => {
    setReporterDockOpen(false);
  }, [eventId, iAmReporter, isUnderway]);

  useFocusEffect(
    useCallback(() => {
      // Går du til kommentarene, en annen fane eller ut av appen, skal
      // verktøyet være lukket når du kommer tilbake.
      return () => setReporterDockOpen(false);
    }, []),
  );

  /**
   * ⚠️ SVEIP-TILBAKE AV MENS DOKKEN ER ÅPEN (Brage 2026-08-21).
   *
   * «hvis man prøver på dette så er det nesten så man drar seg til venstre ut
   * av kampsiden.» Stacken kjører `animationMatchesGesture`, så den vannrette
   * komponenten av et drag ned lakk ut til navigasjonen og begynte å dra
   * kampen av skjermen. Et ark som ligger over skjermen skal EIE gesten sin.
   */
  useEffect(() => {
    navigation.setOptions({gestureEnabled: !reporterDockOpen});
  }, [navigation, reporterDockOpen]);

  // Nyeste øyeblikk å heie på. Gjenbruker P1-gaten (`allowsHeia`) via
  // `newestHeiableMoment` — knappen stiller nøyaktig samme spørsmål som
  // engasjementslinja i forløpet.
  const heiaTarget = useMemo(() => {
    if (!isUnderway || iAmReporter) return null;
    return newestHeiableMoment({
      matchEvents: event?.matchEvents ?? NO_MATCH_EVENTS,
      photos: matchPhotos,
      byMatchEvent: engagement.byMatchEvent,
      byPost: engagement.byPost,
    });
  }, [isUnderway, iAmReporter, event?.matchEvents, matchPhotos, engagement]);

  const matchPresence = useMemo(
    () =>
      isUnderway
        ? {
            eventId,
            isReporter: iAmReporter,
            dockOpen: reporterDockOpen,
            heiaTarget,
            onPress: () => {
              if (iAmReporter) {
                setReporterDockOpen(v => !v);
                return;
              }
              // ⚠️ ADD-ONLY. `heiaTarget.iReacted` gjør at knappen står i
              // «HEIET» og ikke kaller noe i det hele tatt — men vakten står
              // her også, fordi en tilstand og en handling som er uenige er
              // nettopp det som sletter brukerens egen heia.
              if (heiaTarget && !heiaTarget.iReacted) {
                handleTabHeia(heiaTarget.postId);
              }
            },
          }
        : null,
    [
      isUnderway,
      eventId,
      iAmReporter,
      reporterDockOpen,
      heiaTarget,
      handleTabHeia,
    ],
  );

  useMatchPresence(matchPresence);

  if (eventQuery.isLoading) {
    return (
      <ProfilPage title="Hendelse">
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
      </ProfilPage>
    );
  }

  // Behold-ved-feil (samme regel som kalenderbolken): en feilet REFETCH river
  // ikke ned en side som alt viser data — feilflaten er kun for tomt utfall.
  if (!event) {
    return (
      <ProfilPage title="Hendelse">
        <View style={styles.centered}>
          <Text style={styles.emptyTextGround}>
            {eventQuery.isError
              ? 'Kunne ikke laste hendelsen.'
              : 'Fant ikke hendelsen.'}
          </Text>
        </View>
      </ProfilPage>
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
  /**
   * Rollen er tildelt så snart `reporterId` finnes.
   *
   * ⚠️ FORFATTERE ER ANDREKILDEN, IKKE «Medlem» (Brage 2026-09-10: «etter
   * kampen er slutt står det bare "medlem" rapporterte»). Rosteret hentes
   * MED VILJE ikke for en ferdig kamp (`needsRoster` over) — men navnet
   * leses herfra, så den frosne rapporten mistet reporteren og sa «Medlem
   * rapporterte». `get_team_authors` hentes for hver kamp, har ingen
   * statusfilter, og er nettopp kilden for forfatterskap: den kjenner også
   * en reporter som siden har forlatt laget.
   *
   * Rekkefølgen er rosteret først (det bærer rollen for reporter-UI-et),
   * så forfatteren, og bare helt til slutt et navnløst medlem — `undefined`
   * ville tegnet tom-tilstanden «Ingen kampreporter» med «Velg»-knapp, som
   * er direkte feil når rollen ER tildelt.
   */
  const reporterAuthor = reporterId ? authorFor(reporterId) : undefined;
  const reporter = reporterId
    ? teamMembers.find(u => u.id === reporterId) ??
      (reporterAuthor
        ? {
            id: reporterAuthor.id,
            name: reporterAuthor.name,
            role: reporterAuthor.role,
            avatarPath: reporterAuthor.avatarPath,
            avatarColor: reporterAuthor.avatarColor,
          }
        : {id: reporterId, name: 'Medlem'})
    : undefined;

  // Speiler start_match: admin, eller en reporter som alt er utpekt.
  const canStartMatch = isCurrentUserAdmin || isCurrentUserReporter;

  // ⚠️ P2: FAKTISK SPILT TID, og ÉN utregning for hele appen. Var
  // `now − startedAt` her, i `LiveMatchBanner` og i `InboxScreen` — tre
  // kopier som alle telte gjennom pausen. Se `src/shared/matchClock.ts`.
  const matchMinute = event.startedAt
    ? matchMinute_(
        {
          playedSeconds: event.playedSeconds,
          clockStartedAt: event.clockStartedAt,
          startedAt: event.startedAt,
        },
        nowMs,
      )
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
  /**
   * ⚠️ BEGGE SVARENE SKAL SE UT SOM KNAPPER (Brage 2026-09-10: «det er bare
   * tekst inne i boksen og ser ikke ut som klikkbare knapper»). `ghost` er
   * ren tekst og `secondary` er en lysegrå omriss laget for den kremede
   * grunnen — på dagslysgrunnen forsvinner begge. Derfor: det VALGTE svaret
   * bærer fargen (mint / mint-tint), og det andre får en ekte flate
   * (`styles.onGround`) så det fortsatt er en knapp å trykke på.
   */
  const answeredNo = myStatus === 'kan_ikke';
  const comingVariant = answeredNo ? 'secondary' : ('primary' as const);
  const notComingVariant = answeredNo ? 'selected' : ('secondary' as const);

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
      `${formatDateLong(event.startTime)} kl. ${formatTime(
        event.startTime,
      )}. ` +
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
      invalidateLiveMatch(activeTeamSpaceId);
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

    /**
     * ⚠️ VERKTØYET FORSVINNER MED ÉN GANG — IKKE ETTER NETTVERKET.
     *
     * Brage 2026-08-21: «Hvis jeg rapporterer et mål så vil jeg ikke se
     * rapporteringskjermen etterpå, kun "mål registrert".»
     *
     * Lukkingen lå ETTER `await reportMatchEvent` OG `await refetchEvent()`,
     * altså etter to rundturer. Dokken ble derfor stående åpen i hele det
     * øyeblikket reporteren nettopp har handlet — det føltes som om trykket
     * ikke gjorde noe. Trykket ER handlingen; flaten skal svare på trykket,
     * ikke på serveren.
     *
     * Feiler skrivingen, får hun en Alert (under) — og den er et sterkere
     * signal enn et verktøy som ble stående.
     */
    setReporterDockOpen(false);
    setMatchToast(ACTION_DONE[type]);

    try {
      await reportMatchEvent(sessionId, {
        ...ACTION_TO_EVENT[type],
        description,
      });
      // Ingen banner til reporteren: hun trykket nettopp knappen, og ser
      // stillingen og kampforløpet oppdatere seg. Varselet går til de andre,
      // via realtime-abonnementet lenger oppe.
      await refetchEvent();
      // ⚠️ OG DET ER NETTOPP DERFOR DENNE MÅ STÅ HER. Varseltriggeren hopper
      // over FORFATTEREN (00023/00051), så reporteren får aldri et
      // `match_live`-varsel om sitt eget mål, sin egen pause eller sin egen
      // «Slutt». Uten dette ville kampknappen hennes vist gammel stilling —
      // og etter «Slutt» påstått at det fortsatt er en livekamp.
      invalidateLiveMatch(activeTeamSpaceId);
    } catch (e) {
      // Kvitteringen løy: ta den vekk før feilen vises, ellers står det
      // «Mål registrert» bak en Alert som sier det motsatte.
      setMatchToast(null);
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

  /**
   * KORRIGER ET MÅL (skive 8).
   *
   * ⚠️ INGEN LOKAL PATCHING AV STILLINGEN. Den telles opp på nytt fra
   * målhistorikken server-side, og feedens stillingssnapshots skrives om i
   * samme transaksjon — det finnes ikke noe å gjette riktig her. Vi
   * refetcher; de andre telefonene får sitt via realtime.
   *
   * Engasjementet invalideres i tillegg: en annullering tar posten med seg,
   * og en rettelse til «mål imot» sletter HEIA-ene på den.
   */
  const submitCorrection = async (
    matchEventId: string,
    input: Parameters<typeof correctMatchGoal>[1],
  ) => {
    if (savingCorrection) return;
    setSavingCorrection(true);
    try {
      await correctMatchGoal(matchEventId, input);
      setCorrectingGoalId(null);
      invalidateMatchEngagement(eventId);
      await refetchEvent();
      // Stillingen ble regnet om server-side: knappen utenfor kampen må
      // ikke stå igjen med den gamle.
      invalidateLiveMatch(activeTeamSpaceId);
    } catch (e) {
      Alert.alert(
        'Kunne ikke korrigere målet',
        matchErrorText(e, 'Sjekk nettforbindelsen og prøv igjen.'),
      );
    } finally {
      setSavingCorrection(false);
    }
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
  const handlePublishPhoto = async (caption: string, matchEventId?: string) => {
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
      // Samme kvittering som de fem andre handlingene (skive 10.1): bildet
      // gikk gjennom, og verktøyet trenger ikke stå åpent lenger.
      setReporterDockOpen(false);
      setMatchToast('Bildet er lagt ut');
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

  /**
   * «KORRIGER MÅL»-ARKET (skive 8).
   *
   * ⚠️ BOR I BEGGE KAMPGRENENE, og det er hele forskjellen fra et angrevindu:
   * korrigeringen er VARIG. Et feilregistrert mål oppdages like ofte når
   * rapporten leses dagen etter som mens kampen går.
   *
   * ⚠️ `key` PÅ ØYEBLIKKET. Arket initialiserer feltene sine én gang (se
   * komponenten); uten nøkkelen ville et nytt mål åpnet arket med forrige
   * måls målscorer i feltet.
   */
  const correctingGoal = correctingGoalId
    ? (event.matchEvents ?? NO_MATCH_EVENTS).find(
        e => e.id === correctingGoalId,
      )
    : undefined;
  const correctionSheet = correctingGoal ? (
    <GoalCorrectionSheet
      key={correctingGoal.id}
      visible
      event={correctingGoal}
      opponent={event.opponent ?? 'motstanderen'}
      saving={savingCorrection}
      onSave={input =>
        submitCorrection(correctingGoal.id, {action: 'edit', ...input})
      }
      onCancelGoal={() =>
        submitCorrection(correctingGoal.id, {action: 'cancel'})
      }
      onClose={() => setCorrectingGoalId(null)}
    />
  ) : null;

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
          nowMs={nowMs}
          reporter={reporter}
          isAdmin={isCurrentUserAdmin}
          isReporter={isCurrentUserReporter}
          photos={matchPhotos}
          authorFor={authorFor}
          engagement={engagement}
          renderEngagement={renderEngagement}
          onChangeReporter={openReporterSheet}
          onReporterAction={handleReporterAction}
          onPickPhoto={handlePickPhoto}
          onPressPhoto={openGalleryPhoto}
          reporterDockOpen={reporterDockOpen}
          onCloseReporterDock={closeReporterDock}
          toast={matchToast}
          onToastHidden={clearMatchToast}
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

        <CommentSheet
          postId={commentPostId}
          teamSpaceId={activeTeamSpaceId ?? ''}
          onClose={() => setCommentPostId(null)}
        />

        {correctionSheet}
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
          engagement={engagement}
          renderEngagement={renderEngagement}
          onPressPhoto={openGalleryPhoto}
          onEdit={() => navigation.navigate('NewEvent', {eventId})}
        />

        <MatchPhotoGallery
          photos={matchPhotos}
          initialPhotoId={galleryPhotoId}
          onClose={() => setGalleryPhotoId(null)}
        />

        <CommentSheet
          postId={commentPostId}
          teamSpaceId={activeTeamSpaceId ?? ''}
          onClose={() => setCommentPostId(null)}
        />

        {correctionSheet}
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
      : typePill[event.type] ?? typePill.annet;

  return (
    /* SAMME GRUNN SOM RESTEN AV APPEN (Brage 2026-09-10: «denne skjermen må
       vi gjøre noe med … gjelder også trening og sosialt»). `ProfilPage` er
       malen for pushede undersider: dagslysgrunn, tilbakelinje i
       stadionblekk, statuslinje. Alt innhold står i glass — de hvite
       adminplatene er borte (hvite kort leser som «admin», og Heia er ikke
       et administrasjonsverktøy).

       ⚠️ KAMP FÅR MER ENN DE ANDRE, OG DET LIGGER I MATERIALET: kampdagen bor
       i `StadiumGlass`, kampverdenens mørke glass (designregelen «mørkt glass
       kjennetegner kamp» — samme flate som kampkortet i feeden og
       Hjem-heroen). Trening og sosialt får arkets lyse perle. Innholdet er
       det samme; det er FLATEN som sier hva slags dag dette er. */
    <ProfilPage title="Hendelse">
      <ScrollView contentContainerStyle={{paddingBottom: bottomPad}}>
        {isUpcomingMatch && event.opponent ? (
          /* Kampdag (P5B): motstander + avspark fortjener mer enn sort på
           hvitt — en liten stadion-smak, IKKE full ScoreBoard (det er
           live-kampens språk). RSVP og «Start kamp»-flyten består under. */
          <View style={styles.kampdagSection}>
            <StadiumGlass
              style={styles.kampdag}
              teamColor={activeTeamSpace?.color}>
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
              {/* Beskrivelsen hører til KAMPEN — den bor inne i kortet, ikke
                  som løs tekst på grunnen (kontrastfella på rampen). */}
              {event.description && (
                <Text style={styles.kampdagDescription}>
                  {event.description}
                </Text>
              )}
            </StadiumGlass>
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
                  ? `${formatTime(event.startTime)}–${formatTime(
                      event.endTime,
                    )}`
                  : formatTime(event.startTime)}
              </Text>
            </View>
            <Text style={styles.infoDate}>
              {event.type === 'turnering'
                ? dayRangeLabel(
                    event.startTime,
                    event.endTime ?? event.startTime,
                  )
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

        {/* ═══ ÉN KOLONNE UNDER HEROEN ═══
            Heroen forteller HVA dette er. Alt du kan GJØRE og alt som er
            SVART bor i ETT kort under den, i rekkefølge: kampen (reporter,
            start) → påmeldingen (svaret ditt) → hvem som kommer →
            rettelsene, nederst og stillest.

            ⚠️ `unbounded`: kortet vokser med oppmøtelista. Det er den
            tint+kant-varianten UTEN nativ backdrop — både fordi en nativ
            glassflate ikke kan bli vilkårlig høy, og fordi barn som skifter
            antall under en slik flate tok appen ned da man byttet mellom
            «Kommer» og «Kan ikke» (2026-09-10).

            ⚠️ ETT MATERIALE, ETT BLEKK. Forrige runde hadde hvit
            reporterplate, blek mint-boks, rød tekst og en kjempeknapp om
            hverandre — ingenting delte språk. Her deler ALT kortets flate:
            radene er flate, knappene er knapper, skillene er hårlinjer. */}
        <LiquidGlassSurface
          variant="sheet"
          cornerRadius={radius.xl}
          unbounded
          wrapStyle={styles.columnWrap}
          style={styles.column}>
          {isUpcomingMatch && (
            <>
              <ReporterBar
                reporter={reporter}
                isAdmin={isCurrentUserAdmin}
                isMe={isCurrentUserReporter}
                onChangeReporter={openReporterSheet}
                variant="plain"
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
              <View style={styles.divider} />
            </>
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
                        parentTo: (
                          event.endTime ?? event.startTime
                        ).toISOString(),
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
          {/* Etter kampslutt er bildene det man kommer tilbake for — derfor en
          kompakt inngang øverst. De blir uansett stående i forløpet under. */}
          {isFinishedMatch && (
            <MatchPhotoRail
              photos={matchPhotos}
              onPressPhoto={openGalleryPhoto}
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
                  onPressPhoto={openGalleryPhoto}
                />
              </View>
            )}

          {/* RSVP — meningsløst på en ferdigspilt kamp. */}
          {!isFinishedMatch && (
            <>
              <RSVPBar rsvp={rsvp} />
              <View style={styles.rsvpButtons}>
                <Button
                  title={myStatus === 'kommer' ? 'Du kommer!' : 'Kommer'}
                  variant={comingVariant}
                  onPress={() => handleRsvp('kommer')}
                  disabled={savingRsvp}
                  size="lg"
                  style={[styles.rsvpBtn, answeredNo && styles.quietBtn]}
                />
                <Button
                  title={myStatus === 'kan_ikke' ? 'Du kan ikke' : 'Kan ikke'}
                  variant={notComingVariant}
                  onPress={() => handleRsvp('kan_ikke')}
                  disabled={savingRsvp}
                  size="lg"
                  style={[styles.rsvpBtn, !answeredNo && styles.quietBtn]}
                />
              </View>
            </>
          )}

          <AttendanceStrip coming={attendees.coming} />

          {/* Rettelsene NEDERST og stillest: de er ikke det man kom hit for. */}
          {isCurrentUserAdmin && (
            <>
              <View style={styles.divider} />
              <View style={styles.adminActions}>
                <Button
                  title="Rediger"
                  variant="secondary"
                  onPress={() => navigation.navigate('NewEvent', {eventId})}
                  style={[styles.adminAction, styles.quietBtn]}
                />
                {isUpcomingMatch && (
                  <Button
                    title="Avlys kamp"
                    variant="secondary"
                    onPress={() => handleSetCancelled(true)}
                    disabled={savingCancelled}
                    style={[styles.adminAction, styles.quietBtn]}
                  />
                )}
                {isCancelledMatch && (
                  <Button
                    title="Sett opp igjen"
                    variant="secondary"
                    onPress={() => handleSetCancelled(false)}
                    disabled={savingCancelled}
                    style={[styles.adminAction, styles.quietBtn]}
                  />
                )}
              </View>
            </>
          )}
        </LiquidGlassSurface>
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
    </ProfilPage>
  );
}

// ---------------------------------------------------------------------------
// Hjelpkomponenter
// ---------------------------------------------------------------------------
/**
 * HVEM KOMMER — ÉN RAD, FAST HØYDE.
 *
 * ⚠️ Runde 5 hadde tre seksjoner med overskrift og én rad per person. Det tok
 * halve siden for et spørsmål som er verdt én linje, og verre: KORTET VOKSTE
 * når du svarte, fordi en rad flyttet seg mellom listene (Brage 2026-09-10:
 * «boksen utvider seg … ser veldig billig ut»). En avatarstabel har SAMME
 * høyde uansett hvor mange som kommer, så svaret ditt flytter ingenting.
 *
 * Tallene står allerede i `RSVPBar` rett over — stripa svarer på HVEM, ikke
 * hvor mange. «Kan ikke» og «har ikke svart» er tall der, ikke ansikter her.
 */
const STRIP_FACES = 7;

function AttendanceStrip({coming}: {coming: EventAttendee[]}) {
  const shown = coming.slice(0, STRIP_FACES);
  const rest = coming.length - shown.length;
  return (
    <View style={styles.strip}>
      {shown.map((attendee, index) => (
        // En forelder kan svare for flere barn — id alene er ikke unik.
        <View
          key={`${attendee.id}-${attendee.childName ?? 'selv'}`}
          style={index > 0 && styles.stripOverlap}>
          <Avatar name={attendee.childName ?? attendee.name} size="sm" />
        </View>
      ))}
      {rest > 0 && (
        <Text style={styles.stripRest} maxFontSizeMultiplier={1.2}>
          +{rest}
        </Text>
      )}
      {coming.length === 0 && (
        <Text style={styles.stripEmpty}>Ingen har svart ennå</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stiler
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Tomtekst rett på dagslysgrunnen (feilflaten): stadionblekk, som
  // tilbakelinja over den.
  emptyTextGround: {
    ...typography.body,
    color: colors.stadiumText,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
    color: OPAL.inkSecondary,
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
    color: OPAL.inkSecondary,
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
    color: matchColors.dim,
  },
  kampdagDay: {
    ...typography.caption,
    color: matchColors.dim,
  },
  kampdagTitle: {
    ...typography.heading3,
    color: matchColors.text,
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
    color: matchColors.text,
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
    color: matchColors.dim,
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
  kampdagDescription: {
    ...typography.body,
    color: matchColors.dim,
    lineHeight: 22,
  },
  kampdagMeta: {
    ...typography.caption,
    color: matchColors.dim,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: OPAL.inkSecondary,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  // Rettelsene ligger på rad under kortet. To knapper deler bredden når
  // kampen kan avlyses; alene fyller «Rediger» raden.
  /** Kolonnen: ETT kort for alt under heroen. */
  columnWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  column: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  /**
   * DEN STILLE KNAPPEN. `secondary` er en lysegrå omriss laget for den
   * kremede grunnen — på kortet forsvinner den, og `ghost` er bare tekst
   * (Brage: «ser ikke ut som klikkbare knapper»). Denne gir en ekte, lys
   * flate med materialets egen kant, så begge valgene ER knapper: det ene
   * bærer fargen, det andre bærer flaten.
   */
  quietBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(8, 57, 46, 0.16)',
  },
  /** Fast høyde = avatarens høyde. Kortet rører seg ikke når du svarer. */
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  stripOverlap: {
    marginLeft: -10,
  },
  stripRest: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: OPAL.inkSecondary,
    marginLeft: spacing.sm,
  },
  stripEmpty: {
    ...typography.bodySmall,
    color: OPAL.inkTertiary,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.md,
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
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rsvpBtn: {
    flex: 1,
  },
  // Tomtekst INNE i et ark.
  emptyText: {
    ...typography.bodySmall,
    color: OPAL.inkTertiary,
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
