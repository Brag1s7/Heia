/* eslint-env jest */
/**
 * Testoppsett: de native modulene som må finnes for at `App.test.tsx` skal
 * kunne rendre komponenttreet i Node.
 *
 * (`eslint-env jest` over: @react-native-konfigurasjonen slår bare på
 * jest-globalene for filer den kjenner igjen som tester, og denne er et
 * oppsett — ikke en test.)
 *
 * ⚠️ Hver mock her er PRØVD FJERNET og satt tilbake fordi noe faktisk brakk.
 * Legg ikke til flere «for sikkerhets skyld» — fjern dem heller og se hva som
 * skjer. En mock som ikke trengs, skjuler bare hva appen egentlig krever.
 * (`@react-native-community/push-notification-ios` ble prøvd og fjernet igjen
 * på nettopp den regelen: testen består uten den.)
 */

/**
 * Ikonbiblioteket. Selve mocken bor i `__mocks__/lucide-react-native.js` —
 * les den for hvorfor pakken ikke bare transformeres som de andre.
 *
 * Jest ville plukket opp den manuelle mocken automatisk uten denne linja
 * (`__mocks__/` ved siden av `node_modules` gjelder for pakker). Kallet står
 * her likevel, så det er SYNLIG fra oppsettet at ikonene er byttet ut — en
 * mock som bare virker i kraft av hvor fila ligger, er en mock ingen finner.
 */
jest.mock('lucide-react-native');

/**
 * Uten denne: `TypeError: Cannot read properties of null (reading 'getConfig')`.
 *
 * `react-native-config` leser fra `NativeModules` ved IMPORT, ikke ved bruk —
 * så den feiler selv om ingen test rører konfigurasjonen. Verdiene må se ut
 * som en URL og en nøkkel, fordi Supabase-klienten validerer dem når den
 * opprettes.
 */
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

/**
 * Uten denne: testen HENGER (Supabase-klienten prøver å lese en lagret økt
 * gjennom en lagringsmodul som ikke finnes, og svaret kommer aldri).
 *
 * Vi bruker pakkens egen mock. `/jest` er en offisiell understi i
 * `exports`-kartet — ikke en intern filsti som kan flytte på seg.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

/**
 * Uten denne: testen «består» på 15 ms i stedet for 1,3 s — og beviser
 * ingenting.
 *
 * `SafeAreaProvider` rendrer `null` til den har fått innsettinger målt av
 * native. I Node kommer den målingen aldri, så HELE komponenttreet uteblir
 * uten at noe feiler. Det er den farligste varianten av en grønn test.
 * Mocken gir provideren faste innsettinger, slik at treet faktisk tegnes.
 */
/**
 * B1-mediapipelinen: tre native moduler. Alle tre feiler ved IMPORT i Node
 * (expo-image/expo-file-system via expo-modules-core `requireNativeModule`,
 * react-native-compressor via Nitro) — og importene ligger i moduler
 * App-treet drar inn (MediaImage, media.ts, account.ts).
 *
 * expo-image-mocken rendrer en host-'Image' med props-ene videre — vaktene
 * (eventDetailRefetch) beviser thumb/display ved å lese `source.uri` av
 * host-elementer, og den kontrakten skal bestå. De statiske funksjonene er
 * jest.fn så clearLocalCaches-stien kan asserters.
 */
jest.mock('expo-image', () => {
  const React = require('react');
  const Image = props => React.createElement('Image', props);
  Image.configureCache = jest.fn();
  Image.clearDiskCache = jest.fn(async () => true);
  Image.getCachePathAsync = jest.fn(async () => null);
  return {Image};
});

jest.mock('expo-file-system/legacy', () => ({
  uploadAsync: jest.fn(async () => ({status: 200, headers: {}, body: ''})),
  FileSystemUploadType: {BINARY_CONTENT: 0, MULTIPART: 1},
}));

jest.mock('react-native-compressor', () => ({
  // Identitet som standard: «thumben» er samme fil-URI. Tester som vil
  // skille variantene overstyrer med mockResolvedValue.
  Image: {compress: jest.fn(async uri => uri)},
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = {top: 0, right: 0, bottom: 0, left: 0};
  return {
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaProvider: ({children}) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({x: 0, y: 0, width: 390, height: 844}),
  };
});
