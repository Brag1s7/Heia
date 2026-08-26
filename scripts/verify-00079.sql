-- ============================================================
-- verify-00079.sql — S2: get_session_context + runtime_config
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i en SUBTRANSAKSJON som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig. Samme rigg som verify-00067/00075.
--
-- HVA SOM BEVISES
--   A. DØRENE: EXECUTE-privilegiene (anon f / authenticated t),
--      SECURITY DEFINER + låst search_path med pg_temp SIST, og
--      runtime_configs RLS + tabellprivilegier (authenticated kan
--      lese men ALDRI skrive; anon ingenting).
--   B. RUNTIME-CONFIGEN: raden finnes med trygge defaults (pgc/pgc/
--      pgc, poll 0), énradsvernet holder, og CHECK-ene avviser en
--      feilstavet transport — kill-switch-UPDATE-en skal feile HØYT
--      på skrivefeil, ikke seile ut til flåten.
--   C. SCOPINGEN (definer bypasser RLS — dette er de viktige):
--      medlem får hele konteksten for sitt lag; et FREMMED lags id
--      gir NULL-scopede felter (aldri en feil, aldri andres data);
--      unread teller KUN egne varsler (lag + globale, uleste);
--      memberships er kun egne aktive i ulettede lagrom.
--   D. FORMEN: payloaden bærer feltene klient-mapperne leser
--      (live_match med match_sessions-objektet, membership-embedden
--      med team_space/team/club/sport, runtime_flags komplett).
--   E. DEGRADERING: uten runtime_config-rad svarer RPC-en fortsatt,
--      med defaultflaggene.
--
-- NB: kjøres som postgres — anon-42501-proben mot rå PostgREST tas
-- utenfor SQL (curl med anon-nøkkel), privilegiene bevises her.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00079 (n serial, test text, resultat text);
TRUNCATE verify_00079;

