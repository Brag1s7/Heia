import React, {useState} from 'react';
import {Animated, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useBottomContentPadding} from '../useBottomContentPadding';
import {useIsFocused} from '@react-navigation/native';
import {colors, spacing} from '../../theme';
import {StadiumSurface} from '../StadiumSurface';
import {MatchArena} from './MatchArena';
import {
  MatchChromeOverlay,
  MATCH_TABS_SLOT_H,
  useMatchChrome,
} from './MatchChrome';
import {MatchGround} from './MatchGround';
import {MatchTopBar, useMatchTopBar} from './MatchTopBar';
import {
  kickoffLabel,
  MatchEventsView,
  MatchInfoView,
  MatchPhotosView,
  MatchReferat,
} from './MatchViews';
import type {MatchViewKey} from './MatchViewTabs';
import type {MatchPhoto} from '../../lib/api/feed';
import type {MatchEngagement} from '../../shared/matchEngagement';
import type {HeiaEventDetail, MatchEvent, User} from '../../shared/types';

/**
 * KAMPEN, FERDIG — rapporten. Samme skall som live (scorekort → faner →
 * visning), men kronologisk: kampen leses forfra, fra avspark til slutt.
 * Ingen «nyeste»-holding — ingenting nytt kommer.
 *
 * Bildene bor i Bilder, påmeldte og «Rediger» i Info. Kampens egen tittel
 * og beskrivelse (når treneren har skrevet en) står under scorekortet.
 */

interface FinishedMatchProps {
  event: HeiaEventDetail;
  teamName: string;
  teamColor: string;
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  reporter?: User;
  isAdmin: boolean;
  authorFor: (userId: string) => User | undefined;
  engagement: {
    byMatchEvent: Map<string, MatchEngagement>;
    byPost: Map<string, MatchEngagement>;
  };
  renderEngagement?: (entry: {
    event?: MatchEvent;
    photo?: MatchPhoto;
  }) => React.ReactNode;
  onPressPhoto: (photo: MatchPhoto) => void;
  onEdit: () => void;
}

export function FinishedMatch({
  event,
  teamName,
  teamColor,
  matchEvents,
  photos,
  reporter,
  isAdmin,
  authorFor,
  engagement: _engagement,
  renderEngagement,
  onPressPhoto,
  onEdit,
}: FinishedMatchProps) {
  const bottomPad = useBottomContentPadding();
  const isFocused = useIsFocused();
  const [view, setView] = useState<MatchViewKey>('referat');

  const home = event.score?.home ?? 0;
  const away = event.score?.away ?? 0;

  const topBar = useMatchTopBar();
  const chrome = useMatchChrome(topBar.scrollY);

  const ownTitle =
    event.title && event.title !== `Kamp mot ${event.opponent}`
      ? event.title
      : undefined;
  const opponent = event.opponent ?? '';

  return (
    <MatchGround teamColor={teamColor} phase="finished">
      {isFocused && <StatusBar barStyle="dark-content" />}

      <MatchTopBar
        progress={topBar.progress}
        shown={topBar.shown}
        homeTeam={teamName}
        awayTeam={opponent}
        homeScore={home}
        awayScore={away}
        phase="finished"
      />

      <Animated.ScrollView
        contentContainerStyle={{paddingBottom: bottomPad}}
        onScroll={topBar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
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
              phase="finished"
              dateLabel={kickoffLabel(event.startTime)}
              reporterName={reporter?.name}
            />
          </StadiumSurface>
        </View>

        {ownTitle && (
          <Text
            style={styles.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.6}>
            {ownTitle}
          </Text>
        )}

        <View onLayout={chrome.onTabsLayout} style={styles.tabsSlot} />

        {view === 'referat' && (
          <MatchReferat
            matchEvents={matchEvents}
            photos={photos}
            startedAt={event.startedAt}
            teamName={teamName}
            opponent={opponent}
            authorFor={authorFor}
            renderEngagement={renderEngagement}
            onPressPhoto={onPressPhoto}
          />
        )}
        {view === 'hendelser' && (
          <MatchEventsView
            matchEvents={matchEvents}
            teamName={teamName}
            opponent={opponent}
          />
        )}
        {view === 'bilder' && (
          <MatchPhotosView photos={photos} onPressPhoto={onPressPhoto} />
        )}
        {view === 'info' && (
          <MatchInfoView
            event={event}
            reporter={reporter}
            isAdmin={isAdmin}
            onEdit={onEdit}
          />
        )}
      </Animated.ScrollView>

      <MatchChromeOverlay
        chrome={chrome}
        view={view}
        onChangeView={setView}
        pending={0}
        onFlush={noop}
      />
    </MatchGround>
  );
}

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
  title: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    color: colors.textPrimary,
  },
  tabsSlot: {
    height: MATCH_TABS_SLOT_H,
    marginTop: spacing.sm,
  },
});
