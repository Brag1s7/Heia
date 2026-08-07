import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {ChevronRight, MapPin} from './icons';
import {StadiumSurface} from './StadiumSurface';
import {StatusPill, type PillKind} from './StatusPill';
import type {HeiaEvent, EventType} from '../shared/types';

interface NextEventHeroProps {
  event: HeiaEvent;
  onPress: () => void;
  /**
   * Turneringens navn når kampen hører til en (Brage 2026-08-06). Hjem viser
   * KAMPEN med en liten turneringsetikett — aldri et eget turneringskort ved
   * siden av. Kampen er og blir samme objekt som i Kalender og Sesong.
   */
  tournamentTitle?: string;
}

const typePill: Record<EventType, {kind: PillKind; label: string}> = {
  trening: {kind: 'trening', label: 'Trening'},
  kamp: {kind: 'kamp', label: 'Kamp'},
  turnering: {kind: 'turnering', label: 'Turnering'},
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
  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) / 86400000,
  );
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
export function NextEventHero({
  event,
  onPress,
  tournamentTitle,
}: NextEventHeroProps) {
  const pill = typePill[event.type] ?? typePill.annet;
  const {coming, notComing, pending} = event.rsvp;
  const total = coming + notComing + pending;
  const fillPct = total > 0 ? Math.max(6, (coming / total) * 100) : 0;

  // Kampen bor på mørk stadionflate også som kommende hero (Brages retning
  // 2026-07-31) — samme uttrykk som kalenderens kampkort: ringen, mint
  // avspark, men UTEN flomlys (det er live-kampens dramatikk).
  const stadium = event.type === 'kamp';
  // Pillen sier alt «Kamp» — standardtittelen strammes til «Mot Lyn».
  const title =
    stadium && event.opponent && event.title === `Kamp mot ${event.opponent}`
      ? `Mot ${event.opponent}`
      : event.title;

  const inner = (
    <>
      <View style={styles.kicker}>
        <View style={styles.kickerLeft}>
          <StatusPill
            kind={tournamentTitle ? 'turnering' : pill.kind}
            label={tournamentTitle ?? pill.label}
            withDot
          />
          <Text style={[styles.day, stadium && styles.dayStadium]}>
            {dayLabel(event.startTime)}
          </Text>
        </View>
        <Text style={[styles.time, stadium && styles.timeStadium]}>
          {formatTime(event.startTime)}
        </Text>
      </View>

      <View style={styles.titleRow}>
        <Text
          style={[styles.title, stadium && styles.titleStadium]}
          numberOfLines={2}>
          {title}
        </Text>
        <ChevronRight
          size={22}
          color={stadium ? colors.stadiumDim : '#41604F'}
          strokeWidth={2.2}
        />
      </View>

      {event.location && (
        <View style={styles.metaRow}>
          <MapPin size={13} color={stadium ? colors.stadiumDim : '#41604F'} />
          <Text
            style={[styles.meta, stadium && styles.metaStadium]}
            numberOfLines={1}>
            {event.location}
          </Text>
        </View>
      )}

      {total > 0 && (
        <View style={styles.rsvpRow}>
          <View style={[styles.rsvpTrack, stadium && styles.rsvpTrackStadium]}>
            <View style={[styles.rsvpFill, {width: `${fillPct}%`}]} />
          </View>
          <Text style={[styles.rsvpText, stadium && styles.rsvpTextStadium]}>
            {coming} kommer
          </Text>
        </View>
      )}
    </>
  );

  if (stadium) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${dayLabel(
          event.startTime,
        )} ${formatTime(event.startTime)}`}
        style={({pressed}) => [pressed && styles.pressed]}>
        <StadiumSurface style={styles.stadiumHero} flood={false}>
          {inner}
        </StadiumSurface>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${dayLabel(event.startTime)} ${formatTime(
        event.startTime,
      )}`}
      style={({pressed}) => [styles.hero, pressed && styles.pressed]}>
      {/* Ekte mint→krem-gradient (140°) — varmt kremdrag nede til høyre. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="hero" x1="0%" y1="0%" x2="78%" y2="94%">
              <Stop offset="0" stopColor="#DFFBEA" />
              <Stop offset="0.7" stopColor="#F4F9E6" />
              <Stop offset="1" stopColor="#FAF4DC" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
        </Svg>
      </View>
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#E3F5E9',
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#CDEEDA',
    overflow: 'hidden',
    ...shadows.cardResting,
  },
  pressed: {
    opacity: 0.93,
  },
  stadiumHero: {
    padding: spacing.xl,
    ...shadows.cardResting,
  },
  dayStadium: {
    color: colors.stadiumDim,
  },
  timeStadium: {
    color: colors.heia,
  },
  titleStadium: {
    color: colors.stadiumText,
  },
  metaStadium: {
    color: colors.stadiumDim,
  },
  rsvpTrackStadium: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  rsvpTextStadium: {
    color: colors.stadiumText,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.xs,
  },
  meta: {
    flex: 1,
    fontSize: 12.5,
    color: '#41604F',
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