DO $$
DECLARE
  r        jsonb := '[]'::jsonb;
  msg      text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid(); ts1 uuid := gen_random_uuid();
  team2    uuid := gen_random_uuid(); ts2 uuid := gen_random_uuid();

  u_a uuid := gen_random_uuid(); -- medlem i T1
  u_b uuid := gen_random_uuid(); -- medlem i T1 (telleren)
  u_c uuid := gen_random_uuid(); -- medlem KUN i T2 (fremmed-proben)

  ev_live uuid := gen_random_uuid();

  v jsonb; v_cnt int; v_bool boolean; v_txt text;

  PROCEDURE_marker CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen alt skjer i ──────────────────────

    -- ── A. Dørene ────────────────────────────────────────────
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 anon har IKKE EXECUTE på get_session_context',
      CASE WHEN NOT has_function_privilege(
        'anon', 'public.get_session_context(uuid)', 'EXECUTE')
        THEN '✅' ELSE '❌ åpen dør' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A2 authenticated HAR EXECUTE på get_session_context',
      CASE WHEN has_function_privilege(
        'authenticated', 'public.get_session_context(uuid)', 'EXECUTE')
        THEN '✅' ELSE '❌' END));

    SELECT p.prosecdef, array_to_string(p.proconfig, ';')
    INTO v_bool, v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_session_context';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3 SECURITY DEFINER + search_path=public, pg_temp (pg_temp SIST)',
      CASE WHEN v_bool AND v_txt LIKE '%search_path=public, pg_temp%'
        THEN '✅' ELSE '❌ ' || coalesce(v_txt, 'ingen proconfig') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A4 runtime_config: RLS er PÅ',
      CASE WHEN (SELECT relrowsecurity FROM pg_class
                 WHERE oid = 'public.runtime_config'::regclass)
        THEN '✅' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A5 runtime_config: authenticated kan SELECT, aldri skrive',
      CASE WHEN has_table_privilege('authenticated', 'public.runtime_config', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.runtime_config', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public.runtime_config', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public.runtime_config', 'DELETE')
        THEN '✅' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A6 runtime_config: anon har INGENTING',
      CASE WHEN NOT has_table_privilege('anon', 'public.runtime_config', 'SELECT')
        THEN '✅' ELSE '❌' END));

    SELECT count(*) INTO v_cnt FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'runtime_config'
      AND cmd <> 'SELECT';
    r := r || jsonb_build_array(jsonb_build_array(
      'A7 runtime_config: ingen skrivepolicy finnes (kun service/ops)',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt || ' policyer' END));

    -- ── B. Runtime-configen ──────────────────────────────────
    SELECT count(*) INTO v_cnt FROM public.runtime_config;
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 nøyaktig én konfig-rad',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt || ' rader' END));

    SELECT realtime_transport INTO v FROM public.runtime_config;
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 defaults = dagens atferd (pgc/pgc/pgc, poll 0)',
      CASE WHEN v->>'match' = 'pgc' AND v->>'feed' = 'pgc'
        AND v->>'notif' = 'pgc'
        AND (SELECT live_fallback_poll_s FROM public.runtime_config) = 0
        THEN '✅' ELSE '❌ ' || v::text END));

    BEGIN
      INSERT INTO public.runtime_config (id) VALUES (false);
      r := r || jsonb_build_array(jsonb_build_array(
        'B3 énradsvernet', '❌ rad to slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array('B3 énradsvernet', '✅'));
    END;

    BEGIN
      UPDATE public.runtime_config
      SET realtime_transport = '{"match":"broadcst","feed":"pgc","notif":"pgc"}'::jsonb
      WHERE id;
      r := r || jsonb_build_array(jsonb_build_array(
        'B4 CHECK avviser feilstavet transport (kill-switch-skrivefeil)',
        '❌ «broadcst» slapp inn'));
    EXCEPTION WHEN check_violation THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'B4 CHECK avviser feilstavet transport (kill-switch-skrivefeil)', '✅'));
    END;

    BEGIN
      UPDATE public.runtime_config SET live_fallback_poll_s = -1 WHERE id;
      r := r || jsonb_build_array(jsonb_build_array(
        'B5 CHECK avviser negativ poll', '❌'));
    EXCEPTION WHEN check_violation THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'B5 CHECK avviser negativ poll', '✅'));
    END;

    -- ── Fixturer ─────────────────────────────────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00079+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', navn)
    FROM (VALUES
      (u_a, 'Verify Medlem A'), (u_b, 'Verify Medlem B'),
      (u_c, 'Verify Fremmed C')) AS t(u, navn);

    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00079 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify T1'),
           (team2, club_id, sport_id, 'Verify T2');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code)
    VALUES (ts1, team1, 'Verify Lag 1', 'XVRF79AA'),
           (ts2, team2, 'Verify Lag 2', 'XVRF79BB');
    INSERT INTO public.memberships
      (user_id, team_space_id, role, status, joined_at)
    VALUES (u_a, ts1, 'trener',   'active', now() - interval '3 days'),
           (u_b, ts1, 'forelder', 'active', now() - interval '2 days'),
           (u_c, ts2, 'trener',   'active', now() - interval '1 day');

    -- Livekamp i T1.
    INSERT INTO public.events (id, team_space_id, type, title, start_time)
    VALUES (ev_live, ts1, 'kamp', 'Verify livekamp', now() - interval '30 min');
    INSERT INTO public.match_sessions (event_id, opponent, status, home_score,
                                       away_score, started_at)
    VALUES (ev_live, 'Verify Motstander', 'live', 2, 1,
            now() - interval '25 min');

    -- Varsler for A i T1: 2 uleste + 1 lest + 1 globalt ulest = 3 uleste
    -- i scope. B har ett ulest (skal ALDRI telle hos A). A har også et
    -- ulest i et ANNET lag (skal ikke telle i T1-scopet).
    INSERT INTO public.notifications (user_id, team_space_id, category, title, body, read_at)
    VALUES (u_a, ts1, 'new_post',  'v', 'v', NULL),
           (u_a, ts1, 'match_live','v', 'v', NULL),
           (u_a, ts1, 'new_post',  'v', 'v', now()),
           (u_a, NULL,'system',    'v', 'v', NULL),
           (u_a, ts2, 'new_post',  'v', 'v', NULL),
           (u_b, ts1, 'new_post',  'v', 'v', NULL);

    -- ── C+D. Medlemmets kontekst ─────────────────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := public.get_session_context(ts1);

    r := r || jsonb_build_array(jsonb_build_array(
      'C1 medlem: laget er dekket (team_space_id ekko)',
      CASE WHEN v->>'team_space_id' = ts1::text THEN '✅' ELSE '❌ ' || v::text END));

    r := r || jsonb_build_array(jsonb_build_array(
      'C2 profilen er egen rad',
      CASE WHEN v->'profile'->>'id' = u_a::text THEN '✅' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'C3 memberships: kun egne aktive (1 rad, T1)',
      CASE WHEN jsonb_array_length(v->'memberships') = 1
        AND v->'memberships'->0->>'team_space_id' = ts1::text
        THEN '✅' ELSE '❌ ' || (v->'memberships')::text END));

    r := r || jsonb_build_array(jsonb_build_array(
      'D1 membership-embedden bærer team_space/team/club/sport',
      CASE WHEN v->'memberships'->0->'team_space'->'team'->'club' ? 'name'
        AND v->'memberships'->0->'team_space'->'team'->'sport' ? 'slug'
        AND v->'memberships'->0->'team_space' ? 'invite_code'
        THEN '✅' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'C4 member_count teller aktive rader (2)',
      CASE WHEN (v->>'member_count')::int = 2 THEN '✅'
        ELSE '❌ ' || (v->>'member_count') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'C5 unread: egne uleste i lag + globale = 3 (aldri B sine, aldri T2)',
      CASE WHEN (v->>'unread_count')::int = 3 THEN '✅'
        ELSE '❌ ' || (v->>'unread_count') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'D2 live_match: LIVE_MATCH_COLUMNS-formen med sessions-objektet',
      CASE WHEN v->'live_match'->>'id' = ev_live::text
        AND v->'live_match'->'match_sessions'->>'status' = 'live'
        AND (v->'live_match'->'match_sessions'->>'home_score')::int = 2
        AND v->'live_match'->'match_sessions' ? 'played_seconds'
        AND v->'live_match'->'match_sessions' ? 'clock_started_at'
        THEN '✅' ELSE '❌ ' || (v->'live_match')::text END));

    r := r || jsonb_build_array(jsonb_build_array(
      'D3 support_summary: 00040-payloaden (0 supportere, nok)',
      CASE WHEN v->'support_summary'->>'currency' = 'nok'
        AND (v->'support_summary'->>'supporters')::int = 0
        THEN '✅' ELSE '❌ ' || (v->'support_summary')::text END));

    r := r || jsonb_build_array(jsonb_build_array(
      'D4 runtime_flags komplett i payloaden',
      CASE WHEN v->'runtime_flags'->'realtime_transport'->>'match' = 'pgc'
        AND v->'runtime_flags' ? 'live_fallback_poll_s'
        AND v->'runtime_flags' ? 'min_build'
        THEN '✅' ELSE '❌ ' || (v->'runtime_flags')::text END));

    -- ── C6. Fremmed lag: NULL-scopede felter, aldri en feil ──
    v := public.get_session_context(ts2);
    r := r || jsonb_build_array(jsonb_build_array(
      'C6 fremmed lags id: ikke dekket, alle scopede felter NULL',
      CASE WHEN v->>'team_space_id' IS NULL
        AND v->'member_count' = 'null'::jsonb
        AND v->'unread_count' = 'null'::jsonb
        AND v->'live_match' = 'null'::jsonb
        AND v->'support_summary' = 'null'::jsonb
        AND jsonb_array_length(v->'memberships') = 1
        THEN '✅' ELSE '❌ ' || v::text END));

    -- ── C7. Uten lag-id: profil/memberships/flagg, resten NULL ─
    v := public.get_session_context(NULL);
    r := r || jsonb_build_array(jsonb_build_array(
      'C7 p_team_space_id NULL: profil+memberships+flagg, scoped NULL',
      CASE WHEN v->>'team_space_id' IS NULL
        AND v->'profile'->>'id' = u_a::text
        AND v->'runtime_flags'->'realtime_transport'->>'feed' = 'pgc'
        THEN '✅' ELSE '❌' END));

    -- ── E. Uten konfig-rad: defaults, ikke feil ──────────────
    DELETE FROM public.runtime_config;
    v := public.get_session_context(ts1);
    r := r || jsonb_build_array(jsonb_build_array(
      'E1 manglende konfig-rad: RPC svarer med default-flaggene',
      CASE WHEN v->'runtime_flags'->'realtime_transport'->>'match' = 'pgc'
        AND (v->'runtime_flags'->>'live_fallback_poll_s')::int = 0
        THEN '✅' ELSE '❌ ' || (v->'runtime_flags')::text END));

    -- ── ROLLBACK-MARKØREN: alt fixture-arbeid rulles tilbake ─
    RAISE EXCEPTION USING errcode = 'P0967', message = PROCEDURE_marker;

  EXCEPTION
    WHEN sqlstate 'P0967' THEN
      NULL;  -- planlagt tilbakerulling — resultatene i r overlever
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (alt rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_00079 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00079 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat = '✅') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            ELSE ' GRØNT' END
  FROM verify_00079;
END $$;

SELECT n, test, resultat FROM verify_00079 ORDER BY n;
