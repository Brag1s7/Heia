/**
 * <MediaImage media={ref} variant="display" …> — appens eneste vei fra
 * MediaRef til piksler (P4). Kallstedene vet path + variant; signering,
 * utløp og fornying bor her.
 *
 * B1: innmaten er expo-image med `cacheKey = storage_path`. Disk-cachen
 * nøkles dermed på PATH, ikke URL — et nytt signert token er fortsatt et
 * cache-treff (F9-rotårsaken fra auditen: roterende `?token=` ga 100 %
 * miss i RN-Image). Cache-treff er derfor TTL-uavhengige: den signerte
 * URL-en trengs bare når bytes faktisk skal hentes fra nettet.
 *
 * Innebygd måling (P9 lag 2): lastinger telles per path (uten token), så
 * «samme objekt lastet N ganger» kan leses rett ut av dev-konsollen
 * (`imageMetrics.dump()`). MERK etter B1: onLoadStart/End fyrer kun ved
 * FAKTISK lasting (disk eller nett) — et minne-cache-treff er stille, og
 * det er nettopp poenget. Bildebytes kan IKKE måles fra JS (F27).
 */
import React, {useEffect, useRef, useState} from 'react';
import {View, type StyleProp, type ImageStyle} from 'react-native';
import {Image} from 'expo-image';
import {mediaPathFor, type MediaRef, type MediaVariant} from './types';
import {
  FEED_MEDIA_BUCKET,
  peekMediaUrl,
  refreshMediaUrl,
  resolveMediaUrl,
} from './resolver';

// 150 MB LRU (B1-beslutningen fra arkitekturplanen): rommer et par lags
// feed + gallerier i thumb/display-variantene, og er lite nok til aldri å
// bli et lagringsproblem på telefonen. Tømmes ved signOut (clearLocalCaches).
Image.configureCache({maxDiskSize: 150 * 1024 * 1024});

// Samme dev-gating som netMetrics: aldri konsoll i prod, aldri støy i jest.
const IS_DEV =
  typeof __DEV__ !== 'undefined' && __DEV__ && typeof jest === 'undefined';

interface LoadAgg {
  loads: number;
  /** Tid til første fullførte lasting av objektet (ms). */
  firstLoadMs?: number;
}

const loadsByPath = new Map<string, LoadAgg>();

function recordLoad(path: string, durationMs: number): void {
  let agg = loadsByPath.get(path);
  if (!agg) {
    agg = {loads: 0};
    loadsByPath.set(path, agg);
  }
  agg.loads += 1;
  if (agg.firstLoadMs === undefined) agg.firstLoadMs = durationMs;
  if (IS_DEV && agg.loads > 1) {
    console.log(`[img] ${path} lastet ${agg.loads}. gang (${durationMs}ms)`);
  }
}

/** Øyeblikksbilde for rapportering: N ≈ 1 per objekt per døgn er A-målet. */
export function getImageMetricsSnapshot() {
  return Object.fromEntries([...loadsByPath].map(([k, v]) => [k, {...v}]));
}

if (IS_DEV) {
  (globalThis as Record<string, unknown>).imageMetrics = {
    snapshot: getImageMetricsSnapshot,
    dump(): void {
      const snap = getImageMetricsSnapshot();
      const paths = Object.keys(snap);
      const total = paths.reduce((sum, p) => sum + snap[p].loads, 0);
      console.log(
        `[img] === ${paths.length} objekter, ${total} lastinger ===`,
      );
      for (const [path, agg] of Object.entries(snap)) {
        console.log(
          `[img] ${path}: ${agg.loads}× (første ${agg.firstLoadMs ?? '?'}ms)`,
        );
      }
    },
  };
}

interface MediaImageProps {
  media: MediaRef;
  variant?: MediaVariant;
  style?: StyleProp<ImageStyle>;
  /**
   * RN-navnet beholdt ved expo-image-byttet så kallstedene slapp å endres —
   * oversettes til `contentFit`. Kun verdiene appen faktisk bruker.
   */
  resizeMode?: 'cover' | 'contain';
  /**
   * Kalles med `false` så lenge det ikke finnes en brukbar URL (usignert
   * eller død path), `true` når bildet har en. Brukes av `Avatar` til å la
   * initialene stå fremme i stedet for en tom sirkel.
   */
  onResolved?: (hasUrl: boolean) => void;
}

export function MediaImage({
  media,
  variant = 'display',
  style,
  resizeMode = 'cover',
  onResolved,
}: MediaImageProps) {
  const bucket = media.bucket ?? FEED_MEDIA_BUCKET;
  const path = mediaPathFor(media, variant);
  // Disk-cachen nøkles på bucket+path: to buckets kan ha samme path, og en
  // avatar skal aldri kunne serveres fra et feed-bildes cache-oppføring.
  const key = `${bucket}/${path}`;
  const [url, setUrl] = useState<string | null>(() =>
    peekMediaUrl(path, bucket),
  );
  const loadStartedAt = useRef(0);
  // Én fornying per path per montering — resolverens 1/min-grense er
  // sikkerhetsnettet under, dette stopper en lokal error→retry-løkke.
  const refreshedFor = useRef<string | null>(null);
  // Satt når fornyingen har gitt opp: URL-en finnes, men det gjør ikke
  // objektet. Skilles fra «ingen URL ennå», som er en helt annen tilstand.
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const warm = peekMediaUrl(path, bucket);
    setUrl(warm);
    setDead(false);
    if (!warm) {
      resolveMediaUrl(media, variant).then(resolved => {
        if (!cancelled && resolved) setUrl(resolved);
      });
    }
    return () => {
      cancelled = true;
    };
    // key er avledet av bucket+media+variant og dekker alle tre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Kallsteder som tegner noe UNDER bildet (Avatar tegner initialer) må vite
  // om det faktisk kommer piksler. Uten dette signalet ville en død path —
  // et fjernet profilbilde — etterlatt en tom flate i stedet for initialene.
  //
  // `dead` er halvparten av poenget: et FJERNET profilbilde kan fortsatt ha
  // en gyldig signert URL i inntil 24 t hos alle ANDRE enheter (den som
  // slettet invaliderer bare sin egen cache). Uten dette ville URL-en vært
  // «til stede», bytene borte, og sirkelen stått tom hos hele laget til
  // tokenet utløp.
  useEffect(() => {
    onResolved?.(url !== null && !dead);
  }, [url, dead, onResolved]);

  if (!url) {
    // Flaten (bakgrunnsfargen bor i kallstedets stil) til URL-en er klar —
    // samme fotavtrykk, ingen hopp i layouten.
    return <View style={style} />;
  }

  return (
    <Image
      style={style}
      source={{uri: url, cacheKey: key}}
      cachePolicy="disk"
      contentFit={resizeMode}
      onLoadStart={() => {
        loadStartedAt.current = Date.now();
      }}
      onLoadEnd={() => {
        recordLoad(path, Date.now() - loadStartedAt.current);
      }}
      onError={() => {
        // Utløpt token etter lang bakgrunn er normaltilfellet her. Disk-
        // cachen overlever (path-nøklet) — kun netthentingen trengte ny URL.
        if (refreshedFor.current === key) {
          setDead(true);
          return;
        }
        refreshedFor.current = key;
        refreshMediaUrl(path, bucket).then(fresh => {
          // null = rate-limitet ELLER objektet er faktisk borte. Begge
          // betyr «ingen piksler nå», og kallstedet må få vite det.
          if (fresh) setUrl(fresh);
          else setDead(true);
        });
      }}
    />
  );
}
