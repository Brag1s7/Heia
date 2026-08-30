-- ============================================================
-- 00081_broadcast_envelope_per_send.sql — S3a-rettelse:
-- message_id skal være unik PER LEVERING (LÅST §0.1-2).
--
-- Funnet av verify-00080 C9 mot prod (18 rader / 14 unike
-- message_id): broadcast_on_reactions, broadcast_on_comments og
-- broadcast_on_match_sessions bygde konvolutten ÉN gang og sendte
-- den på TO kanaler (team + match-speil, hhv. 'session' + 'live') —
-- de to leveringene delte message_id. Kontrakten sier gen_random_uuid
-- VED SEND: to kanaler er to leveringer. Med delt id ville en klient
-- som hører begge kanalene (kampskjermen i S3c) fått kryss-kanal-
-- dedup i transportlaget — dedup på tvers av kanaler skal skje i
-- entity_id+seq-laget, aldri på message_id.
--
-- Rettelsen: seq/data bygges én gang (identisk innhold på begge
-- kanaler), men heia_broadcast_envelope kalles PER SEND så hver
-- levering får sin egen message_id/emitted_at. Alt annet — routing,
-- feildisiplin (ingen WHEN OTHERS, warning ved FK-garantert miss,
-- stille ved cascade-DELETE), private=true, SECDEF + pinnet
-- search_path — er uendret fra 00080. De andre triggerne var
-- allerede korrekte (én envelope per send).
--
-- CREATE OR REPLACE beholder eksisterende ACL-er; REVOKE-ene
-- gjentas likevel etter dørene-regelen.
-- ============================================================


-- ============================================================
-- 1) reactions — som 00080 §7, men envelope per send.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_reactions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.reactions%ROWTYPE;
  v_ts      uuid;
  v_event   uuid;
  v_session uuid;
  v_seq     jsonb;
  v_data    jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  SELECT fp.team_space_id, fp.event_id INTO v_ts, v_event
  FROM public.feed_posts fp
  WHERE fp.id = v_row.feed_post_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;  -- ON DELETE CASCADE: forelderen er alt slettet.
    END IF;
    RAISE WARNING 'heia_broadcast: reactions % uten feed_posts-rad %',
      v_row.id, v_row.feed_post_id;
    RETURN NULL;
  END IF;

  v_seq  := jsonb_build_object('created_at', v_row.created_at);
  v_data := to_jsonb(v_row) || jsonb_build_object('op', TG_OP);

  PERFORM realtime.send(
    public.heia_broadcast_envelope(v_row.id, v_seq, v_data),
    'reaction', 'team:' || v_ts::text, true);

  IF v_event IS NOT NULL THEN
    SELECT ms.id INTO v_session
    FROM public.match_sessions ms WHERE ms.event_id = v_event;
    IF FOUND THEN
      PERFORM realtime.send(
        public.heia_broadcast_envelope(v_row.id, v_seq, v_data),
        'reaction', 'match:' || v_session::text, true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_reactions()
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 2) comments — som 00080 §8, men envelope per send.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_comments()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.comments%ROWTYPE;
  v_ts      uuid;
  v_event   uuid;
  v_session uuid;
  v_seq     jsonb;
  v_data    jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  SELECT fp.team_space_id, fp.event_id INTO v_ts, v_event
  FROM public.feed_posts fp
  WHERE fp.id = v_row.feed_post_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;  -- ON DELETE CASCADE: forelderen er alt slettet.
    END IF;
    RAISE WARNING 'heia_broadcast: comments % uten feed_posts-rad %',
      v_row.id, v_row.feed_post_id;
    RETURN NULL;
  END IF;

  v_seq  := jsonb_build_object('created_at', v_row.created_at,
                               'updated_at', v_row.updated_at);
  v_data := to_jsonb(v_row) || jsonb_build_object('op', TG_OP);

  PERFORM realtime.send(
    public.heia_broadcast_envelope(v_row.id, v_seq, v_data),
    'comment', 'team:' || v_ts::text, true);

  IF v_event IS NOT NULL THEN
    SELECT ms.id INTO v_session
    FROM public.match_sessions ms WHERE ms.event_id = v_event;
    IF FOUND THEN
      PERFORM realtime.send(
        public.heia_broadcast_envelope(v_row.id, v_seq, v_data),
        'comment', 'match:' || v_session::text, true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_comments()
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 3) match_sessions — som 00080 §10, men envelope per send.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_match_sessions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ts   uuid;
  v_seq  jsonb;
  v_data jsonb;
BEGIN
  v_seq  := jsonb_build_object('status', NEW.status,
                               'updated_at', NEW.updated_at);
  v_data := to_jsonb(NEW) || jsonb_build_object('op', TG_OP);

  PERFORM realtime.send(
    public.heia_broadcast_envelope(NEW.id, v_seq, v_data),
    'session', 'match:' || NEW.id::text, true);

  SELECT e.team_space_id INTO v_ts
  FROM public.events e WHERE e.id = NEW.event_id;
  IF NOT FOUND THEN
    RAISE WARNING 'heia_broadcast: match_sessions % uten events-rad %',
      NEW.id, NEW.event_id;
    RETURN NULL;
  END IF;

  PERFORM realtime.send(
    public.heia_broadcast_envelope(NEW.id, v_seq, v_data),
    'live', 'team:' || v_ts::text, true);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_match_sessions()
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- ROLLBACK: gjenopprett 00080-versjonene (delt envelope) — men det
-- er nettopp avviket, så reell rollback er DROP-kjeden i 00080.
-- Triggerne peker på funksjonsnavnene og er uendret.
-- ============================================================
