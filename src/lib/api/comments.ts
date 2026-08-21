import {supabase} from '../supabase';
import {type TeamAuthor} from './members';
import {fetchTeamAuthorsCached} from '../queries/members';
import {getUserId} from './authUser';
import {HEIA_EMOJI} from './feed';
import {primeMediaUrls} from '../media/resolver';
import type {
  FeedComment,
  FeedItem,
  MatchEventType,
} from '../../shared/types';

// profiles-RLS lar deg kun lese egen profil, så en direkte comments→profiles
// join gir ikke lagkameraters navn. Forfatterne hentes via get_team_authors
// (00067) og kobles klient-side. Authors, IKKE members: rosteret viser bare
// levende medlemmer, og en utmeldt forfatters kommentarer mistet navn og
// avatar (kjent hull, tettet i leave-skiva — frysdokumentets §2 sier at
// forfatterskap består).
//
// Via query-cachen (B2): getFeedPost + getComments kjører i parallell ved
// trådåpning og gjorde før to identiske RPC-kall — ensureQueryData deduper
// dem til ett, og et nylig besøk i tråden gjør begge gratis.
async function getMemberMap(
  teamSpaceId: string,
): Promise<Map<string, TeamAuthor>> {
  const authors = await fetchTeamAuthorsCached(teamSpaceId);
  return new Map(authors.map(m => [m.id, m]));
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
        // ⚠️ `match_events(...)` er med for P1-gaten: tråden VISER 👏-pillen,
        // og uten kampøyeblikket kunne man heie på et baklengsmål her selv om
        // feeden skjuler knappen — og basen ville avvist skrivingen
        // (`trg_no_heia_on_opponent_goal`, 00075). Embed via FK-en
        // `feed_posts.match_event_id`; ingen ekstra rundtur.
        .select(
          'id, author_id, type, content, created_at, event_id, is_pinned, match_events(type, team_side)',
        )
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
      avatarPath: member?.avatarPath,
      avatarColor: member?.avatarColor,
      role: member?.role,
    },
    createdAt: new Date(data.created_at),
    content: data.content,
    eventId: data.event_id ?? undefined,
    isPinned: data.is_pinned ?? false,
    heiaCount: reactions.length,
    iReacted: myId ? reactions.some(r => r.user_id === myId) : false,
  };

  // Samme form som `get_team_feed` gir feeden (00072), så `feedAllowsHeia`
  // stiller nøyaktig samme spørsmål begge steder.
  const me = (data as any).match_events as
    | {type?: string; team_side?: string | null}
    | null;
  if (me?.type) {
    post.matchEvent = {
      type: me.type as MatchEventType,
      teamSide: (me.team_side as 'home' | 'away' | null) ?? undefined,
    };
  }

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
        avatarPath: member?.avatarPath,
        avatarColor: member?.avatarColor,
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
