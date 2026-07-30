-- ============================================================
-- 00032_tournaments_and_half_seasons.sql
-- Turneringer + vår/høst-sesonger (bruker-beslutning 2026-07-30).
--
-- TURNERING: «en enkel samling av kamper innenfor den aktive sesongen,
-- ikke et avansert cupadministrasjonssystem». Modellen:
--   - Turneringen ER et vanlig event (type 'turnering' fantes alt i
--     CHECK-en fra 00007): én rad i kalenderen, RSVP på dagen.
--   - Kampene er helt vanlige 'kamp'-events med ny `parent_event_id`
--     som peker på turneringen. Live-rapportering, kamprapport og
--     bilder gjenbrukes uendret — ingenting i kamp-løypa vet om
--     turneringer.
--
-- SESONG: vår (jan–jun) og høst (jul–des). Halvår er sport-nøytralt:
-- fotballfolk sier «vårsesongen/høstsesongen», og hallidrettenes
-- 26/27-sesong ER en høstdel + en vårdel. Dermed trengs ingen
-- sesongoppsett per idrett og ingen admin — vinduet er en ren
-- datoregel. (`seasons`-tabellen fra 00002 står urørt til en evt.
-- kobling mot kanoniske seriedata.)
-- ============================================================

-- ------------------------------------------------------------
-- 1) events.parent_event_id
-- ------------------------------------------------------------
-- ON DELETE SET NULL, ikke CASCADE: skulle en turneringsrad bli
-- hard-slettet skal kampene (med rapporter og bilder) overleve som
-- vanlige kamper — ikke forsvinne i stillhet.
ALTER TABLE public.events
  ADD COLUMN parent_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX idx_events_parent_event
  ON public.events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2) create_event — ny valgfri p_parent_event_id
-- ------------------------------------------------------------
-- DROP + CREATE, ikke CREATE OR REPLACE: en ny parameter gir en NY
-- signatur, og OR REPLACE ville latt den gamle 9-args-funksjonen leve
-- videre som en overload — kall uten p_parent_event_id ville blitt
-- tvetydige og feilet.
DROP FUNCTION IF EXISTS create_event(
  uuid, text, text, timestamptz, timestamptz, text, text, text, boolean
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
  p_parent_event_id uuid DEFAULT NULL
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
    start_time, end_time, parent_event_id, created_by
  ) VALUES (
    p_team_space_id,
    p_type,
    v_title,
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_location, '')), ''),
    p_start_time,
    p_end_time,
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

-- ------------------------------------------------------------
-- 3) get_season_stats — vår/høst-vindu + turneringsnavn på kampene
-- ------------------------------------------------------------
-- DROP + CREATE: nye parametre = ny signatur (samme overload-felle som
-- create_event over).
DROP FUNCTION IF EXISTS get_season_stats(uuid);

CREATE FUNCTION get_season_stats(
  space_id uuid,
  p_year   int DEFAULT NULL,
  p_half   int DEFAULT NULL  -- 1 = vår (jan–jun), 2 = høst (jul–des)
)
RETURNS jsonb AS $$
DECLARE
  v_now_year int := date_part('year', now())::int;
  v_now_half int := CASE WHEN date_part('month', now()) <= 6 THEN 1 ELSE 2 END;
  v_year     int := COALESCE(p_year, date_part('year', now())::int);
  v_half     int := COALESCE(p_half,
                      CASE WHEN date_part('month', now()) <= 6 THEN 1 ELSE 2 END);
  v_from     timestamptz;
  v_to       timestamptz;
  v_totals   jsonb;
  v_matches  jsonb;
  v_seasons  jsonb;
BEGIN
  -- COALESCE er ikke pynt: uten den er `IF NOT NULL` usant og vakten
  -- slipper alle gjennom (NULL-fellen fra 00020).
  IF NOT COALESCE(is_team_member(space_id), false) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_half NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Invalid season half: %', v_half;
  END IF;

  v_from := make_date(v_year, CASE WHEN v_half = 1 THEN 1 ELSE 7 END, 1);
  v_to   := v_from + interval '6 months';

  SELECT jsonb_build_object(
    'played',        count(*),
    'wins',          count(*) FILTER (WHERE ms.home_score > ms.away_score),
    'draws',         count(*) FILTER (WHERE ms.home_score = ms.away_score),
    'losses',        count(*) FILTER (WHERE ms.home_score < ms.away_score),
    'goals_for',     COALESCE(sum(ms.home_score), 0),
    'goals_against', COALESCE(sum(ms.away_score), 0)
  )
  INTO v_totals
  FROM public.match_sessions ms
  JOIN public.events e ON e.id = ms.event_id
  WHERE e.team_space_id = space_id
    AND e.deleted_at IS NULL
    AND ms.status = 'ferdig'
    AND e.start_time >= v_from AND e.start_time < v_to;

  SELECT COALESCE(
    jsonb_agg(m.obj ORDER BY m.start_time DESC),
    '[]'::jsonb
  )
  INTO v_matches
  FROM (
    SELECT
      e.start_time,
      jsonb_build_object(
        'event_id',   e.id,
        'title',      e.title,
        'opponent',   ms.opponent,
        'home',       ms.home_score,
        'away',       ms.away_score,
        'is_home',    ms.is_home,
        'start_time', e.start_time,
        'tournament', pe.title
      ) AS obj
    FROM public.match_sessions ms
    JOIN public.events e ON e.id = ms.event_id
    LEFT JOIN public.events pe ON pe.id = e.parent_event_id
    WHERE e.team_space_id = space_id
      AND e.deleted_at IS NULL
      AND ms.status = 'ferdig'
      AND e.start_time >= v_from AND e.start_time < v_to
  ) m;

  -- Halvår som har spilte kamper + inneværende, nyeste først — det er
  -- velgerlisten i appen. Inneværende er alltid med, så skjermen alltid
  -- har et gyldig valg selv før første kamp er spilt.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'year',  s.yr,
        'half',  s.hf,
        'label', (CASE WHEN s.hf = 1 THEN 'Vår ' ELSE 'Høst ' END) || s.yr
      )
      ORDER BY s.yr DESC, s.hf DESC
    ),
    '[]'::jsonb
  )
  INTO v_seasons
  FROM (
    SELECT DISTINCT
      date_part('year', e.start_time)::int AS yr,
      CASE WHEN date_part('month', e.start_time) <= 6 THEN 1 ELSE 2 END AS hf
    FROM public.match_sessions ms
    JOIN public.events e ON e.id = ms.event_id
    WHERE e.team_space_id = space_id
      AND e.deleted_at IS NULL
      AND ms.status = 'ferdig'
    UNION
    SELECT v_now_year, v_now_half
  ) s;

  RETURN v_totals || jsonb_build_object(
    'season_year',  v_year,
    'season_half',  v_half,
    'season_label', (CASE WHEN v_half = 1 THEN 'Vårsesongen ' ELSE 'Høstsesongen ' END) || v_year,
    'seasons',      v_seasons,
    'matches',      v_matches
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
