-- ============================================================
-- 00078_korriger_maal_behold_maalscorer.sql
-- MÅLSCORERFELTET ER TRUKKET UT AV KLIENTEN — og RPC-en må slutte å
-- tolke «ikke sendt» som «tøm feltet».
--
-- ---------------------------------------------------------------------------
-- ⚠️ BESLUTNING (Brage 2026-08-21)
--
-- «Korriger mål» skal KUN endre side, endre en eksisterende beskrivelse,
-- eller annullere målet. **Målscorer utsettes** til det kan implementeres
-- konsekvent i BEGGE ender — opprettelse, redigering, feed og historikk.
-- `report_match_event` har i dag ÉTT fritekstfelt som havner i
-- `description`, så et eget målscorerfelt bare i korrigeringen ville laget
-- to ulike sannheter om hva «målscorer» er.
--
-- Parameteren `p_player_name` BEHOLDES for kompatibilitet — signaturen er
-- allerede grantet og kallt fra en app som er i bruk, og å endre den ville
-- vært en DROP+CREATE med grant-felle for ingenting.
--
-- ---------------------------------------------------------------------------
-- ⚠️ HVA SOM VAR FARLIG, OG HVORFOR DENNE FILA FINNES
--
-- 00075 skrev UBETINGET:
--
--     player_name = v_player          -- v_player = NULLIF(btrim(p_player_name),'')
--
-- Slutter klienten å sende feltet, er `p_player_name` NULL, `v_player` NULL —
-- og hver eneste korrigering ville da **STILLE SLETTET** en eksisterende
-- eller importert målscorer. Å bare fjerne feltet i appen uten denne
-- migrasjonen ville altså gjort «rett siden på målet» til «rett siden og
-- mist navnet på den som scoret».
--
-- Nå gjelder: **NULL betyr «ikke rør», aldri «tøm».**
--
--     player_name = COALESCE(v_player, v_me.player_name)
--
-- `description` er derimot fortsatt fullt klientstyrt — den ER feltet
-- brukeren redigerer, og en tom tekst DER skal bety «tøm».
--
-- ---------------------------------------------------------------------------
-- ⚠️⚠️ CREATE OR REPLACE NULLSTILLER ATTRIBUTTER SOM IKKE GJENTAS.
--
-- `SECURITY DEFINER` og `SET search_path` er IKKE arvet fra den forrige
-- definisjonen — utelates de her, blir funksjonen SECURITY INVOKER med
-- ulåst søkesti, og både 00075 og 00077 ville vært stille reversert på
-- akkurat denne funksjonen. Begge er derfor gjentatt i halen.
--
-- GRANT/REVOKE overlever derimot CREATE OR REPLACE (pg_proc-raden oppdateres,
-- den droppes ikke). De gjentas likevel nederst — det koster ingenting og
-- gjør fila lesbar alene. Anon-proben kjøres etter push uansett.
--
-- ⚠️ KROPPEN ER ELLERS BYTE-IDENTISK MED 00075. Den ble hentet ut
-- programmatisk og endret på nøyaktig tre steder (UPDATE-en, audit-raden og
-- attributt-halen) i stedet for å skrives av — en avskrift av 240 linjer
-- plpgsql er ren risiko uten gevinst.
-- ============================================================


