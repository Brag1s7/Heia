-- ============================================================
-- 00048 — klubbdøren, oppfølging: godkjent claim GIR rollen.
--
-- Låst modell (PAYMENTS.md «KLUBBDØREN» pkt. 1): «Første hoved-
-- ansvarlige godkjennes som AUTORISERT REPRESENTANT for klubben —
-- claim-reviewen er autorisasjonen.» 00047 backfillet Ridabu på
-- e-post (claimanten der var en testkonto, 00046-funnet); for alle
-- FREMTIDIGE godkjenninger er claimanten nettopp den personen
-- reviewen har verifisert fullmakten til — så approve_club_claim
-- gir nå betalingsansvarlig-rollen i samme transaksjon.
--
-- club_support_defaults seedes fortsatt av Heia (ops-steget i
-- runbooken — standardtilbudet er DATA, aldri hardkodet her);
-- approve_team_support feiler høyt og pent hvis det glemmes.
--
-- Funksjonen er ellers uendret fra 00038.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_club_claim(
  p_claim_id   uuid,
  p_reviewer   uuid DEFAULT NULL,
  p_note       text DEFAULT NULL,
  p_org_number text DEFAULT NULL,
  p_legal_name text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_claim      public.club_claims%ROWTYPE;
  v_org        text;
  v_name       text;
  v_entity_id  uuid;
  v_reused     boolean := false;
  v_status     text;
  v_account_id uuid;
  v_acct_status text;
BEGIN
  SELECT * INTO v_claim
  FROM public.club_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke claimen %', p_claim_id;
  END IF;
  IF v_claim.status NOT IN ('submitted','in_review') THEN
    RAISE EXCEPTION 'Claimen har status «%» — bare åpne claims kan godkjennes', v_claim.status;
  END IF;

  v_org := regexp_replace(COALESCE(p_org_number, v_claim.claimed_org_number), '[^0-9]', '', 'g');
  v_name := COALESCE(NULLIF(trim(COALESCE(p_legal_name, '')), ''), v_claim.claimed_legal_name);
  IF NOT is_valid_org_number(v_org) THEN
    RAISE EXCEPTION 'Ugyldig organisasjonsnummer «%»', v_org;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.club_legal_entity_links l
    WHERE l.club_id = v_claim.club_id AND l.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Klubben har allerede en aktiv juridisk kobling';
  END IF;

  -- Enheten: gjenbruk ved samme orgnr (duplikatklubber → samme
  -- mottaker), ellers opprett verifisert (reviewen ER verifiseringen).
  SELECT id, verification_status INTO v_entity_id, v_status
  FROM public.legal_club_entities
  WHERE org_number = v_org
  FOR UPDATE;

  IF FOUND THEN
    IF v_status = 'revoked' THEN
      RAISE EXCEPTION 'Enheten for orgnr % er tilbakekalt (revoked) — manuell oppfølging kreves', v_org;
    END IF;
    v_reused := true;
  ELSE
    INSERT INTO public.legal_club_entities (
      org_number, legal_name, verification_status, verified_by, verified_at
    ) VALUES (v_org, v_name, 'verified', p_reviewer, now())
    RETURNING id INTO v_entity_id;
  END IF;

  INSERT INTO public.club_legal_entity_links (
    club_id, legal_club_entity_id, claim_id, linked_by
  ) VALUES (v_claim.club_id, v_entity_id, v_claim.id, p_reviewer);

  -- Kontoen: maks én per (enhet, provider) — finnes den fra en
  -- tidligere godkjenning, arver klubben den (og ev. aktiv status).
  INSERT INTO public.club_payment_accounts (legal_club_entity_id, provider, initiated_by)
  VALUES (v_entity_id, 'stripe', v_claim.claimant_user_id)
  ON CONFLICT (legal_club_entity_id, provider) DO NOTHING;

  SELECT id, status INTO v_account_id, v_acct_status
  FROM public.club_payment_accounts
  WHERE legal_club_entity_id = v_entity_id AND provider = 'stripe';

  -- KLUBBDØREN (00048): claimanten er den verifiserte autoriserte
  -- representanten — første betalingsansvarlige for klubben.
  INSERT INTO public.club_payment_managers (club_id, user_id, source, note)
  VALUES (v_claim.club_id, v_claim.claimant_user_id, 'claim_backfill',
          'Autorisert representant — godkjent claim ' || v_claim.id)
  ON CONFLICT (club_id, user_id) DO NOTHING;

  UPDATE public.club_claims SET
    status = 'approved',
    reviewed_by = p_reviewer,
    reviewed_at = now(),
    review_note = p_note,
    resulting_legal_entity_id = v_entity_id
  WHERE id = v_claim.id;

  RETURN jsonb_build_object(
    'claim_id', v_claim.id,
    'legal_entity_id', v_entity_id,
    'entity_reused', v_reused,
    'payment_account_id', v_account_id,
    'account_status', v_acct_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
