import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {Button} from '../components';
import {useActiveTeam} from '../context';
import {createEvent} from '../lib/api/events';
import type {
  EventType,
  HomeStackParamList,
  RootTabParamList,
} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewEvent'>;

const DAYS_AHEAD = 30;
const DEFAULT_TIME = '18:00';

const TYPE_OPTIONS: {value: EventType; label: string}[] = [
  {value: 'trening', label: 'Trening'},
  {value: 'kamp', label: 'Kamp'},
  {value: 'sosialt', label: 'Sosialt'},
  {value: 'annet', label: 'Annet'},
];

const DURATION_OPTIONS: {minutes: number | null; label: string}[] = [
  {minutes: 60, label: '1 t'},
  {minutes: 90, label: '1½ t'},
  {minutes: 120, label: '2 t'},
  {minutes: null, label: 'Ingen sluttid'},
];

const weekdaysShort = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
const monthsShort = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
];

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayLabel(date: Date, offset: number): string {
  if (offset === 0) return 'I dag';
  if (offset === 1) return 'I morgen';
  return `${weekdaysShort[date.getDay()]} ${date.getDate()}. ${monthsShort[date.getMonth()]}`;
}

/** Tvinger inndata mot HH:MM mens brukeren skriver, uten native picker. */
function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseTime(value: string): {hours: number; minutes: number} | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return {hours, minutes};
}

/** Tittel er valgfri i UI-et — DB krever den, så vi fyller inn en fornuftig. */
function defaultTitle(type: EventType, opponent: string): string {
  switch (type) {
    case 'trening':
      return 'Trening';
    case 'kamp':
      return opponent.trim() ? `Kamp mot ${opponent.trim()}` : 'Kamp';
    case 'sosialt':
      return 'Sosialt';
    default:
      return 'Hendelse';
  }
}

export function NewEventScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {activeTeamSpaceId} = useActiveTeam();

  const [type, setType] = useState<EventType>('trening');
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(90);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => {
    const base = startOfToday();
    return Array.from({length: DAYS_AHEAD}, (_, offset) => {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      return {offset, date, label: dayLabel(date, offset)};
    });
  }, []);

  const parsedTime = parseTime(time);
  const isMatch = type === 'kamp';
  const canSave =
    !!activeTeamSpaceId &&
    parsedTime !== null &&
    (!isMatch || opponent.trim().length > 0);

  const handleSave = useCallback(async () => {
    if (!activeTeamSpaceId || !parsedTime || saving) return;

    const day = days[dayOffset].date;
    const startTime = new Date(day);
    startTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    const endTime = durationMinutes
      ? new Date(startTime.getTime() + durationMinutes * 60_000)
      : undefined;

    setSaving(true);
    try {
      await createEvent({
        teamSpaceId: activeTeamSpaceId,
        type,
        title: title.trim() || defaultTitle(type, opponent),
        startTime,
        endTime,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        opponent: isMatch ? opponent.trim() : undefined,
        isHome,
      });
      // Lukk modalen og vis kalenderen — den refetcher ved fokus, så brukeren
      // ser hendelsen sin i stedet for at skjermen bare forsvinner.
      navigation.goBack();
      navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate(
        'KalenderStack',
      );
    } catch {
      Alert.alert('Kunne ikke lagre', 'Prøv igjen om litt.');
    } finally {
      setSaving(false);
    }
  }, [
    activeTeamSpaceId,
    parsedTime,
    saving,
    days,
    dayOffset,
    durationMinutes,
    type,
    title,
    opponent,
    location,
    description,
    isMatch,
    isHome,
    navigation,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        keyboardShouldPersistTaps="handled">
        <Field label="Hva skjer?">
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map(option => (
              <SelectChip
                key={option.value}
                label={option.label}
                selected={type === option.value}
                onPress={() => setType(option.value)}
              />
            ))}
          </View>
        </Field>

        {isMatch && (
          <>
            <Field label="Motstander">
              <TextInput
                style={styles.input}
                value={opponent}
                onChangeText={setOpponent}
                placeholder="Lyn"
                placeholderTextColor={colors.textTertiary}
                editable={!saving}
              />
            </Field>

            <Field label="Hjemme eller borte?">
              <View style={styles.chipRow}>
                <SelectChip
                  label="Hjemme"
                  selected={isHome}
                  onPress={() => setIsHome(true)}
                />
                <SelectChip
                  label="Borte"
                  selected={!isHome}
                  onPress={() => setIsHome(false)}
                />
              </View>
            </Field>
          </>
        )}

        <Field label="Dag">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}>
            {days.map(day => (
              <SelectChip
                key={day.offset}
                label={day.label}
                selected={dayOffset === day.offset}
                onPress={() => setDayOffset(day.offset)}
              />
            ))}
          </ScrollView>
        </Field>

        <Field label="Klokkeslett">
          <TextInput
            style={[styles.input, styles.timeInput]}
            value={time}
            onChangeText={raw => setTime(maskTime(raw))}
            placeholder="18:00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={5}
            editable={!saving}
          />
          {time.length > 0 && !parsedTime && (
            <Text style={styles.errorText}>Skriv klokkeslettet som 18:00</Text>
          )}
        </Field>

        <Field label="Varighet">
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map(option => (
              <SelectChip
                key={option.label}
                label={option.label}
                selected={durationMinutes === option.minutes}
                onPress={() => setDurationMinutes(option.minutes)}
              />
            ))}
          </View>
        </Field>

        <Field label="Sted">
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Kunstgresset"
            placeholderTextColor={colors.textTertiary}
            editable={!saving}
          />
        </Field>

        <Field label="Tittel">
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={defaultTitle(type, opponent)}
            placeholderTextColor={colors.textTertiary}
            editable={!saving}
          />
        </Field>

        <Field label="Beskjed til laget">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Husk shorts og drikkeflaske…"
            placeholderTextColor={colors.textTertiary}
            multiline
            editable={!saving}
          />
        </Field>

        <View style={styles.saveRow}>
          <Button
            title="Legg til i kalenderen"
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Hjelpkomponenter
// ---------------------------------------------------------------------------
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.selectChip,
        selected && styles.selectChipSelected,
        pressed && !selected && styles.selectChipPressed,
      ]}>
      <Text
        style={[
          styles.selectChipText,
          selected && styles.selectChipTextSelected,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Stiler
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  field: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  // Samme caps-uttrykk som seksjonsetikettene (A v2).
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  selectChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectChipSelected: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  selectChipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  selectChipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  selectChipTextSelected: {
    color: colors.heiaInk,
    fontWeight: '700',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  // Klokkeslettet er skjermens tall — stort og stolt i displayfonten (A v2).
  timeInput: {
    alignSelf: 'flex-start',
    minWidth: 108,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: fonts.display,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  saveRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
  },
});
