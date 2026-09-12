-- ============================================================
-- TILBAKEFØRING av 00086 — gjenoppretter NØYAKTIG funksjonen slik den
-- sto i prod 2026-09-12, FØR migrasjonen ble kjørt.
--
--   node scripts/run-sql.mjs scripts/rollback-00086.sql
--
-- ⚠️ `git checkout` er IKKE en database-tilbakeføring. Å fjerne fila fra
-- treet gjør ingenting med funksjonen som ligger i basen; den må skrives
-- tilbake, og rettighetene med den (00061-fella: en DROP tar ACL-en).
--
-- Definisjonen under er kopiert ORDRETT fra 00072_feedgaten_maal_imot.sql
-- — ikke skrevet på nytt. Den har BEVISST ingen `search_path`, fordi det
-- var den faktiske tilstanden i prod (proconfig = null, målt samme dag).
-- En tilbakeføring skal gjenopprette det som var, ikke det som burde vært.
--
-- ACL-en som gjenopprettes, målt i prod 2026-09-12:
--   postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- altså: ingenting til PUBLIC, ingenting til anon.
--
-- Bevist i scripts/verify-00086.sql (test C1/C2): etter at denne fila er
-- kjørt er md5 av pg_get_functiondef() og proacl IDENTISK med før
-- migrasjonen.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_team_feed(uuid, int, timestamptz);

CREATE FUNCTION public.get_team_feed(
  ts_id  uuid,
  lim    int DEFAULT 20,
  cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  type                text,
  content             text,
  is_pinned           boolean,
  created_at          timestamptz,
  event_id            uuid,
  match_event_id      uuid,
  author_id           uuid,
  author_name         text,
  author_avatar       text,
  author_avatar_color text,
  author_role         text,
  comment_count       bigint,
  reaction_counts     jsonb,
  media               jsonb,
  match_minute        int,
  match_status        text,
  match_home          int,
  match_away          int,
  -- P1: hva øyeblikket ER. NULL for alt som ikke er en kamphendelse — altså
  -- for de aller fleste postene i feeden, som skal beholde HEIA som før.
  match_event_type    text,
  match_event_side    text
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
    p.avatar_color AS author_avatar_color,
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
    ms.away_score  AS match_away,
    me.type        AS match_event_type,
    me.team_side   AS match_event_side
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

-- ⚠️ 00061-FELLA. Uten disse linjene er feeden borte for alle.
REVOKE ALL ON FUNCTION public.get_team_feed(uuid, int, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_feed(uuid, int, timestamptz)
  TO authenticated, service_role;
