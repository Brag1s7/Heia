import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
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
import {Avatar, Button} from '../components';
import {getComments, createComment} from '../lib/api/comments';
import type {FeedComment, HomeStackParamList} from '../shared/types';

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

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setComments(await getComments(teamSpaceId, postId));
    } catch (e) {
      setError('Kunne ikke laste kommentarer.');
    } finally {
      setLoading(false);
    }
  }, [teamSpaceId, postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = useCallback(async () => {
    if (text.trim().length === 0 || sending) return;
    setSending(true);
    try {
      await createComment(postId, text);
      setText('');
      await load();
    } catch (e) {
      Alert.alert('Kunne ikke sende', 'Prøv igjen om litt.');
    } finally {
      setSending(false);
    }
  }, [postId, text, sending, load]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}>
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
              <View style={styles.commentBody}>
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
    gap: spacing.md,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentName: {
    ...typography.body,
    fontWeight: '600',
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
    ...typography.body,
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
