import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Chip} from './Chip';
import {RSVPBar} from './RSVPBar';
import type {HeiaEvent} from '../shared/types';

interface EventCardProps {
  event: HeiaEvent;
  onPress?: () => void;
  featured?: boolean;
}

const dayNames = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];
const monthNames = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN',
  'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES',
];

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function EventCard({event, onPress, featured = false}: EventCardProps) {
  const start = event.startTime;
  const dayName = dayNames[start.getDay()];
  const dateNum = start.getDate();
  const monthName = monthNames[start.getMonth()];

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        featured && styles.featured,
        pressed && styles.pressed,
      ]}
    >
      {/* Dato-blokk + innhold */}
      <View style={styles.row}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>{dayName}</Text>
          <Text style={styles.dateNum}>{dateNum}</Text>
          <Text style={styles.dateMonth}>{monthName}</Text>
        </View>
        <View style={styles.content}>
          <Chip type={event.type} />
          <Text style={styles.title}>{event.title}</Text>
          {event.location && (
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{event.location}</Text>
            </View>
          )}
          <Text style={styles.meta}>
            {formatTime(event.startTime)}
            {event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
          </Text>
        </View>
      </View>

      {/* RSVP-bar */}
      <View style={styles.rsvpWrap}>
        <RSVPBar rsvp={event.rsvp} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    ...shadows.card,
  },
  featured: {
    borderLeftWidth: 3,
    borderLeftColor: colors.heia,
  },
  pressed: {
    backgroundColor: '#FAFAFA',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  dateBlock: {
    alignItems: 'center',
    width: 44,
    paddingTop: spacing.xs,
  },
  dateDay: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 11,
  },
  dateNum: {
    ...typography.heading1,
    fontSize: 24,
    lineHeight: 28,
  },
  dateMonth: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 11,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.heading3,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  rsvpWrap: {
    marginTop: spacing.lg,
  },
});
