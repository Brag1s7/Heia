-- ============================================================
-- verify-00068.sql — profilbilde-skiva (avatar-opplasting)
--
-- KJØRES I SUPABASE SQL-EDITOREN, hele fila i ett. Selvforsynt:
-- alle fixturer og handlinger skjer i en SUBTRANSAKSJON som rulles
-- tilbake (marker-exception) — kun de LOKALE testresultatene
-- overlever og vises i grid-en fra siste SELECT. Ingenting skrives
-- varig.
--
-- HVA SOM BEVISES, og hvorfor akkurat dette:
--   A. Bucketen `avatars` er PRIVAT med grenser. Var den offentlig,
--      ville hele personvernbeslutningen i skiva vært tom.
--   B. `shares_team_with` — den kanoniske leseretten. Asymmetrien
--      (leser må være AKTIV, eier trenger bare en rad) er ikke en
--      detalj: uten den mister hver gamle kommentar ansiktet i det
--      forfatteren melder seg ut (get_team_authors, 00067).
--   C. STORAGE-POLICYENE for LESING og SKRIVING, kjørt som
--      `authenticated` — ikke som postgres. Dette er selve
--      personvernsgrensen, og den eneste måten å bevise den på er å
--      faktisk være en vanlig bruker.
--      SLETTING er IKKE med: Supabase avviser all direkte
--      `DELETE FROM storage.objects` (statement-nivå), så SQL kan
--      hverken bekrefte eller avkrefte den policyen — se notatet ved
--      C8. Oppførselen der verifiseres via Storage-API-et.
--   D. profiles-WITH CHECK: du kan ikke sette en ANNENS bilde på deg.
--   E. `remove_member_avatar` — lagadmins moderasjonsknapp, med
--      vaktene.
--   F. Rapportering av profilbilde (Apple 1.2) + at feed_post-grenen
--      i `report_content` fortsatt virker (regresjon).
--
-- ⚠️ FELLEN FRA verify-00067 GJELDER HER OGSÅ: `set_config(…, true)`
-- er TRANSAKSJONSBUNDET. En fanget exception ruller tilbake både
-- subtransaksjonen og GUC-ene satt i den — så både `role` og
-- `request.jwt.claims` settes UTENFOR hver BEGIN…EXCEPTION-blokk.
-- Står de inni, kjører neste test som forrige bruker.
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS verify_00068 (n serial, test text, resultat text);
TRUNCATE verify_00068;

DO $$
DECLARE
  r   jsonb := '[]'::jsonb;
  msg text;

  sport_id uuid;
  club_id  uuid := gen_random_uuid();
  team1    uuid := gen_random_uuid(); ts1 uuid := gen_random_uuid();
  team2    uuid := gen_random_uuid(); ts2 uuid := gen_random_uuid();

  u_admin  uuid := gen_random_uuid(); -- trener i T1
  u_mor    uuid := gen_random_uuid(); -- forelder i T1, har profilbilde
  u_far    uuid := gen_random_uuid(); -- forelder i T1, uten bilde
  u_ute    uuid := gen_random_uuid(); -- HAR forlatt T1 (removed)
  u_fremd  uuid := gen_random_uuid(); -- bare i T2 — ingen felles lag

  p_mor    text; -- {u_mor}/avatar-1.jpg
  p_far    text;
  p_ute    text;

  v jsonb; v_cnt int; v_bool boolean; v_txt text; post_id uuid;

  MARKER CONSTANT text := '__verify_rollback__';
