import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';

// `selected` er en av/på-tilstand, ikke et hierarkinivå: samme «valgt»-språk
// som chipsene (heiaSoft-fyll + heia-ramme). Bruk den når et trykk slår en
// knapp på, og `primary` når trykket utfører en handling.
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'selected';
type ButtonSize = 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textPrimary : colors.heia}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variantTextStyles[variant],
            isDisabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
  },
  text: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: undefined,
  } as TextStyle,
  disabled: {
    opacity: 0.4,
  },
  disabledText: {
    opacity: 0.6,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  md: {
    height: 48,
    paddingHorizontal: spacing['2xl'],
  },
  lg: {
    height: 56,
    paddingHorizontal: spacing['3xl'],
  },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.heia,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  selected: {
    backgroundColor: colors.heiaSoft,
    borderWidth: 1.5,
    borderColor: colors.heia,
  },
};

const pressedStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.heiaPressed,
  },
  secondary: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  ghost: {
    backgroundColor: colors.heiaSoft,
  },
  selected: {
    borderColor: colors.heiaPressed,
  },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: {
    color: colors.textPrimary,
  },
  secondary: {
    color: colors.textPrimary,
  },
  ghost: {
    color: colors.textSecondary,
  },
  // heiaInk, ikke heia: #02ffab er kun fyll og feiler kontrast som tekst.
  selected: {
    color: colors.heiaInk,
  },
};
