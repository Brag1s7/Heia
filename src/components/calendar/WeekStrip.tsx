import React, {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {spacing} from '../../theme';
import {DayCell} from './DayCell';
import {
  WEEKDAYS_SHORT,
  addWeeks,
  busyLabel,
  dayCellLabel,
  dayKey,
  isSameDay,
  startOfWeek,
  weekDays,
  type BusyDays,
} from '../../shared/calendar';
import type {EventType} from '../../shared/types';

interface WeekStripProps {
  /** En dag i uka som vises. Bare uka leses ut av den. */
  anchor: Date;
  onChangeAnchor: (monday: Date) => void;
  selected: Date;
  today: Date;
  onSelect: (day: Date) => void;
  busy?: BusyDays;
  describeDay?: (day: Date, types: EventType[]) => string | null;
}

/**
 * Mandag–søndag som én rad, med sveiping mellom uker.
 *
 * Tre sider (forrige, denne, neste) som RESENTRERES etter hver sveip — ikke
 * hundre uker rendret i forkant. Trikset som gjør at det ikke blinker: side 2
 * i den gamle uka og side 1 i den nye viser NØYAKTIG samme uke, så når
 * ankeret flyttes og vi hopper én side tilbake, står det samme på skjermen.
 *
 * ⚠️ Hoppet må skje i `useLayoutEffect`, ikke `useEffect`. Med `useEffect`
 * rekker det nye innholdet å bli tegnet på den gamle posisjonen først, og da
 * ser man uka ETTER den man sveipet til i ett bilde.
 */
export function WeekStrip({
  anchor,
  onChangeAnchor,
  selected,
  today,
  onSelect,
  busy,
  describeDay,
}: WeekStripProps) {
  const {width} = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const monday = useMemo(() => startOfWeek(anchor), [anchor]);
  const mondayKey = dayKey(monday);

  const pages = useMemo(
    () => [addWeeks(monday, -1), monday, addWeeks(monday, 1)],
    [monday],
  );

  // Tilbake til midtsiden hver gang uka endres — enten fordi man sveipet,
  // eller fordi noen trykket «I dag» eller valgte en dato i en annen uke.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({x: width, y: 0, animated: false});
  }, [mondayKey, width]);

  // `contentOffset` er ikke å stole på før innholdet faktisk har en bredde.
  // Første gang sidene er målt, sentrerer vi én gang til — uten den kan
  // stripa åpne på forrige uke på Android.
  const centered = useRef(false);
  const handleContentSize = useCallback(
    (contentWidth: number) => {
      if (centered.current || contentWidth <= 0 || width <= 0) return;
      centered.current = true;
      scrollRef.current?.scrollTo({x: width, y: 0, animated: false});
    },
    [width],
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      if (page === 1) return;
      // Resentreringen skjer i layout-effekten over. Den bruker
      // `animated: false` og fyrer derfor ingen ny momentum-hendelse — ingen
      // fare for at dette går rundt og rundt.
      onChangeAnchor(addWeeks(monday, page - 1));
    },
    [monday, onChangeAnchor, width],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      // Startposisjonen settes som en prop og ikke med en scrollTo, så
      // midtsiden er på plass allerede i første bilde.
      contentOffset={{x: width, y: 0}}
      onContentSizeChange={handleContentSize}
      onMomentumScrollEnd={handleMomentumEnd}
      // Ukestripa eier bare den vannrette gesten; agendaen under skal
      // fortsatt kunne rulles loddrett gjennom den.
      directionalLockEnabled
      accessibilityLabel="Uke">
      {pages.map(pageMonday => (
        <View key={dayKey(pageMonday)} style={[styles.page, {width}]}>
          {weekDays(pageMonday).map((day, index) => {
            const types = busy?.[dayKey(day)] ?? [];
            const note = describeDay
              ? describeDay(day, types)
              : busyLabel(types);

            return (
              <DayCell
                key={dayKey(day)}
                day={day}
                selected={isSameDay(day, selected)}
                isToday={isSameDay(day, today)}
                types={types}
                weekday={WEEKDAYS_SHORT[day.getDay()]}
                weekend={index >= 5}
                // Ukeraden står i kalenderchromen på dagslysgrunnens mørke
                // topp: stadionblekk + frostplate per dag (Brage 2026-09-03).
                tone="stadium"
                onPress={onSelect}
                accessibilityLabel={dayCellLabel(day, today, note)}
              />
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 6 pt mellom platene: hver dag er sin egen lille flate, og luften mellom
  // dem er det som gir raden rytme (runde 2). Var 2 da cellene var usynlige.
  page: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 6,
  },
});
