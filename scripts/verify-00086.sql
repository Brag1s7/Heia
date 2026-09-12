-- ============================================================
-- verify-00086.sql — TØRRKJØRING av 00086 og tilbakeføringen.
--
--   node scripts/run-sql.mjs scripts/verify-00086.sql
--
-- Hele fila kjører i ÉN subtransaksjon som rulles tilbake av en
-- markør-exception (samme arbeidsmåte som verify-00067/00085): både
-- DDL-en, fixturene og tilbakeføringen forsvinner. Bare radene i
-- temp-tabellen overlever og vises i grid-en fra siste SELECT.
--
-- DEN KJØRER DE EKTE FILENE. Migrasjonen og tilbakeføringen er ikke
-- skrevet om her; de leses inn av kalleren som tekst og kjøres med
-- EXECUTE, så det som bevises ER det som havner i prod.
--
-- Dekker:
--   A  katalogen etter migrasjonen — signatur, kolonner, rekkefølge,
--      SECURITY DEFINER, search_path, og hvem som har EXECUTE
--   B  oppførselen på ekte data — rekkefølge, paginering, og at
--      `my_reactions` er riktig for BÅDE reagerte og ureagerte innlegg
--   C  at tilbakeføringen faktisk fører tilbake: md5 av
--      pg_get_functiondef() og proacl identisk med før
--
-- «resultat» skal være ✅ på alle rader.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00086 (n serial, test text, resultat text);
TRUNCATE verify_00086;

