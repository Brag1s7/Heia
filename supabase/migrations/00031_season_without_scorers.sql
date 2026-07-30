-- ============================================================
-- 00031_season_without_scorers.sql
-- Fjerner toppscorerne fra get_season_stats.
--
-- LÅST beslutning (bruker, 2026-07-30, etter å ha sett flaten på telefon):
-- ingen spillerstatistikk før laget har en strukturert spillerstall, og
-- målscorere skal ikke registreres som fritekst. 00030 leste
-- `match_events.description` som scorernavn — men feltet er mål-dialogens
-- frie beskrivelse («1-0, latterlig bra mål», «Fuuuuuukkk»), aldri et navn,
-- så «toppscorerlisten» ble en liste over utrop. I tillegg: en rangering av
-- barna i foreldrenes app er verdimessig feil for ungdomsidrett — samme etos
-- som «ingen TAP-roping».
--
-- Samme signatur som før (space_id uuid → jsonb), så CREATE OR REPLACE
-- holder. `top_scorers`-nøkkelen forsvinner fra svaret; appens mapper leste
-- den med fallback, så gamle og nye klienter tåler begge svarformene.
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_stats(space_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_year    int := date_part('year', now())::int;
  v_totals  jsonb;
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
    'matches',     v_matches
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
