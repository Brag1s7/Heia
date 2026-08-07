import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, Text, Pressable, StyleSheet, Animated, Easing} from 'react-native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {ChevronDown} from './icons';
import {MonthGrid, monthGridFootNote} from './calendar/MonthGrid';
import {
  MONTHS_SHORT,
  addDays,
  busyLabel,
  dayKey,
  longDayLabel,
  relativeDayLabel,
  startOfDay,
  type BusyDays,
} from '../shared/calendar';

interface DateFieldProps {
  /** Valgt dag. Klokkeslettet ignoreres — datoen er alt denne eier. */
  value: Date;
  onChange: (day: Date) => void;
  /** Dager laget alt har noe på. Kan komme etter at flaten er tegnet. */
  busy?: BusyDays;
  /** Prikkene er ikke framme ennå. Kalenderen virker likevel. */
  busyLoading?: boolean;
  /** Hvor mange dager tilbake som er lov. 0 = ingen fortid. */
  daysBack?: number;
  /** Hvor langt fram man kan bla. */
  monthsAhead?: number;
  /**
   * Overstyrer den tidligste lovlige dagen. Brukes av turneringens
   * sluttdato, som aldri kan ligge før startdatoen — uansett hva
   * `daysBack` sier.
   */
  minDate?: Date;
  disabled?: boolean;
}

/**
 * Datovelgeren: en rad som viser den valgte datoen, og en kalender som folder
 * seg ut UNDER den — i skjemaet, ikke i en modal, så resten av flaten bare
 * skyves ned (Brages bestilling 2026-08-06).
 *
 * Den erstatter en vannrett stripe med 30 dagchips. Stripa hadde en hard vegg
 * 30 dager fram, som gjorde det umulig å legge inn høstens terminliste i
 * august — det var en produktgrense, ikke en visningsgrense.
 *
 * Den har med vilje INGEN hurtigknapper («I dag» / «I morgen»): i dag er alt
 * standardvalget, og det aller meste legges lenger fram enn i morgen.
 *
 * Selve rutenettet bor i `calendar/MonthGrid` og deles med Kalender-fanen
 * (2026-08-07). Det som er IGJEN her er skjemaets: sammendragsraden, grensene
 * og utfoldingen.
 */
