import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useScrollToTop,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  fonts,
  matchColors,
} from '../theme';
import {
  DaylightGround,
  DAYLIGHT_GROUND_AB,
  DAYLIGHT_GROUND_FALLBACK,
  EventCard,
  GLASS,
  LiquidGlassSurface,
  ListRowSkeleton,
  LiveMatchBanner,
  ScoreChip,
  SectionHeader,
  Skeleton,
  StatusPill,
  TeamHeader,
  useBottomContentPadding,
} from '../components';
// ⚠️ DIREKTE, ikke fra barrelen: `OPAL` leses i `StyleSheet.create`, altså
// ved MODUL-LASTING, og tester som mocker hele `../components` ville da
// fått `undefined.inkSecondary`.
import {OPAL} from '../components/OpalSurface';
import {ChevronRight, Plus, Trophy} from '../components/icons';
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
import {prefetchTournaments} from '../lib/queries/tournaments';
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
  | {kind: 'month'; label: string; key: string}
  | {kind: 'tournament'; title: string; key: string}
  | {kind: 'match'; match: SeasonMatch; key: string};

/**
 * MÅNED, IKKE UKE (Brage 2026-09-10: «legg til måned inndeling her»).
 *
 * Et halvår har typisk 8–20 spilte kamper. Uke ville gitt mest tomme
 * overskrifter med én kamp under; måned gir 3–6 bolker som leser som
 * sesongens gang. Måneden er den YTRE bolken: en turnering som krysser et
 * månedsskille får overskriften sin i begge månedene, fordi den faktisk
 * spilte kamper i begge.
 *
 * Turneringsvisningen deles ikke opp — der er alle kampene samme helg.
 */
function buildRows(matches: SeasonMatch[], grouped: boolean): SeasonRow[] {
  const rows: SeasonRow[] = [];
  let prevTournament: string | undefined;
  let prevMonth: number | undefined;
  matches.forEach((match, index) => {
    if (grouped) {
      const month = match.startTime.getMonth();
      if (month !== prevMonth) {
        rows.push({
          kind: 'month',
          label: MONTHS[month],
          key: `m${index}`,
        });
        prevMonth = month;
        // Ny måned ⇒ turneringens overskrift skal stå igjen under den.
        prevTournament = undefined;
      }
      if (match.tournament && match.tournament !== prevTournament) {
        rows.push({
          kind: 'tournament',
          title: match.tournament,
          key: `t${index}`,
        });
      }
      prevTournament = match.tournament;
    }
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
 * liste.
 *
 * ---------------------------------------------------------------------------
 * MATERIALET (Brage 2026-09-09: «samme bakgrunn som resten av appen og glass
 * der det passer, så det er samme språk»):
 *
 *   grunn     `DaylightGround` i masthead-modus + `TeamHeader`, nøyaktig som
 *             Hjem, Kalender og Varsler. Sesongen er KUN fanerot (2026-09-09:
 *             «Sesongen»-chippen på Hjem er fjernet) — ett utseende.
 *   tallene   kampdata bor i kampens mørke glass (designregelen «mørkt glass
 *             = kamp»): `LiquidGlassSurface variant="score"`, samme flate som
 *             scorekortet på kampsiden. Blekket er kampens (`matchColors`).
 *   lagkassa  `important`-glasset (feedens varme perle for det som er
 *             viktig) — og den står ØVERST, rett under tittelen (Brage
 *             2026-09-09: «lagkasse havner på bunnen … den er viktig
 *             ettersom den viser hvor mye laget har fått inn»). Kompakt
 *             stripe: beløpet er det store tallet, resten er bitekst.
 *   listene   `sheet`-glass (arkets tunge perle) for kamplista, velgeren og
 *             tomtilstandene, med OPAL-blekk og innfelt hårlinje mellom
 *             radene — som Varsler-arket og Profils undersider.
 *   chipene   velgeren er små trykkflater i rekke; ett native glass per chip
 *             er for dyrt. De er tegnet i arkets tint med materialets kant,
 *             valgt = appens hovedpar (mint på heiaDeep).
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
          {/* ⚠️ `today`, IKKE `featured`: korallkanten betyr LIVE. */}
          <EventCard
            event={match}
            today
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
        <LiquidGlassSurface
          variant="sheet"
          cornerRadius={radius.xl}
          wrapStyle={styles.programmeEmpty}
          style={styles.programmeEmptyInner}>
          <Text style={styles.programmeEmptyText}>
            Ingen kamper er satt opp ennå.
          </Text>
        </LiquidGlassSurface>
      )}
    </View>
  );
}

