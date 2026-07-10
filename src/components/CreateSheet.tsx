import React from 'react';
import {View, Text, Modal, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';

interface CreateSheetProps {
  visible: boolean;
  /** Trener/lagleder/admin — samme regel som RLS på `events`. */
  canCreateEvent: boolean;
  onClose: () => void;
  onShare: () => void;
  onNewEvent: () => void;
}

/**
 * Valgarket bak «+». «Del med laget» vises for alle, så knappen aldri er død
 * for en forelder — de er de fleste brukerne, og «+» er appens mest
 * fremhevede knapp.
 */
export function CreateSheet({
  visible,
  canCreateEvent,
  onClose,
  onShare,
  onNewEvent,
}: CreateSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
        <View style={styles.handle} />

        <SheetRow
          icon="💬"
          title="Del med laget"
          subtitle="Skriv en melding eller legg ut et bilde"
          onPress={onShare}
        />

        {canCreateEvent && (
          <SheetRow
            icon="📅"
            title="Ny hendelse"
            subtitle="Trening, kamp eller sosialt"
            onPress={onNewEvent}
          />
        )}
      </View>
    </Modal>
  );
}

function SheetRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
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
    gap: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  rowIcon: {
    fontSize: 24,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
