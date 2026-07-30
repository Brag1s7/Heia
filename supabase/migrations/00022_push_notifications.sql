-- ============================================================
-- 00022_push_notifications.sql
-- EKTE PUSH — hele pipelinen henger på ett punkt.
--
-- Hver kamphendelse OG hver feed-post er allerede én rad i
-- feed_posts (bygget i 3C). Så i stedet for å røre report_match_event
-- eller createTextPost legger vi ÉN trigger på feed_posts INSERT.
-- Den fyrer en async HTTP-POST (pg_net) til Edge Function «push-fanout»,
-- som regner ut mottakere og sender APNs.
--
-- Hvorfor pg_net og ikke å sende fra RPC-en:
--   1. Ett hook dekker mål, avspark, pause, andre omgang, slutt OG
--      tekst/bilde-poster — alt går via feed_posts.
--   2. net.http_post er ASYNK (køes), så report_match_event blir ikke
--      tregere av at et varsel skal ut.
--   3. Feiler pushen påvirker den ikke transaksjonen som skrev posten.
-- ============================================================

-- pg_net for async HTTP fra Postgres (funksjonene havner i schema `net`),
-- vault for å holde url + servicekey utenfor git. Begge er alt aktivert på
-- hosted Supabase, så `if not exists` er en no-op der; ingen `with schema`
-- (pg_net styrer sitt eget schema og kan avvise et påtvunget ett).
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;


-- ============================================================
-- device_tokens
-- Én rad per fysisk enhet-token (APNs-device-token / senere FCM).
-- Skrevet av klienten via register_device_token (SECURITY DEFINER).
--
-- token er UNIQUE: logger to brukere inn på samme enhet (typisk i
-- testing på én simulator), skal token flyttes til den siste brukeren,
-- ikke duplikeres — ellers ville forrige bruker fått pushen.
-- ============================================================
CREATE TABLE public.device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     text NOT NULL DEFAULT 'ios'
                 CHECK (platform IN ('ios','android')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens (user_id);

CREATE TRIGGER set_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Brukeren eier sine egne tokens. Edge-funksjonen bruker service role
-- (omgår RLS) for å lese lagkameraters tokens ved utsending.
CREATE POLICY "Users manage own device tokens"
  ON public.device_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- register_device_token()
-- Klienten kaller denne når iOS gir oss en APNs-token. SECURITY
-- DEFINER slik at «flytt token til meg»-oppdateringen kan røre en rad
-- som i dag tilhører en annen bruker (RLS ville ellers gitt 0 rader).
--
-- Konfliktnøkkelen er token: samme enhet som logger inn på nytt
-- oppdaterer user_id, i stedet for å lage en foreldreløs duplikat.
-- ============================================================
CREATE OR REPLACE FUNCTION register_device_token(
  p_token    text,
  p_platform text DEFAULT 'ios'
)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF COALESCE(btrim(p_token), '') = '' THEN
    RAISE EXCEPTION 'Empty device token';
  END IF;

  INSERT INTO public.device_tokens (user_id, token, platform, last_seen_at)
  VALUES (v_uid, p_token, COALESCE(p_platform, 'ios'), now())
  ON CONFLICT (token) DO UPDATE
    SET user_id      = v_uid,
        platform     = COALESCE(p_platform, 'ios'),
        last_seen_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- unregister_device_token()
-- Kalles ved sign-out. Sletter kun hvis token faktisk tilhører
-- den innloggede brukeren — ellers ville en logget-ut bruker kunnet
-- fjerne en annens token på samme enhet før den ble reassignet.
-- ============================================================
CREATE OR REPLACE FUNCTION unregister_device_token(p_token text)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.device_tokens
  WHERE token = p_token AND user_id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- notify_on_feed_post()
-- AFTER INSERT-trigger på feed_posts. Sender ny post-id til
-- push-fanout via pg_net. Selve mottaker-utregningen og APNs skjer
-- i Edge-funksjonen (den har krypto + HTTP/2 vi ikke vil ha i plpgsql).
--
-- url + service_role_key hentes fra vault, ikke hardkodet — se
-- seed-SQL nederst. Mangler de, gjør vi ingenting (posten skal ikke
-- feile fordi push ikke er konfigurert ennå).
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_feed_post()
RETURNS trigger AS $$
DECLARE
  v_base text;
  v_key  text;
BEGIN
  -- system-poster varsler vi ikke på (de er ikke laget for mennesker).
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Ikke konfigurert ennå → ingen push, men posten står. Trygt å deploye
  -- migrasjonen før secrets er seedet.
  IF v_base IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_base || '/functions/v1/push-fanout',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('feed_post_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_feed_post
  AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION notify_on_feed_post();


-- ============================================================
-- device_tokens i realtime trengs IKKE — dette er ren utgående push.
-- ============================================================

-- ============================================================
-- SEED (kjøres ÉN gang manuelt, IKKE i git med ekte verdier):
--
--   select vault.create_secret(
--     'https://sswncdrbsrfieudkdmhj.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- service_role_key finnes i Supabase-dashboardet under
-- Project Settings → API → service_role (secret). Den lever i vault,
-- ikke i repoet.
-- ============================================================
