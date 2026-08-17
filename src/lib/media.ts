import {Alert, Linking} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import type {ImagePostInput} from './api/feed';

/** Valgt bilde + `uri` til lokal forhåndsvisning før det er lastet opp. */
export type PickedImage = ImagePostInput & {uri: string};

// 2048 px lang side / JPEG q0.85 er visningsMASTEREN (P2, LÅST beslutning):
// Heia lagrer en høyoppløselig visningsmaster, ikke kameraoriginalen —
// opplasterens kamerarull ER originalarkivet. ~0,3-0,6 MB i stedet for
// 2-6 MB per foto var den største enkeltfaktoren i egress-auditen (F1).
// B supplerer med en 480-thumb fra denne fila; selve masteren står.
const PICKER_OPTIONS = {
  mediaType: 'photo',
  includeBase64: true,
  selectionLimit: 1,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
} as const;

// Logoer rendres 32–40 pt — 512 px er rikelig, og headeren skal ikke laste
// et 12 MP-foto (P4-regelen: resize i pickeren).
const LOGO_PICKER_OPTIONS = {
  ...PICKER_OPTIONS,
  maxWidth: 512,
  maxHeight: 512,
} as const;

function toPickedImage(asset: Asset | undefined): PickedImage | null {
  if (!asset?.base64 || !asset.uri) return null;
  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.type ?? 'image/jpeg',
    fileName: asset.fileName ?? 'bilde.jpg',
    // base64-lengden er en overestimering (~4/3), men brukes bare som
    // metadata på media-raden — aldri til å avvise et bilde.
    sizeBytes: asset.fileSize ?? asset.base64.length,
    width: asset.width,
    height: asset.height,
  };
}

async function runPicker(
  launch: () => Promise<ImagePickerResponse>,
): Promise<PickedImage | null> {
  let result: ImagePickerResponse;
  try {
    result = await launch();
  } catch {
    Alert.alert('Kunne ikke åpne bildevelgeren', 'Prøv igjen.');
    return null;
  }

  if (result.didCancel) return null;

  // Simulatoren har ingen kameramaskinvare og svarer alltid 'camera_unavailable'.
  // Det er ikke et tillatelsesproblem, så å sende brukeren til Innstillinger
  // ville sendt dem på en meningsløs tur.
  if (result.errorCode === 'camera_unavailable') {
    Alert.alert(
      'Kameraet er ikke tilgjengelig',
      'Velg et bilde fra kamerarullen i stedet.',
    );
    return null;
  }

  // Har brukeren sagt nei tidligere, spør iOS aldri igjen — eneste vei videre
  // er Innstillinger. Samme mønster som varslingsraden i ProfilScreen.
  if (result.errorCode === 'permission') {
    Alert.alert(
      'Heia mangler tilgang',
      'Gi Heia tilgang til kamera og bilder for å dele bilder med laget.',
      [
        {text: 'Ikke nå', style: 'cancel'},
        {text: 'Åpne Innstillinger', onPress: () => Linking.openSettings()},
      ],
    );
    return null;
  }

  if (result.errorCode) {
    Alert.alert('Kunne ikke hente bildet', 'Prøv igjen.');
    return null;
  }

  const picked = toPickedImage(result.assets?.[0]);
  if (!picked) {
    Alert.alert('Kunne ikke hente bildet', 'Prøv et annet bilde.');
    return null;
  }
  return picked;
}

/**
 * Velger en logo fra kamerarullen — rett til biblioteket, uten
 * kamera-spørsmål (en logo ligger lagret, den tas ikke der og da).
 * `null` betyr avbrutt/feilet; feilmeldingen er allerede vist.
 */
export function pickLogoImage(): Promise<PickedImage | null> {
  return runPicker(() => launchImageLibrary(LOGO_PICKER_OPTIONS));
}

/**
 * Spør «ta bilde eller velg fra kamerarullen?» og returnerer bildet klart for
 * opplasting. `null` betyr avbrutt eller feilet — den viser i så fall selv
 * meldingen til brukeren, så kallstedet trenger bare å sjekke for null.
 *
 * `preferCamera` snur rekkefølgen: på sidelinja av en kamp er bildet tatt for
 * to sekunder siden eller så finnes det ikke, mens hjemme i sofaen ligger det
 * som skal deles allerede i kamerarullen.
 *
 * MERK: kamera krever `NSCameraUsageDescription` i Info.plist. Uten den
 * avslutter iOS appen i det kameraet åpnes — den spør ikke, og avslår ikke.
 */
export async function pickTeamImage(
  options: {preferCamera?: boolean} = {},
): Promise<PickedImage | null> {
  const camera = {
    text: 'Ta bilde',
    onPress: () => runPicker(() => launchCamera(PICKER_OPTIONS)),
  };
  const library = {
    text: 'Velg fra kamerarullen',
    onPress: () => runPicker(() => launchImageLibrary(PICKER_OPTIONS)),
  };
  const ordered = options.preferCamera ? [camera, library] : [library, camera];

  // Alert.alert gir ingen returverdi, så valget pakkes i et løfte som
  // resolves fra knappen — inkludert avbryt, som gir null.
  return new Promise<PickedImage | null>(resolve => {
    Alert.alert(
      'Legg ved bilde',
      undefined,
      [
        ...ordered.map(o => ({
          text: o.text,
          onPress: () => o.onPress().then(resolve),
        })),
        {text: 'Avbryt', style: 'cancel' as const, onPress: () => resolve(null)},
      ],
      // Sveiper brukeren vekk arket uten å velge, må løftet fortsatt løses.
      {cancelable: true, onDismiss: () => resolve(null)},
    );
  });
}
