-- ============================================================
-- verify-00086-i-drift.sql — BEVIS ETTER at 00086 er kjørt.
--
--   node scripts/run-sql.mjs scripts/verify-00086-i-drift.sql
--
-- ⚠️ IKKE FORVEKSL MED `verify-00086.sql`. Den er en TØRRKJØRING: den
-- kjører migrasjonen OG tilbakeføringen i en subtransaksjon som rulles
-- tilbake, og den kan bare brukes FØR migrasjonen er i drift (etterpå
-- sammenlikner den feil utgangspunkt og blir rød med rette).
--
-- Denne leser den LEVENDE funksjonen. Ingen DDL. Fixturen som beviser
-- oppførselen lever i en subtransaksjon som rulles tilbake, som ellers i
-- huset (00067-arbeidsmåten).
--
-- «resultat» skal være ✅ på alle rader.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_86d (n serial, test text, resultat text);
TRUNCATE verify_86d;

DO $verify$
DECLARE
  r    jsonb := '[]'::jsonb;
  msg  text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team_id  uuid := gen_random_uuid();
  ts_id    uuid := gen_random_uuid();
  u_meg    uuid := gen_random_uuid();
  u_annen  uuid := gen_random_uuid();
  p_festet uuid := gen_random_uuid();
  p_ny     uuid := gen_random_uuid();
  p_mid    uuid := gen_random_uuid();

  v_cnt  int;
  v_bool boolean;
  v_txt  text;
  v_arr  text[];
  v_ids  uuid[];
  rader  jsonb;

  MARKOR CONSTANT text := '__verify_86d_rollback__';
