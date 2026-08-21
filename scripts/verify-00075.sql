-- ============================================================
-- verify-00075.sql — «Korriger mål» (skive 8)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i ÉN subtransaksjon som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig, og RIGGEN ER REVET NED VED KONSTRUKSJON.
--
-- Samme mønster som verify-00071 / verify-00072-00073: én DO-blokk,
-- én ytre BEGIN … EXCEPTION, `set_config` INNE i subtransaksjonen.
--
-- ⚠️ INGEN PUSH SENDES: pg_net KØER kallet i transaksjonen og sender
-- først etter COMMIT (00049), så rollbacken fjerner køraden.
--
-- ---------------------------------------------------------------------------
-- HVA SOM BEVISES
--
--   A. DØRENE + STRUKTUREN — grant OG REVOKE (00076), låst search_path,
--      REPLICA IDENTITY, og at den frie DELETE-policyen på match_events er
--      BORTE. ⚠️ A2/A6/A7 dekker 00076, som rettet at 00075 kun gjorde GRANT:
--      en funksjon fødes med EXECUTE til PUBLIC, så en GRANT alene stenger
--      ingenting.
--   B. REDIGERING: eget mål → mål imot. Stillingen regnes om, ugyldige
--      HEIA slettes, KOMMENTARENE BEHOLDES.
--   C. ⭐ SNAPSHOTENE: teksten på et SENERE mål skrives om når et
--      TIDLIGERE mål rettes. Det er hele grunnen til at korrigeringen
--      ikke kan være en enkel UPDATE.
--   D. ⭐ SELVREPARASJON: stillingen telles opp fra målhistorikken.
--      Bevises ved å sette den bevisst FEIL først.
--   E. ANNULLERING: systemposten og engasjementet forsvinner —
--      BRUKERENS BILDEPOST OVERLEVER.
--   F. HALVVEI 2: «Slett innlegget» avvises på en målpost, men virker
--      fortsatt på et bilde.
--   G. SKRIVESIDENS HEIA-GATE: basen avviser HEIA på et mål imot, men
--      IKKE på et bilde som henger på det samme øyeblikket.
--   H. TILGANG + AUDIT.
--
-- ⚠️ TRE TING SOM IKKE KAN BEVISES HER, og som derfor står igjen på
-- telefonen:
--   · UPDATE-policyene på feed_posts. Blokka kjører som eier, og en
--     tabelleier går utenom RLS. A5 sjekker derfor STRUKTUREN
--     (policyen finnes og nevner match_event_id), ikke oppførselen.
--   · at annulleringen når ANDRE telefoner. Realtime kan ikke
--     observeres i SQL; REPLICA IDENTITY (A3) er forutsetningen, ikke
--     beviset.
--   · korrigeringsvarselets PUSH. G/H beviser at inbox-raden skrives.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_0075 (n serial, test text, resultat text);
TRUNCATE verify_0075;

