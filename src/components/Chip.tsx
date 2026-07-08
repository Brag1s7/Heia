import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import type {EventType} from '../shared/types';

type ChipType = EventType | 'live';

interface ChipProps {
  type: ChipType;
}

// Nøytral chip-bg + farget aksent-prikk. `live` er semantisk kritisk og beholder rødt fyll.
const chipConfig: Record<ChipType, {dot: string; label: string}> = {
  trening: {dot: colors.treningText, label: 'TRENING'},
  kamp: {dot: colors.kampText, label: 'KAMP'},
  sosialt: {dot: colors.sosialtText, label: 'SOSIALT'},
  annet: {dot: colors.textTertiary, label: 'ANNET'},
  live: {dot: colors.error, label: 'LIVE'},
};

export function Chip({type}: ChipProps) {
  const config = chipConfig[type];
  const isLive = type === 'live';

  return (
    <View
      style={[
        styles.chip,
        {backgroundColor: isLive ? 'rgba(239, 68, 68, 0.1)' : colors.surfaceMuted},
      ]}>
      {!isLive && (
        <View style={[styles.dot, {backgroundColor: config.dot}]} />
      )}
      <Text style={[styles.text, {color: isLive ? colors.error : colors.textSecondary}]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  text: {
    ...typography.label,
    fontSize: 11,
  },
});
