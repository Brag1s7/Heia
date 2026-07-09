import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import type {MatchStatus} from '../shared/types';

interface ScoreBoardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: MatchStatus;
  minute?: number;
}

export function ScoreBoard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  matchStatus,
  minute,
}: ScoreBoardProps) {
  const isLive = matchStatus === 'live' || matchStatus === 'halfTime';

  return (
    <View style={styles.container}>
      {isLive && (
        <View style={styles.liveRow}>
          <LiveBadge />
          {minute !== undefined && (
            <Text style={styles.minute}>{minute}'</Text>
          )}
        </View>
      )}

      <View style={styles.scoreRow}>
        <View style={styles.teamSection}>
          <Text style={styles.teamName} numberOfLines={2}>
            {homeTeam}
          </Text>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{homeScore}</Text>
          </View>
        </View>

        <Text style={styles.separator}>–</Text>

        <View style={styles.teamSection}>
          <Text style={styles.teamName} numberOfLines={2}>
            {awayTeam}
          </Text>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{awayScore}</Text>
          </View>
        </View>
      </View>

      {matchStatus === 'halfTime' && (
        <Text style={styles.status}>Pause</Text>
      )}
      {matchStatus === 'finished' && (
        <Text style={styles.status}>Kampen er ferdig</Text>
      )}
      {matchStatus === 'cancelled' && (
        <Text style={styles.status}>Kampen er avlyst</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    gap: spacing.lg,
    ...shadows.card,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minute: {
    ...typography.heading3,
    color: colors.error,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
  },
  teamName: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreBox: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    ...typography.heading1,
    fontSize: 32,
  },
  separator: {
    ...typography.heading2,
    color: colors.textTertiary,
  },
  status: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
