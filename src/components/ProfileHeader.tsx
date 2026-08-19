import React, {useState} from 'react';
import {View, Text, StatusBar, StyleSheet, Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import Svg, {Circle, Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import {avatarRef} from '../lib/media/avatar';
import {
  ARC_INSET_RIGHT,
  ARC_INSET_BOTTOM,
  ARC_R_OUTER,
  ARC_R_INNER,
  ARC_STROKE,
  ARC_OPACITY_OUTER,
  ARC_OPACITY_INNER,
  HEADER_CONTENT_HEIGHT,
} from '../shared/headerGeometry';

interface ProfileHeaderProps {
  name: string;
  /** Kontoen du er logget inn med. Utelates aldri når den finnes. */
  email?: string | null;
  /** Profilbilde som path i `avatars`-bucketen (00068), ikke URL.
   *  Faller til initialer i Avatar når den mangler. */
  avatarPath?: string | null;
  /** Selvvalgt avatarfarge (00070) — bak initialene. */
  avatarColor?: string | null;
  /** Rollen din i det AKTIVE laget (lagkortene rett under viser hvilket). */
  role?: string | null;
  /**
   * Trykk på avataren. Utelatt = ikke trykkbar (headeren brukes bare på
   * Profil i dag, men komponenten skal ikke ANTA at den gjør det).
   */
  onPressAvatar?: () => void;
  /** Opplasting/lagring pågår — avataren dempes så knappen ikke føles død. */
  avatarBusy?: boolean;
}

/**
 * Profilens toppflate — samme familie som TeamHeader, egen farge.
 *
 * FARGEN BÆRER MENING (låst 2026-08-19). Lagfargen i TeamHeader er et
 * scope-signal, ikke dekor: alt under den er lag-scopet. Profil er ikke det —
 * «Min støtte» er avtalene dine på tvers av lag, «Klubbetalinger» er en
 * juridisk enhet, «Heia Ops» er alle klubber, og kontoen er din. Å male den i
 * det aktive lagets farge ville påstått et scope skjermen ikke har. Dessuten
 * står lagbytteren PÅ denne skjermen: en header som skifter farge når du
 * trykker et lagkort under den, mens navnet og e-posten over ikke endrer seg,
 * er en animasjon som sier feil ting.
 *
 * ANATOMIEN er derimot TeamHeaders, slot for slot — det er dét som gjør dem
 * til én familie:
 *   venstre  · avatar        (der lagmerket står)
 *   midt     · navn + e-post (der lagnavn + «Fotball · 18 medlemmer» står)
 *   høyre    · rollebadge    (der «Sesongen»-chipen står)
 *
 * Statisk, som headeren ellers i appen: ingen kollaps, ingen krysstoning,
 * ingen scrollstyrt animasjon. Fanebytte skal føles stabilt.
 */
export function ProfileHeader({
  name,
  email,
  avatarPath,
  avatarColor,
  role,
  onPressAvatar,
  avatarBusy = false,
}: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  // Buer trenger ekte piksler (prosent på r/cx gir skjeve former).
  const [box, setBox] = useState({w: 0, h: 0});

  return (
    <View style={[styles.container, {paddingTop: insets.top + spacing.xs}]}>
      {/* Fokus-vakt som i TeamHeader: uten den ville Profil styrt statuslinja
          videre på skjermer som pushes oppå (ChangePassword, Lagoversikt …). */}
      {isFocused && <StatusBar barStyle="light-content" />}

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
            {/* Samme oppbygning som TeamHeaders gradient, men på Heias faste
                merkevaregrønne: ren og flat gjennom avatar/navn, dypere mot
                midten, mørkest ved høyre kant. Ingen vertikal fade — bunnen
                skal ikke bli lys eller grå. */}
            <LinearGradient id="profileDepth" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={colors.heiaDeep} />
              <Stop offset="0.18" stopColor={colors.heiaDeep} />
              <Stop offset="0.55" stopColor="#073026" />
              <Stop offset="1" stopColor={colors.stadium} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#profileDepth)"
          />

          {/* Banesirkelen — nøyaktig samme geometri som TeamHeader og
              kampkortene (delte konstanter). */}
          {box.w > 0 && (
            <>
              <Circle
                cx={box.w - ARC_INSET_RIGHT}
                cy={box.h - ARC_INSET_BOTTOM}
                r={ARC_R_OUTER}
                fill="none"
                stroke={colors.stadiumText}
                strokeOpacity={ARC_OPACITY_OUTER}
                strokeWidth={ARC_STROKE}
              />
              <Circle
                cx={box.w - ARC_INSET_RIGHT}
                cy={box.h - ARC_INSET_BOTTOM}
                r={ARC_R_INNER}
                fill="none"
                stroke={colors.stadiumText}
                strokeOpacity={ARC_OPACITY_INNER}
                strokeWidth={ARC_STROKE}
              />
            </>
          )}
        </Svg>
      </View>

      {/* Avatar 40 + 1 px ring = 42 = lagmerkets 38 + 2×2. Høydene matcher ved
          konstruksjon, ikke ved justering. Ringen holder kanten på et
          profilbilde skarp mot den mørke flaten; initialer klarer seg selv.

          AVATAREN ER INNGANGEN til å sette profilbilde (00068): ingen egen
          rad i Innstillinger, ingen blyant-ikon. Å trykke på bildet sitt er
          den vante bevegelsen, og «Innstillinger» ble nettopp ryddet i B6 —
          en ny rad der ville jobbet mot den ryddingen. */}
      <Pressable
        onPress={onPressAvatar}
        disabled={!onPressAvatar || avatarBusy}
        hitSlop={8}
        accessibilityRole={onPressAvatar ? 'button' : undefined}
        accessibilityLabel={onPressAvatar ? 'Endre profilbilde' : undefined}
        style={({pressed}) => [
          styles.avatarRing,
          (avatarBusy || (pressed && onPressAvatar)) && styles.avatarPressed,
        ]}>
        <Avatar
          name={name}
          media={avatarRef(avatarPath)}
          color={avatarColor}
          size="md"
        />
      </Pressable>

      <View style={styles.textWrap}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {/* Midt-ellipsis: det er DOMENET som avslører feil konto, og halen er
            nettopp det en vanlig ellipsis spiser. */}
        {!!email && (
          <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
            {email}
          </Text>
        )}
      </View>

      {!!role && (
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
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
    // Fallback-bunn bak svg-en (synlig et blunk mens den måles opp).
    backgroundColor: colors.heiaDeep,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  },
  avatarPressed: {
    opacity: 0.7,
  },
  avatarRing: {
    borderRadius: radius.full,
    padding: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    minHeight: HEADER_CONTENT_HEIGHT,
    justifyContent: 'center',
  },
  textWrap: {
    flexShrink: 1,
  },
  name: {
    ...typography.heading3,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.stadiumText,
  },
  email: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 1,
    color: 'rgba(234, 255, 246, 0.82)',
  },
  // Samme form som «Sesongen»-chipen i TeamHeader — den plassen i raden er
  // allerede en pill. Her er den ren informasjon, så den er ikke trykkbar.
  roleBadge: {
    marginLeft: 'auto',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(2, 255, 171, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(2, 255, 171, 0.35)',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.heia,
  },
});
