import React, {type ReactNode} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {colors} from '../theme';
import {BackBar} from './BackBar';
import {
  DaylightGround,
  DAYLIGHT_GROUND_AB,
  DAYLIGHT_GROUND_FALLBACK,
} from './DaylightGround';

interface ProfilPageProps {
  /** Sentrert tittel i tilbakelinja. Utelatt = bare «‹ Tilbake». */
  title?: string;
  /** Skjemasider: KeyboardAvoidingView (padding) rundt hele siden. */
  keyboard?: boolean;
  children: ReactNode;
}

/**
 * MALEN FOR PROFILS UNDERSIDER (Brage 2026-09-04: «På profilsiden får vi en
 * fast template vi kan ha på alle sidene der, og vi må legge til bakgrunn på
 * undersidene»).
 *
 * Tre ting, alltid de samme:
 *   grunn     `DaylightGround` — SAMME grunn som kommentarsiden (Brage
 *             2026-09-02: «detaljsiden fra griden»): reisen fra mørk teal
 *             øverst til opal nederst, uten laghode og uten identitetsfelt —
 *             en underside har ikke et laghode, den har en tilbakelinje.
 *   linje     `BackBar` i stadionblekk: linja står i reisens mørke topp, så
 *             blekket er lyst, som Profil-fanens etiketter og Varsler-chromen.
 *             Statuslinja følger med (lys), med fokus-vakt som i headerne.
 *   innhold   sidens egen ScrollView; flatene i den er `LiquidGlassSurface
 *             variant="sheet"` — ARKETS tunge perle (0,80), ikke Profil-
 *             fanens tynne paneler: undersidene har skjema, felt og
 *             neonknapper, og på tynt glass over reisens grønne midtparti
 *             gikk kort, felt og knapper i ett (Brage 2026-09-04, runde 7).
 *             OPAL-blekk på sekundærtekst, `GLASS_FIELD` som feltflate.
 *
 * Skjermen eier selv ScrollView, bunnpadding (`useBottomContentPadding`) og
 * RefreshControl — malen legger seg ikke mellom. Tastatur: `keyboard` gir
 * KeyboardAvoidingView rundt hele siden, som skjemasidene hadde fra før.
 */
export function ProfilPage({
  title,
  keyboard = false,
  children,
}: ProfilPageProps) {
  const isFocused = useIsFocused();
  const body = (
    <>
      {DAYLIGHT_GROUND_AB && <DaylightGround />}
      {/* Fokus-vakt som i TeamHeader/ProfileHeader: uten den ville siden
          styrt statuslinja videre på skjermer som pushes oppå. */}
      {DAYLIGHT_GROUND_AB && isFocused && (
        <StatusBar barStyle="light-content" />
      )}
      <BackBar
        title={title}
        variant={DAYLIGHT_GROUND_AB ? 'stadium' : 'default'}
      />
      {children}
    </>
  );
  if (keyboard) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    );
  }
  return <View style={styles.screen}>{body}</View>;
}

const styles = StyleSheet.create({
  // Grunnen ligger absolutt over denne; fallbacken er grunnens dominante
  // mint (samme som navigatorens kort bak skjermen), så ingenting blinker
  // krem i kantene under push/pop.
  screen: {
    flex: 1,
    backgroundColor: DAYLIGHT_GROUND_AB
      ? DAYLIGHT_GROUND_FALLBACK
      : colors.background,
  },
});
