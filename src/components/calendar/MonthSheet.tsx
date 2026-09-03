import React, {useEffect, useState} from 'react';
import {Text, Modal, Pressable, StyleSheet} from 'react-native';
import {typography, spacing} from '../../theme';
import {GlassSheetSurface} from '../GlassSheet';
import {OPAL} from '../OpalSurface';
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
 *
 * MATERIALET (Brage 2026-09-03): arket er tungt Heia-glass (`GLASS.sheet`,
 * ekte systemblur på iOS 26, solid perle ellers) — ikke en flat hvit
 * flate, og INGEN mørk scrim over siden bak: Kalender står urørt og synlig
 * over arket, bare kjølig og uskarp gjennom glasset. Bakflaten er fortsatt
 * trykkbar for å lukke. Stor radius og drag-handle beholdes; dagene får
 * ingen egne glassbokser — rutenettet er `plain`, som før.
 * Selve arket er `GlassSheetSurface` (delt med dato- og klokkeslettarket i
 * «Ny hendelse»); presentasjonen her er `Modal` fordi arket må dekke den
 * flytende tab-baren — se GlassSheet.tsx.
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
      <GlassSheetSurface>
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
      </GlassSheetSurface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Ingen scrim (Brage 2026-09-03): siden bak forblir som den er. Flaten er
  // fortsatt trykkbar for å lukke.
  backdrop: {
    flex: 1,
  },
  foot: {
    ...typography.caption,
    color: OPAL.inkSecondary,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
});
