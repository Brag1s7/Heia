import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Pressable,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {OPAL} from '../components/OpalSurface';
import {
  GLASS_FIELD,
  LiquidGlassSurface,
} from '../components/LiquidGlassSurface';
import {inkOnTeamColor} from '../shared/teamColors';
import type {ProfilStackParamList} from '../shared/types';
import {
  ProfilPage,
  Button,
  TeamColorPicker,
  useBottomContentPadding,
} from '../components';
import {ChevronRight, HandHeart, Wallet} from '../components/icons';
import {useActiveTeam} from '../context';
import {pickLogoImage} from '../lib/media';
import {
  updateTeamColor,
  updateTeamName,
  updateTeamLogo,
  setClubLogo,
  isPaymentManager,
} from '../lib/api';

/** «Kjelsås G14» → «KG», ett ord → to første tegn (samme som TeamHeader). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Logo-sirkel med initial-fallback — samme språk som lagmerket i headeren. */
function LogoCircle({
  url,
  initials,
  fill,
  ink,
}: {
  url: string | null;
  initials: string;
  fill: string;
  ink: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = url != null && url !== failed;
  if (showImage) {
    return (
      <Image
        source={{uri: url}}
        style={styles.logoCircle}
        onError={() => setFailed(url)}
      />
    );
  }
  return (
    <View style={[styles.logoCircle, {backgroundColor: fill}]}>
      <Text style={[styles.logoInitials, {color: ink}]}>{initials}</Text>
    </View>
  );
}

/**
 * Laginnstillinger (P4) — kun trener/lagleder/admin (Profil-raden er gated).
 * Lagnavn + lagfarge + laglogo (fri override) + klubblogo (write-once).
 */
type Nav = NativeStackNavigationProp<ProfilStackParamList, 'TeamSettings'>;

export function TeamSettingsScreen() {
  const bottomPad = useBottomContentPadding();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeTeamSpace, activeTeam, refreshMemberships} =
    useActiveTeam();

  const [name, setName] = useState(activeTeamSpace?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingTeamLogo, setSavingTeamLogo] = useState(false);
  const [savingClubLogo, setSavingClubLogo] = useState(false);

  // Snarveien til Klubbetalinger (00047) — kun for betalingsansvarlige.
  const [isManager, setIsManager] = useState(false);
  useEffect(() => {
    let mounted = true;
    isPaymentManager().then(v => mounted && setIsManager(v));
    return () => {
      mounted = false;
    };
  }, []);

  const club = activeTeam?.club ?? null;

  const handleSaveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!activeTeamSpaceId || trimmed.length === 0) return;
    setSavingName(true);
    try {
      await updateTeamName(activeTeamSpaceId, trimmed);
      await refreshMemberships();
      setName(trimmed);
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke lagre navnet',
        e?.message ?? 'Prøv igjen om litt.',
      );
    } finally {
      setSavingName(false);
    }
  }, [activeTeamSpaceId, name, refreshMemberships]);

  // Trykk på swatch = lagre (samme mønster som lagfarge-sheeten hadde).
  const handleColorSelect = useCallback(
    async (color: string) => {
      if (!activeTeamSpaceId) return;
      try {
        await updateTeamColor(activeTeamSpaceId, color);
        await refreshMemberships();
      } catch (e: any) {
        Alert.alert(
          'Kunne ikke lagre fargen',
          e?.message ?? 'Prøv igjen om litt.',
        );
      }
    },
    [activeTeamSpaceId, refreshMemberships],
  );

  const handlePickTeamLogo = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    const image = await pickLogoImage();
    if (!image) return;
    setSavingTeamLogo(true);
    try {
      await updateTeamLogo(activeTeamSpaceId, image, activeTeamSpace?.logoUrl);
      await refreshMemberships();
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke lagre laglogoen',
        e?.message ?? 'Prøv igjen om litt.',
      );
    } finally {
      setSavingTeamLogo(false);
    }
  }, [activeTeamSpaceId, activeTeamSpace?.logoUrl, refreshMemberships]);

  const handleRemoveTeamLogo = useCallback(() => {
    if (!activeTeamSpaceId) return;
    Alert.alert(
      'Fjerne laglogoen?',
      club?.logoUrl
        ? 'Lagmerket viser klubblogoen i stedet.'
        : 'Lagmerket viser initialene på lagfargen i stedet.',
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Fjern',
          style: 'destructive',
          onPress: async () => {
            setSavingTeamLogo(true);
            try {
              await updateTeamLogo(
                activeTeamSpaceId,
                null,
                activeTeamSpace?.logoUrl,
              );
              await refreshMemberships();
            } catch (e: any) {
              Alert.alert(
                'Kunne ikke fjerne laglogoen',
                e?.message ?? 'Prøv igjen om litt.',
              );
            } finally {
              setSavingTeamLogo(false);
            }
          },
        },
      ],
    );
  }, [
    activeTeamSpaceId,
    activeTeamSpace?.logoUrl,
    club?.logoUrl,
    refreshMemberships,
  ]);

  const handleAddClubLogo = useCallback(async () => {
    if (!club) return;
    const image = await pickLogoImage();
    if (!image) return;
    setSavingClubLogo(true);
    try {
      await setClubLogo(club.id, image);
      await refreshMemberships();
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke lagre klubblogoen',
        e?.message ?? 'Prøv igjen om litt.',
      );
    } finally {
      setSavingClubLogo(false);
    }
  }, [club, refreshMemberships]);

  if (!activeTeamSpace) return null;

  const teamColor = activeTeamSpace.color || colors.textSecondary;
  const trimmedName = name.trim();
  const nameChanged =
    trimmedName.length > 0 && trimmedName !== activeTeamSpace.displayName;

  return (
    <ProfilPage title="Laginnstillinger" keyboard>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, {paddingBottom: bottomPad}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Lagnavn */}
        <LiquidGlassSurface variant="sheet" style={styles.card}>
          <Text style={styles.label}>Lagnavn</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder={activeTeamSpace.displayName}
            placeholderTextColor={OPAL.inkTertiary}
          />
          {nameChanged && (
            <Button
              title="Lagre navnet"
              onPress={handleSaveName}
              loading={savingName}
              style={styles.cardButton}
            />
          )}
        </LiquidGlassSurface>

        {/* Lagfarge */}
        <LiquidGlassSurface variant="sheet" style={styles.card}>
          <Text style={styles.label}>Lagfarge</Text>
          <Text style={styles.hint}>
            Vises på lagmerket, i kampen og på laglisten.
          </Text>
          <TeamColorPicker
            value={activeTeamSpace.color}
            onChange={handleColorSelect}
          />
        </LiquidGlassSurface>

        {/* Laglogo (override) */}
        <LiquidGlassSurface variant="sheet" style={styles.card}>
          <Text style={styles.label}>Laglogo</Text>
          <View style={styles.logoRow}>
            <View style={[styles.logoRing, {borderColor: teamColor}]}>
              <LogoCircle
                url={activeTeamSpace.logoUrl ?? club?.logoUrl ?? null}
                initials={initialsOf(activeTeamSpace.displayName)}
                fill={teamColor}
                ink={inkOnTeamColor(teamColor)}
              />
            </View>
            <Text style={styles.hintFlex}>
              {activeTeamSpace.logoUrl
                ? 'Laget har egen logo — den vinner over klubblogoen.'
                : club?.logoUrl
                ? 'Lagmerket viser klubblogoen. Egen laglogo overstyrer den — bare for dette laget.'
                : 'Lagmerket viser initialene. Egen laglogo gjelder bare dette laget.'}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <Button
              title={activeTeamSpace.logoUrl ? 'Bytt laglogo' : 'Velg laglogo'}
              variant="secondary"
              onPress={handlePickTeamLogo}
              loading={savingTeamLogo}
              style={styles.flexButton}
            />
            {activeTeamSpace.logoUrl != null && (
              <Button
                title="Fjern"
                variant="ghost"
                onPress={handleRemoveTeamLogo}
                disabled={savingTeamLogo}
              />
            )}
          </View>
        </LiquidGlassSurface>

        {/* Klubblogo */}
        {club && (
          <LiquidGlassSurface variant="sheet" style={styles.card}>
            <Text style={styles.label}>Klubblogo</Text>
            <View style={styles.logoRow}>
              <View style={[styles.logoRing, {borderColor: colors.border}]}>
                <LogoCircle
                  url={club.logoUrl}
                  initials={initialsOf(club.name)}
                  fill={colors.background}
                  ink={colors.textSecondary}
                />
              </View>
              <Text style={styles.hintFlex}>
                {club.logoUrl
                  ? `Logoen til ${club.name} deles av alle lag i klubben og kan ikke endres i appen.`
                  : `${club.name} mangler logo. Den vises i klubbsøket og på lagmerket til alle lag i klubben — og kan bare settes én gang.`}
              </Text>
            </View>
            {club.logoUrl == null && (
              <Button
                title="Legg til klubblogo"
                variant="secondary"
                onPress={handleAddClubLogo}
                loading={savingClubLogo}
                style={styles.cardButton}
              />
            )}
          </LiquidGlassSurface>
        )}

        {/* Støtte fra supportere (betalingsspor fase 3) */}
        {club && (
          <Pressable onPress={() => navigation.navigate('SupportSetup')}>
            <LiquidGlassSurface variant="sheet" style={styles.card}>
              <Text style={styles.label}>Støtte fra supportere</Text>
              <View style={styles.supportRow}>
                <HandHeart size={22} color={colors.heiaDeep} strokeWidth={2} />
                <Text style={styles.hintFlex}>
                  Aktiver «Støtt laget» — faste månedlige bidrag fra foreldre og
                  supportere, utbetalt til klubben.
                </Text>
                <ChevronRight size={20} color={OPAL.inkTertiary} />
              </View>
            </LiquidGlassSurface>
          </Pressable>
        )}

        {/* Kontekstuell snarvei til «Klubbetalinger» (klubbdøren, 00047)
            — SAMME flate som på Profil, kun for betalingsansvarlige. */}
        {club && isManager && (
          <Pressable onPress={() => navigation.navigate('ClubPayments')}>
            <LiquidGlassSurface variant="sheet" style={styles.card}>
              <Text style={styles.label}>Klubbetalinger</Text>
              <View style={styles.supportRow}>
                <Wallet size={22} color={colors.heiaDeep} strokeWidth={2} />
                <Text style={styles.hintFlex}>
                  Du er betalingsansvarlig — godkjenn og administrer lagenes
                  støtte.
                </Text>
                <ChevronRight size={20} color={OPAL.inkTertiary} />
              </View>
            </LiquidGlassSurface>
          </Pressable>
        )}
      </ScrollView>
    </ProfilPage>
  );
}

// Undersiden (ProfilPage): alt innhold står i paneler → OPAL-blekk og
// GLASS_FIELD som feltflate.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: OPAL.inkSecondary,
  },
  input: {
    ...typography.input,
    backgroundColor: GLASS_FIELD.fill,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: GLASS_FIELD.edge,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.bodySmall,
    color: OPAL.inkSecondary,
  },
  hintFlex: {
    ...typography.bodySmall,
    color: OPAL.inkSecondary,
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Samme ring-språk som TeamHeader, i visningsstørrelse for innstillinger.
  logoRing: {
    borderWidth: 2,
    borderRadius: radius.full,
    padding: 2,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  cardButton: {
    alignSelf: 'flex-start',
  },
});
