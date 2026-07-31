import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {useActiveTeam} from '../context';
import {StadiumSurface} from './StadiumSurface';
import {TeamBadge} from './TeamBadge';
import {Trophy} from './icons';

interface TeamHeaderProps {
  /**
   * Viser en «Sesongen»-chip til høyre som åpner sesongflaten. Kun Hjem
   * sender den — de andre fanene har ikke Season-skjermen i stacken sin.
   */
  onSeasonPress?: () => void;
}

export function TeamHeader({onSeasonPress}: TeamHeaderProps) {
  const insets = useSafeAreaInsets();
  const {activeTeamSpace, activeTeam, activeMemberCount} = useActiveTeam();

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;

  // Undertekst: «Fotball · 18 medlemmer»; før tallet finnes (eller om
  // hentingen feiler): «Fotball · G14». Aldri en tom linje.
  const subtitle = [
    activeTeam?.sport.displayName,
    activeMemberCount != null
      ? activeMemberCount === 1
        ? '1 medlem'
        : `${activeMemberCount} medlemmer`
      : activeTeam?.ageGroup,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.container, {paddingTop: insets.top + spacing.sm}]}>
      {/* Lagfargen bor i ringen — lagmerket (logo → initialer) inni */}
      <View style={[styles.badgeRing, {borderColor: teamColor}]}>
        <TeamBadge size={32} cornerRadius={radius.full} fontSize={12} />
      </View>
      <View style={styles.nameWrap}>
        <Text style={styles.name} numberOfLines={1}>
          {activeTeamSpace.displayName}
        </Text>
        {subtitle.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {onSeasonPress && (
        <Pressable
          onPress={onSeasonPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sesongen"
          style={({pressed}) => [
            styles.seasonWrap,
            pressed && styles.seasonPressed,
          ]}>
          {/* Kampdata bor på mørk stadionflate — også som liten chip. */}
          <StadiumSurface
            style={styles.seasonChip}
            flood={false}
            arc={false}
            bordered={false}>
            <Trophy size={14} color={colors.heia} strokeWidth={2.2} />
            <Text style={styles.seasonText}>Sesongen</Text>
          </StadiumSurface>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  // 32 + 2×2 padding + 2×2 border = 40 totalt — samme høyde som før
  // (høydevakten: neste hendelse-kortet skal fortsatt synes uten scrolling)
  badgeRing: {
    borderWidth: 2,
    borderRadius: radius.full,
    padding: 2,
  },
  nameWrap: {
    flexShrink: 1,
  },
  name: {
    ...typography.heading3,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textSecondary,
    marginTop: 1,
  },
  seasonWrap: {
    marginLeft: 'auto',
  },
  seasonPressed: {
    opacity: 0.7,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  seasonText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stadiumText,
  },
});
