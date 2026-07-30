import React, {useMemo} from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {MatchEventRow} from './MatchEventRow';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent} from '../shared/types';

interface MatchTimelineProps {
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  /** Kampstart — grunnlaget for å regne ut hvilket minutt et bilde tilhører. */
  startedAt?: Date;
  /** Live-modus vil ha det ferskeste øverst; kamprapporten leses forfra. */
  newestFirst?: boolean;
  onPressPhoto?: (photo: MatchPhoto) => void;
}

type Entry =
  | {kind: 'event'; key: string; event: MatchEvent; photos: MatchPhoto[]}
  | {kind: 'photo'; key: string; photo: MatchPhoto; minute: number};

/**
 * Samme regnestykke som serveren bruker i `report_match_event`
 * (`FLOOR(EXTRACT(EPOCH FROM (now() - started_at)) / 60)`), så bilder og
 * hendelser havner på én og samme minuttskala.
 */
function minuteOf(photo: MatchPhoto, startedAt?: Date): number {
  if (!startedAt) return Number.MAX_SAFE_INTEGER;
  return Math.max(
    0,
    Math.floor((photo.createdAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

/**
 * Kampens forløp som én kronologisk liste. Et bilde knyttet til en hendelse
 * henger på hendelsen; et generelt kampbilde er sitt eget innslag på det
 * minuttet det ble lagt ut.
 *
 * Bilder uten kjent kampstart (skal ikke skje på en startet kamp) legges sist
 * i stedet for å bli borte.
 */
export function MatchTimeline({
  matchEvents,
  photos,
  startedAt,
  newestFirst = false,
  onPressPhoto,
}: MatchTimelineProps) {
  const entries = useMemo<Entry[]>(() => {
    const photosByEvent = new Map<string, MatchPhoto[]>();
    const general: MatchPhoto[] = [];

    for (const photo of photos) {
      if (photo.matchEventId) {
        const list = photosByEvent.get(photo.matchEventId);
        if (list) {
          list.push(photo);
        } else {
          photosByEvent.set(photo.matchEventId, [photo]);
        }
      } else {
        general.push(photo);
      }
    }

    // Hendelsene kommer allerede i rekkefølge (ORDER BY sequence), så
    // indeksen deres ER den sanne rekkefølgen innenfor samme minutt.
    const eventEntries = matchEvents.map((event, index) => ({
      sortMinute: event.minute,
      // Et bilde tatt i minutt N er nesten alltid av det som nettopp skjedde,
      // så hendelsen skal stå først når de deler minutt.
      sortRank: 0,
      sortIndex: index,
      entry: {
        kind: 'event' as const,
        key: event.id,
        event,
        photos: photosByEvent.get(event.id) ?? [],
      },
    }));

    const photoEntries = general.map((photo, index) => {
      const minute = minuteOf(photo, startedAt);
      return {
        sortMinute: minute,
        sortRank: 1,
        sortIndex: index,
        entry: {kind: 'photo' as const, key: photo.id, photo, minute},
      };
    });

    const merged = [...eventEntries, ...photoEntries].sort(
      (a, b) =>
        a.sortMinute - b.sortMinute ||
        a.sortRank - b.sortRank ||
        a.sortIndex - b.sortIndex,
    );

    const ordered = merged.map(m => m.entry);
    return newestFirst ? ordered.reverse() : ordered;
  }, [matchEvents, photos, startedAt, newestFirst]);

  return (
    <View>
      {entries.map((entry, index) =>
        entry.kind === 'event' ? (
          <MatchEventRow
            key={entry.key}
            event={entry.event}
            isLatest={newestFirst && index === 0}
            photos={entry.photos}
            onPressPhoto={onPressPhoto}
          />
        ) : (
          <View key={entry.key} style={styles.photoRow}>
            <View style={styles.timeline}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>📷</Text>
              </View>
              <View style={styles.line} />
            </View>

            <View style={styles.content}>
              <Text style={styles.minute}>
                {entry.minute === Number.MAX_SAFE_INTEGER
                  ? 'Bilde'
                  : `${entry.minute}'`}
              </Text>
              <Pressable
                onPress={
                  onPressPhoto ? () => onPressPhoto(entry.photo) : undefined
                }
                style={({pressed}) => [
                  styles.photo,
                  pressed && styles.photoPressed,
                ]}>
                <Image
                  source={{uri: entry.photo.imageUrl}}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                {entry.photo.caption && (
                  <Text style={styles.caption}>{entry.photo.caption}</Text>
                )}
              </Pressable>
              <Text style={styles.author}>{entry.photo.authorName}</Text>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  timeline: {
    alignItems: 'center',
    width: 32,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    fontSize: 14,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  minute: {
    ...typography.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  photo: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoPressed: {
    opacity: 0.8,
  },
  photoImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.background,
  },
  caption: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  author: {
    ...typography.caption,
  },
});
