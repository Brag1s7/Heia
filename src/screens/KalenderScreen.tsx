import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  AppState,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  Button,
  CalendarNav,
  EventCard,
  EventCardSkeleton,
  LiveBadge,
  MonthSheet,
  Skeleton,
  TeamHeader,
  TournamentDayCard,
  WeekStrip,
  useReducedMotion,
} from '../components';
import {useActiveTeam, useCalendarFocus} from '../context';
import {getTeamEvents} from '../lib/api/events';
import {isTeamAdmin} from '../shared/roles';
import {
  MONTHS,
  addDays,
  dateFromDayKey,
  dayContentLabel,
  dayDiff,
  dayKey,
  longDayLabel,
  startOfDay,
  startOfWeek,
} from '../shared/calendar';
import {
  buildCalendarRows,
  busyDaysFromRows,
  groupByDay,
  rowEvents,
  rowsFrom,
  type DaySection,
} from '../shared/calendarList';
import type {
  EventType,
  KalenderStackParamList,
  HeiaEvent,
} from '../shared/types';

type Nav = NativeStackNavigationProp<KalenderStackParamList, 'KalenderList'>;
type Route = RouteProp<KalenderStackParamList, 'KalenderList'>;

/** Luft over dagsoverskriften vi ruller til. */
const SCROLL_GAP = spacing.sm;

/**
 * ⚠️ Stabil identitet, på modulnivå. `ScrollView` kjører
 * `React.Children.toArray` og mapper indekser mot det resultatet, og et nytt
 * array hver render river den native scroll→Animated-koblingen ned og opp
 * igjen. Indeks 1 er navigatoren, og barnelista er derfor låst til NØYAKTIG
 * tre elementer: tittelblokk, navigator, og ETT fragment med resten.
 * Et fragment teller som ett barn; et array ville blitt flatet ut og flyttet
 * indeksen.
 */
const STICKY_INDICES = [1];

/**
 * Holder synlig innhold i ro når historikk settes inn OVER agendaen.
 * Stabil identitet av samme grunn som `STICKY_INDICES`.
 */
const MAINTAIN_POSITION = {minIndexForVisible: 0} as const;

/**
 * Hvorfor agendaen skal flytte seg. Det finnes BARE fire grunner, og alle er
 * en handling brukeren gjorde — aldri en tilstand som endret seg.
 */
type ScrollOrigin = 'ukerad' | 'månedsark' | 'i-dag' | 'neste' | 'opprettet';

