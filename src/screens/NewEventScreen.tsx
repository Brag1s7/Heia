import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
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
import {colors, typography, spacing, radius} from '../theme';
import {Button, DateField, TimeField} from '../components';
import {useActiveTeam} from '../context';
import {
  createEvent,
  getBusyDays,
  getEventForEdit,
  getTournaments,
  updateEvent,
  type TournamentOption,
} from '../lib/api/events';
import {
  addDays,
  dateFromDayKey,
  dayDiff,
  dayKey,
  dayRangeLabel,
  longDayLabel,
  startOfDay,
  type BusyDays,
} from '../shared/calendar';
import {
  buildSavePayload,
  changedEventFields,
  defaultTitle,
  eventIsUpcoming,
  formValuesFromEvent,
  willNotifyTeam,
  type EditableEvent,
  type EventFormValues,
} from '../shared/eventForm';
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

/** Typen som ren opplysning når den er låst (redigering). */
const TYPE_LABEL: Record<EventType, string> = {
  trening: 'Trening',
  kamp: 'Kamp',
  turnering: 'Turnering',
  sosialt: 'Sosialt',
  annet: 'Hendelse',
};

export function NewEventScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const {activeTeamSpaceId} = useActiveTeam();

  // Skjermen er TOSIDIG (Brage 2026-08-07). `eventId` = redigering av det
  // arrangementet; ellers oppretter vi et nytt. Det er den ENESTE forskjellen
  // i selve skjemaet — feltene, datovelgeren og regnestykkene er de samme, og
  // et eget redigeringsskjema ville betydd to steder å holde i synk.
  const editEventId = route.params?.eventId;
  const isEdit = !!editEventId;

  // Fire innganger til modalen:
  //  - vanlig «Ny hendelse» (+): fri typevelger
  //  - «Ny kamp» fra en turneringsside: type låst til kamp + stemplet
  //  - «+ Ny turnering» fra sesongsiden: type låst til turnering
  //  - «Rediger» fra en hendelsesside: alt prefylt, typen låst
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
    // Kun den frie flyten trenger listen — de låste inngangene vet alt, og
    // redigering flytter ikke en kamp mellom turneringer (egen skive).
    if (isEdit || inTournament || isNewTournament || !activeTeamSpaceId) return;
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
  }, [isEdit, inTournament, isNewTournament, activeTeamSpaceId]);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Datoen fra Kalender-fanen: står du på 22. august og trykker «+», er det
  // den dagen du vil planlegge. Ligger den utenfor det skjemaet uansett
  // tillater (mer enn 30 dager tilbake, eller lenger fram enn 18 måneder),
  // faller vi tilbake til i dag i stedet for å åpne på en dag som ikke kan
  // lagres. Fortiden INNENFOR grensen slippes gjennom — bekreftelsen ved
  // lagring er allerede regelen der (00056).
  const presetDay = useMemo(() => {
    const parsed = route.params?.presetDate
      ? dateFromDayKey(route.params.presetDate)
      : null;
    if (!parsed) return null;
    const lastAllowed = new Date(
      today.getFullYear(),
      today.getMonth() + MONTHS_AHEAD + 1,
      0,
    );
    const inRange =
      dayDiff(parsed, addDays(today, -DAYS_BACK)) >= 0 &&
      dayDiff(parsed, lastAllowed) <= 0;
    return inRange ? parsed : null;
  }, [route.params?.presetDate, today]);

  const [day, setDay] = useState<Date>(parentFrom ?? presetDay ?? today);
  // Turneringens sluttdato. Standard er SAMME dag som starten, så en
  // endagsturnering er like rask som før (Brage 2026-08-06).
  const [endDay, setEndDay] = useState<Date>(
    parentFrom ?? presetDay ?? today,
  );
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
  // SLUTTDATOEN og ikke et klokkeslett. Se `resolveEndTime`.
  //
  // ⚠️ VED REDIGERING arves BEGGE feltene fra det lagrede arrangementet i
  // stedet for å bli tømt — `update_event` er en full erstatning, og et
  // arrangement fra før 2026-08-06 skal ikke miste sluttiden eller oppmøtet
  // fordi noen rettet et stedsnavn. Regnestykket bor i `shared/eventForm.ts`.

  // Arrangementet vi redigerer, slik det ligger i basen. `null` i
  // opprettelsesmodus — og fram til hentingen er ferdig.
  const [original, setOriginal] = useState<EditableEvent | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!editEventId || !activeTeamSpaceId) return;
    let cancelled = false;
    getEventForEdit(editEventId, activeTeamSpaceId)
      .then(event => {
        if (cancelled) return;
        // ÉN kilde til prefyllingen, og den er delt med testene. Feltene
        // settes samlet så skjemaet aldri står halvfylt.
        const values = formValuesFromEvent(event);
        setType(values.type);
        setTitle(values.title);
        setDay(values.day);
        setEndDay(values.endDay);
        setTime(values.time);
        setLocation(values.location);
        setDescription(values.description);
        setOpponent(values.opponent);
        setIsHome(values.isHome);
        setOriginal(event);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editEventId, activeTeamSpaceId]);

  // Hvor langt tilbake datovelgeren rekker. 30 dager ved opprettelse — men
  // redigerer man en kamp fra i vår, MÅ dens egen dato være innenfor
  // rekkevidde, ellers kan man ikke velge den tilbake igjen etter et
  // feiltrykk. Vinduet strekkes derfor til å dekke arrangementet selv.
  //
  // ⚠️ Står FØR prikkehentingen med vilje: den henter samme vindu. Hentet vi
  // bare 30 dager tilbake, ville hver måned før det stått uten prikker mens
  // cellene fortsatt var trykkbare — «ingenting den måneden» er en løgn.
  const daysBack = useMemo(() => {
    if (!original) return DAYS_BACK;
    return Math.max(DAYS_BACK, -dayDiff(original.startTime, today));
  }, [original, today]);

  // Prikkene i kalenderen. Hentes ved åpning, men kalenderen venter ALDRI på
  // dem — feiler kallet, mangler bare prikkene.
  const [busy, setBusy] = useState<BusyDays | undefined>(undefined);
  const [busyLoading, setBusyLoading] = useState(true);

  useEffect(() => {
    if (!activeTeamSpaceId) return;
    let cancelled = false;
    const from = addDays(today, -daysBack);
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
  }, [activeTeamSpaceId, today, daysBack]);

  const isMatch = type === 'kamp';
  const isTournament = type === 'turnering' || isNewTournament;

  // ⛔ Ingen «ugyldig klokkeslett»-tilstand lenger. `TimeField` er et
  // rutenett, så `time` kan bare være en verdi den selv har sendt — det
  // maskerte tekstfeltet var det eneste som kunne produsere «17:75».
  // `buildSavePayload` validerer fortsatt, som siste skanse.

  // Skjemaets verdier samlet, slik `shared/eventForm.ts` vil ha dem. Det er
  // DENNE formen regnestykkene og testene deler — skjermen holder bare
  // tilstanden, den regner ikke selv.
  const values: EventFormValues = useMemo(
    () => ({
      type: isTournament ? 'turnering' : type,
      title,
      day,
      endDay,
      time,
      location,
      description,
      opponent,
      isHome,
    }),
    [
      isTournament,
      type,
      title,
      day,
      endDay,
      time,
      location,
      description,
      opponent,
      isHome,
    ],
  );

  const payload = useMemo(
    () => buildSavePayload(values, original ?? undefined),
    [values, original],
  );

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
    payload !== null &&
    (!isEdit || original !== null) &&
    (!isMatch || opponent.trim().length > 0);

  const startTime = payload?.startTime ?? null;
  const startsInPast = startTime !== null && !eventIsUpcoming(startTime);

  // ⚠️ Speiler vakten i 00057, ikke en gjetning: laget varsles kun når
  // arrangementet fortsatt ligger fram i tid OG et felt databasen faktisk ser
  // på er endret. Uten den ville skjemaet lovet en push som aldri kom — eller
  // tiet om en som kom.
  const notifiesTeam =
    isEdit && original !== null && payload !== null
      ? willNotifyTeam(original, payload)
      : false;

  const unchanged =
    isEdit &&
    original !== null &&
    payload !== null &&
    changedEventFields(original, payload).length === 0;

  const performSave = useCallback(async () => {
    if (!activeTeamSpaceId || !payload || saving) return;

    setSaving(true);
    try {
      if (isEdit && original) {
        // FULL erstatning (00057). `endTime` og `meetingTime` kommer med fra
        // `buildSavePayload`, som arver dem fra det lagrede arrangementet —
        // ellers ville en rettelse av stedsnavnet slettet dem.
        await updateEvent({
          eventId: original.id,
          title: payload.title,
          startTime: payload.startTime,
          endTime: payload.endTime,
          meetingTime: payload.meetingTime,
          location: payload.location,
          description: payload.description,
          opponent: payload.opponent,
          isHome: payload.isHome,
        });
        // Tilbake dit man kom fra — hendelsessiden, som henter seg selv på
        // nytt ved fokus. Å kaste brukeren over i Kalender etter en rettelse
        // ville mistet stedet hun sto.
        navigation.goBack();
        return;
      }

      // `meetingTime` sendes ikke ved OPPRETTELSE — skjemaet spør ikke om det
      // (Brage 2026-08-06), og påminnelsen faller da til «starter om én
      // time». Kolonnen og RPC-parameteren står urørt for eksisterende data.
      //
      // `endTime` settes KUN for turneringer, og bærer da SLUTTDATOEN, ikke
      // et klokkeslett: siste dag kl. 23:59. Det gjør at en endagsturnering
      // også tilfredsstiller DB-kravet «end_time > start_time» (00019).
      await createEvent({
        teamSpaceId: activeTeamSpaceId,
        type,
        title: payload.title,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location: payload.location,
        description: payload.description,
        opponent: payload.opponent,
        isHome: payload.isHome,
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
          `${payload.title} · ${dayRangeLabel(day, endDay)}`,
        );
      }
    } catch {
      Alert.alert(
        isEdit ? 'Kunne ikke lagre endringen' : 'Kunne ikke lagre',
        'Prøv igjen om litt.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    activeTeamSpaceId,
    payload,
    saving,
    isEdit,
    original,
    type,
    isMatch,
    isTournament,
    endDay,
    day,
    parentEventId,
    inTournament,
    isNewTournament,
    selectedTournament,
    navigation,
  ]);

  /**
   * Fortiden er lov, men aldri ved et uhell. Bekreftelsen sier også hva som
   * IKKE skjer: en historisk hendelse gir ingen «ny hendelse»-varsling til
   * laget (migrasjon 00056), og en historisk ENDRING gir ingen
   * endringsvarsling (00057). Uten de setningene ville stillheten sett ut
   * som en feil.
   *
   * ⚠️ Ved redigering spør vi bare når lagringen FLYTTER arrangementet inn i
   * fortiden. Retter man et sted på en kamp som ble spilt i forrige uke, er
   * fortiden hele poenget — da er dialogen støy, og notatet under
   * klokkeslettet sier allerede at laget ikke varsles.
   */
  const movesIntoPast =
    startsInPast &&
    (!isEdit || !original || eventIsUpcoming(original.startTime));

  const handleSave = useCallback(() => {
    if (!payload || saving) return;
    // Ingenting er endret: å sende en tom lagring ville bare vært en rundtur
    // til serveren. Basen ville uansett ikke skrevet et varsel.
    if (unchanged) {
      navigation.goBack();
      return;
    }
    if (!movesIntoPast) {
      performSave();
      return;
    }
    Alert.alert(
      isEdit ? 'Flytte den tilbake i tid?' : 'Legge inn noe som har vært?',
      `${longDayLabel(day, today)} kl. ${time} er tilbake i tid. ` +
        (isEdit
          ? 'Endringen lagres, men laget får ingen varsling om den.'
          : 'Hendelsen legges i kalenderen, men laget får ingen varsling om den.'),
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: isEdit ? 'Flytt likevel' : 'Legg inn likevel',
          onPress: () => {
            performSave();
          },
        },
      ],
    );
  }, [
    payload,
    saving,
    unchanged,
    movesIntoPast,
    performSave,
    isEdit,
    day,
    today,
    time,
    navigation,
  ]);

  // Redigering venter på arrangementet. Å tegne et tomt skjema først og fylle
  // det ut et øyeblikk senere ville sett ut som at feltene ble slettet.
  if (isEdit && !original) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {loadError ? (
          <Text style={styles.errorText}>Kunne ikke hente hendelsen.</Text>
        ) : (
          <ActivityIndicator color={colors.heiaInk} />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing['3xl'],
        }}
        keyboardShouldPersistTaps="handled">
        {/* Typen kan ikke endres på et arrangement som finnes: en trening som
            blir en kamp trenger en match_session, og det er ikke en rettelse
            (00057). En rad med døde chips ville bare invitert til et trykk
            som ikke gjør noe. */}
        {isEdit ? (
          <Field label="Hva skjer?">
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedBannerText}>
                {TYPE_LABEL[type] ?? 'Hendelse'}
              </Text>
            </View>
          </Field>
        ) : inTournament || isNewTournament ? (
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
            daysBack={daysBack}
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
          <TimeField value={time} onChange={setTime} disabled={saving} />
          {startsInPast && (
            <Text style={styles.noteText}>
              Dette tidspunktet har vært. Laget får ingen varsling.
            </Text>
          )}
          {/* Sier sant om konsekvensen FØR trykket. Vakten i 00057 og denne
              setningen regnes ut av samme funksjon — de kan ikke komme i
              utakt. */}
          {notifiesTeam && (
            <Text style={styles.noteText}>
              Laget får én beskjed om det du har endret.
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
              // Redigering LOVER ingenting om hvor noe havner — det ligger
              // allerede der. Turneringen havner ikke i kalenderen, så
              // knappen kan ikke love det heller.
              isEdit
                ? 'Lagre endringer'
                : isTournament || isNewTournament
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
  // `timeInput` er FJERNET (2026-08-07). Klokkeslettet er ikke lenger et
  // tekstfelt — det er `TimeField`, som eier sin egen typografi. Det store
  // tallet i displayfonten bor der nå.
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
  // Låst type ved redigering. Nøytral flate, ikke turneringens gule: dette
  // er en opplysning om hva hendelsen ER, ikke en kontekst man har valgt.
  lockedBanner: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
  },
  lockedBannerText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
