import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Ball, Camera, Flag, MessageCircle, Pause, Play} from './icons';

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
}

// Ikon per handling — Ball for mål (samme tegning som artifacten), Play for
// «Fortsett». Fargen settes på kallstedet (mint-knappen trenger heiaDeep).
const ACTION_ICON: Record<
  ReporterActionType,
  React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>
> = {
  mål_oss: Ball,
  mål_dem: Ball,
  pause: Pause,
  andre_omgang: Play,
  slutt: Flag,
  melding: MessageCircle,
};

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
  {type: 'mål_oss', label: 'Mål oss'},
  {type: 'mål_dem', label: 'Mål dem'},
];

const PAUSE_ACTION: ActionButton = {type: 'pause', label: 'Pause'};
const RESUME_ACTION: ActionButton = {type: 'andre_omgang', label: 'Fortsett'};

export function ReporterActions({
  onAction,
  isPaused,
  onPhoto,
}: ReporterActionsProps) {
  // Pause og «fortsett» er samme plass i griddet — du er aldri i begge på én
  // gang. Slik unngår vi en knapp som er død halvparten av tiden.
  const smallActions: ActionButton[] = [
    isPaused ? RESUME_ACTION : PAUSE_ACTION,
    {type: 'slutt', label: 'Slutt'},
    {type: 'melding', label: 'Kommentar'},
  ];

  return (
    <View style={styles.container}>
      <View style={styles.goalRow}>
        {goalActions.map(action => {
          const isUs = action.type === 'mål_oss';
          const IconGlyph = ACTION_ICON[action.type];
          return (
            <Pressable
              key={action.type}
              onPress={() => onAction(action.type)}
              style={({pressed}) => [
                styles.goalButton,
                isUs ? styles.goalButtonUs : styles.goalButtonAway,
                pressed && (isUs ? styles.pressedUs : styles.pressed),
              ]}>
              <IconGlyph
                size={26}
                color={isUs ? colors.heiaDeep : colors.textPrimary}
                strokeWidth={2}
              />
              <Text style={[styles.goalLabel, isUs && styles.goalLabelUs]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {smallActions.map(action => {
          const IconGlyph = ACTION_ICON[action.type];
          return (
            <Pressable
              key={action.type}
              onPress={() => onAction(action.type)}
              style={({pressed}) => [
                styles.smallButton,
                pressed && styles.pressed,
              ]}>
              <IconGlyph size={18} color={colors.textPrimary} />
              <Text style={styles.smallLabel}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* Egen, full bredde: bildet publiserer innhold til laget, mens raden
          over rapporterer kampens tilstand. To ulike ting bør ikke se like ut. */}
      {onPhoto && (
        <Pressable
          onPress={onPhoto}
          style={({pressed}) => [styles.photoButton, pressed && styles.pressed]}>
          <Camera size={18} color={colors.textPrimary} />
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
