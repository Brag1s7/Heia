import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Animated,
  Keyboard,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  type AlertButton,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar} from './Avatar';
import {LiquidGlassSurface} from './LiquidGlassSurface';
import {FeedCard} from './FeedCard';
import {OPAL} from './OpalSurface';
import {Button} from './Button';
import {Skeleton} from './Skeleton';
import {MediaImage} from '../lib/media/MediaImage';
import {MoreHorizontal} from './icons';
import {useAuth, useActiveTeam} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {
  getComments,
  createComment,
  deleteComment,
  getFeedPost,
} from '../lib/api/comments';
import {toggleReaction, deletePost} from '../lib/api/feed';
import {feedAllowsHeia, isSystemMatchPost} from '../shared/matchEngagement';
import {adjustFeedItemCounts} from '../lib/queries/feed';
import {adjustMatchEngagement} from '../lib/queries/eventDetail';
import {promptReport} from '../lib/moderation';
import {avatarRef} from '../lib/media/avatar';
import {WRITING_SCROLL_PROPS, useKeyboardLift} from './keyboard';
import type {FeedComment, FeedItem} from '../shared/types';

/**
 * KOMMENTARTRÅDEN — innlegget øverst, replikkene under, skrivefeltet nederst.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DEN BOR HER OG IKKE I `CommentsScreen`
 *
 * Tråden har nå TO innganger, og de skal aldri kunne bli to tråder:
 *
 *   · `CommentsScreen` — fullskjerm, fra feeden og fra et varsel.
 *   · `CommentSheet` — bunnark over den grønne kampverdenen (skive 4.1).
 *     Fra kampen skal du IKKE sendes bort fra kampen; du skal få samtalen
 *     opp foran den, og kunne dra den ned igjen og fortsatt være i kampen.
 *
 * Alt som kan drifte fra hverandre bor derfor her ÉN gang: lastingen,
 * mutasjonene (kommentar, sletting, HEIA), de optimistiske patchene mot
 * BÅDE feed-cachen og kampens engasjement-cache, moderasjonsmenyene og
 * hele uttrykket.
 *
 * Verten eier bare RAMMEN — tastaturhåndtering, tittel/håndtak og veien ut.
 * Derfor returnerer denne et fragment, ikke en skjerm.
 */

