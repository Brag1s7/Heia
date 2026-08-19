import React from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {radius, spacing} from '../theme';
import {AVATAR_COLORS, inkOnAvatarColor} from '../shared/avatarColors';
import {Check} from './icons';

interface AvatarColorPickerProps {
  /** Valgt farge, eller den hashen gir i dag (så «nåværende» får hake). */
  value: string | null;
  onChange: (color: string) => void;
}

/**
 * Swatch-grid for avatarfargen. Bevisst bygget som en tvilling av
 * `TeamColorPicker` — samme form, samme valgt-språk (ring i fargen selv +
 * hake), samme kuraterte-palett-regel. To fargevelgere i én app som ser
 * ulike ut, leses som to ulike mekanismer.
 */
export function AvatarColorPicker({value, onChange}: AvatarColorPickerProps) {
  return (
    <View style={styles.grid}>
      {AVATAR_COLORS.map(c => {
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
                  color={inkOnAvatarColor(c.value)}
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
    justifyContent: 'center',
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
