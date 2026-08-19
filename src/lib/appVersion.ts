import { useEffect, useState } from 'react';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import { formatAppVersion, type NativeRelease } from '../shared/appVersion';

/**
 * ADAPTER MOT EKSISTERENDE NATIVE KODE — ingen ny native-avhengighet.
 *
 * `RNSentry.fetchNativeRelease()` er en metode Sentry-podden ALLEREDE har
 * kompilert inn (RNSentry.mm): den slår opp `CFBundleShortVersionString` og
 * `CFBundleVersion` rett i `[NSBundle mainBundle]` og returnerer dem. Den
 * rører ingen Sentry-tilstand, krever ingen `Sentry.init` og bryr seg ikke om
 * SENTRY_DSN — så den svarer også når feilrapporteringen er helt av
 * (`src/lib/sentry.ts` starter ikke SDK-en uten DSN).
 *
 * Hvorfor ikke `expo-constants`, som også er kompilert inn (EXConstants)?
 * Fordi den i v55 kun eksponerer `platform.ios.buildNumber` — ikke
 * markedsføringsversjonen — og pakken ligger nøstet under
 * `expo/node_modules/`, så den ville krevd en ny toppnivå-avhengighet for
 * halve svaret.
 *
 * Modulen hentes med Sentrys eget mønster (`getRNSentryModule`), fordi
 * bridgeless/ny arkitektur ikke fyller `NativeModules` på samme måte som før.
 *
 * ⚠️ HELE poenget er at dette er ISOLERT. Skulle Sentry en dag fjerne
 * metoden, er det denne ene filen som svarer `null` — og «Om Heia» mister
 * undertekst, ingenting annet. Skal appen noen gang trenge versjonen til noe
 * mer enn en visningsrad, bygg en ordentlig native-konstant i stedet.
 */
interface RNSentryModule {
  fetchNativeRelease?: () => Promise<NativeRelease>;
}

function getRNSentry(): RNSentryModule | undefined {
  try {
    return (
      (TurboModuleRegistry.get('RNSentry') as RNSentryModule | null) ??
      (NativeModules.RNSentry as RNSentryModule | undefined)
    );
  } catch {
    return undefined;
  }
}

/**
 * Leser versjonen fra bundelen. Feiler ALLTID til `null` — aldri til et tall.
 */
export async function fetchAppVersion(): Promise<string | null> {
  try {
    const fetchNativeRelease = getRNSentry()?.fetchNativeRelease;
    if (!fetchNativeRelease) return null;
    return formatAppVersion(await fetchNativeRelease());
  } catch {
    return null;
  }
}

/**
 * «Om Heia»-undertekstens hook. `null` frem til svaret er der — og for godt
 * hvis modulen mangler (Android før sin podrunde, jest). ListRow dropper da
 * underteksten helt, som er riktig: ingen rad er bedre enn feil rad.
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchAppVersion().then(v => mounted && setVersion(v));
    return () => {
      mounted = false;
    };
  }, []);
  return version;
}
