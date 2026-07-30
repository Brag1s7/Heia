-- ============================================================
-- 00030_season_stats.sql
-- Sesongflaten: «hittil i sesongen: 7 kamper, 12 mål».
--
-- Alt regnes fra data som allerede finnes: `match_sessions` bærer
-- resultatene (home/away = alltid oss/dem, uavhengig av is_home — se
-- appens mapEventRow), `match_events` bærer målene. Én RPC fordi
-- toppscorer-aggregeringen og resultatlisten ellers hadde blitt tre
-- klientspørringer som må være innbyrdes konsistente.
--
-- Kun kamper med status 'ferdig' teller — også for toppscorerne.
-- Ellers kunne totalsummen («12 mål») og scorerlisten telt ulike
-- kamper og motsagt hverandre på samme skjerm.
--
-- Scorernavnet bor i `match_events.description`: report_match_event
-- (00020) skriver navnet reporteren tastet dit, aldri til
-- `player_name`-kolonnen. Navnene er fritekst, så grupperingen skjer
-- på trimmet tekst — «Ola» og «Ola » er samme spiller, «Ola N» og
-- «Ola Nordmann» er det ikke. Akseptert v1.
--
-- «Sesongen» = kalenderåret (etter e.start_time, servertid). Norsk
-- barne-/ungdomsfotball spiller vår→høst innenfor ett år, så grensen
-- er riktig nok — og året returneres så skjermen kan si det ærlig.
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_stats(space_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_year    int := date_part('year', now())::int;
  v_totals  jsonb;
  v_scorers jsonb;
  v_matches jsonb;
BEGIN
  -- COALESCE er ikke pynt: uten den er `IF NOT NULL` usant og vakten
  -- slipper alle gjennom (NULL-fellen fra 00020).
  IF NOT COALESCE(is_team_member(space_id), false) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

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
    AND date_part('year', e.start_time)::int = v_year;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('name', s.name, 'goals', s.goals)
      ORDER BY s.goals DESC, s.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_scorers
  FROM (
    SELECT btrim(me.description) AS name, count(*) AS goals
    FROM public.match_events me
    JOIN public.match_sessions ms ON ms.id = me.match_session_id
    JOIN public.events e ON e.id = ms.event_id
    WHERE e.team_space_id = space_id
      AND e.deleted_at IS NULL
      AND ms.status = 'ferdig'
      AND date_part('year', e.start_time)::int = v_year
      AND me.type = 'mål'
      -- team_side er nullbar — mål uten side (skal ikke skje etter
      -- 00020) holdes utenfor i stedet for å telles feil.
      AND COALESCE(me.team_side, '') = 'home'
      AND btrim(COALESCE(me.description, '')) <> ''
    GROUP BY btrim(me.description)
    ORDER BY count(*) DESC, btrim(me.description) ASC
    LIMIT 10
  ) s;

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
        'start_time', e.start_time
      ) AS obj
    FROM public.match_sessions ms
    JOIN public.events e ON e.id = ms.event_id
    WHERE e.team_space_id = space_id
      AND e.deleted_at IS NULL
      AND ms.status = 'ferdig'
      AND date_part('year', e.start_time)::int = v_year
  ) m;

  RETURN v_totals || jsonb_build_object(
    'season_year', v_year,
    'top_scorers', v_scorers,
    'matches',     v_matches
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
