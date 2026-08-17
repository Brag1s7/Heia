import {supabase} from '../supabase';
import {type TeamMember} from './members';
import {fetchTeamMembersCached} from '../queries/members';
import {getUserId} from './authUser';
import {HEIA_EMOJI} from './feed';
import {primeMediaUrls} from '../media/resolver';
import type {FeedComment, FeedItem} from '../../shared/types';

// profiles-RLS lar deg kun lese egen profil, så en direkte comments→profiles
// join gir ikke lagkameraters navn. Vi henter hele laget via get_team_members
// og kobler forfatter klient-side.
//
// Via query-cachen (B2): getFeedPost + getComments kjører i parallell ved
// trådåpning og gjorde før to identiske RPC-kall — ensureQueryData deduper
// dem til ett, og et nylig besøk på laget gjør begge gratis.
async function getMemberMap(
  teamSpaceId: string,
): Promise<Map<string, TeamMember>> {
  const members = await fetchTeamMembersCached(teamSpaceId);
  return new Map(members.map(m => [m.id, m]));
}

/**
 * Selve innlegget en tråd hører til.
 *
 * Trenges fordi et varsel («Kari heiet på …») lander deg her uten kontekst —
 * og for en reaksjon er tråden gjerne helt tom, så skjermen ville vært en
 * blindvei uten posten øverst.
 *
 * Direkte select (RLS: «Members can view feed»), forfatter via medlems-mappet
 * som resten av fila. `media_attachments` er polymorf (entity_type/entity_id),
 * så den kan ikke embeddes av PostgREST — bildet hentes i et eget kall.
 */
export async function getFeedPost(
  teamSpaceId: string,
  postId: string,
): Promise<FeedItem | null> {
  const [memberMap, {data, error}, reactionsResult, sessionResult] =
    await Promise.all([
      getMemberMap(teamSpaceId),
      supabase
        .from('feed_posts')
        .select('id, author_id, type, content, created_at, event_id, is_pinned')
        .eq('id', postId)
        .is('deleted_at', null)
        .maybeSingle(),
      // 👏-ene hydreres her fordi tråden VISER innlegget — uten dem kunne man
      // stå på posten uten å se applausen eller delta i den.
      supabase
        .from('reactions')
        .select('user_id')
        .eq('feed_post_id', postId)
        .eq('emoji', HEIA_EMOJI),
      supabase.auth.getSession(),
    ]);

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const reactions = reactionsResult.data ?? [];
  const myId = sessionResult.data.session?.user.id;

  const member = data.author_id ? memberMap.get(data.author_id) : undefined;
  const post: FeedItem = {
    id: data.id,
    teamSpaceId,
    type: data.type as FeedItem['type'],
    author: {
      id: data.author_id ?? '',
      name: member?.name ?? 'Medlem',
      avatarUrl: member?.avatarUrl,
      role: member?.role,
    },
    createdAt: new Date(data.created_at),
    content: data.content,
    eventId: data.event_id ?? undefined,
    isPinned: data.is_pinned ?? false,
    heiaCount: reactions.length,
    iReacted: myId ? reactions.some(r => r.user_id === myId) : false,
  };

  const {data: attachments} = await supabase
    .from('media_attachments')
    .select('media(storage_path, thumbnail_path)')
    .eq('entity_type', 'feed_post')
    .eq('entity_id', postId)
    .order('sort_order', {ascending: true})
    .limit(1);

  const attachedMedia = (attachments?.[0] as any)?.media;
  if (attachedMedia?.storage_path) {
    post.media = {
      path: attachedMedia.storage_path as string,
      thumbPath: (attachedMedia.thumbnail_path as string | null) ?? null,
    };
    // Kom du hit fra feeden er URL-en alt varm (samme path, samme cache —
    // det er F6-fiksen); fra et varsel signerer prime én gang.
    await primeMediaUrls([post.media.path]);
  }

  return post;
}

/** Kommentarer på en post (eldste først), med forfatter fra medlems-mappet. */
export async function getComments(
  teamSpaceId: string,
  postId: string,
): Promise<FeedComment[]> {
  const [memberMap, {data, error}] = await Promise.all([
    getMemberMap(teamSpaceId),
    supabase
      .from('comments')
      .select('id, author_id, content, created_at')
      .eq('feed_post_id', postId)
      .is('deleted_at', null)
      .order('created_at', {ascending: true}),
  ]);

  if (error) {
    throw error;
  }

  return (data || []).map((row: any) => {
    const member = row.author_id ? memberMap.get(row.author_id) : undefined;
    return {
      id: row.id,
      author: {
        id: row.author_id ?? '',
        name: member?.name ?? 'Medlem',
        avatarUrl: member?.avatarUrl,
        role: member?.role,
      },
      createdAt: new Date(row.created_at),
      content: row.content,
    };
  });
}

/** Enkleste ekte kommentar: direkte insert. RLS: author_id = auth.uid(). */
export async function createComment(
  postId: string,
  content: string,
): Promise<void> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Tom kommentar');
  }

  const userId = await getUserId();

  const {error} = await supabase.from('comments').insert({
    feed_post_id: postId,
    author_id: userId,
    content: trimmed,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sletter en kommentar (soft delete). RPC-en `soft_delete_comment` (00041)
 * slipper gjennom forfatteren og trener/lagleder — se `deletePost` for
 * hvorfor dette er en RPC og ikke en direkte UPDATE.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const {error} = await supabase.rpc('soft_delete_comment', {
    p_comment_id: commentId,
  });
  if (error) {
    throw error;
  }
}
