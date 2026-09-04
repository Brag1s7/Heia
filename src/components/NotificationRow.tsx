import React, {useEffect, useRef} from 'react';
import {View, Text, Pressable, StyleSheet, Animated} from 'react-native';
import {colors, spacing} from '../theme';
import {stripLeadingGlyph} from '../shared/matchCopy';
import {Avatar} from './Avatar';
import {avatarRef} from '../lib/media/avatar';
import {OPAL} from './OpalSurface';
import {
  Ball,
  Bell,
  Calendar,
  Check,
  Clock,
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
  /**
   * Avsenderens NÅVÆRENDE avatarfarge (00070), slått opp av skjermen fra
   * forfatter-cachen. Bevisst ikke lest fra `item.actor`: `data` fryser
   * avsenderen (00051), og et frosset fargevalg ville vist en farge
   * personen har byttet bort. Utelatt = navne-hashen, som før.
   */
  actorColor?: string;
  onPress?: () => void;
  showBorder?: boolean;
}

/**
 * RADEN SKÅRET INN I GLASSET (Brage 2026-09-04): Varsler er ÉN
 * notification-flate (LiquidGlassSurface `sheet`), og raden er ikke en flate
 * oppå den — den er gjennomsiktig innhold på glasset. Alt som var hvitt,
 * grått eller pastell her er byttet mot blekk i to styrker:
 *
 *   ikon       kategoriens BLEKK som glyf, og SAMME blekk som svak tint bak
 *              (hierarkisk gjengivelse — én farge, to styrker), i en
 *              avrundet kvadrat. Kvadratet skiller system fra menneske:
 *              mennesket er alltid en sirkel (Avatar).
 *   skille     innfelt blekk-hårlinje som starter der teksten starter og
 *              slutter før kanten — aldri kant til kant.
 *   trykk      blekk-tint, aldri en lys flate på glasset (Emil: to lyse
 *              translusente lag oppå hverandre ødelegger lesbarheten).
 *   ulest      tyngre tittel + heiaInk-prikk; den gamle mintflaten over hele
 *              raden er borte (den var nettopp en lys flate på glasset).
 *   blekk      tittel i textPrimary; body og tid i OPAL.inkSecondary —
 *              kontrastporten måles over glassets mørkeste grunn i
 *              `__tests__/notificationRow.test.tsx`.
 */

/** Ikonslottet er avatarbredden (md 40), så tekstkolonnen står på samme
 *  akse enten raden viser et menneske eller en kategori. */
export const ROW_ICON_SLOT = 40;
/** Kategorikvadratet: 36 med radius 11 — «app-ikon»-formen. */
export const ROW_ICON = 36;
export const ROW_ICON_RADIUS = 11;
/** Skillelinja: fra tekstkolonnen (16 + 40 + 12) til 16 pt før høyre kant. */
export const ROW_SEPARATOR_LEFT = spacing.lg + ROW_ICON_SLOT + spacing.md;
export const ROW_SEPARATOR_RIGHT = spacing.lg;

