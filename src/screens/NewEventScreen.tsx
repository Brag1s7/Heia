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
import {Button, DateField} from '../components';
import {useActiveTeam} from '../context';
import {
  createEvent,
  getBusyDays,
  getTournaments,
  type TournamentOption,
} from '../lib/api/events';
import {
  addDays,
  atTime,
  dayDiff,
  dayKey,
  dayRangeLabel,
  longDayLabel,
  startOfDay,
  type BusyDays,
} from '../shared/calendar';
import type {
  EventType,
  HomeStackParamList,
  RootTabParamList,
} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewEvent'>;

const DEFAULT_TIME = '18:00';

// Fortiden er åpen for trener/lagleder (Brage 2026-08-06): «vi spilte i går
// og glemte å legge den inn» er et ekte tilfelle, og kamprapporten henger på
// arrangementet. 30 dager er nok til å ta igjen en glemt kamp, og kort nok
// til at et feiltrykk ikke havner i forrige sesong.
// Skjermen er allerede rollestyrt — den nås kun via «+» for isTeamAdmin, og
// `create_event` avviser andre uansett (SECURITY DEFINER, 00019).
const DAYS_BACK = 30;
const MONTHS_AHEAD = 18;

// «Turnering» sto lenge KUN på sesongsiden («+ Ny turnering»), for å ha ett
// sted å lage dem. Brage 2026-08-06: den skal også ligge her, ved siden av
// trening og kamp — det er her man er når man planlegger noe.
// Sesongsidens inngang består; begge sender til samme skjema.
const TYPE_OPTIONS: {value: EventType; label: string}[] = [
  {value: 'trening', label: 'Trening'},
  {value: 'kamp', label: 'Kamp'},
  {value: 'turnering', label: 'Turnering'},
  {value: 'sosialt', label: 'Sosialt'},
  {value: 'annet', label: 'Annet'},
];

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

  // Turneringens datoer arves ned til kampen: den åpner PÅ turneringens
  // første dag, og vi sier fra hvis den havner utenfor perioden.
  const parentFrom = route.params?.parentFrom
    ? startOfDay(new Date(route.params.parentFrom))
    : undefined;
  const parentTo = route.params?.parentTo
    ? startOfDay(new Date(route.params.parentTo))
    : undefined;

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

  const today = useMemo(() => startOfDay(new Date()), []);
  const [day, setDay] = useState<Date>(parentFrom ?? today);
  // Turneringens sluttdato. Standard er SAMME dag som starten, så en
  // endagsturnering er like rask som før (Brage 2026-08-06).
  const [endDay, setEndDay] = useState<Date>(parentFrom ?? today);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [saving, setSaving] = useState(false);

  // ⚠️ OPPMØTETID SPØRRES DET IKKE OM HER (Brage 2026-08-06). Kolonnen
  // `meeting_time`, RPC-parameteren og påminnelsen i 00055 står urørt og
  // virker for eksisterende data — men nye arrangementer setter den ikke,
  // og påminnelsen sier derfor «kampen starter om én time». Det er et
  // bevisst valg, ikke en mangel: sluttid som klokkeslett og varighets-
  // chipsene er borte av samme grunn, og skal ikke tilbake.
  //
  // `end_time` settes fortsatt for ÉN type: turneringen, der den bærer
  // SLUTTDATOEN og ikke et klokkeslett. Se performSave.

  // Prikkene i kalenderen. Hentes ved åpning, men kalenderen venter ALDRI på
  // dem — feiler kallet, mangler bare prikkene.
  const [busy, setBusy] = useState<BusyDays | undefined>(undefined);
  const [busyLoading, setBusyLoading] = useState(true);

  useEffect(() => {
    if (!activeTeamSpaceId) return;
    let cancelled = false;
    const from = addDays(today, -DAYS_BACK);
    const to = new Date(
      today.getFullYear(),
      today.getMonth() + MONTHS_AHEAD + 1,
      0,
      23,
      59,
      59,
    );
    getBusyDays(activeTeamSpaceId, from, to)
      .then(days => {
        if (!cancelled) setBusy(days);
      })
      .catch(() => {
        // Stille: prikkene er en hjelp, ikke en forutsetning.
      })
      .finally(() => {
        if (!cancelled) setBusyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTeamSpaceId, today]);

  const isMatch = type === 'kamp';
  const isTournament = type === 'turnering' || isNewTournament;

  const parsedTime = parseTime(time);
  const timeInvalid = time.length > 0 && !parsedTime;

  // Sluttdatoen kan aldri ligge før starten. Flytter man startdatoen forbi
  // den, følger sluttdatoen med — «samme dag» er standarden, og en dratt
  // startdato skal ikke lage en ugyldig periode i det stille.
  const setStartDay = useCallback((next: Date) => {
    setDay(next);
    setEndDay(prev => (dayDiff(prev, next) < 0 ? next : prev));
  }, []);

  // Kampen bør normalt ligge innenfor turneringens datoer. «Normalt» —
  // derfor en beskjed og ikke en sperre: en cup kan bli forlenget, og en
  // blokkert lagring ville vært verre enn en kamp på feil dag.
  const outsideParent =
    parentFrom !== undefined &&
    parentTo !== undefined &&
    (dayDiff(day, parentFrom) < 0 || dayDiff(day, parentTo) > 0);

  const canSave =
    !!activeTeamSpaceId &&
    parsedTime !== null &&
    (!isMatch || opponent.trim().length > 0);

  const startTime = parsedTime
    ? atTime(day, parsedTime.hours, parsedTime.minutes)
    : null;
  const startsInPast = startTime !== null && startTime.getTime() < Date.now();

  const performSave = useCallback(async () => {
    if (!activeTeamSpaceId || !parsedTime || !startTime || saving) return;

    setSaving(true);
    try {
      // `meetingTime` sendes ikke herfra — skjemaet spør ikke om det
      // (Brage 2026-08-06), og påminnelsen faller da til «starter om én
      // time». Kolonnen og RPC-parameteren står urørt for eksisterende data.
      //
      // `endTime` settes KUN for turneringer, og bærer da SLUTTDATOEN, ikke
      // et klokkeslett: siste dag kl. 23:59. Det gjør at en endagsturnering
      // også tilfredsstiller DB-kravet «end_time > start_time» (00019).
      await createEvent({
        teamSpaceId: activeTeamSpaceId,
        type,
        title: title.trim() || defaultTitle(type, opponent),
        startTime,
        endTime: isTournament ? atTime(endDay, 23, 59) : undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        opponent: isMatch ? opponent.trim() : undefined,
        isHome,
        parentEventId:
          parentEventId ??
          (isMatch ? selectedTournament ?? undefined : undefined),
      });
      // Hvor man lander (Brage 2026-08-06):
      //   fra Sesong          → tilbake til Sesong (goBack alene)
      //   fra turneringsside  → bli stående på turneringen
      //   ellers              → Kalender, PÅ hendelsens dato
      //
      // Turneringen vises nå i kalenderen som alle andre objekter, så det
      // er ingen grunn til å holde den unna lenger — men den skal treffes,
      // ikke ligge et sted i lista.
      navigation.goBack();
      if (!inTournament && !isNewTournament) {
        navigation
          .getParent<NavigationProp<RootTabParamList>>()
          ?.navigate('KalenderStack', {
            screen: 'KalenderList',
            params: {focusDate: dayKey(day)},
          });
      }
      if (isTournament) {
        Alert.alert(
          'Turneringen er opprettet',
          `${title.trim() || defaultTitle(type, opponent)} · ${dayRangeLabel(
            day,
            endDay,
          )}`,
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
    startTime,
    saving,
    type,
    title,
    opponent,
    location,
    description,
    isMatch,
    isTournament,
    endDay,
    day,
    isHome,
    parentEventId,
    inTournament,
    isNewTournament,
    selectedTournament,
    navigation,
  ]);

  /**
   * Fortiden er lov, men aldri ved et uhell. Bekreftelsen sier også hva som
   * IKKE skjer: en historisk hendelse gir ingen «ny hendelse»-varsling til
   * laget (migrasjon 00056). Uten den setningen ville stillheten sett ut
   * som en feil.
   */
  const handleSave = useCallback(() => {
    if (!startTime || saving) return;
    if (!startsInPast) {
      performSave();
      return;
    }
    Alert.alert(
      'Legge inn noe som har vært?',
      `${longDayLabel(day, today)} kl. ${time} er tilbake i tid. ` +
        'Hendelsen legges i kalenderen, men laget får ingen varsling om den.',
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Legg inn likevel',
          onPress: () => {
            performSave();
          },
        },
      ],
    );
  }, [startTime, saving, startsInPast, performSave, day, today, time]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing['3xl'],
        }}
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

        {/* Tittelen sto nest sist. Den er hendelsens navn, og hører hjemme
            der man nettopp bestemte hva hendelsen ER (Brages hurtigflyt:
            type → motstander/tittel → dato → klokkeslett → sted → beskjed). */}
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

        <Field label={isTournament ? 'Starter' : 'Dag'}>
          <DateField
            value={day}
            onChange={setStartDay}
            busy={busy}
            busyLoading={busyLoading}
            daysBack={DAYS_BACK}
            monthsAhead={MONTHS_AHEAD}
            disabled={saving}
          />
          {outsideParent && parentFrom && parentTo && (
            <Text style={styles.noteText}>
              Utenfor {parentTitle ?? 'turneringen'} (
              {dayRangeLabel(parentFrom, parentTo)}). Kampen lagres likevel.
            </Text>
          )}
        </Field>

        {/* En cup varer ofte en helg. Sluttdatoen står som SAMME dag til
            noen flytter den, så endagsturneringen er like rask som før. */}
        {isTournament && (
          <Field label="Slutter">
            <DateField
              value={endDay}
              onChange={setEndDay}
              busy={busy}
              busyLoading={busyLoading}
              minDate={day}
              monthsAhead={MONTHS_AHEAD}
              disabled={saving}
            />
            <Text style={styles.noteText}>
              {dayDiff(endDay, day) === 0
                ? 'Én dag'
                : `${dayDiff(endDay, day) + 1} dager · ${dayRangeLabel(
                    day,
                    endDay,
                  )}`}
            </Text>
          </Field>
        )}

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
          {timeInvalid && (
            <Text style={styles.errorText}>Skriv klokkeslettet som 18:00</Text>
          )}
          {startsInPast && !timeInvalid && (
            <Text style={styles.noteText}>
              Dette tidspunktet har vært. Laget får ingen varsling.
            </Text>
          )}
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
              // Turneringen havner ikke i kalenderen, så knappen kan ikke
              // love det. Gjelder begge inngangene til typen.
              isTournament || isNewTournament
                ? 'Opprett turnering'
                : 'Legg til i kalenderen'
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
function Field({label, children}: {label: string; children: React.ReactNode}) {
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
      accessibilityRole="button"
      accessibilityState={{selected}}
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
  // Ikke en feil — en konsekvens brukeren skal se før den lagres.
  noteText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
