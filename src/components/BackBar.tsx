import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {colors, typography, spacing} from '../theme';
import {ChevronLeft} from './icons';

/**
 * Skjermtegnet tilbakelinje for alle push-skjermer.
 *
 * Native header kan ikke brukes: iOS 26 animerer UINavigationBar som en egen
 * plate i eget tempo under overganger («toppen henger løs»), og mot den mørke
 * velkomstskjermen blinket systemovergangen i tillegg hvitt i hjørnene.
 * Stackene kjører derfor `simple_push`, og en linje tegnet i skjermen glir
 * med resten av innholdet som én flate. Metrikken speiler den native linjen:
 * 44 pt høyde under statusfeltet, chevron + «Tilbake» i samme tint som før,
 * valgfri sentrert tittel der native-headeren hadde en.
 */
export function BackBar({title}: {title?: string}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.bar, {marginTop: insets.top}]}>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <Pressable
        onPress={navigation.goBack}
        hitSlop={12}
        style={({pressed}) => [styles.back, pressed && styles.backPressed]}>
        <ChevronLeft size={26} color={colors.textPrimary} strokeWidth={2.2} />
        <Text style={styles.label}>Tilbake</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    // Chevron-glyfen har luft i seg — trekk den inntil kanten så den optisk
    // står der den native tilbake-pilen står.
    marginLeft: -4,
  },
  backPressed: {
    opacity: 0.5,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: 2,
  },
  // Absolutt sentrert så tittelen står midt på skjermen uavhengig av
  // tilbake-knappens bredde — som i native-headeren. 90 i luft på hver side
  // holder den unna knappen.
  title: {
    ...typography.heading3,
    position: 'absolute',
    left: 90,
    right: 90,
    top: 0,
    // lineHeight = barhøyden sentrerer teksten vertikalt på begge plattformer.
    lineHeight: 44,
    textAlign: 'center',
  },
});