/**
 * LAGKASSA-STRIPEN — øverst på flaten, rett under tittelen.
 *
 * Den er et tall folk kommer for («hvor mye laget har fått inn»), så den
 * står FØR kampprogrammet, ikke etter arkivet. Kompakt så dagens kamp
 * fortsatt er synlig uten å bla (Brage 2026-08: «dagens kamp tydelig
 * prioritert»): én rad, beløpet som eneste store tall, chevron som lover
 * en side bak.
 */
function LagkassaStrip({
  supporters,
  monthlyToClubMinor,
  onPress,
}: {
  supporters: number;
  monthlyToClubMinor: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Åpne lagkassa"
      style={styles.lagkassaWrap}>
      {({pressed}) => (
        <LiquidGlassSurface
          variant="important"
          cornerRadius={radius.xl}
          pressed={pressed}
          style={styles.lagkassa}>
          <View style={styles.lagkassaText}>
            <Text style={styles.lagkassaPill}>💚 LAGKASSA</Text>
            {supporters > 0 ? (
              <>
                <Text style={styles.lagkassaAmount} maxFontSizeMultiplier={1.3}>
                  {formatKr(monthlyToClubMinor)}
                </Text>
                <Text style={styles.lagkassaCaption}>
                  til laget hver måned ·{' '}
                  {supporters === 1
                    ? '1 støttespiller'
                    : `${supporters} støttespillere`}
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
          </View>
          <ChevronRight size={20} color={colors.heiaDeep} strokeWidth={2.4} />
        </LiquidGlassSurface>
      )}
    </Pressable>
  );
}

export function SeasonScreen() {
  const bottomPad = useBottomContentPadding();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeRole} = useActiveTeam();
  const isAdmin = isTeamAdmin(activeRole);

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

  // Varm «Turnering»-feltets liste FØR treneren trykker «Ny kamp», så arket
  // står komplett fra første ramme (se lib/queries/tournaments).
  useEffect(() => {
    if (isAdmin) prefetchTournaments(activeTeamSpaceId);
  }, [isAdmin, activeTeamSpaceId]);

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
      {/* ⚠️ SESONGEN ER FANEROT, OG BARE DET. Ingen tilbakelinje: `goBack()`
          ville bobla opp til fanenavigatoren og kastet deg til Hjem (Brage
          2026-08-21: «som ikke skal være mulig»). Den pushede varianten
          (fra «Sesongen»-chippen på Hjem) er fjernet 2026-09-09 — den var
          årsaken til to utseender og til header-hoppet i runde 2.
          Laghodet setter statuslinja selv. */}
      {DAYLIGHT_GROUND_AB && <DaylightGround masthead />}
      <TeamHeader />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{paddingBottom: bottomPad}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>
        {/* Tittelen står i reisens mørke topp rett under laghodet —
            stadionblekk, som Kalender-chromen. Laghodet sier alt lagnavnet. */}
        <View style={styles.header}>
          <Text style={styles.title}>Sesongen</Text>
        </View>

        {/* TRENERENS HANDLINGER — én rad rett under tittelen, begge synlige
            uten å bla og uten å rulle (Brage 2026-09-09 om «Ny turnering»
            sist i chip-raden og så fast til høyre: «altfor dårlig
            plassering»). Hierarkiet ligger i materialet, ikke i plassen:
            «Ny kamp» er hovedhandlingen (mint på heiaDeep — ⚠️ EN EKTE KNAPP,
            Brage: «må det være en bedre knapp for å legge til ny kamp!»),
            «Ny turnering» er sekundær i chrome-glass med stadionblekk. */}
        {isAdmin && (
          <View style={styles.actions}>
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
            <Pressable
              onPress={() =>
                navigation.navigate('NewEvent', {presetType: 'turnering'})
              }
              accessibilityRole="button"
              accessibilityLabel="Ny turnering"
              hitSlop={8}
              style={({pressed}) => [
                styles.newTournament,
                pressed && styles.newTournamentPressed,
              ]}>
              <Plus size={16} color={TOURNAMENT_INK} strokeWidth={2.6} />
              <Text style={styles.newTournamentText}>Ny turnering</Text>
            </Pressable>
          </View>
        )}

        {/* Lagkassa — den permanente inngangen, og den står ØVERST (Brage
            2026-09-09). Vises for alle medlemmer; feiler oppslaget, er data
            undefined og stripen skjules — samme oppførsel som før. */}
        {supportSummary && (
          <LagkassaStrip
            supporters={supportSummary.supporters}
            monthlyToClubMinor={supportSummary.monthlyToClubMinor}
            onPress={() => navigation.navigate('Lagkassa')}
          />
        )}

        {/* ⚠️ PROGRAMMET LIGGER OVER SESONGTALLENE (skive 10.1). Fra skive
            10 fører kampknappen hit, og da er det DAGENS kamp man leter
            etter — ikke fjorårets målforskjell. Brage etter telefontesten:
            «dagens kamp tydelig prioritert». Lagkassa-stripen over er
            kompakt av samme grunn. Arkivet under er uendret; det er to
            ulike spørsmål på samme flate. */}
        <MatchProgramme
          matches={schedule}
          loaded={scheduleLoaded}
          canCreate={isAdmin}
          onOpenMatch={id => navigation.navigate('EventDetail', {eventId: id})}
        />

        {loading ? (
          <>
            {/* Tallene bor i det mørke glasset også som skeleton — flatebyttet
                lys/mørk skal ikke blinke inn etter lastingen. */}
            <LiquidGlassSurface
              variant="score"
              cornerRadius={SCORE_RADIUS}
              wrapStyle={styles.heroWrap}
              style={styles.hero}>
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
            </LiquidGlassSurface>
            <View style={styles.sectionSkeleton}>
              <Skeleton width={80} height={11} />
            </View>
            <LiquidGlassSurface
              variant="sheet"
              cornerRadius={radius.xl}
              wrapStyle={styles.listWrap}
              style={styles.listCard}>
              <ListRowSkeleton />
              <ListRowSkeleton />
              <ListRowSkeleton showBorder={false} />
            </LiquidGlassSurface>
          </>
        ) : error || !stats ? (
          <LiquidGlassSurface
            variant="sheet"
            cornerRadius={radius.xl}
            wrapStyle={styles.emptyWrap}
            style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {error ?? 'Kunne ikke laste sesongen.'}
            </Text>
          </LiquidGlassSurface>
        ) : (
          <>
            {/* Velgeren: sesonger og turneringer om hverandre. «Ny turnering»
                bor IKKE her lenger — den står i handlingsraden under tittelen
                (to plasseringer i raden ble avvist 2026-09-09). */}
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
                        color={isActive ? colors.heiaDeep : colors.goldInk}
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
              </ScrollView>
            )}

            {isBrandNew ? (
              <LiquidGlassSurface
                variant="sheet"
                cornerRadius={radius.xl}
                wrapStyle={styles.emptyWrap}
                style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Sesongen starter her</Text>
                <Text style={styles.emptyText}>
                  Når lagets første kamp er ferdigspilt, samles resultater og
                  kamprapporter på denne siden — sesong for sesong.
                </Text>
              </LiquidGlassSurface>
            ) : (
              <>
                {/* Tallene — kampdata bor i kampens mørke glass */}
                <LiquidGlassSurface
                  variant="score"
                  cornerRadius={SCORE_RADIUS}
                  wrapStyle={styles.heroWrap}
                  style={styles.hero}>
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
                </LiquidGlassSurface>

                {/* Kampene — hver rad åpner kamprapporten */}
                {stats.played === 0 ? (
                  <LiquidGlassSurface
                    variant="sheet"
                    cornerRadius={radius.xl}
                    wrapStyle={[styles.emptyWrap, styles.emptyCardBelow]}
                    style={styles.emptyCard}>
                    <Text style={styles.emptyText}>{emptyInViewText}</Text>
                  </LiquidGlassSurface>
                ) : (
                  <>
                    <SectionHeader title="Kampene" />
                    {/* `unbounded`: lista vokser med sesongen (og med
                        turneringene i den) — samme grunn som Varsler. */}
                    <LiquidGlassSurface
                      variant="sheet"
                      cornerRadius={radius.xl}
                      unbounded
                      wrapStyle={styles.listWrap}
                      style={styles.listCard}>
                      {rows.map((row, index) =>
                        row.kind === 'month' ? (
                          <View
                            key={row.key}
                            style={[
                              styles.monthRow,
                              index > 0 && styles.rowBorder,
                            ]}>
                            <Text style={styles.monthLabel}>{row.label}</Text>
                          </View>
                        ) : row.kind === 'tournament' ? (
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
                    </LiquidGlassSurface>
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

/** Samme radius som scorekortet på kampsiden — det ER samme flate. */
const SCORE_RADIUS = 28;

/** Sekundærknappens blekk i reisens mørke topp. */
const TOURNAMENT_INK = DAYLIGHT_GROUND_AB ? colors.stadiumText : colors.heiaInk;

const styles = StyleSheet.create({
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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  programmeEmptyInner: {
    padding: spacing.lg,
  },
  programmeEmptyText: {
    ...typography.bodySmall,
    color: OPAL.inkSecondary,
  },
  // Grunnen ligger absolutt over denne; fallbacken er grunnens dominante
  // mint (samme som navigatorens kort bak skjermen), så ingenting blinker
  // krem i kantene under push/pop — som ProfilPage.
  screen: {
    flex: 1,
    backgroundColor: DAYLIGHT_GROUND_AB
      ? DAYLIGHT_GROUND_FALLBACK
      : colors.background,
  },
  // Toppen (statuslinja) bæres av laghodet eller tilbakelinja — tittelen
  // trenger bare sitt eget pust under dem.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  // Stadionblekk: tittelen står i reisens mørke topp.
  title: {
    ...typography.heading1,
    color: DAYLIGHT_GROUND_AB ? colors.stadiumText : colors.textPrimary,
  },
  stadiumBone: {
    backgroundColor: colors.stadiumEdge,
  },
  emptyWrap: {
    marginHorizontal: spacing.lg,
  },
  emptyCard: {
    padding: spacing.xl,
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
    color: OPAL.inkSecondary,
    textAlign: 'center',
  },
  // Velgeren: arkets tint + materialets kant på hver chip, valgt = appens
  // hovedpar. Ingen native glass per chip (se toppkommentaren).
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
    borderColor: GLASS.unboundedEdge,
    backgroundColor: GLASS.sheet.tint,
    maxWidth: 220,
  },
  pickerChipActive: {
    backgroundColor: colors.heia,
    borderColor: colors.heia,
  },
  pickerChipPressed: {
    opacity: 0.7,
  },
  pickerChipText: {
    ...typography.body,
    color: OPAL.inkSecondary,
  },
  pickerChipTextActive: {
    color: colors.heiaDeep,
    fontWeight: '700',
  },
  // Handlingsraden under tittelen. Sekundærknappen er chrome-glass (tab-
  // barens perle + materialets kant) med stadionblekk: den står i reisens
  // mørke topp, ved siden av den mint hovedknappen.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  newTournament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: GLASS.unboundedEdge,
    backgroundColor: GLASS.bar.tint,
  },
  newTournamentPressed: {
    opacity: 0.7,
  },
  newTournamentText: {
    ...typography.action,
    color: TOURNAMENT_INK,
  },
  heroWrap: {
    marginHorizontal: spacing.lg,
  },
  hero: {
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
    color: matchColors.dim,
    flexShrink: 1,
  },
  kpiRow: {
    flexDirection: 'row',
  },
  kpi: {
    flex: 1,
    gap: 2,
  },
  // Mint tall på kampens mørke glass — samme par som scorekortet. Dempet
  // blekk er kampens (`matchColors.dim`), ikke `stadiumDim` (felle 2 i
  // tokens: den faller til 3,7:1 på arenaflaten).
  kpiValue: {
    ...typography.scoreLarge,
    color: colors.heia,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
  heroMeta: {
    ...typography.bodySmall,
    color: matchColors.dim,
  },
  sectionSkeleton: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
  },
  listWrap: {
    marginHorizontal: spacing.lg,
  },
  listCard: {
    overflow: 'hidden',
  },
  // Rader i materialet: innfelt blekk-hårlinje og blekk-tint ved trykk —
  // aldri en lys flate oppå glass (OPAL-regelen, delt med Varsler).
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OPAL.hairline,
  },
  rowPressed: {
    backgroundColor: OPAL.rowPressed,
  },
  // Månedens mellomtittel: ren etikett i materialet, ingen egen flate —
  // måneden er en bolk, ikke et objekt (turneringen er et objekt, og får
  // derfor gulflaten under).
  monthRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: OPAL.inkTertiary,
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
    color: OPAL.inkSecondary,
  },
  // Lagkassa-stripen — viktig-glasset, øverst. Beløpet er det store tallet.
  lagkassaWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  lagkassa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.xl,
    paddingRight: spacing.lg,
  },
  lagkassaText: {
    flex: 1,
    gap: 2,
  },
  lagkassaPill: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.goldInk,
    marginBottom: 2,
  },
  lagkassaAmount: {
    fontSize: 28,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
    includeFontPadding: false,
  },
  lagkassaEmpty: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
  lagkassaCaption: {
    ...typography.bodySmall,
    color: OPAL.inkSecondary,
  },
});
