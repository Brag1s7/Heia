-- ============================================================
-- 00021_resume_match.sql
-- Andre omgang: la en pauset kamp gjenopptas.
--
-- Hull som lukkes: `report_match_event` godtok kun
-- ('mål','pause','slutt','melding'), så en kamp satt i `pause`
-- hadde ingen vei tilbake til `live` — den sto i «PAUSE» til «Slutt».
--
-- `andre_omgang` finnes alt i match_events-CHECK (00009) og har alt en
-- visning i appen (describeMatchEvent → «Andre omgang»). Vi utvider bare
-- RPC-en så den godtar typen, setter status tilbake til `live`, og legger
-- en feed-post — samme «hendelse = rad + stilling + feed»-mønster som resten.
--
-- Samtidig strammes to overganger: `pause` kan bare skje fra `live`, og
-- `andre_omgang` bare fra `pause`. Uten det kunne du pause en pauset kamp
-- (dobbel pause-rad) eller «gjenoppta» en kamp som alt spilles.
-- ============================================================

CREATE OR REPLACE FUNCTION report_match_event(
  p_match_session_id uuid,
  p_type             text,
  p_team_side        text DEFAULT NULL,
  p_description      text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_ms      record;
  v_evt     record;
  v_team    text;
  v_minute  int;
  v_seq     int;
  v_me      uuid;
  v_head    text;
  v_content text;
  v_desc    text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_feed    text := 'match_event';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_type NOT IN ('mål', 'pause', 'andre_omgang', 'slutt', 'melding') THEN
    RAISE EXCEPTION 'Unsupported match event type: %', p_type;
  END IF;

  -- COALESCE: `NULL NOT IN (...)` er NULL, ikke true, så et mål uten side
  -- ville sluppet gjennom og gitt en hendelse som ikke endrer stillingen.
  IF p_type = 'mål' AND COALESCE(p_team_side, '') NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'A goal needs team_side home or away';
  END IF;

  IF p_type = 'melding' AND v_desc IS NULL THEN
    RAISE EXCEPTION 'A message needs a description';
  END IF;

  -- Låser raden for resten av transaksjonen: `sequence` og stillingen
  -- leses og skrives her, og to raske måltrykk må ikke kollidere.
  SELECT * INTO v_ms
  FROM public.match_sessions
  WHERE id = p_match_session_id
  FOR UPDATE;

  IF v_ms IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  SELECT * INTO v_evt FROM public.events WHERE id = v_ms.event_id;

  -- Se COALESCE-kommentaren i start_match: uten den slipper et vanlig medlem
  -- gjennom på en kamp der reporter_id er NULL.
  IF NOT (
    COALESCE(v_ms.reporter_id = v_uid, false)
    OR is_team_admin(v_evt.team_space_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_ms.status NOT IN ('live', 'pause') THEN
    RAISE EXCEPTION 'Match is not underway';
  END IF;

  -- Overgangs-vakter: en pause hører hjemme i en kamp som spilles, en andre
  -- omgang i en kamp som er i pause.
  IF p_type = 'pause' AND v_ms.status <> 'live' THEN
    RAISE EXCEPTION 'Match is not live';
  END IF;

  IF p_type = 'andre_omgang' AND v_ms.status <> 'pause' THEN
    RAISE EXCEPTION 'Match is not paused';
  END IF;

  v_minute := GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(v_ms.started_at, now()))) / 60)::int
  );

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_seq
  FROM public.match_events
  WHERE match_session_id = v_ms.id;

  -- Stillingen oppdateres før teksten bygges, så feed-posten viser
  -- resultatet *etter* målet.
  IF p_type = 'mål' THEN
    UPDATE public.match_sessions
    SET home_score = home_score + (CASE WHEN p_team_side = 'home' THEN 1 ELSE 0 END),
        away_score = away_score + (CASE WHEN p_team_side = 'away' THEN 1 ELSE 0 END)
    WHERE id = v_ms.id
    RETURNING * INTO v_ms;
  ELSIF p_type = 'pause' THEN
    UPDATE public.match_sessions SET status = 'pause'
    WHERE id = v_ms.id RETURNING * INTO v_ms;
  ELSIF p_type = 'andre_omgang' THEN
    UPDATE public.match_sessions SET status = 'live'
    WHERE id = v_ms.id RETURNING * INTO v_ms;
  ELSIF p_type = 'slutt' THEN
    UPDATE public.match_sessions
    SET status = 'ferdig', finished_at = now()
    WHERE id = v_ms.id RETURNING * INTO v_ms;
    v_feed := 'match_end';
  END IF;

  INSERT INTO public.match_events
    (match_session_id, type, minute, team_side, description, reported_by, sequence)
  VALUES
    (v_ms.id, p_type, v_minute, p_team_side, v_desc, v_uid, v_seq)
  RETURNING id INTO v_me;

  SELECT display_name INTO v_team
  FROM public.team_spaces WHERE id = v_evt.team_space_id;

  -- home_score/away_score er «oss/dem» uavhengig av is_home — samme
  -- konvensjon som ScoreBoard, som alltid viser eget lag først.
  v_head := CASE
    WHEN p_type = 'mål' AND p_team_side = 'home'
      THEN format('⚽ MÅL! %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'mål'
      THEN format('Mål til %s. %s %s–%s %s', v_ms.opponent, v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'pause'
      THEN format('⏸ Pause. %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'andre_omgang'
      THEN format('▶️ Andre omgang i gang. %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'slutt'
      THEN format('🏁 Slutt! %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    ELSE NULL
  END;

  v_content := btrim(COALESCE(v_head, '') || COALESCE(E'\n' || v_desc, ''));

  INSERT INTO public.feed_posts
    (team_space_id, author_id, type, content, event_id, match_event_id)
  VALUES
    (v_evt.team_space_id, v_uid, v_feed, v_content, v_evt.id, v_me);

  RETURN jsonb_build_object(
    'match_event_id', v_me,
    'minute',         v_minute,
    'home_score',     v_ms.home_score,
    'away_score',     v_ms.away_score,
    'status',         v_ms.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
