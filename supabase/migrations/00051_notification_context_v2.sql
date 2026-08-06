-- ============================================================
-- 00051 — «lagets puls»: strukturert kontekst i notifications.data
--
-- Varsler skal være ENDRINGSLOGGEN MED FØLELSER (Brages rollefordeling
-- 2026-08-05): Hjem er den redaksjonelle oversikten, Kalender er den
-- kronologiske fasiten, Varsler viser hva som faktisk har skjedd siden
-- sist. Da må et kampøyeblikk vises som et øyeblikk (stilling, minutt)
-- og et menneske som et menneske (avatar) — ikke som grå tekstrader.
--
-- Alt som trengs FINNES allerede i basen. Det når bare aldri fram til
-- varselet, fordi `data` kun bærer feed_post_id/event_id/type.
--
-- Denne migrasjonen legger til FELT I `data`. Ingen skjemaendring,
-- ingen ny tabell, ingen rettighetsendring — kun CREATE OR REPLACE av
-- tre trigger-funksjoner som allerede finnes.
--
-- BAKOVERKOMPATIBELT: gamle varsler mangler de nye nøklene. Appen
-- leser dem som `undefined` og faller tilbake til den rolige raden,
-- så ingenting i historikken knekker.
--
-- HVORFOR match_session_id ER NØKKELEN: kampen skal være ETT objekt
-- som beveger seg gjennom kommende → live → ferdig, ikke tre kort.
-- «Kampen er i gang», «1–0» og «1–1» hører til samme kamp, og appen
-- grupperer dem på nettopp dette feltet.
--
-- HVORFOR actor DENORMALISERES: `data` er jsonb uten fremmednøkkel,
-- så PostgREST kan ikke joine profiles fra klienten — alternativet er
-- en ekstra rundtur per skjermvisning. `title` bærer allerede
-- avsenderens navn på samme måte (00026). At avataren fryses er
-- dessuten riktig: et varsel er et historisk faktum.
-- ============================================================


-- ============================================================
-- notify_on_feed_post() — som 00049, men match_live-varsler bærer nå
-- kampkonteksten, og beskjeder bærer avsenderen.
--
-- Kampfeltene hentes via NEW.match_event_id → match_events →
-- match_sessions. `report_match_event` (00020) skriver begge FØR
-- feed-posten settes inn, så stillingen her er stillingen ETTER
-- hendelsen — samme konvensjon som teksten i feeden.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_feed_post()
RETURNS trigger AS $$
DECLARE
  v_category text;
  v_title    text;
  v_body     text;
  v_data     jsonb;
  v_me       RECORD;
  v_actor    RECORD;
BEGIN
  v_category := CASE
    WHEN NEW.type IN ('match_start','match_event','match_end') THEN 'match_live'
    WHEN NEW.type = 'paaminnelse' THEN 'event_reminder'
    WHEN NEW.type = 'resultat'    THEN 'new_post'
    -- Vanlig melding/bilde varsler KUN når avsenderen har bedt om det.
    WHEN NEW.type IN ('melding','bilde') AND COALESCE(NEW.is_pinned, false)
      THEN 'admin_message'
    ELSE NULL
  END;

  IF v_category IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_category = 'admin_message' THEN
    SELECT pr.display_name INTO v_title
    FROM public.profiles pr WHERE pr.id = NEW.author_id;
    v_title := COALESCE(v_title, 'Beskjed til laget');
  ELSE
    SELECT ts.display_name INTO v_title
    FROM public.team_spaces ts WHERE ts.id = NEW.team_space_id;
    v_title := COALESCE(v_title, 'Heia');
  END IF;

  v_body := COALESCE(NULLIF(btrim(NEW.content), ''), 'Ny aktivitet i laget');

  v_data := jsonb_build_object(
    'feed_post_id',  NEW.id,
    'event_id',      NEW.event_id,
    'team_space_id', NEW.team_space_id,
    'type',          NEW.type
  );

  -- ─── Kampkontekst ────────────────────────────────────────
  IF v_category = 'match_live' AND NEW.match_event_id IS NOT NULL THEN
    SELECT me.type      AS event_type,
           me.minute    AS minute,
           me.team_side AS team_side,
           ms.id        AS session_id,
           ms.home_score,
           ms.away_score,
           ms.opponent
      INTO v_me
    FROM public.match_events me
    JOIN public.match_sessions ms ON ms.id = me.match_session_id
    WHERE me.id = NEW.match_event_id;

    IF FOUND THEN
      v_data := v_data || jsonb_build_object(
        'match_session_id', v_me.session_id,
        'match_event_type', v_me.event_type,
        'minute',           v_me.minute,
        'team_side',        v_me.team_side,
        'home_score',       v_me.home_score,
        'away_score',       v_me.away_score,
        'opponent',         v_me.opponent
      );
    END IF;
  END IF;

  -- ─── Avsenderen på beskjeder ─────────────────────────────
  -- «Treneren har endret oppmøtet» skal vise treneren, ikke en megafon.
  IF v_category = 'admin_message' THEN
    SELECT pr.id, pr.display_name, pr.avatar_url INTO v_actor
    FROM public.profiles pr WHERE pr.id = NEW.author_id;
    IF FOUND THEN
      v_data := v_data || jsonb_build_object(
        'actor_id',     v_actor.id,
        'actor_name',   v_actor.display_name,
        'actor_avatar', v_actor.avatar_url
      );
    END IF;
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, NEW.team_space_id, v_category, v_title, v_body,
         v_data,
         'feed_post', NEW.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = NEW.team_space_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.author_id
    AND public.inbox_enabled(m.user_id, NEW.team_space_id, v_category);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- notify_on_reaction() — som 00026 + actor i data.
