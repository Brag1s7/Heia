import React, {useState} from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {inkOnTeamColor} from '../shared/teamColors';
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
  const {activeTeamSpace, activeTeam, activeMemberCount} = useActiveTeam();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;

  // Logo-sirkelens fallback-kjede: lag-logo → klubblogo → initialer på
  // lagfarge. URL-ene settes først i P4 (laginnstillinger), men kjeden står
  // klar. Feiler nedlastingen faller vi tilbake til initialene i stedet for
  // en tom sirkel.
  const logoUrl = activeTeamSpace.logoUrl ?? activeTeam?.club.logoUrl ?? null;
  const showLogo = logoUrl != null && logoUrl !== failedLogoUrl;

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
      {/* Lagfargen bor i ringen — logoen (eller initial-fyllet) inni */}
      <View style={[styles.badgeRing, {borderColor: teamColor}]}>
        {showLogo ? (
          <Image
            source={{uri: logoUrl}}
            style={styles.logo}
            onError={() => setFailedLogoUrl(logoUrl)}
          />
        ) : (
          <View style={[styles.badge, {backgroundColor: teamColor}]}>
            <Text
              style={[styles.badgeText, {color: inkOnTeamColor(teamColor)}]}>
              {teamInitials(activeTeamSpace.displayName)}
            </Text>
          </View>
        )}
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
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
  },
  // Farge settes inline — gult krever mørke initialer (inkOnTeamColor).
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
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