export function DateField({
  value,
  onChange,
  busy,
  busyLoading = false,
  daysBack = 0,
  monthsAhead = 18,
  minDate,
  disabled = false,
}: DateFieldProps) {
  // Fryses ved montering. Skjermen er en modal man ikke står i over midnatt.
  const today = useMemo(() => startOfDay(new Date()), []);

  const selected = useMemo(() => startOfDay(value), [value]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  // Grensene: `daysBack` dager tilbake, `monthsAhead` måneder fram. Fram
  // regnes i HELE måneder, så siste måned kan brukes ut.
  const minDay = useMemo(
    () => (minDate ? startOfDay(minDate) : addDays(today, -daysBack)),
    [today, daysBack, minDate],
  );
  const maxDay = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthsAhead + 1, 0),
    [today, monthsAhead],
  );

  // ---------------------------------------------------------------------
  // Utfoldingen. Høyden MÅLES i stedet for å settes — et rutenett er fem
  // eller seks uker høyt, og med forstørret skrift enda høyere. En fast
  // høyde ville klippet bunnraden.
  // ---------------------------------------------------------------------
  //
  // ⚠️ FØRSTE FORSØK VIRKET IKKE, og fella er verdt å kjenne: måler man
  // innholdet inne i en beholder som ALT har `height: 0` og
  // `overflow: 'hidden'`, kommer målingen tilbake som 0. Da blir
  // `outputRange` [0, 0], og høyden kan aldri bli noe annet enn null —
  // kalenderen rendres, men er null piksler høy for alltid. Den må måles
  // for å kunne vises, og vises for å kunne måles.
  //
  // Løsningen: så lenge en høyde er ukjent, rendres kalenderen UTEN
  // høydebegrensning — enten utenfor flyten (lukket: usynlig forhånds-
  // måling, så selv FØRSTE åpning animeres) eller i flyten (åpen: synlig
  // med én gang, bare uanimert det ene bildet).
  //
  // ÉN høyde holder nå. Rutenettet er alltid seks uker (`monthGrid`), så
  // alle måneder er like høye — februar og en måned som begynner på søndag
  // måler likt. Tidligere ble høyden cachet per antall uker; den cachen er
  // borte fordi antallet ikke lenger kan variere.
  const [contentHeight, setContentHeight] = useState(0);
  const measured = contentHeight > 0;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!measured) {
      // Uten en høyde er det ingenting å animere mot — hopp rett til målet.
      anim.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 170,
      easing: Easing.out(Easing.cubic),
      // Høyde kan ikke drives på UI-tråden.
      useNativeDriver: false,
    }).start();
  }, [open, measured, anim]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });

  const handleContentLayout = useCallback((layoutHeight: number) => {
    if (layoutHeight <= 0) return;
    setContentHeight(prev =>
      Math.round(prev) === Math.round(layoutHeight) ? prev : layoutHeight,
    );
  }, []);

  const toggle = useCallback(() => {
    // Åpner vi igjen skal vi lande i måneden til den valgte dagen, ikke der
    // brukeren blar seg bort forrige gang.
    if (!open) {
      setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    setOpen(!open);
  }, [open, selected]);

  const pick = useCallback(
    (day: Date) => {
      onChange(day);
      // Lukkes med én gang, som i en billettbestilling: datoen er valgt,
      // og skjemaet under skal tilbake i synet.
      setOpen(false);
    },
    [onChange],
  );

  const selectedBusy = busyLabel(busy?.[dayKey(selected)]);
  const relative = relativeDayLabel(selected, today);

  // `busy` er undefined både før hentingen og HVIS den feilet. Bare et tomt
  // objekt betyr «vi vet, og det er ingenting» — ellers ville en feilet
  // spørring påstått at kalenderen er ledig.
  const footNote = busyLoading
    ? 'Henter lagets kalender …'
    : busy && Object.keys(busy).length === 0
    ? 'Ingenting annet i kalenderen denne perioden'
    : 'Prikk = laget har alt noe den dagen';

  return (
    <View>
      {/* ---- Sammendraget: den valgte datoen som en verdi ---- */}
      <Pressable
        onPress={toggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{expanded: open, disabled}}
        accessibilityLabel={`Dato: ${longDayLabel(
          selected,
          today,
        )}, ${relative}`}
        accessibilityHint={open ? 'Lukker kalenderen' : 'Åpner kalenderen'}
        style={({pressed}) => [
          styles.summary,
          open && styles.summaryOpen,
          pressed && !open && styles.summaryPressed,
        ]}>
        <View style={styles.tile}>
          <Text style={styles.tileDay}>{selected.getDate()}</Text>
          <Text style={styles.tileMonth}>
            {MONTHS_SHORT[selected.getMonth()]}
          </Text>
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {longDayLabel(selected, today)}
          </Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {selectedBusy ? `${relative} · ${selectedBusy}` : relative}
          </Text>
        </View>
        {/* Rotasjonen legges på en View — transform på selve SVG-en er ikke
            pålitelig på tvers av plattformene. */}
        <View style={open ? styles.chevOpen : undefined}>
          <ChevronDown
            size={20}
            color={open ? colors.heiaInk : colors.textSecondary}
            strokeWidth={2.2}
          />
        </View>
      </Pressable>

      {/* ---- Kalenderen ----
           Tre tilstander, og rekkefølgen er hele poenget (se blokken over):
             målt          → animert høyde, det normale
             umålt + åpen  → i flyten, synlig med én gang
             umålt + lukket→ utenfor flyten, usynlig forhåndsmåling
           Måles den inne i en beholder som alt er null høy, blir svaret
           null — og kalenderen usynlig for alltid. */}
      <Animated.View
        style={
          measured
            ? [styles.expander, {height, opacity: anim}]
            : open
            ? undefined
            : styles.measuring
        }
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
        <View onLayout={e => handleContentLayout(e.nativeEvent.layout.height)}>
          <MonthGrid
            view={view}
            onChangeView={setView}
            selected={selected}
            today={today}
            onSelect={pick}
            busy={busy}
            minDay={minDay}
            maxDay={maxDay}
            disabled={disabled}
            variant="card"
            style={styles.cal}
            footer={<Text style={monthGridFootNote}>{footNote}</Text>}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- Sammendraget ----
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
  },
  summaryOpen: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  summaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  tile: {
    width: 52,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.heiaTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tileDay: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.heiaDeep,
  },
  tileMonth: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.heiaInk,
  },
  summaryText: {
    flex: 1,
    gap: 1,
  },
  summaryTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  summarySub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  chevOpen: {
    transform: [{rotate: '180deg'}],
  },

  // ---- Utfoldingen ----
  expander: {
    overflow: 'hidden',
  },
  // Forhåndsmålingen: utenfor flyten og usynlig, men i full bredde og UTEN
  // høydebegrensning — det er nettopp det som gjør at `onLayout` svarer med
  // en ekte høyde i stedet for null.
  measuring: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  cal: {
    marginTop: spacing.sm,
  },
  // Hurtigknappene «I dag / I morgen / førstkommende lørdag» er FJERNET
  // (Brage 2026-08-06): i dag er alt standardvalget, og de fleste
  // arrangementer legges lenger fram enn i morgen. De løste et problem
  // dagstripa hadde, ikke et kalenderen har.
});
