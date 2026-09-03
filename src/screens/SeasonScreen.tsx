import React, {useCallback, useState} from 'react';
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
import {colors, typography, spacing, radius, shadows, fonts} from '../theme';
import {
  BackBar,
  EventCard,
  HeroSurface,
  ListRowSkeleton,
  LiveMatchBanner,
  ScoreChip,
  SectionHeader,
  Skeleton,
  StadiumSurface,
  StatusPill,
  useBottomContentPadding,
} from '../components';
import {Plus, Trophy} from '../components/icons';
import {useActiveTeam} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {
  getSeasonStats,
  type SeasonMatch,
  type SeasonStats,
  type SeasonView,
} from '../lib/api/stats';
import {
  supportSummaryKey,
  useSupportSummary,
} from '../lib/queries/supportSummary';
import {useScreenFocusRefetch} from '../lib/queries/useScreenFocusRefetch';
import {formatKr} from '../lib/money';
import {getMatchSchedule} from '../lib/api/events';
import {buildMatchSchedule} from '../shared/matchSchedule';
import type {HeiaEvent, KampStackParamList} from '../shared/types';

/** Stabil identitet: en fersk tom array per render ville revet memoene. */
const NO_MATCHES: HeiaEvent[] = [];

type Nav = NativeStackNavigationProp<KampStackParamList, 'Season'>;

const MONTHS = [
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

// Halvåret/turneringen står i velgeren, så datoen trenger ikke året.
function formatMatchDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}

// Kamplisten i halvårsvisning har turneringene som mellomtitler; i
// turneringsvisning er alle kampene samme turnering og titlene ville
// bare gjentatt overskriften.
type SeasonRow =
  | {kind: 'tournament'; title: string; key: string}
  | {kind: 'match'; match: SeasonMatch; key: string};

function buildRows(
  matches: SeasonMatch[],
  withTournamentHeaders: boolean,
): SeasonRow[] {
  const rows: SeasonRow[] = [];
  let prevTournament: string | undefined;
  matches.forEach((match, index) => {
    if (
      withTournamentHeaders &&
      match.tournament &&
      match.tournament !== prevTournament
    ) {
      rows.push({
        kind: 'tournament',
        title: match.tournament,
        key: `t${index}`,
      });
    }
    prevTournament = match.tournament;
    rows.push({kind: 'match', match, key: match.eventId});
  });
  return rows;
}

/**
 * Sesongflaten — den første flaten som viser at appen samler opp noe over tid.
 *
 * Velgeren sidestiller sesonger og turneringer (brukerens modell: begge er
 * «samlinger av kamper»). Sesong = vår (jan–jun) / høst (jul–des) —
 * sport-nøytralt uten oppsett. En turnering er sin egen visning med egne
 * tall, og «+ Ny turnering» bor her (kun trener) — IKKE i kalenderen.
 *
 * Formvalget er bevisst IKKE et diagram: en KPI-rad med store tall og én
 * liste. Sesongtallene er kampdata og bor på den mørke stadionflaten (låst
 * A v2-signatur); listen under er hverdag og bor på hvitt kort.
 *
 * Ingen toppscorerliste — LÅST beslutning (bruker, 2026-07-30): ingen
 * spillerstatistikk før laget har en strukturert spillerstall.
 */
/**
 * KAMPPROGRAMMET PÅ SESONGSIDEN (skive 10.1).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ TRE NIVÅER, OG BARE ETT AV DEM ER EN LISTE
 *
 *   · PÅGÅENDE kampen får `LiveMatchBanner` — den samme stadion-heroen Hjem
 *     bruker. Ikke en ny variant: dette er nøyaktig samme øyeblikk, sett fra
 *     en annen inngang, og to tegninger av den ville drevet fra hverandre.
 *   · DAGENS kamper får full oppmerksomhet med `featured`-kortet.
 *   · KOMMENDE er en rolig liste.
 *
 * Prioriteringsregelen selv bor i `shared/matchSchedule` — den er produkt,
 * ikke visning, og skal kunne bevises uten å montere en skjerm.
 */
