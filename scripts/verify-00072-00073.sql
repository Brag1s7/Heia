-- ============================================================
-- verify-00072-00073.sql — feedgaten (P1) + kampuret (P2)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i ÉN subtransaksjon som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig, og RIGGEN ER REVET NED VED KONSTRUKSJON.
--
-- ⚠️ ALT I ÉN `DO`-BLOKK, MED ÉN YTRE `BEGIN … EXCEPTION`.
-- Et første utkast delte den i to blokker (fixturer i den ene, tester
-- i den andre) for å få `set_config` utenfor. Det var en ekte feil:
-- MARKER-exceptionen i blokk to ville bare rullet tilbake blokk to, og
-- klubben, brukeren og kampen fra blokk én ville blitt stående i prod.
-- `set_config` kalles derfor INNE i subtransaksjonen — samme mønster
-- som verify-00071.
--
-- ⚠️ INGEN PUSH SENDES — samme begrunnelse som verify-00071: pg_net
-- KØER kallet i transaksjonen og sender først etter COMMIT (00049),
-- så rollbacken fjerner køraden. Fixturbrukeren har uansett ingen
-- device-token.
--
-- ---------------------------------------------------------------------------
-- HVA SOM BEVISES
--
--   A. DØRENE (00061-fella). `get_team_feed` er DROP+CREATE i 00072, og
--      en DROP tar grantene med seg. En RPC uten GRANT er en feed som er
--      borte for ALLE — den dyreste feilen i denne migrasjonen.
--   B. FEEDGATEN (P1): feeden bærer nå `match_event_type`/`match_event_side`,
--      og et baklengsmål kommer ut som ('mål','away').
--      ⚠️ Selve gaten er en KLIENTREGEL — se B4.
--   C. KAMPURET, STILLESTÅENDE: formelen, kolonnene og begge lesestiene.
--   D. ⭐ KAMPURET I BEVEGELSE — den viktigste bolken. Uret skyves
--      kunstig bakover i tid mellom stegene, så en pause kan bevises på
--      et halvsekund i stedet for å ventes ut.
--   E. HISTORIKKEN: `started_at` skrives ALDRI om.
--
-- ⚠️ TO TING SOM IKKE KAN BEVISES HER, og som derfor står igjen på
-- telefonen:
--   · at appens tre flater (kampskjerm, live-banner, innboks) viser
--     SAMME minutt i samme øyeblikk. SQL beviser at serveren har ETT
--     tall, ikke at tre skjermer leser det likt.
--   · at ekte tid oppfører seg som skyvd tid. D-bolken flytter
--     `clock_started_at`; den venter ikke. P2 krever derfor fortsatt
--     én manuell pause/gjenoppta-runde på telefonen.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_0072 (n serial, test text, resultat text);
TRUNCATE verify_0072;

