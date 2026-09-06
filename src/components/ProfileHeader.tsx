import React, {useState} from 'react';
import {View, Text, StatusBar, StyleSheet, Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import {avatarRef} from '../lib/media/avatar';
import {teamSpotlight} from '../shared/teamColors';
import {nameMaxWidth} from '../shared/masthead';
import {
  HEADER_CONTENT_HEIGHT,
  HEADER_FOOT_HEIGHT,
} from '../shared/headerGeometry';

/**
 * Profilens identitetsfelt — Heias mørkegrønne, IKKE lagfargen.
 *
 * FARGEN BÆRER MENING (låst 2026-08-19). Lagfargen i laghodet er et
 * scope-signal, ikke dekor: alt under den er lag-scopet. Profil er ikke det —
 * «Min støtte» er avtalene dine på tvers av lag, «Klubbetalinger» er en
 * juridisk enhet, «Heia Ops» er alle klubber, og kontoen er din. Å male
 * feltet i det aktive lagets farge ville påstått et scope skjermen ikke har.
 * Dessuten står lagbytteren PÅ denne skjermen: et felt som skifter farge når
 * du trykker et lagkort under det, mens navnet og e-posten i feltet ikke
 * endrer seg, er en animasjon som sier feil ting.
 *
 * Sendes til `<DaylightGround masthead identity={PROFILE_IDENTITY} />` i
 * ProfilScreen — lerretet tegner feltet, headeren er innhold oppå.
 */
export const PROFILE_IDENTITY = colors.heiaDeep;

/** Blekket mot feltet — samme regel som laghodet (hvitt på mørkt felt). */
const SPOT = teamSpotlight(PROFILE_IDENTITY);
const INK_RGB = SPOT.light ? '17, 36, 27' : '255, 255, 255';

/** Avatar 40 + 2×1 luft = 42 = lagmerkets plate. Navneblokken starter etter
 *  padding + ring + gap — samme regnestykke som TeamHeader. */
const AVATAR_RING = HEADER_CONTENT_HEIGHT;
const NAME_START = spacing.lg + AVATAR_RING + spacing.md;

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
 * Profilens topp — SAMME masthead som laghodet (Brage 2026-09-04: «samme
 * header og bakgrunn som resten av sidene»).
 *
 * MASTHEAD: headeren er IKKE en egen flate. Den er gjennomsiktig innhold —
 * avatar, navn + e-post, rollebadge — oppå ÉTT lerret, DaylightGround i
 * masthead-modus, som spenner fra statuslinja til bunnen og tegner reisen,
 * identitetsfeltet og buene. Ingen egen gradient, ingen egne buer, ingen
 * hårlinje under — det finnes ikke to flater lenger. Det som skiller Profil
 * fra Hjem/Kalender/Varsler er BARE feltets farge (PROFILE_IDENTITY).
 *
 * ANATOMIEN er TeamHeaders, slot for slot — det er dét som gjør dem til én
 * familie, og det som gjør at fanebytte ikke bytter modell:
 *   venstre  · avatar        (der lagmerket står)
 *   midt     · navn + e-post (der lagnavn + «Fotball · 18 medlemmer» står)
 *   høyre    · rollebadge    (der «Sesongen»-chipen står)
 *
 * Høyden er laghodets: insets.top + 42 + 12 = `mastheadHeight`, som lerretet
 * regner med. Statisk, som headeren ellers i appen: ingen kollaps, ingen
 * krysstoning, ingen scrollstyrt animasjon.
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
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[
        styles.container,
        {paddingTop: insets.top, paddingBottom: HEADER_FOOT_HEIGHT},
      ]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Statuslinja ligger på den universelle mørke basen — lys tekst.
          Fokus-vakt som i TeamHeader: uten den ville Profil styrt statuslinja
          videre på skjermer som pushes oppå (ChangePassword, Lagoversikt …). */}
      {isFocused && <StatusBar barStyle="light-content" />}

      {/* Avatar 40 + 1 px ring = 42 = lagmerkets 38 + 2×2. Høydene matcher ved
          konstruksjon, ikke ved justering. Ringen holder kanten på et
          profilbilde skarp mot det mørke feltet; initialer klarer seg selv.

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

      {/* Navn + e-post klippes innenfor feltets fulle farge, som lagnavnet. */}
      <View
        style={[
          styles.textWrap,
          width > 0 && {maxWidth: nameMaxWidth(width, NAME_START)},
        ]}>
        <Text style={[styles.name, {color: SPOT.ink}]} numberOfLines={1}>
          {name}
        </Text>
        {/* Midt-ellipsis: det er DOMENET som avslører feil konto, og halen er
            nettopp det en vanlig ellipsis spiser. */}
        {!!email && (
          <Text
            style={[styles.email, {color: `rgba(${INK_RGB}, 0.72)`}]}
            numberOfLines={1}
            ellipsizeMode="middle">
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
    gap: spacing.md,
    // GJENNOMSIKTIG: lerretet (DaylightGround masthead) ligger bak.
    backgroundColor: 'transparent',
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
  },
  email: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  // Samme form som «Sesongen»-chipen i TeamHeader — den plassen i raden er
  // allerede en pill. Her er den ren informasjon, så den er ikke trykkbar.
  // Den står på den mørke basen utenfor feltet, som Sesongen-chipen.
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
