import React, {type ReactNode} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing} from '../theme';
import {OPAL} from './OpalSurface';

/** Ikonslottet radene på opal forventer (Profil `MenuIcon`): 32 pt kvadrat.
 *  Skillelinja starter etter padding + slott + luft, der teksten starter. */
export const OPAL_ROW_ICON_SLOT = 32;

interface ListRowProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  showBorder?: boolean;
  /**
   * `opal` (Brage 2026-09-04): raden ligger på `OpalSurface` (Profil-
   * gruppene). Skillelinja er en innfelt blekk-hårlinje som starter der
   * teksten starter og slutter før kanten, underteksten står i OPAL-blekk
   * (kontrastporten over grunnen), og trykk er en blekk-tint — aldri en lys
   * flate oppå materialet. Utelatt = som før: de hvite listene andre steder
   * (Lagoversikt, Sesongen, hendelsen) er urørt.
   */
  material?: 'opal';
  /**
   * `action`: raden er en INNGANG/handling («Bli med i et lag», «Opprett et
   * nytt lag»), ikke en innstilling — tittelen står i handlingsblekk, som
   * knappetekst. HIG: rader som gjør noe bærer tint-fargen.
   */
  tone?: 'action';
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  showBorder = true,
  material,
  tone,
}: ListRowProps) {
  const opal = material === 'opal';
  const content = (
    <View
      style={[
        styles.container,
        opal && styles.containerOpal,
        !opal && showBorder && styles.border,
      ]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <View style={styles.textWrap}>
        <Text
          style={[styles.title, tone === 'action' && styles.titleAction]}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, opal && styles.subtitleOpal]}
            numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.rightWrap}>{right}</View>}
      {opal && showBorder && (
        <View
          testID="row-separator"
          pointerEvents="none"
          style={[
            styles.separatorOpal,
            {
              left: icon
                ? spacing.lg + OPAL_ROW_ICON_SLOT + spacing.md
                : spacing.lg,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({pressed}) =>
          pressed && (opal ? styles.pressedOpal : styles.pressed)
        }>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  // På opal: litt mer luft per rad (52) og plass til den innfelte linja.
  containerOpal: {
    minHeight: 52,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  separatorOpal: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OPAL.hairline,
  },
  iconWrap: {
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  // Opalens aksentblekk, ikke heiaInk: heiaInk måler 4,05 på hvitt og
  // lavere på materialet — inkAccent holder porten (feedOpal-testen).
  titleAction: {
    color: OPAL.inkAccent,
  },
  subtitle: {
    ...typography.bodySmall,
  },
  subtitleOpal: {
    color: OPAL.inkSecondary,
  },
  rightWrap: {
    marginLeft: spacing.md,
  },
  pressed: {
    backgroundColor: colors.heiaSoft,
  },
  pressedOpal: {
    backgroundColor: OPAL.rowPressed,
  },
});