function MatchProgramme({
  matches,
  loaded,
  canCreate,
  onOpenMatch,
}: {
  matches: HeiaEvent[];
  loaded: boolean;
  /** Kun for tomtilstanden: en trener skal se seksjonen selv når den er tom,
   *  fordi «Ny kamp» i toppen er handlingen hennes. */
  canCreate: boolean;
  onOpenMatch: (eventId: string) => void;
}) {
  const {live, today, upcoming} = buildMatchSchedule(matches);
  const harNoe = live.length + today.length + upcoming.length > 0;

  // Ingenting å vise OG ingen rett til å lage noe: da er seksjonen bare en
  // tom overskrift, og arkivet under er hele siden.
  if (loaded && !harNoe && !canCreate) return null;

  return (
    <View style={styles.programme}>
      <SectionHeader title={live.length > 0 ? 'Nå' : 'Kampprogram'} />

      {live.map(match => (
        <View key={match.id} style={styles.programmeItem}>
          <LiveMatchBanner
            event={match}
            onPress={() => onOpenMatch(match.id)}
          />
        </View>
      ))}

      {today.map(match => (
        <View key={match.id} style={styles.programmeItem}>
          {/* `featured` er dagens signal — samme kort, mer vekt. */}
          <EventCard
            event={match}
            featured
            onPress={() => onOpenMatch(match.id)}
          />
        </View>
      ))}

      {upcoming.map(match => (
        <View key={match.id} style={styles.programmeItem}>
          <EventCard event={match} onPress={() => onOpenMatch(match.id)} />
        </View>
      ))}

      {/* Påstanden om tomhet kommer FØRST når vi faktisk vet. */}
      {loaded && !harNoe && (
        <View style={styles.programmeEmpty}>
          <Text style={styles.programmeEmptyText}>
            Ingen kamper er satt opp ennå.
          </Text>
        </View>
      )}
    </View>
  );
}

