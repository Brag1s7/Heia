/**
 * Opplasting til Supabase Storage via expo-file-system `uploadAsync` (B1):
 * OS-et streamer fila rett fra disk. Base64-brua fra A (fil → JS-streng →
 * ArrayBuffer, ~2,7× minne for et 2048-bilde og blokkert JS-tråd under
 * dekodingen) er borte — `includeBase64` er skrudd av i pickeren.
 *
 * Går bevisst UTENOM supabase-js (og dermed netMetrics-fetchen, P9):
 * uploadAsync er native HTTP. netMetrics teller lese-egress per skjerm;
 * opplasting er ingress og var aldri i det regnestykket.
 */
import * as FileSystem from 'expo-file-system/legacy';
import Config from 'react-native-config';
import {supabase} from '../supabase';

export async function uploadFileToBucket(opts: {
  bucket: string;
  /** Objektsti i bucketen — første segment er det policyene gates på. */
  path: string;
  /** Lokal fil-URI (fra picker eller compressor). */
  fileUri: string;
  contentType: string;
  /**
   * Sekunder — blir objektets `cache-control: max-age=…`. P1 (LÅST): settes
   * ved upload og kan ALDRI endres per objekt i etterkant.
   */
  cacheControlS: number;
}): Promise<void> {
  // getSession leser lokalt (og fornyer selv ved behov) — ingen ekstra
  // nettverksrunde per opplasting (P5-regelen fra A5).
  const {data} = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Ingen aktiv økt — logg inn på nytt.');
  }

  const result = await FileSystem.uploadAsync(
    `${Config.SUPABASE_URL}/storage/v1/object/${opts.bucket}/${opts.path}`,
    opts.fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        authorization: `Bearer ${token}`,
        apikey: Config.SUPABASE_ANON_KEY!,
        'content-type': opts.contentType,
        // Samme semantikk som supabase-js' `upsert: false`: en kollisjon
        // skal feile høyt, aldri overskrive et annet lags fil.
        'x-upsert': 'false',
        'cache-control': `max-age=${opts.cacheControlS}`,
      },
    },
  );

  if (result.status !== 200) {
    throw new Error(`Opplastingen feilet (HTTP ${result.status}).`);
  }
}
