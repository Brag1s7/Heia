-- ============================================================
-- 00053 — oppmøtetid på arrangementer
--
-- Brage 2026-08-06: påminnelsen skal si «Oppmøte om én time» når
-- oppmøtetid finnes, ellers «Kampen starter om én time».
--
-- FUNN: oppmøtetid fantes ikke. `events` hadde start_time og end_time,
-- ingenting mer. Uten kolonnen kan påminnelsen aldri velge den varmere
-- formuleringen, og «møt opp 30 min før kamp» — som er selve grunnen
-- til at foreldre trenger varselet — kunne ikke uttrykkes i det hele
-- tatt.
--
-- Feltet er FRIVILLIG. En trening trenger det sjelden; en kamp gjør det
-- nesten alltid.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meeting_time timestamptz;

COMMENT ON COLUMN public.events.meeting_time IS
  'Frivillig oppmøtetidspunkt. Brukes av påminnelsen (00055) og av '
  'endringsvarselet (00054). Skal ligge før start_time.';

-- Oppmøte etter avspark er alltid en feil. Vi tillater NULL (feltet er
-- frivillig) og likhet (oppmøte = start er en gyldig, om enn kjedelig,
-- beskjed).
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_meeting_before_start;
ALTER TABLE public.events
  ADD CONSTRAINT events_meeting_before_start
  CHECK (meeting_time IS NULL OR meeting_time <= start_time);


-- ============================================================
-- create_event() — samme som 00032 + p_meeting_time.
--
-- DROP + CREATE fordi ny parameter = ny signatur. Parameteren legges
-- SIST med DEFAULT NULL, så eldre klienter (TestFlight-bygg som ikke
-- sender feltet) fortsetter å virke uendret.
-- ============================================================
DROP FUNCTION IF EXISTS create_event(
  uuid, text, text, timestamptz, timestamptz, text, text, text, boolean, uuid
);

CREATE FUNCTION create_event(
  p_team_space_id   uuid,
  p_type            text,
  p_title           text,
  p_start_time      timestamptz,
  p_end_time        timestamptz DEFAULT NULL,
  p_location        text DEFAULT NULL,
  p_description     text DEFAULT NULL,
  p_opponent        text DEFAULT NULL,
  p_is_home         boolean DEFAULT true,
  p_parent_event_id uuid DEFAULT NULL,
  p_meeting_time    timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_title    text := trim(COALESCE(p_title, ''));
  v_opponent text := NULLIF(trim(COALESCE(p_opponent, '')), '');
  v_parent   record;
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

  IF p_meeting_time IS NOT NULL AND p_meeting_time > p_start_time THEN
    RAISE EXCEPTION 'Meeting time must be at or before start time';
  END IF;

  IF p_type = 'kamp' AND v_opponent IS NULL THEN
    RAISE EXCEPTION 'Opponent required for a match';
  END IF;

  -- Turneringsvaktene: forelderen må være en turnering i samme lagrom,
  -- og kun kamper kan legges inn i den. Én nivå — en turnering kan ikke
  -- ligge i en turnering.
  IF p_parent_event_id IS NOT NULL THEN
    SELECT * INTO v_parent
    FROM public.events
    WHERE id = p_parent_event_id AND deleted_at IS NULL;

    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'Tournament not found';
    END IF;
    IF v_parent.team_space_id <> p_team_space_id THEN
      RAISE EXCEPTION 'Tournament belongs to another team';
    END IF;
    IF v_parent.type <> 'turnering' THEN
      RAISE EXCEPTION 'Parent event is not a tournament';
    END IF;
    IF p_type <> 'kamp' THEN
      RAISE EXCEPTION 'Only matches can be added to a tournament';
    END IF;
  END IF;

  INSERT INTO public.events (
    team_space_id, type, title, description, location,
    start_time, end_time, meeting_time, parent_event_id, created_by
  ) VALUES (
    p_team_space_id,
    p_type,
    v_title,
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_location, '')), ''),
    p_start_time,
    p_end_time,
    p_meeting_time,
    p_parent_event_id,
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
