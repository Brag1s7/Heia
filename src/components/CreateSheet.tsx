import React from 'react';
import {View, Text, Modal, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {Calendar, MessageCircle} from './icons';

interface CreateSheetProps {
  visible: boolean;
  /** Trener/lagleder/admin — samme regel som RLS på `events`. */
  canCreateEvent: boolean;
  /**
   * Datoen brukeren står på i Kalender, eller null når «+» ble trykket et
   * annet sted. Er den satt, er «Ny hendelse» handlingen man kom for.
   */
  calendarDay: string | null;
  onClose: () => void;
  onShare: () => void;
  onNewEvent: () => void;
}

/**
 * Valgarket bak «+». «Del med laget» vises for alle, så knappen aldri er død
 * for en forelder — de er de fleste brukerne, og «+» er appens mest
 * fremhevede knapp.
 *
 * Arket er KONTEKSTSENSITIVT (Brage 2026-08-07): står man i Kalender, ligger
 * «Ny hendelse» øverst for trener/lagleder, og hendelsen arver datoen man ser
 * på. Ingen egen «Ny turnering»-rad — turnering er allerede tredje valg i
 * skjemaet, altså ett trykk unna gjennom samme flyt.
 */
export function CreateSheet({
  visible,
  canCreateEvent,
  calendarDay,
  onClose,
  onShare,
  onNewEvent,
}: CreateSheetProps) {
  const insets = useSafeAreaInsets();

  const share = (
    <SheetRow
      key="share"
      icon={<MessageCircle size={20} color={colors.heiaInk} />}
      iconBg={colors.heiaTint}
      title="Del med laget"
      subtitle="Skriv en melding eller legg ut et bilde"
      onPress={onShare}
    />
  );

  const event = canCreateEvent ? (
    <SheetRow
      key="event"
      icon={<Calendar size={20} color={colors.infoInk} />}
      iconBg={colors.infoSoft}
      title="Ny hendelse"
      subtitle="Trening, kamp, turnering eller sosialt"
      onPress={onNewEvent}
    />
  ) : null;

  // Rekkefølgen er hele kontekstsensitiviteten. Vanlige medlemmer ser aldri
  // en handling de mangler tilgang til — `event` er null for dem.
  const rows =
    calendarDay !== null && event !== null ? [event, share] : [share, event];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
        <View style={styles.handle} />
        {rows}
      </View>
    </Modal>
  );
}

function SheetRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}>
      {/* Semantisk ikonflate — samme språk som varselradene (A v2). */}
      <View style={[styles.iconWrap, {backgroundColor: iconBg}]}>{icon}</View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  rowSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