interface CommentThreadProps {
  postId: string;
  teamSpaceId: string;
  /** Innlegget ble slettet — tråden finnes ikke lenger. Verten lukker seg. */
  onPostDeleted: () => void;
  /**
   * Kampinnlegg vises som SAMME kampkort som i feeden (Brage 2026-09-02:
   * «må vise samme kort her og»). Settes av kommentarsiden, som kan åpne
   * kampen; bunnarket i kampskjermen står allerede i kampen og utelater den
   * — da er kortet ikke trykkbart og «Se kampen ›» skjules.
   */
  onOpenMatch?: (eventId: string) => void;
}

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Akkurat nå';
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} t siden`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'I går';
  if (diffDay < 7) return `${diffDay} dager siden`;
  return date.toLocaleDateString('nb-NO', {day: 'numeric', month: 'short'});
}

export function CommentThread({
  postId,
  teamSpaceId,
  onPostDeleted,
  onOpenMatch,
}: CommentThreadProps) {
  const insets = useSafeAreaInsets();
  // Tastaturet (keyboard.tsx): dokken LØFTES med en native-drevet transform,
  // lista får native inset. Ingen layout-animasjon, ingen KAV i verten.
  const lift = useKeyboardLift(insets.bottom);
  // Lista ligger BAK dokken (glass) og reserverer dokkens høyde nederst —
  // så siste kommentar aldri skjules, med og uten tastatur.
  const [dockHeight, setDockHeight] = useState(0);
  const {session} = useAuth();
  const {activeTeamSpace, activeTeamSpaceId, activeRole} = useActiveTeam();

  const myId = session?.user?.id;
  // Tråden hører alltid til aktivt lag i praksis, men rollen gjelder KUN
  // der — et varsel fra et annet lag skal ikke arve admin-rettigheter.
  const amAdmin = teamSpaceId === activeTeamSpaceId && isTeamAdmin(activeRole);

  const [post, setPost] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  // SE DET DU SENDTE (Brage 2026-09-03): med tastaturet oppe er lista kort,
  // og innlegget øverst kan skyve den nyeste kommentaren under kanten.
  // Etter sending rulles lista til der kommentarene begynner.
  const listRef = useRef<ScrollView>(null);
  const commentsTop = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Ref, ikke state: to raske trykk skal ikke rekke å sende to inserts.
  const heiaBusy = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Posten hentes parallelt: kommer du hit fra et varsel («Kari heiet på
      // …») er tråden ofte tom, og uten innlegget øverst er skjermen blank.
      const [postResult, commentResult] = await Promise.all([
        getFeedPost(teamSpaceId, postId).catch(() => null),
        getComments(teamSpaceId, postId),
      ]);
      setPost(postResult);
      setComments(commentResult);
    } catch {
      setError('Kunne ikke laste kommentarer.');
    } finally {
      setLoading(false);
    }
  }, [teamSpaceId, postId]);

  useEffect(() => {
    load();
  }, [load]);

  // Samme optimistiske mønster som feeden: vis med én gang, rull tilbake ved
  // feil. `toggleReaction` er retningsstyrt, så busy-vakta hindrer dobbel-insert.
  const handleHeia = useCallback(async () => {
    if (!post || heiaBusy.current) return;
    heiaBusy.current = true;

    const previous = post;
    const wasReacted = !!post.iReacted;
    const delta = wasReacted ? -1 : 1;
    setPost({
      ...post,
      iReacted: !wasReacted,
      heiaCount: Math.max(0, (post.heiaCount ?? 0) + delta),
    });
    // ⚠️ ER DETTE ET KAMPØYEBLIKK, EIER KAMPSKJERMEN SAMME TALL.
    // Tråden kan nås fra kampforløpet, og da står kampen blurret bak med
    // sitt eget HEIA-tall i cachen. Uten denne patchen ville du kommet
    // tilbake til kampen og sett din egen applaus mangle. No-op når posten
    // ikke hører til en hendelse.
    adjustMatchEngagement(post.eventId, post.id, {
      heia: delta,
      iReacted: !wasReacted,
    });
    try {
      await toggleReaction(post.id, wasReacted);
    } catch {
      setPost(previous);
      adjustMatchEngagement(post.eventId, post.id, {
        heia: -delta,
        iReacted: wasReacted,
      });
    } finally {
      heiaBusy.current = false;
    }
  }, [post]);

  // ⋯ på innleggskortet — samme meny som i feeden. Slettes innlegget er
  // tråden borte med det, så vi går tilbake (feeden refetcher via realtime).
  const handlePostActions = useCallback(() => {
    if (!post) return;
    const own = !!myId && post.author.id === myId;
    const buttons: AlertButton[] = [];
    if (!own) {
      buttons.push({
        text: 'Rapporter til Heia',
        onPress: () => promptReport('feed_post', post.id),
      });
    }
    // ⚠️ SAMME GATE SOM I FEEDEN (P3, skive 8): systemets kampposter rettes
    // i kampen, ikke slettes her. Se `TeamHomeScreen`/`soft_delete_post`.
    if ((own || amAdmin) && !isSystemMatchPost(post.type)) {
      buttons.push({
        text: 'Slett innlegget',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Slette innlegget?',
            'Innlegget og kommentarene fjernes for hele laget.',
            [
              {text: 'Avbryt', style: 'cancel'},
              {
                text: 'Slett',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deletePost(post.id);
                    onPostDeleted();
                  } catch {
                    Alert.alert('Kunne ikke slette', 'Prøv igjen om litt.');
                  }
                },
              },
            ],
          ),
      });
    }
    buttons.push({text: 'Avbryt', style: 'cancel'});
    Alert.alert(
      own ? 'Innlegget ditt' : `Innlegg fra ${post.author.name}`,
      undefined,
      buttons,
    );
  }, [post, myId, amAdmin, onPostDeleted]);

  // ⋯ på en kommentar: egen → slett, andres → rapporter, admin → begge.
  const handleCommentActions = useCallback(
    (comment: FeedComment) => {
      const own = !!myId && comment.author.id === myId;
      const buttons: AlertButton[] = [];
      if (!own) {
        buttons.push({
          text: 'Rapporter til Heia',
          onPress: () => promptReport('comment', comment.id),
        });
      }
      if (own || amAdmin) {
        buttons.push({
          text: 'Slett kommentaren',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Slette kommentaren?',
              'Kommentaren fjernes for hele laget.',
              [
                {text: 'Avbryt', style: 'cancel'},
                {
                  text: 'Slett',
                  style: 'destructive',
                  onPress: async () => {
                    // Optimistisk — refetch rydder opp uansett utfall.
                    setComments(prev => prev.filter(c => c.id !== comment.id));
                    try {
                      await deleteComment(comment.id);
                      // Feed-cachen: −1 rett i posten (B3, P6). Realtime-
                      // ekkoet kan ikke doble — feed-kanalen er fokus-bundet
                      // til TeamHome, som er blurret mens tråden er åpen.
                      adjustFeedItemCounts(teamSpaceId, postId, {
                        comments: -1,
                      });
                      // Samme tall på kampskjermen (skive 4).
                      adjustMatchEngagement(post?.eventId, postId, {
                        comments: -1,
                      });
                    } catch {
                      Alert.alert('Kunne ikke slette', 'Prøv igjen om litt.');
                    }
                    await load();
                  },
                },
              ],
            ),
        });
      }
      buttons.push({text: 'Avbryt', style: 'cancel'});
      Alert.alert(
        own ? 'Kommentaren din' : `Kommentar fra ${comment.author.name}`,
        undefined,
        buttons,
      );
    },
    [myId, amAdmin, teamSpaceId, postId, post?.eventId, load],
  );

  const handleSend = useCallback(async () => {
    if (text.trim().length === 0 || sending) return;
    setSending(true);
    try {
      await createComment(postId, text);
      // Feed-cachen: +1 rett i posten (B3, P6) — telleren på TeamHome er
      // riktig i det du går tilbake, uten å vente på 60 s-regelen.
      adjustFeedItemCounts(teamSpaceId, postId, {comments: 1});
      // Samme tall på kampskjermen (skive 4) — kampen står blurret bak med
      // sin egen teller, og skal ikke vente på 60 s-regelen heller.
      adjustMatchEngagement(post?.eventId, postId, {comments: 1});
      setText('');
      await load();
      // Etter commit: nyeste kommentar ligger øverst i seksjonen — rull dit,
      // så den er synlig UTEN å lukke tastaturet.
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          y: Math.max(0, commentsTop.current - spacing.sm),
          animated: true,
        });
      });
    } catch {
      Alert.alert('Kunne ikke sende', 'Prøv igjen om litt.');
    } finally {
      setSending(false);
    }
  }, [teamSpaceId, postId, post?.eventId, text, sending, load]);

  return (
    <View style={styles.thread}>
      <ScrollView
        ref={listRef}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {paddingBottom: dockHeight + spacing.lg},
        ]}
        // NATIVE tastatur-inset (vindusbasert, i tastaturets egen
        // animasjon): lista slutter i skjermbunnen bak dokken, så insetten
        // = tastaturet, og dokkens høyde ligger alt i paddingen over.
        automaticallyAdjustKeyboardInsets
        // ÉN regel for trykk, hold og drag: berøring utenfor feltet lukker
        // tastaturet ved BERØRINGSSTART. Knapper i lista beholder første
        // trykk (persistTaps «handled»).
        onTouchStart={Keyboard.dismiss}
        {...WRITING_SCROLL_PROPS}>
        {/* Innlegget tråden hører til — konteksten et varsel ikke gir.
            Kampinnlegg = feedens kampkort (mørkt stadionglass), samme
            komponent, samme heia/⋯-handlinger — i `thread`-varianten:
            ingen Kommenter (du er her), kortet er IKKE trykkbart, og
            «Se kampen ›» er eneste vei til kampen (Brage 2026-09-03). */}
        {post && isSystemMatchPost(post.type) && (
          <FeedCard
            item={post}
            variant="thread"
            onHeia={handleHeia}
            onMore={handlePostActions}
            onOpenMatch={
              onOpenMatch && post.eventId
                ? () => onOpenMatch(post.eventId as string)
                : undefined
            }
            teamColor={activeTeamSpace?.color}
          />
        )}
        {post && !isSystemMatchPost(post.type) && (
          <LiquidGlassSurface style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar
                name={post.author.name}
                size="sm"
                media={avatarRef(post.author.avatarPath)}
                color={post.author.avatarColor}
              />
              <View style={styles.postHeaderText}>
                <Text style={styles.postAuthor}>{post.author.name}</Text>
                <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
              </View>
              <Pressable
                onPress={handlePostActions}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Flere valg"
                style={({pressed}) => [
                  styles.more,
                  pressed && styles.morePressed,
                ]}>
                <MoreHorizontal size={18} color={OPAL.inkTertiary} />
              </Pressable>
            </View>
            {post.content.trim().length > 0 && (
              <Text style={styles.postContent}>{post.content}</Text>
            )}
            {post.media && (
              <MediaImage
                media={post.media}
                variant="display"
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
            {/* Du står PÅ innlegget — da skal du også kunne heie på det.
                Samme pill-språk som FeedCard; aktiv 👏 er et Heia-øyeblikk.

                ⚠️ P1 GJELDER OGSÅ HER. Tråden nås fra feeden OG fra et varsel,
                og uten gaten var dette den siste åpne veien til å heie på et
                baklengsmål — basen ville avvist trykket (00075), altså en død
                knapp. Samme delte regel som feeden bruker. */}
            {feedAllowsHeia({
              postType: post.type,
              matchEvent: post.matchEvent,
            }) && (
              <View style={styles.reactionRow}>
                <Pressable
                  onPress={handleHeia}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Heia"
                  style={({pressed}) => [
                    styles.reactPill,
                    post.iReacted && styles.reactPillOn,
                    pressed && styles.reactPillPressed,
                  ]}>
                  <Text
                    style={[
                      styles.reactText,
                      post.iReacted && styles.reactTextOn,
                    ]}>
                    👏{' '}
                    {(post.heiaCount ?? 0) > 0
                      ? `${post.heiaCount} heier`
                      : 'Heia'}
                  </Text>
                </Pressable>
              </View>
            )}
          </LiquidGlassSurface>
        )}

        {loading ? (
          <>
            {/* Innleggskortet + et par replikker — samme former som lastes. */}
            <LiquidGlassSurface style={styles.postCard}>
              <View style={styles.postHeader}>
                <Skeleton width={32} height={32} round />
                <View style={styles.skeletonHeaderText}>
                  <Skeleton width={120} height={13} />
                  <Skeleton width={64} height={10} />
                </View>
              </View>
              <Skeleton height={13} />
              <Skeleton width="60%" height={13} />
            </LiquidGlassSurface>
            <View style={styles.comment}>
              <Skeleton width={32} height={32} round />
              <View style={styles.skeletonBubbleWrap}>
                <Skeleton height={56} style={styles.skeletonBubble} />
              </View>
            </View>
            <View style={styles.comment}>
              <Skeleton width={32} height={32} round />
              <View style={styles.skeletonBubbleWrap}>
                <Skeleton height={56} style={styles.skeletonBubble} />
              </View>
            </View>
          </>
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : comments.length === 0 ? (
          <Text style={styles.empty}>
            Ingen kommentarer ennå. Vær den første!
          </Text>
        ) : (
          // NYESTE ØVERST (Brage 2026-09-03): composeren står i bunnen, så
          // det du nettopp sendte skal dukke opp rett under innlegget.
          // API-et leverer stigende; sorteringen bor her. Wrapperen måler
          // hvor seksjonen begynner (scroll-målet etter sending).
          <View
            style={styles.commentsSection}
            onLayout={e => {
              commentsTop.current = e.nativeEvent.layout.y;
            }}>
            {[...comments]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map(c => (
                <View key={c.id} style={styles.comment}>
                  <Avatar
                    name={c.author.name}
                    size="sm"
                    media={avatarRef(c.author.avatarPath)}
                    color={c.author.avatarColor}
                  />
                  {/* Boble per kommentar — uten flate fløt kommentarene rett på
                  kremen og så uferdige ut ved siden av innleggskortet. */}
                  <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentName}>{c.author.name}</Text>
                      <Text style={styles.commentTime}>
                        {timeAgo(c.createdAt)}
                      </Text>
                      <Pressable
                        onPress={() => handleCommentActions(c)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Flere valg"
                        style={({pressed}) => [
                          styles.more,
                          styles.commentMore,
                          pressed && styles.morePressed,
                        ]}>
                        <MoreHorizontal size={16} color={OPAL.inkTertiary} />
                      </Pressable>
                    </View>
                    <Text style={styles.commentText}>{c.content}</Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* DOKKEN — glass over lista, forankret i skjermbunnen. Løftes med
          native transform (keyboard.tsx) så hele raden følger tastaturet
          opp og ned i tastaturets egen bevegelse (forslagslinja inkludert).
          Safe area ligger i paddingen her og telles én gang (løftet
          trekker den fra). Send står UTENFOR lista, så første trykk
          treffer alltid. */}
      <Animated.View
        style={[styles.composeDock, {transform: [{translateY: lift}]}]}
        onLayout={e => setDockHeight(e.nativeEvent.layout.height)}>
        <LiquidGlassSurface
          cornerRadius={0}
          style={[
            styles.composeBar,
            {paddingBottom: insets.bottom + spacing.sm},
          ]}>
          {/* ⚠️ Ikke `editable={!sending}`: å slå av editable RESIGNERER
            feltet på iOS — tastaturet forsvant etter hver sending. Dobbel-
            sending stoppes i handleSend (`sending`-vakten). Return gir
            linjeskift (multiline); Send publiserer. Etter sending tømmes
            feltet og beholder fokus, for rask videre kommentering. */}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Skriv en kommentar…"
            placeholderTextColor={OPAL.inkTertiary}
            multiline
          />
          <Button
            title="Send"
            onPress={handleSend}
            disabled={text.trim().length === 0}
            loading={sending}
          />
        </LiquidGlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    flex: 1,
  },
  // Bak dokken, helt til skjermbunnen (native inset regner mot bunnen).
  list: {
    ...StyleSheet.absoluteFillObject,
  },
  composeDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  // Samme luft mellom kommentarene som lista ellers har.
  commentsSection: {
    gap: spacing.lg,
  },
  // Materialet (glass/opal) eies av LiquidGlassSurface — bare paddingen her.
  postCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  postHeaderText: {
    flex: 1,
    gap: 1,
  },
  postAuthor: {
    ...typography.body,
    fontWeight: '700',
  },
  postTime: {
    ...typography.caption,
    color: OPAL.inkTertiary,
  },
  postContent: {
    ...typography.body,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  reactionRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  // Samme pill-språk som FeedCard — aktiv 👏 = heiaTint + heiaInk.
  reactPill: {
    paddingHorizontal: spacing.md + 1,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17, 36, 27, 0.06)',
  },
  reactPillOn: {
    backgroundColor: colors.heiaTint,
  },
  reactPillPressed: {
    opacity: 0.7,
  },
  // Delt stemme — se `typography.action`.
  reactText: {...typography.action, color: OPAL.inkSecondary},
  reactTextOn: {
    color: colors.heiaInk,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  skeletonBubbleWrap: {
    flex: 1,
  },
  skeletonBubble: {
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
  },
  empty: {
    ...typography.body,
    color: OPAL.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  // Chat-hjørnet (lite radius oppe til venstre, mot avataren) gjør boblen til
  // en replikk, ikke et kort til.
  // Replikkene er IKKE glass (ett blur-lag per boble er dyrt i en lang tråd,
  // og lyse translusente flater skal ikke stables): lys frost uten blur på
  // grunnen, med lys kant — innlegget er hero, replikkene er samtale.
  commentBubble: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentName: {
    ...typography.body,
    fontWeight: '700',
  },
  commentTime: {
    ...typography.caption,
    color: OPAL.inkTertiary,
  },
  more: {
    padding: 2,
  },
  morePressed: {
    opacity: 0.5,
  },
  commentMore: {
    marginLeft: 'auto',
  },
  commentText: {
    ...typography.body,
    lineHeight: 22,
  },
  // Materialet eies av LiquidGlassSurface (cornerRadius 0).
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  input: {
    ...typography.input,
    flex: 1,
    color: colors.textPrimary,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    // Blekkvask i glasset, samme språk som reaksjonspillene.
    backgroundColor: 'rgba(17, 36, 27, 0.06)',
    borderRadius: radius.lg,
    textAlignVertical: 'top',
  },
});