BEGIN
  BEGIN  -- ── subtransaksjonen alt skjer i ──────────────────────

    p_mor := u_mor::text || '/avatar-1.jpg';
    p_far := u_far::text || '/avatar-1.jpg';
    p_ute := u_ute::text || '/avatar-1.jpg';

    -- ══ A. BUCKETEN ═══════════════════════════════════════════
    SELECT b.public INTO v_bool FROM storage.buckets b WHERE b.id = 'avatars';
    r := r || jsonb_build_array(jsonb_build_array(
      'A1 bucket `avatars` finnes og er PRIVAT',
      CASE WHEN v_bool IS FALSE THEN '✅'
           WHEN v_bool IS TRUE THEN '❌ bucketen er OFFENTLIG'
           ELSE '❌ bucketen finnes ikke' END));

    SELECT b.file_size_limit = 2097152
       AND b.allowed_mime_types @> ARRAY['image/jpeg','image/png']
      INTO v_bool
    FROM storage.buckets b WHERE b.id = 'avatars';
    r := r || jsonb_build_array(jsonb_build_array(
      'A2 bucketen har 2 MiB-tak og bilde-mime-liste',
      CASE WHEN v_bool THEN '✅' ELSE '❌ grensene mangler' END));

    -- ── Fixturer ─────────────────────────────────────────────
    SELECT id INTO sport_id FROM public.sports LIMIT 1;
    INSERT INTO public.clubs (id, name) VALUES (club_id, 'VERIFY-00068 IL');
    INSERT INTO public.teams (id, club_id, sport_id, name)
    VALUES (team1, club_id, sport_id, 'Verify A1'),
           (team2, club_id, sport_id, 'Verify A2');
    INSERT INTO public.team_spaces (id, team_id, display_name, invite_code, is_activated)
    VALUES (ts1, team1, 'Verify A1', 'XVRF68AA', true),
           (ts2, team2, 'Verify A2', 'XVRF68AB', true);

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    SELECT u, 'verify-00068+' || row_number() OVER () || '@heiaapp.no',
           jsonb_build_object('display_name', 'Verify ' || row_number() OVER ())
    FROM unnest(ARRAY[u_admin, u_mor, u_far, u_ute, u_fremd]) u;

    INSERT INTO public.memberships
      (user_id, team_space_id, role, status, joined_at, left_at, left_reason)
    VALUES (u_admin, ts1, 'trener',   'active',  now(), NULL, NULL),
           (u_mor,   ts1, 'forelder', 'active',  now(), NULL, NULL),
           (u_far,   ts1, 'forelder', 'active',  now(), NULL, NULL),
           -- Har forlatt laget selv (00067 skriver 'left'): bildet skal
           -- FORTSATT være lesbart for de som er igjen, fordi kommentarene
           -- deres står der ennå.
           (u_ute,   ts1, 'forelder', 'removed', now() - interval '30 days',
            now() - interval '1 day', 'left'),
           (u_fremd, ts2, 'forelder', 'active',  now(), NULL, NULL);

    UPDATE public.profiles SET avatar_url = p_mor WHERE id = u_mor;
    UPDATE public.profiles SET avatar_url = p_ute WHERE id = u_ute;

    -- ══ B. shares_team_with — leseretten ══════════════════════
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);

    r := r || jsonb_build_array(jsonb_build_array(
      'B1 aktiv lagkamerat deler lag',
      CASE WHEN shares_team_with(u_mor) THEN '✅' ELSE '❌' END));
    r := r || jsonb_build_array(jsonb_build_array(
      'B2 fremmed (ingen felles lag) gjør IKKE',
      CASE WHEN NOT shares_team_with(u_fremd) THEN '✅' ELSE '❌ leste en fremmed' END));
    r := r || jsonb_build_array(jsonb_build_array(
      'B3 UTMELDT eier er fortsatt lesbar (speiler get_team_authors)',
      CASE WHEN shares_team_with(u_ute) THEN '✅'
           ELSE '❌ gamle kommentarer ville mistet ansiktet' END));

    -- Snu det: LESEREN har meldt seg ut → retten er borte.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_ute, 'role', 'authenticated')::text, true);
    r := r || jsonb_build_array(jsonb_build_array(
      'B4 UTMELDT leser mister retten (asymmetrien holder)',
      CASE WHEN NOT shares_team_with(u_mor) THEN '✅' ELSE '❌ leste etter utmelding' END));

    -- Ikke tom streng: auth.uid() gjør `current_setting(...)::jsonb`, og
    -- ''::jsonb KASTER. Et claim uten 'sub' er den ekte anon-tilstanden.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('role', 'anon')::text, true);
    r := r || jsonb_build_array(jsonb_build_array(
      'B5 uten innlogging: ingen rett',
      CASE WHEN NOT shares_team_with(u_mor) THEN '✅' ELSE '❌' END));

    -- ══ C. STORAGE-POLICYENE, som `authenticated` ═════════════
    -- Egen blokk: RLS på storage.objects er miljøavhengig (eierskap/
    -- bypassrls varierer mellom prosjektoppsett). Feiler den, skal
    -- resten av rapporten fortsatt komme ut — derfor ⚠️, ikke ❌.
    BEGIN
      PERFORM set_config('role', 'authenticated', true);
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_mor, 'role', 'authenticated')::text, true);

      -- C1: skriv i EGEN mappe.
      BEGIN
        INSERT INTO storage.objects (bucket_id, name, owner_id)
        VALUES ('avatars', p_mor, u_mor::text);
        r := r || jsonb_build_array(jsonb_build_array(
          'C1 opplasting i EGEN mappe godtas', '✅'));
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
        r := r || jsonb_build_array(jsonb_build_array(
          'C1 opplasting i EGEN mappe godtas', '❌ ' || msg));
      END;

      -- C2: skriv i en ANNENS mappe — overtakelsesvektoren.
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_mor, 'role', 'authenticated')::text, true);
      BEGIN
        INSERT INTO storage.objects (bucket_id, name, owner_id)
        VALUES ('avatars', p_far, u_mor::text);
        r := r || jsonb_build_array(jsonb_build_array(
          'C2 opplasting i en ANNENS mappe avvises', '❌ slapp gjennom'));
      EXCEPTION WHEN OTHERS THEN
        r := r || jsonb_build_array(jsonb_build_array(
          'C2 opplasting i en ANNENS mappe avvises', '✅'));
      END;

      -- C3–C5: hvem SER bildet?
      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_mor, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_cnt FROM storage.objects
      WHERE bucket_id = 'avatars' AND name = p_mor;
      r := r || jsonb_build_array(jsonb_build_array(
        'C3 eieren ser sitt eget bilde',
        CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌' END));

      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_cnt FROM storage.objects
      WHERE bucket_id = 'avatars' AND name = p_mor;
      r := r || jsonb_build_array(jsonb_build_array(
        'C4 lagkameraten ser det',
        CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ avataren ville vært usynlig i laget' END));

      PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', u_fremd, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_cnt FROM storage.objects
      WHERE bucket_id = 'avatars' AND name = p_mor;
      r := r || jsonb_build_array(jsonb_build_array(
        'C5 en FREMMED ser det ikke — hele personvernbeslutningen',
        CASE WHEN v_cnt = 0 THEN '✅' ELSE '❌ LEKKASJE' END));

      -- ⛔ SLETTING KAN IKKE TESTES HER — og det er en egenskap ved
      -- Supabase, ikke ved policyen vår. Storage har en vakt som avviser
      -- ALL direkte `DELETE FROM storage.objects`: «Direct deletion from
      -- storage tables is not allowed. Use the Storage API instead.»
      -- (Funnet i første kjøring 2026-08-19. INSERT slipper gjennom, som
      -- C1/C2 over beviser — asymmetrien er Supabase sin.)
      --
      -- Fristelsen er å lese feilmeldingen som et resultat. IKKE GJØR DET:
      -- vakten fyrer etter alt å dømme på STATEMENT-nivå, altså også når
      -- RLS korrekt har filtrert bort raden. Da er «kastet» og «0 rader»
      -- ikke til å skille fra hverandre, og testen ville påstått noe den
      -- ikke vet. Appen er upåvirket — `deleteAvatarFile` går via
      -- Storage-API-et, som er nettopp det vakten ber om.
      --
      -- Det SQL kan bevise er at policyen er installert med rett navn og
      -- rett kommando. Oppførselen verifiseres via Storage-API-et:
      -- dashboardsjekk i telefonrunden (Storage → avatars → mappa skal bli
      -- tom etter «Fjern profilbildet»), ev. et node-skript i familien til
      -- verify-membership-hardening.mjs.
      PERFORM set_config('role', 'postgres', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('role', 'postgres', true);
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⚠️ C storage-RLS kunne ikke kjøres i dette miljøet',
        '⚠️ ' || msg || ' — kjør policy-sjekken via Storage-API-et i stedet'));
    END;

    -- ══ C8. Er policyene i det hele tatt installert? ══════════
    -- Svakere enn en oppførselstest, men ikke verdiløs: den fanger den
    -- ene feilen som ellers ville vært helt stille — at 00068 ble kjørt
    -- mot en base der en policy senere er droppet eller omdøpt.
    SELECT count(*) INTO v_cnt FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('Users can upload own avatar',
                         'Team mates can view avatars',
                         'Owner or team admin can delete avatar');
    r := r || jsonb_build_array(jsonb_build_array(
      'C8 alle tre avatar-policyene er installert på storage.objects',
      CASE WHEN v_cnt = 3 THEN '✅' ELSE '❌ fant ' || v_cnt || ' av 3' END));

    SELECT cmd INTO v_txt FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Owner or team admin can delete avatar';
    r := r || jsonb_build_array(jsonb_build_array(
      'C9 slette-policyen gjelder DELETE (oppførselen testes via Storage-API-et)',
      CASE WHEN v_txt = 'DELETE' THEN '✅' ELSE '❌ ' || COALESCE(v_txt, 'mangler') END));

    -- ══ D. profiles-WITH CHECK: identitet, ikke tilgang ═══════
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    BEGIN
      UPDATE public.profiles SET avatar_url = p_far WHERE id = u_far;
      GET DIAGNOSTICS v_cnt = ROW_COUNT;
      r := r || jsonb_build_array(jsonb_build_array(
        'D1 egen path godtas',
        CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ kunne ikke sette sitt eget' END));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'D1 egen path godtas', '❌ ' || msg));
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    BEGIN
      -- Å sette lagkameratens bilde på seg selv: lesingen ville vært
      -- lovlig (man ser jo bildet uansett), men navnet ditt ville stått
      -- under et annet menneskes ansikt i feeden.
      UPDATE public.profiles SET avatar_url = p_mor WHERE id = u_far;
      r := r || jsonb_build_array(jsonb_build_array(
        'D2 en ANNENS path avvises', '❌ identitetstyveri mulig'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'D2 en ANNENS path avvises', '✅'));
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    BEGIN
      UPDATE public.profiles SET avatar_url = NULL WHERE id = u_far;
      GET DIAGNOSTICS v_cnt = ROW_COUNT;
      r := r || jsonb_build_array(jsonb_build_array(
        'D3 NULL godtas (du må kunne fjerne bildet ditt)',
        CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌' END));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        'D3 NULL godtas (du må kunne fjerne bildet ditt)', '❌ ' || msg));
    END;
    PERFORM set_config('role', 'postgres', true);

    -- ══ E. remove_member_avatar ═══════════════════════════════
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    BEGIN
      v := remove_member_avatar(ts1, u_mor);
      r := r || jsonb_build_array(jsonb_build_array(
        'E1 vanlig medlem kan ikke fjerne andres bilde', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'E1 vanlig medlem kan ikke fjerne andres bilde',
        CASE WHEN SQLERRM LIKE '%Bare trenere%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    BEGIN
      v := remove_member_avatar(ts1, u_fremd);
      r := r || jsonb_build_array(jsonb_build_array(
        'E2 person utenfor laget avvises', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'E2 person utenfor laget avvises',
        CASE WHEN SQLERRM LIKE '%hører ikke til%' THEN '✅' ELSE '❌ ' || SQLERRM END));
    END;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    v := remove_member_avatar(ts1, u_mor);
    SELECT avatar_url IS NULL INTO v_bool FROM public.profiles WHERE id = u_mor;
    r := r || jsonb_build_array(jsonb_build_array(
      'E3 lagadmin nuller bildet OG får path-en tilbake til sletting',
      CASE WHEN v->>'outcome' = 'cleared' AND v->>'path' = p_mor AND v_bool
        THEN '✅' ELSE '❌ ' || v::text END));

    v := remove_member_avatar(ts1, u_mor);
    r := r || jsonb_build_array(jsonb_build_array(
      'E4 uten bilde: outcome «none», ikke en feil',
      CASE WHEN v->>'outcome' = 'none' THEN '✅' ELSE '❌ ' || v::text END));

    -- En UTMELDT person vises fortsatt med bilde i gamle kommentarer
    -- (get_team_authors), så bildet må kunne fjernes derfra også.
    v := remove_member_avatar(ts1, u_ute);
    r := r || jsonb_build_array(jsonb_build_array(
      'E5 virker også på en UTMELDT person',
      CASE WHEN v->>'outcome' = 'cleared' THEN '✅' ELSE '❌ ' || v::text END));

    -- ══ F. Rapportering av profilbilde ════════════════════════
    UPDATE public.profiles SET avatar_url = p_mor WHERE id = u_mor;

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    PERFORM report_content('avatar', u_mor, 'upassende');
    SELECT count(*) INTO v_cnt FROM public.content_reports
    WHERE entity_type = 'avatar' AND entity_id = u_mor
      AND reporter_id = u_far AND content_author_id = u_mor
      AND content_snapshot = p_mor AND team_space_id = ts1;
    r := r || jsonb_build_array(jsonb_build_array(
      'F1 avatar-rapport: rad m/ frossen path, riktig eier og lag',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ fant ' || v_cnt END));

    PERFORM report_content('avatar', u_mor, 'trakassering');
    SELECT count(*) INTO v_cnt FROM public.content_reports
    WHERE entity_type = 'avatar' AND entity_id = u_mor AND reporter_id = u_far;
    r := r || jsonb_build_array(jsonb_build_array(
      'F2 idempotent: to rapporter = én åpen sak',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌ ' || v_cnt || ' saker' END));

    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_fremd, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM report_content('avatar', u_mor, 'upassende');
      r := r || jsonb_build_array(jsonb_build_array(
        'F3 fremmed kan ikke rapportere et bilde hen ikke ser', '❌ slapp gjennom'));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_array(jsonb_build_array(
        'F3 fremmed kan ikke rapportere et bilde hen ikke ser', '✅'));
    END;

    -- REGRESJON: 00041-grenene skal være ordrett uendret.
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub', u_far, 'role', 'authenticated')::text, true);
    INSERT INTO public.feed_posts (id, team_space_id, author_id, type, content)
    VALUES (gen_random_uuid(), ts1, u_mor, 'melding', 'Verify-innlegg')
    RETURNING id INTO post_id;
    PERFORM report_content('feed_post', post_id, 'annet');
    SELECT count(*) INTO v_cnt FROM public.content_reports
    WHERE entity_type = 'feed_post' AND entity_id = post_id
      AND content_snapshot = 'Verify-innlegg';
    r := r || jsonb_build_array(jsonb_build_array(
      'F4 REGRESJON: feed_post-grenen virker fortsatt',
      CASE WHEN v_cnt = 1 THEN '✅' ELSE '❌' END));

    -- REGRESJON: kontosletting nuller fortsatt avatar_url (00042).
    -- Kolonnen er fasiten — er den ikke nullet, blir bildet stående i
    -- frosne varselrader etter en GDPR-sletting.
    SELECT prosrc INTO v_txt FROM pg_proc WHERE proname = 'delete_account_data';
    r := r || jsonb_build_array(jsonb_build_array(
      'F5 REGRESJON: kontosletting nuller fortsatt avatar_url',
      CASE WHEN v_txt LIKE '%avatar_url%NULL%' THEN '✅'
           ELSE '❌ sjekk anonymiseringsgrenen (00042 → 00047 → 00062)' END));

    -- ── ROLLBACK-MARKØREN ────────────────────────────────────
    RAISE EXCEPTION USING errcode = 'P0968', message = MARKER;

  EXCEPTION
    WHEN sqlstate 'P0968' THEN
      NULL;  -- planlagt tilbakerulling — resultatene i r overlever
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      r := r || jsonb_build_array(jsonb_build_array(
        '⛔ UVENTET FEIL (alt rullet tilbake)', '❌ ' || msg));
  END;

  INSERT INTO verify_00068 (test, resultat)
  SELECT e->>0, e->>1 FROM jsonb_array_elements(r) e;

  INSERT INTO verify_00068 (test, resultat)
  SELECT 'SUM', count(*) FILTER (WHERE resultat = '✅') || '/' || count(*)
         || CASE WHEN count(*) FILTER (WHERE resultat LIKE '❌%') > 0
              THEN ' — SE ❌-RADENE'
            WHEN count(*) FILTER (WHERE resultat LIKE '⚠️%') > 0
              THEN ' GRØNT (med ⚠️-hopp)'
            ELSE ' GRØNT' END
  FROM verify_00068;
END $$;

SELECT n, test, resultat FROM verify_00068 ORDER BY n;
