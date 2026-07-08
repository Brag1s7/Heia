import {decode} from 'base64-arraybuffer';
import {supabase} from '../supabase';
import type {FeedItem, UserRole} from '../../shared/types';

// Merkevare-reaksjonen: 👏 «Heia». Én emoji nå (utvides senere ved behov).
export const HEIA_EMOJI = '👏';

// Privat Storage-bucket for feed-bilder. Path-konvensjon: {team_space_id}/{filnavn}.
// Privat fordi bilder kan være av barn — vi signerer URL-er ved lesing.
export const FEED_MEDIA_BUCKET = 'feed-media';

// Signerte URL-er utløper — greit, fordi feeden refetches.
const SIGNED_URL_TTL = 60 * 60; // 1 time

/** Bilde valgt fra image-picker, klart for opplasting. */
export interface ImagePostInput {
  base64: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

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
  const rows = (data || []) as any[];
  const items = rows.map((row: any) =>
    mapFeedRow({...row, team_space_id: teamSpaceId}),
  );

  // Bilde-poster: media[] (jsonb fra RPC) → signert URL. Privat bucket,
  // så vi signerer i én batch og mapper tilbake på storage_path.
  const pathByIndex = rows.map((r: any) => {
    const media = (r.media ?? []) as any[];
    return media.length > 0 ? (media[0].storage_path as string) : null;
  });
  const paths = pathByIndex.filter((p): p is string => p !== null);
  if (paths.length > 0) {
    const {data: signed} = await supabase.storage
      .from(FEED_MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const urlByPath = new Map<string, string>();
    for (const s of signed || []) {
      if (s.signedUrl && !s.error && s.path) {
        urlByPath.set(s.path, s.signedUrl);
      }
    }
    items.forEach((item: FeedItem, i: number) => {
      const p = pathByIndex[i];
      if (p) {
        item.imageUrl = urlByPath.get(p);
      }
    });
  }

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

/**
 * Bildepost: last opp ETT bilde til privat Storage, opprett media-rad,
 * feed_post (type 'bilde') og media_attachments-koblingen.
 *
 * V1 er IKKE atomisk: upload + de tre insertene skjer i tur. Feiler noe
 * midtveis kan det bli en foreldreløs fil/media-rad. Akseptert nå;
 * atomisk RPC + opprydding utsettes. Tekst er valgfri (kolonnen er
 * NOT NULL uten lengdekrav, så tom post lagres som '').
 */
export async function createImagePost({
  teamSpaceId,
  content,
  image,
}: {
  teamSpaceId: string;
  content: string;
  image: ImagePostInput;
}): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const trimmed = content.trim();

  // Path: {team_space_id}/{unikt filnavn}. Første segment må være
  // team_space_id — storage-policyene gates på det.
  const ext = image.fileName.includes('.')
    ? image.fileName.split('.').pop()
    : 'jpg';
  const objectName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;
  const storagePath = `${teamSpaceId}/${objectName}`;

  // RN: base64 → ArrayBuffer. IKKE fil-URI direkte i .upload().
  const {error: uploadError} = await supabase.storage
    .from(FEED_MEDIA_BUCKET)
    .upload(storagePath, decode(image.base64), {
      contentType: image.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw uploadError;
  }

  const {data: mediaRow, error: mediaError} = await supabase
    .from('media')
    .insert({
      uploaded_by: user.id,
      team_space_id: teamSpaceId,
      bucket: FEED_MEDIA_BUCKET,
      storage_path: storagePath,
      file_name: image.fileName,
      mime_type: image.mimeType,
      size_bytes: image.sizeBytes,
      width: image.width ?? null,
      height: image.height ?? null,
    })
    .select('id')
    .single();
  if (mediaError) {
    throw mediaError;
  }

  const {data: postRow, error: postError} = await supabase
    .from('feed_posts')
    .insert({
      team_space_id: teamSpaceId,
      author_id: user.id,
      type: 'bilde',
      content: trimmed,
    })
    .select('id')
    .single();
  if (postError) {
    throw postError;
  }

  const {error: attachError} = await supabase
    .from('media_attachments')
    .insert({
      media_id: mediaRow.id,
      entity_type: 'feed_post',
      entity_id: postRow.id,
      sort_order: 0,
    });
  if (attachError) {
    throw attachError;
  }
}
