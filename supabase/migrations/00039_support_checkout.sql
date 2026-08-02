-- ============================================================
-- 00039_support_checkout.sql
-- FASE 4: Checkout-flyten — datasiden (se docs/PAYMENTS.md).
--
-- To funksjoner:
--   * create_support_offering: OPS-funksjon (service role/SQL-
--     editor, ALDRI klient — samme regime som approve_club_claim).
--     Offerings er versjonerte og økonomisk immutable (00037-
--     triggeren): endring = arkiver aktiv + ny versjon. Denne
--     funksjonen er den ENESTE veien til en ny offering, så
--     versjonsnummer og arkivering skjer atomisk ett sted.
--   * get_support_offering_for_team_space: klient-RPC for
--     SupportScreen. Returnerer KUN pris/valuta/intervall +
--     mottakerens juridiske navn — ALDRI split (fee_model/fee_bps/
--     club_fixed_minor er en ulåst kommersiell beslutning og skal
--     ikke leses av klienter, 00037-kommentaren).
--
-- Selve checkouten bor i Edge Function stripe-checkout (service
-- role mot tabellene) — ingen klient-skriverettigheter trengs her.
-- ============================================================


-- ============================================================
-- create_support_offering — ny versjonert offering for et lag.
--
-- Arkiverer ev. aktiv offering og setter inn neste versjon i én
-- transaksjon. Eksisterende abonnementer beholder sin offering_id
-- og røres ALDRI (låst invariant — eksplisitt migrering er en egen,
-- varslet operasjon). Advisory-lås på lagrommet vinner racet om
-- versjonsnummeret hvis to ops-kall skulle løpe i parallell.
--
-- p_fee_bps er ALLTID det som sendes til Stripe; ved
-- fee_model='fixed_club_amount' dokumenterer p_club_fixed_minor
-- intensjonen (tabell-CHECK-ene håndhever hygienen). NB fase 0:
-- avrundingen er kun verifisert for 7900 øre — nytt prispunkt
-- krever ny avrundingssjekk i sandbox FØR offeringen opprettes.
-- ============================================================
CREATE OR REPLACE FUNCTION create_support_offering(
  p_team_space_id    uuid,
  p_amount_minor     int,
  p_fee_model        text,
  p_fee_bps          int,
  p_club_fixed_minor int DEFAULT NULL,
  p_created_by       uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_version int;
  v_id      uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_spaces WHERE id = p_team_space_id) THEN
    RAISE EXCEPTION 'Fant ikke lagrommet %', p_team_space_id;
  END IF;

  -- Serialiser per lag: versjonsnummer + én-aktiv-invarianten.
  PERFORM pg_advisory_xact_lock(hashtext('support_offering'), hashtext(p_team_space_id::text));

  UPDATE public.support_offerings
  SET status = 'archived'
  WHERE team_space_id = p_team_space_id AND status = 'active';

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.support_offerings
  WHERE team_space_id = p_team_space_id;

  INSERT INTO public.support_offerings (
    team_space_id, version, amount_minor, fee_model, fee_bps,
    club_fixed_minor, created_by
  ) VALUES (
    p_team_space_id, v_version, p_amount_minor, p_fee_model, p_fee_bps,
    p_club_fixed_minor, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('offering_id', v_id, 'version', v_version);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prising er Heias alene — klienter kan aldri opprette offerings.
REVOKE ALL ON FUNCTION create_support_offering(uuid, int, text, int, int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_support_offering(uuid, int, text, int, int, uuid) TO service_role;


-- ============================================================
-- get_support_offering_for_team_space — SupportScreens datakall.
-- Gatet på LAGMEDLEMSKAP (skjermen er for alle i laget — foreldre
-- er supporterne; ikke-medlem → NULL, probe-vernet fra 00037).
--
--   available=false, reason='not_activated' → klubben mangler
--     aktiv betalingskonto → CTA «Be klubben aktivere støtte»
--   available=false, reason='no_offering'   → konto aktiv, men
--     Heia har ikke priset laget ennå (ops-restanse) — samme CTA-
--     tekst i appen, men skilt i data for feilsøking
--   available=true → pris + mottakerens juridiske navn (offentlig
--     registerinformasjon — tillitssignal på betalingsskjermen)
--
-- Lekker BEVISST ikke: split (fee_*), offering-id, provider-id-er.
-- Checkout-funksjonen slår opp aktiv offering server-side selv —
-- klienten kan aldri velge pris.
-- ============================================================
CREATE OR REPLACE FUNCTION get_support_offering_for_team_space(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_account  uuid;
  v_offering record;
  v_name     text;
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(is_team_member(ts_id), false) THEN
    RETURN NULL;
  END IF;

  -- Kapabilitetskjeden (00037): aktiv konto med charges_enabled.
  SELECT cpa.id, e.legal_name INTO v_account, v_name
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.club_legal_entity_links l
    ON l.club_id = t.club_id AND l.status = 'active'
  JOIN public.legal_club_entities e ON e.id = l.legal_club_entity_id
  JOIN public.club_payment_accounts cpa
    ON cpa.legal_club_entity_id = e.id
   AND cpa.provider = 'stripe'
   AND cpa.status = 'active'
   AND cpa.charges_enabled
  WHERE ts.id = ts_id;

  IF v_account IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'not_activated');
  END IF;

  SELECT amount_minor, currency, billing_interval INTO v_offering
  FROM public.support_offerings
  WHERE team_space_id = ts_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'no_offering');
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'amount_minor', v_offering.amount_minor,
    'currency', v_offering.currency,
    'billing_interval', v_offering.billing_interval,
    'recipient_legal_name', v_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
