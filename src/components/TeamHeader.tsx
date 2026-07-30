import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {useActiveTeam} from '../context';
import {StadiumSurface} from './StadiumSurface';
import {Trophy} from './icons';

/** Initialer til lagmerket: «Kjelsås G14» → «KG», ett ord → to første tegn. */
function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

interface TeamHeaderProps {
  /**
   * Viser en «Sesongen»-chip til høyre som åpner sesongflaten. Kun Hjem
   * sender den — de andre fanene har ikke Season-skjermen i stacken sin.
   */
  onSeasonPress?: () => void;
}

export function TeamHeader({onSeasonPress}: TeamHeaderProps) {
  const insets = useSafeAreaInsets();
  const {activeTeamSpace} = useActiveTeam();

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;

  return (
    <View style={[styles.container, {paddingTop: insets.top + spacing.sm}]}>
      {/* Lagfargens identitetsrolle: ring rundt merket + stripe under navnet */}
      <View style={[styles.badgeRing, {borderColor: teamColor}]}>
        <View style={[styles.badge, {backgroundColor: teamColor}]}>
          <Text style={styles.badgeText}>
            {teamInitials(activeTeamSpace.displayName)}
          </Text>
        </View>
      </View>
      <View style={styles.nameWrap}>
        <Text style={styles.name} numberOfLines={1}>
          {activeTeamSpace.displayName}
        </Text>
        <View style={[styles.stripe, {backgroundColor: teamColor}]} />
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
  badgeRing: {
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: 2,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nameWrap: {
    flexShrink: 1,
  },
  name: {
    ...typography.heading3,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stripe: {
    width: 34,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
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
