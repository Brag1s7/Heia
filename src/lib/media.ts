import {Alert, Linking} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {Image as ImageCompressor} from 'react-native-compressor';
import type {ImagePostInput} from './api/feed';

/** Valgt bilde + `uri` til lokal forhåndsvisning før det er lastet opp. */
export type PickedImage = ImagePostInput & {uri: string};

// 2048 px lang side / JPEG q0.85 er visningsMASTEREN (P2, LÅST beslutning):
// Heia lagrer en høyoppløselig visningsmaster, ikke kameraoriginalen —
// opplasterens kamerarull ER originalarkivet. ~0,3-0,6 MB i stedet for
// 2-6 MB per foto var den største enkeltfaktoren i egress-auditen (F1).
// B1 avleder i tillegg en 480-thumb fra denne fila (makeThumb under).
// includeBase64 er AV siden B1: opplastingen streamer fil-URI-en direkte
// (expo-file-system uploadAsync) — base64-brua er borte.
const PICKER_OPTIONS = {
  mediaType: 'photo',
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

// Profilbilder rendres 32/40/56 pt — 56 × 3 = 168 px er det største som
// noen gang tegnes, så 256 px er master OG eneste variant (~25 kB). Det er
// bevisst mindre enn logoens 512: avataren er appens MEST gjentatte bilde
// (én per feed-rad, én per kommentar, én per varsel), og alt over det
// rendrede er ren egress uten et eneste synlig piksel i retur.
// Ingen thumb avledes — se avatarRef() i lib/media/avatar.ts.
const AVATAR_PICKER_OPTIONS = {
  ...PICKER_OPTIONS,
  maxWidth: 256,
  maxHeight: 256,
} as const;

/**
 * De tre variantene over, felles nevner. Bevisst avledet fra PICKER_OPTIONS
 * i stedet for bibliotekets `CameraOptions & ImageLibraryOptions`: da er
 * `quality` fortsatt den samme literal-typen som kallstedene alltid har
 * sendt, og delingen kan ikke endre hva typesjekkeren mener om dem.
 */
type PickerOptions = Omit<typeof PICKER_OPTIONS, 'maxWidth' | 'maxHeight'> & {
  readonly maxWidth: number;
  readonly maxHeight: number;
};

/**
 * 480 px / JPEG q0.7 (P2, LÅST — samme parametre som backfill-scriptet i A).
 * Avledes fra pickerens 2048-master, IKKE fra kameraoriginalen: pickeren kan
 * ikke levere to størrelser fra ett kall (verifisert i arkitekturrunden).
 * `null` = generering feilet — innlegget går videre uten thumb, og visningen
 * faller tilbake til masteren (mediaPathFor). Dårligere egress for det ene
 * bildet, aldri et blokkert innlegg.
 */
async function makeThumb(displayUri: string): Promise<string | null> {
  try {
    return await ImageCompressor.compress(displayUri, {
      compressionMethod: 'manual',
      maxWidth: 480,
      maxHeight: 480,
      quality: 0.7,
      input: 'uri',
      output: 'jpg',
      returnableOutputType: 'uri',
    });
  } catch {
    return null;
  }
}

// Pickeren rapporterer 'image/jpg' på iOS — en UGYLDIG MIME-type (riktig er
// 'image/jpeg'), og bucket-grensene fra A avviser den med 415
// InvalidMimeType. Før grensene ble satt slapp den gjennom, så feilen var
// usynlig frem til B1-telefontesten.
function normalizeMime(type: string | undefined): string {
  const t = type?.toLowerCase();
  return !t || t === 'image/jpg' ? 'image/jpeg' : t;
}

function toPickedImage(asset: Asset | undefined): PickedImage | null {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    fileUri: asset.uri,
    // Fylles av runPicker for lagbilder; logoer trenger ingen (512-master).
    thumbUri: null,
    mimeType: normalizeMime(asset.type),
    fileName: asset.fileName ?? 'bilde.jpg',
    // Kun metadata på media-raden — aldri brukt til å avvise et bilde.
    sizeBytes: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  };
}

async function runPicker(
  launch: () => Promise<ImagePickerResponse>,
  options: {thumb: boolean},
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
  if (options.thumb) {
    picked.thumbUri = await makeThumb(picked.fileUri);
  }
  return picked;
}

/**
 * Velger en logo fra kamerarullen — rett til biblioteket, uten
 * kamera-spørsmål (en logo ligger lagret, den tas ikke der og da).
 * `null` betyr avbrutt/feilet; feilmeldingen er allerede vist.
 */
export function pickLogoImage(): Promise<PickedImage | null> {
  return runPicker(() => launchImageLibrary(LOGO_PICKER_OPTIONS), {
    thumb: false,
  });
}

/**
 * Velger et profilbilde. Samme «ta bilde eller velg fra kamerarullen?»-ark
 * som lagbilder, men kamerarullen står FØRST: et profilbilde er nesten
 * alltid et bilde som allerede finnes, ikke et som tas der og da.
 * `null` betyr avbrutt/feilet; meldingen er allerede vist.
 */
export function pickAvatarImage(): Promise<PickedImage | null> {
  return pickWithSource('Profilbilde', AVATAR_PICKER_OPTIONS, false);
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
export function pickTeamImage(
  options: {preferCamera?: boolean} = {},
): Promise<PickedImage | null> {
  return pickWithSource(
    'Legg ved bilde',
    PICKER_OPTIONS,
    true,
    options.preferCamera,
  );
}

/**
 * Kilde-arket, delt av lagbilder og profilbilder. `thumb` styrer om den
 * 480 px lette varianten avledes (kun lagbilder — et profilbilde ER
 * allerede lite).
 */
function pickWithSource(
  title: string,
  pickerOptions: PickerOptions,
  thumb: boolean,
  preferCamera = false,
): Promise<PickedImage | null> {
  const camera = {
    text: 'Ta bilde',
    onPress: () => runPicker(() => launchCamera(pickerOptions), {thumb}),
  };
  const library = {
    text: 'Velg fra kamerarullen',
    onPress: () => runPicker(() => launchImageLibrary(pickerOptions), {thumb}),
  };
  const ordered = preferCamera ? [camera, library] : [library, camera];

  // Alert.alert gir ingen returverdi, så valget pakkes i et løfte som
  // resolves fra knappen — inkludert avbryt, som gir null.
  return new Promise<PickedImage | null>(resolve => {
    Alert.alert(
      title,
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
