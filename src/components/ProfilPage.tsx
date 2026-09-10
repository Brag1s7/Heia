import React, {useEffect, useState, type ReactNode} from 'react';
import {
  InteractionManager,
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
  /**
   * ⚠️ GRUNNEN TEGNES ETTER OVERGANGEN (Brage 2026-09-10: «det hakker stygt
   * når man trykker inn på hendelser»).
   *
   * `DaylightGround` er ett stort svg-lerret med gradienter og lysfelt. Blir
   * det montert i samme ramme som skjermen pushes inn, konkurrerer
   * rasteriseringen med push-animasjonen, og overgangen hakker. Flaten under
   * står allerede i grunnens dominante mint (`styles.screen`), så det som
   * skjer er at gradienten toner på plass rett etter at skjermen har landet —
   * ikke at siden blinker hvit.
   */
  const [groundReady, setGroundReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setGroundReady(true),
    );
    return () => task.cancel();
  }, []);
  const body = (
    <>
      {DAYLIGHT_GROUND_AB && groundReady && <DaylightGround />}
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
