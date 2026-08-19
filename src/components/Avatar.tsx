import React, {useState} from 'react';
import {View, Text, StyleSheet, type ViewStyle} from 'react-native';
import {radius} from '../theme';
import {avatarColorFor, inkOnAvatarColor} from '../shared/avatarColors';
import {MediaImage} from '../lib/media/MediaImage';
import type {MediaRef} from '../lib/media/types';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  /**
   * Profilbildet som MediaRef (00068) — path i den PRIVATE `avatars`-
   * bucketen, aldri en URL. Bruk `avatarRef()` fra lib/media/avatar.
   * Utelatt/null = initialer.
   */
  media?: MediaRef | null;
  name: string;
  /**
   * Selvvalgt bakgrunnsfarge (00070). Utelatt/null = navne-hashen, som
   * før. Vises kun når det ikke er noe bilde over den.
   */
  color?: string | null;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 20,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

/**
 * Avataren er appens mest gjentatte bilde — én per feed-rad, én per
 * kommentar, én per varsel. Derfor går den gjennom `MediaImage` som alt
 * annet media (P4): expo-images 150 MB disk-cache, nøklet på bucket+path,
 * så et ferskt signert token fortsatt er et cache-TREFF. Frem til
 * profilbilde-skiva brukte den RNs vanlige `<Image>` og lå UTENFOR hele
 * mediepipelinen — å koble på opplasting uten dette ville vært en
 * egress-regresjon på nettopp det bildet som gjentas mest.
 *
 * INITIALENE LIGGER ALLTID UNDER. Bildet tegnes oppå, og det gjør
 * fallbacken gratis i alle tre tilfellene som faktisk oppstår: ingen path,
 * path som ennå ikke er signert, og path som peker på en fil som er borte
 * (fjernet profilbilde — frosne varselrader fra 00051 bærer den gamle
 * path-en videre). Ingen tom sirkel noe sted.
 */
export function Avatar({
  media,
  name,
  color,
  size = 'md',
  style,
}: AvatarProps) {
  const dim = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const bg = avatarColorFor(name, color);
  // Stabil setter — sendes rett til MediaImage uten useCallback-seremoni.
  const [hasImage, setHasImage] = useState(false);
  // `media` leses med i vurderingen, ikke bare `hasImage`: blir bildet
  // FJERNET mens raden står montert, unmountes MediaImage og rekker aldri
  // å melde fra — uten dette ville sirkelen blitt stående tom.
  const showInitials = !media || !hasImage;

  const containerStyle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: radius.full,
    overflow: 'hidden',
  };

  return (
    <View
      style={[
        containerStyle,
        {backgroundColor: bg},
        styles.initialsContainer,
        style,
      ]}
    >
      {/* Skjules når bildet faktisk er der — ellers ville et halvgjennom-
          siktig PNG vist bokstaver gjennom ansiktet. */}
      {showInitials && (
        <Text
          style={[styles.initials, {fontSize, color: inkOnAvatarColor(bg)}]}>
          {getInitials(name)}
        </Text>
      )}
      {!!media && (
        <MediaImage
          media={media}
          variant="thumb"
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onResolved={setHasImage}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    // Fargen settes per avatar (lys palett-farge krever mørkt blekk).
    fontWeight: '600',
  },
});
