// @ts-check
import {defineConfig} from 'astro/config';
import react from '@astrojs/react';

// Statisk output. Markedssidene er ren HTML; de innloggede flatene
// (/konto, /invitasjon, /klubb, /ops) er React-øyer som snakker direkte med
// Supabase fra nettleseren — autorisasjonen bor i Postgres (RLS + RPC).
// Miljøvalget gjøres i `web/src/lib/env.ts` og har ingen reserveverdi. Her
// er bare ett ekstra varsel: Vercel forteller under byggingen om dette er
// produksjon eller en forhåndsvisning, og en forhåndsvisning bygget mot
// produksjonsdata skal stå svart på hvitt i byggeloggen (punkt 108).
if (
  process.env.VERCEL_ENV &&
  process.env.VERCEL_ENV !== 'production' &&
  process.env.PUBLIC_HEIA_ENV === 'production'
) {
  console.warn(
    `\n  ⚠️  Vercel «${process.env.VERCEL_ENV}» bygges mot PRODUKSJONSDATA.\n` +
      '     Alt som gjøres på denne forhåndsvisningen treffer ekte lag.\n' +
      '     Sett PUBLIC_HEIA_ENV=test for Preview når et testprosjekt finnes.\n',
  );
}

export default defineConfig({
  site: 'https://heiaapp.no',
  output: 'static',
  trailingSlash: 'ignore',
  build: {format: 'directory'},
  integrations: [react()],
});
