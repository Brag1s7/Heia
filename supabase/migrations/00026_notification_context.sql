-- ============================================================
-- 00026_notification_context.sql
--
-- «Kari heiet på innlegget ditt» sier ikke HVILKET innlegg. Har du postet
-- tre ting i dag er varselet ubrukelig uten å trykke — og for en reaksjon
-- fører trykket til en tom kommentartråd.
--
-- Nå bærer varselet et utdrag av posten, så raden er selvforklarende:
--   «Kari»  /  «heiet på «Husk drakter i morgen»»
--   «Per»   /  «kommenterte på «Husk drakter»: Ja, jeg tar med ekstra»
--
-- Kun tekst i notifications endres. Ingen nye kolonner, ingen ny trigger.
-- ============================================================


-- ============================================================
-- post_ref() — hvordan vi omtaler en post inne i en setning.
-- Tekst blir sitert og forkortet; en bildepost uten tekst har ingenting
-- å sitere, så den omtales som «bildet ditt».
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_ref(p_content text, p_type text)
RETURNS text AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_content, '')) <> '' THEN
      '«' ||
      CASE WHEN length(btrim(p_content)) > 60
           THEN left(btrim(p_content), 60) || '…'
           ELSE btrim(p_content)
      END
      || '»'
    WHEN p_type = 'bilde' THEN 'bildet ditt'
    ELSE 'innlegget ditt'
  END;
$$ LANGUAGE sql IMMUTABLE;


-- ============================================================
-- notify_on_reaction() — som i 00024, men body-en peker på posten.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS trigger AS $$
DECLARE
  v_post     RECORD;
  v_name     text;
  v_ref      text;
  v_count    int;
  v_body     text;
  v_existing uuid;
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

  SELECT pr.display_name INTO v_name
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
    SET title = v_name, body = v_body, sent_at = now(), created_at = now()
    WHERE id = v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id, v_post.team_space_id, 'new_reaction', v_name, v_body,
    jsonb_build_object(
      'feed_post_id',  v_post.id,
      'team_space_id', v_post.team_space_id
    ),
    'feed_post', v_post.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- notify_on_comment() — som i 00023, men sier hvilket innlegg det gjelder.
-- Kommentarteksten kortes til 60 tegn her (var 80) fordi referansen til
-- posten nå tar plass i samme linje.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS trigger AS $$
DECLARE
  v_post RECORD;
  v_name text;
  v_ref  text;
  v_text text;
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

  SELECT pr.display_name INTO v_name
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
      'team_space_id', v_post.team_space_id
    ),
    'comment', NEW.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
