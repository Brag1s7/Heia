import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';
import {
  Ball,
  Bell,
  Calendar,
  Check,
  Info,
  Megaphone,
  MessageCircle,
} from './icons';
import type {
  HeiaNotification,
  NotificationCategory,
} from '../lib/api/notifications';

interface NotificationRowProps {
  item: HeiaNotification;
  onPress?: () => void;
  showBorder?: boolean;
}

// MÅ stå FØR CATEGORY_ICON — JSX-en under evalueres i det modulen lastes.
const emojiStyles = StyleSheet.create({
  emoji: {fontSize: 17},
});

// Ikon per kategori (Lucide, blekket i flatens ink-farge). 👏 består som
// emoji — det er merkevare-gesten, og Lucide har ingen applaus.
const CATEGORY_ICON: Record<NotificationCategory, React.ReactNode> = {
  match_live: <Ball size={18} color={colors.liveInk} strokeWidth={2} />,
  new_post: <Megaphone size={18} color={colors.textSecondary} />,
  new_comment: <MessageCircle size={18} color={colors.infoInk} />,
  new_reaction: <Text style={emojiStyles.emoji}>👏</Text>,
  event_reminder: <Calendar size={18} color={colors.remindInk} />,
  rsvp_update: <Check size={18} color={colors.heiaInk} />,
  admin_message: <Megaphone size={18} color={colors.goldInk} />,
  system: <Info size={18} color={colors.textSecondary} />,
};

// Ikonflate per kategori — A v2s låste fargesemantikk: coral = live, blå =
// info/kalender, lilla = påminnelse, sol = trenerbeskjed, mint = Heia-øyeblikk.
const CATEGORY_SURFACE: Record<NotificationCategory, string> = {
  match_live: colors.liveSoft,
  new_post: colors.surfaceMuted,
  new_comment: colors.infoSoft,
  new_reaction: colors.heiaTint,
  event_reminder: colors.remindSoft,
  rsvp_update: colors.heiaSoft,
  admin_message: colors.sun,
  system: colors.surfaceMuted,
};

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Nå';
  if (diffMin < 60) return `${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} t`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'I går';
  if (diffDay < 7) return `${diffDay} d`;
  return date.toLocaleDateString('nb-NO', {day: 'numeric', month: 'short'});
}

export function NotificationRow({
  item,
  onPress,
  showBorder = true,
}: NotificationRowProps) {
  const unread = item.readAt === null;

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.container,
        showBorder && styles.border,
        unread && styles.unread,
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor:
              CATEGORY_SURFACE[item.category] ?? colors.surfaceMuted,
          },
        ]}>
        {CATEGORY_ICON[item.category] ?? (
          <Bell size={18} color={colors.textSecondary} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.title, unread && styles.titleUnread]}
            numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.text} numberOfLines={2}>
          {item.body}
        </Text>
      </View>

      {/* Ulest-prikken er den eneste markøren som overlever et raskt blikk. */}
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  unread: {
    backgroundColor: colors.heiaSoft,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
  },
  titleUnread: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  text: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.heiaInk,
  },
});
