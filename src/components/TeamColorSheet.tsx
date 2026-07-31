import React from 'react';
import {View, Text, Modal, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {TeamColorPicker} from './TeamColorPicker';

interface TeamColorSheetProps {
  visible: boolean;
  /** Lagets nåværende farge — vises som valgt swatch. */
  current: string | null;
  /** Trykk på en swatch = lagre og lukk (samme mønster som ReporterSheet). */
  onSelect: (color: string) => void;
  onClose: () => void;
}

/** Valgark for lagfargen (Profil → Lagfarge, kun trener/lagleder/admin). */
export function TeamColorSheet({
  visible,
  current,
  onSelect,
  onClose,
}: TeamColorSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.xl}]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Lagfarge</Text>
        <Text style={styles.subtitle}>
          Vises på lagmerket, i kampen og på laglisten.
        </Text>
        <TeamColorPicker value={current} onChange={onSelect} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
