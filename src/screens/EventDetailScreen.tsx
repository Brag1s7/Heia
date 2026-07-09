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
import {getMembersForTeamSpace} from '../data/teamData';
import {getEventDetail, setRsvp} from '../lib/api/events';
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

  // Medlemsdata for kampreporter-UI-et er fortsatt mock — det ryddes når
  // live-kamp kobles til ekte match_sessions.
  const teamMembers = activeTeamSpaceId
    ? getMembersForTeamSpace(activeTeamSpaceId)
    : [];
  const teamName = activeTeamSpace?.displayName ?? '';

  const [event, setEvent] = useState<HeiaEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myStatus, setMyStatus] = useState<RSVPStatus>('venter');
  const [savingRsvp, setSavingRsvp] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
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
  const isCurrentUserReporter = reporterId === currentUser?.id;
  // Samme rolleregel som is_team_admin() i RLS — en lagleder skal se det
  // samme som en trener.
  const isCurrentUserAdmin = isTeamAdmin(activeRole);
  const reporter = reporterId
    ? teamMembers.find(u => u.id === reporterId)
    : undefined;

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

  const handleReporterAction = (type: ReporterActionType) => {
    if (type === 'pause' || type === 'slutt') {
      const label = type === 'pause' ? 'Pause' : 'Kampen er ferdig';
      setPushNotification({
        visible: true,
        title: `${teamName} · ${label}`,
        message:
          type === 'pause'
            ? `Pause. ${event.score?.home}-${event.score?.away}.`
            : `Slutt! ${event.score?.home}-${event.score?.away}.`,
      });
      return;
    }

    setSelectedActionType(type);
    setReporterModalVisible(true);
  };

  const handleReportSubmit = (description: string) => {
    setReporterModalVisible(false);

    const actionLabels: Record<ReporterActionType, string> = {
      mål_oss: 'MÅL!',
      mål_dem: 'Mål (motstander)',
      pause: 'Pause',
      slutt: 'Kampen er ferdig',
      melding: 'Melding fra kampen',
    };

    setPushNotification({
      visible: true,
      title: `${teamName} · ${actionLabels[selectedActionType]}`,
      message: description || event.title,
    });
  };

  const handleSelectReporter = (userId: string) => {
    setReporterId(userId);
    setReporterSheetVisible(false);
    const selected = teamMembers.find(u => u.id === userId);
    if (selected) {
      setPushNotification({
        visible: true,
        title: 'Kampreporter byttet',
        message: `${selected.name} er nå kampreporter.`,
      });
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
              minute={55}
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
                    <Text style={styles.notificationTitle}>Kampvarsler</Text>
                    <Text style={styles.notificationDesc}>
                      Få varsel ved mål, pause og slutt
                    </Text>
                  </View>
                  <Button
                    title={notificationsEnabled ? 'På' : 'Slå på'}
                    variant={notificationsEnabled ? 'primary' : 'secondary'}
                    size="md"
                    onPress={() => {
                      setNotificationsEnabled(!notificationsEnabled);
                      if (!notificationsEnabled) {
                        setPushNotification({
                          visible: true,
                          title: 'Kampvarsler aktivert',
                          message:
                            'Du får varsler ved mål, pause og slutt i denne kampen.',
                        });
                      }
                    }}
                  />
                </View>
              </Card>
            </View>
          )}

          {/* Reporter-verktøy — kun synlig for aktiv reporter */}
          {isCurrentUserReporter && (
            <View style={styles.section}>
              <ReporterActions onAction={handleReporterAction} />
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
    <ScrollView
      style={styles.screen}
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

      {/* RSVP */}
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
