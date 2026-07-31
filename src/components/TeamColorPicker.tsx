import React from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {radius, spacing} from '../theme';
import {TEAM_COLORS, inkOnTeamColor} from '../shared/teamColors';
import {Check} from './icons';

interface TeamColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
}

/**
 * Swatch-grid for lagfargen (kuratert palett — se shared/teamColors).
 * Brukes inline i CreateTeam og i Lagfarge-sheeten fra Profil.
 * Valgt = ring i fargen selv + hake (samme språk som lagmerkets badgeRing).
 */
export function TeamColorPicker({value, onChange}: TeamColorPickerProps) {
  return (
    <View style={styles.grid}>
      {TEAM_COLORS.map(c => {
        const selected = value?.toUpperCase() === c.value.toUpperCase();
        return (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityState={{selected}}
            style={({pressed}) => [
              styles.swatchWrap,
              selected && {borderColor: c.value},
              pressed && styles.swatchPressed,
            ]}>
            <View style={[styles.swatch, {backgroundColor: c.value}]}>
              {selected && (
                <Check
                  size={16}
                  color={inkOnTeamColor(c.value)}
                  strokeWidth={3}
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatchWrap: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.full,
    padding: 2,
  },
  swatchPressed: {
    opacity: 0.7,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
