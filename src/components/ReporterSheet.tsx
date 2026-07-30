import React, {useState} from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import type {User} from '../shared/types';

interface ReporterSheetProps {
  visible: boolean;
  members: User[];
  currentReporterId?: string;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

export function ReporterSheet({
  visible,
  members,
  currentReporterId,
  onSelect,
  onClose,
}: ReporterSheetProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = search
    ? members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  const handleSelect = (userId: string) => {
    setSearch('');
    onSelect(userId);
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Velg kampreporter</Text>

        <TextInput
          style={styles.search}
          placeholder="Søk etter navn..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => {
            const isCurrent = item.id === currentReporterId;
            return (
              <Pressable
                style={({pressed}) => [
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => handleSelect(item.id)}>
                <Avatar name={item.name} size="sm" />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.role === 'trener' && (
                    <Text style={styles.rowRole}>Trener</Text>
                  )}
                </View>
                {isCurrent && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>Ingen treff</Text>
          }
        />
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
    maxHeight: '70%',
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
    marginBottom: spacing.md,
  },
  search: {
    ...typography.body,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    borderRadius: radius.md,
  },
  rowCurrent: {
    backgroundColor: colors.heiaSoft,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...typography.body,
    fontWeight: '500',
  },
  rowRole: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  // heiaInk, ikke #02FFAB — mint er kun fyll på lys flate (A v2-regel).
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.heiaInk,
  },
  empty: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
