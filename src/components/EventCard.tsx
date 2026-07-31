import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius, shadows, fonts} from '../theme';
import {MapPin} from './icons';
import {HeroSurface} from './HeroSurface';
import {StadiumSurface} from './StadiumSurface';
import {StatusPill, type PillKind} from './StatusPill';
import type {HeiaEvent, EventType} from '../shared/types';

interface EventCardProps {
  event: HeiaEvent;
  onPress?: () => void;
  featured?: boolean;
  /** Kalenderarkivet: fortidskort dempes og oppmøtet skjules — historikk
      skal ikke konkurrere med det som kommer. */
  past?: boolean;
}

const typePill: Record<EventType, {kind: PillKind; label: string}> = {
  trening: {kind: 'trening', label: 'Trening'},
  kamp: {kind: 'kamp', label: 'Kamp'},
  turnering: {kind: 'turnering', label: 'Turnering'},
  sosialt: {kind: 'sosialt', label: 'Sosialt'},
  annet: {kind: 'neutral', label: 'Hendelse'},
};

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Samme datospråk som Hjem-heroen: «I dag», «I morgen», «Fredag 12. jun». */
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

/**
 * Kalenderkortet (P9, Brages retning): en KOMPAKT hero — samme sjel som
 * Hjem-heroen (mint→krem-gradient, banedekor, type-pill, dag + tid i
 * displayfonten, RSVP-progress), men strammere. Kampen bor på mørk
 * stadionflate (låst regel) — flomlys, mint avsparkstid og stillingen som
 * bunnrad når den finnes. Ingen store hvite adminflater.
 */
export function EventCard({
  event,
  onPress,
  featured = false,
  past = false,
}: EventCardProps) {
  const start = event.startTime;
  const result = resultLabel(event);
  const isLive = event.matchStatus === 'live';
  const isPaused = event.matchStatus === 'halfTime';
  const isCancelled = event.matchStatus === 'cancelled';
  // home/away tolkes alltid som oss/dem (kartlagt i events.ts) — SEIER-pill
  // finnes, tap-pill finnes ikke (låst designregel: ingen «TAP»-roping).
  const isWin =
    event.matchStatus === 'finished' &&
    !!event.score &&
    event.score.home > event.score.away;

  // Mørk flate = kamp (låst) — men en avlyst kamp er ingen kampdag.
  const stadium = event.type === 'kamp' && !isCancelled;
  const pill = isCancelled
    ? {kind: 'neutral' as PillKind, label: 'Avlyst'}
    : (typePill[event.type] ?? typePill.annet);

  // Pillen sier alt «Kamp» — standardtittelen strammes til «Mot Lyn».
  // Egendefinerte titler («Seriefinalen») vises som de er.
  const title =
    stadium && event.opponent && event.title === `Kamp mot ${event.opponent}`
      ? `Mot ${event.opponent}`
      : event.title;

  // Kampen viser avsparket alene (kampdag-språket); resten hele tidsrommet.
  const time =
    event.type === 'kamp' || !event.endTime
      ? formatTime(start)
      : `${formatTime(start)}–${formatTime(event.endTime)}`;

  const {coming, notComing, pending} = event.rsvp;
  const total = coming + notComing + pending;
  // Oppmøtet er interessant fremover — ikke i arkivet, ikke på en avlyst
  // hendelse, og ikke når stillingen har tatt over kortet.
  const showRsvp = total > 0 && !past && !result && !isCancelled;
  const fillPct = coming > 0 ? Math.max(6, (coming / total) * 100) : 0;

  const content = (
    <>
      <View style={styles.kicker}>
        <View style={styles.kickerLeft}>
          <StatusPill kind={pill.kind} label={pill.label} withDot />
          <Text
            style={[styles.day, stadium && styles.dayStadium]}
            numberOfLines={1}>
            {dayLabel(start)}
          </Text>
        </View>
        <Text style={[styles.time, stadium && styles.timeStadium]}>
          {time}
        </Text>
      </View>

      <Text
        style={[styles.title, stadium && styles.titleStadium]}
        numberOfLines={2}>
        {title}
      </Text>

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

      {showRsvp && (
        <View style={styles.rsvpRow}>
          <View style={[styles.rsvpTrack, stadium && styles.rsvpTrackStadium]}>
            <View style={[styles.rsvpFill, {width: `${fillPct}%`}]} />
          </View>
          <Text style={[styles.rsvpText, stadium && styles.rsvpTextStadium]}>
            {coming} kommer
          </Text>
        </View>
      )}

      {result && event.score && (
        <View style={styles.resultRow}>
          {isLive && <View style={styles.liveDot} />}
          <Text
            style={[
              styles.resultLabel,
              isLive && styles.resultLabelLive,
              isPaused && styles.resultLabelPaused,
            ]}
            numberOfLines={1}>
            {result}
          </Text>
          {isWin && <StatusPill kind="seier" label="Seier" />}
          <Text style={styles.resultScore}>
            {event.score.home}–{event.score.away}
          </Text>
        </View>
      )}
    </>
  );

  if (stadium) {
    // Ringen (banesirkelen) hører til på kampflater — samme signatur som
    // live-banneret og Hjem-kampheroen; flomlyset er AV, det er live-kampens
    // dramatikk (kommende/spilt kamp skal være «litt svakere» — Brages ord).
    return (
      <Pressable
        onPress={onPress}
        style={({pressed}) => [past && styles.past, pressed && styles.pressed]}>
        <StadiumSurface
          style={[styles.darkCard, featured && styles.featured]}
          flood={false}
          bordered={!featured}>
          {content}
        </StadiumSurface>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [past && styles.past, pressed && styles.pressed]}>
      {/* Samme mint→krem-flate som Hjem-heroen — kalenderen skal kjennes
          som samme Heia, bare i kompakt format. */}
      <HeroSurface style={styles.lightCard}>{content}</HeroSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lightCard: {
    padding: spacing.lg,
    ...shadows.card,
  },
  darkCard: {
    padding: spacing.lg,
    ...shadows.card,
  },
  featured: {
    borderWidth: 1,
    borderColor: colors.live,
  },
  past: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.93,
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
    flexShrink: 1,
  },
  dayStadium: {
    color: colors.stadiumDim,
  },
  // Tiden er kortets store tall — displayfonten, aldri fontWeight.
  time: {
    fontSize: 19,
    letterSpacing: -0.2,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  timeStadium: {
    color: colors.heia,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  titleStadium: {
    color: colors.stadiumText,
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
  metaStadium: {
    color: colors.stadiumDim,
  },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  rsvpTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 57, 46, 0.10)',
    overflow: 'hidden',
  },
  rsvpTrackStadium: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
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
  rsvpTextStadium: {
    color: colors.stadiumText,
  },
  // Stillingen som bunnrad — kortet er alt mørkt, ingen egen stripe trengs.
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  resultLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.stadiumDim,
  },
  resultLabelLive: {
    color: '#FF8A8D',
  },
  resultLabelPaused: {
    color: colors.gold,
  },
  // Score i displayfonten (aldri fontWeight) — mint er lov på stadionmørkt.
  resultScore: {
    fontSize: 18,
    letterSpacing: 0.2,
    fontFamily: fonts.display,
    color: colors.heia,
  },
});
