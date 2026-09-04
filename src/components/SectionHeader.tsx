import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {typography, spacing, colors} from '../theme';
import {OPAL} from './OpalSurface';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * `opal` (Brage 2026-09-04): etiketten står INNE i et glassark (Varsler-
   * arket) — blekket er opalens sekundærblekk, som holder 4,5:1 på arket
   * over hele grunnspennet. Utelatt = som før på de hvite listene.
   */
  tone?: 'opal';
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  tone,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {/* Mint-streken er seksjonsetikettens merkevaredetalj (A v2). */}
        <View style={styles.dash} />
        <Text style={[styles.title, tone === 'opal' && styles.titleOpal]}>
          {title}
        </Text>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={spacing.sm}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  titleOpal: {
    color: OPAL.inkSecondary,
  },
  action: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.heiaInk,
  },
});
