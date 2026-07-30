import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {Avatar, BackBar, Button} from '../components';
import {getComments, createComment, getFeedPost} from '../lib/api/comments';
import {toggleReaction} from '../lib/api/feed';
import type {FeedComment, FeedItem, HomeStackParamList} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Comments'>;

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

export function CommentsScreen({route}: Props) {
  const {postId, teamSpaceId} = route.params;
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
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
    setPost({
      ...post,
      iReacted: !wasReacted,
      heiaCount: Math.max(0, (post.heiaCount ?? 0) + (wasReacted ? -1 : 1)),
    });
    try {
      await toggleReaction(post.id, wasReacted);
    } catch {
      setPost(previous);
    } finally {
      heiaBusy.current = false;
    }
  }, [post]);

  const handleSend = useCallback(async () => {
    if (text.trim().length === 0 || sending) return;
    setSending(true);
    try {
      await createComment(postId, text);
      setText('');
      await load();
    } catch {
      Alert.alert('Kunne ikke sende', 'Prøv igjen om litt.');
    } finally {
      setSending(false);
    }
  }, [postId, text, sending, load]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar title="Kommentarer" />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}>
        {/* Innlegget tråden hører til — konteksten et varsel ikke gir. */}
        {post && (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar
                name={post.author.name}
                size="sm"
                uri={post.author.avatarUrl}
              />
              <View style={styles.postHeaderText}>
                <Text style={styles.postAuthor}>{post.author.name}</Text>
                <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
              </View>
            </View>
            {post.content.trim().length > 0 && (
              <Text style={styles.postContent}>{post.content}</Text>
            )}
            {post.imageUrl && (
              <Image
                source={{uri: post.imageUrl}}
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
            {/* Du står PÅ innlegget — da skal du også kunne heie på det.
                Samme pill-språk som FeedCard; aktiv 👏 er et Heia-øyeblikk. */}
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
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.heia} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : comments.length === 0 ? (
          <Text style={styles.empty}>
            Ingen kommentarer ennå. Vær den første!
          </Text>
        ) : (
          comments.map(c => (
            <View key={c.id} style={styles.comment}>
              <Avatar name={c.author.name} size="sm" uri={c.author.avatarUrl} />
              {/* Boble per kommentar — uten flate fløt kommentarene rett på
                  kremen og så uferdige ut ved siden av innleggskortet. */}
              <View style={styles.commentBubble}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentName}>{c.author.name}</Text>
                  <Text style={styles.commentTime}>
                    {timeAgo(c.createdAt)}
                  </Text>
                </View>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.composeBar, {paddingBottom: insets.bottom + spacing.sm}]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Skriv en kommentar…"
          placeholderTextColor={colors.textTertiary}
          multiline
          editable={!sending}
        />
        <Button
          title="Send"
          onPress={handleSend}
          disabled={text.trim().length === 0}
          loading={sending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    color: colors.textTertiary,
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
  reactText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reactTextOn: {
    color: colors.heiaInk,
  },
  loader: {
    marginTop: spacing.xl,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
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
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    color: colors.textTertiary,
  },
  commentText: {
    ...typography.body,
    lineHeight: 22,
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    textAlignVertical: 'top',
  },
});
