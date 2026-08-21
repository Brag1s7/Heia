-- ============================================================
-- verify-00071.sql — kampfeeden (kanonisk kobling + HEIA/kommentarer)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i en SUBTRANSAKSJON som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig, og RIGGEN ER REVET NED VED KONSTRUKSJON: det finnes ingen
-- opprydding å glemme.
--
-- ⚠️ INGEN PUSH SENDES. Trigger-kjeden bak `start_match` og
-- `report_match_event` skriver `notifications` og fyrer deretter
-- `net.http_post` (pg_net). pg_net KØER kallet i en tabell inne i
-- transaksjonen og sender først ETTER COMMIT (00049) — en rollback
-- fjerner køraden, så ingen ekte telefon får noe. Fixturbrukerne har
-- uansett ingen device-token.
--
-- HVA SOM BEVISES (Brages åtte punkter, 2026-08-21):
--   A. Døren: medlem får data; anon og ikke-medlem får ikke.
--   B. HEIA av/på flytter BÅDE antallet og «valgt».
--   C. Ny og slettet kommentar flytter antallet.
--   D. En FERSK kamphendelse har sin kanoniske post i samme
--      transaksjon — altså finnes handlingene i det øyeblikket
--      hendelsen gjør.
--   E. Rytmemarkørene HAR poster. At de ikke får en linje i appen er
--      VÅR regel (`showsEngagement`), ikke manglende data — og det er
--      verdt å vite forskjellen på.
--   F. Mål imot har en kanonisk post som tåler kommentarer.
--   G. Bildehendelse + den kanoniske FALLBACKEN.
--   H. Regresjon: de andre RPC-ene på kampskjermen svarer fortsatt.
--
-- ⚠️ TO TING SOM IKKE KAN BEVISES HER, og som derfor står på
-- telefonkontrollen i stedet:
--   · «uten refetch» (realtime) — SQL kan bevise at posten FINNES
--     straks (D), ikke at kanalen leverer den.
--   · «ingen HEIA på mål imot» er en KLIENTREGEL i denne skiva.
--     Serveren stopper ikke en reaksjon på den posten; feedens egen
--     gate er skive 9. Se F3 — den står som ⚠️, ikke ❌, fordi det er
--     en dokumentert avgrensning og ikke en feil.
--
-- ⚠️ FELLEN FRA verify-00067/00068 GJELDER HER OGSÅ: `set_config(…, true)`
-- er TRANSAKSJONSBUNDET. En fanget exception ruller tilbake GUC-ene satt
-- inne i blokken — så `request.jwt.claims` settes ALLTID UTENFOR hver
-- BEGIN…EXCEPTION-blokk.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00071 (n serial, test text, resultat text);
TRUNCATE verify_00071;

