import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, radius, typography} from '../theme';

/**
 * Score-chip (A v2): kampen bor alltid på mørk flate — fra fullt scoreboard
 * ned til denne. Mørk stadionbunn + minttall er kamp-signaturen, uansett
 * hvor liten flaten er.
 */
interface ScoreChipProps {
  /** Liten caps-etikett: «Live», «Slutt», «Kamp», «41′» … */
  label: string;
  /** Coral etikettfarge for pågående kamp. */
  live?: boolean;
  /** «2–1». Utelates når kilden ikke bærer stillingen (f.eks. feed-poster). */
  score?: string;
}

export function ScoreChip({label, live = false, score}: ScoreChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.label, live && styles.labelLive]} numberOfLines={1}>
        {label}
      </Text>
      {score ? (
        <Text style={styles.score} numberOfLines={1}>
          {score}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.stadium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.stadiumDim,
  },
  labelLive: {
    color: '#FF8A8D',
  },
  score: {
    ...typography.scoreSmall,
    color: colors.heia,
  },
});
