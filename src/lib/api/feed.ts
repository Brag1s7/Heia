import {supabase} from '../supabase';
import {MATCH_STATUS_MAP} from './events';
import {getUserId, getUserIdOrNull} from './authUser';
import {acquireChannel, isChannelResync} from '../realtimeChannels';
import {
  FEED_MEDIA_BUCKET,
  invalidateMediaCache,
  primeMediaUrls,
} from '../media/resolver';
import {uploadFileToBucket} from '../media/upload';
import type {MediaRef} from '../media/types';
import type {FeedItem, UserRole} from '../../shared/types';

// Merkevare-reaksjonen: 👏 «Heia». Én emoji nå (utvides senere ved behov).
export const HEIA_EMOJI = '👏';

// Bucketen bor hos resolveren (P4) — re-eksportert for upload-stien her.
export {FEED_MEDIA_BUCKET};

/** Bilde valgt fra image-picker, klart for opplasting. */
export interface ImagePostInput {
  /** Lokal fil-URI til 2048-masteren fra pickeren (P2). */
  fileUri: string;
  /**
   * Lokal fil-URI til 480-thumben (compressor, B1). `null` = genereringen
   * feilet — posten lastes opp uten, og visningen leser masteren (P4).
   */
  thumbUri: string | null;
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
 * Laster opp ETT bilde (master + ev. thumb) til privat Storage og oppretter
 * media-raden. Returnerer `media.id`, som kallstedet fester på sin egen
 * entitet.
 *
 * Delt av vanlige bildeposter og kampbilder. B1: begge variantene streames
 * fra fil via uploadAsync (media/upload.ts) — base64-brua er borte.
 * Navnekonvensjonen (`-d2048`/`-t480`) er backfill-scriptets, så nye
 * opplastinger er selvbeskrivende og hoppes over av en ev. re-kjøring.
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
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${teamSpaceId}/${base}-d2048.${ext}`;

  // 24 t (P1, LÅST): en CDN-/OS-cachet kopi av et barnebilde skal ikke
  // overleve tilgangsvinduet (24 t signert URL) vesentlig, og Free-CDN
  // invaliderer ikke ved sletting. KAN IKKE endres per objekt i
  // etterkant — må være riktig ved upload.
  await uploadFileToBucket({
    bucket: FEED_MEDIA_BUCKET,
    path: storagePath,
    fileUri: image.fileUri,
    contentType: image.mimeType,
    cacheControlS: 86400,
  });

  // Thumben er en optimalisering, aldri en blokker: feiler den, får raden
  // thumbnail_path null og thumb-oppslagene leser masteren (mediaPathFor).
  let thumbnailPath: string | null = null;
  if (image.thumbUri) {
    const thumbPath = `${teamSpaceId}/${base}-t480.jpg`;
    try {
      await uploadFileToBucket({
        bucket: FEED_MEDIA_BUCKET,
        path: thumbPath,
        fileUri: image.thumbUri,
        // Compressor leverer alltid JPEG (output: 'jpg' i makeThumb).
        contentType: 'image/jpeg',
        cacheControlS: 86400,
      });
      thumbnailPath = thumbPath;
    } catch {
      // Foreldreløs fil kan ikke oppstå her: thumben lastes bare opp
      // ETTER at masteren lyktes, og feiler selve thumben finnes ingen fil.
    }
  }

  const {data: mediaRow, error: mediaError} = await supabase
    .from('media')
    .insert({
      uploaded_by: userId,
      team_space_id: teamSpaceId,
      bucket: FEED_MEDIA_BUCKET,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
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
 * Henter ÉN side av lag-feeden via get_team_feed RPC (nyeste først, pinned
 * øverst). `myUserId` kommer fra kallerens context (P5) — feeden er den
 * varmeste lesestien, og skal ikke betale en auth-rundtur for å vite hvem
 * du er.
 *
 * `cursor` (B2) er keyset-parameteren RPC-en har hatt siden 00029: kun rader
 * med `created_at < cursor`. Cursor-VALGET og pinned-fellene bor i
 * `shared/feedPaging` — dette laget sender bare verdien videre.
 */
export async function getTeamFeed(
  teamSpaceId: string,
  myUserId?: string,
  limit = 20,
  cursor?: string,
): Promise<FeedItem[]> {
  const {data, error} = await supabase.rpc('get_team_feed', {
    ts_id: teamSpaceId,
    lim: limit,
    // Utelates på første side — RPC-ens DEFAULT NULL betyr «fra toppen».
    ...(cursor ? {cursor} : {}),
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
    // Begge slette-inngangene (feed og kommentartråd) passerer her (P1):
    // de cachede URL-ene skal ikke overleve objektene de peker på.
    invalidateMediaCache(paths);
    await supabase.storage.from(FEED_MEDIA_BUCKET).remove(paths);
  }
}

/**
 * Klassifiserte feed-hendelser (B3, P6-tabellen): api-laget oversetter rå
 * postgres_changes-payloads til hendelser skjermen kan applisere rett i
 * query-cachen — transporten (postgres_changes i dag, Broadcast i C) forblir
 * usynlig for kalleren.
 *
 * `fallback` er P6s sikkerhetsnett: payloaden manglet felter vi trenger
 * (skjemadrift, replica identity rullet tilbake) → kalleren skal debounced
 * refetche i stedet for å applisere noe galt. `resync` = kanalen har vært
 * nede (reconnect) → hendelser kan være tapt, full refetch.
 */
export type FeedRealtimeEvent =
  | {kind: 'postNew'}
  | {kind: 'postUpdate'; row: any}
  | {kind: 'reaction'; postId: string; delta: 1 | -1}
  | {kind: 'commentDelta'; postId: string; delta: 1 | -1}
  | {kind: 'fallback'}
  | {kind: 'resync'};

/**
 * Live feed, payload-først (P6): reaksjoner og kommentarer justerer tellere
 * lokalt, post-endringer patcher/fjerner posten, og kun et NYTT innlegg
 * koster en (side 1-)refetch hos kalleren — feeden må uansett sorteres og
 * forfatter-joines, så payloaden alene kan ikke bygge raden.
 *
 * `myUserId` filtrerer bort egne reaksjons-ekko: de er alt applisert
 * optimistisk, og et ekko ville talt dobbelt. Kommentarer har IKKE eget
 * filter — CommentsScreen patcher via api-kallet, og mens den er åpen er
 * TeamHome blurret (kanalen nede), så ekkoet kan aldri treffe cachen dobbelt.
 *
 * `reactions`/`comments` har ingen team_space_id å filtrere på, så vi
 * abonnerer ufiltrert. Det er trygt: RLS slipper kun gjennom rader du
 * uansett kunne lest — og patchingen er en no-op for poster utenfor cachen.
 * DELETE på reactions krever REPLICA IDENTITY FULL (00059) for at old-raden
 * skal ha feed_post_id/user_id — mangler de, faller vi tilbake.
 */
export function subscribeToFeed(
  teamSpaceId: string,
  myUserId: string | undefined,
  onEvent: (event: FeedRealtimeEvent) => void,
): () => void {
  const classifyReaction = (
    row: any,
    delta: 1 | -1,
  ): FeedRealtimeEvent | null => {
    if (!row?.feed_post_id) {
      return {kind: 'fallback'};
    }
    if (row.user_id === myUserId || row.emoji !== HEIA_EMOJI) {
      return null; // eget ekko / annen emoji enn 👏-telleren
    }
    return {kind: 'reaction', postId: row.feed_post_id, delta};
  };

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
          payload => {
            const p = payload as any;
            if (p.eventType === 'INSERT') {
              // En INSERT som alt er soft-slettet finnes ikke i praksis —
              // men den skal i så fall ikke koste en refetch.
              if (!p.new?.deleted_at) emit({kind: 'postNew'});
            } else if (p.eventType === 'UPDATE') {
              emit(
                p.new?.id
                  ? {kind: 'postUpdate', row: p.new}
                  : {kind: 'fallback'},
              );
            }
            // Hard DELETE skjer ikke i appflyten (soft_delete_post er UPDATE)
            // — og filteret på team_space_id matcher uansett ikke old-raden.
          },
        )
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'reactions'},
          payload => {
            const p = payload as any;
            const evt =
              p.eventType === 'INSERT'
                ? classifyReaction(p.new, 1)
                : p.eventType === 'DELETE'
                ? classifyReaction(p.old, -1)
                : null;
            if (evt) emit(evt);
          },
        )
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'comments'},
          payload => {
            const p = payload as any;
            if (p.eventType === 'INSERT') {
              emit(
                p.new?.feed_post_id
                  ? {
                      kind: 'commentDelta',
                      postId: p.new.feed_post_id,
                      delta: 1,
                    }
                  : {kind: 'fallback'},
              );
            } else if (p.eventType === 'UPDATE' && p.new?.deleted_at) {
              // Soft-delete (00041). RPC-en er idempotent-gardert, så det
              // kommer nøyaktig én slik UPDATE per sletting; en REDIGERING
              // har deleted_at null og skal ikke røre telleren.
              emit(
                p.new?.feed_post_id
                  ? {
                      kind: 'commentDelta',
                      postId: p.new.feed_post_id,
                      delta: -1,
                    }
                  : {kind: 'fallback'},
              );
            }
          },
        );
    },
    payload => {
      if (isChannelResync(payload)) {
        onEvent({kind: 'resync'});
      } else {
        onEvent(payload as FeedRealtimeEvent);
      }
    },
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

  const photos = rows.map(r => ({
    id: r.post_id as string,
    media: {
      path: r.storage_path as string,
      // 00061. Mangler den (eldre opplastinger før B1-thumbs, eller RPC-en
      // fra 00028 mot en gammel klient) faller thumb-varianten til path.
      thumbPath: (r.thumbnail_path as string | null) ?? null,
    },
    caption: (r.content as string) || undefined,
    authorName: (r.author_name as string) ?? 'Ukjent',
    authorAvatarUrl: (r.author_avatar as string) ?? undefined,
    createdAt: new Date(r.created_at),
    matchEventId: (r.match_event_id as string) ?? undefined,
  }));

  // Én oppvarmingsbatch (P4) for begge variantene — kampforløpet og railen
  // leser thumb, galleriet display. MediaImage treffer cachen for begge.
  const paths: string[] = [];
  for (const photo of photos) {
    paths.push(photo.media.path);
    if (photo.media.thumbPath) paths.push(photo.media.thumbPath);
  }
  await primeMediaUrls(paths);

  return photos;
}