DO $verify$
DECLARE
  r    jsonb := '[]'::jsonb;
  msg  text;

  -- Fixtur: ett lag, to brukere, fire innlegg, én reaksjon.
  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team_id  uuid := gen_random_uuid();
  ts_id    uuid := gen_random_uuid();
  u_meg    uuid := gen_random_uuid();
  u_annen  uuid := gen_random_uuid();
  p_festet uuid := gen_random_uuid();
  p_ny     uuid := gen_random_uuid();
  p_mid    uuid := gen_random_uuid();
  p_gml    uuid := gen_random_uuid();

  def_for  text;
  acl_for  text;
  def_etter text;
  acl_etter text;

  gamle_rader jsonb;
  nye_rader   jsonb;
  v_cnt    int;
  v_bool   boolean;
  v_txt    text;
  v_arr    text[];
  v_ids    uuid[];
  v_cursor timestamptz;

  MARKOR CONSTANT text := '__verify_00086_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen alt skjer i ────────────────────────

    -- ── FØR: fasiten tilbakeføringen skal treffe ────────────────
    SELECT md5(pg_get_functiondef(p.oid)),
           coalesce(array_to_string(p.proacl, ' '), '(ingen)')
      INTO def_for, acl_for
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';

    r := r || jsonb_build_array(jsonb_build_array(
      '0 utgangspunktet er lest (md5 + acl)',
      CASE WHEN def_for IS NOT NULL AND acl_for <> '(ingen)'
        THEN '✅ ' || acl_for ELSE '❌ fant ikke funksjonen' END));

    -- ── Fixtur ──────────────────────────────────────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00086 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team_id, club_id, sport_id, 'Verify 00086');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated)
    VALUES (ts_id, team_id, 'Verify 00086', 'XVRF86AA', true);

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00086+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', navn)
    FROM (VALUES (u_meg, 'Verify Meg'), (u_annen, 'Verify Annen')) AS t(u, navn);

    INSERT INTO public.memberships (user_id, team_space_id, role, status)
    -- Begge er admin: en trigger på feed_posts slipper bare trener/lagleder
    -- gjennom med lagbrede meldinger («Kun trener eller lagleder kan varsle
    -- hele laget»), og fixturen skal teste feeden — ikke den porten.
    VALUES (u_meg, ts_id, 'trener', 'active'),
           (u_annen, ts_id, 'lagleder', 'active');

    -- ⚠️ CLAIMET MÅ STÅ FØR INNLEGGENE. `enforce_pin_is_admin` (00024) er
    -- en BEFORE INSERT-trigger som spør `is_team_admin(...)`, altså
    -- auth.uid() — og den er NULL her til vi setter den. Uten denne linja
    -- feiler det FESTEDE innlegget med «Kun trener eller lagleder kan
    -- varsle hele laget», og fixturen kommer aldri i gang.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_meg, 'role', 'authenticated')::text, true);

    -- Fire innlegg: ett festet (skal ligge øverst uansett alder) og tre
    -- vanlige med tydelig ulik alder, så rekkefølgen kan måles.
    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content, is_pinned, created_at)
    VALUES
      (p_festet, ts_id, u_annen, 'melding', 'Festet', true,  now() - interval '10 days'),
      (p_ny,     ts_id, u_annen, 'melding', 'Nyest',  false, now() - interval '1 hour'),
      (p_mid,    ts_id, u_annen, 'melding', 'Midt',   false, now() - interval '2 days'),
      (p_gml,    ts_id, u_annen, 'melding', 'Eldst',  false, now() - interval '9 days');

    -- JEG har reagert på ÉN post (den midterste). En annen bruker har
    -- reagert på en annen — den skal IKKE dukke opp som min.
    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (p_mid, u_meg, '👏'),
           (p_ny,  u_annen, '👏');

    -- ── Gammelt svar, som meg, FØR migrasjonen ──────────────────
    SELECT jsonb_agg(to_jsonb(t) ORDER BY ordinality) INTO gamle_rader
    FROM public.get_team_feed(ts_id, 20) WITH ORDINALITY AS t;

    -- ── MIGRASJONEN, ordrett fra fila ───────────────────────────
    EXECUTE current_setting('verify00086.migration');

    -- ── A: katalogen ────────────────────────────────────────────
    SELECT count(*) INTO v_cnt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 nøyaktig ÉN get_team_feed (ingen tvetydig overload)',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt || ' varianter' END));

    SELECT p.oid::regprocedure::text INTO v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
    r := r || jsonb_build_array(jsonb_build_array(
      'A2 signaturen er UENDRET — 1.0 (4) treffer samme funksjon',
      CASE WHEN v_txt = 'get_team_feed(uuid,integer,timestamp with time zone)'
        THEN '✅ ' || v_txt ELSE '❌ ' || v_txt END));

    SELECT string_agg(a.name, ',' ORDER BY a.ord) INTO v_txt
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proargnames, p.proargmodes)
      WITH ORDINALITY AS a(name, mode, ord)
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed'
      AND a.mode = 't';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3 de 21 gamle kolonnene i SAMME rekkefølge, my_reactions SIST',
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
      'A4 fortsatt SECURITY DEFINER og STABLE',
      CASE WHEN v_bool THEN '✅' ELSE '❌' END));

    SELECT array_to_string(p.proconfig, ' | ') INTO v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';
    r := r || jsonb_build_array(jsonb_build_array(
      'A5 search_path satt med pg_temp SIST (punkt 98, gratis her)',
      CASE WHEN v_txt = 'search_path=public, pg_temp'
        THEN '✅' ELSE '❌ ' || coalesce(v_txt, 'ingen') END));

    -- PUBLIC vises i en ACL som en oppføring UTEN mottaker («=X/eier»).
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
      -- format() skriver booleans som t/f.
      CASE WHEN v_txt = 'anon=f auth=t svc=t public=f'
        THEN '✅' ELSE '❌ ' || v_txt END));

    -- ── B: oppførselen, som meg ─────────────────────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_meg, 'role', 'authenticated')::text, true);

    SELECT jsonb_agg(to_jsonb(t) ORDER BY ordinality) INTO nye_rader
    FROM public.get_team_feed(ts_id, 20) WITH ORDINALITY AS t;

    SELECT array_agg((e->>'id')::uuid ORDER BY (e->>'ordinality')::int)
      INTO v_ids FROM jsonb_array_elements(nye_rader) e;
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 rekkefølge: festet først, så nyest → eldst',
      CASE WHEN v_ids = ARRAY[p_festet, p_ny, p_mid, p_gml]
        THEN '✅' ELSE '❌ ' || v_ids::text END));

    -- Alt UNNTATT my_reactions skal være ordrett som før migrasjonen.
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 bakoverkompat: de gamle kolonnene er BIT FOR BIT uendret',
      CASE WHEN (
        SELECT jsonb_agg(e - 'my_reactions' ORDER BY (e->>'ordinality')::int)
        FROM jsonb_array_elements(nye_rader) e
      ) = (
        SELECT jsonb_agg(e ORDER BY (e->>'ordinality')::int)
        FROM jsonb_array_elements(gamle_rader) e
      ) THEN '✅' ELSE '❌ svaret endret seg' END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions'))
      INTO v_arr
    FROM jsonb_array_elements(nye_rader) e WHERE (e->>'id')::uuid = p_mid;
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 REAGERT innlegg: my_reactions bærer min emoji',
      CASE WHEN v_arr = ARRAY['👏'] THEN '✅' ELSE '❌ ' || v_arr::text END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions'))
      INTO v_arr
    FROM jsonb_array_elements(nye_rader) e WHERE (e->>'id')::uuid = p_gml;
    r := r || jsonb_build_array(jsonb_build_array(
      'B4 UREAGERT innlegg: tom array, ikke NULL',
      CASE WHEN v_arr = ARRAY[]::text[] THEN '✅' ELSE '❌ ' || coalesce(v_arr::text,'NULL') END));

    SELECT array(SELECT jsonb_array_elements_text(e->'my_reactions'))
      INTO v_arr
    FROM jsonb_array_elements(nye_rader) e WHERE (e->>'id')::uuid = p_ny;
    r := r || jsonb_build_array(jsonb_build_array(
      'B5 ANDRES reaksjon lekker ikke inn som min',
      CASE WHEN v_arr = ARRAY[]::text[] THEN '✅' ELSE '❌ ' || v_arr::text END));

    -- Paginering: side 1 (lim 2), så cursor = siste created_at.
    SELECT array_agg(f.id ORDER BY f.ordinality) INTO v_ids
    FROM public.get_team_feed(ts_id, 2) WITH ORDINALITY AS f;
    -- ⚠️ CURSOREN SETTES SOM I KLIENTEN, ikke som min(created_at).
    -- `nextFeedCursor` (shared/feedPaging.ts) tar created_at fra den siste
    -- IKKE-FESTEDE raden — nettopp fordi en gammel festet post ligger
    -- øverst og ville gitt en cursor som hopper over halve feeden.
    SELECT f.created_at INTO v_cursor
    FROM public.get_team_feed(ts_id, 2) WITH ORDINALITY AS f
    WHERE NOT f.is_pinned
    ORDER BY f.ordinality DESC
    LIMIT 1;
    r := r || jsonb_build_array(jsonb_build_array(
      'B6 side 1 (lim 2) er de to øverste',
      CASE WHEN v_ids = ARRAY[p_festet, p_ny] THEN '✅' ELSE '❌ ' || v_ids::text END));

    SELECT array_agg(f.id ORDER BY f.ordinality) INTO v_ids
    FROM public.get_team_feed(ts_id, 2, v_cursor) WITH ORDINALITY AS f;
    -- ⚠️ DEN FESTEDE KOMMER IGJEN, og det er MENINGEN — «felle 2» i
    -- shared/feedPaging.ts. `is_pinned DESC` gjelder per side, så en festet
    -- post ligger øverst på hver side; klienten fjerner duplikatet i
    -- `flattenFeedPages` (første forekomst vinner). Uendret av 00086, og
    -- dokumentert her så ingen «retter» det i en senere migrasjon.
    r := r || jsonb_build_array(jsonb_build_array(
      'B7 side 2 via cursor: festet gjentas (felle 2), så neste i rekka',
      CASE WHEN v_ids = ARRAY[p_festet, p_mid] THEN '✅' ELSE '❌ ' || v_ids::text END));

    -- Det brukeren FAKTISK ser: sidene slått sammen og dedupet på id.
    SELECT array_agg(f.id ORDER BY f.ord) INTO v_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord FROM (
        SELECT f1.id, f1.ordinality AS ord
        FROM public.get_team_feed(ts_id, 2) WITH ORDINALITY AS f1
        UNION ALL
        SELECT f2.id, 2 + f2.ordinality
        FROM public.get_team_feed(ts_id, 2, v_cursor) WITH ORDINALITY AS f2
      ) u ORDER BY id, ord
    ) f;
    r := r || jsonb_build_array(jsonb_build_array(
      'B8 dedupet visningsliste = festet, nyest, midt (som før 00086)',
      CASE WHEN v_ids @> ARRAY[p_festet, p_ny, p_mid]
            AND array_length(v_ids, 1) = 3
        THEN '✅' ELSE '❌ ' || v_ids::text END));

    -- Porten står: en som ikke er medlem slipper ikke inn.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.get_team_feed(ts_id, 20);
      r := r || jsonb_build_array(jsonb_build_array(
        'B9 ikke-medlem avvises fortsatt', '❌ slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'B9 ikke-medlem avvises fortsatt', '✅ ' || SQLERRM));
    END;

    -- ── TILBAKEFØRINGEN, ordrett fra fila ───────────────────────
    EXECUTE current_setting('verify00086.rollback');

    SELECT md5(pg_get_functiondef(p.oid)),
           coalesce(array_to_string(p.proacl, ' '), '(ingen)')
      INTO def_etter, acl_etter
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_team_feed';

    r := r || jsonb_build_array(jsonb_build_array(
      'C1 tilbakeføring: definisjonen er BYTE-IDENTISK med før',
      CASE WHEN def_etter = def_for THEN '✅ md5 ' || def_for
        ELSE '❌ ' || coalesce(def_etter,'borte') || ' ≠ ' || def_for END));

    r := r || jsonb_build_array(jsonb_build_array(
      'C2 tilbakeføring: ACL-en er identisk med før',
      CASE WHEN acl_etter = acl_for THEN '✅ ' || acl_etter
        ELSE '❌ ' || coalesce(acl_etter,'borte') || ' ≠ ' || acl_for END));

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_meg, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt FROM public.get_team_feed(ts_id, 20);
    r := r || jsonb_build_array(jsonb_build_array(
      'C3 den tilbakeførte funksjonen svarer som før',
      CASE WHEN v_cnt = 4 THEN '✅' ELSE '❌ ' || v_cnt || ' rader' END));

    -- ── ALT RULLES TILBAKE ──────────────────────────────────────
    RAISE EXCEPTION USING errcode = 'P0986', message = MARKOR;

  EXCEPTION
    WHEN sqlstate 'P0986' THEN
      NULL;  -- planlagt: DDL, fixturer og reaksjoner er borte
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (alt rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_00086 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00086 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat LIKE '✅%') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE' ELSE ' GRØNT' END
  FROM verify_00086;
END $verify$;

SELECT n, test, resultat FROM verify_00086 ORDER BY n;
