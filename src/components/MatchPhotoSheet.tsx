import React, {useState} from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {Button} from './Button';
import {Check} from './icons';
import type {MatchEvent, MatchEventType} from '../shared/types';

interface MatchPhotoSheetProps {
  visible: boolean;
  /** Lokal URI på bildet som er valgt, til forhåndsvisning. */
  imageUri: string | null;
  /** Kamphendelsene bildet kan festes til. Tom liste er helt greit. */
  matchEvents: MatchEvent[];
  publishing?: boolean;
  onPublish: (caption: string, matchEventId?: string) => void;
  onCancel: () => void;
}

const eventIcons: Record<MatchEventType, string> = {
  avspark: '⚽',
  mål: '⚽',
  pause: '⏸',
  andre_omgang: '▶',
  slutt: '🏁',
  bytte: '↔',
  kort: '🟨',
  melding: '💬',
};

/** «⚽ 34' Mål oss» — nok til å kjenne igjen øyeblikket, kort nok til én linje. */
function eventLabel(event: MatchEvent): string {
  const icon = eventIcons[event.type];
  return `${icon} ${event.minute}' ${event.description}`;
}

/**
 * Siste steg når reporteren har valgt et bilde: skriv en valgfri tekst, og
 * bestem om bildet hører til kampen generelt eller til ett bestemt øyeblikk.
 *
 * Koblingen til selve kampen er ikke et valg her — den er alltid der. Det
 * eneste valget er hvor presist bildet skal henge.
 */
export function MatchPhotoSheet({
  visible,
  imageUri,
  matchEvents,
  publishing = false,
  onPublish,
  onCancel,
}: MatchPhotoSheetProps) {
  const [caption, setCaption] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  const reset = () => {
    setCaption('');
    setSelectedEventId(undefined);
  };

  const handlePublish = () => {
    onPublish(caption.trim(), selectedEventId);
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  // Nyeste øyeblikk øverst: bildet er som regel av det som nettopp skjedde.
  const options = matchEvents.slice().reverse();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Legg ut kampbilde</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled">
              {imageUri && (
                <Image
                  source={{uri: imageUri}}
                  style={styles.preview}
                  resizeMode="cover"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Skriv noe om bildet (valgfritt)"
                placeholderTextColor={colors.textTertiary}
                value={caption}
                onChangeText={setCaption}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Hva viser bildet?</Text>

              <Pressable
                onPress={() => setSelectedEventId(undefined)}
                style={({pressed}) => [
                  styles.option,
                  selectedEventId === undefined && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}>
                <Text style={styles.optionText} numberOfLines={1}>
                  📸 Generelt kampbilde
                </Text>
                {selectedEventId === undefined && (
                  <Check size={17} color={colors.heiaInk} strokeWidth={2.4} />
                )}
              </Pressable>

              {options.map(me => {
                const selected = selectedEventId === me.id;
                return (
                  <Pressable
                    key={me.id}
                    onPress={() => setSelectedEventId(me.id)}
                    style={({pressed}) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}>
                    <Text style={styles.optionText} numberOfLines={1}>
                      {eventLabel(me)}
                    </Text>
                    {selected && (
                      <Check size={17} color={colors.heiaInk} strokeWidth={2.4} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                title="Avbryt"
                variant="ghost"
                onPress={handleCancel}
                disabled={publishing}
                style={styles.action}
              />
              <Button
                title={publishing ? 'Legger ut…' : 'Legg ut'}
                variant="primary"
                onPress={handlePublish}
                disabled={publishing}
                style={styles.action}
              />
            </View>

            {publishing && (
              <ActivityIndicator
                color={colors.heiaPressed}
                style={styles.spinner}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    ...typography.heading3,
    textAlign: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
    color: colors.textPrimary,
  },
  label: {
    ...typography.label,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  optionSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  optionPressed: {
    backgroundColor: colors.background,
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
  spinner: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
  },
});
