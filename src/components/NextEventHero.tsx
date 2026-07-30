import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {StatusPill, type PillKind} from './StatusPill';
import type {HeiaEvent, EventType} from '../shared/types';

interface NextEventHeroProps {
  event: HeiaEvent;
  onPress: () => void;
}

const typePill: Record<EventType, {kind: PillKind; label: string}> = {
  trening: {kind: 'trening', label: 'Trening'},
  kamp: {kind: 'kamp', label: 'Kamp'},
  sosialt: {kind: 'sosialt', label: 'Sosialt'},
  annet: {kind: 'neutral', label: 'Hendelse'},
};

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function dayLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  const label = d.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Hjem-heroen (A v2): dagens hovedøyeblikk når ingen kamp er live. Lys mint
 * med varmt kremdrag og banesirkel — hverdagens svar på stadion-heroen.
 * Hele kortet åpner hendelsen; RSVP-svaret gis der (én kilde til sannhet).
 */
export function NextEventHero({event, onPress}: NextEventHeroProps) {
  const pill = typePill[event.type] ?? typePill.annet;
  const {coming, notComing, pending} = event.rsvp;
  const total = coming + notComing + pending;
  const fillPct = total > 0 ? Math.max(6, (coming / total) * 100) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dayLabel(event.startTime)} ${formatTime(event.startTime)}`}
      style={({pressed}) => [styles.hero, pressed && styles.pressed]}>
      <View style={styles.cream} pointerEvents="none" />
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />

      <View style={styles.kicker}>
        <View style={styles.kickerLeft}>
          <StatusPill kind={pill.kind} label={pill.label} withDot />
          <Text style={styles.day}>{dayLabel(event.startTime)}</Text>
        </View>
        <Text style={styles.time}>{formatTime(event.startTime)}</Text>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>

      {event.location && (
        <Text style={styles.meta} numberOfLines={1}>
          {event.location}
        </Text>
      )}

      {total > 0 && (
        <View style={styles.rsvpRow}>
          <View style={styles.rsvpTrack}>
            <View style={[styles.rsvpFill, {width: `${fillPct}%`}]} />
          </View>
          <Text style={styles.rsvpText}>{coming} kommer</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#E3F5E9',
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#CDEBDA',
    overflow: 'hidden',
    ...shadows.cardResting,
  },
  pressed: {
    backgroundColor: '#DCF1E2',
  },
  // Varmt kremdrag nede til høyre — hverdagens «flomlys».
  // Stor og svak: en hard sirkelkant leses som en flekk, ikke som varme.
  cream: {
    position: 'absolute',
    right: -140,
    bottom: -180,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 226, 150, 0.15)',
  },
  arcOuter: {
    position: 'absolute',
    right: -64,
    top: -74,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 57, 46, 0.08)',
  },
  arcInner: {
    position: 'absolute',
    right: -34,
    top: -44,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 57, 46, 0.06)',
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  day: {
    fontSize: 12,
    fontWeight: '700',
    color: '#41604F',
  },
  time: {
    ...typography.displayTime,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.textPrimary,
    lineHeight: 29,
  },
  chevron: {
    fontSize: 26,
    color: '#41604F',
    fontWeight: '400',
  },
  meta: {
    fontSize: 12.5,
    color: '#41604F',
    marginTop: spacing.xs,
  },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  rsvpTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 57, 46, 0.10)',
    overflow: 'hidden',
  },
  rsvpFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.heia,
  },
  rsvpText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
});
