import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, matchColors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import {avatarRef} from '../lib/media/avatar';
import type {User} from '../shared/types';

interface ReporterBarProps {
  reporter: User | undefined;
  isAdmin: boolean;
  isMe: boolean;
  onChangeReporter: () => void;
  /**
   * ⚠️ VARIANT, IKKE ENDRET DEFAULT. Den lyse baren står fortsatt på kommende
   * kamp (info-flaten), og skal se ut som før. `match` er den samme raden på
   * kampens grunn: ingen hvit plate, ingen ramme — skillet kommer av lys og
   * luft, som resten av kampverdenen.
   */
  variant?: 'default' | 'match';
}

/**
 * Rollen tildeles av trener/lagleder — den kan verken tas eller gis videre.
 * Det speiler RLS på `match_sessions`: UPDATE-policyen har ingen `WITH CHECK`,
 * så `USING` gjelder også for den nye raden. Et vanlig medlem kan derfor ikke
 * claime en ledig rolle, og reporteren selv kan ikke sette en annen inn —
 * bare admin. Derfor er «Bytt» admin-only.
 */
export function ReporterBar({
  reporter,
  isAdmin,
  isMe,
  onChangeReporter,
  variant = 'default',
}: ReporterBarProps) {
  const onMatch = variant === 'match';

  // Ingen reporter satt — kun en admin kan gjøre noe med det.
  if (!reporter) {
    const empty = (
      <>
        <View style={[styles.emptyDot, onMatch && styles.emptyDotMatch]} />
        <Text style={[styles.emptyLabel, onMatch && styles.emptyLabelMatch]}>
          Ingen kampreporter
        </Text>
      </>
    );

    if (!isAdmin) {
      return (
        <View style={[styles.container, onMatch && styles.containerMatch]}>
          {empty}
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Velg kampreporter"
        style={({pressed}) => [
          styles.container,
          onMatch && styles.containerMatch,
          pressed && (onMatch ? styles.pressedMatch : styles.pressed),
        ]}
        onPress={onChangeReporter}>
        {empty}
        <View
          style={[styles.assignButton, onMatch && styles.assignButtonMatch]}>
          <Text style={styles.assignText}>Velg</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, onMatch && styles.containerMatch]}>
      <Avatar
        name={reporter.name}
        size="sm"
        media={avatarRef(reporter.avatarPath)}
        color={reporter.avatarColor}
      />
      <View
        style={styles.info}
        accessible
        accessibilityLabel={`Kampreporter: ${isMe ? 'deg' : reporter.name}`}>
        <Text style={[styles.roleLabel, onMatch && styles.roleLabelMatch]}>
          Kampreporter
        </Text>
        <Text style={[styles.name, onMatch && styles.nameMatch]}>
          {isMe ? 'Deg' : reporter.name}
        </Text>
      </View>
      {isAdmin && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bytt kampreporter"
          // Knappen er ikon-liten optisk (16 pt tekst i 8 pt luft) — hitSlop
          // løfter trykkflaten til 44 pt uten å gjøre den visuelt tyngre.
          hitSlop={{top: 10, bottom: 10, left: 12, right: 12}}
          style={({pressed}) => [
            styles.changeButton,
            onMatch && styles.changeButtonMatch,
            pressed &&
              (onMatch ? styles.changePressedMatch : styles.changePressed),
          ]}
          onPress={onChangeReporter}>
          <Text style={[styles.changeText, onMatch && styles.changeTextMatch]}>
            Bytt
          </Text>
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
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  // Kampen: raden ligger rett på grunnen. Ingen flate, ingen ramme.
  containerMatch: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    // Nullstilles selv om bredden er 0: en overlevende kremfarge i stilen er
    // en kremfarge som våkner neste gang noen setter en kant her.
    borderColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  pressedMatch: {
    opacity: 0.6,
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
  roleLabelMatch: {
    color: matchColors.dim,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  nameMatch: {
    color: matchColors.text,
    fontWeight: '700',
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
  emptyDotMatch: {
    backgroundColor: 'transparent',
    borderColor: matchColors.chalkStrong,
  },
  emptyLabel: {
    ...typography.body,
    color: colors.textTertiary,
    flex: 1,
  },
  emptyLabelMatch: {
    color: matchColors.dim,
  },
  // A v2-knapperegel: mintfyll bærer alltid heiaDeep-tekst, aldri ren svart.
  assignButton: {
    backgroundColor: colors.heia,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  assignButtonMatch: {
    borderRadius: radius.full,
  },
  assignText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
  changeButton: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  // Krittkant, ikke plate: skillet i kampverdenen er en linje i lys.
  changeButtonMatch: {
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: matchColors.chalkStrong,
  },
  changePressed: {
    backgroundColor: colors.border,
  },
  changePressedMatch: {
    backgroundColor: 'rgba(234, 255, 246, 0.12)',
  },
  changeText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  changeTextMatch: {
    color: matchColors.text,
    fontWeight: '700',
  },
});
