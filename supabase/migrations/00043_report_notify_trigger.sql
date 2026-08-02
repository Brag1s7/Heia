-- ============================================================
-- 00043 — e-postvarsel per rapport (V1-hygiene-restansen).
--
-- Brages beslutning 2026-08-02 (LÅST): ingen gjennomgangsplikt på
-- rapporter — kanalen består (Apple 1.2), men plikten skal være HELT
-- passiv: Heia reagerer når et e-postvarsel lander i hello@heiaapp.no,
-- og ellers aldri. Dette er varselet.
--
-- Samme idiom som notify_on_feed_post (00022): AFTER INSERT-trigger →
-- pg_net (asynk, kan aldri forsinke eller velte selve rapporten) →
-- Edge Function `report-notify` → Resend → hello@heiaapp.no.
--
-- url + service_role_key leses fra vault — de ble seedet ved 00022 og
-- gjenbrukes her; ingen nye secrets i databasen. (Aldri nøkler i
-- funksjonskropper: pg_proc er lesbar for alle som kan koble til.)
-- Mangler vault-verdiene gjør vi ingenting — rapporten skal aldri
-- feile fordi varsling ikke er konfigurert.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_content_report()
RETURNS trigger AS $$
DECLARE
  v_base text;
  v_key  text;
BEGIN
  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_base IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_base || '/functions/v1/report-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    -- Hele raden: funksjonen skal kunne skrive en komplett e-post uten
    -- å lese databasen (snapshotet er alt frosset i raden ved design).
    body    := jsonb_build_object('record', to_jsonb(NEW))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_content_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION notify_on_content_report();
