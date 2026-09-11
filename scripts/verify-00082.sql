-- ============================================================
-- verify-00082.sql — peek_manager_invitation (web-landing B-1)
--
-- Kjøres som postgres (run-sql.mjs / SQL-editoren). Fixturene lever i en
-- subtransaksjon som rulles tilbake — ingenting skrives varig.
--
-- BEVISER
--   A. Døren: SECURITY DEFINER, search_path låst m/ pg_temp sist,
--      anon/PUBLIC har IKKE EXECUTE, authenticated HAR.
--   B. Uinnlogget → exception. Tomt/ukjent token → found=false.
--   C. Kjent token: riktig juridisk navn/orgnr/invitert navn, maskert
--      e-post, email_matches true for riktig konto og false for feil
--      konto, expired=true når expires_at er passert.
--   D. Ingen sideeffekt: status og hendelseslogg uendret etter peek.
-- ============================================================
DO $$
DECLARE
  r        record;
  ok       int := 0;
  total    int := 0;
  v_ent    uuid;
  v_inv    uuid;
  v_u1     uuid;
  v_u2     uuid;
  v_token  text := 'verify-00082-token-' || gen_random_uuid()::text;
  v_json   jsonb;
  v_events int;
  v_res    jsonb := '[]'::jsonb;
BEGIN
  CREATE TEMP TABLE _res (n int GENERATED ALWAYS AS IDENTITY, test text, pass boolean);

  -- A. døren
  SELECT p.prosecdef, array_to_string(p.proconfig, ',') AS cfg INTO r
  FROM pg_proc p WHERE p.proname = 'peek_manager_invitation';
  INSERT INTO _res(test, pass) VALUES ('A1 security definer', r.prosecdef);
  INSERT INTO _res(test, pass) VALUES ('A2 search_path pg_temp sist', r.cfg LIKE '%pg_temp');
  INSERT INTO _res(test, pass) VALUES ('A3 anon har ikke execute',
    NOT has_function_privilege('anon', 'public.peek_manager_invitation(text)', 'EXECUTE'));
  INSERT INTO _res(test, pass) VALUES ('A4 authenticated har execute',
    has_function_privilege('authenticated', 'public.peek_manager_invitation(text)', 'EXECUTE'));

  BEGIN  -- ── subtransaksjon ──
    -- Fixtur: to auth-brukere, én enhet, én pending invitasjon til bruker 1.
    v_u1 := gen_random_uuid(); v_u2 := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify00082.invitee@example.test', now(), '{"display_name":"Verify Invitee"}', now(), now()),
           (v_u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify00082.other@example.test', now(), '{"display_name":"Verify Other"}', now(), now());
    INSERT INTO public.legal_club_entities (id, org_number, legal_name, verification_status)
    VALUES (gen_random_uuid(), '999999999', 'VERIFY 00082 IL', 'verified') RETURNING id INTO v_ent;
    INSERT INTO public.manager_invitations (id, legal_club_entity_id, invited_name, invited_email, source, status, token_hash, expires_at)
    VALUES (gen_random_uuid(), v_ent, 'Verify Invitee', 'Verify00082.Invitee@example.test', 'ops', 'pending',
            encode(digest(v_token, 'sha256'), 'hex'), now() + interval '10 days') RETURNING id INTO v_inv;
    SELECT count(*) INTO v_events FROM public.payment_authority_events;

    -- B. uinnlogget
    PERFORM set_config('request.jwt.claims', NULL, true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    BEGIN
      PERFORM public.peek_manager_invitation(v_token);
      v_res := v_res || jsonb_build_object('t', 'B1 uinnlogget avvises', 'p', (false));
    EXCEPTION WHEN OTHERS THEN
      v_res := v_res || jsonb_build_object('t', 'B1 uinnlogget avvises', 'p', (SQLERRM LIKE 'Logg inn%'));
    END;

    -- som bruker 1 (riktig konto)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
    v_json := public.peek_manager_invitation('');
    v_res := v_res || jsonb_build_object('t', 'B2 tomt token → found=false', 'p', ((v_json->>'found')::boolean = false));
    v_json := public.peek_manager_invitation('ikke-et-ekte-token-i-det-hele-tatt');
    v_res := v_res || jsonb_build_object('t', 'B3 ukjent token → found=false', 'p', ((v_json->>'found')::boolean = false));

    v_json := public.peek_manager_invitation(v_token);
    v_res := v_res || jsonb_build_object('t', 'C1 found', 'p', ((v_json->>'found')::boolean));
    v_res := v_res || jsonb_build_object('t', 'C2 legal_name', 'p', (v_json->>'legal_name' = 'VERIFY 00082 IL'));
    v_res := v_res || jsonb_build_object('t', 'C3 org_number', 'p', (v_json->>'org_number' = '999999999'));
    v_res := v_res || jsonb_build_object('t', 'C4 invited_name', 'p', (v_json->>'invited_name' = 'Verify Invitee'));
    v_res := v_res || jsonb_build_object('t', 'C5 e-post maskert', 'p', (v_json->>'invited_email_masked' = 'V***@example.test'));
    v_res := v_res || jsonb_build_object('t', 'C6 email_matches riktig konto (case-insensitiv)', 'p', ((v_json->>'email_matches')::boolean));
    v_res := v_res || jsonb_build_object('t', 'C7 status pending, ikke expired', 'p', (v_json->>'status' = 'pending' AND (v_json->>'expired')::boolean = false));
    v_res := v_res || jsonb_build_object('t', 'C8 email_verified', 'p', ((v_json->>'email_verified')::boolean));

    -- som bruker 2 (feil konto)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
    v_json := public.peek_manager_invitation(v_token);
    v_res := v_res || jsonb_build_object('t', 'C9 email_matches false for feil konto', 'p', ((v_json->>'email_matches')::boolean = false AND (v_json->>'found')::boolean));

    -- utløpt
    UPDATE public.manager_invitations SET expires_at = now() - interval '1 day' WHERE id = v_inv;
    v_json := public.peek_manager_invitation(v_token);
    v_res := v_res || jsonb_build_object('t', 'C10 expired=true når fristen er passert', 'p', ((v_json->>'expired')::boolean));

    -- D. ingen sideeffekt
    v_res := v_res || jsonb_build_object('t', 'D1 status uendret', 'p', ((SELECT status FROM public.manager_invitations WHERE id = v_inv) = 'pending'));
    v_res := v_res || jsonb_build_object('t', 'D2 ingen nye hendelser', 'p', ((SELECT count(*) FROM public.payment_authority_events) = v_events));

    RAISE EXCEPTION 'ROLLBACK-MARKER';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK-MARKER' THEN
      v_res := v_res || jsonb_build_object('t', 'X uventet feil: ' || SQLERRM, 'p', (false));
    END IF;
  END;

  INSERT INTO _res(test, pass) SELECT x->>'t', (x->>'p')::boolean FROM jsonb_array_elements(v_res) x;
  SELECT count(*) FILTER (WHERE pass), count(*) INTO ok, total FROM _res;
  RAISE NOTICE 'verify-00082: %/% grønne', ok, total;
  FOR r IN SELECT * FROM _res ORDER BY n LOOP
    RAISE NOTICE '% %', CASE WHEN r.pass THEN '✅' ELSE '❌' END, r.test;
  END LOOP;
  IF ok <> total THEN
    RAISE EXCEPTION 'verify-00082 FEILET: %/% grønne — %', ok, total,
      (SELECT string_agg(test, ' | ') FROM _res WHERE NOT pass);
  END IF;
END $$;
SELECT n, test, pass FROM _res ORDER BY n;