/** «#RRGGBB» → «rgba(r, g, b, a)». Ugyldig hex returneres urørt. */
export function inkTint(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Kategoriens blekk — glyfen. Hverdagens kategorier (innlegg, system) får
 *  Heia-blekk, ikke grått: en Heia-liste er grønn i blekket, ikke bleik. */
export const CATEGORY_INK: Record<NotificationCategory, string> = {
  match_live: colors.liveInk,
  new_post: colors.heiaDeep,
  new_comment: colors.infoInk,
  new_reaction: colors.heiaInk,
  event_reminder: colors.remindInk,
  rsvp_update: colors.heiaInk,
  admin_message: colors.goldInk,
  system: colors.heiaDeep,
};

/** Tinten bak glyfen: samme blekk, svakt. Gull og Heia-neon tintes fra
 *  FYLLFARGEN (blekket deres er brunt/mørkt og blir gjørme som tint). */
export const CATEGORY_TINT: Record<NotificationCategory, string> = {
  match_live: inkTint(colors.liveInk, 0.12),
  new_post: inkTint(colors.heiaDeep, 0.1),
  new_comment: inkTint(colors.infoInk, 0.12),
  new_reaction: inkTint(colors.heia, 0.18),
  event_reminder: inkTint(colors.remindInk, 0.12),
  rsvp_update: inkTint(colors.heiaInk, 0.12),
  admin_message: inkTint(colors.gold, 0.22),
  system: inkTint(colors.heiaDeep, 0.1),
};

/** En endring (00054) er historikk-gul, som trenerbeskjeden. */
const CHANGE_TINT = CATEGORY_TINT.admin_message;

const GLYPH = 18;

function CategoryGlyph({category}: {category: NotificationCategory}) {
  const ink = CATEGORY_INK[category] ?? colors.heiaDeep;
  switch (category) {
    case 'match_live':
      return <Ball size={GLYPH} color={ink} strokeWidth={2} />;
    case 'new_post':
    case 'admin_message':
      return <Megaphone size={GLYPH} color={ink} strokeWidth={2.1} />;
    case 'new_comment':
      return <MessageCircle size={GLYPH} color={ink} strokeWidth={2.1} />;
    case 'new_reaction':
      // 👏 består som emoji — merkevare-gesten; Lucide har ingen applaus.
      return <Text style={styles.emoji}>👏</Text>;
    case 'event_reminder':
      return <Calendar size={GLYPH} color={ink} strokeWidth={2.1} />;
    case 'rsvp_update':
      return <Check size={GLYPH} color={ink} strokeWidth={2.6} />;
    case 'system':
      return <Info size={GLYPH} color={ink} strokeWidth={2.1} />;
    default:
      return <Bell size={GLYPH} color={ink} strokeWidth={2.1} />;
  }
}

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
  actorColor,
  onPress,
  showBorder = true,
}: NotificationRowProps) {
  const unread = item.readAt === null;
  const body = stripLeadingGlyph(item.body);
  const changes = item.changes;

  // Kontrollert overgang når raden markeres som lest: prikken toner ut i
  // stedet for å forsvinne i ett hopp. Kjører ikke på montering — en liste
  // som blinker ved åpning er verre enn ingen animasjon. Opacity på JS-
  // driver som før (samme Animated-verdi som styrte mintflaten).
  const readAnim = useRef(new Animated.Value(unread ? 1 : 0)).current;
  const mounted = useRef(false);
  useEffect(() => {
    const to = unread ? 1 : 0;
    if (!mounted.current) {
      mounted.current = true;
      readAnim.setValue(to);
      return;
    }
    Animated.timing(readAnim, {
      toValue: to,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [unread, readAnim]);

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
      style={({pressed}) => [styles.container, pressed && styles.pressed]}>
      <View style={styles.iconSlot}>
        {actor ? (
          <Avatar
            media={avatarRef(actor.avatarPath)}
            name={actor.name}
            color={actorColor}
            size="md"
          />
        ) : changes ? (
          /* En endring er ikke en ny hendelse — eget ikon, så den ikke
             forveksles med «nytt arrangement» i lista. */
          <View
            testID="row-icon"
            style={[styles.iconSquare, {backgroundColor: CHANGE_TINT}]}>
            <Clock size={GLYPH} color={colors.goldInk} strokeWidth={2.1} />
          </View>
        ) : (
          <View
            testID="row-icon"
            style={[
              styles.iconSquare,
              {
                backgroundColor:
                  CATEGORY_TINT[item.category] ?? CATEGORY_TINT.system,
              },
            ]}>
            <CategoryGlyph category={item.category} />
          </View>
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
        {/* Er dette en ENDRING, er forskjellen hele poenget (00054). Da
            tegner vi «gammel → ny» i stedet for å gjenta setningen fra
            body-en. Maks to felt; resten telles. */}
        {changes ? (
          <View style={styles.changes}>
            {changes.slice(0, 2).map(c => (
              <View key={c.field} style={styles.changeRow}>
                <Text style={styles.changeOld} numberOfLines={1}>
                  {c.old}
                </Text>
                <Text style={styles.changeArrow}>→</Text>
                <Text style={styles.changeNew} numberOfLines={1}>
                  {c.new}
                </Text>
              </View>
            ))}
            {changes.length > 2 && (
              <Text style={styles.text}>
                +{changes.length - 2} endring
                {changes.length - 2 === 1 ? '' : 'er'} til
              </Text>
            )}
          </View>
        ) : (
          /* Utdraget kan mangle — en bildepost uten tekst har ingenting å
             sitere (00052). Da skal raden være to linjer høy, ikke tre
             med en tom. */
          body.length > 0 && (
            <Text style={styles.text} numberOfLines={2}>
              {body}
            </Text>
          )
        )}
      </View>

      {/* ÉN konsekvent ulest-markering for alle kategorier: tyngre tittel
          og en blekk-prikk. Kategorifargede prikker gjorde «ulest» til åtte
          forskjellige signaler. */}
      <Animated.View
        testID="unread-dot"
        style={[styles.dot, {opacity: readAnim}]}
      />

      {showBorder && (
        <View
          testID="row-separator"
          style={styles.separator}
          pointerEvents="none"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Gjennomsiktig: glasset ligger bak. Strammere enn før (16 → 12 pt luft).
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
  },
  pressed: {
    backgroundColor: OPAL.rowPressed,
  },
  separator: {
    position: 'absolute',
    left: ROW_SEPARATOR_LEFT,
    right: ROW_SEPARATOR_RIGHT,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OPAL.hairline,
  },
  iconSlot: {
    width: ROW_ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquare: {
    width: ROW_ICON,
    height: ROW_ICON,
    borderRadius: ROW_ICON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 17,
  },
  body: {
    flex: 1,
    gap: 2,
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colors.textPrimary,
  },
  titleUnread: {
    fontWeight: '700',
  },
  // Tiden er roligst: minst, men i samme blekk som body-en så den holder
  // 4,5:1 også der glasset ligger over reisens mørke topp.
  time: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: OPAL.inkSecondary,
  },
  text: {
    fontSize: 13.5,
    lineHeight: 18,
    color: OPAL.inkSecondary,
  },
  changes: {
    gap: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Gammel verdi er historikk — dempet og gjennomstreket. Ny verdi er det
  // du faktisk må forholde deg til.
  changeOld: {
    fontSize: 13.5,
    lineHeight: 18,
    color: OPAL.inkTertiary,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  changeArrow: {
    fontSize: 13,
    color: OPAL.inkTertiary,
  },
  changeNew: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.heiaInk,
  },
});
