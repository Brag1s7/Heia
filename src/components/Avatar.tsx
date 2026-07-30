import React from 'react';
import {View, Text, Image, StyleSheet, type ViewStyle} from 'react-native';
import {colors, radius} from '../theme';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 20,
};

// Stabile bakgrunnsfarger for initialer — varme, rolige toner
const avatarColors = [
  '#7C3AED', // lilla
  '#2563EB', // blå
  '#059669', // grønn
  '#D97706', // gyllen
  '#DC2626', // rød
  '#0891B2', // cyan
  '#7C2D12', // brun
  '#4338CA', // indigo
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function Avatar({uri, name, size = 'md', style}: AvatarProps) {
  const dim = sizeMap[size];
  const fontSize = fontSizeMap[size];

  const containerStyle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: radius.full,
    overflow: 'hidden',
  };

  if (uri) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{uri}}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        containerStyle,
        {backgroundColor: getColorForName(name)},
        styles.initialsContainer,
        style,
      ]}
    >
      <Text style={[styles.initials, {fontSize}]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.surface,
    fontWeight: '600',
  },
});
