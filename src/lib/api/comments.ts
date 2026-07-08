import {supabase} from '../supabase';
import type {FeedComment, UserRole} from '../../shared/types';

type MemberInfo = {name: string; avatarUrl?: string; role?: UserRole};

// profiles-RLS lar deg kun lese egen profil, så en direkte comments→profiles
// join gir ikke lagkameraters navn. get_team_members (SECURITY DEFINER) gir
// navn/avatar/rolle for hele laget — vi kobler forfatter klient-side.
async function getMemberMap(
  teamSpaceId: string,
): Promise<Map<string, MemberInfo>> {
  const {data, error} = await supabase.rpc('get_team_members', {
    ts_id: teamSpaceId,
  });
  if (error) {
    throw error;
  }
  const map = new Map<string, MemberInfo>();
  for (const row of data || []) {
    map.set(row.user_id, {
      name: row.display_name ?? 'Medlem',
      avatarUrl: row.avatar_url ?? undefined,
      role: (row.role as UserRole) ?? undefined,
    });
  }
  return map;
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

  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {error} = await supabase.from('comments').insert({
    feed_post_id: postId,
    author_id: user.id,
    content: trimmed,
  });

  if (error) {
    throw error;
  }
}
