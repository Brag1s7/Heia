import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Image, StyleSheet, Text, View} from 'react-native';
import {colors, typography, spacing} from '../theme';
import {StadiumSurface} from './StadiumSurface';

// ---------------------------------------------------------------------------
// BootScreen — flaten mellom native launch screen og første app-skjerm.
//
// Den erstatter en rå ActivityIndicator på kremflate. Poenget er ikke å pynte
// på en spinner, men å fjerne et BRUDD: LaunchScreen.storyboard tegner
// stadionflaten med merket sentrert, og WelcomeIntentScreen tegner den samme
// stadionflaten med lockupen. Kremflaten lå imellom og blinket lyst midt i en
// mørk sekvens — det første en pilotforelder ser av appen.
//
// Nå er hele oppstarten én sammenhengende mørk flate: ikon → launch screen →
// BootScreen → WelcomeIntent. For en innlogget bruker fungerer den som en
// vanlig splash frem til fanene er klare.
//
// Ingen spinner med vilje: pusten på lockupen forteller at noe skjer, og
// «default spinner» er eksplisitt anti-mønster i BRAND_UI.
// ---------------------------------------------------------------------------

interface BootScreenProps {
  /** Vises under lockupen når ventingen har en kjent grunn («Setter opp laget…»). */
  message?: string;
}

export function BootScreen({message}: BootScreenProps) {
  // Egen Animated.Value (ikke Skeletons delte puls): BootScreen lever aldri
  // samtidig med bones, og pusten her er roligere enn skjelettpulsen.
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 0.6,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  return (
    <StadiumSurface style={styles.screen} bordered={false}>
      <View
        style={styles.content}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={message ?? 'Laster Heia'}>
        <Animated.View style={{opacity: breath}}>
          <Image
            source={require('../assets/images/logo-wordmark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </StadiumSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    borderRadius: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  // Samme mål som WelcomeIntentScreen, så lockupen står HELT stille i
  // overgangen mellom de to skjermene — bare pusten stopper.
  logo: {
    width: 260,
    height: 134,
  },
  message: {
    ...typography.body,
    color: colors.stadiumDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
