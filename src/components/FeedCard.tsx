import React from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar} from './Avatar';
import type {FeedItem} from '../shared/types';

interface FeedCardProps {
  item: FeedItem;
  onHeia?: () => void;
  onComment?: () => void;
  /** Settes kun for den som kan løsne en festet post (trener/lagleder). */
  onUnpin?: () => void;
  /**
   * Gjør hele kortet trykkbart. Settes kun på poster som faktisk fører et
   * sted — en vanlig melding skal ikke se ut som en lenke.
   */
  onPress?: () => void;
  /** Forstørr-ikon på bildet. Egen handling, så den ikke stjeler `onPress`. */
  onExpandImage?: () => void;
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
  // «Varsle hele laget» slår alt annet: dette er posten treneren mente at
  // ingen skulle gå glipp av, og den ligger allerede øverst i feeden.
  if (item.isPinned) {
    return {label: '📌 VIKTIG', dot: colors.warning};
  }
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

export function FeedCard({
  item,
  onHeia,
  onComment,
  onUnpin,
  onPress,
  onExpandImage,
}: FeedCardProps) {
  const roleLabel = item.author.role === 'trener' ? 'Trener' : undefined;
  const marker = getMarker(item);
  const showRail =
    item.type === 'resultat' || isMatchType(item) || item.isPinned === true;
  const heiaCount = item.heiaCount ?? 0;
  const commentCount = item.commentCount ?? 0;

  // Heia, Kommenter, forstørr og «løsne» er egne Pressables inne i kortet.
  // Den innerste tar trykket i RN, så de utløser aldri kortets onPress.
  const inner = (
    <>
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
        {marker &&
          (onUnpin ? (
            // Festede poster ville ellers blitt liggende øverst for alltid.
            // Selve markøren er knappen — den står der man ser «hvorfor
            // ligger denne her?», og bare trener/lagleder får den.
            <Pressable
              onPress={onUnpin}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Løsne fra toppen"
              style={({pressed}) => [styles.marker, pressed && styles.markerPressed]}>
              <View style={[styles.markerDot, {backgroundColor: marker.dot}]} />
              <Text style={styles.markerText}>{marker.label}</Text>
              <Text style={styles.markerClose}>✕</Text>
            </Pressable>
          ) : (
            <View style={styles.marker}>
              <View style={[styles.markerDot, {backgroundColor: marker.dot}]} />
              <Text style={styles.markerText}>{marker.label}</Text>
            </View>
          ))}
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
          {onExpandImage && (
            <Pressable
              onPress={onExpandImage}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Vis bildet i fullskjerm"
              style={({pressed}) => [
                styles.expand,
                pressed && styles.expandPressed,
              ]}>
              <Text style={styles.expandIcon}>⤢</Text>
            </Pressable>
          )}
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
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.card}>{inner}</View>;
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
  cardPressed: {
    backgroundColor: colors.heiaSoft,
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
  markerPressed: {
    backgroundColor: colors.border,
  },
  markerClose: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 2,
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
  expand: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  expandPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  expandIcon: {
    fontSize: 15,
    color: colors.surface,
    fontWeight: '700',
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