DO $$
DECLARE
  r   jsonb := '[]'::jsonb;
  msg text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid();
  ts1      uuid := gen_random_uuid();
  u_trener uuid := gen_random_uuid();
  evt_id   uuid := gen_random_uuid();
  ms_id    uuid;

  v        jsonb;
  v_int    int;
  v_txt    text;
  v_side   text;
  v_bool   boolean;
  v_start  timestamptz;
  v_start2 timestamptz;
  v_min_1  int;
  v_min_2  int;
  v_min_3  int;

  MARKER CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen ALT skjer i ──────────────────────

    -- ══ A. DØRENE ═════════════════════════════════════════════
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 anon har IKKE EXECUTE på get_team_feed',
      CASE WHEN NOT has_function_privilege('anon',
             'public.get_team_feed(uuid, int, timestamptz)', 'EXECUTE')
           THEN '✅' ELSE '❌ feeddøren står åpen for anon' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A2 authenticated HAR EXECUTE på get_team_feed',
      CASE WHEN has_function_privilege('authenticated',
             'public.get_team_feed(uuid, int, timestamptz)', 'EXECUTE')
           THEN '✅' ELSE '❌ 00061-FELLA: feeden er borte for ALLE' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A3 anon har IKKE EXECUTE på match_played_seconds',
      CASE WHEN NOT has_function_privilege('anon',
             'public.match_played_seconds(int, timestamptz)', 'EXECUTE')
           THEN '✅' ELSE '❌ klokkeformelen står åpen for anon' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'A4 authenticated HAR EXECUTE på match_played_seconds',
      CASE WHEN has_function_privilege('authenticated',
             'public.match_played_seconds(int, timestamptz)', 'EXECUTE')
           THEN '✅' ELSE '❌ serveren kan ikke stemple minuttet' END));

    -- ══ C1-C4. KAMPURET, STILLESTÅENDE ════════════════════════
    SELECT count(*) INTO v_int
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_sessions'
      AND column_name IN ('played_seconds', 'clock_started_at');

    r := r || jsonb_build_array(jsonb_build_array(
      'C1 begge klokkekolonnene finnes',
      CASE WHEN v_int = 2 THEN '✅'
           ELSE '❌ fant ' || v_int || ' av 2 — appen feiler HARDT i PostgREST' END));

    v_int := public.match_played_seconds(120, now() - interval '30 seconds');
    r := r || jsonb_build_array(jsonb_build_array(
      'C2 formelen: 120 + 30 sek = 150',
      CASE WHEN v_int = 150 THEN '✅' ELSE '❌ fikk ' || v_int END));

    v_int := public.match_played_seconds(600, NULL);
    r := r || jsonb_build_array(jsonb_build_array(
      'C3 uret STÅR når clock_started_at er NULL',
      CASE WHEN v_int = 600 THEN '✅' ELSE '❌ fikk ' || v_int END));

    v_int := public.match_played_seconds(0, now() + interval '5 seconds');
    r := r || jsonb_build_array(jsonb_build_array(
      'C4 aldri negativt (telefonklokke foran serverens)',
      CASE WHEN v_int = 0 THEN '✅' ELSE '❌ fikk ' || v_int END));

    -- ── Fixturer: ett lag, én trener, én kamp ────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-0072 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify U1');
    INSERT INTO public.team_spaces (id, team_id, display_name)
    VALUES (ts1, team1, 'Verify U1');

    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
                            raw_user_meta_data, aud, role)
    VALUES (u_trener, 'verify-0072+trener@example.test', 'x', now(),
            '{"display_name":"Verify Trener"}'::jsonb,
            'authenticated', 'authenticated');

    INSERT INTO public.profiles (id, display_name)
    VALUES (u_trener, 'Verify Trener')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.memberships (user_id, team_space_id, role, status)
    VALUES (u_trener, ts1, 'trener', 'active');

    INSERT INTO public.events (id, team_space_id, type, title, start_time, created_by)
    VALUES (evt_id, ts1, 'kamp', 'Verify U1 – Motstander',
            now() - interval '1 hour', u_trener);

    INSERT INTO public.match_sessions (event_id, opponent, is_home, status)
    VALUES (evt_id, 'Verify Motstander', true, 'planlagt')
    RETURNING id INTO ms_id;

    -- Trenerens økt. RPC-ene under leser auth.uid() herfra.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u_trener::text, 'role', 'authenticated')::text,
      true);

    -- ══ D. ⭐ KAMPURET I BEVEGELSE ════════════════════════════
    -- Uret skyves bakover i tid mellom stegene. Det er den eneste måten
    -- å teste dette i SQL, og den er trygg fordi vi flytter
    -- `clock_started_at` (KLOKKA) og aldri `started_at` (HISTORIKKEN)
    -- — noe E1 nedenfor kontrollerer eksplisitt.
    PERFORM start_match(evt_id);
    SELECT started_at INTO v_start FROM public.match_sessions WHERE id = ms_id;

    -- «Det har gått 20 minutter av første omgang.»
    UPDATE public.match_sessions
    SET clock_started_at = clock_started_at - interval '20 minutes'
    WHERE id = ms_id;

    SELECT FLOOR(public.match_played_seconds(played_seconds, clock_started_at) / 60)::int
      INTO v_min_1 FROM public.match_sessions WHERE id = ms_id;

    r := r || jsonb_build_array(jsonb_build_array(
      'D1 uret teller mens kampen går (20′)',
      CASE WHEN v_min_1 = 20 THEN '✅' ELSE '❌ fikk ' || v_min_1 || '′' END));

    PERFORM report_match_event(ms_id, 'pause');

    SELECT clock_started_at IS NULL INTO v_bool
    FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'D2 clock_started_at nulles ved pause',
      CASE WHEN v_bool THEN '✅' ELSE '❌ uret ble aldri stoppet' END));

    SELECT FLOOR(public.match_played_seconds(played_seconds, clock_started_at) / 60)::int
      INTO v_min_2 FROM public.match_sessions WHERE id = ms_id;

    r := r || jsonb_build_array(jsonb_build_array(
      'D3 ⭐ uret STÅR i pause (fortsatt ' || v_min_1 || '′)',
      CASE WHEN v_min_2 = v_min_1 THEN '✅'
           ELSE '❌ hoppet fra ' || v_min_1 || '′ til ' || v_min_2 || '′' END));

    PERFORM report_match_event(ms_id, 'andre_omgang');

    -- «Det har gått 5 minutter av andre omgang.»
    UPDATE public.match_sessions
    SET clock_started_at = clock_started_at - interval '5 minutes'
    WHERE id = ms_id;

    SELECT FLOOR(public.match_played_seconds(played_seconds, clock_started_at) / 60)::int
      INTO v_min_3 FROM public.match_sessions WHERE id = ms_id;

    r := r || jsonb_build_array(jsonb_build_array(
      'D4 ⭐ andre omgang fortsetter: 20′ → 25′',
      CASE WHEN v_min_3 = 25 THEN '✅'
           ELSE '❌ fikk ' || v_min_3 || '′ (40′ ville betydd at pausen telles med)' END));

    -- Et mål nå skal stemples med SPILT tid. `started_at` ble aldri
    -- flyttet, så det GAMLE regnestykket (now − started_at) ville gitt
    -- ~0′ her — derfor er 25 et ekte skille mellom gammel og ny modell.
    PERFORM report_match_event(ms_id, 'mål', 'away');

    SELECT minute INTO v_int FROM public.match_events
    WHERE match_session_id = ms_id AND type = 'mål'
    ORDER BY sequence DESC LIMIT 1;

    r := r || jsonb_build_array(jsonb_build_array(
      'D5 ⭐ målet stemples med SPILT tid (25′)',
      CASE WHEN v_int = 25 THEN '✅' ELSE '❌ fikk ' || v_int || '′' END));

    -- ══ E. HISTORIKKEN ════════════════════════════════════════
    SELECT started_at INTO v_start2 FROM public.match_sessions WHERE id = ms_id;
    r := r || jsonb_build_array(jsonb_build_array(
      'E1 ⚠️ started_at er ALDRI skrevet om',
      CASE WHEN v_start2 = v_start THEN '✅' ELSE '❌ historikken ble endret' END));

    -- ══ B. FEEDGATEN (P1) ═════════════════════════════════════
    SELECT f.match_event_type, f.match_event_side INTO v_txt, v_side
    FROM get_team_feed(ts1, 50) f
    WHERE f.match_event_type = 'mål'
    LIMIT 1;

    r := r || jsonb_build_array(jsonb_build_array(
      'B1 feeden bærer match_event_type',
      CASE WHEN v_txt = 'mål' THEN '✅'
           ELSE '❌ fikk ' || COALESCE(v_txt, 'NULL') END));

    r := r || jsonb_build_array(jsonb_build_array(
      'B2 ⭐ baklengsmålet kommer ut som away',
      CASE WHEN v_side = 'away' THEN '✅'
           ELSE '❌ fikk ' || COALESCE(v_side, 'NULL') END));

    SELECT count(*) INTO v_int
    FROM get_team_feed(ts1, 50) f
    WHERE f.match_event_type IS NULL;

    r := r || jsonb_build_array(jsonb_build_array(
      'B3 rytme-/vanlige poster har NULL (beholder HEIA)',
      CASE WHEN v_int >= 0 THEN '✅ ' || v_int || ' slike rader' ELSE '❌' END));

    r := r || jsonb_build_array(jsonb_build_array(
      'B4 ⚠️ selve gaten er en KLIENTREGEL',
      '⚠️ serveren stopper ikke en reaksjon på baklengsmålet — '
      || 'skrivesidens gate er skive 8 (dokumentert avgrensning)'));

    -- ══ C5. LESESTIEN kampskjermen bruker ═════════════════════
    SELECT get_event_with_rsvp(evt_id) -> 'match_session' INTO v;
    r := r || jsonb_build_array(jsonb_build_array(
      'C5 get_event_with_rsvp bærer begge klokketallene',
      CASE WHEN v ? 'clock_started_at' AND v ? 'played_seconds' THEN '✅'
           ELSE '❌ appen ville falt tilbake på den gamle klokka' END));

    RAISE EXCEPTION '%', MARKER;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg <> MARKER THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'KJØRINGEN BRAKK', '❌ ' || msg));
    END IF;
  END;

  INSERT INTO verify_0072 (test, resultat)
  SELECT x->>0, x->>1 FROM jsonb_array_elements(r) x;

  INSERT INTO verify_0072 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat LIKE '✅%') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            WHEN count(*) FILTER (WHERE resultat LIKE '⚠️%') > 0
              THEN ' GRØNT (med ⚠️-avgrensning)'
            ELSE ' GRØNT' END
  FROM verify_0072;
END $$;

SELECT n, test, resultat FROM verify_0072 ORDER BY n;

-- ============================================================
-- ETTERKONTROLL — riggen skal ikke finnes. Alle skal gi 0.
-- (Rollbacken gjør dette til en formalitet, men en formalitet som
-- koster to sekunder og fanger en feilslått rollback.)
-- ============================================================
SELECT
  (SELECT count(*) FROM public.clubs WHERE name = 'VERIFY-0072 IL')           AS klubber_igjen,
  (SELECT count(*) FROM auth.users WHERE email LIKE 'verify-0072+%')          AS brukere_igjen,
  (SELECT count(*) FROM public.events WHERE title = 'Verify U1 – Motstander') AS hendelser_igjen;
