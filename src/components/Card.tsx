import React, {type PropsWithChildren} from 'react';
import {View, StyleSheet, type ViewStyle} from 'react-native';
import {colors, spacing, radius, shadows} from '../theme';

interface CardProps {
  style?: ViewStyle;
}

export function Card({children, style}: PropsWithChildren<CardProps>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
});
