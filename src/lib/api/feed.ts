import {decode} from 'base64-arraybuffer';
import {supabase} from '../supabase';
import {MATCH_STATUS_MAP} from './events';
import {getUserId, getUserIdOrNull} from './authUser';
import {acquireChannel} from '../realtimeChannels';
import {FEED_MEDIA_BUCKET, primeMediaUrls} from '../media/resolver';
import type {MediaRef} from '../media/types';
import type {FeedItem, UserRole} from '../../shared/types';

// Merkevare-reaksjonen: 👏 «Heia». Én emoji nå (utvides senere ved behov).
export const HEIA_EMOJI = '👏';

// Bucketen bor hos resolveren (P4) — re-eksportert for upload-stien her.
export {FEED_MEDIA_BUCKET};

/** Bilde valgt fra image-picker, klart for opplasting. */
export interface ImagePostInput {
  base64: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

/** Et bilde som hører til en kamp, klart til visning. */
export interface MatchPhoto {
  id: string;
  media: MediaRef;
  caption?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: Date;
  /** Satt når bildet hører til ett bestemt øyeblikk, f.eks. 1–0-målet. */
  matchEventId?: string;
}

/**
 * Laster opp ETT bilde til privat Storage og oppretter media-raden.
 * Returnerer `media.id`, som kallstedet fester på sin egen entitet.
 *
 * Delt av vanlige bildeposter og kampbilder — RN-fella (base64 → ArrayBuffer,
 * ALDRI fil-URI rett inn i `.upload()`) skal bo nøyaktig ett sted.
 */
async function uploadTeamImage(
  teamSpaceId: string,
  image: ImagePostInput,
  userId: string,
): Promise<string> {
  // Path: {team_space_id}/{unikt filnavn}. Første segment må være
  // team_space_id — storage-policyene gates på det.
  const ext = image.fileName.includes('.')
    ? image.fileName.split('.').pop()
    : 'jpg';
  const objectName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;
  const storagePath = `${teamSpaceId}/${objectName}`;

  const {error: uploadError} = await supabase.storage
    .from(FEED_MEDIA_BUCKET)
    .upload(storagePath, decode(image.base64), {
      contentType: image.mimeType,
      upsert: false,
      // 24 t (P1, LÅST): en CDN-/OS-cachet kopi av et barnebilde skal ikke
      // overleve tilgangsvinduet (24 t signert URL) vesentlig, og Free-CDN
      // invaliderer ikke ved sletting. KAN IKKE endres per objekt i
      // etterkant — må være riktig ved upload.
      cacheControl: '86400',
    });
  if (uploadError) {
    throw uploadError;
  }

  const {data: mediaRow, error: mediaError} = await supabase
    .from('media')
    .insert({
      uploaded_by: userId,
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

  return mediaRow.id as string;
}

// get_team_feed() returnerer flate rader med author-info + aggregater.
// Vi mapper til eksisterende FeedItem så FeedCard er uendret.
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
    // Kampkontekst (00029): status/stilling for kampen posten hører til,
    // + minuttet når posten er en konkret kamphendelse.
    match: row.match_status
      ? {
          minute: row.match_minute ?? undefined,
          status: MATCH_STATUS_MAP[row.match_status as string] ?? 'upcoming',
          home: Number(row.match_home ?? 0),
          away: Number(row.match_away ?? 0),
        }
      : undefined,
    eventId: row.event_id ?? undefined,
    isPinned: row.is_pinned ?? false,
    heiaCount: counts[HEIA_EMOJI] ?? 0,
    commentCount: Number(row.comment_count ?? 0),
    iReacted: false, // fylles inn nedenfor fra egne reaksjoner
  };
}

/**
 * Henter ekte lag-feed via get_team_feed RPC (nyeste først, pinned øverst).
 * `myUserId` kommer fra kallerens context (P5) — feeden er den varmeste
 * lesestien, og skal ikke betale en auth-rundtur for å vite hvem du er.
 */
export async function getTeamFeed(
  teamSpaceId: string,
  myUserId?: string,
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

  // Bilde-poster: media[] (jsonb fra RPC) → MediaRef (P4). UI-et får path,
  // aldri URL — men URL-ene varmes opp HER, i ÉN batch per skjermlast, så
  // MediaImage treffer cachen i stedet for å signere per bilde.
  const paths: string[] = [];
  rows.forEach((r: any, i: number) => {
    const media = (r.media ?? []) as any[];
    if (media.length === 0) return;
    const ref: MediaRef = {
      path: media[0].storage_path as string,
      thumbPath: (media[0].thumbnail_path as string | null) ?? null,
    };
    items[i].media = ref;
    paths.push(ref.path);
    if (ref.thumbPath) paths.push(ref.thumbPath);
  });
  if (paths.length > 0) {
    await primeMediaUrls(paths);
  }

  // get_team_feed sier hvor mange som har reagert, men ikke om JEG har det.
  // Én ekstra spørring (RLS lar meg se lagets reaksjoner) markerer mine.
  if (items.length > 0) {
    const userId = myUserId ?? (await getUserIdOrNull());
    if (userId) {
      const {data: mine} = await supabase
        .from('reactions')
        .select('feed_post_id')
        .eq('user_id', userId)
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
 * Løsner en festet post fra toppen av feeden.
 *
 * RLS: «Authors can update own posts» + «Admins can moderate posts» (00014),
 * så trener/lagleder kan løsne også andres. Å sette is_pinned = false er
 * alltid lov — `enforce_pin_is_admin` (00024) vokter kun veien INN i festet
 * tilstand. `.select('id')` fordi RLS-avslag gir null rader uten feil.
 */
export async function unpinPost(postId: string): Promise<void> {
  const {data, error} = await supabase
    .from('feed_posts')
    .update({is_pinned: false})
    .eq('id', postId)
    .select('id');

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Du har ikke tilgang til å løsne denne posten');
  }
}

/**
 * Sletter et innlegg (soft delete). RPC-en `soft_delete_post` (00041) slipper
 * gjennom forfatteren og trener/lagleder — og er en RPC fordi en soft-slettet
 * rad ikke lenger passerer SELECT-policyen, så et vanlig
 * `UPDATE … RETURNING` ikke kunne skilt suksess fra RLS-avslag.
 *
 * RPC-en returnerer storage-pathene til postens bilder; selve filene fjernes
 * best-effort etterpå. Feiler det er bildet uansett usynlig (media-raden er
 * soft-slettet) — opprydding av foreldreløse filer er en ops-jobb.
 */
export async function deletePost(postId: string): Promise<void> {
  const {data, error} = await supabase.rpc('soft_delete_post', {
    p_post_id: postId,
  });
  if (error) {
    throw error;
  }
  const paths = (data ?? []) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(FEED_MEDIA_BUCKET).remove(paths);
  }
}

/**
 * Live feed: kaller onChange ved nytt innlegg, reaksjon eller kommentar.
 *
 * Kalleren REFETCHER i stedet for å flette inn payloaden — feeden må uansett
 * sorteres (pinnet øverst). Bilde-URL-ene gjenbrukes fra resolver-cachen
 * (P1), så en refetch koster data, aldri bildebytes.
 *
 * `reactions`/`comments` har ingen team_space_id å filtrere på, så vi
 * abonnerer ufiltrert. Det er trygt: RLS slipper kun gjennom rader du
 * uansett kunne lest, altså poster i dine egne lag.
 */
export function subscribeToFeed(
  teamSpaceId: string,
  onChange: () => void,
): () => void {
  return acquireChannel(
    `feed:${teamSpaceId}`,
    (channel, emit) => {
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'feed_posts',
            filter: `team_space_id=eq.${teamSpaceId}`,
          },
          emit,
        )
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'reactions'},
          emit,
        )
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'comments'},
          emit,
        );
    },
    () => onChange(),
  );
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
  const userId = await getUserId();

  if (currentlyReacted) {
    const {error} = await supabase
      .from('reactions')
      .delete()
      .eq('feed_post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', HEIA_EMOJI);
    if (error) {
      throw error;
    }
  } else {
    const {error} = await supabase.from('reactions').insert({
      feed_post_id: postId,
      user_id: userId,
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
 *
 * `pinned` = «Varsle hele laget»: posten festes øverst i feeden OG utløser
 * et admin_message-varsel (00024). Vanlige poster varsler ikke. Databasen
 * avviser pinning fra andre enn trener/lagleder, så UI-et er ikke vakten.
 */
export async function createTextPost(
  teamSpaceId: string,
  content: string,
  pinned = false,
): Promise<void> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Tom melding');
  }

  const userId = await getUserId();

  const {error} = await supabase.from('feed_posts').insert({
    team_space_id: teamSpaceId,
    author_id: userId,
    type: 'melding',
    content: trimmed,
    is_pinned: pinned,
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
  pinned = false,
  eventId,
  matchEventId,
}: {
  teamSpaceId: string;
  content: string;
  image: ImagePostInput;
  pinned?: boolean;
  /** Setter posten som en hendelses/kamps eget bilde. */
  eventId?: string;
  /** Fester bildet til ett øyeblikk i kampen. Krever `eventId`. */
  matchEventId?: string;
}): Promise<void> {
  const userId = await getUserId();

  const trimmed = content.trim();

  const mediaId = await uploadTeamImage(teamSpaceId, image, userId);

  const {data: postRow, error: postError} = await supabase
    .from('feed_posts')
    .insert({
      team_space_id: teamSpaceId,
      author_id: userId,
      type: 'bilde',
      content: trimmed,
      is_pinned: pinned,
      event_id: eventId ?? null,
      // Uten en kamp gir øyeblikket ingen mening — da lar vi den stå tom
      // heller enn å lagre en peker som ikke kan leses tilbake.
      match_event_id: eventId ? matchEventId ?? null : null,
    })
    .select('id')
    .single();
  if (postError) {
    throw postError;
  }

  const {error: attachError} = await supabase
    .from('media_attachments')
    .insert({
      media_id: mediaId,
      entity_type: 'feed_post',
      entity_id: postRow.id,
      sort_order: 0,
    });
  if (attachError) {
    throw attachError;
  }
}

/**
 * Kampbilder: bildeposter som er knyttet til hendelsen, eldste først, med
 * signerte URL-er. Se `get_match_photos` (00028) for hvorfor dette er en RPC
 * og ikke et nested select.
 */
export async function getMatchPhotos(eventId: string): Promise<MatchPhoto[]> {
  const {data, error} = await supabase.rpc('get_match_photos', {
    evt_id: eventId,
  });
  if (error) {
    throw error;
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) return [];

  // Én oppvarmingsbatch (P4) — MediaImage leser fra cachen. RPC-en (00028)
  // returnerer ikke thumbnail_path; thumb-varianten faller tilbake til path.
  await primeMediaUrls(rows.map(r => r.storage_path as string));

  return rows.map(r => ({
    id: r.post_id as string,
    media: {path: r.storage_path as string},
    caption: (r.content as string) || undefined,
    authorName: (r.author_name as string) ?? 'Ukjent',
    authorAvatarUrl: (r.author_avatar as string) ?? undefined,
    createdAt: new Date(r.created_at),
    matchEventId: (r.match_event_id as string) ?? undefined,
  }));
}