DO $$
DECLARE
  r   jsonb := '[]'::jsonb;
  msg text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid();
  ts1      uuid := gen_random_uuid();
  u_trener uuid := gen_random_uuid();
  u_medlem uuid := gen_random_uuid();
  evt_id   uuid := gen_random_uuid();
  ms_id    uuid;

  goal1    uuid;   -- første mål, VÅRT
  goal2    uuid;   -- andre mål, VÅRT
  post1    uuid;   -- systemposten til goal1
  post2    uuid;   -- systemposten til goal2
  photo1   uuid;   -- brukerens bildepost, festet til goal1

  v        jsonb;
  v_int    int;
  v_txt    text;
  v_bool   boolean;
  v_home   int;
  v_away   int;

  MARKER CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen ALT skjer i ──────────────────────

    -- ══ A. DØRENE OG STRUKTUREN ═══════════════════════════════
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 authenticated HAR EXECUTE på correct_match_goal',
      CASE WHEN has_function_privilege('authenticated',
             'public.correct_match_goal(uuid,text,text,text,text)', 'EXECUTE')
           THEN '✅' ELSE '❌ korrigeringen er utilgjengelig for appen' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A2 anon har IKKE EXECUTE på correct_match_goal',
      CASE WHEN NOT has_function_privilege('anon',
             'public.correct_match_goal(uuid,text,text,text,text)', 'EXECUTE')
           THEN '✅' ELSE '❌ korrigeringsdøren står åpen for anon' END));

    -- ⚠️ A2 OVER ER IKKE PYNT — DEN VILLE FANGET 00075s ENE FEIL.
    -- En funksjon FØDES med EXECUTE til PUBLIC, og `anon` er medlem av
    -- PUBLIC. 00075 gjorde bare GRANT og stoppet der, så anon nådde
    -- funksjonskroppen og fikk «Not authenticated» (P0001) i stedet for
    -- «permission denied» (42501). Lukket i 00076. Kjør bevisfila FØR push
    -- neste gang, ikke etter.

    SELECT count(*) INTO v_int
    FROM (VALUES
      ('public.rebuild_match_feed_texts(uuid)'),
      ('public.match_event_headline(text,text,text,text,int,int)'),
      ('public.enforce_no_heia_on_opponent_goal()')
    ) f(sig)
    WHERE has_function_privilege('anon', f.sig, 'EXECUTE')
       OR has_function_privilege('authenticated', f.sig, 'EXECUTE');

    r := r || jsonb_build_array(jsonb_build_array(
      'A6 ⭐ de INTERNE hjelperne er lukket for begge klientroller',
      CASE WHEN v_int = 0 THEN '✅'
           ELSE '❌ ' || v_int || ' av 3 kan kalles utenfra — '
             || 'rebuild_match_feed_texts SKRIVER til feed_posts' END));

    -- ⚠️ En SECURITY DEFINER-funksjon uten låst search_path kjører med
    -- KALLERENS søkesti, altså eierens rettigheter mot kallerens objekter.
    --
    -- ⚠️ `pg_temp` MÅ STÅ EKSPLISITT SIST, og testen krever nettopp den
    -- strengen. Utelates `pg_temp`, søkes det likevel — IMPLISITT FØRST — og
    -- da kan en midlertidig tabell skygge for en ekte. `= public` alene
    -- (00076) var derfor ikke beskyttelse; 00077 rettet det. En test som bare
    -- sjekket at stien var «satt» ville godtatt begge.
    SELECT count(*) INTO v_int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('correct_match_goal', 'rebuild_match_feed_texts',
                        'match_event_headline', 'enforce_no_heia_on_opponent_goal',
                        'report_match_event', 'soft_delete_post')
      AND 'search_path=public, pg_temp' = ANY(p.proconfig);

    r := r || jsonb_build_array(jsonb_build_array(
      'A7 ⭐ alle seks har search_path = public, pg_temp (pg_temp SIST)',
      CASE WHEN v_int = 6 THEN '✅ 6/6'
           ELSE '❌ ' || v_int || ' av 6 — se 00077' END));

    SELECT relreplident = 'f' INTO v_bool
    FROM pg_class WHERE oid = 'public.match_events'::regclass;
    r := r || jsonb_build_array(jsonb_build_array(
      'A3 ⭐ match_events har REPLICA IDENTITY FULL',
      CASE WHEN v_bool THEN '✅'
           ELSE '❌ en annullering når ALDRI tilskuerne' END));

    SELECT count(*) INTO v_int
    FROM pg_policy WHERE polrelid = 'public.match_events'::regclass
      AND polcmd = 'd';
    r := r || jsonb_build_array(jsonb_build_array(
      'A4 ⭐ den frie DELETE-policyen er BORTE',
      CASE WHEN v_int = 0 THEN '✅'
           ELSE '❌ ' || v_int || ' DELETE-policy(er) igjen — halvvei 1 står åpen' END));

    SELECT count(*) INTO v_int
    FROM pg_policy p
    WHERE p.polrelid = 'public.feed_posts'::regclass
      AND p.polcmd = 'w'
      AND pg_get_expr(p.polqual, p.polrelid) LIKE '%match_event_id%';
    r := r || jsonb_build_array(jsonb_build_array(
      'A5 begge UPDATE-policyene på feed_posts unntar målposter',
      CASE WHEN v_int = 2 THEN '✅'
           ELSE '❌ fant ' || v_int || ' av 2 (⚠️ struktur, ikke oppførsel)' END));

    -- ── Fixturer: ett lag, én trener, ett vanlig medlem, én kamp ──
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-0075 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify U1');
    INSERT INTO public.team_spaces (id, team_id, display_name)
    VALUES (ts1, team1, 'Verify U1');

    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
                            raw_user_meta_data, aud, role)
    VALUES
      (u_trener, 'verify-0075+trener@example.test', 'x', now(),
       '{"display_name":"Verify Trener"}'::jsonb, 'authenticated', 'authenticated'),
      (u_medlem, 'verify-0075+medlem@example.test', 'x', now(),
       '{"display_name":"Verify Medlem"}'::jsonb, 'authenticated', 'authenticated');

    INSERT INTO public.profiles (id, display_name)
    VALUES (u_trener, 'Verify Trener'), (u_medlem, 'Verify Medlem')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.memberships (user_id, team_space_id, role, status)
    VALUES (u_trener, ts1, 'trener', 'active'),
           (u_medlem, ts1, 'spiller', 'active');

    INSERT INTO public.events (id, team_space_id, type, title, start_time, created_by)
    VALUES (evt_id, ts1, 'kamp', 'Verify U1 – Motstander',
            now() - interval '1 hour', u_trener);

    INSERT INTO public.match_sessions (event_id, opponent, is_home, status)
    VALUES (evt_id, 'Verify Motstander', true, 'planlagt')
    RETURNING id INTO ms_id;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u_trener::text, 'role', 'authenticated')::text,
      true);

    -- ── To mål, begge VÅRE. Stillingen skal bli 2–0. ──────────
    PERFORM start_match(evt_id);
    v := report_match_event(ms_id, 'mål', 'home', 'Ada');
    goal1 := (v->>'match_event_id')::uuid;
    v := report_match_event(ms_id, 'mål', 'home', 'Bo');
    goal2 := (v->>'match_event_id')::uuid;

    SELECT fp.id INTO post1 FROM public.feed_posts fp
    WHERE fp.match_event_id = goal1 AND fp.type = 'match_event';
    SELECT fp.id INTO post2 FROM public.feed_posts fp
    WHERE fp.match_event_id = goal2 AND fp.type = 'match_event';

    SELECT home_score, away_score INTO v_home, v_away
    FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'A6 utgangspunktet: 2–0, to systemposter',
      CASE WHEN v_home = 2 AND v_away = 0
            AND post1 IS NOT NULL AND post2 IS NOT NULL
           THEN '✅' ELSE '❌ fikk ' || v_home || '–' || v_away END));

    -- Medlemmet heier på mål 1 og kommenterer det. Bildeposten
    -- festes til det samme øyeblikket.
    INSERT INTO public.reactions (feed_post_id, user_id, emoji)
    VALUES (post1, u_medlem, '👏');
    INSERT INTO public.comments (feed_post_id, author_id, content)
    VALUES (post1, u_medlem, 'For en scoring!');
    INSERT INTO public.feed_posts
      (team_space_id, author_id, type, content, event_id, match_event_id)
    VALUES (ts1, u_medlem, 'bilde', 'Bilde fra målet', evt_id, goal1)
    RETURNING id INTO photo1;

    -- ══ G. SKRIVESIDENS HEIA-GATE ═════════════════════════════
    -- Målet er fortsatt VÅRT her, så heiet over gikk gjennom.
    SELECT count(*) INTO v_int FROM public.reactions WHERE feed_post_id = post1;
    r := r || jsonb_build_array(jsonb_build_array(
      'G1 HEIA på VÅRT mål slipper gjennom',
      CASE WHEN v_int = 1 THEN '✅' ELSE '❌ fikk ' || v_int END));

    -- ══ B. REDIGERING: mål 1 blir et mål IMOT ═════════════════
    v := public.correct_match_goal(goal1, 'edit', 'away', 'Ukjent', 'Feilregistrert');

    SELECT home_score, away_score INTO v_home, v_away
    FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'B1 ⭐ stillingen regnet om: 2–0 → 1–1',
      CASE WHEN v_home = 1 AND v_away = 1 THEN '✅'
           ELSE '❌ fikk ' || v_home || '–' || v_away END));

    SELECT team_side INTO v_txt FROM public.match_events WHERE id = goal1;
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 hendelsen er nå away',
      CASE WHEN v_txt = 'away' THEN '✅' ELSE '❌ fikk ' || COALESCE(v_txt,'NULL') END));

    SELECT player_name INTO v_txt FROM public.match_events WHERE id = goal1;
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 målscorer lagres i player_name',
      CASE WHEN v_txt = 'Ukjent' THEN '✅' ELSE '❌ fikk ' || COALESCE(v_txt,'NULL') END));

    SELECT count(*) INTO v_int FROM public.reactions WHERE feed_post_id = post1;
    r := r || jsonb_build_array(jsonb_build_array(
      'B4 ⭐ ugyldige HEIA er slettet (P1)',
      CASE WHEN v_int = 0 THEN '✅' ELSE '❌ ' || v_int || ' HEIA står igjen på et mål imot' END));

    SELECT count(*) INTO v_int
    FROM public.comments WHERE feed_post_id = post1 AND deleted_at IS NULL;
    r := r || jsonb_build_array(jsonb_build_array(
      'B5 ⭐ KOMMENTARENE BEHOLDES',
      CASE WHEN v_int = 1 THEN '✅' ELSE '❌ fant ' || v_int || ' — samtalen er lagets' END));

    -- ══ H1-H3. KORRIGERINGSVARSELET ══════════════════════════
    -- Stillingen gikk fra 2–0 til 1–1, altså har en telefon ALLEREDE
    -- vist noe galt. Da skal den få vite det.
    SELECT count(*) INTO v_int FROM public.notifications n
    WHERE n.user_id = u_medlem AND n.data->>'type' = 'match_correction';
    r := r || jsonb_build_array(jsonb_build_array(
      'H1 ⭐ korrigeringsvarsel sendt da stillingen endret seg',
      CASE WHEN v_int = 1 THEN '✅' ELSE '❌ fikk ' || v_int END));

    SELECT n.body INTO v_txt FROM public.notifications n
    WHERE n.user_id = u_medlem AND n.data->>'type' = 'match_correction' LIMIT 1;
    r := r || jsonb_build_array(jsonb_build_array(
      'H2 varselet bærer den RIKTIGE stillingen',
      CASE WHEN v_txt LIKE '%1–1%' THEN '✅'
           ELSE '❌ ' || COALESCE(v_txt, 'NULL') END));

    SELECT count(*) INTO v_int FROM public.notifications n
    WHERE n.user_id = u_trener AND n.data->>'type' = 'match_correction';
    r := r || jsonb_build_array(jsonb_build_array(
      'H3 den som rettet får ikke sitt eget varsel',
      CASE WHEN v_int = 0 THEN '✅' ELSE '❌ fikk ' || v_int END));

    -- ══ C. SNAPSHOTENE ════════════════════════════════════════
    SELECT content INTO v_txt FROM public.feed_posts WHERE id = post1;
    r := r || jsonb_build_array(jsonb_build_array(
      'C1 posten til det RETTEDE målet er skrevet om',
      CASE WHEN v_txt LIKE 'Mål til Verify Motstander.%0–1%' THEN '✅'
           ELSE '❌ ' || COALESCE(left(v_txt, 60), 'NULL') END));

    SELECT content INTO v_txt FROM public.feed_posts WHERE id = post2;
    r := r || jsonb_build_array(jsonb_build_array(
      'C2 ⭐ det SENERE målets post er også rettet (2–0 → 1–1)',
      CASE WHEN v_txt LIKE '%1–1%' THEN '✅'
           ELSE '❌ ' || COALESCE(left(v_txt, 60), 'NULL')
             || ' — stillingssnapshotet står feil i feeden' END));

    SELECT content INTO v_txt FROM public.feed_posts WHERE id = photo1;
    r := r || jsonb_build_array(jsonb_build_array(
      'C3 brukerens bildepost er IKKE omskrevet',
      CASE WHEN v_txt = 'Bilde fra målet' THEN '✅'
           ELSE '❌ ' || COALESCE(v_txt, 'NULL') END));

    -- ══ G2/G3. HEIA-GATEN ETTER AT MÅLET BLE «IMOT» ═══════════
    BEGIN
      INSERT INTO public.reactions (feed_post_id, user_id, emoji)
      VALUES (post1, u_medlem, '👏');
      r := r || jsonb_build_array(jsonb_build_array(
        'G2 ⭐ basen avviser HEIA på mål imot',
        '❌ reaksjonen ble skrevet — skrivesidens gate mangler'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'G2 ⭐ basen avviser HEIA på mål imot', '✅'));
    END;

    BEGIN
      INSERT INTO public.reactions (feed_post_id, user_id, emoji)
      VALUES (photo1, u_medlem, '👏');
      r := r || jsonb_build_array(jsonb_build_array(
        'G3 ⭐ HEIA på BILDET i samme øyeblikk slipper gjennom', '✅'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'G3 ⭐ HEIA på BILDET i samme øyeblikk slipper gjennom',
        '❌ gaten er FOR BRED — den tok brukerens bilde med seg'));
    END;

    -- ══ D1. EN STILLE KORRIGERING ═════════════════════════════
    -- Bare målscorerens navn rettes. Ingen telefon har vist noe galt,
    -- og da skal det IKKE komme et varsel. Det er den halvdelen av
    -- regelen som er lett å bygge feil.
    PERFORM public.correct_match_goal(goal2, 'edit', 'home', 'Bea', NULL);

    SELECT count(*) INTO v_int FROM public.notifications n
    WHERE n.user_id = u_medlem AND n.data->>'type' = 'match_correction';
    r := r || jsonb_build_array(jsonb_build_array(
      'D1 ⭐ navnerettelse gir INGEN nytt varsel (fortsatt 1)',
      CASE WHEN v_int = 1 THEN '✅'
           ELSE '❌ fikk ' || v_int || ' — laget varsles om ingenting' END));

    -- ══ D2. SELVREPARASJON ════════════════════════════════════
    -- Stillingen settes bevisst feil. En korrigering som «trekker fra
    -- én» ville videreført feilen; en opptelling reparerer den.
    UPDATE public.match_sessions SET home_score = 9, away_score = 9
    WHERE id = ms_id;

    PERFORM public.correct_match_goal(goal2, 'edit', 'home', 'Bo', NULL);

    SELECT home_score, away_score INTO v_home, v_away
    FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'D2 ⭐ stillingen TELLES OPP, ikke justeres (9–9 → 1–1)',
      CASE WHEN v_home = 1 AND v_away = 1 THEN '✅'
           ELSE '❌ fikk ' || v_home || '–' || v_away END));

    -- ══ E. ANNULLERING ════════════════════════════════════════
    PERFORM public.correct_match_goal(goal1, 'cancel');

    SELECT count(*) INTO v_int FROM public.match_events WHERE id = goal1;
    r := r || jsonb_build_array(jsonb_build_array(
      'E1 hendelsen er borte fra kampforløpet',
      CASE WHEN v_int = 0 THEN '✅' ELSE '❌ står igjen' END));

    SELECT deleted_at IS NOT NULL INTO v_bool
    FROM public.feed_posts WHERE id = post1;
    r := r || jsonb_build_array(jsonb_build_array(
      'E2 systemposten er fjernet fra feeden',
      CASE WHEN v_bool THEN '✅' ELSE '❌ målposten ligger igjen' END));

    SELECT count(*) INTO v_int FROM public.notifications
    WHERE source_entity_type = 'feed_post' AND source_entity_id = post1;
    r := r || jsonb_build_array(jsonb_build_array(
      'E3 innboksvarslene for målet er borte',
      CASE WHEN v_int = 0 THEN '✅' ELSE '❌ ' || v_int || ' varsel(er) igjen' END));

    SELECT deleted_at IS NULL AND match_event_id IS NULL INTO v_bool
    FROM public.feed_posts WHERE id = photo1;
    r := r || jsonb_build_array(jsonb_build_array(
      'E4 ⭐ BRUKERENS BILDEPOST OVERLEVER (og løsner fra øyeblikket)',
      CASE WHEN v_bool THEN '✅'
           ELSE '❌ bildet forsvant med målet — brukerens innhold ble kollateral' END));

    SELECT count(*) INTO v_int FROM public.reactions WHERE feed_post_id = photo1;
    r := r || jsonb_build_array(jsonb_build_array(
      'E5 HEIA på bildet er i behold',
      CASE WHEN v_int = 1 THEN '✅' ELSE '❌ fikk ' || v_int END));

    SELECT home_score, away_score INTO v_home, v_away
    FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'E6 stillingen etter annulleringen: 1–0',
      CASE WHEN v_home = 1 AND v_away = 0 THEN '✅'
           ELSE '❌ fikk ' || v_home || '–' || v_away END));

    -- ══ F. HALVVEI 2 — «Slett innlegget» ══════════════════════
    BEGIN
      PERFORM soft_delete_post(post2);
      r := r || jsonb_build_array(jsonb_build_array(
        'F1 ⭐ «Slett innlegget» avvises på en MÅLPOST',
        '❌ posten ble slettet — halvvei 2 står fortsatt åpen'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'F1 ⭐ «Slett innlegget» avvises på en MÅLPOST', '✅'));
    END;

    SELECT deleted_at IS NULL INTO v_bool FROM public.feed_posts WHERE id = post2;
    r := r || jsonb_build_array(jsonb_build_array(
      'F2 målposten står urørt etter forsøket',
      CASE WHEN v_bool THEN '✅' ELSE '❌ den ble slettet likevel' END));

    BEGIN
      PERFORM soft_delete_post(photo1);
      SELECT deleted_at IS NOT NULL INTO v_bool FROM public.feed_posts WHERE id = photo1;
      r := r || jsonb_build_array(jsonb_build_array(
        'F3 ⭐ «Slett innlegget» virker fortsatt på et BILDE',
        CASE WHEN v_bool THEN '✅' ELSE '❌ bildet ble ikke slettet' END));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'F3 ⭐ «Slett innlegget» virker fortsatt på et BILDE',
        '❌ gaten er FOR BRED — brukeren kan ikke slette sitt eget bilde'));
    END;

    -- ══ H4/H5. TILGANG + AUDIT ════════════════════════════════
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u_medlem::text, 'role', 'authenticated')::text,
      true);

    BEGIN
      PERFORM public.correct_match_goal(goal2, 'cancel');
      r := r || jsonb_build_array(jsonb_build_array(
        'H4 ⭐ et vanlig medlem kan IKKE korrigere',
        '❌ tilgangen er åpen'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'H4 ⭐ et vanlig medlem kan IKKE korrigere', '✅'));
    END;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u_trener::text, 'role', 'authenticated')::text,
      true);

    BEGIN
      PERFORM public.correct_match_goal(
        (SELECT id FROM public.match_events
          WHERE match_session_id = ms_id AND type = 'avspark' LIMIT 1),
        'cancel');
      r := r || jsonb_build_array(jsonb_build_array(
        'H5 kun MÅL kan korrigeres (avspark avvises)',
        '❌ en rytmemarkør ble annullert — kampuret kan ha blitt feil'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'H5 kun MÅL kan korrigeres (avspark avvises)', '✅'));
    END;

    SELECT count(*) INTO v_int FROM public.audit_log
    WHERE team_space_id = ts1 AND action LIKE 'correct_match_goal:%';
    r := r || jsonb_build_array(jsonb_build_array(
      'H6 ⭐ intern audit beholdes (P3)',
      CASE WHEN v_int = 4 THEN '✅ 4 rader'
           ELSE '❌ fant ' || v_int || ' (ventet 4: tre edit + én cancel)' END));

    RAISE EXCEPTION '%', MARKER;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg <> MARKER THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'KJØRINGEN BRAKK', '❌ ' || msg));
    END IF;
  END;

  INSERT INTO verify_0075 (test, resultat)
  SELECT x->>0, x->>1 FROM jsonb_array_elements(r) x;

  INSERT INTO verify_0075 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat LIKE '✅%') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            WHEN count(*) FILTER (WHERE resultat LIKE '⚠️%') > 0
              THEN ' GRØNT (med ⚠️-avgrensning)'
            ELSE ' GRØNT' END
  FROM verify_0075;
END $$;

SELECT n, test, resultat FROM verify_0075 ORDER BY n;

-- ============================================================
-- ETTERKONTROLL — riggen skal ikke finnes. Alle skal gi 0.
-- ============================================================
SELECT
  (SELECT count(*) FROM public.clubs WHERE name = 'VERIFY-0075 IL')           AS klubber_igjen,
  (SELECT count(*) FROM auth.users WHERE email LIKE 'verify-0075+%')          AS brukere_igjen,
  (SELECT count(*) FROM public.events WHERE title = 'Verify U1 – Motstander') AS hendelser_igjen;
