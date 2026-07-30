import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, radius, typography} from '../theme';
import type {RSVPSummary} from '../shared/types';

interface RSVPBarProps {
  rsvp: RSVPSummary;
}

/**
 * Oppmøtestripe (A v2): mint = de som kommer, resten er dempet. Samme språk
 * som NextEventHero. «Kan ikke» roper ikke i rødt — fravær er informasjon,
 * ikke en feil.
 */
export function RSVPBar({rsvp}: RSVPBarProps) {
  const total = rsvp.coming + rsvp.notComing + rsvp.pending;
  if (total === 0) {
    return null;
  }

  const comingPct = (rsvp.coming / total) * 100;
  const notComingPct = (rsvp.notComing / total) * 100;
  // pending fyller resten

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        {rsvp.coming > 0 && (
          <View
            style={[
              styles.barSegment,
              styles.barComing,
              {width: `${comingPct}%`},
            ]}
          />
        )}
        {rsvp.notComing > 0 && (
          <View
            style={[
              styles.barSegment,
              styles.barNotComing,
              {width: `${notComingPct}%`},
            ]}
          />
        )}
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, styles.labelComing]}>
          {rsvp.coming} kommer
        </Text>
        {rsvp.notComing > 0 && (
          <Text style={[styles.label, {color: colors.textSecondary}]}>
            {rsvp.notComing} kan ikke
          </Text>
        )}
        {rsvp.pending > 0 && (
          <Text style={[styles.label, {color: colors.textTertiary}]}>
            {rsvp.pending} venter
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 57, 46, 0.10)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  barComing: {
    backgroundColor: colors.heia,
    borderRadius: radius.full,
  },
  barNotComing: {
    backgroundColor: colors.border,
  },
  labels: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  labelComing: {
    color: colors.heiaDeep,
    fontWeight: '700',
  },
});
