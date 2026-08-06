-- ============================================================
-- 00052 — menneskelig ordlyd på kommentar- og 👏-varsler
--
-- Brage 2026-08-06: «Brage heiet på «Hei»» skal bli
--   «Brage heiet på innlegget ditt»
--   «Hei»                              ← innholdsutdraget
--
-- Før satt referansen INNE i setningen (post_ref() siterte posten midt i
-- body-en), så tittelen ble et navn uten handling og body-en en setning
-- med et sitat klemt inn. Nå bærer TITTELEN hele handlingen og BODY-en
-- utdraget — som er nøyaktig hierarkiet raden tegner: tittel i vekt,
-- utdrag i rolig tekst under.
--
-- Gevinsten treffer også push: «Emma kommenterte bildet ditt» /
-- «For en scoring!» leses riktig på låst skjerm.
--
-- post_ref() beholdes (den er IMMUTABLE og kan brukes andre steder),
-- men de to triggerne bruker den ikke lenger.
-- ============================================================


-- ─── Hva slags post det er snakk om, uten sitat ──────────────
CREATE OR REPLACE FUNCTION public.post_kind(p_type text)
RETURNS text AS $$
  SELECT CASE
    WHEN p_type = 'bilde' THEN 'bildet ditt'
    WHEN p_type IN ('match_event','match_start','match_end')
      THEN 'kampoppdateringen din'
    ELSE 'innlegget ditt'
  END;
$$ LANGUAGE sql IMMUTABLE;


-- ─── Innholdsutdraget, sitert ────────────────────────────────
-- NULL når det ikke finnes noe å sitere (bildepost uten tekst) — raden
-- skjuler da utdragslinja i stedet for å vise et tomt sitat.
CREATE OR REPLACE FUNCTION public.post_excerpt(p_content text)
RETURNS text AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_content, '')) = '' THEN NULL
    WHEN length(btrim(p_content)) > 80
      THEN '«' || left(btrim(p_content), 80) || '…»'
    ELSE '«' || btrim(p_content) || '»'
  END;
$$ LANGUAGE sql IMMUTABLE;


-- ============================================================
-- notify_on_reaction() — som 00051, men tittelen bærer handlingen.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS trigger AS $$
DECLARE
  v_post     RECORD;
  v_name     text;
  v_avatar   text;
  v_kind     text;
  v_count    int;
  v_title    text;
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

  v_kind := public.post_kind(v_post.type);

  SELECT count(*) INTO v_count
  FROM public.reactions r
  WHERE r.feed_post_id = v_post.id
    AND r.user_id IS DISTINCT FROM v_post.author_id;

  v_title := CASE
    WHEN v_count <= 1 THEN v_name || ' heiet på ' || v_kind
    WHEN v_count = 2  THEN v_name || ' og 1 annen heiet på ' || v_kind
    ELSE v_name || ' og ' || (v_count - 1) || ' andre heiet på ' || v_kind
  END;

  -- Utdraget er DIN egen post — den du får applaus for.
  v_body := COALESCE(public.post_excerpt(v_post.content), '');

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
    SET title = v_title, body = v_body, data = v_data,
        sent_at = now(), created_at = now()
    WHERE id = v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id, v_post.team_space_id, 'new_reaction', v_title, v_body,
    v_data,
    'feed_post', v_post.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- notify_on_comment() — som 00051, men tittelen bærer handlingen og
-- body-en er selve kommentaren.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS trigger AS $$
DECLARE
  v_post   RECORD;
  v_name   text;
  v_avatar text;
  v_kind   text;
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
  v_name := COALESCE(v_name, 'Noen');

  v_kind := public.post_kind(v_post.type);
  -- Her er utdraget KOMMENTAREN, ikke posten: det er den nye informasjonen.
  v_text := COALESCE(public.post_excerpt(NEW.content), '');

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id,
    v_post.team_space_id,
    'new_comment',
    v_name || ' kommenterte ' || v_kind,
    v_text,
    jsonb_build_object(
      'feed_post_id',  v_post.id,
      'team_space_id', v_post.team_space_id,
      'actor_id',      NEW.author_id,
      'actor_name',    v_name,
      'actor_avatar',  v_avatar
    ),
    'comment', NEW.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