BEGIN
  -- ── A: katalogen, slik den står i prod NÅ ────────────────────
  SELECT count(*) INTO v_cnt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
  r := r || jsonb_build_array(jsonb_build_array(
    'A1 nøyaktig ÉN get_team_feed',
    CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt || ' varianter' END));

  SELECT p.oid::regprocedure::text INTO v_txt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
  r := r || jsonb_build_array(jsonb_build_array(
    'A2 signaturen er uendret — bygg 1.0 (4) treffer samme funksjon',
    CASE WHEN v_txt = 'get_team_feed(uuid,integer,timestamp with time zone)'
      THEN '✅' ELSE '❌ ' || v_txt END));

  SELECT string_agg(a.name, ',' ORDER BY a.ord) INTO v_txt
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL unnest(p.proargnames, p.proargmodes)
    WITH ORDINALITY AS a(name, mode, ord)
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed' AND a.mode = 't';
  r := r || jsonb_build_array(jsonb_build_array(
    'A3 de 21 gamle kolonnene i samme rekkefølge, my_reactions SIST',
    CASE WHEN v_txt = 'id,type,content,is_pinned,created_at,event_id,'
                   || 'match_event_id,author_id,author_name,author_avatar,'
                   || 'author_avatar_color,author_role,comment_count,'
                   || 'reaction_counts,media,match_minute,match_status,'
                   || 'match_home,match_away,match_event_type,'
                   || 'match_event_side,my_reactions'
      THEN '✅' ELSE '❌ ' || v_txt END));

  SELECT p.prosecdef AND p.provolatile = 's' INTO v_bool
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
  r := r || jsonb_build_array(jsonb_build_array(
    'A4 SECURITY DEFINER og STABLE som før',
    CASE WHEN v_bool THEN '✅' ELSE '❌' END));

  SELECT array_to_string(p.proconfig, ' | ') INTO v_txt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
  r := r || jsonb_build_array(jsonb_build_array(
    'A5 search_path pinnet med pg_temp sist (punkt 98)',
    CASE WHEN v_txt = 'search_path=public, pg_temp'
      THEN '✅' ELSE '❌ ' || coalesce(v_txt, 'ingen') END));

  -- ⚠️ 00061-FELLA: en DROP tar ACL-en med seg. Dette er raden som ville
  -- avslørt at feeden er borte for alle.
  SELECT format('anon=%s auth=%s svc=%s public=%s',
           has_function_privilege('anon', p.oid, 'EXECUTE'),
           has_function_privilege('authenticated', p.oid, 'EXECUTE'),
           has_function_privilege('service_role', p.oid, 'EXECUTE'),
           array_to_string(p.proacl, ' ') ~ '(^| )=')
    INTO v_txt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
  r := r || jsonb_build_array(jsonb_build_array(
    'A6 dørene: anon NEI, authenticated JA, service_role JA, PUBLIC NEI',
    CASE WHEN v_txt = 'anon=f auth=t svc=t public=f'
      THEN '✅' ELSE '❌ ' || v_txt END));

  SELECT count(*) INTO v_cnt
  FROM supabase_migrations.schema_migrations WHERE version = '00086';
  r := r || jsonb_build_array(jsonb_build_array(
    'A7 registrert i migrasjonsregisteret (basen og filene i synk)',
    CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ikke registrert' END));

  -- ── B: oppførselen, på en fixtur som rulles tilbake ──────────
  BEGIN
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-86D IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team_id, club_id, sport_id, 'Verify 86D');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated)
    VALUES (ts_id, team_id, 'Verify 86D', 'XVRF86DA', true);

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-86d+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', navn)
    FROM (VALUES (u_meg, 'Verify Meg'), (u_annen, 'Verify Annen')) AS t(u, navn);

    INSERT INTO public.memberships (user_id, team_space_id, role, status)
    VALUES (u_meg, ts_id, 'trener', 'active'),
           (u_annen, ts_id, 'lagleder', 'active');

    -- Claimet FØR innleggene: enforce_pin_is_admin spør auth.uid().
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_meg, 'role', 'authenticated')::text, true);

    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content, is_pinned, created_at)
    VALUES
      (p_festet, ts_id, u_annen, 'melding', 'Festet', true,  now() - interval '10 days'),
      (p_ny,     ts_id, u_annen, 'melding', 'Nyest',  false, now() - interval '1 hour'),
      (p_mid,    ts_id, u_annen, 'melding', 'Midt',   false, now() - interval '2 days');

    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (p_mid, u_meg, '👏'), (p_ny, u_annen, '👏');

    SELECT jsonb_agg(to_jsonb(t) ORDER BY ordinality) INTO rader
    FROM public.get_team_feed(ts_id, 20) WITH ORDINALITY AS t;

    SELECT array_agg((e->>'id')::uuid ORDER BY (e->>'ordinality')::int)
      INTO v_ids FROM jsonb_array_elements(rader) e;
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 rekkefølge: festet først, så nyest → eldst',
      CASE WHEN v_ids = ARRAY[p_festet, p_ny, p_mid]
        THEN '✅' ELSE '❌ ' || v_ids::text END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions')) INTO v_arr
    FROM jsonb_array_elements(rader) e WHERE (e->>'id')::uuid = p_mid;
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 REAGERT innlegg: my_reactions bærer min emoji',
      CASE WHEN v_arr = ARRAY['👏'] THEN '✅' ELSE '❌ ' || v_arr::text END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions')) INTO v_arr
    FROM jsonb_array_elements(rader) e WHERE (e->>'id')::uuid = p_festet;
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 UREAGERT innlegg: tom array, ikke NULL',
      CASE WHEN v_arr = ARRAY[]::text[]
        THEN '✅' ELSE '❌ ' || coalesce(v_arr::text, 'NULL') END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions')) INTO v_arr
    FROM jsonb_array_elements(rader) e WHERE (e->>'id')::uuid = p_ny;
    r := r || jsonb_build_array(jsonb_build_array(
      'B4 ANDRES reaksjon lekker ikke inn som min',
      CASE WHEN v_arr = ARRAY[]::text[] THEN '✅' ELSE '❌ ' || v_arr::text END));

    -- reaction_counts skal fortsatt telle ALLE, ikke bare mine.
    r := r || jsonb_build_array(jsonb_build_array(
      'B5 reaction_counts uendret (teller alle, ikke bare mine)',
      CASE WHEN (
        SELECT e->'reaction_counts'->>'👏' FROM jsonb_array_elements(rader) e
        WHERE (e->>'id')::uuid = p_ny) = '1'
        THEN '✅' ELSE '❌' END));

    SELECT array_agg(f.id ORDER BY f.ordinality) INTO v_ids
    FROM public.get_team_feed(ts_id, 2) WITH ORDINALITY AS f;
    r := r || jsonb_build_array(jsonb_build_array(
      'B6 paginering: side 1 (lim 2) er de to øverste',
      CASE WHEN v_ids = ARRAY[p_festet, p_ny]
        THEN '✅' ELSE '❌ ' || v_ids::text END));

    RAISE EXCEPTION USING errcode = 'P0864', message = MARKOR;
  EXCEPTION
    WHEN sqlstate 'P0864' THEN
      NULL;  -- planlagt: fixturen er borte
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (fixturen rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_86d (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_86d (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat LIKE '✅%') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE' ELSE ' GRØNT' END
  FROM verify_86d;
END $verify$;

SELECT n, test, resultat FROM verify_86d ORDER BY n;
