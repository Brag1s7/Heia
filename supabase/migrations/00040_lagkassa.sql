-- ============================================================
-- 00040_lagkassa.sql
-- FASE 5 (del 1): Lagkassa + «Min støtte» (se docs/PAYMENTS.md).
--
-- BESLUTNINGSENDRING (Brage, 2026-08-02, låst): fordelingen er nå
-- OFFENTLIG supporterkommunikasjon — «79 kr i måneden, 60 kr går
-- direkte til laget». Klientene får derfor klubbandelen som DATA
-- (club_amount_minor, avledet av offeringen — aldri hardkodet).
-- Hovedtallet i lagkassa er beløpet LAGET faktisk får/mottar,
-- aldri brutto betalingsvolum. Lagaggregatet er synlig for ALLE
-- lagmedlemmer (åpent punkt fra 00037-æraen — nå besluttet).
--
-- Tre klientflater:
--   * get_support_offering_for_team_space — utvidet med
--     club_amount_minor (kommunisert klubbandel).
--   * get_team_support_summary — lagkassa-tallene: månedlig til
--     laget, antall støttespillere, totalt mottatt.
--   * get_my_support_overview — brukerens egne avtaler som LISTE
--     (flere lag senere — aldri hardkodet til ett abonnement),
--     med pris + klubbandel + status + neste betaling.
-- ============================================================


-- ============================================================
-- Kommunisert klubbandel per offering — ÉN avledning, gjenbrukt
-- av alle flatene. fixed-modellen: intensjonen (club_fixed_minor).
-- bps-modellen: brutto minus avrundet fee (halv-opp — matcher
-- Stripes observerte oppfør på 79 kr-punktet; nye prispunkter
-- krever uansett sandbox-verifisering, fase 0-regelen).
-- ============================================================
CREATE OR REPLACE FUNCTION support_offering_club_minor(
  p_amount int, p_model text, p_bps int, p_fixed int
)
RETURNS int AS $$
  SELECT CASE
    WHEN p_model = 'fixed_club_amount' THEN p_fixed
    ELSE p_amount - round(p_amount * p_bps / 10000.0)::int
  END;
$$ LANGUAGE sql IMMUTABLE;


-- ============================================================
-- Offering-oppslaget: nå MED klubbandelen (offentlig beslutning).
-- Fortsatt uten fee_model/fee_bps-råverdier — kommunikasjonen er
-- «60 kr til laget», ikke prosentmekanikk.
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

  SELECT amount_minor, currency, billing_interval,
         support_offering_club_minor(amount_minor, fee_model, fee_bps, club_fixed_minor)
           AS club_minor
  INTO v_offering
  FROM public.support_offerings
  WHERE team_space_id = ts_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'no_offering');
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'amount_minor', v_offering.amount_minor,
    'club_amount_minor', v_offering.club_minor,
    'currency', v_offering.currency,
    'billing_interval', v_offering.billing_interval,
    'recipient_legal_name', v_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- get_team_support_summary — lagkassa-tallene, for ALLE medlemmer
-- (ikke-medlem → NULL, probe-vernet).
--
--   * supporters: aktive støttespillere (active + past_due —
--     past_due er fortsatt en supporter; Stripe purrer).
--   * monthly_to_club_minor: summen av KLUBBANDELEN fra hver
--     levende avtales EGEN offering (avtaler på ulike versjoner
--     teller hver sin — aldri «dagens pris × antall»).
--   * total_to_club_minor: klubbandelen fra transaksjoner der
--     pengene faktisk ble stående (refundert/tapt dispute
--     ekskluderes; delrefusjon regnes fullt i v1 — forenkling,
--     dokumentert her).
-- ============================================================
CREATE OR REPLACE FUNCTION get_team_support_summary(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_supporters int;
  v_monthly   bigint;
  v_total     bigint;
  v_since     timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(is_team_member(ts_id), false) THEN
    RETURN NULL;
  END IF;

  SELECT count(*),
         COALESCE(sum(support_offering_club_minor(
           o.amount_minor, o.fee_model, o.fee_bps, o.club_fixed_minor)), 0)
  INTO v_supporters, v_monthly
  FROM public.support_subscriptions s
  JOIN public.support_offerings o ON o.id = s.offering_id
  WHERE s.team_space_id = ts_id AND s.status IN ('active', 'past_due');

  SELECT COALESCE(sum(club_share_minor), 0), min(occurred_at)
  INTO v_total, v_since
  FROM public.payment_transactions
  WHERE team_space_id = ts_id
    AND status IN ('succeeded', 'partially_refunded', 'disputed', 'dispute_won');

  RETURN jsonb_build_object(
    'supporters', v_supporters,
    'monthly_to_club_minor', v_monthly,
    'total_to_club_minor', v_total,
    'currency', 'nok',
    'since', v_since
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- get_my_support_overview — «Min støtte» på Profil. LISTE (flere
-- lag senere), kun brukerens egne avtaler (auth.uid), levende
-- statuser. cancel_at følger med så UI-en kan si «avsluttes …».
-- SECURITY DEFINER fordi offerings/team_spaces ikke har klient-
-- SELECT — vakten ER user_id-filteret.
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_support_overview()
RETURNS jsonb AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'subscription_id', s.id,
    'team_space_id', s.team_space_id,
    'team_name', ts.display_name,
    'status', s.status,
    'current_period_end', s.current_period_end,
    'cancel_at', s.cancel_at,
    'amount_minor', o.amount_minor,
    'club_amount_minor', support_offering_club_minor(
       o.amount_minor, o.fee_model, o.fee_bps, o.club_fixed_minor),
    'currency', o.currency
  ) ORDER BY s.created_at), '[]'::jsonb)
  FROM public.support_subscriptions s
  JOIN public.team_spaces ts ON ts.id = s.team_space_id
  JOIN public.support_offerings o ON o.id = s.offering_id
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'past_due');
$$ LANGUAGE sql SECURITY DEFINER STABLE;
