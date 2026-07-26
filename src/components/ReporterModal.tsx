import React, {useState} from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {Button} from './Button';
import type {ReporterActionType} from './ReporterActions';

interface ReporterModalProps {
  visible: boolean;
  actionType: ReporterActionType;
  onSubmit: (description: string) => void;
  onCancel: () => void;
}

// Pause og «andre omgang» åpner aldri modalen (rene av/på-trykk), men Record-en
// må dekke hele unionen.
const actionLabels: Record<ReporterActionType, string> = {
  mål_oss: 'Mål for oss',
  mål_dem: 'Mål for motstander',
  pause: 'Pause',
  andre_omgang: 'Andre omgang',
  slutt: 'Kampslutt',
  melding: 'Kommentar',
};

export function ReporterModal({
  visible,
  actionType,
  onSubmit,
  onCancel,
}: ReporterModalProps) {
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit(description.trim());
    setDescription('');
  };

  const title = actionLabels[actionType];
  const isComment = actionType === 'melding';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modal}>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                {isComment ? 'Melding' : 'Kort beskrivelse (valgfritt)'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  isComment
                    ? 'Skriv melding...'
                    : 'F.eks. "Erlend med heading"'
                }
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            <View style={styles.buttons}>
              <Button
                title="Avbryt"
                variant="ghost"
                onPress={() => {
                  setDescription('');
                  onCancel();
                }}
                style={styles.button}
              />
              <Button
                title="Rapporter"
                variant="primary"
                onPress={handleSubmit}
                disabled={isComment && !description.trim()}
                style={styles.button}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    gap: spacing.xl,
  },
  title: {
    ...typography.heading2,
    textAlign: 'center',
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
});