export function SeasonScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomContentPadding();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();
  const isAdmin = isTeamAdmin(activeRole);
  // Pushet fra Hjem (index > 0) eller fanerot (index 0)? Se `BackBar` under.
  const pushet = navigation.getState().index > 0;

  const [stats, setStats] = useState<SeasonStats | null>(null);
  // Kampprogrammet (skive 10.1) — EGEN henting, ikke en endring av
  // `get_season_stats`. Sesongtallene er historikk og skal fortsette å telle
  // bare det som er spilt; «kommende» hører ikke hjemme i vunnet/tapt.
  const [schedule, setSchedule] = useState<HeiaEvent[]>(NO_MATCHES);
  // ⚠️ «Ingen kamper er satt opp ennå» er en PÅSTAND, og den skal ikke
  // stå der mens vi fortsatt henter. Uten dette blinker tomtilstanden inn
  // på hver åpning, rett før programmet fyller seg.
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = «serverens valg» (inneværende halvår). Settes av velgeren.
  const [selected, setSelected] = useState<SeasonView | null>(null);
  // Lagkassa (fase 5) — den permanente inngangen ved siden av lagets tall.
  // Deles med TeamHome via cachen (S1-c): fanebyttet Hjem → Sesongen koster
  // ikke lenger et nytt kall innenfor 60 s. Feiler oppslaget, er data
  // undefined og kortet skjules — samme oppførsel som før.
  const supportQuery = useSupportSummary(activeTeamSpaceId);
  const supportSummary = supportQuery.data ?? null;
  useScreenFocusRefetch(supportSummaryKey(activeTeamSpaceId ?? ''));

  const loadStats = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    // Programmet er sekundært for sesongTALLENE: feiler det, skal
    // arkivet fortsatt kunne leses.
    getMatchSchedule(activeTeamSpaceId)
      .then(setSchedule)
      .catch(() => setSchedule(NO_MATCHES))
      .finally(() => setScheduleLoaded(true));
    try {
      setStats(await getSeasonStats(activeTeamSpaceId, selected ?? undefined));
    } catch {
      setError('Kunne ikke laste sesongen. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId, selected]);

  // Refetch ved fokus og ved bytte i velgeren (selected er i deps).
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const refetchSupport = supportQuery.refetch;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Eksplisitt brukerhandling hopper over staleTime også for lagkassa.
    refetchSupport();
    loadStats();
  }, [loadStats, refetchSupport]);

  if (!activeTeamSpaceId) return null;

  // Velgeren markerer det brukeren TRYKKET med én gang; serversvaret tar
  // over når det lander. Uten dette føltes chipen død i et halvt sekund.
  const activeView: SeasonView | null =
    selected ??
    (stats?.tournament
      ? {kind: 'tournament', id: stats.tournament.id}
      : stats?.seasonYear != null && stats.seasonHalf != null
      ? {kind: 'half', year: stats.seasonYear, half: stats.seasonHalf}
      : null);

  const inTournamentView = activeView?.kind === 'tournament';
  const rows = stats ? buildRows(stats.matches, !inTournamentView) : [];
  const showPicker =
    !!stats &&
    (stats.seasons.length > 1 || stats.tournaments.length > 0 || isAdmin);
  // Helt fersk flate: ingen spilte kamper, ingen turneringer, bare
  // inneværende halvår — da trengs ingen tall, bare en forklaring.
  const isBrandNew =
    !!stats &&
    stats.played === 0 &&
    stats.seasons.length <= 1 &&
    stats.tournaments.length === 0;

  const emptyInViewText = stats
    ? `Ingen spilte kamper i ${
        stats.tournament ? stats.seasonLabel : stats.seasonLabel.toLowerCase()
      } ennå.`
    : '';

  return (
    <View style={styles.screen}>
      {/* ⚠️ SESONGEN BOR TO STEDER, OG BARE DET ENE HAR EN VEI TILBAKE.
          Som ROT i Kamp-fanen har den ingen — `goBack()` ville bobla opp til
          fanenavigatoren og kastet deg til Hjem (Brage 2026-08-21: «som ikke
          skal være mulig»). Som PUSHET skjerm fra laghodet på Hjem MÅ den ha
          en, ellers er snarveien en blindvei.

          `index > 0` er stackens eget svar på «ble jeg pushet hit», og det
          er sannere enn `canGoBack()`, som også teller foreldrenavigatoren. */}
      {pushet && <BackBar />}

      <ScrollView
        contentContainerStyle={{paddingBottom: bottomPad}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>
        <View
          style={[
            styles.header,
            // Toppmargen bæres av `BackBar` når den finnes. Som fanerot er
            // det ingenting over tittelen, og da må den holde seg klar av
            // statuslinja selv — ellers legger den seg oppå klokka.
            {paddingTop: pushet ? spacing.sm : insets.top + spacing.md},
          ]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Sesongen</Text>
            {activeTeamSpace ? (
              <Text style={styles.subtitle}>{activeTeamSpace.displayName}</Text>
            ) : null}
          </View>
          {/* ⚠️ EN EKTE KNAPP, IKKE EN TEKSTLENKE (Brage: «må det være en
              bedre knapp for å legge til ny kamp!»). Å sette opp kampen er
              hele grunnen til at en trener åpner denne siden før sesongen
              har startet — da kan handlingen ikke være det svakeste
              elementet på flaten. */}
          {isAdmin && (
            <Pressable
              onPress={() =>
                navigation.navigate('NewEvent', {presetType: 'kamp'})
              }
              accessibilityRole="button"
              accessibilityLabel="Ny kamp"
              hitSlop={8}
              style={({pressed}) => [
                styles.newMatch,
                pressed && styles.newMatchPressed,
              ]}>
              <Plus size={17} color={colors.heiaDeep} strokeWidth={2.6} />
              <Text style={styles.newMatchText}>Ny kamp</Text>
            </Pressable>
          )}
        </View>

        {/* ⚠️ PROGRAMMET LIGGER ØVERST, OVER SESONGTALLENE (skive 10.1).
            Fra skive 10 fører kampknappen hit, og da er det DAGENS kamp man
            leter etter — ikke fjorårets målforskjell. Brage etter
            telefontesten: «dagens kamp tydelig prioritert». Arkivet under er
            uendret; det er to ulike spørsmål på samme flate. */}
        <MatchProgramme
          matches={schedule}
          loaded={scheduleLoaded}
          canCreate={isAdmin}
          onOpenMatch={id => navigation.navigate('EventDetail', {eventId: id})}
        />

        {loading ? (
          <>
            {/* Tallene bor på stadionflaten også som skeleton — flatebyttet
                lys/mørk skal ikke blinke inn etter lastingen. */}
            <StadiumSurface style={styles.hero}>
              <Skeleton width={110} height={11} style={styles.stadiumBone} />
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <Skeleton width={44} height={34} style={styles.stadiumBone} />
                  <Skeleton width={52} height={10} style={styles.stadiumBone} />
                </View>
                <View style={styles.kpi}>
                  <Skeleton width={44} height={34} style={styles.stadiumBone} />
                  <Skeleton width={52} height={10} style={styles.stadiumBone} />
                </View>
                <View style={styles.kpi}>
                  <Skeleton width={44} height={34} style={styles.stadiumBone} />
                  <Skeleton width={52} height={10} style={styles.stadiumBone} />
                </View>
              </View>
            </StadiumSurface>
            <View style={styles.sectionHeader}>
              <Skeleton width={80} height={11} />
            </View>
            <View style={styles.listCard}>
              <ListRowSkeleton />
              <ListRowSkeleton />
              <ListRowSkeleton showBorder={false} />
            </View>
          </>
        ) : error || !stats ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {error ?? 'Kunne ikke laste sesongen.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Velgeren: sesonger og turneringer om hverandre, + ny turnering */}
            {showPicker && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}>
                {stats.seasons.map(season => {
                  const isActive =
                    activeView?.kind === 'half' &&
                    activeView.year === season.year &&
                    activeView.half === season.half;
                  return (
                    <Pressable
                      key={`h-${season.year}-${season.half}`}
                      onPress={() =>
                        setSelected({
                          kind: 'half',
                          year: season.year,
                          half: season.half,
                        })
                      }
                      style={({pressed}) => [
                        styles.pickerChip,
                        isActive && styles.pickerChipActive,
                        pressed && !isActive && styles.pickerChipPressed,
                      ]}>
                      <Text
                        style={[
                          styles.pickerChipText,
                          isActive && styles.pickerChipTextActive,
                        ]}>
                        {season.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {stats.tournaments.map(tournament => {
                  const isActive =
                    activeView?.kind === 'tournament' &&
                    activeView.id === tournament.id;
                  return (
                    <Pressable
                      key={`t-${tournament.id}`}
                      onPress={() =>
                        setSelected({kind: 'tournament', id: tournament.id})
                      }
                      style={({pressed}) => [
                        styles.pickerChip,
                        isActive && styles.pickerChipActive,
                        pressed && !isActive && styles.pickerChipPressed,
                      ]}>
                      <Trophy
                        size={13}
                        color={isActive ? colors.heiaInk : colors.goldInk}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          styles.pickerChipText,
                          isActive && styles.pickerChipTextActive,
                        ]}
                        numberOfLines={1}>
                        {tournament.title}
                      </Text>
                    </Pressable>
                  );
                })}
                {isAdmin && (
                  <Pressable
                    onPress={() =>
                      navigation.navigate('NewEvent', {
                        presetType: 'turnering',
                      })
                    }
                    style={({pressed}) => [
                      styles.pickerChip,
                      pressed && styles.pickerChipPressed,
                    ]}>
                    <Plus size={14} color={colors.heiaInk} strokeWidth={2.4} />
                    <Text
                      style={[styles.pickerChipText, styles.newTournamentText]}>
                      Ny turnering
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            )}

            {isBrandNew ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Sesongen starter her</Text>
                <Text style={styles.emptyText}>
                  Når lagets første kamp er ferdigspilt, samles resultater og
                  kamprapporter på denne siden — sesong for sesong.
                </Text>
              </View>
            ) : (
              <>
                {/* Tallene — kampdata bor på stadionflaten */}
                <StadiumSurface style={styles.hero}>
                  <View style={styles.heroLabelRow}>
                    {inTournamentView && (
                      <Trophy size={14} color={colors.gold} strokeWidth={2.2} />
                    )}
                    <Text style={styles.heroLabel} numberOfLines={1}>
                      {stats.seasonLabel}
                    </Text>
                  </View>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiValue}>{stats.played}</Text>
                      <Text style={styles.kpiLabel}>
                        {stats.played === 1 ? 'Kamp' : 'Kamper'}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiValue}>{stats.wins}</Text>
                      <Text style={styles.kpiLabel}>
                        {stats.wins === 1 ? 'Seier' : 'Seiere'}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiValue}>{stats.goalsFor}</Text>
                      <Text style={styles.kpiLabel}>Mål</Text>
                    </View>
                  </View>
                  {/* Uavgjort/tap er informasjon, ikke en feil — dempet, ikke
                      ropende (samme holdning som «kan ikke» i RSVPBar). */}
                  {stats.played > 0 && (
                    <Text style={styles.heroMeta}>
                      {stats.draws} uavgjort · {stats.losses} tap ·{' '}
                      {stats.goalsFor}–{stats.goalsAgainst} i målforskjell
                    </Text>
                  )}
                </StadiumSurface>

                {/* Kampene — hver rad åpner kamprapporten */}
                {stats.played === 0 ? (
                  <View style={[styles.emptyCard, styles.emptyCardBelow]}>
                    <Text style={styles.emptyText}>{emptyInViewText}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionDash} />
                      <Text style={styles.sectionLabel}>Kampene</Text>
                    </View>
                    <View style={styles.listCard}>
                      {rows.map((row, index) =>
                        row.kind === 'tournament' ? (
                          <View
                            key={row.key}
                            style={[
                              styles.tournamentRow,
                              index > 0 && styles.rowBorder,
                            ]}>
                            <Trophy
                              size={14}
                              color={colors.goldInk}
                              strokeWidth={2.2}
                            />
                            <Text
                              style={styles.tournamentTitle}
                              numberOfLines={1}>
                              {row.title}
                            </Text>
                          </View>
                        ) : (
                          <Pressable
                            key={row.key}
                            onPress={() =>
                              navigation.navigate('EventDetail', {
                                eventId: row.match.eventId,
                              })
                            }
                            style={({pressed}) => [
                              styles.matchRow,
                              index > 0 && styles.rowBorder,
                              pressed && styles.rowPressed,
                            ]}>
                            <View style={styles.matchInfo}>
                              <Text style={styles.matchTitle} numberOfLines={1}>
                                mot {row.match.opponent}
                              </Text>
                              <Text style={styles.matchMeta}>
                                {formatMatchDate(row.match.startTime)} ·{' '}
                                {row.match.isHome ? 'Hjemme' : 'Borte'}
                              </Text>
                            </View>
                            {row.match.home > row.match.away && (
                              <StatusPill kind="seier" label="Seier" />
                            )}
                            <ScoreChip
                              score={`${row.match.home}–${row.match.away}`}
                            />
                          </Pressable>
                        ),
                      )}
                    </View>
                  </>
                )}
              </>
            )}

            {/* Lagkassa — den permanente inngangen ved siden av lagets
                stolthet og tall (fase 5). Vises for alle medlemmer. */}
            {supportSummary && (
              <Pressable
                onPress={() => navigation.navigate('Lagkassa')}
                accessibilityRole="button"
                accessibilityLabel="Åpne lagkassa"
                style={({pressed}) => pressed && styles.lagkassaPressed}>
                <HeroSurface style={styles.lagkassaCard}>
                  <Text style={styles.lagkassaPill}>💚 LAGKASSA</Text>
                  {supportSummary.supporters > 0 ? (
                    <>
                      <Text style={styles.lagkassaAmount}>
                        {formatKr(supportSummary.monthlyToClubMinor)}
                      </Text>
                      <Text style={styles.lagkassaCaption}>
                        til laget hver måned ·{' '}
                        {supportSummary.supporters === 1
                          ? '1 støttespiller'
                          : `${supportSummary.supporters} støttespillere`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.lagkassaEmpty}>
                        Bli lagets første støttespiller
                      </Text>
                      <Text style={styles.lagkassaCaption}>
                        Hver krone gjør lagfølelsen større
                      </Text>
                    </>
                  )}
                </HeroSurface>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerText: {
    flex: 1,
  },
  // Mint fyll med heiaDeep blekk — appens hovedhandling, samme par som
  // «Publiser» og «Mål oss». Den var en tekstlenke i et seksjonshode.
  newMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.heia,
    ...shadows.glow,
  },
  newMatchPressed: {
    backgroundColor: colors.heiaPressed,
  },
  newMatchText: {
    ...typography.action,
    color: colors.heiaDeep,
  },
  programme: {
    paddingTop: spacing.sm,
  },
  programmeItem: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  programmeEmpty: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  programmeEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    // ⚠️ `paddingTop` SETTES PÅ KALLSTEDET, med `insets.top`. Da `BackBar`
    // ble fjernet (Sesongen er en fanerot nå), forsvant også det ENESTE
    // som holdt innholdet klar av statuslinja — tittelen la seg oppå klokka
    // og Dynamic Island (Brage 2026-08-21). En konstant her ville vært feil
    // på hver telefon med et annet toppområde.
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stadiumBone: {
    backgroundColor: colors.stadiumEdge,
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
  emptyCardBelow: {
    marginTop: spacing['2xl'],
  },
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Samme valgt-språk som chipene i NewEventScreen: valgt skifter FLATE.
  pickerRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 220,
  },
  pickerChipActive: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  pickerChipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  pickerChipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pickerChipTextActive: {
    color: colors.heiaInk,
    fontWeight: '700',
  },
  newTournamentText: {
    color: colors.heiaInk,
    fontWeight: '600',
  },
  hero: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.stadiumDim,
    flexShrink: 1,
  },
  kpiRow: {
    flexDirection: 'row',
  },
  kpi: {
    flex: 1,
    gap: 2,
  },
  // Mint tekst er lov her — dette er stadionmørk flate (≈13:1).
  kpiValue: {
    ...typography.scoreLarge,
    color: colors.heia,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.stadiumDim,
  },
  heroMeta: {
    ...typography.bodySmall,
    color: colors.stadiumDim,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  listCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  // Turneringens mellomtittel i kamplisten — myk gulflate, som pillen.
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.sun,
  },
  tournamentTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.goldInk,
    flexShrink: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  matchInfo: {
    flex: 1,
    gap: 2,
  },
  matchTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  matchMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // Lagkassa-kortet — hero-flaten som lys kontrast på stadionmørket.
  lagkassaPressed: {
    opacity: 0.93,
  },
  lagkassaCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    gap: 2,
  },
  lagkassaPill: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heiaDeep,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  lagkassaAmount: {
    fontSize: 30,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  lagkassaEmpty: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
  lagkassaCaption: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
