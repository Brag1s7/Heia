/**
 * Lokal mock for ikonbiblioteket.
 *
 * Hvorfor den finnes: `lucide-react-native` leverer `.mjs`, som React
 * Native-presetens `transform` ikke dekker (den tar bare `js|ts|tsx`).
 * Pakken er dessuten en barrel over ~1500 ikonfiler, så å la Babel
 * transformere hele treet gjør hver testkjøring flere ganger tregere.
 *
 * Vi peker BEVISST ikke på pakkens interne `dist/cjs`-sti: da ville testene
 * knekt neste gang biblioteket endrer mappestrukturen sin. En liten mock her
 * er uavhengig av hvordan pakken er bygget.
 *
 * Ikoner har ingen oppførsel å teste — de tegner en strek. Derfor rendrer
 * denne ingenting; poenget er bare at `import {Bell} from ...` gir en gyldig
 * komponent.
 *
 * Jest bruker mocks i `__mocks__/` ved siden av `node_modules` automatisk for
 * pakker, uten at noen må kalle `jest.mock`.
 */
function LucideIcon() {
  return null;
}

// Ikonnavnene er mange og endrer seg med biblioteket. En proxy svarer på alle
// uten at vi må vedlikeholde en liste — det ville vært en ny kopi av
// `src/components/icons.tsx` å holde i takt.
module.exports = new Proxy(
  {},
  {
    get(_target, name) {
      if (name === '__esModule') return true;
      if (typeof name === 'symbol') return undefined;
      return LucideIcon;
    },
  },
);
