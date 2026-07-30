import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import {StatusPill} from './StatusPill';
import {useActiveTeam} from '../context';
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

  return (
    <View style={styles.container}>
      {/* Stemning: varmt flomlys øverst, banesirkel nede til høyre */}
      <View style={styles.floodAmber} pointerEvents="none" />
      <View style={styles.floodMint} pointerEvents="none" />
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />

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
            {isWin && <StatusPill kind="seier" label="Seier" />}
          </>
        )}
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          <View
            style={[
              styles.teamBadge,
              styles.usRing,
              {backgroundColor: teamColor},
            ]}>
            <Text style={styles.teamBadgeText}>{initials(homeTeam)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {homeTeam}
          </Text>
          <View style={[styles.usMark, {backgroundColor: teamColor}]} />
        </View>

        <Text style={[styles.score, isUnderway && styles.scoreGlow]}>
          {homeScore}–{awayScore}
        </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.stadium,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    gap: spacing.xl,
    borderWidth: 1,
    borderColor: colors.stadiumEdge,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  // Store og svake — en hard sirkelkant leses som en flekk, ikke som lys.
  floodAmber: {
    position: 'absolute',
    top: -190,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255, 197, 61, 0.04)',
  },
  floodMint: {
    position: 'absolute',
    top: -210,
    right: -110,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(2, 255, 171, 0.05)',
  },
  arcOuter: {
    position: 'absolute',
    right: -70,
    bottom: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.13)',
  },
  arcInner: {
    position: 'absolute',
    right: -38,
    bottom: -58,
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 255, 171, 0.09)',
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
