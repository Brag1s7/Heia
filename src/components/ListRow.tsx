import React, {type ReactNode} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing} from '../theme';

interface ListRowProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  showBorder?: boolean;
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  showBorder = true,
}: ListRowProps) {
  const content = (
    <View style={[styles.container, showBorder && styles.border]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.rightWrap}>{right}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({pressed}) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  iconWrap: {
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.bodySmall,
  },
  rightWrap: {
    marginLeft: spacing.md,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
  },
});
