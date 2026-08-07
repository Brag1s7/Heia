import React, {useMemo, useState} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius, fonts} from '../theme';
import {ChevronDown, Clock} from './icons';
import {TimeSheet} from './TimeSheet';
import {parseTime} from '../shared/eventForm';

/**
 * Klokkeslettraden i skjemaet: viser tidspunktet som en verdi, og åpner
 * hjulvelgeren (`TimeSheet`) ved trykk.
 *
 * Raden speiler `DateField`s sammendragsrad med vilje — flate, radius, brikke
 * til venstre, chevron til høyre. Dato og klokkeslett står rett over hverandre
 * i skjemaet, og skal leses som ett par.
 *
 * ⛔ **Ingen utfoldet velger i selve skjemaet.** Runde 1 var et rutenett som
 * foldet seg ut under raden, som `DateField` gjør. Det ble avvist på telefonen
 * (Brage 2026-08-07): 24 timeceller og 12 minuttceller er for mye flate for
 * ÉN verdi — «mer som et kontrollpanel enn Heia». Datoen tåler et utfoldet
 * rutenett fordi en måned ER et rutenett; et klokkeslett er ett tall.
 *
 * ⛔ **Ikke lenger et tekstfelt.** Det maskerte `HH:MM`-feltet er borte, og
 * med det hele «ugyldig klokkeslett»-tilstanden — arket kan bare sende
 * verdier som finnes.
 */

const pad = (n: number) => String(n).padStart(2, '0');

interface TimeFieldProps {
  /** «HH:MM». Komponenten sender alltid samme format tilbake. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function TimeField({value, onChange, disabled = false}: TimeFieldProps) {
  const parsed = useMemo(() => parseTime(value), [value]);
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{expanded: open, disabled}}
        accessibilityLabel={
          parsed
            ? `Klokkeslett: ${pad(parsed.hours)}:${pad(parsed.minutes)}`
            : 'Klokkeslett er ikke valgt'
        }
        accessibilityHint="Åpner klokkeslettvelgeren"
        style={({pressed}) => [
          styles.summary,
          open && styles.summaryOpen,
          pressed && !open && styles.summaryPressed,
        ]}>
        <View style={styles.tile}>
          <Clock size={22} color={colors.heiaDeep} strokeWidth={2.2} />
        </View>
        {/* Skjermens tall — displayfonten, aldri fontWeight (låst A v2-regel). */}
        <Text style={styles.time} numberOfLines={1} maxFontSizeMultiplier={1.6}>
          {parsed
            ? `${pad(parsed.hours)}:${pad(parsed.minutes)}`
            : 'Velg tidspunkt'}
        </Text>
        <ChevronDown
          size={20}
          color={open ? colors.heiaInk : colors.textSecondary}
          strokeWidth={2.2}
        />
      </Pressable>

      <TimeSheet
        visible={open}
        value={value}
        onCancel={() => setOpen(false)}
        onDone={next => {
          onChange(next);
          setOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Speiler DateField-raden, så de to står som et par i skjemaet.
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
  },
  time: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.heiaDeep,
  },
});
