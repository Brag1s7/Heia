-- ============================================================
-- 00028_match_photos.sql
-- Kampbilder: bilder som hører til en kamp, hentet som kampens egne.
--
-- Et bilde er en helt vanlig bildepost i feeden (`type = 'bilde'`) — det er
-- `event_id` som gjør det til et kampbilde, og `match_event_id` som eventuelt
-- knytter det til ett bestemt øyeblikk («her jubler Thomas» på 1–0-målet).
-- Begge kolonnene finnes fra før i `feed_posts` (00009), så det trengs ingen
-- skjemaendring — bare en måte å lese dem tilbake på.
--
-- Hvorfor en egen RPC og ikke et nested select fra klienten: koblingen går via
-- `media_attachments (entity_type, entity_id)`, som er en generisk peker og
-- IKKE en fremmednøkkel til `feed_posts`. PostgREST kan ikke joine over den,
-- så joinen må gjøres her.
-- ============================================================

CREATE OR REPLACE FUNCTION get_match_photos(evt_id uuid)
RETURNS TABLE (
  post_id        uuid,
  content        text,
  created_at     timestamptz,
  author_id      uuid,
  author_name    text,
  author_avatar  text,
  match_event_id uuid,
  storage_path   text
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
    med.storage_path
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
