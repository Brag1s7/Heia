import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {useActiveTeam} from '../context';

/** Initialer til lagmerket: «Kjelsås G14» → «KG», ett ord → to første tegn. */
function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

export function TeamHeader() {
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
});
