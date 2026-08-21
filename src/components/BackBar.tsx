import React from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {colors, matchColors, typography, spacing} from '../theme';
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
/**
 * ⚠️ VARIANT, IKKE ENDRET DEFAULT. Linja deles med 17 skjermer og hardkoder
 * `colors.textPrimary`. Kampen bor på mørk grunn og trenger krittfarget blekk
 * — men det er kampens unntak, ikke appens nye normal.
 *
 * ⚠️ `labelOpacity`/`labelsHidden` ER KAMPENS ANDRE UNNTAK, og de er REN
 * TILLEGGSFUNKSJON: utelates de, oppfører linja seg nøyaktig som før på de 17
 * andre skjermene. Kampen bruker dem fordi toppflaten BLIR stillingen når man
 * blar (`MatchTopBar`): tittelen og ordet «Tilbake» toner ut, mens
 * **chevronen aldri rører seg**. Den er den samme knappen før og etter, så
 * det finnes aldri et øyeblikk uten tilbakevei — og aldri to tilbakeknapper.
 *
 * ⚠️ TEKSTENE ER `Animated.Text` UANSETT. Det er samme host-komponent som
 * `Text` og gir ingen forskjell uten en verdi å animere; å bytte JSX-form
 * etter om en prop finnes ville gitt to kodeveier å teste i stedet for én.
 */
export function BackBar({
  title,
  variant = 'default',
  labelOpacity,
  labelsHidden,
}: {
  title?: string;
  variant?: 'default' | 'match';
  /** 1 = «Tilbake · Kampen», 0 = borte. Chevronen påvirkes ALDRI. */
  labelOpacity?: Animated.AnimatedInterpolation<number> | number;
  /** Tonet bort ⇒ også borte for skjermleseren. Usynlig betyr helt borte. */
  labelsHidden?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const onMatch = variant === 'match';
  const ink = onMatch ? matchColors.text : colors.textPrimary;

  const faded = labelOpacity === undefined ? null : {opacity: labelOpacity};
  const hidden = labelsHidden === true;

  return (
    <View style={[styles.bar, {marginTop: insets.top}]}>
      {title ? (
        <Animated.Text
          style={[styles.title, onMatch && {color: ink}, faded]}
          numberOfLines={1}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
          {title}
        </Animated.Text>
      ) : null}
      <Pressable
        onPress={navigation.goBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Tilbake"
        style={({pressed}) => [styles.back, pressed && styles.backPressed]}>
        <ChevronLeft size={26} color={ink} strokeWidth={2.2} />
        <Animated.Text style={[styles.label, onMatch && {color: ink}, faded]}>
          Tilbake
        </Animated.Text>
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
