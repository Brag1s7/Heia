import React from 'react';
import {View, Text, Pressable, StyleSheet, Animated} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {LiveBadge} from './LiveBadge';
import {StadiumSurface} from './StadiumSurface';
import {TeamBadge} from './TeamBadge';
import {useActiveTeam} from '../context';
import {useGoalMoment, GOAL_CELEBRATION_TINT} from './useGoalMoment';
import type {HeiaEvent} from '../shared/types';

interface LiveMatchBannerProps {
  event: HeiaEvent;
  onPress: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

/**
 * Stadion-heroen (A v2): kampen bor alltid på mørk flate, og dette er den
 * største av dem. Flomlys-glød, banesirkel og glødende mint-score — glød er
 * ellers rasjonert, men live-scoren er ett av de reserverte stedene.
 */
export function LiveMatchBanner({event, onPress}: LiveMatchBannerProps) {
  const {activeTeamSpace} = useActiveTeam();

  // MÅL-øyeblikket gjelder også her: feed-subscriben på Hjem refetcher
  // banneret ved hvert mål (målet er en feed-post), så scoren spretter hos
  // foreldre som står på Hjem. Kalles før early return — hooks-regelen.
  const {scoreScale, celebrate} = useGoalMoment(
    event.score?.home ?? 0,
    event.score?.away ?? 0,
  );

  // Pause er også «pågående» — kampen er ikke over, klokka står bare stille.
  const isPaused = event.matchStatus === 'halfTime';
  const isUnderway = event.matchStatus === 'live' || isPaused;
  if (!event.score || !event.opponent || !isUnderway) {
    return null;
  }

  const teamName = activeTeamSpace?.displayName ?? 'Oss';
  const teamColor = activeTeamSpace?.color || colors.info;
  const minute =
    !isPaused && event.startedAt
      ? Math.max(0, Math.floor((Date.now() - event.startedAt.getTime()) / 60000))
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Følg kampen mot ${event.opponent}`}
      style={({pressed}) => [styles.wrap, pressed && styles.pressed]}>
      <StadiumSurface style={styles.banner}>
      {/* Mål for oss: kort mint-glød over flaten (feiring i grønt, aldri
          coral). Ligger under innholdet — teksten skal ikke tones. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.celebration, {opacity: celebrate}]}
      />
      <View style={styles.topRow}>
        <LiveBadge paused={isPaused} />
        {minute !== null && (
          <View style={styles.minutePill}>
            <Text style={styles.minuteText}>{minute}′</Text>
          </View>
        )}
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          {/* Lagmerket (logo → initialer) — hvit plate bak logoen mot den
              mørke stadionflaten; motstanderen er urørt. */}
          <TeamBadge
            size={42}
            cornerRadius={radius.lg - 1}
            fontSize={13}
            logoPlate
            name={teamName}
            style={styles.usRing}
          />
          <Text style={styles.teamName} numberOfLines={2}>
            {teamName}
          </Text>
          <View style={[styles.usMark, {backgroundColor: teamColor}]} />
        </View>

        <Animated.Text
          style={[styles.score, {transform: [{scale: scoreScale}]}]}>
          {event.score.home}–{event.score.away}
        </Animated.Text>

        <View style={styles.teamCol}>
          <View style={[styles.teamBadge, styles.themBadge]}>
            <Text style={styles.teamBadgeText}>{initials(event.opponent)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {event.opponent}
          </Text>
        </View>
      </View>

      {event.location && (
        <Text style={styles.location} numberOfLines={1}>
          {event.location}
        </Text>
      )}

      <View style={styles.cta}>
        <Text style={styles.ctaText}>Følg kampen</Text>
      </View>
      </StadiumSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    ...shadows.elevated,
  },
  banner: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  celebration: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GOAL_CELEBRATION_TINT,
  },
  pressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minutePill: {
    backgroundColor: colors.heia,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  minuteText: {
    ...typography.scoreSmall,
    fontSize: 13,
    color: colors.heiaDeep,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.lg - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // «Oss»-siden markeres med ring i lagfargen — mot stadionbunnen
  usRing: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  themBadge: {
    backgroundColor: '#3A4750',
  },
  teamBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.stadiumText,
    textAlign: 'center',
    lineHeight: 16,
  },
  usMark: {
    width: 26,
    height: 3,
    borderRadius: 2,
  },
  score: {
    ...typography.scoreLarge,
    color: colors.heia,
    textShadowColor: 'rgba(2, 255, 171, 0.4)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 16,
  },
  location: {
    ...typography.caption,
    color: colors.stadiumDim,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'center',
    backgroundColor: colors.heia,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md - 2,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
});