CREATE OR REPLACE FUNCTION public.correct_match_goal(
  p_match_event_id uuid,
  p_action         text,
  p_team_side      text DEFAULT NULL,
  p_player_name    text DEFAULT NULL,
  p_description    text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_me        record;
  v_ms        record;
  v_evt       record;
  v_post_id   uuid;
  v_team      text;
  v_side      text;
  v_player    text := NULLIF(btrim(COALESCE(p_player_name, '')), '');
  v_desc      text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_was_home  int;
  v_was_away  int;
  v_home      int;
  v_away      int;
  v_body      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_action NOT IN ('edit', 'cancel') THEN
    RAISE EXCEPTION 'Unsupported correction: %', p_action;
  END IF;

  -- ⚠️ LÅSEN FØRST, HENDELSEN ETTERPÅ — og rekkefølgen er ikke stil.
  -- Leses hendelsen før økta er låst, kan en annen reporter rette det SAMME
  -- målet i mellomtiden; da står `v_me.team_side` på en verdi som ikke lenger
  -- er sann, og «ble dette et mål imot nå?» under (som sletter HEIA-ene)
  -- svarer feil. Stillingen telles opp under samme lås.
  SELECT ms.* INTO v_ms
  FROM public.match_sessions ms
  WHERE ms.id = (
    SELECT me.match_session_id
    FROM public.match_events me
    WHERE me.id = p_match_event_id
  )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match event not found';
  END IF;

  SELECT * INTO v_me
  FROM public.match_events
  WHERE id = p_match_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match event not found';
  END IF;

  -- Bare MÅL. Rytmemarkørene (avspark, pause, 2. omgang, slutt) eier
  -- kampuret (00073) og kan ikke rettes uten å reversere tid; meldinger er
  -- reporterens egne ord og har ingen stilling å regne om.
  IF v_me.type <> 'mål' THEN
    RAISE EXCEPTION 'Only goals can be corrected';
  END IF;

  SELECT * INTO v_evt FROM public.events WHERE id = v_ms.event_id;

  -- Se COALESCE-kommentaren i start_match: uten den slipper et vanlig medlem
  -- gjennom på en kamp der reporter_id er NULL.
  IF NOT (
    COALESCE(v_ms.reporter_id = v_uid, false)
    OR is_team_admin(v_evt.team_space_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_was_home := v_ms.home_score;
  v_was_away := v_ms.away_score;

  -- Den KANONISKE posten for øyeblikket. Samme regel som appen bruker
  -- (`pickCanonicalPost`, shared/matchEngagement): systemposten, aldri et
  -- bilde. Eldst først, med id som tie-break, så to klienter aldri velger
  -- hver sin.
  -- ⚠️ KUN ID-EN, IKKE HELE RADEN. En `record` som ikke traff noe er ubehagelig
  -- å feltlese i plpgsql; en uuid er utvetydig NULL.
  SELECT fp.id INTO v_post_id
  FROM public.feed_posts fp
  WHERE fp.match_event_id = p_match_event_id
    AND fp.type IN ('match_event', 'match_start', 'match_end')
    AND fp.deleted_at IS NULL
  ORDER BY fp.created_at, fp.id
  LIMIT 1;

  -- ─── HANDLINGEN ──────────────────────────────────────────
  IF p_action = 'edit' THEN
    v_side := COALESCE(p_team_side, v_me.team_side);
    IF v_side NOT IN ('home', 'away') THEN
      RAISE EXCEPTION 'A goal needs team_side home or away';
    END IF;

    UPDATE public.match_events
    SET team_side   = v_side,
        -- ⚠️ COALESCE, IKKE v_player: NULL betyr «ikke rør», ikke «tøm».
        -- Se hodet på migrasjonen — klienten sender ikke lenger feltet.
        player_name = COALESCE(v_player, v_me.player_name),
        description = v_desc
    WHERE id = p_match_event_id;

    -- Ble målet vårt til et mål imot, er HEIA-ene ugyldige (P1).
    -- Kommentarene står.
    IF v_side = 'away' AND v_me.team_side IS DISTINCT FROM 'away'
       AND v_post_id IS NOT NULL THEN
      DELETE FROM public.reactions WHERE feed_post_id = v_post_id;
      DELETE FROM public.notifications
      WHERE category = 'new_reaction'
        AND source_entity_type = 'feed_post'
        AND source_entity_id = v_post_id;
    END IF;

  ELSE  -- 'cancel'
    IF v_post_id IS NOT NULL THEN
      UPDATE public.feed_posts
      SET deleted_at = now(), is_pinned = false
      WHERE id = v_post_id;

      DELETE FROM public.reactions WHERE feed_post_id = v_post_id;

      -- Alle varsler posten har utløst — målvarselet, heia-varslene og
      -- kommentarvarslene — bærer samme source_entity (00051), så én DELETE
      -- tar innboksen ren.
      DELETE FROM public.notifications
      WHERE source_entity_type = 'feed_post'
        AND source_entity_id = v_post_id;
    END IF;

    -- Hard sletting: målet skal ikke finnes i forløpet. Bildepostene løsner
    -- via FK-en (ON DELETE SET NULL) og blir liggende — de blir frittstående
    -- kampbilder, som er nøyaktig det de er når målet ikke skjedde.
    -- ⚠️ Den soft-slettede systemposten mister også koblingen sin. Derfor
    -- bærer audit-raden under `feed_post_id`: uten den ville en gjenoppretting
    -- (ops, service role) ikke visst hvilken post som hørte til hendelsen.
    -- ⚠️ Nås tilskuerne kun fordi tabellen har REPLICA IDENTITY FULL (punkt 1).
    DELETE FROM public.match_events WHERE id = p_match_event_id;
  END IF;

  -- ─── STILLINGEN, TELT OPP PÅ NYTT ────────────────────────
  -- ⚠️ `IS DISTINCT FROM 'home'` på motstandersiden, ikke `= 'away'`: et mål
  -- uten side (importerte data) skal telle som mål IMOT. Samme
  -- forsiktighetsregel som `isOpponentGoal` i appen — bedre å underfeire eget
  -- mål enn å feire motstanderens.
  SELECT
    (count(*) FILTER (WHERE me.team_side = 'home'))::int,
    (count(*) FILTER (WHERE me.team_side IS DISTINCT FROM 'home'))::int
  INTO v_home, v_away
  FROM public.match_events me
  WHERE me.match_session_id = v_ms.id
    AND me.type = 'mål';

  UPDATE public.match_sessions
  SET home_score = v_home, away_score = v_away
  WHERE id = v_ms.id
  RETURNING * INTO v_ms;

  -- ─── SNAPSHOTENE ─────────────────────────────────────────
  PERFORM public.rebuild_match_feed_texts(v_ms.id);

  -- ─── INTERN AUDIT (service-role-only, 00012) ─────────────
  INSERT INTO public.audit_log
    (actor_id, team_space_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    v_uid, v_evt.team_space_id,
    'correct_match_goal:' || p_action,
    'match_event', p_match_event_id,
    jsonb_build_object(
      'type',           v_me.type,
      'minute',         v_me.minute,
      'team_side',      v_me.team_side,
      'player_name',    v_me.player_name,
      'description',    v_me.description,
      'sequence',       v_me.sequence,
      'reported_by',    v_me.reported_by,
      'created_at',     v_me.created_at,
      'feed_post_id',   v_post_id,
      'home_score',     v_was_home,
      'away_score',     v_was_away
    ),
    -- ⚠️ COALESCE, ikke bar CASE: `NULL || jsonb` er NULL i Postgres, så en
    -- annullering ville mistet stillingen sin i auditen helt stille.
    COALESCE(
      CASE WHEN p_action = 'cancel' THEN NULL ELSE jsonb_build_object(
        'team_side',   v_side,
        'player_name', COALESCE(v_player, v_me.player_name),
        'description', v_desc
      ) END,
      jsonb_build_object('cancelled', true)
    ) || jsonb_build_object('home_score', v_home, 'away_score', v_away)
  );

  -- ─── KORRIGERINGSVARSELET ────────────────────────────────
  IF v_home <> v_was_home OR v_away <> v_was_away THEN
    SELECT display_name INTO v_team
    FROM public.team_spaces WHERE id = v_evt.team_space_id;

    v_body := format(
      'Stillingen er rettet: %s %s–%s %s',
      COALESCE(v_team, 'Laget'), v_home, v_away,
      COALESCE(v_ms.opponent, 'motstanderen')
    );

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT DISTINCT m.user_id, v_evt.team_space_id, 'match_live',
           COALESCE(v_team, 'Heia'), v_body,
           jsonb_build_object(
             'event_id',         v_evt.id,
             'team_space_id',    v_evt.team_space_id,
             'match_session_id', v_ms.id,
             'type',             'match_correction',
             'home_score',       v_home,
             'away_score',       v_away,
             'opponent',         v_ms.opponent
           ),
           'match_session', v_ms.id, now()
    FROM public.memberships m
    WHERE m.team_space_id = v_evt.team_space_id
      AND m.status = 'active'
      AND m.user_id IS DISTINCT FROM v_uid
      AND public.inbox_enabled(m.user_id, v_evt.team_space_id, 'match_live');
  END IF;

  RETURN jsonb_build_object(
    'match_event_id', p_match_event_id,
    'action',         p_action,
    'home_score',     v_home,
    'away_score',     v_away,
    'status',         v_ms.status,
    'score_changed',  (v_home <> v_was_home OR v_away <> v_was_away)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- Rettighetene gjentas — se merknaden i hodet.
-- ============================================================
GRANT EXECUTE ON FUNCTION
  public.correct_match_goal(uuid, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION
  public.correct_match_goal(uuid, text, text, text, text) FROM PUBLIC, anon;


-- ============================================================
-- ✅ KONTROLL etter push:
--
--   1) Døren står: anon-probe mot /rest/v1/rpc/correct_match_goal
--      skal gi 401 / 42501, ikke P0001.
--
--   2) Attributtene overlevde:
--        SELECT prosecdef, proconfig FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname='public' AND p.proname='correct_match_goal';
--        -- prosecdef = t, proconfig = {"search_path=public, pg_temp"}
--
--   3) Målscoreren overlever en korrigering:
--        sett player_name på et mål, kall correct_match_goal(…, 'edit',
--        'away', NULL, 'ny tekst'), og les player_name igjen — uendret.
--      `scripts/verify-00075.sql` B3 er skrevet om til å vokte nettopp dette.
-- ============================================================
