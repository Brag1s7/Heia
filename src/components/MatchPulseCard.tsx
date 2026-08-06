import React, {useEffect, useRef} from 'react';
import {View, Text, Pressable, StyleSheet, Animated, Easing} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import {StadiumSurface} from './StadiumSurface';
import {GOAL_CELEBRATION_TINT} from './useGoalMoment';
import {matchEventLine} from '../shared/matchCopy';
import type {HeiaNotification} from '../lib/api/notifications';

// ---------------------------------------------------------------------------
// MatchPulseCard — ÉN kamp, tre tilstander.
//
// Rollefordelingen (Brage 2026-08-05): Hjem er den redaksjonelle oversikten,
// Kalender den kronologiske fasiten, Varsler endringsloggen med følelser.
// Derfor er dette IKKE `LiveMatchBanner` på nytt: ingen laglogoer, ingen
// «Følg kampen»-knapp, ingen lagoppstilling. Kortet svarer på ett spørsmål —
// «hva har skjedd i kampen siden sist?» — og sender deg til den EKSISTERENDE
// kampen ved trykk.
//
// Alle varsler fra samme kamp deler `match.sessionId` (00051) og samles her,
// så kampen beveger seg gjennom tilstandene i stedet for å bli tre kort:
//
//   'goal'   nyeste ULESTE er vårt mål   → utvidet, stor score, sprett
//   'live'   kampen pågår                → kompakt stripe, ~1/4 av Hjem-kortet
//   'result' kampen er ferdig            → resultat, varmt formulert
//
// Stadionflaten brukes SELEKTIVT: kun her. Vanlige påminnelser og praktiske
// endringer bor i rolige rader.
// ---------------------------------------------------------------------------

export type MatchPulseVariant = 'goal' | 'live' | 'result';

interface MatchPulseCardProps {
  /** Varslene fra ÉN kamp, nyeste først. */
  items: HeiaNotification[];
  teamName: string;
  /** Kampen pågår nå (fra `getLiveMatch`) — avgjør live- vs. resultattilstand. */
  isLive?: boolean;
  paused?: boolean;
  /**
   * Kampens NÅVÆRENDE minutt, regnet fra `started_at`. Et varsel bærer
   * minuttet hendelsen skjedde i — det er noe annet, og en live-stripe som
   * står på «28′» mens kampen er på 41 er feil.
   */
  liveMinute?: number | null;
  onPress: () => void;
}

/** Kampens språk bor i `shared/matchCopy` — samme tekst i kort og rad. */
function eventLine(n: HeiaNotification, teamName: string): string {
  return matchEventLine(n.match, n.body, teamName);
}

/** «SEIER!» / «UAVGJORT» / «FULL TID» — varmt også når det gikk galt. */
function resultHeadline(home: number, away: number): string {
  if (home > away) return 'SEIER!';
  if (home === away) return 'UAVGJORT';
  return 'FULL TID';
}

