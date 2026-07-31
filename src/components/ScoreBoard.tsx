import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import {StadiumSurface} from './StadiumSurface';
import {StatusPill} from './StatusPill';
import {TeamBadge} from './TeamBadge';
import {useActiveTeam} from '../context';
import {useGoalMoment, GOAL_CELEBRATION_TINT} from './useGoalMoment';
import type {MatchStatus} from '../shared/types';

interface ScoreBoardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: MatchStatus;
  minute?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

/**
 * Fullt scoreboard (A v2): kampen bor alltid på mørk stadionflate, og dette er
 * den største av dem — flomlys, banesirkel, lagmerker og glødende mint-score.
 * Glød er rasjonert, men den pågående kampens score er ett av de reserverte
 * stedene. Ferdig kamp: samme flate, roligere — SEIER-pill finnes, tap-pill
 * finnes ikke.
 */
export function ScoreBoard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  matchStatus,
  minute,
}: ScoreBoardProps) {
  const {activeTeamSpace} = useActiveTeam();
  const teamColor = activeTeamSpace?.color || colors.info;

  const isPaused = matchStatus === 'halfTime';
  const isUnderway = matchStatus === 'live' || isPaused;
  const isWin = matchStatus === 'finished' && homeScore > awayScore;

  const {scoreScale, celebrate} = useGoalMoment(homeScore, awayScore);

  // SEIER-øyeblikket: pillen spretter inn når den dukker opp — både i det
  // kampen ender med seier, og hver gang rapporten åpnes. Liten forsinkelse
  // så skjermbyttet rekker å lande først.
  const seierIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isWin) {
      Animated.spring(seierIn, {
        toValue: 1,
        delay: 250,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      seierIn.setValue(0);
    }
  }, [isWin, seierIn]);

  return (
    <StadiumSurface style={styles.container}>
      {/* Mål for oss: kort mint-glød over flaten (feiring i grønt, aldri
          coral). Ligger under innholdet — teksten skal ikke tones. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.celebration, {opacity: celebrate}]}
      />
      <View style={styles.topRow}>
        {isUnderway ? (
          <>
            <LiveBadge paused={isPaused} />
            {minute !== undefined && (
              <View style={styles.minutePill}>
                <Text style={styles.minuteText}>{minute}′</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <StatusPill
              kind="neutral"
              label={matchStatus === 'cancelled' ? 'Avlyst' : 'Slutt'}
            />
            {isWin && (
              <Animated.View
                style={{opacity: seierIn, transform: [{scale: seierIn}]}}>
                <StatusPill kind="seier" label="Seier" />
              </Animated.View>
            )}
          </>
        )}
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          {/* Lagmerket (logo → initialer) — hvit plate bak logoen mot den
              mørke stadionflaten; motstanderen er urørt. */}
          <TeamBadge
            size={48}
            cornerRadius={radius.lg}
            fontSize={14}
            logoPlate
            name={homeTeam}
            style={styles.usRing}
          />
          <Text style={styles.teamName} numberOfLines={2}>
            {homeTeam}
          </Text>
          <View style={[styles.usMark, {backgroundColor: teamColor}]} />
        </View>

        <Animated.Text
          style={[
            styles.score,
            isUnderway && styles.scoreGlow,
            {transform: [{scale: scoreScale}]},
          ]}>
          {homeScore}–{awayScore}
        </Animated.Text>

        <View style={styles.teamCol}>
          <View style={[styles.teamBadge, styles.themBadge]}>
            <Text style={styles.teamBadgeText}>{initials(awayTeam)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {awayTeam}
          </Text>
        </View>
      </View>

      {isPaused && <Text style={styles.status}>Pause — kampen fortsetter</Text>}
      {matchStatus === 'cancelled' && (
        <Text style={styles.status}>Kampen er avlyst</Text>
      )}
    </StadiumSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing['2xl'],
    gap: spacing.xl,
    ...shadows.elevated,
  },
  celebration: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GOAL_CELEBRATION_TINT,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usRing: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  themBadge: {
    backgroundColor: '#3A4750',
  },
  teamBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stadiumText,
    textAlign: 'center',
    lineHeight: 17,
  },
  usMark: {
    width: 26,
    height: 3,
    borderRadius: 2,
  },
  score: {
    ...typography.scoreLarge,
    fontSize: 48,
    color: colors.heia,
  },
  scoreGlow: {
    textShadowColor: 'rgba(2, 255, 171, 0.4)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 16,
  },
  status: {
    ...typography.caption,
    color: colors.stadiumDim,
    textAlign: 'center',
  },
});
