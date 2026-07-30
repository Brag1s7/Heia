import React from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Maximize2, MessageCircle} from './icons';
import {Avatar} from './Avatar';
import {StatusPill} from './StatusPill';
import {ScoreChip} from './ScoreChip';
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

function isMatchType(item: FeedItem): boolean {
  return (
    item.type === 'match_event' ||
    item.type === 'match_start' ||
    item.type === 'match_end'
  );
}

/**
 * Kortmarkør (A v2). Tre varianter, tre budskap:
 * - VIKTIG-pill på solskinnsflate — treneren snakker.
 * - Mørk score-chip — kampen bor alltid på mørk flate, også i feeden.
 *   (Stilling/minutt mangler til `get_team_feed` også hydrerer matchEvent —
 *   kjent hull; chipen bærer signaturen, `content` bærer tallene.)
 * - Påminnelse-pill i lilla.
 * Vanlig melding/bilde får ingen markør — unngå pill-inflasjon.
 */
function Marker({item, onUnpin}: {item: FeedItem; onUnpin?: () => void}) {
  if (item.isPinned) {
    return (
      <StatusPill
        kind="viktig"
        label="Viktig"
        onPress={onUnpin}
        suffix="✕"
        accessibilityLabel="Løsne fra toppen"
      />
    );
  }

  // Kampkontekst fra 00029: chipen er statusdrevet, ikke posttype-drevet.
  // Coral = kampen pågår NÅ — en gammel målpost skal ikke rope live for alltid.
  const match = item.match;
  const score = match ? `${match.home}–${match.away}` : undefined;
  const liveNow = match?.status === 'live';

  if (item.type === 'resultat') {
    return <ScoreChip label="Resultat" score={score} />;
  }
  if (isMatchType(item)) {
    if (item.type === 'match_end') {
      return <ScoreChip label="Slutt" score={score} />;
    }
    if (item.type === 'match_event') {
      // Minuttet er øyeblikkets identitet; stillingen i øyeblikket bor i
      // teksten. Kampens NÅ-stilling ville motsagt den på historiske mål.
      const minute = match?.minute ?? item.matchEvent?.minute;
      return (
        <ScoreChip
          label={minute !== undefined ? `${minute}′` : 'Kamp'}
          live={liveNow}
        />
      );
    }
    // match_start: mens kampen pågår er avsparkposten lagets levende
    // resultatkort i feeden. Etterpå bærer den ingen stilling — posten sier
    // «Kampen er i gang», og sluttresultatet ville motsagt sin egen tekst.
    if (liveNow || match?.status === 'halfTime') {
      return (
        <ScoreChip
          label={liveNow ? 'Live' : 'Pause'}
          live={liveNow}
          score={score}
        />
      );
    }
    return <ScoreChip label="Kamp" />;
  }
  if (item.type === 'paaminnelse') {
    return <StatusPill kind="remind" label="Påminnelse" />;
  }
  return null;
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
  const strong = item.isPinned || isMatchType(item) || item.type === 'resultat';
  const heiaCount = item.heiaCount ?? 0;
  const commentCount = item.commentCount ?? 0;

  // Heia, Kommenter, forstørr og «løsne» er egne Pressables inne i kortet.
  // Den innerste tar trykket i RN, så de utløser aldri kortets onPress.
  const inner = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Avatar name={item.author.name} size="md" uri={item.author.avatarUrl} />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.author.name}
            </Text>
            {roleLabel && <Text style={styles.role}>{roleLabel}</Text>}
          </View>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Marker item={item} onUnpin={onUnpin} />
      </View>

      {/* Innhold */}
      {item.content ? (
        <Text style={[styles.content, strong && styles.contentStrong]}>
          {item.content}
        </Text>
      ) : null}

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
              <Maximize2 size={14} color={colors.surface} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      )}

      {/* Reaksjoner — designede pills, aktiv 👏 er et Heia-øyeblikk */}
      <View style={styles.reactions}>
        <Pressable
          onPress={onHeia}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Heia"
          style={({pressed}) => [
            styles.reactPill,
            item.iReacted && styles.reactPillOn,
            pressed && styles.reactPillPressed,
          ]}>
          <Text
            style={[styles.reactText, item.iReacted && styles.reactTextOn]}>
            👏 {heiaCount > 0 ? `${heiaCount} heier` : 'Heia'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onComment}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kommenter"
          style={({pressed}) => [
            styles.reactPill,
            pressed && styles.reactPillPressed,
          ]}>
          <MessageCircle size={14} color={colors.textSecondary} />
          <Text style={styles.reactText}>
            {commentCount > 0 ? `${commentCount}` : 'Kommenter'}
          </Text>
        </Pressable>
      </View>
    </>
  );

  const surfaceStyle = [styles.card, item.isPinned && styles.cardSun];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({pressed}) => [...surfaceStyle, pressed && styles.cardPressed]}>
        {inner}
      </Pressable>
    );
  }

  return <View style={surfaceStyle}>{inner}</View>;
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
  // Solskinnsflate: treneren har merket dette som viktig for alle
  cardSun: {
    backgroundColor: colors.sun,
    borderColor: colors.sunBorder,
  },
  cardPressed: {
    backgroundColor: colors.heiaSoft,
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
    fontWeight: '700',
    flexShrink: 1,
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
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  content: {
    ...typography.body,
    lineHeight: 22,
  },
  contentStrong: {
    fontWeight: '700',
    fontSize: 16,
  },
  imageWrap: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 210,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
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
  reactions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  reactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md + 1,
    paddingVertical: 7,
    borderRadius: radius.full,
    // Nøytral gjennomskinnelig — leselig på både hvit og solskinnsflate
    backgroundColor: 'rgba(17, 36, 27, 0.06)',
  },
  reactPillOn: {
    backgroundColor: colors.heiaTint,
  },
  reactPillPressed: {
    opacity: 0.7,
  },
  reactText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reactTextOn: {
    color: colors.heiaInk,
  },
});
