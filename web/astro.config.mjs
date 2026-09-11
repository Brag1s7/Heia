// @ts-check
import {defineConfig} from 'astro/config';

// Statisk output. Markedssidene er ren HTML; interaktive flater (konto,
// invitasjon, klubb, ops) kommer som øyer i senere runder.
export default defineConfig({
  site: 'https://heiaapp.no',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
