import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {StatusPill, type PillKind} from './StatusPill';
import {RSVPBar} from './RSVPBar';
import type {HeiaEvent, EventType} from '../shared/types';

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

const typePill: Record<EventType, {kind: PillKind; label: string}> = {
  trening: {kind: 'trening', label: 'Trening'},
  kamp: {kind: 'kamp', label: 'Kamp'},
  sosialt: {kind: 'sosialt', label: 'Sosialt'},
  annet: {kind: 'neutral', label: 'Hendelse'},
};

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * En kamp som er i gang eller spilt viser stillingen, ikke oppmøtet — hvem som
 * «kommer» er uinteressant når kampen er over. Null for alt annet.
 */
function resultLabel(event: HeiaEvent): string | null {
  if (event.type !== 'kamp' || !event.score) return null;

  switch (event.matchStatus) {
    case 'live':
      return 'Pågår nå';
    case 'halfTime':
      return 'Pause';
    case 'finished':
      return 'Sluttresultat';
    default:
      return null;
  }
}

export function EventCard({event, onPress, featured = false}: EventCardProps) {
  const start = event.startTime;
  const dayName = dayNames[start.getDay()];
  const dateNum = start.getDate();
  const monthName = monthNames[start.getMonth()];
  const result = resultLabel(event);
  const pill = typePill[event.type] ?? typePill.annet;

  const isLive = event.matchStatus === 'live';
  const isPaused = event.matchStatus === 'halfTime';
  // home/away tolkes alltid som oss/dem (kartlagt i events.ts) — SEIER-pill
  // finnes, tap-pill finnes ikke (låst designregel: ingen «TAP»-roping).
  const isWin =
    event.matchStatus === 'finished' &&
    !!event.score &&
    event.score.home > event.score.away;

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
          <StatusPill kind={pill.kind} label={pill.label} />
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

      {/* Kampen bor alltid på mørk stadionflate — også som resultatstripe her.
          Coral = kun pågående; pause = gul; ferdig = dempet + evt. SEIER. */}
      {result && event.score ? (
        <View style={styles.stadiumStrip}>
          {isLive && <View style={styles.liveDot} />}
          <Text
            style={[
              styles.stripLabel,
              isLive && styles.stripLabelLive,
              isPaused && styles.stripLabelPaused,
            ]}
            numberOfLines={1}>
            {result}
          </Text>
          <View style={styles.stripRight}>
            {isWin && <StatusPill kind="seier" label="Seier" />}
            <Text style={styles.stripScore}>
              {event.score.home}–{event.score.away}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.rsvpWrap}>
          <RSVPBar rsvp={event.rsvp} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  // Coral eier live-status — en tynn kant er nok, stadionstripa bærer resten.
  featured: {
    borderColor: colors.live,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
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
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
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
  stadiumStrip: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.stadium,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  stripLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.stadiumDim,
  },
  stripLabelLive: {
    color: '#FF8A8D',
  },
  stripLabelPaused: {
    color: colors.gold,
  },
  stripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stripScore: {
    ...typography.scoreSmall,
    fontSize: 18,
    color: colors.heia,
  },
});
