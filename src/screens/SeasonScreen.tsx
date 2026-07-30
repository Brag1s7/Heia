import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, ScoreChip, StadiumSurface, StatusPill} from '../components';
import {Plus, Trophy} from '../components/icons';
import {useActiveTeam} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {
  getSeasonStats,
  type SeasonMatch,
  type SeasonStats,
  type SeasonView,
} from '../lib/api/stats';
import type {HomeStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Season'>;

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
      rows.push({kind: 'tournament', title: match.tournament, key: `t${index}`});
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
export function SeasonScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();
  const isAdmin = isTeamAdmin(activeRole);

  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = «serverens valg» (inneværende halvår). Settes av velgeren.
  const [selected, setSelected] = useState<SeasonView | null>(null);

  const loadStats = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

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
      <BackBar />
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
          <Text style={styles.title}>Sesongen</Text>
          {activeTeamSpace ? (
            <Text style={styles.subtitle}>{activeTeamSpace.displayName}</Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.heia} />
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
                    <Plus
                      size={14}
                      color={colors.heiaInk}
                      strokeWidth={2.4}
                    />
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
                      <Trophy
                        size={14}
                        color={colors.gold}
                        strokeWidth={2.2}
                      />
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
                              <Text
                                style={styles.matchTitle}
                                numberOfLines={1}>
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
          </>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  loader: {
    marginTop: spacing.xl,
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
});
