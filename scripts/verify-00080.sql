-- ============================================================
-- verify-00080.sql — S3a: Broadcast-backend (dual-run)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i en SUBTRANSAKSJON som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig (heller ikke realtime.messages-radene eller pg_net-køen —
-- begge er transaksjonelle). Samme rigg som verify-00067/00075/00079.
--
-- HVA SOM BEVISES
--   A. DØRENE: try_uuid (immutable, tåler søppel), is_match_session_
--      member og alle triggerfunksjonene har SECURITY DEFINER + låst
--      search_path med pg_temp SIST; klientroller har ALDRI EXECUTE
--      på trigger-/konvoluttfunksjonene; ingen EXCEPTION WHEN OTHERS
--      i noen av de nye kroppene; alle 8 triggerne står på.
--   B. POLICYFORMEN: nøyaktig de tre heia-policyene på
--      realtime.messages, alle FOR SELECT TO authenticated, alle
--      bundet til extension = 'broadcast' OG realtime.topic() —
--      og INGEN INSERT-/UPDATE-/DELETE-policy finnes (klientroller
--      kan aldri publisere).
--   C. FANOUTEN: hver skrivevei produserer sine meldinger på riktig
--      topic/event, med komplett konvolutt {v, message_id, entity_id,
--      seq, emitted_at, data}, unike message_id-er — og ALLE rader er
--      private = true med extension = 'broadcast'.
--   D. JOIN-AUTORISASJONEN (emulert: rolle + request.jwt.claims +
--      realtime.topic-GUC-en, som er det realtime.topic() leser):
--      medlem ser sin team-/match-/user-kanal; ikke-medlem, annet
--      lag, andres user-kanal, anon og uuid-søppel NEKTES — søppel
--      uten SQL-feil. De positive probene er kontrollene som beviser
--      at emuleringen faktisk biter — de kjører policyhjelperne
--      (is_team_member/is_match_session_member/try_uuid) SOM
--      authenticated, så manglende EXECUTE-rettighet gir rødt.
--      ⚠️ OBLIGATORISK S3b-EXIT-KRITERIUM: denne emuleringen
--      ERSTATTER IKKE ekte private WebSocket-joins fra klienten
--      (egen kanal tillates, andres/fremmed lags nektes) — se
--      00080-filhodet. S3b lukkes ikke uten den testen.
--   E. REVOKERINGEN (LÅST §0.1-1): tap av aktivt medlemskap (UPDATE
--      og DELETE) gir nøyaktig én membership_revoked KUN på
--      user:{userId} — aldri på team-/match-topics.
--   F. SKRIV OVERLEVER: hard delete av en post med kommentarer
--      (cascade → routing-miss i DELETE-grenen) fullfører stille.
--
-- NB: kjøres som postgres (BYPASSRLS) — derfor ser fixtur-/fanout-
-- probene alle rader, mens D-probene bytter rolle eksplisitt.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00080 (n serial, test text, resultat text);
TRUNCATE verify_00080;

DO $$
DECLARE
  r    jsonb := '[]'::jsonb;
  msg  text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid(); ts1 uuid := gen_random_uuid();
  team2    uuid := gen_random_uuid(); ts2 uuid := gen_random_uuid();

  u_a uuid := gen_random_uuid(); -- medlem i T1 (trener)
  u_b uuid := gen_random_uuid(); -- medlem i T1 (forelder — revokeres i E)
  u_c uuid := gen_random_uuid(); -- medlem KUN i T2 (fremmed-proben)

  ev  uuid := gen_random_uuid(); -- kamp-event i T1
  sid uuid := gen_random_uuid(); -- match_session
  n1  uuid := gen_random_uuid(); -- varsel til A
  p1  uuid := gen_random_uuid(); -- melding i T1
  p2  uuid := gen_random_uuid(); -- bilde i T1 m/ event_id
  p3  uuid := gen_random_uuid(); -- melding i T2
  r1  uuid := gen_random_uuid(); -- reaksjon på p2
  c1  uuid := gen_random_uuid(); -- kommentar på p2
  me1 uuid := gen_random_uuid(); -- match_event

  v_topics text[];
  fn   text;
  bad  text := '';
  v_cnt  int; v_cnt2 int; v_cnt3 int;
  v_bool boolean; v_bool2 boolean; v_txt text; v_json jsonb;

  PROCEDURE_marker CONSTANT text := '__verify_rollback__';
