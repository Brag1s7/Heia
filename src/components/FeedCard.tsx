import React from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar} from './Avatar';
import type {FeedItem} from '../shared/types';

interface FeedCardProps {
  item: FeedItem;
  onHeia?: () => void;
  onComment?: () => void;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) {return 'Akkurat nå';}
  if (diffMin < 60) {return `${diffMin} min siden`;}
  if (diffHour < 24) {return `${diffHour} t siden`;}
  if (diffDay === 1) {return 'I går';}
  if (diffDay < 7) {return `${diffDay} dager siden`;}
  return date.toLocaleDateString('nb-NO', {day: 'numeric', month: 'short'});
}

type Marker = {label: string; dot: string};

// Type-markør + grønn energy-rail vises kun på meningsbærende poster.
// Vanlig melding/bilde får ingen markør (unngå å badge alt).
function getMarker(item: FeedItem): Marker | null {
  switch (item.type) {
    case 'resultat':
      return {label: 'RESULTAT', dot: colors.heiaInk};
    case 'match_event':
    case 'match_start':
    case 'match_end':
      return {
        label: item.matchEvent ? `${item.matchEvent.minute}′ KAMP` : 'KAMP',
        dot: colors.heiaInk,
      };
    case 'paaminnelse':
      return {label: 'PÅMINNELSE', dot: colors.warning};
    default:
      return null;
  }
}

function isMatchType(item: FeedItem): boolean {
  return (
    item.type === 'match_event' ||
    item.type === 'match_start' ||
    item.type === 'match_end'
  );
}

export function FeedCard({item, onHeia, onComment}: FeedCardProps) {
  const roleLabel = item.author.role === 'trener' ? 'Trener' : undefined;
  const marker = getMarker(item);
  const showRail = item.type === 'resultat' || isMatchType(item);
  const heiaCount = item.heiaCount ?? 0;
  const commentCount = item.commentCount ?? 0;

  return (
    <View style={styles.card}>
      {showRail && <View style={styles.rail} />}

      {/* Header */}
      <View style={styles.header}>
        <Avatar name={item.author.name} size="md" uri={item.author.avatarUrl} />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.author.name}</Text>
            {roleLabel && <Text style={styles.role}>{roleLabel}</Text>}
          </View>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {marker && (
          <View style={styles.marker}>
            <View style={[styles.markerDot, {backgroundColor: marker.dot}]} />
            <Text style={styles.markerText}>{marker.label}</Text>
          </View>
        )}
      </View>

      {/* Innhold */}
      <Text style={[styles.content, showRail && styles.contentStrong]}>
        {item.content}
      </Text>

      {/* Bilde */}
      {item.imageUrl && (
        <View style={styles.imageWrap}>
          <Image
            source={{uri: item.imageUrl}}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Reaksjoner — lettvekt, merkevare-drevet */}
      <View style={styles.reactions}>
        <Pressable
          style={styles.reactionBtn}
          onPress={onHeia}
          hitSlop={8}>
          <Text style={styles.reactionEmoji}>👏</Text>
          <Text
            style={[
              styles.reactionLabel,
              item.iReacted && styles.reactionLabelActive,
            ]}>
            {heiaCount > 0 ? `${heiaCount} heier` : 'Heia'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.reactionBtn}
          onPress={onComment}
          hitSlop={8}>
          <Text style={styles.reactionEmoji}>💬</Text>
          <Text style={styles.reactionLabel}>
            {commentCount > 0 ? `${commentCount} kommentarer` : 'Kommenter'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.cardResting,
  },
  rail: {
    position: 'absolute',
    left: 6,
    top: spacing.lg,
    bottom: spacing.lg,
    width: 4,
    borderRadius: radius.full,
    backgroundColor: colors.heia,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  role: {
    ...typography.caption,
    color: colors.heiaInk,
    backgroundColor: colors.heiaSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '600',
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  markerText: {
    ...typography.label,
    fontSize: 11,
  },
  content: {
    ...typography.body,
    lineHeight: 22,
  },
  contentStrong: {
    fontWeight: '600',
    fontSize: 17,
  },
  imageWrap: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
  },
  reactions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reactionEmoji: {
    fontSize: 15,
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  reactionLabelActive: {
    color: colors.heiaInk,
    fontWeight: '700',
  },
});
