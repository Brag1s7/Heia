import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';

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
  /**
   * Egen prop, ikke en `ReporterActionType`: et bilde er ikke en kamphendelse
   * og går aldri gjennom `report_match_event`. Å legge det i unionen ville
   * gjort typen usann om hva som kan rapporteres.
   */
  onPhoto?: () => void;
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

export function ReporterActions({
  onAction,
  isPaused,
  onPhoto,
}: ReporterActionsProps) {
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
        {goalActions.map(action => {
          const isUs = action.type === 'mål_oss';
          return (
            <Pressable
              key={action.type}
              onPress={() => onAction(action.type)}
              style={({pressed}) => [
                styles.goalButton,
                isUs ? styles.goalButtonUs : styles.goalButtonAway,
                pressed && (isUs ? styles.pressedUs : styles.pressed),
              ]}>
              <Text style={styles.goalIcon}>{action.icon}</Text>
              <Text style={[styles.goalLabel, isUs && styles.goalLabelUs]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
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
      {/* Egen, full bredde: bildet publiserer innhold til laget, mens raden
          over rapporterer kampens tilstand. To ulike ting bør ikke se like ut. */}
      {onPhoto && (
        <Pressable
          onPress={onPhoto}
          style={({pressed}) => [styles.photoButton, pressed && styles.pressed]}>
          <Text style={styles.smallIcon}>📷</Text>
          <Text style={styles.photoLabel}>Legg ut bilde</Text>
        </Pressable>
      )}
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
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  // «Mål oss» er reporterens hovedhandling — mintfyll + glød (ett av de
  // rasjonerte glød-stedene). Mål feires i grønt, aldri coral.
  goalButtonUs: {
    backgroundColor: colors.heia,
    ...shadows.glow,
  },
  goalButtonAway: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  pressedUs: {
    backgroundColor: colors.heiaPressed,
  },
  goalIcon: {
    fontSize: 28,
  },
  goalLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  goalLabelUs: {
    color: colors.heiaDeep,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  smallButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
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
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoLabel: {
    ...typography.body,
    fontWeight: '600',
  },
});