-- NB: OPPDATERINGSGRENEN (samlevarselet «og 3 andre heiet») må også
-- skrive data. Ellers ville avataren blitt stående på den FØRSTE som
-- heiet, mens tittelen viser den siste.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS trigger AS $$
DECLARE
  v_post     RECORD;
  v_name     text;
  v_avatar   text;
  v_ref      text;
  v_count    int;
  v_body     text;
  v_existing uuid;
  v_data     jsonb;
BEGIN
  SELECT fp.id, fp.team_space_id, fp.author_id, fp.content, fp.type
    INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = NEW.feed_post_id;

  IF NOT FOUND OR v_post.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_post.author_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.inbox_enabled(v_post.author_id, v_post.team_space_id, 'new_reaction') THEN
    RETURN NEW;
  END IF;

  SELECT pr.display_name, pr.avatar_url INTO v_name, v_avatar
  FROM public.profiles pr WHERE pr.id = NEW.user_id;
  v_name := COALESCE(v_name, 'Noen');

  v_ref := public.post_ref(v_post.content, v_post.type);

  SELECT count(*) INTO v_count
  FROM public.reactions r
  WHERE r.feed_post_id = v_post.id
    AND r.user_id IS DISTINCT FROM v_post.author_id;

  v_body := CASE
    WHEN v_count <= 1 THEN 'heiet på ' || v_ref
    WHEN v_count = 2  THEN 'og 1 annen heiet på ' || v_ref
    ELSE 'og ' || (v_count - 1) || ' andre heiet på ' || v_ref
  END;

  v_data := jsonb_build_object(
    'feed_post_id',  v_post.id,
    'team_space_id', v_post.team_space_id,
    'actor_id',      NEW.user_id,
    'actor_name',    v_name,
    'actor_avatar',  v_avatar
  );

  SELECT n.id INTO v_existing
  FROM public.notifications n
  WHERE n.user_id = v_post.author_id
    AND n.category = 'new_reaction'
    AND n.source_entity_type = 'feed_post'
    AND n.source_entity_id = v_post.id
    AND n.read_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.notifications
    SET title = v_name, body = v_body, data = v_data,
        sent_at = now(), created_at = now()
    WHERE id = v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id, v_post.team_space_id, 'new_reaction', v_name, v_body,
    v_data,
    'feed_post', v_post.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- notify_on_comment() — som 00026 + actor i data.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS trigger AS $$
DECLARE
  v_post   RECORD;
  v_name   text;
  v_avatar text;
  v_ref    text;
  v_text   text;
BEGIN
  SELECT fp.id, fp.team_space_id, fp.author_id, fp.content, fp.type
    INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = NEW.feed_post_id;

  IF NOT FOUND OR v_post.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_post.author_id IS NOT DISTINCT FROM NEW.author_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.inbox_enabled(v_post.author_id, v_post.team_space_id, 'new_comment') THEN
    RETURN NEW;
  END IF;

  SELECT pr.display_name, pr.avatar_url INTO v_name, v_avatar
  FROM public.profiles pr WHERE pr.id = NEW.author_id;

  v_ref  := public.post_ref(v_post.content, v_post.type);
  v_text := btrim(NEW.content);
  IF length(v_text) > 60 THEN
    v_text := left(v_text, 60) || '…';
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id,
    v_post.team_space_id,
    'new_comment',
    COALESCE(v_name, 'Noen'),
    'kommenterte på ' || v_ref || ': ' || v_text,
    jsonb_build_object(
      'feed_post_id',  v_post.id,
      'team_space_id', v_post.team_space_id,
      'actor_id',      NEW.author_id,
      'actor_name',    COALESCE(v_name, 'Noen'),
      'actor_avatar',  v_avatar
    ),
    'comment', NEW.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
