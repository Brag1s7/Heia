-- ============================================================
-- 00024_reaction_and_broadcast.sql
--
-- To ting:
--
-- 1. 👏 «Heia» varsler forfatteren. Dette er kudos-varselet — motoren i
--    innholdsløkka: du poster, noen heier, du får beskjed, du poster igjen.
--    AGGREGERT: ti som heier på samme innlegg blir ÉN rad, ikke ti.
--
-- 2. «Varsle hele laget». Etter 00023 varsler ikke vanlige innlegg — men
--    noen ganger ER innlegget viktig. Treneren sier det selv ved å sette
--    is_pinned (kolonnen fantes alt, og get_team_feed sorterer pinnede
--    øverst). Pinnet melding/bilde → varsel i kategorien admin_message.
--
--    ⚠️ Pinning låses til trener/lagleder/admin i DATABASEN, ikke bare i
--    UI-et. INSERT-policyen på feed_posts sjekker kun medlemskap, så uten
--    denne vakten kunne hvilken som helst forelder varslet hele laget.
-- ============================================================


-- ============================================================
-- Ny kategori: new_reaction
-- CHECK-ene i 00011 er inline på kolonnen, så navnet er autogenerert.
-- Vi finner dem via pg_constraint i stedet for å gjette navnet — treffer
-- vi feil navn blir den gamle, strengere CHECK-en stående og hver eneste
-- reaksjon feiler.
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE c.conrelid IN (
            'public.notifications'::regclass,
            'public.notification_preferences'::regclass)
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%new_comment%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (category IN ('event_reminder','rsvp_update','match_live','new_post',
                      'new_comment','new_reaction','admin_message','system'));

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_category_check
  CHECK (category IN ('event_reminder','rsvp_update','match_live','new_post',
                      'new_comment','new_reaction','admin_message','system'));


-- ============================================================
-- notify_on_reaction() — «Kari og 3 andre heiet på innlegget ditt»
--
-- Aggregering: finnes det alt en ULEST reaksjonsrad for samme innlegg,
-- oppdaterer vi den i stedet for å lage en ny. created_at bumpes med
-- vilje — hendelsen er fersk og skal ligge øverst i inboxen.
-- Er raden lest, lager vi en ny (da har brukeren sett den forrige).
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS trigger AS $$
DECLARE
  v_post     RECORD;
  v_name     text;
  v_count    int;
  v_body     text;
  v_existing uuid;
BEGIN
  SELECT fp.id, fp.team_space_id, fp.author_id
    INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = NEW.feed_post_id;

  IF NOT FOUND OR v_post.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Egen reaksjon på egen post varsler vi ikke om.
  IF v_post.author_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.inbox_enabled(v_post.author_id, v_post.team_space_id, 'new_reaction') THEN
    RETURN NEW;
  END IF;

  SELECT pr.display_name INTO v_name
  FROM public.profiles pr WHERE pr.id = NEW.user_id;
  v_name := COALESCE(v_name, 'Noen');

  -- Alle andres reaksjoner på posten (forfatterens egen teller ikke med).
  SELECT count(*) INTO v_count
  FROM public.reactions r
  WHERE r.feed_post_id = v_post.id
    AND r.user_id IS DISTINCT FROM v_post.author_id;

  v_body := CASE
    WHEN v_count <= 1 THEN 'heiet på innlegget ditt'
    WHEN v_count = 2  THEN 'og 1 annen heiet på innlegget ditt'
    ELSE 'og ' || (v_count - 1) || ' andre heiet på innlegget ditt'
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
    v_post.author_id,
    v_post.team_space_id,
    'new_reaction',
    v_name,
    v_body,
    jsonb_build_object(
      'feed_post_id',  v_post.id,
      'team_space_id', v_post.team_space_id
    ),
    'feed_post', v_post.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.reactions;
CREATE TRIGGER trg_notify_on_reaction
  AFTER INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION notify_on_reaction();


-- ============================================================
-- enforce_pin_is_admin() — «Varsle hele laget» er ikke for alle
--
-- COALESCE rundt is_team_admin: den kan returnere NULL, og
-- `IF NOT NULL THEN` kjører ikke — da hadde vakten sluppet alle gjennom
-- (samme NULL-felle som i 00020).
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_pin_is_admin()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(NEW.is_pinned, false)
     AND NOT COALESCE(public.is_team_admin(NEW.team_space_id), false) THEN
    RAISE EXCEPTION 'Kun trener eller lagleder kan varsle hele laget';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_pin_is_admin ON public.feed_posts;
CREATE TRIGGER trg_enforce_pin_is_admin
  BEFORE INSERT OR UPDATE OF is_pinned ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_pin_is_admin();


-- ============================================================
-- notify_on_feed_post() — som i 00023, pluss pinnet melding/bilde.
-- Tittelen er lagnavnet for kamp (det er laget som spiller), men
-- forfatterens navn for en beskjed (det er treneren som snakker).
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_feed_post()
RETURNS trigger AS $$
DECLARE
  v_category text;
  v_title    text;
  v_body     text;
  v_base     text;
  v_key      text;
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

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, NEW.team_space_id, v_category, v_title, v_body,
         jsonb_build_object(
           'feed_post_id',  NEW.id,
           'event_id',      NEW.event_id,
           'team_space_id', NEW.team_space_id,
           'type',          NEW.type
         ),
         'feed_post', NEW.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = NEW.team_space_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.author_id
    AND public.inbox_enabled(m.user_id, NEW.team_space_id, v_category);

  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_base IS NOT NULL AND v_key IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_base || '/functions/v1/push-fanout',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('feed_post_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
