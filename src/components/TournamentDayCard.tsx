import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows, fonts} from '../theme';
import {MapPin, Trophy} from './icons';
import {ScoreChip} from './ScoreChip';
import {dayRangeLabel} from '../shared/calendar';
import type {TournamentDayRow} from '../shared/calendarList';
import type {HeiaEvent} from '../shared/types';

interface TournamentDayCardProps {
  row: TournamentDayRow;
  /** Åpner turneringen selv. */
  onPressTournament: () => void;
  /** Åpner én kamp — samme kampskjerm som alle andre kamper. */
  onPressMatch: (eventId: string) => void;
  /** Arkivet: dempet, som EventCard. */
  past?: boolean;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * Kampens høyrekant: stillingen når den finnes, ellers ingenting.
 * Bevisst samme språk som resten av appen — kampen bor på mørk stadionflate
 * i alle størrelser, helt ned til denne chipen.
 */
function matchStatusChip(match: HeiaEvent): React.ReactNode {
  if (!match.score) return null;
  const score = `${match.score.home}–${match.score.away}`;

  switch (match.matchStatus) {
    case 'live':
      return <ScoreChip label="Live" live score={score} />;
    case 'halfTime':
      return <ScoreChip label="Pause" score={score} />;
    case 'finished':
      return <ScoreChip label="Slutt" score={score} />;
    default:
      return null;
  }
}

/**
 * Turneringen på ÉN dag, med den dagens kamper under seg.
 *
 * Brages regel (2026-08-06): turneringen og kampene skal ikke leses som
 * flere uavhengige arrangementer i kalenderen. Derfor denne kompakte
 * headeren med kampene under — men kampene er fortsatt de SAMME
 * kampobjektene som ellers i appen, og et trykk åpner den vanlige
 * kampskjermen med live, bilder, kommentarer og rapport.
 *
 * Turneringens flate er `sun`/`goldInk` — samme gull som StatusPill gir
 * turneringer ellers. Cupdagen er en festdag, ikke en adminflate.
 */
export function TournamentDayCard({
  row,
  onPressTournament,
  onPressMatch,
  past = false,
}: TournamentDayCardProps) {
  const {tournament, dayIndex, dayCount, matches} = row;
  const period = dayRangeLabel(
    tournament.startTime,
    tournament.endTime ?? tournament.startTime,
  );

  return (
    <View style={[styles.card, past && styles.cardPast]}>
      <Pressable
        onPress={onPressTournament}
        accessibilityRole="button"
        accessibilityLabel={`${tournament.title}${
          dayCount > 1 ? `, dag ${dayIndex} av ${dayCount}` : ''
        }, ${period}`}
        style={({pressed}) => [styles.header, pressed && styles.headerPressed]}>
        <View style={styles.headerIcon}>
          <Trophy size={16} color={colors.goldInk} strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {tournament.title}
            {dayCount > 1 ? (
              <Text
                style={
                  styles.dayCount
                }>{`  ·  Dag ${dayIndex} av ${dayCount}`}</Text>
            ) : null}
          </Text>
          <Text style={styles.period} numberOfLines={1}>
            {period}
          </Text>
        </View>
      </Pressable>

      {matches.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>Kampoppsettet er ikke klart ennå</Text>
        </View>
      ) : (
        matches.map((match, index) => (
          <Pressable
            key={match.id}
            onPress={() => onPressMatch(match.id)}
            accessibilityRole="button"
            accessibilityLabel={`${formatTime(match.startTime)} mot ${
              match.opponent ?? 'motstander'
            }${match.location ? `, ${match.location}` : ''}`}
            style={({pressed}) => [
              styles.matchRow,
              index > 0 && styles.matchRowDivided,
              pressed && styles.matchRowPressed,
            ]}>
            <Text style={styles.matchTime}>{formatTime(match.startTime)}</Text>
            <View style={styles.matchInfo}>
              <Text style={styles.matchOpponent} numberOfLines={1}>
                {match.opponent ?? match.title}
              </Text>
              {match.location ? (
                <View style={styles.matchVenue}>
                  <MapPin
                    size={12}
                    color={colors.textTertiary}
                    strokeWidth={2}
                  />
                  <Text style={styles.matchVenueText} numberOfLines={1}>
                    {match.location}
                  </Text>
                </View>
              ) : null}
            </View>
            {matchStatusChip(match)}
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardPast: {
    opacity: 0.62,
  },
  // Turneringens gull — samme uttrykk som StatusPill gir en turnering.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.sun,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerPressed: {
    backgroundColor: colors.sunBorder,
  },
  headerIcon: {
    width: 32,
    minHeight: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '800',
    color: colors.goldInk,
  },
  dayCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldInk,
    opacity: 0.75,
  },
  period: {
    ...typography.bodySmall,
    color: colors.goldInk,
    opacity: 0.8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  matchRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  matchRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  // Avsparkstiden er radens tall — displayfonten, som ellers i appen.
  matchTime: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textPrimary,
    minWidth: 46,
  },
  matchInfo: {
    flex: 1,
    gap: 1,
  },
  matchOpponent: {
    ...typography.body,
    fontWeight: '700',
  },
  matchVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchVenueText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
