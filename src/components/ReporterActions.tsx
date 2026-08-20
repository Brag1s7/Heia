import React, {useRef} from 'react';
import {View, Text, Pressable, StyleSheet, Animated} from 'react-native';
import {
  colors,
  matchColors,
  typography,
  spacing,
  radius,
  shadows,
} from '../theme';
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

/**
 * Hva knappen GJØR, som setning. En etikett på to ord («Mål oss») er nok når
 * man ser griddet; den er ikke nok når den leses opp alene.
 */
const ACTION_A11Y: Record<ReporterActionType, string> = {
  mål_oss: 'Registrer mål for oss',
  mål_dem: 'Registrer mål for motstanderen',
  pause: 'Sett kampen i pause',
  andre_omgang: 'Start andre omgang',
  slutt: 'Avslutt kampen',
  melding: 'Skriv en oppdatering til laget',
};

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
  /**
   * ⚠️ VARIANT, IKKE ENDRET DEFAULT. Panelet er reporterens verktøy og bor
   * i dag på lys flate. På kampens grunn ville de hvite kortene lest som
   * «admin» — den frosne retningen forbyr nettopp det.
   */
  variant?: 'default' | 'match';
}

const goalActions: ActionButton[] = [
  {type: 'mål_oss', label: 'Mål oss'},
  {type: 'mål_dem', label: 'Mål dem'},
];

/**
 * Målknapp med trykk-respons (P2): knappen «gir etter» ved press og fjærer
 * tilbake ved slipp. Skalaen bor på en wrapper — Pressable kan ikke selv
 * bære en Animated-transform. Ren RN Animated, native driver.
 */
function GoalButton({
  action,
  onAction,
  onMatch,
}: {
  action: ActionButton;
  onAction: (type: ReporterActionType) => void;
  onMatch: boolean;
}) {
  const isUs = action.type === 'mål_oss';
  const IconGlyph = ACTION_ICON[action.type];
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 90,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[styles.goalWrap, {transform: [{scale}]}]}>
      <Pressable
        onPress={() => onAction(action.type)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={ACTION_A11Y[action.type]}
        style={({pressed}) => [
          styles.goalButton,
          isUs
            ? styles.goalButtonUs
            : onMatch
            ? styles.goalButtonAwayMatch
            : styles.goalButtonAway,
          pressed &&
            (isUs
              ? styles.pressedUs
              : onMatch
              ? styles.pressedMatch
              : styles.pressed),
        ]}>
        {/* Mintknappen beholder heiaDeep-blekket på begge flater — mint er
            feiringens farge, og den er lovlig på stadionmørkt. */}
        <IconGlyph
          size={26}
          color={
            isUs
              ? colors.heiaDeep
              : onMatch
              ? matchColors.text
              : colors.textPrimary
          }
          strokeWidth={2}
        />
        <Text
          style={[
            styles.goalLabel,
            isUs && styles.goalLabelUs,
            !isUs && onMatch && styles.labelMatch,
          ]}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const PAUSE_ACTION: ActionButton = {type: 'pause', label: 'Pause'};
const RESUME_ACTION: ActionButton = {type: 'andre_omgang', label: 'Fortsett'};

export function ReporterActions({
  onAction,
  isPaused,
  onPhoto,
  variant = 'default',
}: ReporterActionsProps) {
  const onMatch = variant === 'match';
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
        {goalActions.map(action => (
          <GoalButton
            key={action.type}
            action={action}
            onAction={onAction}
            onMatch={onMatch}
          />
        ))}
      </View>
      <View style={styles.row}>
        {smallActions.map(action => {
          const IconGlyph = ACTION_ICON[action.type];
          return (
            <Pressable
              key={action.type}
              onPress={() => onAction(action.type)}
              accessibilityRole="button"
              accessibilityLabel={ACTION_A11Y[action.type]}
              style={({pressed}) => [
                styles.smallButton,
                onMatch && styles.buttonMatch,
                pressed && (onMatch ? styles.pressedMatch : styles.pressed),
              ]}>
              <IconGlyph
                size={18}
                color={onMatch ? matchColors.text : colors.textPrimary}
              />
              <Text style={[styles.smallLabel, onMatch && styles.labelMatch]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Egen, full bredde: bildet publiserer innhold til laget, mens raden
          over rapporterer kampens tilstand. To ulike ting bør ikke se like ut. */}
      {onPhoto && (
        <Pressable
          onPress={onPhoto}
          accessibilityRole="button"
          accessibilityLabel="Legg ut et bilde fra kampen"
          style={({pressed}) => [
            styles.photoButton,
            onMatch && styles.buttonMatch,
            pressed && (onMatch ? styles.pressedMatch : styles.pressed),
          ]}>
          <Camera
            size={18}
            color={onMatch ? matchColors.text : colors.textPrimary}
          />
          <Text style={[styles.photoLabel, onMatch && styles.labelMatch]}>
            Legg ut bilde
          </Text>
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
  // flex bor på wrapperen (som bærer scale-transformen); knappen fyller den.
  goalWrap: {
    flex: 1,
  },
  goalButton: {
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
  // Kampens knapper: krittkant på grunnen, aldri en hvit plate.
  goalButtonAwayMatch: {
    backgroundColor: matchColors.opponentNode,
    borderWidth: 1,
    borderColor: matchColors.chalkStrong,
  },
  buttonMatch: {
    backgroundColor: 'transparent',
    borderColor: matchColors.chalk,
  },
  labelMatch: {
    color: matchColors.text,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  pressedMatch: {
    backgroundColor: 'rgba(234, 255, 246, 0.12)',
    borderColor: matchColors.chalkStrong,
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
