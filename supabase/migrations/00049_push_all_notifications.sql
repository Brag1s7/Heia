-- ============================================================
-- 00049_push_all_notifications.sql
-- PUSH FOR ALLE VARSLER — ikke bare feed-poster.
--
-- Før: kun notify_on_feed_post kalte push-fanout (pg_net), så
-- kommentarer, reaksjoner, hendelser og klubbdør-varsler landet i
-- inboxen uten push. Nå flyttes push-kallet dit sannheten bor:
-- én statement-trigger på notifications-tabellen selv. Alt som
-- skriver inbox-rader (dagens triggere, klubbdør-RPC-ene, alt
-- fremtidig) får push gratis — og inbox/push kan aldri komme ut
-- av synk, for pushen ER inbox-radene.
--
-- Statement-nivå med transition table: en feed-post til et lag med
-- 20 medlemmer er ÉN insert-statement → ett http-kall med 20 id-er,
-- ikke 20 kall. pg_net er asynk og fyrer først etter commit, så
-- ingen RPC blir tregere og en feilet push ruller aldri noe tilbake.
--
-- Samme vault-idiom som 00022/00043/00044 (project_url +
-- service_role_key — seedet og verifisert 2026-08-03). Mangler
-- secretene gjør triggeren ingenting; inboxen virker uansett.
-- ============================================================

CREATE OR REPLACE FUNCTION push_on_notifications()
RETURNS trigger AS $$
DECLARE
  v_base text;
  v_key  text;
  v_ids  jsonb;
BEGIN
  -- Statement-triggere fyrer også på 0-radersinserts; da er det
  -- ingenting å pushe.
  SELECT jsonb_agg(id) INTO v_ids FROM new_rows;
  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

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
      body    := jsonb_build_object('notification_ids', v_ids)
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_push_on_notifications ON public.notifications;
CREATE TRIGGER trg_push_on_notifications
  AFTER INSERT ON public.notifications
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION push_on_notifications();


-- ============================================================
-- notify_on_feed_post() — identisk med 00024-versjonen, MINUS
-- pg_net-kallet på slutten: det bor nå i trg_push_on_notifications,
-- og å beholde begge ville gitt dobbel push på hver feed-post.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_feed_post()
RETURNS trigger AS $$
DECLARE
  v_category text;
  v_title    text;
  v_body     text;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
