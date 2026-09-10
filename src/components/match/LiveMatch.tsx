import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Animated, ScrollView, StatusBar, StyleSheet, View} from 'react-native';
import {useBottomContentPadding} from '../useBottomContentPadding';
import {useIsFocused} from '@react-navigation/native';
import {spacing} from '../../theme';
import type {ReporterActionType} from '../ReporterActions';
import {StadiumSurface} from '../StadiumSurface';
import {useGoalMoment} from '../useGoalMoment';
import {MatchArena} from './MatchArena';
import {
  MatchChromeOverlay,
  MATCH_TABS_SLOT_H,
  useHeldMatchData,
  useMatchChrome,
} from './MatchChrome';
import {MatchGround} from './MatchGround';
import {MatchTopBar, useMatchTopBar} from './MatchTopBar';
import {
  lastEventLabel,
  MatchEventsView,
  MatchInfoView,
  MatchPhotosView,
  MatchReferat,
} from './MatchViews';
import type {MatchViewKey} from './MatchViewTabs';
import {ReporterDock, REPORTER_DOCK_HEIGHT} from './ReporterDock';
import {MatchToast} from './MatchToast';
import type {MatchPhoto} from '../../lib/api/feed';
import type {MatchEngagement} from '../../shared/matchEngagement';
import type {HeiaEventDetail, MatchEvent, User} from '../../shared/types';

/**
 * KAMPEN, LIVE — hele skjermen, fra statuslinje til tab-bar.
 *
 * ---------------------------------------------------------------------------
 * RUNDE 2 (2026-09-07): DAGSLYS, SCOREKORT, FASTE FANER
 *
 * Rekkefølgen er: samlet scorekort → visningsfaner → innholdet i valgt
 * visning (Referat nyeste først). Når scorekortet ruller ut, blir toppbaren
 * den kompakte scorelinja og fanene fester seg under den (`MatchTopBar`,
 * `MatchChrome`). Reporterraden, pulsen og det mørke kampforløpet er borte
 * fra denne flaten: reporteren bor i Info (og i dokken), hendelsene i
 * Hendelser.
 *
 * Det som IKKE flyttet: state, handlere, realtime, query-cachen og
 * modalene. De hører til `EventDetailScreen` (B2). Denne komponenten er
 * FLATEN, og tar alt den viser som props.
 *
 * ---------------------------------------------------------------------------
 * NYE HENDELSER FLYTTER IKKE TEKSTEN
 *
 * Har brukeren scrollet forbi fanenes festepunkt, holdes nye rader tilbake
 * (`useHeldMatchData`) og «1 ny hendelse» vises under fanene. Stillingen og
 * kampstatusen kommer fra `event.score`/`matchStatus` og oppdateres alltid.
 */

interface LiveMatchProps {
  event: HeiaEventDetail;
  /** Vårt lags visningsnavn. */
  teamName: string;
  /** Lagets farge — scorekortets lys og målfloden. */
  teamColor: string;
  /**
   * Kampminuttet NÅ, regnet ut ÉN gang av skjermen.
   *
   * ⚠️ Alt som viser kampminuttet arver denne. Ingen komponent under her
   * kaller `Date.now()`.
   */
  minute?: number;
  /** Klokkeslettet NÅ, fra SAMME tick som `minute` (P2). Ferskheten
   * («Siste hendelse for 3 min») regnes mot denne. */
  nowMs?: number;
  reporter?: User;
  isAdmin: boolean;
  isReporter: boolean;
  /**
   * Kampens hendelser. Kommer som prop med STABIL REFERANSE fra skjermen
   * (`NO_MATCH_EVENTS`), ikke som `event.matchEvents ?? []`.
   */
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  authorFor: (userId: string) => User | undefined;
  /** HEIA + kommentarer per øyeblikk (skive 4), som oppslag. */
  engagement: {
    byMatchEvent: Map<string, MatchEngagement>;
    byPost: Map<string, MatchEngagement>;
  };
  /** HEIA + kommentarer per øyeblikk — skjermen eier handlerne. */
  renderEngagement?: (entry: {
    event?: MatchEvent;
    photo?: MatchPhoto;
  }) => React.ReactNode;
  onChangeReporter: () => void;
  onReporterAction: (type: ReporterActionType) => void;
  onPickPhoto: () => void;
  onPressPhoto: (photo: MatchPhoto) => void;
  /** Reporterdokken er åpen (skive 10). Styres av RAPPORTER-knappen. */
  reporterDockOpen?: boolean;
  onCloseReporterDock?: () => void;
  /** Kvitteringen på reporterens EGEN handling. `null` = ingenting. */
  toast?: string | null;
  onToastHidden?: () => void;
}

