-- ============================================================
-- 00033_tournaments_on_season_page.sql
-- Turneringene flytter hjem til sesongflaten (brukertest 2026-07-30).
--
-- Brukerens modell etter å ha prøvd 00032-flyten: «på sesongsiden kan man
-- switche mellom sesonger/turneringer — kanskje det er inne der man legger
-- til en ny turnering? Ved vanlig kampopprettelse kan man velge turnering
-- HVIS det finnes en, ellers blir det en vanlig kamp i sesongen.»
--
-- Datamodellen fra 00032 står UENDRET (turnering = event av type
-- 'turnering', kamper peker med parent_event_id). Det som endres er
-- flatene — og to ting her i SQL:
--   1. get_season_stats kan nå vise ÉN turnering (p_tournament) og
--      returnerer alltid turneringslisten til velgeren.
--   2. notify_on_event_created hopper over turneringskamper: fire kamper
--      lagt inn i en cup skal ikke gi fire «Ny hendelse»-varsler —
--      turneringen selv varslet allerede da den ble opprettet.
-- ============================================================

-- ------------------------------------------------------------
-- 1) get_season_stats — sesong ELLER turnering, samme svarform
-- ------------------------------------------------------------
-- DROP + CREATE: ny parameter = ny signatur (overload-fellen fra 00032).
DROP FUNCTION IF EXISTS get_season_stats(uuid, int, int);

CREATE FUNCTION get_season_stats(
  space_id     uuid,
  p_year       int  DEFAULT NULL,
  p_half       int  DEFAULT NULL,  -- 1 = vår (jan–jun), 2 = høst (jul–des)
  p_tournament uuid DEFAULT NULL   -- satt: vis turneringen i stedet for halvåret
)
RETURNS jsonb AS $$
DECLARE
  v_now_year    int := date_part('year', now())::int;
  v_now_half    int := CASE WHEN date_part('month', now()) <= 6 THEN 1 ELSE 2 END;
  v_year        int := COALESCE(p_year, date_part('year', now())::int);
  v_half        int := COALESCE(p_half,
                        CASE WHEN date_part('month', now()) <= 6 THEN 1 ELSE 2 END);
  v_from        timestamptz;
  v_to          timestamptz;
  v_trn         record;
  v_totals      jsonb;
  v_matches     jsonb;
  v_seasons     jsonb;
  v_tournaments jsonb;
  v_head        jsonb;
BEGIN
  -- COALESCE er ikke pynt: uten den er `IF NOT NULL` usant og vakten
  -- slipper alle gjennom (NULL-fellen fra 00020).
  IF NOT COALESCE(is_team_member(space_id), false) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_tournament IS NOT NULL THEN
    SELECT * INTO v_trn
    FROM public.events
    WHERE id = p_tournament
      AND team_space_id = space_id
      AND type = 'turnering'
      AND deleted_at IS NULL;

    IF v_trn IS NULL THEN
      RAISE EXCEPTION 'Tournament not found';
    END IF;
  ELSE
    IF v_half NOT IN (1, 2) THEN
      RAISE EXCEPTION 'Invalid season half: %', v_half;
    END IF;
    v_from := make_date(v_year, CASE WHEN v_half = 1 THEN 1 ELSE 7 END, 1);
    v_to   := v_from + interval '6 months';
  END IF;

  -- Totaler + kampliste over samme utvalg: halvårets kamper, eller
  -- turneringens. Kun status 'ferdig' teller — i begge modi.
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
    AND (
      (p_tournament IS NOT NULL AND e.parent_event_id = p_tournament)
      OR
      (p_tournament IS NULL AND e.start_time >= v_from AND e.start_time < v_to)
    );

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
      AND (
        (p_tournament IS NOT NULL AND e.parent_event_id = p_tournament)
        OR
        (p_tournament IS NULL AND e.start_time >= v_from AND e.start_time < v_to)
      )
  ) m;

  -- Velgerlistene: halvår med spilte kamper + inneværende, og ALLE
  -- turneringer (nyeste først). En nyopprettet turnering uten kamper skal
  -- kunne velges — det er der man ser at den finnes.
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

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', t.id, 'title', t.title, 'start_time', t.start_time)
      ORDER BY t.start_time DESC
    ),
    '[]'::jsonb
  )
  INTO v_tournaments
  FROM public.events t
  WHERE t.team_space_id = space_id
    AND t.type = 'turnering'
    AND t.deleted_at IS NULL;

  IF p_tournament IS NOT NULL THEN
    v_head := jsonb_build_object(
      'season_label', v_trn.title,
      'tournament',   jsonb_build_object('id', v_trn.id, 'title', v_trn.title)
    );
  ELSE
    v_head := jsonb_build_object(
      'season_year',  v_year,
      'season_half',  v_half,
      'season_label', (CASE WHEN v_half = 1 THEN 'Vårsesongen ' ELSE 'Høstsesongen ' END) || v_year
    );
  END IF;

  RETURN v_totals || v_head || jsonb_build_object(
    'seasons',     v_seasons,
    'tournaments', v_tournaments,
    'matches',     v_matches
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- 2) Ikke varsle per turneringskamp
-- ------------------------------------------------------------
-- Samme funksjon som 00023, pluss én tidlig retur: kamper med
-- parent_event_id er turneringens indre kjøreplan — turneringen varslet
-- da den ble opprettet, og fire kamper skal ikke bli fire varsler til.
CREATE OR REPLACE FUNCTION notify_on_event_created()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_when  text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ts.display_name INTO v_title
  FROM public.team_spaces ts WHERE ts.id = NEW.team_space_id;

  v_when := to_char(NEW.start_time AT TIME ZONE 'Europe/Oslo', 'DD.MM. "kl." HH24:MI');

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, NEW.team_space_id, 'event_reminder',
         COALESCE(v_title, 'Heia'),
         NEW.title || ' — ' || v_when,
         jsonb_build_object(
           'event_id',      NEW.id,
           'team_space_id', NEW.team_space_id
         ),
         'event', NEW.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = NEW.team_space_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.created_by
    AND public.inbox_enabled(m.user_id, NEW.team_space_id, 'event_reminder');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
