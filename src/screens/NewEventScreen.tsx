import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {
  createEvent,
  getTournaments,
  type TournamentOption,
} from '../lib/api/events';
import type {
  EventType,
  HomeStackParamList,
  RootTabParamList,
} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewEvent'>;

const DAYS_AHEAD = 30;
const DEFAULT_TIME = '18:00';

// «Turnering» er bevisst IKKE et valg her — turneringer opprettes fra
// sesongsiden («+ Ny turnering»), som åpner denne modalen med presetType.
// Ett sted å lage dem = ingen tvil om hvor de bor.
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
    case 'turnering':
      return 'Turnering';
    case 'sosialt':
      return 'Sosialt';
    default:
      return 'Hendelse';
  }
}

export function NewEventScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const {activeTeamSpaceId} = useActiveTeam();

  // Tre innganger til modalen:
  //  - vanlig «Ny hendelse» (+): fri typevelger
  //  - «Ny kamp» fra en turneringsside: type låst til kamp + stemplet
  //  - «+ Ny turnering» fra sesongsiden: type låst til turnering
  // Låst type = typevelgeren skjules; en rad med døde chips skaper bare tvil.
  const parentEventId = route.params?.parentEventId;
  const parentTitle = route.params?.parentTitle;
  const inTournament = !!parentEventId;
  const isNewTournament = route.params?.presetType === 'turnering';

  const [type, setType] = useState<EventType>(
    isNewTournament ? 'turnering' : inTournament ? 'kamp' : 'trening',
  );
  // «Turnering»-feltet på en vanlig kamp: velges kun når det finnes noe å
  // velge i. null = vanlig seriekamp.
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Kun den frie flyten trenger listen — de låste inngangene vet alt.
    if (inTournament || isNewTournament || !activeTeamSpaceId) return;
    let cancelled = false;
    getTournaments(activeTeamSpaceId)
      .then(list => {
        if (!cancelled) setTournaments(list);
      })
      .catch(() => {
        // Stille: uten liste vises ikke feltet, og kampen blir en vanlig kamp.
      });
    return () => {
      cancelled = true;
    };
  }, [inTournament, isNewTournament, activeTeamSpaceId]);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [meetingTime, setMeetingTime] = useState('');
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
  const parsedMeeting = meetingTime.length > 0 ? parseTime(meetingTime) : null;
  // Oppmøte etter avspark er alltid en feil — DB-en avviser det også (00053),
  // men brukeren skal se det her, ikke i en Alert etter lagring.
  const meetingAfterStart =
    parsedTime !== null &&
    parsedMeeting !== null &&
    parsedMeeting.hours * 60 + parsedMeeting.minutes >
      parsedTime.hours * 60 + parsedTime.minutes;

  const isMatch = type === 'kamp';
  const canSave =
    !!activeTeamSpaceId &&
    parsedTime !== null &&
    (meetingTime.length === 0 || (parsedMeeting !== null && !meetingAfterStart)) &&
    (!isMatch || opponent.trim().length > 0);

  const handleSave = useCallback(async () => {
    if (!activeTeamSpaceId || !parsedTime || saving) return;

    const day = days[dayOffset].date;
    const startTime = new Date(day);
    startTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    const endTime = durationMinutes
      ? new Date(startTime.getTime() + durationMinutes * 60_000)
      : undefined;

    // Oppmøte hører til SAMME dag som starten.
    let meeting: Date | undefined;
    if (parsedMeeting && !meetingAfterStart) {
      meeting = new Date(day);
      meeting.setHours(parsedMeeting.hours, parsedMeeting.minutes, 0, 0);
    }

    setSaving(true);
    try {
      await createEvent({
        teamSpaceId: activeTeamSpaceId,
        type,
        title: title.trim() || defaultTitle(type, opponent),
        startTime,
        endTime,
        meetingTime: meeting,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        opponent: isMatch ? opponent.trim() : undefined,
        isHome,
        parentEventId:
          parentEventId ?? (isMatch ? (selectedTournament ?? undefined) : undefined),
      });
      // Lukk modalen. Frittstående hendelser: vis kalenderen (den refetcher
      // ved fokus). Fra turneringsside/sesongside: bli stående der brukeren
      // kom fra — det er der resultatet av handlingen vises (en turnering
      // ligger ikke i kalenderen i det hele tatt).
      navigation.goBack();
      if (!inTournament && !isNewTournament) {
        navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate(
          'KalenderStack',
        );
      }
    } catch {
      Alert.alert('Kunne ikke lagre', 'Prøv igjen om litt.');
    } finally {
      setSaving(false);
    }
  }, [
    activeTeamSpaceId,
    parsedTime,
    parsedMeeting,
    meetingAfterStart,
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
    parentEventId,
    inTournament,
    isNewTournament,
    selectedTournament,
    navigation,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        keyboardShouldPersistTaps="handled">
        {inTournament || isNewTournament ? (
          <Field label="Hva skjer?">
            <View style={styles.tournamentBanner}>
              <Text style={styles.tournamentBannerText}>
                {isNewTournament
                  ? 'Turnering'
                  : `Kamp i ${parentTitle ?? 'turneringen'}`}
              </Text>
            </View>
          </Field>
        ) : (
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
        )}

        {/* Kampen kan høre til en turnering — HVIS laget har en aktuell.
            Ingen turneringer = feltet finnes ikke, og kampen er en vanlig
            seriekamp (brukerens modell, 2026-07-30). */}
        {isMatch && !inTournament && tournaments.length > 0 && (
          <Field label="Turnering">
            <View style={styles.chipRow}>
              <SelectChip
                label="Ingen"
                selected={selectedTournament === null}
                onPress={() => setSelectedTournament(null)}
              />
              {tournaments.map(tournament => (
                <SelectChip
                  key={tournament.id}
                  label={tournament.title}
                  selected={selectedTournament === tournament.id}
                  onPress={() => setSelectedTournament(tournament.id)}
                />
              ))}
            </View>
          </Field>
        )}

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

        {/* Oppmøte er frivillig, men det er DEN klokka foreldre planlegger
            etter — og påminnelsen én time før bruker den når den finnes
            (00053/00055). Uten oppmøtetid minner vi om starten i stedet. */}
        <Field label="Oppmøte (valgfritt)">
          <TextInput
            style={[styles.input, styles.timeInput]}
            value={meetingTime}
            onChangeText={raw => setMeetingTime(maskTime(raw))}
            placeholder={parsedTime ? 'F.eks. 17:30' : '17:30'}
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={5}
            editable={!saving}
          />
          {meetingTime.length > 0 && !parsedMeeting && (
            <Text style={styles.errorText}>Skriv oppmøtet som 17:30</Text>
          )}
          {meetingAfterStart && (
            <Text style={styles.errorText}>
              Oppmøtet må være før eller likt starten
            </Text>
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
            title={
              isNewTournament ? 'Opprett turnering' : 'Legg til i kalenderen'
            }
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
    ...typography.input,
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
  // Låst kontekst («Kamp i Hamar Cup») — turneringens myke gulflate.
  tournamentBanner: {
    backgroundColor: colors.sun,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
  },
  tournamentBannerText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.goldInk,
  },
});
