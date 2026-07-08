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
  const shareMessage = `Bli med i ${teamName} på Heia! Bruk invitasjonskoden ${inviteCode} når du laster ned appen.`;

  const handleShare = useCallback(() => {
    Share.share({message: shareMessage}).catch(() => {
      // Brukeren avbrøt delingen — ingen handling.
    });
  }, [shareMessage]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Invitasjonskode</Text>

      <View style={styles.codeWrap}>
        <Text style={styles.code} selectable>
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
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
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
    paddingHorizontal: spacing['2xl'],
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
    borderRadius: radius.xl,
    backgroundColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  shareButtonPressed: {
    backgroundColor: colors.heiaPressed,
  },
  shareButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