export function KalenderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {activeTeamSpaceId, activeRole} = useActiveTeam();
  const reducedMotion = useReducedMotion();
  const calendarFocus = useCalendarFocus();

  const canCreate = isTeamAdmin(activeRole);

  // -------------------------------------------------------------------------
  // «I dag» er en TILSTAND, ikke en konstant
  //
  // Datovelgeren fryser dagen ved montering, og det er riktig for en modal.
  // Kalender er en fane man legger fra seg på sidelinja og tar opp igjen dagen
  // etter — da må «I dag» ha flyttet seg, ellers står gårsdagens kamp under
  // overskriften «I dag».
  // -------------------------------------------------------------------------
  const [today, setToday] = useState(() => startOfDay(new Date()));

  const refreshToday = useCallback(() => {
    setToday(prev => {
      const now = startOfDay(new Date());
      return dayKey(now) === dayKey(prev) ? prev : now;
    });
  }, []);

  useEffect(() => {
    // Å slå på skjermen igjen gir ingen navigasjons-fokusevent — det eneste
    // som fanger «appen lå åpen over midnatt» er AppState.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshToday();
    });
    return () => subscription.remove();
  }, [refreshToday]);

  // -------------------------------------------------------------------------
  // Data. ⚠️ Ingenting her rører scrollposisjonen eller valgt dato.
  // -------------------------------------------------------------------------
  const [events, setEvents] = useState<HeiaEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      setEvents(await getTeamEvents(activeTeamSpaceId));
      setError(null);
    } catch {
      // Hendelsene vi ALT har blir stående. En feilet oppfriskning skal ikke
      // tømme kalenderen — da ville et dårlig nett sett ut som et tomt lag.
      setError('Kunne ikke oppdatere kalenderen.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId]);

  useFocusEffect(
    useCallback(() => {
      refreshToday();
      loadEvents();
    }, [loadEvents, refreshToday]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  // -------------------------------------------------------------------------
  // Valgt dato. En ren markering — den flytter ALDRI agendaen av seg selv.
  // -------------------------------------------------------------------------
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const selectedKey = dayKey(selected);

  // Uka man blar i. Egen tilstand, så man kan se på neste uke uten å ha
  // valgt en dag der.
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));

  const [monthOpen, setMonthOpen] = useState(false);

  /**
   * Dagen agendaen begynner på.
   *
   * ⚠️ Fortiden er IKKE en egen modus (Brage 2026-08-07). Den gamle
   * «Se tidligere hendelser»-knappen er borte: uke- og månedsnavigatoren ER
   * inngangen til historikken. Velger man en tidligere dato, flyttes bare
   * denne startdagen bakover, og agendaen fortsetter kronologisk framover
   * derfra. Ingen omvendt liste, ingen ekstra trykk.
   *
   * `null` betyr «i dag», ikke en frossen dato — da følger agendaen med når
   * døgnet skifter mens appen ligger åpen.
   *
   * Flyttes ALDRI av scrolling. Ville den det, ville radene brukeren nettopp
   * scrollet forbi forsvunnet under fingeren.
   */
  const [agendaStart, setAgendaStart] = useState<Date | null>(null);
  const agendaFrom = agendaStart ?? today;
  const agendaFromKey = dayKey(agendaFrom);

  // -------------------------------------------------------------------------
  // Radene. ETT sett hendelser driver agenda, ukeprikker og månedsprikker.
  // -------------------------------------------------------------------------
  const allRows = useMemo(() => buildCalendarRows(events), [events]);
  const allSections = useMemo(
    () => groupByDay(allRows, today),
    [allRows, today],
  );

  // ⚠️ Prikkene bygges av ALLE radene, ikke av agendaens utsnitt. Motsatt vei
  // ville hver måned før agendaens start stått uten prikker mens cellene
  // fortsatt var trykkbare — kalenderen ville påstått at laget aldri har
  // gjort noe.
  const busy = useMemo(() => busyDaysFromRows(allRows), [allRows]);

  const factsByDay = useMemo(() => {
    const map = new Map<string, DaySection>();
    for (const section of allSections) map.set(section.key, section);
    return map;
  }, [allSections]);

  const describeDay = useCallback(
    (day: Date, types: EventType[]) =>
      dayContentLabel(types, factsByDay.get(dayKey(day))?.count ?? 0),
    [factsByDay],
  );

  const sections = useMemo(
    () => groupByDay(rowsFrom(allRows, agendaFrom), today),
    // `agendaFromKey` er den stabile nøkkelen; `agendaFrom` er et nytt
    // Date-objekt for hver render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRows, agendaFromKey, today],
  );

  /**
   * Dagen brukeren EKSPLISITT valgte og som ikke hadde noe på seg.
   *
   * ⚠️ Egen tilstand, ikke utledet av `selected` (Brage 2026-08-07). `selected`
   * endrer seg mens man scroller, og en status utledet av den ville dukket opp
   * og forsvunnet på grunn av scrollposisjonen. Denne settes bare av et
   * datotrykk, og tømmes bare av et nytt datotrykk, «I dag» eller at brukeren
   * begynner å dra i lista.
   */
  const [emptyNotice, setEmptyNotice] = useState<Date | null>(null);

  // -------------------------------------------------------------------------
  // SCROLL — én vei, én inngang
  //
  // ⚠️ Det finnes nøyaktig ÉN funksjon som flytter agendaen, og den kalles
  // bare fra fire brukerhandlinger: trykk i ukeraden, datovalg i månedsarket,
  // «I dag», og en `focusDate` etter opprettelse. INGEN effekt ruller på at
  // valgt dato, uke, måned, prikker, rader, lasting eller oppfriskning har
  // endret seg. Det var akkurat de effektene som slåss med hverandre.
  //
  // Målingen: dagsseksjonens YTTERSTE wrapper måles med `measureLayout` mot
  // ScrollViewens egen innholdsbeholder (`innerViewRef`) — nøyaktig samme
  // koordinatsystem som `scrollTo` bruker. Ingen blanding av offset inne i
  // kort, seksjon og ScrollView, og ingen etterkorrigering.
  // -------------------------------------------------------------------------
  const scrollRef = useRef<ScrollView>(null);
  const innerRef = useRef<View | null>(null);
  const sectionNodes = useRef(new Map<string, View>());

  /** Seksjonenes y, kun til å finne den øverste synlige dagen etter scroll. */
  const offsets = useRef(new Map<string, number>());

  /**
   * Navigatorens høyde. Den er festet over toppen av lista, så en dag som
   * ruller til y = 0 ville lagt seg BAK den.
   *
   * Ligger i en ref og ikke i state: verdien brukes bare i regnestykket ved
   * en scroll, og en render for hver måling ville vært støy. `onLayout` på et
   * sticky barn kalles av RN med wrapperens mål — samme høyde.
   */
  const navHeight = useRef(0);

  /**
   * Navigatorens egen y i innholdet — og dermed TERSKELEN der den fester seg.
   *
   * ⚠️ En sticky header står helt stille til `scrollY` når `layoutY`, og
   * fester seg først da (verifisert i `ScrollViewStickyHeader.js`). Lander vi
   * under terskelen, henger baren `layoutY − scrollY` piksler ned — et
   * forskjellig tall for hver landing. Det var derfor datoraden hoppet opp og
   * ned når man trykket på ulike datoer i fortiden: en tidligere dato blir
   * agendaens FØRSTE seksjon, og landingen havnet da så høyt oppe at baren
   * ikke rakk å feste seg.
   */
  const navTop = useRef(0);

  /** Dagen vi skylder en scroll. Fylles først når seksjonen finnes. */
  const pending = useRef<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);

  /** Sant bare mens brukerens EGEN gest driver lista. */
  const userDriven = useRef(false);

  // Dagen agendaen begynner på, lest fra scroll-lytteren. Ligger i en ref og
  // ikke i avhengighetene: `agendaFrom` er et nytt Date-objekt hver render, og
  // ville gitt nye handler-props til ScrollView for hver eneste oppdatering.
  const agendaFromRef = useRef(agendaFrom);
  agendaFromRef.current = agendaFrom;

  const fulfil = useCallback(() => {
    const key = pending.current;
    if (!key) return;

    const node = sectionNodes.current.get(key);
    const inner = innerRef.current;
    // Seksjonen finnes ikke ennå (agendaen utvidet seg nettopp bakover, eller
    // hendelsene er ikke hentet). Vi blir stående og venter — `sections` som
    // endrer seg prøver på nytt.
    if (!node || !inner) return;

    pending.current = null;
    // Programmatisk scroll skal aldri kunne leses som brukerens egen, og
    // dermed aldri utløse en ny beregning av valgt dato.
    userDriven.current = false;

    node.measureLayout(inner, (_x, y) => {
      scrollRef.current?.scrollTo({
        // Dagen skal lande RETT UNDER navigatoren, ikke bak den — og aldri
        // høyere enn festeterskelen, ellers får datoraden en ny posisjon for
        // hver landing. Klemt hit har den nøyaktig én.
        y: Math.max(navTop.current, y - navHeight.current - SCROLL_GAP),
        // Bevisst uanimert (Brage 2026-08-07): landingsposisjonen skal først
        // bevises stabil på telefonen. Animasjonen kan slås på igjen etterpå,
        // og den er ett ord herfra.
        animated: false,
      });
    });
  }, []);

  /** DEN ENESTE veien til en scroll. `origin` er der for å kunne leses. */
  const scrollToDay = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (key: string, origin: ScrollOrigin) => {
      pending.current = key;
      setScrollTick(tick => tick + 1);
    },
    [],
  );

  // Prøver å innfri en skyldig scroll: når den bestilles, og når agendaen har
  // fått nye seksjoner å måle.
  useEffect(() => {
    fulfil();
  }, [scrollTick, sections, fulfil]);

  const registerSection = useCallback((key: string, node: View | null) => {
    if (node) sectionNodes.current.set(key, node);
    else sectionNodes.current.delete(key);
  }, []);

  const measureSection = useCallback((key: string, y: number) => {
    offsets.current.set(key, y);
  }, []);

  // ⚠️ Offset-kartet TØMMES ALDRI. Fabric sender bare `onLayout` når Yoga har
  // flagget ny layout — en oppfriskning som gir nøyaktig samme hendelser gir
  // null events, og et tømt kart ville da stått tomt for alltid. Vi fjerner
  // bare dagene som ikke lenger finnes; nye og flyttede måles av seg selv.
  useEffect(() => {
    const live = new Set(sections.map(s => s.key));
    for (const key of Array.from(offsets.current.keys())) {
      if (!live.has(key)) offsets.current.delete(key);
    }
    for (const key of Array.from(sectionNodes.current.keys())) {
      if (!live.has(key)) sectionNodes.current.delete(key);
    }
  }, [sections]);

  // -------------------------------------------------------------------------
  // Brukerens egen scroll kan oppdatere valgt dato — men aldri rulle tilbake.
  //
  // Ingen `onScroll`: valgt dato beregnes først NÅR brukeren har sluppet.
  // Ingenting her skal oppdateres hvert 15. millisekund.
  // -------------------------------------------------------------------------
  const handleDragBegin = useCallback(() => {
    userDriven.current = true;
    // Tar brukeren over, skylder vi ingen scroll lenger. En bestilling som
    // aldri ble innfridd (dagen fantes ikke i agendaen) skal ikke kunne
    // våkne til liv senere og flytte lista under fingeren.
    pending.current = null;
    // Svaret på «hva skjer den dagen?» er utspilt i det man begynner å bla.
    // Den forsvinner på GESTEN, aldri på en scrollposisjon — og den har
    // reservert plass, så det flytter ingenting.
    setEmptyNotice(null);
  }, []);

  const syncSelectionToScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!userDriven.current) return;

      const list = sections;
      if (list.length === 0) return;

      // Den øverste dagen er den som ligger rett under navigatoren — ikke
      // den som så vidt er skjult bak den.
      const y = e.nativeEvent.contentOffset.y + navHeight.current + SCROLL_GAP;
      let current: DaySection | null = null;
      for (const section of list) {
        const offset = offsets.current.get(section.key);
        if (offset === undefined) continue;
        if (offset <= y + 1) current = section;
        else break;
      }

      // ⚠️ Toppen av lista er IKKE «ingen dag».
      //
      // Over den første dagsseksjonen ligger overskriften, navigatoren og
      // historikkraden — til sammen godt over en skjermhøyde med innhold. Lot
      // vi valget stå her, ble synkroniseringen enveis i praksis: ukeraden
      // fulgte med nedover, men kom aldri tilbake når man scrollet helt opp
      // igjen. Toppen tilhører dagen agendaen BEGYNNER på (i dag, eller
      // starten av historikken når den er åpnet).
      const day = current ? current.date : agendaFromRef.current;

      setSelected(prev =>
        dayKey(prev) === dayKey(day) ? prev : startOfDay(day),
      );
    },
    [sections],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionToScroll(e);
    },
    [syncSelectionToScroll],
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionToScroll(e);
      userDriven.current = false;
    },
    [syncSelectionToScroll],
  );

  // Ukeraden følger valgt dato, men bare visuelt — den ruller ingenting.
  useEffect(() => {
    setWeekAnchor(prev => {
      const next = startOfWeek(selected);
      return dayKey(next) === dayKey(prev) ? prev : next;
    });
  }, [selected]);

  // -------------------------------------------------------------------------
  // Handlinger
  // -------------------------------------------------------------------------
  const chooseDay = useCallback(
    (day: Date, origin: ScrollOrigin) => {
      const normalized = startOfDay(day);
      const key = dayKey(normalized);
      setSelected(normalized);

      // En tidligere dato drar agendaens start bakover med seg, i samme
      // handling. Ett trykk: dagen markeres, og agendaen viser den dagen og
      // alt som kommer etter. Rekkefølgen snur aldri.
      if (dayDiff(normalized, agendaFrom) < 0) setAgendaStart(normalized);

      // ⚠️ Agendaen inneholder BARE dager med hendelser. En tom dag markeres
      // og får en stille énlinjes status — den ruller ingenting, og den får
      // ingen egen seksjon i lista.
      if (factsByDay.has(key)) {
        setEmptyNotice(null);
        scrollToDay(key, origin);
      } else {
        setEmptyNotice(normalized);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agendaFromKey, factsByDay, scrollToDay],
  );

  const pickFromWeek = useCallback(
    (day: Date) => chooseDay(day, 'ukerad'),
    [chooseDay],
  );

  const pickFromMonth = useCallback(
    (day: Date) => {
      setMonthOpen(false);
      chooseDay(day, 'månedsark');
    },
    [chooseDay],
  );

  /** Uke, valgt dato og agenda tilbake til nå. Én kontrollert bevegelse. */
  const goToToday = useCallback(() => {
    const now = startOfDay(new Date());
    setToday(prev => (dayKey(now) === dayKey(prev) ? prev : now));
    setAgendaStart(null);
    setSelected(now);
    setEmptyNotice(null);
    if (factsByDay.has(dayKey(now))) scrollToDay(dayKey(now), 'i-dag');
    else scrollRef.current?.scrollTo({y: 0, animated: false});
  }, [factsByDay, scrollToDay]);

  const openEvent = useCallback(
    (eventId: string) => navigation.navigate('EventDetail', {eventId}),
    [navigation],
  );

  const newEvent = useCallback(
    () => navigation.navigate('NewEvent', {presetDate: selectedKey}),
    [navigation, selectedKey],
  );

  // -------------------------------------------------------------------------
  // «Turneringen er opprettet» → land PÅ turneringen
  // -------------------------------------------------------------------------
  const focusDate = route.params?.focusDate;

  useEffect(() => {
    if (!focusDate) return;
    const date = dateFromDayKey(focusDate);
    if (date) {
      setSelected(date);
      if (dayDiff(date, today) < 0) setAgendaStart(date);
      // Hendelsen er kanskje ikke hentet ennå. Bestillingen blir stående til
      // seksjonen dukker opp, og innfris da én gang.
      scrollToDay(focusDate, 'opprettet');
    }
    // Engangs-kommando. Uten dette ville Kalender hoppet til den samme gamle
    // datoen hver eneste gang fanen fikk fokus igjen.
    navigation.setParams({focusDate: undefined});
  }, [focusDate, navigation, scrollToDay, today]);

  // -------------------------------------------------------------------------
  // «+»-knappen skal vite hvilken dato man står på
  // -------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      calendarFocus.set(selectedKey);
      return () => calendarFocus.set(null);
    }, [calendarFocus, selectedKey]),
  );

  if (!activeTeamSpaceId) return null;

  // -------------------------------------------------------------------------
  // Bildet — alt i vanlig dokumentflyt, ingenting utenfor ScrollView-en.
  // -------------------------------------------------------------------------
  const isEmpty = loaded && allRows.length === 0;
  const showSkeleton = !loaded && allRows.length === 0;
  const failedCold = loaded && error !== null && allRows.length === 0;

  return (
    <View style={styles.screen}>
      {/* Lagheaderen ligger UTENFOR scrollflaten og er alltid stabil. Ingen
          kalenderinnhold kan tegnes eller bevege seg over den — det finnes
          ikke lenger noe absolutt posisjonert lag her. */}
      <TeamHeader />

      <ScrollView
        ref={scrollRef}
        // RN typer denne som en ikke-nullbar RefObject, mens en ref som
        // starter på null er nettopp det React gir oss. Peker på ScrollViewens
        // INNHOLDSBEHOLDER — samme koordinatsystem som `scrollTo`.
        innerViewRef={innerRef as React.RefObject<View>}
        stickyHeaderIndices={STICKY_INDICES}
        // ⚠️ Dette er det som gjør at historikk kan settes inn OVER agendaen
        // uten at synlig innhold flytter seg: iOS kompenserer contentOffset
        // med rammeforskyvningen til første synlige barn. Uten den ville
        // innsettingen vært én bevegelse og landingen en til.
        maintainVisibleContentPosition={MAINTAIN_POSITION}
        // Ingen `onScroll`: valgt dato beregnes først når brukeren slipper.
        onScrollBeginDrag={handleDragBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing['5xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }>
        {/* [0] Overskriften ruller bort som vanlig innhold. */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.subtitle}>Kommende hendelser for laget</Text>
        </View>

        {/* [1] STICKY. ⚠️ Må være en host-`View` med bakgrunnen på seg:
            RN flytter barnets `style` over på sin egen wrapper, så en
            komponent her ville gitt en gjennomsiktig bar med agendaen
            rullende bak. Høyden er konstant — ukeraden er alltid der, og
            tomtilstanden ligger utenfor. */}
        <View
          style={styles.navBlock}
          // RN kaller denne med SIN EGEN wrappers mål — derfor får vi både
          // høyden og festeterskelen fra samme hendelse.
          onLayout={e => {
            navHeight.current = e.nativeEvent.layout.height;
            navTop.current = e.nativeEvent.layout.y;
          }}>
          <CalendarNav
            month={addDays(startOfWeek(weekAnchor), 3)}
            onToday={goToToday}
            onOpenMonth={() => setMonthOpen(true)}
            atToday={selectedKey === dayKey(today) && agendaStart === null}
          />
          {showSkeleton ? (
            <View style={styles.stripSkeleton}>
              <Skeleton height={58} style={styles.stripBone} />
            </View>
          ) : (
            <WeekStrip
              anchor={weekAnchor}
              onChangeAnchor={setWeekAnchor}
              selected={selected}
              today={today}
              onSelect={pickFromWeek}
              busy={busy}
              describeDay={describeDay}
            />
          )}

          {/* ⚠️ FORHÅNDSRESERVERT HØYDE, alltid montert. Raden er tom det
              meste av tiden og leses da som luft under ukeraden. Poenget er
              at navigatorens høyde ALDRI endrer seg: kom og gikk denne
              linja, ville festeterskelen, alle målte posisjoner og
              scrollposisjonen flyttet seg — nøyaktig det hoppet vi har
              brukt tre runder på å bli kvitt. */}
          <View style={styles.statusRow}>
            {emptyNotice !== null && (
              <Text style={styles.statusText} numberOfLines={1}>
                Ingen hendelser {longDayLabel(emptyNotice, today).toLowerCase()}
              </Text>
            )}
          </View>
        </View>

        {/* [2] ETT fragment med alt annet. Et fragment teller som ett barn i
            `Children.toArray`, så indeksen over står stille uansett hva som
            vises her. Et array ville blitt flatet ut. */}
        <>
          {error !== null && allRows.length > 0 && (
            <Pressable
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel={`${error} Trykk for å prøve igjen.`}
              style={styles.errorStrip}>
              <Text style={styles.errorText}>
                {error} Det du ser er sist hentet. Trykk for å prøve igjen.
              </Text>
            </Pressable>
          )}

          {showSkeleton ? (
            <AgendaSkeleton />
          ) : isEmpty ? (
            <EmptyCalendar canCreate={canCreate} onCreate={newEvent} />
          ) : failedCold ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Fikk ikke tak i kalenderen</Text>
              <Text style={styles.emptyText}>Dra ned for å prøve igjen.</Text>
            </View>
          ) : sections.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Ingenting mer planlagt</Text>
              <Text style={styles.emptyText}>
                Alt laget har gjort ligger bak deg. Åpne måneden for å se
                tilbake.
              </Text>
            </View>
          ) : (
            <Agenda
              sections={sections}
              today={today}
              registerSection={registerSection}
              onMeasureSection={measureSection}
              onOpenEvent={openEvent}
            />
          )}
        </>
      </ScrollView>

      {/* Månedsvisningen ligger UTENFOR scrollflaten. Den kan verken endre
          agendaens høyde eller posisjon — å åpne og lukke den er garantert
          uten virkning. */}
      <MonthSheet
        visible={monthOpen}
        selected={selected}
        today={today}
        busy={busy}
        describeDay={describeDay}
        reducedMotion={reducedMotion}
        onSelect={pickFromMonth}
        onClose={() => setMonthOpen(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Agendaen
//
// Memoisert med vilje: valgt dato oppdateres når brukeren slipper en scroll,
// og uten dette ville HVERT kort blitt rendret på nytt ved hver eneste gest.
// Ingen av propsene her er avhengige av valgt dato.
// ---------------------------------------------------------------------------
const Agenda = React.memo(function Agenda({
  sections,
  today,
  registerSection,
  onMeasureSection,
  onOpenEvent,
}: {
  sections: DaySection[];
  today: Date;
  registerSection: (key: string, node: View | null) => void;
  onMeasureSection: (key: string, y: number) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <>
      {/* Dagsseksjonene er DIREKTE barn av innholdsbeholderen. Da ligger både
          `onLayout`-y og `measureLayout` mot `innerViewRef` i nøyaktig samme
          koordinatsystem som `scrollTo` — ingen blanding av offset inne i
          kort, seksjon og ScrollView. */}
      {sections.map(section => (
        <View
          key={section.key}
          ref={node => registerSection(section.key, node)}
          onLayout={e => onMeasureSection(section.key, e.nativeEvent.layout.y)}>
          {section.monthBreak && (
            <Text style={styles.monthDivider}>
              {MONTHS[section.date.getMonth()]}
              {section.date.getFullYear() !== today.getFullYear()
                ? ` ${section.date.getFullYear()}`
                : ''}
            </Text>
          )}

          <View style={styles.sectionHeader}>
            {/* Mint-streken er seksjonsetikettens merkevaredetalj (A v2). */}
            <View style={styles.sectionDash} />
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.rows
              .flatMap(rowEvents)
              .some(e => e.matchStatus === 'live') && <LiveBadge />}
          </View>

          {section.rows.map(row => {
            const past = dayDiff(row.date, today) < 0;
            return (
              <View key={row.key} style={styles.cardWrap}>
                {row.kind === 'tournamentDay' ? (
                  <TournamentDayCard
                    row={row}
                    past={past}
                    onPressTournament={() => onOpenEvent(row.tournament.id)}
                    onPressMatch={onOpenEvent}
                  />
                ) : (
                  <EventCard
                    event={row.event}
                    featured={row.event.matchStatus === 'live'}
                    past={past}
                    // Dagsoverskriften over kortet sier alt hvilken dag det
                    // er — datoen to ganger på rad er støy.
                    hideDay
                    onPress={() => onOpenEvent(row.event.id)}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
});

function AgendaSkeleton() {
  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionDash} />
        <Skeleton width={90} height={11} />
      </View>
      <View style={styles.cardWrap}>
        <EventCardSkeleton />
      </View>
      <View style={styles.cardWrap}>
        <EventCardSkeleton />
      </View>
      <View style={styles.cardWrap}>
        <EventCardSkeleton />
      </View>
    </>
  );
}

function EmptyCalendar({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Kalenderen er tom</Text>
      <Text style={styles.emptyText}>
        Treninger, kamper og det sosiale dukker opp her når laget planlegger
        noe.
      </Text>
      {/* Den ENESTE opprettelsesknappen i Kalender. På en kalender med innhold
          er den grønne «+» i hovednavigasjonen nok — her ville brukeren ellers
          stått foran en blindvei. */}
      {canCreate && (
        <View style={styles.emptyAction}>
          <Button title="Opprett første hendelse" onPress={onCreate} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // ⚠️ Bakgrunnen MÅ ligge her. RN flytter dette style-objektet over på sin
  // egen sticky-wrapper; uten en ugjennomsiktig flate ville agendaen rullet
  // synlig bak navigatoren.
  navBlock: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stripSkeleton: {
    paddingHorizontal: spacing.md,
  },
  // Samme høyde som ukestripa, så navigatoren ikke hopper når prikkene kommer.
  stripBone: {
    borderRadius: radius.md,
  },
  // Fast høyde, alltid til stede. Se kommentaren ved bruksstedet: navigatoren
  // må ha nøyaktig samme høyde uansett om statusen vises eller ikke.
  statusRow: {
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  // Ikke en rød feilflate: hendelsene står fortsatt der, de er bare ikke
  // ferske. Solskinnsflaten er appens «merk deg dette», ikke «noe er ødelagt».
  errorStrip: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.sun,
    borderWidth: 1,
    borderColor: colors.sunBorder,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.goldInk,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Stillere enn dagsetiketten (ingen mint-strek, tertiær) — måneden gir
  // rytme, den skal ikke rope.
  monthDivider: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
});
