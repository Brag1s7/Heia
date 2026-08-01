-- ============================================================
-- 00038_club_claiming.sql
-- FASE 3: Claiming + manuell godkjenning (se docs/PAYMENTS.md).
--
-- Flyten (beslutningsboken, MVP):
--   lagadmin sender claim (submit_club_claim, RPC)
--     → manuell Heia-review (orgnr sjekkes mot Brønnøysund manuelt;
--       duplikater kobles til SAMME juridiske enhet; allianselag
--       splittes/flyttes FØR kobling)
--     → approve_club_claim (service role / SQL-editor) skaper
--       enhet + link + konto i ÉN transaksjon
--     → Stripe-onboarding via Account Link (Edge Function
--       stripe-onboarding — lenken genereres i klikkøyeblikket,
--       fase 0-funn #6) → account.updated-webhooken (fase 2)
--       flytter kontostatusen. Klienten flytter ALDRI status.
--
-- Rollene:
--   * submit_club_claim + get_support_activation_status: klient-RPC,
--     selv-gatet på lagadminskap (PostgREST eksponerer dem for alle
--     innloggede — vaktene bor i funksjonene, COALESCE-mønsteret).
--   * approve/reject_club_claim: KUN service role + SQL-editor
--     (REVOKE fra authenticated/anon) — reviewen ER manuell.
-- ============================================================


-- ============================================================
-- Maks én åpen claim per klubb — to admins skal ikke kunne sende
-- hver sin søknad i parallell (RPC-vakten gir pen feilmelding,
-- indexen vinner racet).
-- ============================================================
CREATE UNIQUE INDEX idx_club_claims_one_open
  ON public.club_claims (club_id)
  WHERE status IN ('submitted','in_review');


-- ============================================================
-- Orgnr-validering: 9 siffer + mod 11-kontrollsiffer
-- (Brønnøysund-standarden, vekter 3,2,7,6,5,4,3,2). Fanger
-- tastefeil FØR den manuelle reviewen — reviewen er fortsatt
-- sannheten (checksum beviser ikke at organisasjonen finnes).
-- ============================================================
CREATE OR REPLACE FUNCTION is_valid_org_number(p_org text)
RETURNS boolean AS $$
DECLARE
  weights int[] := ARRAY[3,2,7,6,5,4,3,2];
  total   int := 0;
  ctrl    int;
BEGIN
  IF p_org IS NULL OR p_org !~ '^[0-9]{9}$' THEN
    RETURN false;
  END IF;
  FOR i IN 1..8 LOOP
    total := total + substr(p_org, i, 1)::int * weights[i];
  END LOOP;
  ctrl := 11 - (total % 11);
  IF ctrl = 11 THEN ctrl := 0; END IF;
  IF ctrl = 10 THEN RETURN false; END IF;
  RETURN ctrl = substr(p_org, 9, 1)::int;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- submit_club_claim — lagadmin ber om aktivering av klubben.
-- SECURITY DEFINER: club_claims har ingen klient-INSERT-policy
-- (deny-by-default fra 00037) — vaktene bor her i stedet.
-- ============================================================
CREATE OR REPLACE FUNCTION submit_club_claim(
  p_club_id       uuid,
  p_org_number    text,
  p_legal_name    text,
  p_role          text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_org   text := regexp_replace(COALESCE(p_org_number, ''), '[^0-9]', '', 'g');
  v_name  text := NULLIF(trim(COALESCE(p_legal_name, '')), '');
  v_role  text := NULLIF(trim(COALESCE(p_role, '')), '');
  v_email text := NULLIF(trim(COALESCE(p_contact_email, '')), '');
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT COALESCE(is_club_team_admin(p_club_id), false) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere i klubbens lag kan søke om aktivering.';
  END IF;

  IF NOT is_valid_org_number(v_org) THEN
    RAISE EXCEPTION 'Organisasjonsnummeret ser ikke riktig ut — sjekk de 9 sifrene.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Skriv inn klubbens juridiske navn.';
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Skriv inn rollen din i klubben.';
  END IF;

  -- Heia må kunne nå innsenderen under den manuelle reviewen.
  IF COALESCE(v_email NOT LIKE '%@%', true) THEN
    RAISE EXCEPTION 'Skriv inn en e-postadresse vi kan nå deg på.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.club_legal_entity_links l
    WHERE l.club_id = p_club_id AND l.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Klubben er allerede aktivert for støtte.';
  END IF;

  BEGIN
    INSERT INTO public.club_claims (
      club_id, claimed_org_number, claimed_legal_name,
      claimant_user_id, claimed_role, contact_email, contact_phone
    ) VALUES (
      p_club_id, v_org, v_name,
      v_uid, v_role, v_email, NULLIF(trim(COALESCE(p_contact_phone, '')), '')
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Det ligger allerede en søknad til vurdering for denne klubben.';
  END;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- approve_club_claim — HEIAS manuelle godkjenning (service role /
-- SQL-editor, ALDRI klient). Forutsetter at orgnr er sjekket mot
-- Brønnøysund. I én transaksjon: enhet (gjenbruk ved samme orgnr —
-- samme orgnr = samme mottaker, ALDRI to Stripe-kontoer) + aktiv
-- link + konto (pending_onboarding) + claim → approved.
--
-- p_org_number/p_legal_name overstyrer claimens verdier når
-- Brønnøysund sier noe annet enn innsenderen skrev (registeret er
-- autoritativt for juridisk navn) — gjenbrukt enhet beholder
-- alltid sitt navn.
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


-- ============================================================
-- reject_club_claim — avslag MED begrunnelse (innsenderen ser
-- review_note i appen og kan sende ny søknad).
-- ============================================================
CREATE OR REPLACE FUNCTION reject_club_claim(
  p_claim_id uuid,
  p_note     text,
  p_reviewer uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_status text;
BEGIN
  IF NULLIF(trim(COALESCE(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Avslag krever en begrunnelse — innsenderen ser den i appen';
  END IF;

  SELECT status INTO v_status
  FROM public.club_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke claimen %', p_claim_id;
  END IF;
  IF v_status NOT IN ('submitted','in_review') THEN
    RAISE EXCEPTION 'Claimen har status «%» — bare åpne claims kan avslås', v_status;
  END IF;

  UPDATE public.club_claims SET
    status = 'rejected',
    reviewed_by = p_reviewer,
    reviewed_at = now(),
    review_note = trim(p_note)
  WHERE id = p_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reviewen er Heias alene: klienter kan verken godkjenne eller avslå.
REVOKE ALL ON FUNCTION approve_club_claim(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reject_club_claim(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_club_claim(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION reject_club_claim(uuid, text, uuid) TO service_role;


-- ============================================================
-- get_support_activation_status — hele aktiveringstilstanden for
-- fase 3-skjermen, i ett kall. Gatet på LAGADMIN (skjermen er
-- admin-only, og uten vakten kunne enhver innlogget probe
-- vilkårlige team_space-id-er — samme begrunnelse som
-- get_payment_account_for_team_space i 00037).
--
-- Lekker BEVISST ikke: requirements-payloaden (kun en avledet
-- action_needed-boolean) og alt om split/offerings (fase 4-RPC).
--
-- state:
--   no_club | none | claim_submitted | claim_in_review
--   | claim_rejected | pending_onboarding | onboarding_started
--   | restricted | active | disabled
-- ============================================================
CREATE OR REPLACE FUNCTION get_support_activation_status(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_club_id uuid;
  v_club_name text;
  v_entity  record;
  v_account record;
  v_claim   record;
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(is_team_admin(ts_id), false) THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.name INTO v_club_id, v_club_name
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  WHERE ts.id = ts_id;

  IF v_club_id IS NULL THEN
    RETURN jsonb_build_object('state', 'no_club', 'club', NULL);
  END IF;

  -- Aktiv kobling vinner: da er tilstanden kontoens.
  SELECT e.org_number, e.legal_name, cpa.id AS account_id, cpa.status,
         cpa.charges_enabled, cpa.payouts_enabled,
         (COALESCE(jsonb_array_length(cpa.requirements->'currently_due'), 0) > 0
          OR COALESCE(jsonb_array_length(cpa.requirements->'past_due'), 0) > 0)
           AS action_needed
  INTO v_entity
  FROM public.club_legal_entity_links l
  JOIN public.legal_club_entities e ON e.id = l.legal_club_entity_id
  LEFT JOIN public.club_payment_accounts cpa
    ON cpa.legal_club_entity_id = e.id AND cpa.provider = 'stripe'
  WHERE l.club_id = v_club_id AND l.status = 'active';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', COALESCE(v_entity.status, 'pending_onboarding'),
      'club', jsonb_build_object('id', v_club_id, 'name', v_club_name),
      'entity', jsonb_build_object(
        'org_number', v_entity.org_number,
        'legal_name', v_entity.legal_name
      ),
      'account', CASE WHEN v_entity.account_id IS NULL THEN NULL ELSE
        jsonb_build_object(
          'status', v_entity.status,
          'charges_enabled', v_entity.charges_enabled,
          'payouts_enabled', v_entity.payouts_enabled,
          'action_needed', v_entity.action_needed
        ) END,
      'claim', NULL
    );
  END IF;

  -- Ingen kobling: åpen claim → dens tilstand; ellers siste avslag.
  SELECT id, claimed_org_number, claimed_legal_name, status, review_note,
         created_at, claimant_user_id
  INTO v_claim
  FROM public.club_claims
  WHERE club_id = v_club_id AND status IN ('submitted','in_review')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, claimed_org_number, claimed_legal_name, status, review_note,
           created_at, claimant_user_id
    INTO v_claim
    FROM public.club_claims
    WHERE club_id = v_club_id AND status = 'rejected'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_claim.id IS NULL THEN
    RETURN jsonb_build_object(
      'state', 'none',
      'club', jsonb_build_object('id', v_club_id, 'name', v_club_name),
      'entity', NULL, 'account', NULL, 'claim', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'state', CASE v_claim.status
      WHEN 'submitted' THEN 'claim_submitted'
      WHEN 'in_review' THEN 'claim_in_review'
      ELSE 'claim_rejected' END,
    'club', jsonb_build_object('id', v_club_id, 'name', v_club_name),
    'entity', NULL, 'account', NULL,
    'claim', jsonb_build_object(
      'id', v_claim.id,
      'org_number', v_claim.claimed_org_number,
      'legal_name', v_claim.claimed_legal_name,
      'status', v_claim.status,
      'review_note', v_claim.review_note,
      'created_at', v_claim.created_at,
      'is_mine', v_claim.claimant_user_id = v_uid
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
