-- ============================================================
-- verify-00067.sql — «forlat lag»-skiva (dormant-modellen)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i en SUBTRANSAKSJON som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig; pg_net-køede varsler rulles tilbake sammen med resten.
--
-- Dekker portene og skrivedørene i 00067 (FORLAT-LAG-DORMANT-2026-08):
-- §2 utmelding/siste-admin-vakten · §3a låsen · §3b siste episode
-- · §3c left_reason/ended_by · §3d onboarding-stempelet · §3e dormant
-- · §3f gjenåpning · §5 innløserflaten — pluss A3-riderne (teksten,
-- nominee-feltene, manager-navnet) via pg_proc-innhold.
--
-- NB: kjøres som postgres — RLS/grants dekkes IKKE her (det gjør
-- scripts/verify-membership-hardening.mjs mot rå PostgREST).
--
-- MERK om klokka: now() er frossen i transaksjonen, så episodenes
-- joined_at settes EKSPLISITT bakover der rekkefølgen betyr noe
-- (§3b sorterer på joined_at) — i prod skjer episodene i separate
-- transaksjoner og får alltid ulike tidspunkt.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00067 (n serial, test text, resultat text);
TRUNCATE verify_00067;

DO $$
DECLARE
  r        jsonb := '[]'::jsonb;
  msg      text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid(); ts1 uuid := gen_random_uuid();
  team2    uuid := gen_random_uuid(); ts2 uuid := gen_random_uuid();
  team3    uuid := gen_random_uuid(); ts3 uuid := gen_random_uuid();

  u_a uuid := gen_random_uuid(); -- trener i T1 og T2
  u_b uuid := gen_random_uuid(); -- forelder m/ barn
  u_c uuid := gen_random_uuid(); -- blir ny trener i T1
  u_d uuid := gen_random_uuid(); -- fjernes av admin
  u_e uuid := gen_random_uuid(); -- ukjent kodebruker / trenerforespørsel
  u_f uuid := gen_random_uuid(); -- trenerforespørsel som godkjennes
  u_g uuid := gen_random_uuid(); -- spiller
  u_h uuid := gen_random_uuid(); -- left→rejoin→removed (§3b-rekkefølgen)
  u_i uuid := gen_random_uuid(); -- kontosletting i T3

  hh_b uuid := gen_random_uuid();
  barn_b uuid := gen_random_uuid();

  ev_fortid uuid := gen_random_uuid();
  ev_fremtid uuid := gen_random_uuid();

  v jsonb; v_cnt int; v_bool boolean; v_bool2 boolean; v_txt text;
  q_before int; q_after int;

  PROCEDURE_marker CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen alt skjer i ──────────────────────

    -- ── 0. Globale prod-asserter (før fixturer) ──────────────
    SELECT count(*) INTO v_cnt FROM public.memberships
    WHERE status = 'removed' AND left_reason IS NULL;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3c backfill: alle removed-rader har left_reason',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt || ' rader mangler' END));

    SELECT count(*) INTO v_cnt FROM public.profiles p
    WHERE p.onboarding_completed_at IS NULL
      AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = p.id);
    r := r || jsonb_build_array(jsonb_build_array(
      '§3d backfill: alle med medlemsrad har onboarding-stempel',
      CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ ' || v_cnt || ' profiler mangler' END));

    -- ── Fixturer ─────────────────────────────────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00067 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify T1'),
           (team2, club_id, sport_id, 'Verify T2'),
           (team3, club_id, sport_id, 'Verify T3');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated)
    VALUES (ts1, team1, 'Verify T1', 'XVRF67AA', true),
           (ts2, team2, 'Verify T2', 'XVRF67AB', true),
           (ts3, team3, 'Verify T3', 'XVRF67AC', true);

    -- Testbrukere (handle_new_user-triggeren lager profilene).
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00067+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', navn)
    FROM (VALUES
      (u_a, 'Verify Trener A'), (u_b, 'Verify Forelder B'),
      (u_c, 'Verify Voksen C'), (u_d, 'Verify Fjernet D'),
      (u_e, 'Verify Ukjent E'), (u_f, 'Verify Søker F'),
      (u_g, 'Verify Spiller G'), (u_h, 'Verify Historie H'),
      (u_i, 'Verify Siste I')) AS t(u, navn);

    INSERT INTO public.households (id, name, created_by)
    VALUES (hh_b, 'Verify-husstand B', u_b);
    INSERT INTO public.managed_children (id, household_id, managed_by, display_name)
    VALUES (barn_b, hh_b, u_b, 'Verify Barn B');

    -- ── §3d: triggeren stempler ved medlemsrad-INSERT ────────
    INSERT INTO public.memberships (user_id, team_space_id, role, status, joined_at)
    VALUES (u_a, ts1, 'trener', 'active', now() - interval '100 days');
    SELECT onboarding_completed_at IS NOT NULL INTO v_bool
    FROM public.profiles WHERE id = u_a;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3d trigger: onboarding_completed_at stemples ved innmelding',
      CASE WHEN v_bool THEN '✅' ELSE '❌' END));

    -- Flere beboere i T1 (direkte inserts, eldre episoder).
    INSERT INTO public.memberships (user_id, team_space_id, role, status, joined_at, managed_child_id)
    VALUES (u_b, ts1, 'forelder', 'active', now() - interval '90 days', NULL),
           (u_b, ts1, 'forelder', 'active', now() - interval '90 days', barn_b),
           (u_d, ts1, 'supporter', 'active', now() - interval '80 days', NULL),
           (u_g, ts1, 'spiller',  'active', now() - interval '80 days', NULL);

    -- RSVP-fixtur for B: én fortid, én fremtid.
    INSERT INTO public.events (id, team_space_id, type, title, start_time)
    VALUES (ev_fortid, ts1, 'trening', 'Verify fortid', now() - interval '7 days'),
           (ev_fremtid, ts1, 'trening', 'Verify fremtid', now() + interval '7 days');
    INSERT INTO public.event_rsvps (event_id, user_id, status)
    VALUES (ev_fortid, u_b, 'kommer'), (ev_fremtid, u_b, 'kommer');

    -- ── §5: join v4 — vanlig forelder-join ───────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    v := join_team_space('XVRF67AA', 'forelder');
    r := r || jsonb_build_array(jsonb_build_array(
      '§5 join v4: forelder inn med koden',
      CASE WHEN v->>'outcome' = 'joined' AND v->>'role' = 'forelder'
        THEN '✅' ELSE '❌ ' || v::text END));

    -- ── §5: lagleder/admin avvises som innløserrolle ─────────
    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_e, 'role', 'authenticated')::text, true);
      v := join_team_space('XVRF67AA', 'lagleder');
      r := r || jsonb_build_array(jsonb_build_array(
        '§5: lagleder avvises som innløserrolle', '❌ slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§5: lagleder avvises som innløserrolle',
        CASE WHEN SQLERRM LIKE '%kan ikke velges%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §5: «Jeg er trener» → supporter + requested_role + varsel ─
    v := join_team_space('XVRF67AA', 'trener');
    SELECT count(*) INTO v_cnt FROM public.notifications
    WHERE user_id = u_a AND data->>'screen' = 'team_members'
      AND title = 'Trenerforespørsel';
    r := r || jsonb_build_array(jsonb_build_array(
      '§5: trener via koden = supporter + requested_role + admin-varsel',
      CASE WHEN v->>'role' = 'supporter' AND v->>'pending_role' = 'trener'
             AND v_cnt = 1
        THEN '✅' ELSE '❌ ' || v::text || ' varsler=' || v_cnt END));

    -- ── §5 avslå-veien ───────────────────────────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := decline_role_request(ts1, u_e);
    SELECT requested_role IS NULL INTO v_bool FROM public.memberships
    WHERE user_id = u_e AND team_space_id = ts1 AND status = 'active';
    SELECT count(*) INTO v_cnt FROM public.notifications
    WHERE user_id = u_e AND title = 'Forespørselen ble ikke godkjent';
    r := r || jsonb_build_array(jsonb_build_array(
      '§5 avslå: requested_role nulles + varsel til søkeren',
      CASE WHEN v->>'outcome' = 'declined' AND v_bool AND v_cnt = 1
        THEN '✅' ELSE '❌' END));

    -- ── §5 godkjenning via set_member_role ───────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_f, 'role', 'authenticated')::text, true);
    v := join_team_space('XVRF67AA', 'trener');
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := set_member_role(ts1, u_f, 'trener');
    SELECT role = 'trener' AND requested_role IS NULL INTO v_bool
    FROM public.memberships
    WHERE user_id = u_f AND team_space_id = ts1 AND status = 'active';
    SELECT count(*) INTO v_cnt FROM public.notifications
    WHERE user_id = u_f AND title = 'Ny rolle i laget';
    r := r || jsonb_build_array(jsonb_build_array(
      '§5 godkjenn: set_member_role gir trener + nuller forespørsel + varsel',
      CASE WHEN v->>'outcome' = 'changed' AND v_bool AND v_cnt = 1
        THEN '✅' ELSE '❌' END));

    -- ── set_member_role: spillere kan ikke promoteres (v1) ───
    BEGIN
      v := set_member_role(ts1, u_g, 'trener');
      r := r || jsonb_build_array(jsonb_build_array(
        'set_member_role: spiller avvises', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'set_member_role: spiller avvises',
        CASE WHEN SQLERRM LIKE '%Spillere%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── remove_team_member v2: left_reason + ended_by ────────
    PERFORM remove_team_member(ts1, u_d);
    SELECT left_reason = 'removed' AND ended_by = u_a INTO v_bool
    FROM public.memberships
    WHERE user_id = u_d AND team_space_id = ts1 AND status = 'removed';
    r := r || jsonb_build_array(jsonb_build_array(
      '§3c remove v2: left_reason=removed + ended_by=administratoren',
      CASE WHEN v_bool THEN '✅' ELSE '❌' END));

    -- ── §3b: fjernet sist → koden virker ikke (levende lag) ──
    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_d, 'role', 'authenticated')::text, true);
      v := join_team_space('XVRF67AA', 'supporter');
      r := r || jsonb_build_array(jsonb_build_array(
        '§3b: fjernet bruker avvises av koden', '❌ slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§3b: fjernet bruker avvises av koden',
        CASE WHEN SQLERRM LIKE '%fjernet%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §2: leave_team — hele personen, RSVP-rydding, sporet ─
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    v := leave_team(ts1);
    SELECT count(*) INTO v_cnt FROM public.memberships
    WHERE user_id = u_b AND team_space_id = ts1
      AND status = 'removed' AND left_reason = 'left' AND ended_by = u_b;
    r := r || jsonb_build_array(jsonb_build_array(
      '§2 leave: begge radene (personlig + barn) → removed/left/selv',
      CASE WHEN v->>'outcome' = 'left' AND v_cnt = 2 THEN '✅'
        ELSE '❌ ' || v::text || ' rader=' || v_cnt END));

    SELECT count(*) INTO v_cnt FROM public.event_rsvps
    WHERE user_id = u_b AND event_id = ev_fremtid;
    SELECT count(*) INTO q_before FROM public.event_rsvps
    WHERE user_id = u_b AND event_id = ev_fortid;
    r := r || jsonb_build_array(jsonb_build_array(
      '§2 leave: fremtidig RSVP slettes, historikken består',
      CASE WHEN v_cnt = 0 AND q_before = 1 THEN '✅' ELSE '❌' END));

    -- ── §3b: frivillig utmeldt → inn igjen med koden ─────────
    v := join_team_space('XVRF67AA', 'forelder');
    r := r || jsonb_build_array(jsonb_build_array(
      '§3b: frivillig utmeldt kommer inn igjen',
      CASE WHEN v->>'outcome' = 'joined' THEN '✅' ELSE '❌ ' || v::text END));
    -- (klokka er frossen i transaksjonen — sett gjeninntreden nyere
    --  enn de gamle episodene, som i prod)
    UPDATE public.memberships SET joined_at = now() - interval '1 day'
    WHERE id = (v->>'membership_id')::uuid;

    -- ── §3b siste episode avgjør: left → rejoin → removed → avvist ─
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_h, 'role', 'authenticated')::text, true);
    v := join_team_space('XVRF67AA', 'supporter');
    UPDATE public.memberships SET joined_at = now() - interval '60 days'
    WHERE id = (v->>'membership_id')::uuid;
    v := leave_team(ts1);
    v := join_team_space('XVRF67AA', 'supporter');
    UPDATE public.memberships SET joined_at = now() - interval '30 days'
    WHERE id = (v->>'membership_id')::uuid;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    PERFORM remove_team_member(ts1, u_h);
    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_h, 'role', 'authenticated')::text, true);
      v := join_team_space('XVRF67AA', 'supporter');
      r := r || jsonb_build_array(jsonb_build_array(
        '§3b: eldre left gir ALDRI adgang etter senere fjerning', '❌ slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§3b: eldre left gir ALDRI adgang etter senere fjerning',
        CASE WHEN SQLERRM LIKE '%fjernet%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §2 siste-admin-vakten ────────────────────────────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := set_member_role(ts1, u_f, 'supporter');  -- F tilbake, A = siste admin
    v := leave_team(ts1);
    SELECT count(*) INTO v_cnt FROM public.memberships
    WHERE user_id = u_a AND team_space_id = ts1 AND status = 'active';
    r := r || jsonb_build_array(jsonb_build_array(
      '§2 siste-admin-vakten: blokkert med andre aktive medlemmer',
      CASE WHEN v->>'outcome' = 'last_admin' AND v_cnt = 1 THEN '✅'
        ELSE '❌ ' || v::text END));

    -- ── set_member_role: siste admin kan ikke demotere seg selv ─
    BEGIN
      v := set_member_role(ts1, u_a, 'supporter');
      r := r || jsonb_build_array(jsonb_build_array(
        'set_member_role: siste admin kan ikke demoteres', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'set_member_role: siste admin kan ikke demoteres',
        CASE WHEN SQLERRM LIKE '%minst én trener%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §2: overdra rollen → så kan siste admin gå ───────────
    v := set_member_role(ts1, u_c, 'trener');
    v := leave_team(ts1);
    r := r || jsonb_build_array(jsonb_build_array(
      '§2: etter overdragelse kan forrige admin melde seg ut',
      CASE WHEN v->>'outcome' = 'left' THEN '✅' ELSE '❌ ' || v::text END));

    -- ── §3f: gjenåpning av LEVENDE lag avvises ───────────────
    BEGIN
      v := join_team_space('XVRF67AA', 'forelder', NULL, true);
      r := r || jsonb_build_array(jsonb_build_array(
        '§3f: gjenåpning av levende lag avvises', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§3f: gjenåpning av levende lag avvises',
        CASE WHEN SQLERRM LIKE '%allerede i gang%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── T2: bygg, tøm, og bevis dormant-registreringen ───────
    INSERT INTO public.memberships (user_id, team_space_id, role, status, joined_at)
    VALUES (u_a, ts2, 'trener', 'active', now() - interval '50 days'),
           (u_b, ts2, 'forelder', 'active', now() - interval '50 days');
    INSERT INTO public.feed_posts (team_space_id, author_id, type, content)
    VALUES (ts2, u_a, 'melding', 'Verify-innhold');

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    v := leave_team(ts2);

    -- pg_net-køen er implementasjonsdetalj — mangler lesetilgang, hopper
    -- vi over varsel-tellingen i stedet for å velte hele kjøringen.
    BEGIN
      SELECT count(*) INTO q_before FROM net.http_request_queue;
    EXCEPTION WHEN OTHERS THEN q_before := -1;
    END;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := leave_team(ts2);  -- siste medlem (admin uten andre aktive) går
    BEGIN
      SELECT count(*) INTO q_after FROM net.http_request_queue;
    EXCEPTION WHEN OTHERS THEN q_after := -1;
    END;

    SELECT dormant_at IS NOT NULL INTO v_bool
    FROM public.team_spaces WHERE id = ts2;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3e: siste utmelding registrerer dormant_at',
      CASE WHEN v->>'outcome' = 'left' AND (v->>'team_dormant')::boolean
             AND v_bool THEN '✅' ELSE '❌ ' || v::text END));
    r := r || jsonb_build_array(jsonb_build_array(
      '§3e: dormant m/ innhold køer ops-varsel (team_dormant)',
      CASE WHEN q_before = -1 OR q_after = -1
        THEN '⚠️ pg_net-køen ikke lesbar — dekket av at leave_team lyktes'
        WHEN q_after = q_before + 1 THEN '✅'
        ELSE '❌ kø ' || q_before || '→' || q_after END));

    -- ── lookup v4: has_active_admin ──────────────────────────
    SELECT (lookup_invite_code('XVRF67AB')->>'has_active_admin')::boolean
      INTO v_bool;
    SELECT (lookup_invite_code('XVRF67AA')->>'has_active_admin')::boolean
      INTO v_bool2;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3a lookup: has_active_admin false for låst, true for levende',
      CASE WHEN v_bool = false AND v_bool2 = true THEN '✅' ELSE '❌' END));

    -- ── §3a: ukjent kodebruker avvises i låst lag ────────────
    BEGIN
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_e, 'role', 'authenticated')::text, true);
      v := join_team_space('XVRF67AB', 'supporter');
      r := r || jsonb_build_array(jsonb_build_array(
        '§3a: ukjent bruker avvises i låst lag', '❌ slapp inn'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§3a: ukjent bruker avvises i låst lag',
        CASE WHEN SQLERRM LIKE '%tar ikke imot%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §3a/f-1: frivillig utmeldt ikke-admin inn i låst lag ─
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    v := join_team_space('XVRF67AB', 'forelder');
    UPDATE public.memberships SET joined_at = now() - interval '2 days'
    WHERE id = (v->>'membership_id')::uuid;
    SELECT dormant_at IS NULL INTO v_bool
    FROM public.team_spaces WHERE id = ts2;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3f-1: frivillig utmeldt inn i låst lag + dormant_at nulles',
      CASE WHEN v->>'outcome' = 'joined' AND v_bool THEN '✅'
        ELSE '❌ ' || v::text END));

    -- ── beboer i låst lag kan legge til barn (porten gjelder ukjente) ─
    v := join_team_space('XVRF67AB', 'forelder', barn_b);
    r := r || jsonb_build_array(jsonb_build_array(
      '§3a: beboer i låst lag kan legge til barn',
      CASE WHEN v->>'outcome' = 'joined' THEN '✅' ELSE '❌ ' || v::text END));

    -- ── §3f: gjeninntreden skaper ingen admin — laget er fortsatt låst ─
    r := r || jsonb_build_array(jsonb_build_array(
      '§3a: gjeninntreden åpner IKKE låsen (fortsatt uten admin)',
      CASE WHEN has_active_team_admin(ts2) = false THEN '✅' ELSE '❌' END));

    -- ── §3f-2: gjenåpning krever admin-historikk ─────────────
    BEGIN
      v := join_team_space('XVRF67AB', 'forelder', NULL, true);
      r := r || jsonb_build_array(jsonb_build_array(
        '§3f-2: ikke-admin kan ikke gjenåpne', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        '§3f-2: ikke-admin kan ikke gjenåpne',
        CASE WHEN SQLERRM LIKE '%gjenåpne%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    -- ── §3f-2: kvalifisert tidligere admin gjenåpner ─────────
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    v := join_team_space('XVRF67AB', 'forelder', NULL, true);
    r := r || jsonb_build_array(jsonb_build_array(
      '§3f-2: tidligere trener gjenåpner og får rollen tilbake',
      CASE WHEN v->>'outcome' = 'reopened' AND v->>'role' = 'trener'
             AND has_active_team_admin(ts2) THEN '✅'
        ELSE '❌ ' || v::text END));

    -- ── get_team_authors: utmeldt forfatter beholder navnet ──
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_c, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_cnt FROM get_team_authors(ts1) a
    WHERE a.user_id = u_d AND a.display_name = 'Verify Fjernet D';
    r := r || jsonb_build_array(jsonb_build_array(
      'get_team_authors: fjernet/utmeldt forfatter er med (navn består)',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌' END));

    -- ── get_team_members v2: requested_role-kolonnen finnes ──
    SELECT count(*) INTO v_cnt
    FROM get_team_members(ts1) m WHERE m.requested_role IS NOT NULL;
    r := r || jsonb_build_array(jsonb_build_array(
      'get_team_members v2: requested_role-kolonnen svarer',
      '✅'));

    -- ── delete_account_data v4: dormant-registrering ─────────
    INSERT INTO public.memberships (user_id, team_space_id, role, status, joined_at)
    VALUES (u_i, ts3, 'trener', 'active', now() - interval '10 days');
    PERFORM delete_account_data(u_i);
    SELECT dormant_at IS NOT NULL INTO v_bool
    FROM public.team_spaces WHERE id = ts3;
    r := r || jsonb_build_array(jsonb_build_array(
      '§3e delete v4: kontosletting av siste medlem → dormant_at',
      CASE WHEN v_bool THEN '✅' ELSE '❌' END));

    -- ── A3-riderne (tekst/payload — leses fra funksjonskroppene) ─
    SELECT prosrc INTO v_txt FROM pg_proc
    WHERE proname = 'request_team_support_approval';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3-rider: RPC-varselet sier «Klubbetalinger» (to b-er)',
      CASE WHEN v_txt LIKE '%Klubbetalinger%'
             AND v_txt NOT LIKE '%Klubbbetalinger%' THEN '✅' ELSE '❌' END));

    SELECT prosrc INTO v_txt FROM pg_proc WHERE proname = 'ops_claim_payload';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3-rider: ops_claim_payload bærer nominee-feltene',
      CASE WHEN v_txt LIKE '%nominee_name%' THEN '✅' ELSE '❌' END));

    SELECT prosrc INTO v_txt FROM pg_proc
    WHERE proname = 'get_support_activation_status';
    r := r || jsonb_build_array(jsonb_build_array(
      'A3-rider: statuspayloaden bærer manager-navnet',
      CASE WHEN v_txt LIKE '%''manager''%' THEN '✅' ELSE '❌' END));

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

  INSERT INTO verify_00067 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00067 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat = '✅') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            WHEN count(*) FILTER (WHERE resultat LIKE '⚠️%') > 0
              THEN ' GRØNT (med ⚠️-hopp)'
            ELSE ' GRØNT' END
  FROM verify_00067;
END $$;

SELECT n, test, resultat FROM verify_00067 ORDER BY n;
