-- ============================================================
-- 00046 — «Heia Ops»: adminbeskyttet klubbsøknad-flate I APPEN.
--
-- Brages beslutning 2026-08-03: SQL-editoren er pilot-krykke, ikke
-- arbeidsflyt. Ops-flaten bor i appen (web-admin på heiaapp.no er
-- eksplisitt utsatt til nettside-prosjektet). E-postvarselet
-- deep-linker til søknaden (heia://ops/claims/<id>).
--
-- Sikkerhetsmodellen:
--   * ops_admins-tabellen er Heias interne allowlist (deny-all RLS,
--     kun ops/SQL skriver). Seedes med Brage.
--   * ALLE handlinger går gjennom ops-RPC-ene under — SECURITY
--     DEFINER, selv-gatet på is_ops_admin(), aldri direkte
--     klientskriving (claims har uansett deny-by-default fra 00037).
--   * Godkjenning KREVER autorisasjonstekst (hvordan fullmakten ble
--     verifisert) — den lagres som review_note OG i audit-loggen.
--   * club_claim_audit er append-only sporet: hvem/hva/når/notat for
--     godkjenn, avslå og be-om-mer-info.
--
-- «Be om mer informasjon»: setter claimen i in_review med
-- info_request_note — søkeren ser meldingen i SupportSetupScreen
-- (get_support_activation_status utvides) og svarer til
-- hello@heiaapp.no (kontaktveien står i claimen).
-- ============================================================


-- ============================================================
-- 1) ops_admins — Heias interne allowlist.
-- ============================================================
CREATE TABLE public.ops_admins (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_admins ENABLE ROW LEVEL SECURITY;
-- Ingen policies = deny all for klienter. Kun service role/SQL.

-- Seed: Brages hovedkonto, slått opp på e-post. (Funn ved deploy:
-- claimanten på Ridabu-claimet var TESTKONTOEN jarle.weium@gmail.com,
-- ikke Brage — aldri seed ops-makt fra claims. Telefonkontoen for
-- TestFlight-dogfood (s2212930@bi.no) ble lagt til manuelt i prod og
-- fjernes med en DELETE når dogfooden er over.)
INSERT INTO public.ops_admins (user_id, note)
SELECT u.id, 'Brage — grunnlegger (hovedkonto)'
FROM auth.users u
WHERE u.email = 'brage.lothe.weium@gmail.com';

CREATE OR REPLACE FUNCTION is_ops_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ops_admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profil-raden trenger et billig «er jeg ops?»-svar.
GRANT EXECUTE ON FUNCTION is_ops_admin() TO authenticated;
REVOKE ALL ON FUNCTION is_ops_admin() FROM anon;


-- ============================================================
-- 2) Info-forespørsel på claims + append-only audit-logg.
-- ============================================================
ALTER TABLE public.club_claims
  ADD COLUMN info_request_note text,
  ADD COLUMN info_requested_at timestamptz;

CREATE TABLE public.club_claim_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      uuid NOT NULL REFERENCES public.club_claims(id) ON DELETE CASCADE,
  action        text NOT NULL CHECK (action IN ('approve','reject','request_info')),
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id),
  note          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_claim_audit_claim ON public.club_claim_audit (claim_id);

ALTER TABLE public.club_claim_audit ENABLE ROW LEVEL SECURITY;
-- Deny all — leses kun gjennom ops_get_club_claim.

-- Append-only: audit skal aldri kunne redigeres eller slettes.
CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit-loggen er append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_club_claim_audit_immutable
  BEFORE UPDATE OR DELETE ON public.club_claim_audit
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();


-- ============================================================
-- 3) Lese-RPC-ene for ops-flaten.
-- ============================================================

-- Én claim som komplett jsonb — gjenbrukes av liste og detalj.
CREATE OR REPLACE FUNCTION ops_claim_payload(c public.club_claims)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'created_at', c.created_at,
    'club', (SELECT jsonb_build_object('id', cl.id, 'name', cl.name)
             FROM public.clubs cl WHERE cl.id = c.club_id),
    'org_number', c.claimed_org_number,
    'legal_name', c.claimed_legal_name,
    'claimed_role', c.claimed_role,
    'contact_email', c.contact_email,
    'contact_phone', c.contact_phone,
    'claimant', (SELECT jsonb_build_object(
                   'id', p.id, 'display_name', p.display_name)
                 FROM public.profiles p WHERE p.id = c.claimant_user_id),
    'brreg_snapshot', c.brreg_snapshot,
    'review_note', c.review_note,
    'reviewed_at', c.reviewed_at,
    'info_request_note', c.info_request_note,
    'info_requested_at', c.info_requested_at,
    -- Kontekst for beslutningen: er klubben alt koblet, finnes
    -- enheten fra før (gjenbruk ved samme orgnr)?
    'club_already_linked', EXISTS (
      SELECT 1 FROM public.club_legal_entity_links l
      WHERE l.club_id = c.club_id AND l.status = 'active'),
    'existing_entity', (SELECT jsonb_build_object(
        'legal_name', e.legal_name,
        'verification_status', e.verification_status)
      FROM public.legal_club_entities e
      WHERE e.org_number = c.claimed_org_number),
    'audit', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action', a.action,
        'note', a.note,
        'actor', (SELECT p2.display_name FROM public.profiles p2
                  WHERE p2.id = a.actor_user_id),
        'created_at', a.created_at) ORDER BY a.created_at), '[]'::jsonb)
      FROM public.club_claim_audit a WHERE a.claim_id = c.id)
  );
$$ LANGUAGE sql STABLE;

