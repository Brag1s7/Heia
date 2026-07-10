-- ============================================================
-- 00020_live_match.sql
-- Live kamp: start, rapporter hendelser, og lever dem til laget.
--
-- Hvorfor RPC og ikke direkte writes fra klienten:
--   1. `match_events.sequence` er NOT NULL uten default — den må regnes ut.
--   2. Ett måltrykk skal endre tre tabeller (match_events, match_sessions,
--      feed_posts). Klient-side ville de tre kunne sprike ved feil midtveis.
--   3. `SELECT ... FOR UPDATE` på match_sessions serialiserer to raske trykk,
--      så verken `sequence` eller stillingen kan race.
--
-- Merk: SECURITY DEFINER omgår RLS, så hver funksjon sjekker rettigheter selv.
-- ============================================================


-- ============================================================
-- start_match()
-- Setter kampen i gang og gjør starteren til kampreporter hvis
-- ingen er utpekt. Det er dette som løser hønen-og-egget:
-- før dette kunne ingen rapportere uten å først bli utnevnt,
-- og ingen kunne utnevnes uten at kampen alt var live.
--
-- Hvem: trener/lagleder/admin, eller en allerede utpekt reporter.
-- ============================================================
CREATE OR REPLACE FUNCTION start_match(p_event_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_evt  record;
  v_ms   record;
  v_me   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_evt
  FROM public.events
  WHERE id = p_event_id AND deleted_at IS NULL;

  IF v_evt IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Låser raden: to samtidige «Start kamp» skal ikke gi to avspark.
  SELECT * INTO v_ms
  FROM public.match_sessions
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_ms IS NULL THEN
    RAISE EXCEPTION 'Event is not a match';
  END IF;

  -- COALESCE er ikke pynt: er reporter_id NULL blir `reporter_id = v_uid`
  -- til NULL, `false OR NULL` blir NULL, og `IF NOT NULL THEN` kjører ikke.
  -- Uten den ville hvem som helst sluppet forbi på en kamp uten reporter.
  IF NOT (
    is_team_admin(v_evt.team_space_id)
    OR COALESCE(v_ms.reporter_id = v_uid, false)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_ms.status <> 'planlagt' THEN
    RAISE EXCEPTION 'Match already started';
  END IF;

  UPDATE public.match_sessions
  SET status      = 'live',
      started_at  = now(),
      reporter_id = COALESCE(reporter_id, v_uid)
  WHERE id = v_ms.id
  RETURNING * INTO v_ms;

  INSERT INTO public.match_events
    (match_session_id, type, minute, description, reported_by, sequence)
  VALUES
    (v_ms.id, 'avspark', 0, 'Kampen er i gang', v_uid, 1)
  RETURNING id INTO v_me;

  INSERT INTO public.feed_posts
    (team_space_id, author_id, type, content, event_id, match_event_id)
  SELECT
    v_evt.team_space_id, v_uid, 'match_start',
    format('⚽ Kampen er i gang: %s mot %s', ts.display_name, v_ms.opponent),
    v_evt.id, v_me
  FROM public.team_spaces ts
  WHERE ts.id = v_evt.team_space_id;

  RETURN jsonb_build_object(
    'match_session_id', v_ms.id,
    'reporter_id',      v_ms.reporter_id,
    'started_at',       v_ms.started_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- report_match_event()
-- Én kamphendelse = én rad i match_events + oppdatert stilling
-- + én feed-post. Feed-posten er hele poenget: det er slik
-- foreldre får se «MÅL! 2–1» uten å sitte på kampskjermen.
--
-- Hvem: kampreporteren, eller en admin.
-- Minuttet regnes ut fra started_at — det skal ikke sendes inn.
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

  IF p_type NOT IN ('mål', 'pause', 'slutt', 'melding') THEN
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


-- ============================================================
-- get_event_with_rsvp() — uendret, bortsett fra `started_at` på
-- match_session. Appen trenger den for å regne ut kampminuttet.
-- ============================================================
CREATE OR REPLACE FUNCTION get_event_with_rsvp(evt_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_evt    record;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_evt
  FROM public.events
  WHERE id = evt_id AND deleted_at IS NULL;

  IF v_evt IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_member(v_evt.team_space_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'id', e.id,
    'type', e.type,
    'title', e.title,
    'description', e.description,
    'location', e.location,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'all_day', e.all_day,
    'created_by', e.created_by,
    -- Match session (null if not a match)
    'match_session', (
      SELECT jsonb_build_object(
        'id', ms.id,
        'opponent', ms.opponent,
        'home_score', ms.home_score,
        'away_score', ms.away_score,
        'is_home', ms.is_home,
        'status', ms.status,
        'reporter_id', ms.reporter_id,
        'started_at', ms.started_at,
        'match_events', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', me.id,
              'type', me.type,
              'minute', me.minute,
              'player_name', me.player_name,
              'team_side', me.team_side,
              'description', me.description,
              'reported_by', me.reported_by
            ) ORDER BY me.sequence
          ), '[]'::jsonb)
          FROM public.match_events me
          WHERE me.match_session_id = ms.id
        )
      )
      FROM public.match_sessions ms
      WHERE ms.event_id = e.id
    ),
    -- RSVP summary
    'rsvp_summary', (
      SELECT jsonb_build_object(
        'coming', count(*) FILTER (WHERE er.status = 'kommer'),
        'not_coming', count(*) FILTER (WHERE er.status = 'kan_ikke'),
        'pending', count(*) FILTER (WHERE er.status = 'venter')
      )
      FROM public.event_rsvps er
      WHERE er.event_id = e.id
    ),
    -- Current user's own RSVP (no child)
    'my_rsvp', (
      SELECT er.status
      FROM public.event_rsvps er
      WHERE er.event_id = e.id
        AND er.user_id = v_uid
        AND er.child_id IS NULL
    ),
    -- Current user's child RSVPs
    'my_child_rsvps', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'child_id', er.child_id,
          'child_name', mc.display_name,
          'status', er.status
        )
      ), '[]'::jsonb)
      FROM public.event_rsvps er
      JOIN public.managed_children mc ON mc.id = er.child_id
      WHERE er.event_id = e.id
        AND er.user_id = v_uid
        AND er.child_id IS NOT NULL
    ),
    -- Attendee lists
    'attendees', jsonb_build_object(
      'coming', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'kommer'
      ),
      'not_coming', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'kan_ikke'
      ),
      'pending', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'venter'
      )
    )
  ) INTO v_result
  FROM public.events e
  WHERE e.id = evt_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- Realtime
-- Uten dette ser en forelder på kampskjermen ingenting før hun
-- selv drar for å oppdatere. Realtime respekterer RLS, og begge
-- tabellene har allerede en «members can view»-SELECT-policy.
--
-- Idempotent: `supabase db push` skal tåle å kjøre migrasjonen
-- mot et prosjekt der tabellene alt ligger i publikasjonen.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'match_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'match_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
  END IF;
END $$;
