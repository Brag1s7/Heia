import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius, fonts} from '../../theme';
import {Calendar, Plus} from '../icons';
import {monthTitle} from '../../shared/calendar';

interface CalendarNavProps {
  /** Måneden som står i tittelen — den synlige ukas måned. */
  month: Date;
  onToday: () => void;
  /** Åpner månedsvisningen som et eget ark. */
  onOpenMonth: () => void;
  /** Vi står alt på i dag: knappen blir stille i stedet for å forsvinne. */
  atToday: boolean;
  /**
   * «Ny hendelse» — PERMANENT opprettelse for trener/lagleder (P4, skive 10).
   *
   * ⚠️ Før skive 10 lå den eneste opprettelsen i Kalender i TOMTILSTANDEN.
   * Da den generiske «+» forsvant fra tab-baren til fordel for kampknappen,
   * ville en trener med en FULL kalender stått uten vei til å opprette noe.
   * Derfor bor den her, i den festede navigatoren: den følger med nedover
   * uansett hvor langt man har rullet i agendaen.
   *
   * `undefined` for vanlige medlemmer — samme regel som RLS på `events`.
   */
  onNewEvent?: () => void;
}

/**
 * Tidsnavigatoren over agendaen: «August 2026» · «I dag» · «Måned».
 *
 * ⚠️ «Måned» er IKKE en visningsmodus lenger (Brage 2026-08-07). Et
 * månedsrutenett som ble satt inn og fjernet over agendaen endret høyden på
 * alt under seg, og hvert bytte ga et scrollhopp. Måneden bor nå i et eget
 * ark som ikke rører agendaens posisjon i det hele tatt. Ukeraden er den
 * eneste navigatoren på selve siden.
 *
 * «I dag» blir DEMPET og ikke borte når man alt står på i dag. En knapp som
 * kommer og går ville flyttet på de to andre hver gang man blar.
 */
export function CalendarNav({
  month,
  onToday,
  onOpenMonth,
  atToday,
  onNewEvent,
}: CalendarNavProps) {
  return (
    <View style={styles.bar}>
      <Text
        style={styles.title}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
        accessibilityRole="header">
        {monthTitle(month)}
      </Text>

      <Pressable
        onPress={onToday}
        disabled={atToday}
        accessibilityRole="button"
        accessibilityLabel="Gå til i dag"
        accessibilityState={{disabled: atToday}}
        style={({pressed}) => [
          styles.pill,
          atToday && styles.pillIdle,
          pressed && !atToday && styles.pillPressed,
        ]}>
        <Text
          style={[styles.pillText, atToday && styles.pillTextIdle]}
          maxFontSizeMultiplier={1.4}>
          I dag
        </Text>
      </Pressable>

      <Pressable
        onPress={onOpenMonth}
        accessibilityRole="button"
        accessibilityLabel="Åpne månedsvisning"
        style={({pressed}) => [styles.pill, pressed && styles.pillPressed]}>
        <Calendar size={15} color={colors.heiaInk} strokeWidth={2.2} />
        <Text style={styles.pillText} maxFontSizeMultiplier={1.4}>
          Måned
        </Text>
      </Pressable>

      {onNewEvent && (
        <Pressable
          onPress={onNewEvent}
          accessibilityRole="button"
          accessibilityLabel="Ny hendelse"
          // ⚠️ TRYKKFLATEN, IKKE HØYDEN. Pillene er 32 pt, og navigatorens
          // høyde må ALDRI endre seg — endres den, flytter festeterskelen,
          // alle målte posisjoner og scrollposisjonen seg (se `statusRow` i
          // KalenderScreen). hitSlop gir 48 pt trykkflate uten å røre
          // layouten med ett eneste punkt.
          hitSlop={{top: 8, bottom: 8, left: 6, right: 6}}
          style={({pressed}) => [
            styles.pill,
            styles.pillNew,
            pressed && styles.pillPressed,
          ]}>
          <Plus size={15} color={colors.heiaInk} strokeWidth={2.4} />
          <Text style={styles.pillText} maxFontSizeMultiplier={1.4}>
            Ny
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // Måneden er flatens tall-tittel — displayfonten, som klokkeslett og score.
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillIdle: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSubtle,
  },
  // Opprettelsen er den ene HANDLINGEN i raden — «I dag» og «Måned» flytter
  // bare blikket. Mint-tonen skiller den fra de to uten å gi den en egen
  // form: samme pille, samme høyde, samme rytme.
  pillNew: {
    backgroundColor: colors.heiaTint,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
  pillPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heiaInk,
  },
  pillTextIdle: {
    color: colors.textTertiary,
  },
});
