import {supabase} from '../supabase';
import type {FeedItem, UserRole} from '../../shared/types';

// get_team_feed() returnerer flate rader med author-info + aggregater.
// Vi mapper til eksisterende FeedItem så FeedCard er uendret.
// Media/matchEvent er utenfor scope for tekst-slicen (Fase 2b/3).
function mapFeedRow(row: any): FeedItem {
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
  return (data || []).map((row: any) =>
    mapFeedRow({...row, team_space_id: teamSpaceId}),
  );
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
