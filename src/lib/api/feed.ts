import {supabase} from '../supabase';
import type {FeedItem, UserRole} from '../../shared/types';

// Merkevare-reaksjonen: 👏 «Heia». Én emoji nå (utvides senere ved behov).
export const HEIA_EMOJI = '👏';

// get_team_feed() returnerer flate rader med author-info + aggregater.
// Vi mapper til eksisterende FeedItem så FeedCard er uendret.
// Media/matchEvent er utenfor scope for tekst-slicen (Fase 2b/3).
function mapFeedRow(row: any): FeedItem {
  const counts = (row.reaction_counts ?? {}) as Record<string, number>;
  return {
    id: row.id,
    teamSpaceId: row.team_space_id,
    // RPC kan returnere 'system'; FeedItem-unionen dekker det ikke, men
    // FeedCard faller da tilbake til vanlig melding-visning (ingen markør).
    type: row.type as FeedItem['type'],
    author: {
      id: row.author_id ?? '',
      name: row.author_name ?? 'Ukjent',
      avatarUrl: row.author_avatar ?? undefined,
      role: (row.author_role as UserRole) ?? undefined,
    },
    createdAt: new Date(row.created_at),
    content: row.content,
    eventId: row.event_id ?? undefined,
    heiaCount: counts[HEIA_EMOJI] ?? 0,
    commentCount: Number(row.comment_count ?? 0),
    iReacted: false, // fylles inn nedenfor fra egne reaksjoner
  };
}

/** Henter ekte lag-feed via get_team_feed RPC (nyeste først, pinned øverst). */
export async function getTeamFeed(
  teamSpaceId: string,
  limit = 20,
): Promise<FeedItem[]> {
  const {data, error} = await supabase.rpc('get_team_feed', {
    ts_id: teamSpaceId,
    lim: limit,
  });

  if (error) {
    throw error;
  }
  // team_space_id er ikke i RPC-radene — stemple fra argumentet.
  const items = (data || []).map((row: any) =>
    mapFeedRow({...row, team_space_id: teamSpaceId}),
  );

  // get_team_feed sier hvor mange som har reagert, men ikke om JEG har det.
  // Én ekstra spørring (RLS lar meg se lagets reaksjoner) markerer mine.
  if (items.length > 0) {
    const {
      data: {user},
    } = await supabase.auth.getUser();
    if (user) {
      const {data: mine} = await supabase
        .from('reactions')
        .select('feed_post_id')
        .eq('user_id', user.id)
        .eq('emoji', HEIA_EMOJI)
        .in(
          'feed_post_id',
          items.map((i: FeedItem) => i.id),
        );
      const reactedIds = new Set((mine || []).map((r: any) => r.feed_post_id));
      for (const item of items) {
        item.iReacted = reactedIds.has(item.id);
      }
    }
  }

  return items;
}

/**
 * Toggle 👏 «Heia» på en post. currentlyReacted styrer retningen
 * (kalleren kjenner tilstanden fra feed-dataen), så vi slipper en
 * ekstra rundtur. RLS: insert krever user_id = auth.uid() + medlemskap;
 * delete kun egne rader.
 */
export async function toggleReaction(
  postId: string,
  currentlyReacted: boolean,
): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  if (currentlyReacted) {
    const {error} = await supabase
      .from('reactions')
      .delete()
      .eq('feed_post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', HEIA_EMOJI);
    if (error) {
      throw error;
    }
  } else {
    const {error} = await supabase.from('reactions').insert({
      feed_post_id: postId,
      user_id: user.id,
      emoji: HEIA_EMOJI,
    });
    if (error) {
      throw error;
    }
  }
}

/**
 * Enkleste ekte tekstpost: direkte insert i feed_posts.
 * RLS krever author_id = auth.uid() og medlemskap i laget.
 */
export async function createTextPost(
  teamSpaceId: string,
  content: string,
): Promise<void> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Tom melding');
  }

  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {error} = await supabase.from('feed_posts').insert({
    team_space_id: teamSpaceId,
    author_id: user.id,
    type: 'melding',
    content: trimmed,
  });

  if (error) {
    throw error;
  }
}