BEGIN
  v_topics := ARRAY[
    'user:'  || u_a::text, 'user:' || u_b::text, 'user:' || u_c::text,
    'team:'  || ts1::text, 'team:' || ts2::text,
    'match:' || sid::text];

  BEGIN  -- ── subtransaksjonen alt skjer i ──────────────────────

    -- ── A. Dørene ────────────────────────────────────────────
    SELECT p.provolatile = 'i',
           has_function_privilege('authenticated', 'public.try_uuid(text)', 'EXECUTE')
           AND NOT has_function_privilege('anon', 'public.try_uuid(text)', 'EXECUTE')
    INTO v_bool, v_bool2
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'try_uuid';
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 try_uuid: IMMUTABLE + authenticated t / anon f',
      CASE WHEN v_bool AND v_bool2 THEN '✅' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A2 try_uuid: søppel/NULL → NULL, gyldig uuid → roundtrip',
      CASE WHEN public.try_uuid('ikke-en-uuid') IS NULL
        AND public.try_uuid(NULL) IS NULL
        AND public.try_uuid(ts1::text) = ts1
        THEN '✅' ELSE '❌' END));

    SELECT p.prosecdef, array_to_string(p.proconfig, ';')
    INTO v_bool, v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_match_session_member';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3 is_match_session_member: SECDEF + search_path m/ pg_temp SIST + auth t / anon f',
      CASE WHEN v_bool AND v_txt LIKE '%search_path=public, pg_temp%'
        AND has_function_privilege('authenticated', 'public.is_match_session_member(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.is_match_session_member(uuid)', 'EXECUTE')
        THEN '✅' ELSE '❌ ' || coalesce(v_txt, 'ingen proconfig') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A4 heia_broadcast_envelope: ingen klientrolle har EXECUTE',
      CASE WHEN NOT has_function_privilege('anon',
          'public.heia_broadcast_envelope(uuid, jsonb, jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated',
          'public.heia_broadcast_envelope(uuid, jsonb, jsonb)', 'EXECUTE')
        THEN '✅' ELSE '❌' END));

    bad := '';
    FOREACH fn IN ARRAY ARRAY[
      'broadcast_on_notifications', 'broadcast_on_feed_posts',
      'broadcast_on_reactions', 'broadcast_on_comments',
      'broadcast_on_match_events', 'broadcast_on_match_sessions',
      'broadcast_on_membership_revoked']
    LOOP
      SELECT p.prosecdef AND array_to_string(p.proconfig, ';')
               LIKE '%search_path=public, pg_temp%'
             AND NOT has_function_privilege('anon', ('public.' || fn || '()'), 'EXECUTE')
             AND NOT has_function_privilege('authenticated', ('public.' || fn || '()'), 'EXECUTE')
      INTO v_bool
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn;
      IF v_bool IS DISTINCT FROM true THEN bad := bad || ' ' || fn; END IF;
    END LOOP;
    r := r || jsonb_build_array(jsonb_build_array(
      'A5 alle 7 triggerfunksjoner: SECDEF + pinnet path + ingen klient-EXECUTE',
      CASE WHEN bad = '' THEN '✅' ELSE '❌' || bad END));

    SELECT count(*) INTO v_cnt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('broadcast_on_notifications', 'broadcast_on_feed_posts',
        'broadcast_on_reactions', 'broadcast_on_comments',
        'broadcast_on_match_events', 'broadcast_on_match_sessions',
        'broadcast_on_membership_revoked', 'heia_broadcast_envelope',
        'try_uuid', 'is_match_session_member')
      AND p.prosrc ILIKE '%WHEN OTHERS%';
    r := r || jsonb_build_array(jsonb_build_array(
      'A6 ingen EXCEPTION WHEN OTHERS i noen ny funksjon (§1.2)',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt || ' treff' END));

    SELECT count(*) INTO v_cnt
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgenabled = 'O'
      AND t.tgname LIKE 'trg_broadcast%'
      AND c.relname IN ('notifications', 'feed_posts', 'reactions',
                        'comments', 'match_events', 'match_sessions',
                        'memberships');
    r := r || jsonb_build_array(jsonb_build_array(
      'A7 alle 8 broadcast-triggerne står PÅ på riktige tabeller',
      CASE WHEN v_cnt = 8 THEN '✅' ELSE '❌ ' || v_cnt || ' av 8' END));

    -- ── B. Policyformen på realtime.messages ─────────────────
    SELECT count(*) INTO v_cnt FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname IN ('heia_user_channel_join', 'heia_team_channel_join',
                         'heia_match_channel_join')
      AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[];
    SELECT count(*) INTO v_cnt2 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages';
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 nøyaktig de 3 heia-policyene, alle SELECT TO authenticated',
      CASE WHEN v_cnt = 3 AND v_cnt2 = 3 THEN '✅'
        ELSE '❌ ' || v_cnt || ' egne av ' || v_cnt2 || ' totalt' END));

    SELECT count(*) INTO v_cnt FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND cmd <> 'SELECT';
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 ingen INSERT-/UPDATE-/DELETE-policy — klienter kan aldri publisere',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt || ' policyer' END));

    SELECT count(*) INTO v_cnt FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND qual LIKE '%broadcast%' AND qual LIKE '%realtime.topic()%';
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 alle 3 policyer bundet til extension=broadcast OG realtime.topic()',
      CASE WHEN v_cnt = 3 THEN '✅' ELSE '❌ ' || v_cnt || ' av 3' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'B4 RLS er PÅ på realtime.messages',
      CASE WHEN (SELECT relrowsecurity FROM pg_class
                 WHERE oid = 'realtime.messages'::regclass)
        THEN '✅' ELSE '❌' END));

    -- ── Fixturer (som postgres) ──────────────────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00080+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', navn)
    FROM (VALUES
      (u_a, 'Verify Medlem A'), (u_b, 'Verify Medlem B'),
      (u_c, 'Verify Fremmed C')) AS t(u, navn);

    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00080 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify T1'),
           (team2, club_id, sport_id, 'Verify T2');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code)
    VALUES (ts1, team1, 'Verify Lag 1', 'XVRF80AA'),
           (ts2, team2, 'Verify Lag 2', 'XVRF80BB');
    INSERT INTO public.memberships
      (user_id, team_space_id, role, status, joined_at)
    VALUES (u_a, ts1, 'trener',   'active', now() - interval '3 days'),
           (u_b, ts1, 'forelder', 'active', now() - interval '2 days'),
           (u_c, ts2, 'trener',   'active', now() - interval '1 day');

    INSERT INTO public.events (id, team_space_id, type, title, start_time)
    VALUES (ev, ts1, 'kamp', 'Verify kamp', now() - interval '30 min');
    INSERT INTO public.match_sessions (id, event_id, opponent, status)
    VALUES (sid, ev, 'Verify Motstander', 'planlagt');

    -- Skriveveiene som skal kringkaste:
    INSERT INTO public.notifications (id, user_id, team_space_id, category, title, body)
    VALUES (n1, u_a, ts1, 'new_post', 'v', 'v');

    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content)
    VALUES (p1, ts1, u_a, 'melding', 'verify p1');
    UPDATE public.feed_posts SET deleted_at = now() WHERE id = p1;

    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content, event_id)
    VALUES (p2, ts1, u_a, 'bilde', 'verify p2', ev);

    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content)
    VALUES (p3, ts2, u_c, 'melding', 'verify p3');

    INSERT INTO public.reactions (id, feed_post_id, user_id, emoji)
    VALUES (r1, p2, u_b, '👏');
    DELETE FROM public.reactions WHERE id = r1;

    INSERT INTO public.comments (id, feed_post_id, author_id, content)
    VALUES (c1, p2, u_b, 'verify c1');

    INSERT INTO public.match_events
      (id, match_session_id, type, minute, sequence)
    VALUES (me1, sid, 'melding', 1, 1);
    DELETE FROM public.match_events WHERE id = me1;

    UPDATE public.match_sessions
    SET status = 'live', started_at = now() WHERE id = sid;

    -- ── C. Fanouten (postgres har BYPASSRLS — ser alt) ───────
    -- Scopet på entity_id: comment-/reaction-/session-triggerne fra
    -- 00023/00024/00054 skaper EGNE varselrader under fixturene, og de
    -- kringkastes også — kun n1-leveringen telles her.
    SELECT count(*), min(payload::text)::jsonb INTO v_cnt, v_json
    FROM realtime.messages
    WHERE topic = 'user:' || u_a::text AND event = 'notif'
      AND payload->>'entity_id' = n1::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'C1 varsel → user:{A} ''notif'' m/ konvolutt (rad-id + created_at i seq)',
      CASE WHEN v_cnt = 1 AND (v_json->>'v')::int = 1
        AND v_json->>'entity_id' = n1::text
        AND v_json->'seq'->>'id' = n1::text
        AND v_json->'data'->>'category' = 'new_post'
        THEN '✅' ELSE '❌ ' || v_cnt ||
          ' rader (0 = sjekk at dagens realtime.messages-partisjon finnes)' END));

    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'team:' || ts1::text AND event = 'feed_post';
    SELECT count(*) INTO v_cnt2 FROM realtime.messages
    WHERE topic = 'team:' || ts1::text AND event = 'feed_post'
      AND payload->'data'->>'op' = 'UPDATE'
      AND payload->'data'->>'deleted_at' IS NOT NULL;
    r := r || jsonb_build_array(jsonb_build_array(
      'C2 feed_posts → team ''feed_post'': p1-insert + p1-softdelete + p2 = 3, én m/ op=UPDATE',
      CASE WHEN v_cnt = 3 AND v_cnt2 = 1 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    SELECT count(*), min(payload->>'entity_id') INTO v_cnt, v_txt
    FROM realtime.messages
    WHERE topic = 'match:' || sid::text AND event = 'photo';
    r := r || jsonb_build_array(jsonb_build_array(
      'C3 bilde m/ event_id speiles → match ''photo'' (1 rad, entity=p2)',
      CASE WHEN v_cnt = 1 AND v_txt = p2::text THEN '✅'
        ELSE '❌ ' || v_cnt END));

    SELECT count(*) FILTER (WHERE topic = 'team:'  || ts1::text),
           count(*) FILTER (WHERE topic = 'match:' || sid::text),
           count(DISTINCT payload->'data'->>'op')
    INTO v_cnt, v_cnt2, v_cnt3
    FROM realtime.messages
    WHERE event = 'reaction' AND topic = ANY (v_topics);
    r := r || jsonb_build_array(jsonb_build_array(
      'C4 reaction: 2 på team + 2 på match (op INSERT og DELETE)',
      CASE WHEN v_cnt = 2 AND v_cnt2 = 2 AND v_cnt3 = 2 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 || '/' || v_cnt3 END));

    SELECT count(*) FILTER (WHERE topic = 'team:'  || ts1::text),
           count(*) FILTER (WHERE topic = 'match:' || sid::text)
    INTO v_cnt, v_cnt2
    FROM realtime.messages
    WHERE event = 'comment' AND topic = ANY (v_topics);
    r := r || jsonb_build_array(jsonb_build_array(
      'C5 comment: 1 på team + 1 på match',
      CASE WHEN v_cnt = 1 AND v_cnt2 = 1 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    SELECT count(*),
           count(*) FILTER (WHERE payload->'seq' = '1'::jsonb),
           count(*) FILTER (WHERE payload->'data'->>'op' = 'DELETE')
    INTO v_cnt, v_cnt2, v_cnt3
    FROM realtime.messages
    WHERE topic = 'match:' || sid::text AND event = 'match_event';
    r := r || jsonb_build_array(jsonb_build_array(
      'C6 match_event: INSERT+DELETE = 2, begge seq=1, én op=DELETE',
      CASE WHEN v_cnt = 2 AND v_cnt2 = 2 AND v_cnt3 = 1 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 || '/' || v_cnt3 END));

    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'match:' || sid::text AND event = 'session'
      AND payload->'seq'->>'status' = 'live';
    SELECT count(*) INTO v_cnt2 FROM realtime.messages
    WHERE topic = 'team:' || ts1::text AND event = 'live'
      AND payload->>'entity_id' = sid::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'C7 session-UPDATE: 1 ''session'' på match + 1 ''live'' på team (seq status=live)',
      CASE WHEN v_cnt = 1 AND v_cnt2 = 1 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    SELECT count(*), count(*) FILTER (WHERE private IS TRUE
                                        AND extension = 'broadcast')
    INTO v_cnt, v_cnt2
    FROM realtime.messages WHERE topic = ANY (v_topics);
    r := r || jsonb_build_array(jsonb_build_array(
      'C8 ALLE ' || v_cnt || ' meldingene er private=true m/ extension=broadcast',
      CASE WHEN v_cnt > 0 AND v_cnt = v_cnt2 THEN '✅'
        ELSE '❌ ' || v_cnt2 || ' av ' || v_cnt END));

    SELECT count(*),
           count(DISTINCT payload->>'message_id'),
           count(*) FILTER (WHERE payload ?& ARRAY[
             'v', 'message_id', 'entity_id', 'seq', 'emitted_at', 'data'])
    INTO v_cnt, v_cnt2, v_cnt3
    FROM realtime.messages WHERE topic = ANY (v_topics);
    r := r || jsonb_build_array(jsonb_build_array(
      'C9 konvolutten komplett på alle, message_id unik per levering',
      CASE WHEN v_cnt = v_cnt2 AND v_cnt = v_cnt3 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 || '/' || v_cnt3 END));

    -- ── D. Join-autorisasjonen (rolle + claims + topic-GUC) ──
    -- Positive prober (D1/D3/D4/D6) er kontrollene som beviser at
    -- emuleringen biter; nekt-probene er poenget.
    EXECUTE 'SET LOCAL ROLE authenticated';

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('realtime.topic', 'team:' || ts1::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'team:' || ts1::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'D1 medlem A joiner team:T1 → ser kanalens meldinger',
      CASE WHEN v_cnt > 0 THEN '✅' ELSE '❌ 0 rader' END));

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'team:' || ts1::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'D2 ikke-medlem C mot team:T1 → NEKT (0 rader)',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));

    PERFORM set_config('realtime.topic', 'team:' || ts2::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'team:' || ts2::text;  -- C er medlem i T2: kontroll
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt2 FROM realtime.messages
    WHERE topic = 'team:' || ts2::text;  -- A er IKKE medlem i T2
    r := r || jsonb_build_array(jsonb_build_array(
      'D3 team:T2 har meldinger (C ser dem) — A NEKTES',
      CASE WHEN v_cnt > 0 AND v_cnt2 = 0 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    PERFORM set_config('realtime.topic', 'user:' || u_a::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'user:' || u_a::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'D4 A joiner sin egen user-kanal → ser varselet',
      CASE WHEN v_cnt > 0 THEN '✅' ELSE '❌ 0 rader' END));

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'user:' || u_a::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'D5 B mot A sin user-kanal → NEKT (0 rader)',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('realtime.topic', 'match:' || sid::text, true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'match:' || sid::text;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt2 FROM realtime.messages
    WHERE topic = 'match:' || sid::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'D6 match-kanalen: lagmedlem A ser — fremmed C NEKTES',
      CASE WHEN v_cnt > 0 AND v_cnt2 = 0 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
      PERFORM set_config('realtime.topic', 'team:ikke-en-uuid', true);
      SELECT count(*) INTO v_cnt FROM realtime.messages
      WHERE topic = ANY (v_topics);
      r := r || jsonb_build_array(jsonb_build_array(
        'D7 uuid-søppel i topic → NEKT uten SQL-feil',
        CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'D7 uuid-søppel i topic → NEKT uten SQL-feil', '❌ exception: ' || msg));
      EXECUTE 'SET LOCAL ROLE authenticated';
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('realtime.topic',
      'match:00000000-0000-0000-0000-000000000000', true);
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = ANY (v_topics);
    r := r || jsonb_build_array(jsonb_build_array(
      'D8 gyldig men ukjent session-uuid → NEKT (0 rader)',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));

    EXECUTE 'RESET ROLE';
    BEGIN
      EXECUTE 'SET LOCAL ROLE anon';
      PERFORM set_config('realtime.topic', 'team:' || ts1::text, true);
      SELECT count(*) INTO v_cnt FROM realtime.messages
      WHERE topic = 'team:' || ts1::text;
      r := r || jsonb_build_array(jsonb_build_array(
        'D9 anon → NEKT (policyene er TO authenticated)',
        CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'D9 anon → NEKT (policyene er TO authenticated)',
        '✅ (privilegienekt)'));
    END;
    EXECUTE 'RESET ROLE';

    -- ── E. Revokeringen (LÅST §0.1-1) ────────────────────────
    UPDATE public.memberships
    SET status = 'removed', left_at = now(),
        left_reason = 'left', ended_by = u_b
    WHERE user_id = u_b AND team_space_id = ts1 AND status = 'active';

    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'user:' || u_b::text AND event = 'membership_revoked'
      AND payload->'data'->>'team_space_id' = ts1::text;
    r := r || jsonb_build_array(jsonb_build_array(
      'E1 status active→removed: nøyaktig 1 membership_revoked på user:{B}',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt END));

    DELETE FROM public.memberships
    WHERE user_id = u_c AND team_space_id = ts2;
    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE topic = 'user:' || u_c::text AND event = 'membership_revoked'
      AND payload->'data'->>'op' = 'DELETE';
    r := r || jsonb_build_array(jsonb_build_array(
      'E2 hard DELETE av aktiv rad: 1 membership_revoked på user:{C}',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt END));

    SELECT count(*) INTO v_cnt FROM realtime.messages
    WHERE event = 'membership_revoked' AND topic = ANY (v_topics)
      AND (topic LIKE 'team:%' OR topic LIKE 'match:%');
    r := r || jsonb_build_array(jsonb_build_array(
      'E3 membership_revoked finnes ALDRI på team-/match-topics',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt END));

    -- ── F. Skriv overlever routing-miss (cascade) ────────────
    DELETE FROM public.feed_posts WHERE id = p2;  -- c1 kaskaderer
    SELECT count(*) INTO v_cnt FROM public.feed_posts WHERE id = p2;
    SELECT count(*) INTO v_cnt2 FROM realtime.messages
    WHERE topic = 'team:' || ts1::text AND event = 'comment';
    r := r || jsonb_build_array(jsonb_build_array(
      'F1 hard delete m/ kommentar-cascade fullfører stille (ingen ny melding)',
      CASE WHEN v_cnt = 0 AND v_cnt2 = 1 THEN '✅'
        ELSE '❌ ' || v_cnt || '/' || v_cnt2 END));

    -- ── ROLLBACK-MARKØREN: alt fixture-arbeid rulles tilbake ─
    RAISE EXCEPTION USING errcode = 'P0968', message = PROCEDURE_marker;

  EXCEPTION
    WHEN sqlstate 'P0968' THEN
      NULL;  -- planlagt tilbakerulling — resultatene i r overlever
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (alt rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_00080 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00080 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat LIKE '✅%') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%'
                                         OR resultat LIKE '⛔%') > 0
              THEN ' — SE ❌-RADENE'
            ELSE ' GRØNT' END
  FROM verify_00080;
END $$;

SELECT n, test, resultat FROM verify_00080 ORDER BY n;

-- ============================================================
-- ETTERKONTROLL UTENFOR SQL (som for 00079):
--   Logs Explorer-spørringen for trigger-warnings (skal være tom
--   utenom bevisste tester):
--     select event_message, timestamp
--     from postgres_logs
--     cross join unnest(metadata) m
--     cross join unnest(m.parsed) p
--     where p.error_severity = 'WARNING'
--       and (event_message like '%heia_broadcast%'
--            or event_message like '%realtime.send%')
--     order by timestamp desc;
-- ============================================================
