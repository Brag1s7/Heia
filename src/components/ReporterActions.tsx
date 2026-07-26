import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';

export type ReporterActionType =
  | 'mål_oss'
  | 'mål_dem'
  | 'pause'
  | 'andre_omgang'
  | 'slutt'
  | 'melding';

interface ActionButton {
  type: ReporterActionType;
  label: string;
  icon: string;
}

interface ReporterActionsProps {
  onAction: (type: ReporterActionType) => void;
  /** I pause bytter «Pause»-knappen til «Fortsett» (andre omgang). */
  isPaused?: boolean;
}

const goalActions: ActionButton[] = [
  {type: 'mål_oss', label: 'Mål oss', icon: '⚽'},
  {type: 'mål_dem', label: 'Mål dem', icon: '⚽'},
];

const PAUSE_ACTION: ActionButton = {type: 'pause', label: 'Pause', icon: '⏸'};
const RESUME_ACTION: ActionButton = {
  type: 'andre_omgang',
  label: 'Fortsett',
  icon: '▶️',
};

export function ReporterActions({onAction, isPaused}: ReporterActionsProps) {
  // Pause og «fortsett» er samme plass i griddet — du er aldri i begge på én
  // gang. Slik unngår vi en knapp som er død halvparten av tiden.
  const smallActions: ActionButton[] = [
    isPaused ? RESUME_ACTION : PAUSE_ACTION,
    {type: 'slutt', label: 'Slutt', icon: '🏁'},
    {type: 'melding', label: 'Kommentar', icon: '💬'},
  ];

  return (
    <View style={styles.container}>
      <View style={styles.goalRow}>
        {goalActions.map(action => (
          <Pressable
            key={action.type}
            onPress={() => onAction(action.type)}
            style={({pressed}) => [
              styles.goalButton,
              action.type === 'mål_dem' && styles.goalButtonAway,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.goalIcon}>{action.icon}</Text>
            <Text style={styles.goalLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {smallActions.map(action => (
          <Pressable
            key={action.type}
            onPress={() => onAction(action.type)}
            style={({pressed}) => [
              styles.smallButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.smallIcon}>{action.icon}</Text>
            <Text style={styles.smallLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  goalButton: {
    flex: 1,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  goalButtonAway: {
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  goalIcon: {
    fontSize: 28,
  },
  goalLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  smallButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  smallIcon: {
    fontSize: 20,
  },
  smallLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
});
