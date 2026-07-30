-- ============================================================
-- 00029: get_team_feed bærer kampkontekst
--
-- Kampchipen i feeden («kampen bor alltid på mørk flate») sto uten
-- stilling og minutt fordi RPC-en aldri returnerte dem — kjent hull
-- fra Fase 8. Nå joines match_events (minutt for akkurat denne
-- posten) og match_sessions (status + stilling for kampen).
--
-- match_sessions.event_id er UNIQUE (00009), så joinen er 1:1.
-- Returtypen endres → DROP + CREATE (samme mønster som 00027).
-- Ingen eksplisitte GRANTs fantes på originalen (00015) — default
-- privileges dekker execute, som før.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_team_feed(uuid, int, timestamptz);

CREATE FUNCTION public.get_team_feed(
  ts_id  uuid,
  lim    int DEFAULT 20,
  cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  type            text,
  content         text,
  is_pinned       boolean,
  created_at      timestamptz,
  event_id        uuid,
  match_event_id  uuid,
  author_id       uuid,
  author_name     text,
  author_avatar   text,
  author_role     text,
  comment_count   bigint,
  reaction_counts jsonb,
  media           jsonb,
  -- Nytt: kampkontekst. NULL for poster uten kamp.
  match_minute    int,
  match_status    text,
  match_home      int,
  match_away      int
) AS $$
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fp.id,
    fp.type,
    fp.content,
    fp.is_pinned,
    fp.created_at,
    fp.event_id,
    fp.match_event_id,
    p.id AS author_id,
    p.display_name AS author_name,
    p.avatar_url AS author_avatar,
    m.role AS author_role,
    (
      SELECT count(*)
      FROM public.comments c
      WHERE c.feed_post_id = fp.id AND c.deleted_at IS NULL
    ) AS comment_count,
    (
      SELECT jsonb_object_agg(sub.emoji, sub.cnt)
      FROM (
        SELECT r.emoji, count(*) AS cnt
        FROM public.reactions r
        WHERE r.feed_post_id = fp.id
        GROUP BY r.emoji
      ) sub
    ) AS reaction_counts,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', med.id,
          'storage_path', med.storage_path,
          'thumbnail_path', med.thumbnail_path,
          'mime_type', med.mime_type
        ) ORDER BY ma.sort_order
      )
      FROM public.media_attachments ma
      JOIN public.media med ON med.id = ma.media_id
      WHERE ma.entity_type = 'feed_post'
        AND ma.entity_id = fp.id
        AND med.deleted_at IS NULL
    ) AS media,
    me.minute      AS match_minute,
    ms.status      AS match_status,
    ms.home_score  AS match_home,
    ms.away_score  AS match_away
  FROM public.feed_posts fp
  LEFT JOIN public.profiles p ON p.id = fp.author_id
  LEFT JOIN public.memberships m
    ON m.user_id = fp.author_id
    AND m.team_space_id = ts_id
    AND m.status = 'active'
    AND m.managed_child_id IS NULL
  LEFT JOIN public.match_events me ON me.id = fp.match_event_id
  LEFT JOIN public.match_sessions ms ON ms.event_id = fp.event_id
  WHERE fp.team_space_id = ts_id
    AND fp.deleted_at IS NULL
    AND (cursor IS NULL OR fp.created_at < cursor)
  ORDER BY fp.is_pinned DESC, fp.created_at DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