-- Listen: åpne søknader først, deretter historikk. NULL for
-- ikke-ops (probe-vernet, samme mønster som betalings-RPC-ene).
CREATE OR REPLACE FUNCTION ops_list_club_claims()
RETURNS jsonb AS $$
BEGIN
  IF NOT is_ops_admin() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(ops_claim_payload(c) ORDER BY
      (c.status IN ('submitted','in_review')) DESC, c.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT * FROM public.club_claims
      ORDER BY (status IN ('submitted','in_review')) DESC, created_at DESC
      LIMIT 50
    ) c
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION ops_get_club_claim(p_claim_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_claim public.club_claims%ROWTYPE;
BEGIN
  IF NOT is_ops_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_claim FROM public.club_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN ops_claim_payload(v_claim);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 4) Handlings-RPC-ene — tynne, gatede skall rundt fase 3-
--    funksjonene, pluss audit. Autorisasjonsteksten er PÅKREVD
--    ved godkjenning: den dokumenterer HVORDAN fullmakten ble
--    verifisert (registerrolle, telefon til registrert kontakt,
--    e-post fra klubbadressen, …).
-- ============================================================
CREATE OR REPLACE FUNCTION ops_approve_club_claim(
  p_claim_id           uuid,
  p_authorization_note text,
  p_org_number         text DEFAULT NULL,
  p_legal_name         text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_note   text := NULLIF(trim(COALESCE(p_authorization_note, '')), '');
  v_claim  public.club_claims%ROWTYPE;
  v_org    text;
  v_name   text;
  v_result jsonb;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops kan godkjenne søknader.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Godkjenning krever en beskrivelse av hvordan autorisasjonen ble verifisert.';
  END IF;

  SELECT * INTO v_claim FROM public.club_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke søknaden.';
  END IF;

  -- Registeret er autoritativt for navn/orgnr: bruk snapshotet fra
  -- claim-notify når det finnes, ellers claimens egne verdier.
  -- Eksplisitte parametre vinner alltid (ops-override).
  v_org  := COALESCE(p_org_number, v_claim.claimed_org_number);
  v_name := COALESCE(
    NULLIF(trim(COALESCE(p_legal_name, '')), ''),
    v_claim.brreg_snapshot->'enhet'->>'navn',
    v_claim.claimed_legal_name);

  v_result := approve_club_claim(p_claim_id, auth.uid(), v_note, v_org, v_name);

  INSERT INTO public.club_claim_audit (claim_id, action, actor_user_id, note)
  VALUES (p_claim_id, 'approve', auth.uid(), v_note);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_reject_club_claim(
  p_claim_id uuid,
  p_note     text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops kan avslå søknader.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Avslag krever en begrunnelse — søkeren ser den i appen.';
  END IF;

  PERFORM reject_club_claim(p_claim_id, v_note, auth.uid());

  INSERT INTO public.club_claim_audit (claim_id, action, actor_user_id, note)
  VALUES (p_claim_id, 'reject', auth.uid(), v_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_request_claim_info(
  p_claim_id uuid,
  p_message  text
)
RETURNS void AS $$
DECLARE
  v_msg    text := NULLIF(trim(COALESCE(p_message, '')), '');
  v_status text;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops kan be om mer informasjon.';
  END IF;
  IF v_msg IS NULL THEN
    RAISE EXCEPTION 'Skriv hva du trenger mer informasjon om — søkeren ser meldingen i appen.';
  END IF;

  SELECT status INTO v_status
  FROM public.club_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke søknaden.';
  END IF;
  IF v_status NOT IN ('submitted','in_review') THEN
    RAISE EXCEPTION 'Søknaden har status «%» — bare åpne søknader kan få info-forespørsel.', v_status;
  END IF;

  UPDATE public.club_claims SET
    status = 'in_review',
    info_request_note = v_msg,
    info_requested_at = now()
  WHERE id = p_claim_id;

  INSERT INTO public.club_claim_audit (claim_id, action, actor_user_id, note)
  VALUES (p_claim_id, 'request_info', auth.uid(), v_msg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Selv-gatede klient-RPC-er (COALESCE-mønsteret fra 00038). NB: REVOKE
-- må ta PUBLIC også — anon ARVER PUBLIC-granten funksjoner fødes med,
-- så «FROM anon» alene er utilstrekkelig (verifisert i prod ved deploy).
GRANT EXECUTE ON FUNCTION ops_list_club_claims() TO authenticated;
GRANT EXECUTE ON FUNCTION ops_get_club_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_approve_club_claim(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_reject_club_claim(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_request_claim_info(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION ops_list_club_claims() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_get_club_claim(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_approve_club_claim(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_reject_club_claim(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_request_claim_info(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_ops_admin() FROM PUBLIC;
-- ops_claim_payload er intern hjelper — aldri direkte fra klient.
REVOKE ALL ON FUNCTION ops_claim_payload(public.club_claims) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5) get_support_activation_status — uendret fra 00038 bortsett
--    fra at claim-payloaden nå bærer info-forespørselen, så
--    SupportSetupScreen kan vise «Heia trenger mer informasjon».
-- ============================================================
CREATE OR REPLACE FUNCTION get_support_activation_status(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_club_id uuid;
  v_club_name text;
  v_entity  record;
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
         created_at, claimant_user_id, info_request_note, info_requested_at
  INTO v_claim
  FROM public.club_claims
  WHERE club_id = v_club_id AND status IN ('submitted','in_review')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, claimed_org_number, claimed_legal_name, status, review_note,
           created_at, claimant_user_id, info_request_note, info_requested_at
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
      'is_mine', v_claim.claimant_user_id = v_uid,
      'info_request_note', v_claim.info_request_note,
      'info_requested_at', v_claim.info_requested_at
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
