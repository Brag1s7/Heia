-- ============================================================
-- 00044 — e-postvarsel + registerbevis per klubb-claim.
--
-- Funn i kodegjennomgangen 2026-08-03: ingen varslet Heia når en
-- klubb søkte aktivering (submit_club_claim) — søknaden ble liggende
-- til noen sjekket SQL-editoren. Samtidig presiserte Brage
-- autorisasjonskontrollen: reviewen skal eksplisitt vurdere
-- SØKERENS fullmakt til å representere klubben, ikke bare at
-- orgnummeret finnes. Stripe står for KYC; Heia står for
-- autorisasjonskontrollen.
--
-- Løsningen (automatisert BEVIS, menneskelig BESLUTNING):
--   AFTER INSERT-trigger → pg_net → Edge Function `claim-notify`,
--   som henter åpne registerdata fra Brønnøysund (Enhetsregisteret:
--   enhet + ROLLER — styret er offentlig!) og sender e-post til
--   hello@heiaapp.no med ferdig beslutningsgrunnlag: finnes enheten,
--   stemmer navnet, er organisasjonsformen et idrettslag, står
--   SØKERENS NAVN i styret/rollene — pluss approve-/reject-SQL-en
--   klar til å lime inn. Registermatch er BEVIS, aldri fasit (en
--   kasserer med reell fullmakt står ikke i Brønnøysund) — Heia
--   beslutter fortsatt manuelt, men på servert grunnlag.
--
-- brreg_snapshot: funksjonen skriver registerutdraget tilbake på
-- claim-raden (service role) så beviset er varig og revisjonsbart —
-- reviewen i ettertid kan alltid se hva registeret sa DA.
--
-- Samme vault-idiom som 00043 (project_url + service_role_key fra
-- 00022; ingen nøkler i funksjonskropper). Mangler vault-verdiene
-- gjør vi ingenting — claimen skal aldri feile på varsling.
-- ============================================================

ALTER TABLE public.club_claims
  ADD COLUMN brreg_snapshot jsonb;

COMMENT ON COLUMN public.club_claims.brreg_snapshot IS
  'Utdrag fra Brønnøysunds åpne API (enhet + roller) hentet av claim-notify ved innsending — beslutningsgrunnlaget for autorisasjonskontrollen, frosset i tid.';

CREATE OR REPLACE FUNCTION notify_on_club_claim()
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
    url     := v_base || '/functions/v1/claim-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_club_claim
  AFTER INSERT ON public.club_claims
  FOR EACH ROW EXECUTE FUNCTION notify_on_club_claim();
