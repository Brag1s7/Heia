import React, {useCallback} from 'react';
import {View, Text, Pressable, Share, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';

interface InviteCodeCardProps {
  /** Lagets visningsnavn — brukes i delingsteksten. */
  teamName: string;
  /** 8-tegns invitasjonskode fra team_space. */
  inviteCode: string;
}

/**
 * Viser invitasjonskoden stort, med «Del» via det native delingsarket
 * (som også har «Kopier» innebygd). Bruker kun react-native core — ingen
 * native tredjeparts-moduler — så den kan ikke krasje på manglende binær.
 */
export function InviteCodeCard({teamName, inviteCode}: InviteCodeCardProps) {
  // Koden står ALENE på sin egen linje. Et delingsark sender ren tekst —
  // ingen farger, ingen lenker, ingen formatering — så det eneste vi styrer
  // er hvor lett koden er å treffe. Ligger den midt i en setning, må
  // mottakeren dra markører rundt åtte tegn; står den alene, tar ett langt
  // trykk hele linja. (Det som FAKTISK gjør koden blå og trykkbar er en
  // https-lenke, og den krever heiaapp.no — se nettside-prosjektet.)
  const shareMessage =
    `Bli med i ${teamName} på Heia 💚\n\n` +
    'Invitasjonskoden din:\n' +
    `${inviteCode}\n\n` +
    'Last ned Heia og skriv inn koden når du oppretter kontoen.';

  const handleShare = useCallback(() => {
    Share.share({message: shareMessage}).catch(() => {
      // Brukeren avbrøt delingen — ingen handling.
    });
  }, [shareMessage]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Invitasjonskode</Text>

      <View style={styles.codeWrap}>
        {/* Åtte tegn med 6 px sperring er bredere enn en smal skjerm, og
            brøt til to linjer med ett tegn nederst. Koden skal ALLTID stå
            som én blokk — heller litt mindre skrift enn en avkuttet kode. */}
        <Text
          style={styles.code}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          selectable>
          {inviteCode}
        </Text>
      </View>

      <Text style={styles.hint}>
        Hold inne koden for å kopiere, eller trykk «Del». Foreldre og spillere
        skriver den inn når de laster ned Heia.
      </Text>

      <Pressable
        onPress={handleShare}
        style={({pressed}) => [
          styles.shareButton,
          pressed && styles.shareButtonPressed,
        ]}>
        <Text style={styles.shareButtonText}>Del invitasjon</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  label: {
    ...typography.label,
  },
  codeWrap: {
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.heia,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  code: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  shareButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    ...shadows.glow,
  },
  shareButtonPressed: {
    backgroundColor: colors.heiaPressed,
  },
  // A v2-knapperegel: mintfyll bærer heiaDeep-tekst.
  shareButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
});
