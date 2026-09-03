import React, {useState} from 'react';
import {View, Text, Pressable, StatusBar, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {useActiveTeam} from '../context';
import {StadiumSurface} from './StadiumSurface';
import {TeamBadge} from './TeamBadge';
import {Trophy} from './icons';
import {teamSpotlight} from '../shared/teamColors';
import {nameMaxWidth} from '../shared/masthead';
import {HEADER_FOOT_HEIGHT} from '../shared/headerGeometry';

interface TeamHeaderProps {
  /**
   * Viser en «Sesongen»-chip til høyre som åpner sesongflaten. Kun Hjem
   * sender den — de andre fanene har ikke Season-skjermen i stacken sin.
   */
  onSeasonPress?: () => void;
}

/** Logoplate 38 + 2×2 luft. Navneblokken starter etter padding + plate + gap. */
const LOGO_PLATE = 42;
const NAME_START = spacing.lg + LOGO_PLATE + spacing.md;

/**
 * Lagets toppflate — identisk på Hjem, Kalender og Varsler.
 *
 * MASTHEAD (Brage 2026-09-03): laghodet er IKKE en egen flate. Det er
 * gjennomsiktig innhold — logo, navn, metadata, «Sesongen» — oppå ÉTT lerret,
 * DaylightGround i masthead-modus, som spenner fra statuslinja til bunnen og
 * tegner reisen, lagets identitetsfelt og buene. Ingen fot, ingen hårlinje,
 * ingen skjøt — det finnes ikke to flater lenger.
 *
 * Statuslinja står på den universelle mørke basen og er lys på ALLE lag.
 * Blekket velges mot lagets rene farge (`teamSpotlight`), som feltet har i
 * full styrke: gul, lyseblå og oransje får mørkt blekk, resten hvitt.
 * Lagnavnet klippes innenfor feltets fulle lagfarge.
 *
 * Høyden er som før: insets.top + 42 + 12 = 113 pt på iPhone med Dynamic
 * Island — nøyaktig `mastheadHeight`, som lerretet regner med.
 */
export function TeamHeader({onSeasonPress}: TeamHeaderProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const {activeTeamSpace, activeTeam, activeMemberCount} = useActiveTeam();
  const [width, setWidth] = useState(0);

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;
  const {ink, light} = teamSpotlight(teamColor);
  const inkRgb = light ? '17, 36, 27' : '255, 255, 255';

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
    <View
      style={[
        styles.container,
        {paddingTop: insets.top, paddingBottom: HEADER_FOOT_HEIGHT},
      ]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Statuslinja ligger på den universelle mørke basen — lys tekst på ALLE
          lag. Focus-vakt: uten den ville Hjem-headeren styrt statuslinja videre
          på skjermer som pushes oppå (EventDetail o.l.). */}
      {isFocused && <StatusBar barStyle="light-content" />}

      {/* Logoplaten: hvit, men som materiale — svakt gjennomskinnelig, lys
          kant som fanger lyset, myk skygge ned i grunnen. Logoen beholder sine
          egne farger i full opacity. */}
      <View
        style={[
          styles.logoPlate,
          // På en LYS lagfarge (gul, oransje, lyseblå) forsvinner den hvite
          // platen mot feltet — da holder en hårfin blekkring ytterkanten.
          light && {borderColor: `rgba(${inkRgb}, 0.35)`},
        ]}>
        <TeamBadge
          size={38}
          cornerRadius={radius.full}
          fontSize={14}
          logoPlate
        />
      </View>
      <View
        style={[
          styles.nameWrap,
          width > 0 && {maxWidth: nameMaxWidth(width, NAME_START)},
        ]}>
        <Text style={[styles.name, {color: ink}]} numberOfLines={1}>
          {activeTeamSpace.displayName}
        </Text>
        {subtitle.length > 0 && (
          <Text
            style={[styles.subtitle, {color: `rgba(${inkRgb}, 0.72)`}]}
            numberOfLines={1}>
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
          {/* Kampdata bor på mørk stadionflate — også som liten chip. Den
              står på den mørke høyresiden, så stadionkanten er alltid på. */}
          <StadiumSurface
            style={styles.seasonChip}
            flood={false}
            arc={false}
            bordered>
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
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    // GJENNOMSIKTIG: lerretet (DaylightGround masthead) ligger bak.
    backgroundColor: 'transparent',
  },
  // Lagmerket 38 + 2×2 luft = 42 = HEADER_CONTENT_HEIGHT. Platen er det
  // høyeste elementet i raden, så raden er nøyaktig 42 pt høy.
  logoPlate: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: radius.full,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
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
