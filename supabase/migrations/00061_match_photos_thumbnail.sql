-- ============================================================
-- 00061_match_photos_thumbnail.sql
-- get_match_photos lærer om thumbnail_path (B2 event-detalj-skiven).
--
-- Kampforløpet og kampbilde-railen viser bildene som småbilder, men RPC-en
-- returnerte kun storage_path — klientens thumb-variant falt derfor STILLE
-- tilbake til 2048px-masteren (mediaPathFor i src/lib/media/types.ts), og
-- hver kampside lastet alle kampbilder i full display-vekt. Kolonnen finnes
-- allerede på media (00010, backfillet i fase A: 38/38) — den må bare ut
-- gjennom RPC-en, slik get_team_feed (00029) allerede gjør.
--
-- Returtypen endres → DROP + CREATE (CREATE OR REPLACE kan ikke endre
-- RETURNS TABLE), og 00060-grantene må gjenskapes: DROP tar dem med seg.
-- En ekstra kolonne er bakoverkompatibel — gamle TestFlight-klienter leser
-- bare kolonnene de kjenner.
-- ============================================================

DROP FUNCTION IF EXISTS get_match_photos(uuid);

CREATE FUNCTION get_match_photos(evt_id uuid)
RETURNS TABLE (
  post_id        uuid,
  content        text,
  created_at     timestamptz,
  author_id      uuid,
  author_name    text,
  author_avatar  text,
  match_event_id uuid,
  storage_path   text,
  thumbnail_path text
) AS $$
DECLARE
  v_ts_id uuid;
BEGIN
  SELECT e.team_space_id INTO v_ts_id
  FROM public.events e
  WHERE e.id = evt_id;

  IF v_ts_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_member(v_ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fp.id AS post_id,
    fp.content,
    fp.created_at,
    fp.author_id,
    p.display_name AS author_name,
    p.avatar_url AS author_avatar,
    fp.match_event_id,
    med.storage_path,
    med.thumbnail_path
  FROM public.feed_posts fp
  JOIN public.media_attachments ma
    ON ma.entity_type = 'feed_post' AND ma.entity_id = fp.id
  JOIN public.media med
    ON med.id = ma.media_id AND med.deleted_at IS NULL
  LEFT JOIN public.profiles p ON p.id = fp.author_id
  WHERE fp.event_id = evt_id
    AND fp.deleted_at IS NULL
  ORDER BY fp.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 00060-grantene, gjenskapt for den nye signaturen: funksjonsdøren er lukket
-- for anon, åpen for innloggede (RLS-sjekken is_team_member vokter innenfor).
REVOKE ALL ON FUNCTION get_match_photos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_match_photos(uuid) TO authenticated;
