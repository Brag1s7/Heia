import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing} from '../theme';
import {
  Card,
  Chip,
  Button,
  RSVPBar,
  SectionHeader,
  Avatar,
  ListRow,
  ScoreBoard,
  MatchEventRow,
  ReporterActions,
  ReporterModal,
  ReporterBar,
  ReporterSheet,
  SimulatedPush,
} from '../components';
import type {ReporterActionType} from '../components/ReporterActions';
import {useAuth, useActiveTeam} from '../context';
import {getTeamMembers, type TeamMember} from '../lib/api/members';
import {
  getEventDetail,
  setRsvp,
  setMatchReporter,
  startMatch,
  reportMatchEvent,
  subscribeToMatch,
  type ReportMatchEventInput,
} from '../lib/api/events';
import {isTeamAdmin} from '../shared/roles';
import type {
  EventAttendee,
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

const ACTION_LABELS: Record<ReporterActionType, string> = {
  mål_oss: 'MÅL!',
  mål_dem: 'Mål (motstander)',
  pause: 'Pause',
  andre_omgang: 'Andre omgang',
  slutt: 'Kampen er ferdig',
  melding: 'Melding fra kampen',
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
  if (message.includes('Access denied')) {
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

export function EventDetailScreen({route}: Props) {
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
  const [reporterId, setReporterId] = useState<string | undefined>(undefined);
  const [pushNotification, setPushNotification] = useState({
    visible: false,
    title: '',
    message: '',
  });

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

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

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

  // Kampen er i gang (også i pause — da telles minuttene fortsatt).
  const isUnderway =
    event?.matchStatus === 'live' || event?.matchStatus === 'halfTime';
  const liveMatchSessionId = isUnderway ? event?.matchSessionId : undefined;

  // Dette er hele grunnen til at en forelder kan følge med: uten abonnementet
  // ville stillingen stått stille til hun selv dro for å oppdatere.
  useEffect(() => {
    if (!liveMatchSessionId) return;
    return subscribeToMatch(liveMatchSessionId, () => {
      loadEvent();
    });
  }, [liveMatchSessionId, loadEvent]);

  // Kampminuttet regnes ut fra started_at, men ingenting re-rendrer skjermen
  // mellom hendelsene — uten denne ville minuttet frosset til neste mål.
  useEffect(() => {
    if (!liveMatchSessionId) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [liveMatchSessionId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.heia} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{error ?? 'Fant ikke hendelsen.'}</Text>
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
      await loadEvent();
      setPushNotification({
        visible: true,
        title: `${teamName} · ${ACTION_LABELS[type]}`,
        message: description || event.title,
      });
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
      await loadEvent();
      const selected = teamMembers.find(u => u.id === userId);
      setPushNotification({
        visible: true,
        title: 'Kampreporter byttet',
        message: `${selected?.name ?? 'Medlemmet'} er nå kampreporter.`,
      });
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
              />
            </View>
          )}

          {/* Kampforløp */}
          <SectionHeader title="Kampforløp" />
          <View style={styles.timeline}>
            {matchEvents
              .slice()
              .reverse()
              .map((me, index) => (
                <MatchEventRow
                  key={me.id}
                  event={me}
                  isLatest={index === 0}
                />
              ))}
          </View>
        </ScrollView>

        {/* Simulert push-varsling */}
        <SimulatedPush
          title={pushNotification.title}
          message={pushNotification.message}
          visible={pushNotification.visible}
          onHide={() =>
            setPushNotification({visible: false, title: '', message: ''})
          }
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
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // VANLIG EVENT-MODUS (trening, sosialt, kommende kamp)
  // -----------------------------------------------------------------------
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}>
      {/* Event-info */}
      <Card style={styles.infoCard}>
        <Chip type={event.type} />
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.metaList}>
          <MetaRow label="Dato" value={formatDateLong(event.startTime)} />
          <MetaRow
            label="Tid"
            value={
              event.endTime
                ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
                : formatTime(event.startTime)
            }
          />
          {event.location && <MetaRow label="Sted" value={event.location} />}
        </View>
        {event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}
      </Card>

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

      {/* Kamprapporten — sluttresultat + alt reporteren meldte inn. */}
      {isFinishedMatch && event.score && event.opponent && (
        <View style={styles.matchSection}>
          <ScoreBoard
            homeTeam={teamName}
            awayTeam={event.opponent}
            homeScore={event.score.home}
            awayScore={event.score.away}
            matchStatus={event.matchStatus!}
          />
        </View>
      )}

      {isFinishedMatch && finishedMatchEvents.length > 0 && (
        <>
          <SectionHeader title="Kampforløp" />
          <View style={styles.timeline}>
            {finishedMatchEvents.map(me => (
              <MatchEventRow key={me.id} event={me} />
            ))}
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

      {/* Oppmøteliste */}
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hjelpkomponenter
// ---------------------------------------------------------------------------
function MetaRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

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
  infoCard: {
    margin: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading2,
    marginTop: spacing.sm,
  },
  metaList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    width: 48,
  },
  metaValue: {
    ...typography.body,
    flex: 1,
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
