-- ============================================================
-- 00023_inbox_direct_write.sql
--
-- To problemer med 00022, som begge gjorde inboxen tom:
--
-- 1. HELE inboxen hang på vault. `notify_on_feed_post` gjorde ingenting
--    uten `project_url` + `service_role_key`, fordi den bare fyrte et
--    pg_net-kall til Edge-funksjonen, som skrev radene. Ingen secrets =
--    ingen rader, for alltid. Nå skriver DATABASEN `notifications` selv,
--    i samme transaksjon. Inboxen virker uten secrets, uten Edge Function
--    og uten Apple. pg_net-kallet blir stående, men gjør nå KUN APNs.
--
-- 2. Alt fra feeden ble et varsel, så Varsler-fanen ble en kopi av Hjem.
--    Nå varsler vi kun på det som faktisk er et varsel:
--      ✔ kamphendelser (mål, avspark, pause, slutt)   → match_live
--      ✔ kommentar på DITT innlegg                    → new_comment
--      ✔ ny hendelse i kalenderen                     → event_reminder
--      ✘ vanlig melding/bilde i feeden — det ER feeden
--
-- Rekkefølgen betyr noe: `notifications` skrives FØR pg_net-kallet, så
-- push-fanout kan lese radene i stedet for å regne ut mottakere på nytt
-- (se supabase/functions/push-fanout/index.ts).
-- ============================================================


-- ============================================================
-- inbox_enabled()
-- Én rad i notification_preferences kan slå av en kategori.
-- Lag-raden slår den globale raden; finnes ingen av dem er svaret JA.
-- COALESCE er ikke pynt: uten den ville «ingen rad» blitt NULL, og
-- `WHERE NULL` filtrerer bort alle mottakerne (samme NULL-felle som i 00020).
-- ============================================================
CREATE OR REPLACE FUNCTION public.inbox_enabled(
  p_user     uuid,
  p_team     uuid,
  p_category text
)
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT p.enabled FROM public.notification_preferences p
      WHERE p.user_id = p_user AND p.channel = 'in_app'
        AND p.category = p_category AND p.team_space_id = p_team
      LIMIT 1),
    (SELECT g.enabled FROM public.notification_preferences g
      WHERE g.user_id = p_user AND g.channel = 'in_app'
        AND g.category = p_category AND g.team_space_id IS NULL
      LIMIT 1),
    true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ============================================================
-- notify_on_feed_post() — skriver inbox-rader selv
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
  -- Hva er verdt et varsel? melding/bilde/system er IKKE — de står i feeden,
  -- og en inbox som speiler feeden er bare en feed nummer to.
  v_category := CASE NEW.type
    WHEN 'match_start' THEN 'match_live'
    WHEN 'match_event' THEN 'match_live'
    WHEN 'match_end'   THEN 'match_live'
    WHEN 'paaminnelse' THEN 'event_reminder'
    WHEN 'resultat'    THEN 'new_post'
    ELSE NULL
  END;

  IF v_category IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ts.display_name INTO v_title
  FROM public.team_spaces ts WHERE ts.id = NEW.team_space_id;

  v_title := COALESCE(v_title, 'Heia');
  v_body  := COALESCE(NULLIF(btrim(NEW.content), ''), 'Ny aktivitet i laget');

  -- Mottakere: aktive lagmedlemmer minus forfatteren.
  -- IS DISTINCT FROM, ikke <>: en post uten forfatter (author_id null)
  -- ville ellers gitt NULL og filtrert bort ALLE mottakerne.
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

  -- APNs (valgfritt): kun hvis vault er seedet. Uten secrets står inboxen
  -- likevel — det er hele poenget med denne migrasjonen.
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


-- ============================================================
-- notify_on_comment() — «Kari kommenterte innlegget ditt»
--
-- Dette er varselet som gjør Varsler til noe annet enn feeden: det er
-- adressert til ÉN person og finnes ingen andre steder i appen.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS trigger AS $$
DECLARE
  v_post   RECORD;
  v_name   text;
BEGIN
  SELECT fp.id, fp.team_space_id, fp.author_id
    INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = NEW.feed_post_id;

  IF NOT FOUND OR v_post.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kommentar på egen post varsler vi ikke om. IS NOT DISTINCT FROM
  -- håndterer også en kommentar uten forfatter (author_id er nullbar).
  IF v_post.author_id IS NOT DISTINCT FROM NEW.author_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.inbox_enabled(v_post.author_id, v_post.team_space_id, 'new_comment') THEN
    RETURN NEW;
  END IF;

  SELECT pr.display_name INTO v_name
  FROM public.profiles pr WHERE pr.id = NEW.author_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_post.author_id,
    v_post.team_space_id,
    'new_comment',
    COALESCE(v_name, 'Noen'),
    'kommenterte innlegget ditt: ' || left(btrim(NEW.content), 80),
    jsonb_build_object(
      'feed_post_id',  v_post.id,
      'team_space_id', v_post.team_space_id
    ),
    'comment', NEW.id, now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();


-- ============================================================
-- notify_on_event_created() — «Ny kamp mot Lyn i kalenderen»
--
-- Hendelser lager ingen feed-post (bevisst, se 3B-1), så dette varselet
-- har ingen dublett i feeden. Tidspunktet skrives i norsk lokaltid —
-- start_time er timestamptz, og uten AT TIME ZONE ville det vist UTC.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_event_created()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_when  text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ts.display_name INTO v_title
  FROM public.team_spaces ts WHERE ts.id = NEW.team_space_id;

  v_when := to_char(NEW.start_time AT TIME ZONE 'Europe/Oslo', 'DD.MM. "kl." HH24:MI');

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, NEW.team_space_id, 'event_reminder',
         COALESCE(v_title, 'Heia'),
         NEW.title || ' — ' || v_when,
         jsonb_build_object(
           'event_id',      NEW.id,
           'team_space_id', NEW.team_space_id
         ),
         'event', NEW.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = NEW.team_space_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.created_by
    AND public.inbox_enabled(m.user_id, NEW.team_space_id, 'event_reminder');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_event_created ON public.events;
CREATE TRIGGER trg_notify_on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_created();
