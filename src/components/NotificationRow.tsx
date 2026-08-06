import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, spacing, radius} from '../theme';
import {stripLeadingGlyph} from '../shared/matchCopy';
import {Avatar} from './Avatar';
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

// Ikonflaten bærer kategorien — en liten, rolig chip. Selve RADEN forblir
// nøytral: farger hele raden per kategori gjorde lista administrativ og
// tilfeldig, ikke premium (Brages retning 2026-08-05).
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
  // Ukedag («tir.») i stedet for «I går»/«3 d» — seksjonsetikettene i
  // Varsler-listen sier alt hvilken bolk raden hører til.
  if (diffDay < 7) {
    return date.toLocaleDateString('nb-NO', {weekday: 'short'});
  }
  return date.toLocaleDateString('nb-NO', {day: 'numeric', month: 'short'});
}

export function NotificationRow({
  item,
  onPress,
  showBorder = true,
}: NotificationRowProps) {
  const unread = item.readAt === null;
  const body = stripLeadingGlyph(item.body);

  // Er handlingen gjort av et menneske, skal mennesket vises. Et generisk
  // megafon-ikon der vi KJENNER personen er en tapt mulighet (00051 gir oss
  // navn + avatar på kommentar, 👏 og trenerbeskjed).
  const actor = item.actor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ulest. ' : ''}${item.title}. ${body}`}
      accessibilityHint={timeAgo(item.createdAt)}
      style={({pressed}) => [
        styles.container,
        showBorder && styles.border,
        unread && styles.unread,
        pressed && styles.pressed,
      ]}>
      {actor ? (
        <Avatar uri={actor.avatarUrl} name={actor.name} size="md" />
      ) : (
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
      )}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.title, unread && styles.titleUnread]}
            numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {/* Utdraget kan mangle — en bildepost uten tekst har ingenting å
            sitere (00052). Da skal raden være to linjer høy, ikke tre
            med en tom. */}
        {body.length > 0 && (
          <Text style={styles.text} numberOfLines={2}>
            {body}
          </Text>
        )}
      </View>

      {/* ÉN konsekvent ulest-markering for alle kategorier: mint prikk,
          svak mintflate og tyngre tittel. Kategorifargede prikker gjorde
          «ulest» til åtte forskjellige signaler. */}
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
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
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  // Typografisk hierarki: tittelen er ANKERET og står i full tekstfarge
  // også når raden er lest — en gjennomlest innboks skal ikke være en side
  // med grå tekst. Ulest skiller seg på VEKT, ikke størrelse: bytter
  // størrelsen, hopper raden i det den markeres som lest.
  title: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colors.textPrimary,
  },
  titleUnread: {
    fontWeight: '800',
  },
  time: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  text: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: colors.textSecondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.heiaInk,
  },
});
