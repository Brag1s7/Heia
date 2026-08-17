/**
 * Backfill av medievarianter — Fase A punkt 7 (OBLIGATORISK A-oppfølger).
 *
 * Genererer display 2048px/q0.85 + thumb 480px/q0.7 for alle eksisterende
 * media-rader i `feed-media`, laster dem opp med riktig cacheControl (24 t),
 * og peker media-raden på variantene (storage_path → display,
 * thumbnail_path → thumb; klienten leser thumb først i B).
 *
 * Hvorfor obligatorisk: med 24 t-TTL på signerte URL-er re-lastes feedens
 * bilder ~daglig — ufarlig for nye, lette bilder, men legacy-originalene er
 * 2–6 MB kameraoriginaler (H2 bekreftet: snitt 3588 px / 2,4 MB). Backfillen
 * gjør også GAMLE appversjoner ~10× billigere: de signerer storage_path
 * ferskt uansett, og får nå varianten.
 *
 * ⚠️ SAFEGUARD (godkjent av Brage 7. aug 2026): ORIGINALOBJEKTENE SLETTES
 * IKKE — de blir stående i bucketen uten DB-peker gjennom A/B. Manifestet
 * scriptet skriver (original → variant per rad) er sporet tilbake til dem;
 * permanent original-policy besluttes eksplisitt før launch, etter visuell
 * TestFlight-validering av 2048-masteren.
 *
 * Kjøres LOKALT av Brage — aldri fra appen, aldri i CI:
 *
 *   npm install --no-save sharp tsx
 *   SUPABASE_URL=https://<prosjektref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-nøkkel> \
 *     npx tsx scripts/backfill-media-variants.ts            # tørrkjøring
 *     npx tsx scripts/backfill-media-variants.ts --apply    # gjør endringene
 *
 * Idempotent: rader som alt peker på en -d2048-variant hoppes over, og
 * uploads bruker upsert — scriptet kan trygt kjøres på nytt etter en feil.
 */
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {writeFileSync} from 'node:fs';

const BUCKET = 'feed-media';
const DISPLAY_SUFFIX = '-d2048.jpg';
const THUMB_SUFFIX = '-t480.jpg';
// Samme cache-policy som klientens uploads (P1, låst): privat media = 24 t.
const CACHE_CONTROL = '86400';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    'Mangler SUPABASE_URL og/eller SUPABASE_SERVICE_ROLE_KEY i miljøet.',
  );
  process.exit(1);
}
const apply = process.argv.includes('--apply');

const supabase = createClient(url, serviceKey, {
  auth: {persistSession: false, autoRefreshToken: false},
});

interface MediaRow {
  id: string;
  storage_path: string;
  size_bytes: number | null;
}

interface ManifestEntry {
  mediaId: string;
  original: string;
  display: string;
  thumb: string;
}

async function makeVariant(
  input: Buffer,
  maxSide: number,
  quality: number,
): Promise<{buffer: Buffer; width: number; height: number; size: number}> {
  // .rotate() uten argument = auto-orienter etter EXIF — uten den ville
  // liggende iPhone-bilder blitt stående etter resize.
  const {data, info} = await sharp(input)
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({quality})
    .toBuffer({resolveWithObject: true});
  return {buffer: data, width: info.width, height: info.height, size: info.size};
}

async function uploadVariant(path: string, buffer: Buffer): Promise<void> {
  const {error} = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/jpeg',
    cacheControl: CACHE_CONTROL,
    upsert: true,
  });
  if (error) {
    throw new Error(`upload ${path}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Backfill mot ${url} — ${apply ? 'APPLY' : 'TØRRKJØRING (legg til --apply)'}`,
  );

  const {data, error} = await supabase
    .from('media')
    .select('id, storage_path, size_bytes')
    .eq('bucket', BUCKET)
    .is('deleted_at', null)
    .order('created_at', {ascending: true});
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaRow[];
  const manifest: ManifestEntry[] = [];
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const original = row.storage_path;
    if (original.endsWith(DISPLAY_SUFFIX)) {
      skipped += 1;
      continue;
    }

    const base = original.replace(/\.[^./]+$/, '');
    const displayPath = `${base}${DISPLAY_SUFFIX}`;
    const thumbPath = `${base}${THUMB_SUFFIX}`;
    const kb = row.size_bytes ? `${Math.round(row.size_bytes / 1024)} kB` : '?';

    if (!apply) {
      console.log(`ville konvertert ${original} (${kb}) → ${displayPath}`);
      done += 1;
      continue;
    }

    try {
      const {data: blob, error: dlError} = await supabase.storage
        .from(BUCKET)
        .download(original);
      if (dlError || !blob) {
        throw new Error(`download: ${dlError?.message ?? 'tomt svar'}`);
      }
      const input = Buffer.from(await blob.arrayBuffer());

      // Kvalitetsparametrene er LÅST i P2: 2048/q0.85 master, 480/q0.7 thumb.
      const display = await makeVariant(input, 2048, 85);
      const thumb = await makeVariant(input, 480, 70);

      await uploadVariant(displayPath, display.buffer);
      await uploadVariant(thumbPath, thumb.buffer);

      // Raden peker nå på varianten; metadata følger med så media-SQL-en
      // (H2) forblir sann. Originalobjektet på `original` RØRES IKKE.
      const {error: updateError} = await supabase
        .from('media')
        .update({
          storage_path: displayPath,
          thumbnail_path: thumbPath,
          mime_type: 'image/jpeg',
          size_bytes: display.size,
          width: display.width,
          height: display.height,
        })
        .eq('id', row.id);
      if (updateError) {
        throw new Error(`media-update: ${updateError.message}`);
      }

      manifest.push({mediaId: row.id, original, display: displayPath, thumb: thumbPath});
      console.log(
        `ok ${original} (${kb}) → ${displayPath} (${Math.round(
          display.size / 1024,
        )} kB) + thumb (${Math.round(thumb.size / 1024)} kB)`,
      );
      done += 1;
    } catch (e) {
      // HEIC uten libheif, korrupt fil, nettglipp — logg og gå videre;
      // raden beholder originalpekeren og kan tas i en ny kjøring.
      console.error(`FEIL ${original}: ${(e as Error).message}`);
      failed += 1;
    }
  }

  if (apply && manifest.length > 0) {
    // Manifestet ER sporet tilbake til originalene (DB-raden peker nå på
    // varianten) — ta vare på fila til pre-launch-beslutningen om dem.
    const file = `scripts/backfill-manifest-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, '')}.json`;
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    console.log(`Manifest skrevet til ${file}`);
  }

  console.log(
    `Ferdig: ${done} ${apply ? 'konvertert' : 'å konvertere'}, ` +
      `${skipped} alt gjort, ${failed} feilet.`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
