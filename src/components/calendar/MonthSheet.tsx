import React, {useEffect, useState} from 'react';
import {View, Text, Modal, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../../theme';
import {MonthGrid} from './MonthGrid';
import {type BusyDays} from '../../shared/calendar';
import type {EventType} from '../../shared/types';

interface MonthSheetProps {
  visible: boolean;
  selected: Date;
  today: Date;
  busy?: BusyDays;
  describeDay?: (day: Date, types: EventType[]) => string | null;
  /** «Reduser bevegelse» er på — arket skal komme uten å gli. */
  reducedMotion?: boolean;
  /** Velger datoen OG lukker. Én handling, ett resultat. */
  onSelect: (day: Date) => void;
  onClose: () => void;
}

/**
 * Månedsvisningen som et eget ark.
 *
 * ⚠️ Den lå tidligere som et rutenett OVER agendaen i samme ScrollView, og
 * det var feil (Brage 2026-08-07): et rutenett på fem–seks rader som settes
 * inn og fjernes endrer høyden på alt under seg, så hvert bytte mellom uke og
 * måned ga et scrollhopp — og et månedsbytte kunne dra agendaen med seg.
 *
 * Som ark kan den ikke røre agendaen i det hele tatt: den ligger utenfor
 * scrollflaten, chevronene bytter bare månedstilstanden HER INNE, og lukker
 * man uten å velge, er alt nøyaktig som det var.
 *
 * Rutenettet, dagcellene og datomatten er de SAMME som i datovelgeren
 * (`DateField`). Det er presentasjonen som er ny, ikke logikken.
 */
export function MonthSheet({
  visible,
  selected,
  today,
  busy,
  describeDay,
  reducedMotion = false,
  onSelect,
  onClose,
}: MonthSheetProps) {
  const insets = useSafeAreaInsets();

  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  // Åpner man arket igjen, skal man lande i den valgte datoens måned — ikke
  // der man blar seg bort forrige gang.
  useEffect(() => {
    if (visible) {
      setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [visible, selected]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Lukk månedsvisningen"
      />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
        <View style={styles.handle} />
        <MonthGrid
          view={view}
          onChangeView={setView}
          selected={selected}
          today={today}
          onSelect={onSelect}
          busy={busy}
          describeDay={describeDay}
          variant="plain"
        />
        <Text style={styles.foot}>
          Trykk på en dato for å gå dit i kalenderen
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  foot: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
});