export function MatchPulseCard({
  items,
  teamName,
  isLive = false,
  paused = false,
  liveMinute = null,
  onPress,
}: MatchPulseCardProps) {
  const newest = items[0];
  const match = newest?.match;

  // Sprett + feiringsvask. Fyrer på MONTERING for et nytt mål (varselet er
  // «nytt» første gang du ser det) og igjen hvis stillingen endrer seg mens
  // du står på skjermen — liveNonce i InboxScreen refetcher da.
  const pop = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const unread = items.filter(i => i.readAt === null).length;

  // STØRRELSEN styres av om det finnes noe NYTT — ikke av hvem som scoret.
  // Første versjon utvidet kortet kun ved VÅRT mål, så kortet klappet sammen
  // i det motstanderen scoret eller det ble pause, og tidslinja forsvant
  // akkurat når det var mest å fortelle. Regelen er nå Brages (2026-08-06):
  // utvidet når noe er ulest, kompakt når alt er lest.
  const expanded = unread > 0;

  // TONEN er noe annet enn størrelsen: bare VÅRT mål feires (MÅÅÅL! + sprett
  // + mint-vask). Motstanderens mål er informasjon, ikke feiring — det får
  // samme plass, men ingen jubel.
  const isOurGoal =
    match?.eventType === 'mål' &&
    match.teamSide === 'home' &&
    newest?.readAt === null;

  const variant: MatchPulseVariant = !expanded
    ? 'live'
    : isOurGoal
    ? 'goal'
    : isLive
    ? 'live'
    : 'result';

  // Kompakt = live-stripa. Den brukes nå både for en pågående kamp uten nytt
  // OG for en ferdigspilt kamp som er lest — begge er «bare til orientering».
  const compact = !expanded;

  const score = match ? `${match.homeScore}–${match.awayScore}` : null;

  useEffect(() => {
    if (!isOurGoal || compact) {
      return;
    }
    pop.setValue(1);
    glow.setValue(0);
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.3,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.timing(glow, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(60),
      Animated.timing(glow, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOurGoal, compact, score, pop, glow]);

  if (!newest || !match) {
    return null;
  }

  const opponent = match.opponent ?? 'motstanderen';
  const newCount =
    unread > 1 ? `${unread} nye hendelser` : unread === 1 ? '1 ny hendelse' : null;

  // Tidslinja: bare når kampen faktisk har flere hendelser å fortelle om.
  // Fem, ikke tre — pause, andre omgang og motstanderens mål skal få plass
  // uten å presse ut det siste målet. Fortsatt et sammendrag: hele referatet
  // bor på kampsiden.
  // Rader uten tekst filtreres bort: en tidslinje med et minutt og et tomt
  // felt forteller ingenting, og ser ut som en feil (den ER en feil).
  const timeline =
    items.length > 1
      ? items
          .slice(0, 5)
          .filter(i => eventLine(i, teamName).trim().length > 0)
      : [];

  const a11y =
    variant === 'goal'
      ? `Mål. Stillingen er ${match.homeScore}–${match.awayScore}. Åpne kampen.`
      : variant === 'live'
      ? `Kampen pågår. ${teamName} ${match.homeScore}–${match.awayScore} ${opponent}. Åpne kampen.`
      : `${resultHeadline(match.homeScore, match.awayScore)} ${teamName} ${
          match.homeScore
        }–${match.awayScore} ${opponent}. Åpne kampen.`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({pressed}) => [styles.wrap, pressed && styles.pressed]}>
      <StadiumSurface
        style={compact ? styles.surfaceCompact : styles.surface}
        flood={!compact}>
        {variant === 'goal' && (
          <Animated.View
            pointerEvents="none"
            style={[styles.celebration, {opacity: glow}]}
          />
        )}

        {compact ? (
          /* KOMPAKT: én linje, når alt er lest. Orienterer og sender deg
             videre — og lar Hjem beholde arenaen. */
          <View style={styles.compactRow}>
            {isLive ? (
              <LiveBadge paused={paused} />
            ) : (
              <Text style={styles.eyebrow}>
                {resultHeadline(match.homeScore, match.awayScore)}
              </Text>
            )}
            {isLive && liveMinute !== null && (
              <Text style={styles.compactMinute}>{liveMinute}′</Text>
            )}
            <Text style={styles.compactScore} numberOfLines={1}>
              {teamName} <Text style={styles.compactScoreNum}>{score}</Text>{' '}
              {opponent}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ) : (
          <>
            {/* Toppen: LIVE-merket eier venstresiden mens kampen pågår, ellers
                resultatetiketten. Minuttpillen viser hendelsens minutt. */}
            <View style={styles.topRow}>
              {isLive ? (
                <LiveBadge paused={paused} />
              ) : (
                <Text style={styles.eyebrow}>
                  {resultHeadline(match.homeScore, match.awayScore)}
                </Text>
              )}
              {match.minute !== null && (
                <View style={styles.minutePill}>
                  <Text style={styles.minuteText}>{match.minute}′</Text>
                </View>
              )}
            </View>

            {/* MÅÅÅL! er FEIRING og gjelder bare oss. Motstanderens mål får
                samme plass, men ingen jubel — og aldri coral. */}
            {variant === 'goal' && <Text style={styles.eyebrow}>MÅÅÅL!</Text>}

            <Animated.Text style={[styles.score, {transform: [{scale: pop}]}]}>
              {score}
            </Animated.Text>

            {/* Sammendraget er ALLTID den nyeste hendelsen — «Ham-Kam
                reduserer», «Pause», «Andre omgang i gang». Før sto det bare
                lagnavn og stilling her når det ikke var vårt mål, altså
                ingenting om hva som nettopp skjedde. */}
            <Text style={styles.summary} numberOfLines={2}>
              {eventLine(newest, teamName)}
            </Text>
          </>
        )}

        {timeline.length > 0 && !compact && (
          <View style={styles.timeline}>
            {timeline.map(item => (
              <View key={item.id} style={styles.timelineRow}>
                <Text style={styles.timelineMinute}>
                  {item.match?.minute ?? 0}′
                </Text>
                <Text style={styles.timelineText} numberOfLines={1}>
                  {eventLine(item, teamName)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!compact && (
          <View style={styles.footer}>
            {newCount && <Text style={styles.newCount}>{newCount}</Text>}
            {/* «Følg kampen» er Hjems knapp og blir stående der — Varsler
                sender deg bare til den samme kampen. */}
            <Text style={styles.cta}>
              {isLive ? 'Se kampen ›' : 'Se mål, bilder og reaksjoner ›'}
            </Text>
          </View>
        )}
      </StadiumSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.elevated,
  },
  pressed: {
    opacity: 0.92,
  },
  surface: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  // Kompakt-varianten er bevisst LAV — den skal orientere, ikke dominere.
  surfaceCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  celebration: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GOAL_CELEBRATION_TINT,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: colors.heia,
  },
  minutePill: {
    backgroundColor: colors.heia,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  minuteText: {
    ...typography.scoreSmall,
    fontSize: 13,
    color: colors.heiaDeep,
  },
  // Glød er rasjonert i A v2 — live-/målscoren er ett av de reserverte stedene.
  score: {
    ...typography.scoreLarge,
    color: colors.heia,
    textShadowColor: 'rgba(2, 255, 171, 0.4)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 16,
  },
  summary: {
    ...typography.body,
    fontWeight: '700',
    color: colors.stadiumText,
  },
  timeline: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stadiumEdge,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timelineMinute: {
    ...typography.scoreSmall,
    fontSize: 12,
    color: colors.heia,
    width: 30,
  },
  timelineText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.stadiumDim,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  newCount: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.stadiumDim,
  },
  cta: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.heia,
    marginLeft: 'auto',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compactMinute: {
    ...typography.scoreSmall,
    fontSize: 13,
    color: colors.heia,
  },
  compactScore: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '700',
    color: colors.stadiumText,
  },
  compactScoreNum: {
    ...typography.scoreSmall,
    fontSize: 15,
    color: colors.heia,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.stadiumDim,
  },
});
