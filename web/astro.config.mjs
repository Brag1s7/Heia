// @ts-check
import {defineConfig} from 'astro/config';
import react from '@astrojs/react';

// Statisk output. Markedssidene er ren HTML; de innloggede flatene
// (/konto, /invitasjon, /klubb, /ops) er React-øyer som snakker direkte med
// Supabase fra nettleseren — autorisasjonen bor i Postgres (RLS + RPC).
export default defineConfig({
  site: 'https://heiaapp.no',
  output: 'static',
  trailingSlash: 'ignore',
  build: {format: 'directory'},
  integrations: [react()],
});