export function LiveMatch({
  event,
  matchEvents,
  teamName,
  teamColor,
  minute,
  nowMs,
  reporter,
  isAdmin,
  isReporter,
  photos,
  authorFor,
  engagement: _engagement,
  renderEngagement,
  onChangeReporter,
  onReporterAction,
  onPickPhoto,
  onPressPhoto,
  reporterDockOpen = false,
  onCloseReporterDock,
  toast = null,
  onToastHidden,
}: LiveMatchProps) {
  // Kapselen ligger over innholdet: barhøyde + pust, safe area telles én
  // gang (inne i barhøyden). Se `useBottomContentPadding`.
  const bottomPad = useBottomContentPadding(spacing['3xl']);
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const [view, setView] = useState<MatchViewKey>('referat');

  const paused = event.matchStatus === 'halfTime';
  const home = event.score?.home ?? 0;
  const away = event.score?.away ?? 0;

  // Toppflaten som blir scorelinja når kortet ruller ut, og fanene som
  // fester seg under den. Begge drives av samme scrollY på native driver.
  const topBar = useMatchTopBar();
  const chrome = useMatchChrome(topBar.scrollY);

  // Lista holdes mens brukeren leser — se MatchChrome.
  const live = useMemo(() => ({matchEvents, photos}), [matchEvents, photos]);
  const held = useHeldMatchData(live, chrome.reading);

  const flushAndTop = useCallback(() => {
    held.flush();
    scrollRef.current?.scrollTo({y: 0, animated: true});
  }, [held]);

  // Omgangen leses av forløpet, ikke av klokka — den eneste sanne kilden
  // til kampuret blir serverautoritativt (P2).
  const secondHalf = useMemo(
    () => matchEvents.some(e => e.type === 'andre_omgang'),
    [matchEvents],
  );

  const freshness = useMemo(
    () => lastEventLabel(matchEvents, nowMs) ?? 'Ingen hendelser ennå',
    [matchEvents, nowMs],
  );

  // ÉN kilde til måløyeblikket: spretten på tallet og floden over verdenen.
  const {scoreScale, celebrate} = useGoalMoment(home, away);

  /**
   * ⚠️ KONSTANT PADDING. Plassen for dokken RESERVERES permanent for
   * reporteren — en innholdshøyde som endrer seg i det dokken animerer
   * gjorde dokken hakkete (Brage 2026-08-21). Memoisert av samme grunn.
   */
  const scrollPad = useMemo(
    () => ({
      paddingBottom: bottomPad + (isReporter ? REPORTER_DOCK_HEIGHT : 0),
    }),
    [bottomPad, isReporter],
  );

  const opponent = event.opponent ?? '';

  return (
    <MatchGround
      teamColor={teamColor}
      phase={paused ? 'paused' : 'live'}
      celebrate={celebrate}>
      {/* Lys grunn → mørk statuslinje. Fokusvakt som i ProfileHeader. */}
      {isFocused && <StatusBar barStyle="dark-content" />}

      <MatchTopBar
        progress={topBar.progress}
        shown={topBar.shown}
        homeTeam={teamName}
        awayTeam={opponent}
        homeScore={home}
        awayScore={away}
        phase={paused ? 'paused' : 'live'}
        minute={minute}
        secondHalf={secondHalf}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={scrollPad}
        onScroll={topBar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        {/* ⚠️ SCOREKORTET MÅLER SEG SELV: krysstoningens bånd legges der
            stillingen forlater toppen, og høyden varierer med stablet
            layout og tekststørrelse. */}
        <View onLayout={topBar.onArenaLayout} style={styles.scoreWrap}>
          {/* ⚠️ MÅLSKIVA ER DEN TETTESTE KAMPFLATEN (Brage 2026-09-10).
              Den var `score`-glass — gjennomskinnelig, og på kampens LYSE
              grunn mister et gjennomskinnelig kort vekt. Nå den samme tette
              materialretningen som kampkortene i Kalender/Sesongen: Heia-grønn
              base (#0B1912→#143126, aldri nøytralt svart), flomlys og
              banebuer — men buene i `quiet`, så de ligger I flaten og ikke
              oppå den. Stillingen, kampstatusen og minuttet står i
              Heia-neon. Kommende kamp beholder StadiumGlass. */}
          <StadiumSurface style={styles.scoreCard} arcTone="quiet">
            <MatchArena
              homeTeam={teamName}
              awayTeam={opponent}
              homeScore={home}
              awayScore={away}
              teamColor={teamColor}
              phase={paused ? 'paused' : 'live'}
              minute={minute}
              secondHalf={secondHalf}
              reporterName={reporter?.name}
              lastEventLabel={freshness}
              scoreScale={scoreScale}
            />
          </StadiumSurface>
        </View>

        {/* Fanenes plassholder — de ekte fanene er chrome (MatchChrome). */}
        <View onLayout={chrome.onTabsLayout} style={styles.tabsSlot} />

        {view === 'referat' && (
          <MatchReferat
            matchEvents={held.matchEvents}
            photos={held.photos}
            startedAt={event.startedAt}
            teamName={teamName}
            opponent={opponent}
            authorFor={authorFor}
            renderEngagement={renderEngagement}
            onPressPhoto={onPressPhoto}
            newestFirst
          />
        )}
        {view === 'hendelser' && (
          <MatchEventsView
            matchEvents={held.matchEvents}
            teamName={teamName}
            opponent={opponent}
            newestFirst
          />
        )}
        {view === 'bilder' && (
          <MatchPhotosView photos={held.photos} onPressPhoto={onPressPhoto} />
        )}
        {view === 'info' && (
          <MatchInfoView
            event={event}
            reporter={reporter}
            isAdmin={isAdmin}
            isReporter={isReporter}
            onChangeReporter={onChangeReporter}
          />
        )}
      </Animated.ScrollView>

      <MatchChromeOverlay
        chrome={chrome}
        view={view}
        onChangeView={setView}
        pending={held.pending}
        onFlush={flushAndTop}
      />

      {/* Reporterens verktøy, over grunnen og rett under tab-baren. */}
      {isReporter && (
        <ReporterDock
          open={reporterDockOpen}
          onAction={onReporterAction}
          isPaused={paused}
          onPhoto={onPickPhoto}
          onClose={onCloseReporterDock ?? noop}
        />
      )}

      <MatchToast message={toast} onHidden={onToastHidden ?? noop} />
    </MatchGround>
  );
}

/** Stabil identitet: en fersk pilfunksjon per render ville revet memoene. */
const noop = () => {};

const styles = StyleSheet.create({
  scoreWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  scoreCard: {
    // Samme radius som glasset hadde — kortets form er telefongodkjent.
    borderRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  tabsSlot: {
    height: MATCH_TABS_SLOT_H,
    marginTop: spacing.sm,
  },
});