DO $$
DECLARE
  r   jsonb := '[]'::jsonb;
  msg text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid(); ts1 uuid := gen_random_uuid();
  team2    uuid := gen_random_uuid(); ts2 uuid := gen_random_uuid();

  u_trener uuid := gen_random_uuid(); -- trener i T1, blir reporter
  u_mor    uuid := gen_random_uuid(); -- forelder i T1 — «publikum»
  u_fremd  uuid := gen_random_uuid(); -- kun i T2, ingen felles lag

  evt_id   uuid := gen_random_uuid();
  ms_id    uuid := gen_random_uuid();

  me_kick  uuid;  -- avspark (rytmemarkør)
  me_us    uuid;  -- mål for oss
  me_them  uuid;  -- mål imot
  me_end   uuid;  -- slutt (rytmemarkør)

  p_us     uuid;  -- kanonisk post for målet vårt
  p_shot   uuid;  -- bildepost festet på SAMME øyeblikk
  p_free   uuid;  -- frittstående kampbilde, uten match_event_id
  media_id uuid;

  v        jsonb;
  v_cnt    int;
  v_bool   boolean;
  v_txt    text;
  v_arr    text[];
  v_uuid   uuid;

  HEIA CONSTANT text := '👏';
  MARKER CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen alt skjer i ──────────────────────

    -- ══ A. DØREN ══════════════════════════════════════════════
    -- A1/A2 er 00061-fella som test: en DROP+CREATE tar grantene med
    -- seg, og en RPC uten GRANT er en kampskjerm som svarer 401 for
    -- alle. Her er funksjonen ny, men vakten skal stå fra dag én.
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 anon har IKKE EXECUTE på get_match_feed',
      CASE WHEN NOT has_function_privilege('anon',
             'public.get_match_feed(uuid)', 'EXECUTE')
           THEN '✅' ELSE '❌ funksjonsdøren står åpen for anon' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A2 authenticated HAR EXECUTE',
      CASE WHEN has_function_privilege('authenticated',
             'public.get_match_feed(uuid)', 'EXECUTE')
           THEN '✅' ELSE '❌ appen ville fått 401 for alle' END));

    -- ── Fixturer: to lag, tre brukere, én kamp ───────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00071 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify K1'),
           (team2, club_id, sport_id, 'Verify K2');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated)
    VALUES (ts1, team1, 'Verify K1', 'XVRF71AA', true),
           (ts2, team2, 'Verify K2', 'XVRF71AB', true);

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00071+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', 'Verify ' || row_number() OVER ())
    FROM unnest(ARRAY[u_trener, u_mor, u_fremd]) u;

    INSERT INTO public.memberships (user_id, team_space_id, role, status, joined_at)
    VALUES (u_trener, ts1, 'trener',   'active', now()),
           (u_mor,    ts1, 'forelder', 'active', now()),
           (u_fremd,  ts2, 'forelder', 'active', now());

    INSERT INTO public.events (id, team_space_id, type, title, start_time, created_by)
    VALUES (evt_id, ts1, 'kamp', 'Verify K1 – Motstander', now(), u_trener);
    INSERT INTO public.match_sessions (id, event_id, opponent, is_home, status)
    VALUES (ms_id, evt_id, 'Motstander', true, 'planlagt');

    -- A3/A4/A5: gaten inne i funksjonen. Kjøres som de tre rollene.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_trener, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM count(*) FROM get_match_feed(gen_random_uuid());
      r := r || jsonb_build_array(jsonb_build_array(
        'A3 ukjent hendelse avvises', '❌ svarte på en hendelse som ikke finnes'));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'A3 ukjent hendelse avvises',
        CASE WHEN msg = 'Event not found' THEN '✅' ELSE '❌ ' || msg END));
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_fremd, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM count(*) FROM get_match_feed(evt_id);
      r := r || jsonb_build_array(jsonb_build_array(
        'A4 IKKE-MEDLEM avvises', '❌ leste et annet lags kamp'));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'A4 IKKE-MEDLEM avvises',
        CASE WHEN msg = 'Access denied' THEN '✅' ELSE '❌ ' || msg END));
    END;

    -- Ikke tom streng: auth.uid() gjør `current_setting(...)::jsonb`, og
    -- ''::jsonb KASTER. Et claim uten 'sub' er den ekte anon-tilstanden.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('role', 'anon')::text, true);
    BEGIN
      PERFORM count(*) FROM get_match_feed(evt_id);
      r := r || jsonb_build_array(jsonb_build_array(
        'A5 UTEN INNLOGGING avvises av gaten også', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'A5 UTEN INNLOGGING avvises av gaten også',
        CASE WHEN msg = 'Access denied' THEN '✅' ELSE '❌ ' || msg END));
    END;

    -- ══ D+E. KAMPEN SPILLES — gjennom de EKTE RPC-ene ═════════
    -- Ikke håndlagde rader: hele poenget i P1 er at skrivestien
    -- ALLEREDE lager posten. Beviser vi det med egne INSERT-er,
    -- beviser vi ingenting.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_trener, 'role', 'authenticated')::text, true);

    PERFORM start_match(evt_id);
    SELECT me.id INTO me_kick FROM public.match_events me
    WHERE me.match_session_id = ms_id AND me.type = 'avspark';

    SELECT count(*) INTO v_cnt FROM get_match_feed(evt_id);
    r := r || jsonb_build_array(jsonb_build_array(
      'A6 MEDLEM får data (avspark ga én rad)',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ fikk ' || v_cnt || ' rader' END));

    SELECT f.post_type INTO v_txt FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_kick;
    r := r || jsonb_build_array(jsonb_build_array(
      'E1 avspark HAR kanonisk post (linja skjules av VÅR regel, ikke av manglende data)',
      CASE WHEN v_txt = 'match_start' THEN '✅'
           ELSE '❌ fikk ' || COALESCE(v_txt, 'ingen rad') END));

    -- Mål for oss.
    PERFORM report_match_event(ms_id, 'mål', 'home', 'Erlend Hagen');
    SELECT me.id INTO me_us FROM public.match_events me
    WHERE me.match_session_id = ms_id AND me.type = 'mål' AND me.team_side = 'home';

    SELECT f.post_id, f.post_type INTO p_us, v_txt
    FROM get_match_feed(evt_id) f WHERE f.match_event_id = me_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'D1 FERSK hendelse har sin kanoniske post i SAMME transaksjon',
      CASE WHEN p_us IS NOT NULL AND v_txt = 'match_event' THEN '✅'
           ELSE '❌ ' || COALESCE(v_txt, 'ingen post') END));

    -- Mål imot.
    PERFORM report_match_event(ms_id, 'mål', 'away', NULL);
    SELECT me.id INTO me_them FROM public.match_events me
    WHERE me.match_session_id = ms_id AND me.type = 'mål' AND me.team_side = 'away';
    SELECT f.post_id INTO v_uuid FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_them;
    r := r || jsonb_build_array(jsonb_build_array(
      'F1 mål IMOT har en kanonisk post (den kommentaren skal feste seg på)',
      CASE WHEN v_uuid IS NOT NULL THEN '✅' ELSE '❌ ingen post' END));

    -- ══ B. HEIA — antall OG «valgt» ═══════════════════════════
    -- Leses som u_mor (publikum), skrives av begge, slik appen gjør det.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_mor, 'role', 'authenticated')::text, true);

    SELECT f.reaction_counts, f.my_reactions INTO v, v_arr
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 uten reaksjoner: ingen tellere, og my_reactions er TOM (ikke null)',
      CASE WHEN v IS NULL AND v_arr = ARRAY[]::text[] THEN '✅'
           ELSE '❌ counts=' || COALESCE(v::text, 'null')
                || ' mine=' || COALESCE(v_arr::text, 'null') END));

    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (p_us, u_mor, HEIA);
    SELECT (f.reaction_counts->>HEIA)::int, HEIA = ANY(f.my_reactions)
      INTO v_cnt, v_bool
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 HEIA PÅ: antall 1 og valgt tilstand true',
      CASE WHEN v_cnt = 1 AND v_bool THEN '✅'
           ELSE '❌ antall=' || COALESCE(v_cnt::text, 'null')
                || ' valgt=' || COALESCE(v_bool::text, 'null') END));

    -- En ANNEN heier: telleren skal flytte seg, MIN tilstand skal ikke.
    -- Det er nettopp dette skillet `adjustMatchEngagement` bygger på —
    -- `heia` er en delta, `iReacted` en absolutt tilstand.
    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (p_us, u_trener, HEIA);
    SELECT (f.reaction_counts->>HEIA)::int, f.my_reactions INTO v_cnt, v_arr
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 en ANNENS heia teller (2), men er ikke min (fortsatt bare min ene)',
      CASE WHEN v_cnt = 2 AND cardinality(v_arr) = 1 AND HEIA = ANY(v_arr)
           THEN '✅'
           ELSE '❌ antall=' || COALESCE(v_cnt::text, 'null')
                || ' mine=' || COALESCE(v_arr::text, 'null') END));

    -- HEIA AV.
    DELETE FROM public.reactions
    WHERE feed_post_id = p_us AND user_id = u_mor AND emoji = HEIA;
    SELECT (f.reaction_counts->>HEIA)::int, f.my_reactions INTO v_cnt, v_arr
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'B4 HEIA AV: antall tilbake til 1 og valgt tilstand false',
      CASE WHEN v_cnt = 1 AND v_arr = ARRAY[]::text[] THEN '✅'
           ELSE '❌ antall=' || COALESCE(v_cnt::text, 'null')
                || ' mine=' || COALESCE(v_arr::text, 'null') END));

    -- Hvorfor jsonb-formen er riktig: en annen emoji skal ALDRI havne i
    -- 👏-telleren. Det er nettopp derfor RPC-en ikke returnerer et ferdig
    -- `heia_count` — emojien bor i appen, ikke i SQL.
    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (p_us, u_mor, '🎉');
    SELECT (f.reaction_counts->>HEIA)::int INTO v_cnt
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'B5 en annen emoji forstyrrer ikke 👏-telleren',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ antall=' || COALESCE(v_cnt::text,'null') END));
    DELETE FROM public.reactions WHERE feed_post_id = p_us AND emoji = '🎉';

    -- ══ C. KOMMENTARER ════════════════════════════════════════
    INSERT INTO public.comments (feed_post_id, author_id, content)
    VALUES (p_us, u_mor, 'For en scoring!');
    SELECT f.comment_count INTO v_cnt
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'C1 ny kommentar → antall 1',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ antall=' || COALESCE(v_cnt::text,'null') END));

    INSERT INTO public.comments (feed_post_id, author_id, content)
    VALUES (p_us, u_trener, 'Nydelig');
    SELECT f.comment_count INTO v_cnt
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'C2 to kommentarer → antall 2',
      CASE WHEN v_cnt = 2 THEN '✅' ELSE '❌ antall=' || COALESCE(v_cnt::text,'null') END));

    -- Soft-delete (00041) — RPC-en filtrerer på deleted_at IS NULL.
    UPDATE public.comments SET deleted_at = now()
    WHERE feed_post_id = p_us AND author_id = u_mor;
    SELECT f.comment_count INTO v_cnt
    FROM get_match_feed(evt_id) f WHERE f.post_id = p_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'C3 slettet kommentar → antall tilbake til 1',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ antall=' || COALESCE(v_cnt::text,'null') END));

    -- F2: mål IMOT tåler en kommentar (P1 sier den skal være tillatt).
    SELECT f.post_id INTO v_uuid FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_them;
    INSERT INTO public.comments (feed_post_id, author_id, content)
    VALUES (v_uuid, u_mor, 'Uflaks');
    SELECT f.comment_count INTO v_cnt
    FROM get_match_feed(evt_id) f WHERE f.post_id = v_uuid;
    r := r || jsonb_build_array(jsonb_build_array(
      'F2 mål IMOT kan kommenteres (P1)',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ antall=' || COALESCE(v_cnt::text,'null') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'F3 «ingen HEIA på mål imot» er en KLIENTREGEL i skive 4',
      '⚠️ serveren stopper ikke en reaksjon på den posten — feedens gate er skive 9'));

    -- ══ G. BILDE + KANONISK FALLBACK ══════════════════════════
    -- Bildeposten festes på SAMME øyeblikk som målet. Det er derfor
    -- koblingen er 1:N og ikke UNIQUE.
    INSERT INTO public.media (uploaded_by, team_space_id, bucket, storage_path,
                              file_name, mime_type, size_bytes)
    VALUES (u_mor, ts1, 'feed-media', ts1::text || '/verify-d2048.jpg',
            'verify.jpg', 'image/jpeg', 1234)
    RETURNING id INTO media_id;

    INSERT INTO public.feed_posts (team_space_id, author_id, type, content,
                                   event_id, match_event_id)
    VALUES (ts1, u_mor, 'bilde', 'Full jubel', evt_id, me_us)
    RETURNING id INTO p_shot;
    INSERT INTO public.media_attachments (media_id, entity_type, entity_id, sort_order)
    VALUES (media_id, 'feed_post', p_shot, 0);

    SELECT count(*) INTO v_cnt FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'G1 ett øyeblikk kan ha FLERE poster (1:N, derfor ingen UNIQUE)',
      CASE WHEN v_cnt = 2 THEN '✅' ELSE '❌ fikk ' || v_cnt || ' rader' END));

    SELECT f.post_type INTO v_txt FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_us ORDER BY f.created_at ASC, f.post_id ASC LIMIT 1;
    r := r || jsonb_build_array(jsonb_build_array(
      'G2 RPC-en leverer ELDST FØRST — klientens «eldste ikke-bilde» treffer målposten',
      CASE WHEN v_txt = 'match_event' THEN '✅'
           ELSE '❌ første rad var ' || COALESCE(v_txt,'ingen') END));

    -- FALLBACKEN. «Slett innlegget» i feeden treffer i dag målposter
    -- (P3s andre halvvei, ÅPEN i prod til skive 8). Da står øyeblikket
    -- igjen med BARE bildeposten sin, og klienten må falle tilbake til
    -- den — ellers tilbyr raden HEIA uten noe å henge det på.
    UPDATE public.feed_posts SET deleted_at = now() WHERE id = p_us;
    SELECT count(*), min(f.post_type) INTO v_cnt, v_txt
    FROM get_match_feed(evt_id) f WHERE f.match_event_id = me_us;
    r := r || jsonb_build_array(jsonb_build_array(
      'G3 slettet kanonisk post → BARE bilderaden igjen (fallbacken er eneste vei)',
      CASE WHEN v_cnt = 1 AND v_txt = 'bilde' THEN '✅'
           ELSE '❌ ' || v_cnt || ' rader, første=' || COALESCE(v_txt,'ingen') END));
    UPDATE public.feed_posts SET deleted_at = NULL WHERE id = p_us;

    -- Frittstående kampbilde: sin EGEN post, uten match_event_id. Det er
    -- raden bilde-innslaget i forløpet slår opp direkte på post_id.
    INSERT INTO public.feed_posts (team_space_id, author_id, type, content,
                                   event_id, match_event_id)
    VALUES (ts1, u_mor, 'bilde', 'Stemning på sidelinja', evt_id, NULL)
    RETURNING id INTO p_free;
    SELECT count(*) INTO v_cnt FROM get_match_feed(evt_id) f
    WHERE f.post_id = p_free AND f.match_event_id IS NULL;
    r := r || jsonb_build_array(jsonb_build_array(
      'G4 frittstående kampbilde er sin egen rad, uten match_event_id',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌' END));

    -- ══ E2. SLUTT — den siste rytmemarkøren ═══════════════════
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_trener, 'role', 'authenticated')::text, true);
    PERFORM report_match_event(ms_id, 'slutt', NULL, NULL);
    SELECT me.id INTO me_end FROM public.match_events me
    WHERE me.match_session_id = ms_id AND me.type = 'slutt';
    SELECT f.post_type INTO v_txt FROM get_match_feed(evt_id) f
    WHERE f.match_event_id = me_end;
    r := r || jsonb_build_array(jsonb_build_array(
      'E2 slutt HAR også kanonisk post (match_end)',
      CASE WHEN v_txt = 'match_end' THEN '✅'
           ELSE '❌ fikk ' || COALESCE(v_txt,'ingen rad') END));

    -- Soft-slettede poster skal ALDRI ut. (Kontroll på hele kampen.)
    UPDATE public.feed_posts SET deleted_at = now() WHERE id = p_free;
    SELECT count(*) INTO v_cnt FROM get_match_feed(evt_id) f WHERE f.post_id = p_free;
    r := r || jsonb_build_array(jsonb_build_array(
      'G5 soft-slettet post kommer aldri ut av RPC-en',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ leste en slettet post' END));

    -- ══ H. REGRESJON — resten av kampskjermens RPC-er ═════════
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_mor, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM count(*) FROM get_match_photos(evt_id);
      r := r || jsonb_build_array(jsonb_build_array(
        'H1 REGRESJON: get_match_photos svarer fortsatt', '✅'));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'H1 REGRESJON: get_match_photos svarer fortsatt', '❌ ' || msg));
    END;

    BEGIN
      PERFORM count(*) FROM get_team_feed(ts1, 20, NULL);
      r := r || jsonb_build_array(jsonb_build_array(
        'H2 REGRESJON: get_team_feed svarer fortsatt', '✅'));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'H2 REGRESJON: get_team_feed svarer fortsatt', '❌ ' || msg));
    END;

    -- ── ROLLBACK-MARKØREN ────────────────────────────────────
    RAISE EXCEPTION USING errcode = 'P0971', message = MARKER;

  EXCEPTION
    WHEN sqlstate 'P0971' THEN
      NULL;  -- planlagt tilbakerulling — resultatene i r overlever
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (alt rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_00071 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00071 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat = '✅') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            WHEN count(*) FILTER (WHERE resultat LIKE '⚠️%') > 0
              THEN ' GRØNT (med ⚠️-avgrensning)'
            ELSE ' GRØNT' END
  FROM verify_00071;
END $$;

SELECT n, test, resultat FROM verify_00071 ORDER BY n;

-- ============================================================
-- ETTERKONTROLL — riggen skal ikke finnes. Begge skal gi 0.
-- (Rollbacken gjør dette til en formalitet, men en formalitet
-- som koster to sekunder og fanger en feilslått rollback.)
-- ============================================================
SELECT
  (SELECT count(*) FROM public.clubs WHERE name = 'VERIFY-00071 IL')      AS klubber_igjen,
  (SELECT count(*) FROM auth.users WHERE email LIKE 'verify-00071+%')     AS brukere_igjen,
  (SELECT count(*) FROM public.events WHERE title = 'Verify K1 – Motstander') AS hendelser_igjen;
