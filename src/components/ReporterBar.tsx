import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import type {User} from '../shared/types';

interface ReporterBarProps {
  reporter: User | undefined;
  isAdmin: boolean;
  isMe: boolean;
  onChangeReporter: () => void;
}

/**
 * Rollen tildeles av trener/lagleder — den kan ikke tas.
 * Det speiler RLS på `match_sessions`, der bare reporteren selv eller en admin
 * får oppdatere raden: en ledig rolle (reporter_id IS NULL) kan uansett ikke
 * claimes av et vanlig medlem.
 */
export function ReporterBar({
  reporter,
  isAdmin,
  isMe,
  onChangeReporter,
}: ReporterBarProps) {
  // Ingen reporter satt — kun en admin kan gjøre noe med det.
  if (!reporter) {
    if (!isAdmin) {
      return (
        <View style={styles.container}>
          <View style={styles.emptyDot} />
          <Text style={styles.emptyLabel}>Ingen kampreporter</Text>
        </View>
      );
    }

    return (
      <Pressable
        style={({pressed}) => [styles.container, pressed && styles.pressed]}
        onPress={onChangeReporter}>
        <View style={styles.emptyDot} />
        <Text style={styles.emptyLabel}>Ingen kampreporter</Text>
        <View style={styles.assignButton}>
          <Text style={styles.assignText}>Velg</Text>
        </View>
      </Pressable>
    );
  }

  const canChange = isAdmin || isMe;

  return (
    <View style={styles.container}>
      <Avatar name={reporter.name} size="sm" />
      <View style={styles.info}>
        <Text style={styles.roleLabel}>Kampreporter</Text>
        <Text style={styles.name}>
          {isMe ? 'Deg' : reporter.name}
        </Text>
      </View>
      {canChange && (
        <Pressable
          style={({pressed}) => [
            styles.changeButton,
            pressed && styles.changePressed,
          ]}
          onPress={onChangeReporter}>
          <Text style={styles.changeText}>Bytt</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  roleLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  emptyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyLabel: {
    ...typography.body,
    color: colors.textTertiary,
    flex: 1,
  },
  assignButton: {
    backgroundColor: colors.heia,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  assignText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changeButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  changePressed: {
    backgroundColor: colors.border,
  },
  changeText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
