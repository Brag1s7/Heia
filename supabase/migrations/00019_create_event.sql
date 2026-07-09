-- ============================================================
-- 00019_create_event.sql
-- create_event()
-- Creates an event and — when it is a 'kamp' — its
-- match_session in one transaction, so a match can never end up
-- without a session row.
--
-- SECURITY DEFINER bypasses RLS, so the rule that the policy
-- "Admins can create events" normally enforces must be checked
-- explicitly here.
-- ============================================================
CREATE OR REPLACE FUNCTION create_event(
  p_team_space_id uuid,
  p_type          text,
  p_title         text,
  p_start_time    timestamptz,
  p_end_time      timestamptz DEFAULT NULL,
  p_location      text DEFAULT NULL,
  p_description   text DEFAULT NULL,
  p_opponent      text DEFAULT NULL,
  p_is_home       boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_title    text := trim(COALESCE(p_title, ''));
  v_opponent text := NULLIF(trim(COALESCE(p_opponent, '')), '');
  v_event    uuid;
  v_session  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Only coaches, team leaders and admins can create events';
  END IF;

  IF p_type NOT IN ('trening','kamp','sosialt','mote','turnering','annet') THEN
    RAISE EXCEPTION 'Invalid event type: %', p_type;
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'Title required';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Start time required';
  END IF;

  IF p_end_time IS NOT NULL AND p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  IF p_type = 'kamp' AND v_opponent IS NULL THEN
    RAISE EXCEPTION 'Opponent required for a match';
  END IF;

  INSERT INTO public.events (
    team_space_id, type, title, description, location,
    start_time, end_time, created_by
  ) VALUES (
    p_team_space_id,
    p_type,
    v_title,
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_location, '')), ''),
    p_start_time,
    p_end_time,
    v_uid
  )
  RETURNING id INTO v_event;

  IF p_type = 'kamp' THEN
    INSERT INTO public.match_sessions (event_id, opponent, is_home, status)
    VALUES (v_event, v_opponent, COALESCE(p_is_home, true), 'planlagt')
    RETURNING id INTO v_session;
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_event,
    'match_session_id', v_session
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
