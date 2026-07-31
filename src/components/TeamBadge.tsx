import React, {useState} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {colors, radius} from '../theme';
import {useActiveTeam} from '../context';
import {inkOnTeamColor} from '../shared/teamColors';

/** «Kjelsås G14» → «KG», ett ord → to første tegn. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

interface TeamBadgeProps {
  /** Navn for initial-fallbacken — default aktivt lags visningsnavn. */
  name?: string;
  /**
   * Egen logo-kjede — for merker som IKKE gjelder aktivt lag (f.eks.
   * «Dine lag» på Profil). `null` = ingen logo (initialer), utelatt =
   * aktivt lags kjede fra context.
   */
  logoUrl?: string | null;
  /** Egen lagfarge for initial-fyllet — default aktivt lags farge. */
  color?: string;
  size?: number;
  /** Hjørneradius — stadionflatene bruker radius.lg, headeren full sirkel. */
  cornerRadius?: number;
  /** Initial-/logostørrelsen varierer per flate — default ~30 % av size. */
  fontSize?: number;
  /** Hvit plate bak logoen — for mørke stadionflater (transparent PNG). */
  logoPlate?: boolean;
  /** Ekstra stil på rammen, f.eks. ringen på stadionflatene. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Lagmerket, ett sted: logo med fallback-kjeden lag → klubb → initialer på
 * lagfarge (P3/P4-modellen). Feiler bildelastingen huskes URL-en og vi
 * faller tilbake til initialene i stedet for en tom flate; et lagbytte
 * (annen URL) prøver på nytt.
 */
export function TeamBadge({
  name,
  logoUrl: logoUrlProp,
  color,
  size = 48,
  cornerRadius = radius.lg,
  fontSize,
  logoPlate = false,
  style,
}: TeamBadgeProps) {
  const {activeTeamSpace, activeTeam} = useActiveTeam();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const teamColor = color || activeTeamSpace?.color || colors.info;
  const logoUrl =
    logoUrlProp !== undefined
      ? logoUrlProp
      : activeTeamSpace?.logoUrl ?? activeTeam?.club.logoUrl ?? null;
  const showLogo = logoUrl != null && logoUrl !== failedUrl;
  const label = name ?? activeTeamSpace?.displayName ?? '?';

  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: cornerRadius,
    overflow: 'hidden',
  };

  if (showLogo) {
    return (
      <View style={[frame, styles.center, logoPlate && styles.plate, style]}>
        <Image
          source={{uri: logoUrl}}
          style={StyleSheet.absoluteFillObject}
          onError={() => setFailedUrl(logoUrl)}
        />
      </View>
    );
  }

  return (
    <View
      style={[frame, styles.center, {backgroundColor: teamColor}, style]}>
      {/* Gult lagmerke krever mørke initialer (inkOnTeamColor). */}
      <Text
        style={[
          styles.initials,
          {
            fontSize: fontSize ?? Math.round(size * 0.3),
            color: inkOnTeamColor(teamColor),
          },
        ]}>
        {initials(label)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    backgroundColor: '#FFFFFF',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
