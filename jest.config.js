/**
 * Jest-oppsett.
 *
 * ⚠️ `transformIgnorePatterns` MÅ overstyres. React Native-presetens
 * standardmønster transformerer bare `react-native` og `@react-native*` —
 * alt annet i `node_modules` hoppes over. Men stadig flere pakker leverer
 * kun ESM (`export {...}`), og Node kan ikke lese det uten Babel. Resultatet
 * er `SyntaxError: Unexpected token 'export'` i en fil man ikke har skrevet
 * selv, som stopper hele testfila.
 *
 * Det var nettopp det som gjorde `__tests__/App.test.tsx` rød:
 * `@react-navigation/native` peker på `lib/module`, som er ESM.
 *
 * Legg pakken til i lista under når en ny test faller på samme måte.
 * Skråstreken etter gruppa er viktig: uten den ville `react-native` også
 * matchet `react-native-svg` og gjort de egne oppføringene meningsløse.
 *
 * ⚠️ Lista er MINIMAL, ikke «alt vi bruker». Hver enkelt oppføring er prøvd
 * fjernet, og bare de som faktisk gjorde testene røde står igjen. Blant dem
 * som IKKE trengs: `react-native-svg`, `react-native-screens`,
 * `react-native-safe-area-context` og `react-native-config` — de leverer alt
 * CJS. Ikke legg til en pakke uten at en test faktisk feiler først; en
 * unødvendig oppføring koster bare transformeringstid.
 */
const esmPackages = [
  'react-native',
  '@react-native',
  '@react-navigation',
  '@react-native-async-storage',
  'react-native-url-polyfill',
  'react-native-image-picker',
].join('|');

// Presetens transform dekker bare `js|ts|tsx` — `.mjs` faller utenom og
// treffer Node urørt («Cannot use import statement outside a module»).
// Verifikasjonsscriptenes rene logikk ligger som .mjs i `scripts/` (kjøres
// direkte med node) og jest-testes; derfor utvides mønsteret her. Spread-en
// beholder presetens asset-transformer — et rent `transform`-objekt ville
// ERSTATTET hele presetens og knekt bildeimportene.
const rnPreset = require('react-native/jest-preset');

module.exports = {
  preset: 'react-native',
  transform: {
    ...rnPreset.transform,
    '^.+\\.mjs$': 'babel-jest',
  },
  transformIgnorePatterns: [`node_modules/(?!(?:jest-)?(?:${esmPackages})/)`],

  // Kjøres ETTER testmiljøet er satt opp, så `jest.mock` er tilgjengelig.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

// ⚠️ `lucide-react-native` er BEVISST ikke i lista over. Den mockes i stedet
// lokalt — se `__mocks__/lucide-react-native.js` for hvorfor.
