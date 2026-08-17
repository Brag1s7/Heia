/**
 * <MediaImage media={ref} variant="display" …> — appens eneste vei fra
 * MediaRef til piksler (P4). Kallstedene vet path + variant; signering,
 * utløp og fornying bor her. I B byttes innmaten til expo-image med
 * `cacheKey = storage_path` — props-kontrakten er den samme.
 *
 * Innebygd måling (P9 lag 2): lastinger telles per path (uten token), så
 * «samme objekt lastet N ganger» kan leses rett ut av dev-konsollen
 * (`imageMetrics.dump()`). Bildebytes kan IKKE måles fra JS (F27) — antall
 * og repetisjon er det klienten kan bevise, bytes bor i serverloggene.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Image, View, type ImageProps} from 'react-native';
import {mediaPathFor, type MediaRef, type MediaVariant} from './types';
import {peekMediaUrl, refreshMediaUrl, resolveMediaUrl} from './resolver';

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

interface MediaImageProps extends Omit<ImageProps, 'source'> {
  media: MediaRef;
  variant?: MediaVariant;
}

export function MediaImage({
  media,
  variant = 'display',
  style,
  ...imageProps
}: MediaImageProps) {
  const path = mediaPathFor(media, variant);
  const [url, setUrl] = useState<string | null>(() => peekMediaUrl(path));
  const loadStartedAt = useRef(0);
  // Én fornying per path per montering — resolverens 1/min-grense er
  // sikkerhetsnettet under, dette stopper en lokal error→retry-løkke.
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const warm = peekMediaUrl(path);
    setUrl(warm);
    if (!warm) {
      resolveMediaUrl(media, variant).then(resolved => {
        if (!cancelled && resolved) setUrl(resolved);
      });
    }
    return () => {
      cancelled = true;
    };
    // path er avledet av media+variant og dekker begge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!url) {
    // Flaten (bakgrunnsfargen bor i kallstedets stil) til URL-en er klar —
    // samme fotavtrykk, ingen hopp i layouten.
    return <View style={style} />;
  }

  return (
    <Image
      {...imageProps}
      style={style}
      source={{uri: url}}
      onLoadStart={() => {
        loadStartedAt.current = Date.now();
      }}
      onLoadEnd={() => {
        recordLoad(path, Date.now() - loadStartedAt.current);
      }}
      onError={() => {
        if (refreshedFor.current === path) return;
        refreshedFor.current = path;
        refreshMediaUrl(path).then(fresh => {
          if (fresh) setUrl(fresh);
        });
      }}
    />
  );
}
