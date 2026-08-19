import React, {useState} from 'react';
import {View, Text, Pressable, StatusBar, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import Svg, {Circle, Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors, typography, spacing, radius} from '../theme';
import {useActiveTeam} from '../context';
import {StadiumSurface} from './StadiumSurface';
import {TeamBadge} from './TeamBadge';
import {Trophy} from './icons';
import {teamHeaderSurface} from '../shared/teamColors';
// Geometrien deles med ProfileHeader (og StadiumSurface) — se modulen.
import {
  ARC_INSET_RIGHT,
  ARC_INSET_BOTTOM,
  ARC_R_OUTER,
  ARC_R_INNER,
  ARC_STROKE,
  ARC_OPACITY_OUTER,
  ARC_OPACITY_INNER,
} from '../shared/headerGeometry';


interface TeamHeaderProps {
  /**
   * Viser en «Sesongen»-chip til høyre som åpner sesongflaten. Kun Hjem
   * sender den — de andre fanene har ikke Season-skjermen i stacken sin.
   */
  onSeasonPress?: () => void;
}

/**
 * Lagets toppflate — identisk på Hjem, Kalender og Varsler.
 *
 * Headeren er en HEL lagfarget flate som dekker helt opp i statuslinja. Den
 * bygges i tre lag, alle i ekte svg (samme teknikk som StadiumSurface):
 *   1. gradienten — lagets faktiske farge ren og flat gjennom logo/navn, så
 *      dypere mot midten, og til slutt mørkere med et lett drag mot Heias
 *      teal ved høyre kant,
 *   2. banesirkelen — to konsentriske buer i høyre kant, med nøyaktig samme
 *      geometri som kampkortene (se ARC_*-konstantene),
 *   3. innholdet — logo, navn, metadata, «Sesongen».
 *
 * Buene ligger kun i høyre tredjedel og har så lav opacity at de aldri
 * konkurrerer med teksten; kontrasten er målt der bokstavene faktisk står.
 * Tekst- og ikonfargen kommer fra teamHeaderSurface, så både knallgult og
 * nesten-sort lag får lesbar header uten hardkodede unntak.
 */
export function TeamHeader({onSeasonPress}: TeamHeaderProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const {activeTeamSpace, activeTeam, activeMemberCount} = useActiveTeam();
  // Buer og bølger trenger ekte piksler (prosent på r/cx gir skjeve former).
  const [box, setBox] = useState({w: 0, h: 0});

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;

  // Kontrastsikret flate: venstre kant er lagets faktiske farge, høyre kant
  // samme farge ~10 % mørkere. Valøren justeres kun hvis fargen ikke klarer
  // 4.5:1. Ett kall dekker både knallgult og nesten-sort.
  const {surface, surfaceMid, surfaceEdge, ink, light} =
    teamHeaderSurface(teamColor);
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
        {
          paddingTop: insets.top + spacing.xs,
          backgroundColor: surface,
          borderBottomColor: `rgba(${inkRgb}, 0.18)`,
        },
      ]}>
      {/* Statuslinja ligger oppå lagfargen — mørke lag krever lys tekst.
          Focus-vakt: uten den ville Hjem-headeren styrt statuslinja videre
          på skjermer som pushes oppå (EventDetail o.l.). */}
      {isFocused && (
        <StatusBar barStyle={light ? 'dark-content' : 'light-content'} />
      )}

      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={e =>
          setBox({
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }>
        <Svg width="100%" height="100%">
          <Defs>
            {/* Laget eier venstresiden: den faktiske fargen ligger ren og
                flat gjennom logo- og navneområdet (0–18 %), synker så til
                samme familie litt dypere (55 %), og lander i en mørkere,
                roligere tone med et lett drag mot Heias teal ved høyre kant.
                Ingen vertikal fade — bunnen skal ikke bli lys eller grå. */}
            <LinearGradient id="teamDepth" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={surface} />
              <Stop offset="0.18" stopColor={surface} />
              <Stop offset="0.55" stopColor={surfaceMid} />
              <Stop offset="1" stopColor={surfaceEdge} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#teamDepth)" />

          {/* Banesirkelen, samme kurve som kampkortene. Konsentrisk, forankret
              i høyre kant, tegnet i kontrastfargen med lav opacity — den skal
              lese som dybde i flaten, ikke som dekor oppå den. Med radius 100
              starter den ytterste buen ~260 px inn, altså godt til høyre for
              lagnavnet. */}
          {box.w > 0 && (
            <>
              <Circle
                cx={box.w - ARC_INSET_RIGHT}
                cy={box.h - ARC_INSET_BOTTOM}
                r={ARC_R_OUTER}
                fill="none"
                stroke={ink}
                strokeOpacity={ARC_OPACITY_OUTER}
                strokeWidth={ARC_STROKE}
              />
              <Circle
                cx={box.w - ARC_INSET_RIGHT}
                cy={box.h - ARC_INSET_BOTTOM}
                r={ARC_R_INNER}
                fill="none"
                stroke={ink}
                strokeOpacity={ARC_OPACITY_INNER}
                strokeWidth={ARC_STROKE}
              />
            </>
          )}
        </Svg>
      </View>

      {/* Ren hvit sirkulær plate under lagmerket. Logoen beholder sine egne
          farger i full opacity — ingen tint, ingen overlay: gradientene over
          ligger BAK denne i treet. Platens hvite kant gjør at ytterkantene på
          logoen står skarpt mot enhver lagfarge. */}
      <View
        style={[
          styles.logoPlate,
          // På en LYS lagfarge (gul, oransje, lyseblå) forsvinner den hvite
          // platen mot bakgrunnen — da holder en hårfin ring ytterkanten
          // skarp. Mørke lagfarger trenger den ikke og får ren hvit sirkel.
          light && {borderColor: `rgba(${inkRgb}, 0.38)`, borderWidth: StyleSheet.hairlineWidth},
        ]}>
        <TeamBadge size={38} cornerRadius={radius.full} fontSize={14} logoPlate />
      </View>
      <View style={styles.nameWrap}>
        <Text style={[styles.name, {color: ink}]} numberOfLines={1}>
          {activeTeamSpace.displayName}
        </Text>
        {subtitle.length > 0 && (
          <Text
            style={[styles.subtitle, {color: `rgba(${inkRgb}, 0.82)`}]}
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
          {/* Kampdata bor på mørk stadionflate — også som liten chip. På et
              mørkt lag ville den dratt i ett med bakgrunnen, så da slås
              stadionkanten på. */}
          <StadiumSurface
            style={styles.seasonChip}
            flood={false}
            arc={false}
            bordered={!light}>
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
    paddingBottom: spacing.sm,
    gap: spacing.md,
    // Skiller flaten fra innholdet som scroller under.
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Lagmerket 38 + 2×2 luft = 42. Platen er nå det høyeste elementet i raden
  // (navneblokken ligger på ~38–40), så headeren er ~2 px høyere enn før —
  // under merkbarhetsgrensen, og høydevakten holder: neste hendelse-kortet
  // skal fortsatt synes uten scrolling.
  logoPlate: {
    backgroundColor: '#FFFFFF',
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
