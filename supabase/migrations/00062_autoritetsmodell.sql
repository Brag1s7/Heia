-- ============================================================
-- 00062 — AUTORITETSMODELLEN v2 (LÅST 2026-08-18, se
-- docs/AUTORITET-KLUBBBETALINGER-2026-08.md + PAYMENTS.md
-- §«Autoritetsmodellen v2»).
--
-- Kjernen: den som starter aktiveringen av en klubb er ikke
-- nødvendigvis den som skal ha myndighet over klubbens betalinger.
-- Denne migrasjonen skiller identitetene:
--
--   * Betalingsansvarlig-rollen RE-SCOPES fra den sosiale
--     klubbraden (clubs.id) til den JURIDISKE enheten
--     (legal_club_entities) — én myndighetskrets per orgnr,
--     uansett antall klubbrader. + status active/suspended.
--   * Claim-skjemaet bærer en NOMINASJON (selv / en annen).
--     approve_club_claim tildeler rollen EKSPLISITT ved
--     selv-nominasjon, og oppretter en SIKKER INVITASJON ved
--     nominasjon av en annen (aldri auto-rolle til claimant).
--   * manager_invitations: 256-bit engangstoken (KUN hash i DB —
--     rå-token genereres i Edge Function payments-notify i
--     utsendelsesøyeblikket), 14 d levetid, lat utløpshåndhevelse,
--     atomisk innløsning. AVVIKSKONTROLL (B1): eksakt normalisert
--     e-postmatch → aktiv rolle; ALT annet → awaiting_review der
--     ops må bekrefte FØR rollen aktiveres.
--   * payment_authority_events: append-only logg over alle rolle-
--     og invitasjonshendelser (forbid_mutation).
--   * Duplikatvern (II.7): maks én åpen aktivering per normalisert
--     orgnr (håndhevet i submit + partiell unik index), og approve
--     hardstopper gjenbruk av aktiv link/påbegynt konto.
--   * heia_support_defaults (B2): global standard (79/60) som
--     kopieres ÉN gang inn i enhetens konfig ved godkjenning —
--     ren kopi-semantikk, aldri levende fallback.
--     club_support_defaults re-scopes til enheten.
--   * Kanonisk «aktiv konto»-predikat trekkes ut i interne
--     hjelpere; approve_team_support krever det (avslag alltid lov).
--   * Ops-RPC-er for hele rollelivssyklusen + auditert lagflytting
--     (rå SQL er aldri normal flyt — produksjonskrav 2).
--
-- Varslings-INFRASTRUKTUREN (notify_payments_event → pg_net →
-- payments-notify) bor her fordi RPC-ene kaller den; selve
-- tidsstyringen (reminder/expiry-cron) er 00063.
--
-- Bakoverkompatibilitet mot utrullede klienter (TestFlight 1.0 (4)):
-- submit_club_claim får nye parametre MED DEFAULTS (gamle kall
-- fungerer som selv-nominasjon), og get_club_payments_overview
-- beholder payload-formen additivt ('club' = kanonisk klubbrad).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1) notify_payments_event — pg_net-hjelperen (00044-vault-idiomet).
--    Best-effort: mangler vault-verdiene gjør vi ingenting — en
--    RPC skal aldri feile på varsling.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_payments_event(p_type text, p_payload jsonb)
RETURNS void AS $$
DECLARE
  v_base text;
  v_key  text;
BEGIN
  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_base IS NULL OR v_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_base || '/functions/v1/payments-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('type', p_type) || p_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION notify_payments_event(text, jsonb)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 2) club_payment_managers → enhets-scope + status.
--    Backfill via klubbradens AKTIVE link (deterministisk, N:1).
--    Prod 2026-08-18: 5 rader / 3 klubber, alle med aktiv link
--    (dump i spike-mappen: dump-club_payment_managers-2026-08-18).
-- ============================================================
ALTER TABLE public.club_payment_managers
  ADD COLUMN legal_club_entity_id uuid
    REFERENCES public.legal_club_entities(id) ON DELETE CASCADE,
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended'));

UPDATE public.club_payment_managers m
SET legal_club_entity_id = l.legal_club_entity_id
FROM public.club_legal_entity_links l
WHERE l.club_id = m.club_id AND l.status = 'active';

-- Dubletter på (enhet, bruker) — mulig hvis to klubbrader deler
-- enhet. Behold eldste rad.
DELETE FROM public.club_payment_managers m
USING public.club_payment_managers m2
WHERE m.legal_club_entity_id = m2.legal_club_entity_id
  AND m.user_id = m2.user_id
  AND m.created_at > m2.created_at;

-- Rader uten aktiv link har ingen enhet å høre til — slettes
-- (bevisst; skal være 0 med dagens prod-data).
DO $$
DECLARE v_n int;
BEGIN
  DELETE FROM public.club_payment_managers
  WHERE legal_club_entity_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '00062: % foreldreløse manager-rader slettet', v_n;
END $$;

ALTER TABLE public.club_payment_managers
  ALTER COLUMN legal_club_entity_id SET NOT NULL;

ALTER TABLE public.club_payment_managers
  DROP CONSTRAINT club_payment_managers_club_id_user_id_key;

ALTER TABLE public.club_payment_managers
  ADD CONSTRAINT club_payment_managers_entity_user_key
    UNIQUE (legal_club_entity_id, user_id);

ALTER TABLE public.club_payment_managers DROP COLUMN club_id;

CREATE INDEX idx_club_payment_managers_entity
  ON public.club_payment_managers (legal_club_entity_id);

-- Selv-nominasjon (v2) bruker source 'claim'; 'claim_backfill' er
-- historisk (00047/00048-æraen), 'invite' = akseptert invitasjon.
ALTER TABLE public.club_payment_managers
  DROP CONSTRAINT club_payment_managers_source_check;
ALTER TABLE public.club_payment_managers
  ADD CONSTRAINT club_payment_managers_source_check
    CHECK (source IN ('claim','claim_backfill','ops','invite'));

COMMENT ON TABLE public.club_payment_managers IS
  'Betalingsansvarlig-rollen, scopet til den JURIDISKE enheten (v2, 00062). status: active/suspended; fjerning = DELETE + hendelse i payment_authority_events.';


-- ============================================================
-- 3) Rolle-hjelperne (enhets-baserte; klubb-signaturen beholdes
--    som wrapper så eksisterende kallsteder står).
-- ============================================================
CREATE OR REPLACE FUNCTION is_entity_payment_manager(p_entity_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE legal_club_entity_id = p_entity_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Wrapper: klubbrad → aktiv link → enhet. Aktiv-filtrert (suspendert
-- ansvarlig har ingen myndighet noe sted).
CREATE OR REPLACE FUNCTION is_club_payment_manager(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_legal_entity_links l
    JOIN public.club_payment_managers m
      ON m.legal_club_entity_id = l.legal_club_entity_id
    WHERE l.club_id = p_club_id AND l.status = 'active'
      AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_payment_manager_anywhere()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE user_id = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION entity_has_active_manager(p_entity_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE legal_club_entity_id = p_entity_id AND status = 'active'
  );
$$ LANGUAGE sql STABLE;

-- Kjeden lag → klubb → aktiv link → enhet (intern).
CREATE OR REPLACE FUNCTION entity_for_team_space(ts_id uuid)
RETURNS uuid AS $$
  SELECT l.legal_club_entity_id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.club_legal_entity_links l
    ON l.club_id = t.club_id AND l.status = 'active'
  WHERE ts.id = ts_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- KANONISK «aktiv konto»-predikat (II.4). Samme kriterier som
-- get_payment_account_for_team_space (00037) og checkout-gatens
-- Edge-sjekk (stripe-checkout/index.ts) — de tre skal holdes i
-- synk; dette er definisjonen.
-- ============================================================
CREATE OR REPLACE FUNCTION payment_account_ready_for_entity(
  p_entity_id uuid,
  p_provider  text DEFAULT 'stripe'
)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_accounts
    WHERE legal_club_entity_id = p_entity_id
      AND provider = p_provider
      AND status = 'active'
      AND charges_enabled
      AND provider_account_id IS NOT NULL
  );
$$ LANGUAGE sql STABLE;

REVOKE ALL ON FUNCTION entity_has_active_manager(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION entity_for_team_space(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION payment_account_ready_for_entity(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION is_entity_payment_manager(uuid) TO authenticated;
REVOKE ALL ON FUNCTION is_entity_payment_manager(uuid) FROM PUBLIC, anon;
-- (is_club_payment_manager/is_payment_manager_anywhere beholder
--  grants fra 00047 — CREATE OR REPLACE rører dem ikke.)


-- ============================================================
-- 4) payment_authority_events — append-only sporet over ALT som
--    rører myndighet (produksjonskravet: hendelser og forsøk).
--    entity er nullable: ugyldige innløsningsforsøk har ingen.
-- ============================================================
CREATE TABLE public.payment_authority_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_club_entity_id uuid REFERENCES public.legal_club_entities(id),
  subject_user_id      uuid REFERENCES public.profiles(id),
  invitation_id        uuid,
  event                text NOT NULL CHECK (event IN (
    'granted','accepted','suspended','reactivated','removed',
    'invite_issued','invite_reminder','invite_revoked',
    'invite_declined','invite_expired','invite_redeemed_review',
    'review_confirmed','review_rejected','invite_attempt_invalid',
    'team_moved')),
  actor_user_id        uuid REFERENCES public.profiles(id),
  note                 text,
  metadata             jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_authority_events_entity
  ON public.payment_authority_events (legal_club_entity_id, created_at DESC);

ALTER TABLE public.payment_authority_events ENABLE ROW LEVEL SECURITY;
-- Deny all — leses gjennom ops_list_payment_entities.

CREATE TRIGGER trg_payment_authority_events_immutable
  BEFORE UPDATE OR DELETE ON public.payment_authority_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE OR REPLACE FUNCTION log_authority_event(
  p_entity_id  uuid,
  p_event      text,
  p_subject    uuid DEFAULT NULL,
  p_invitation uuid DEFAULT NULL,
  p_actor      uuid DEFAULT NULL,
  p_note       text DEFAULT NULL,
  p_metadata   jsonb DEFAULT '{}'
)
RETURNS void AS $$
  INSERT INTO public.payment_authority_events
    (legal_club_entity_id, event, subject_user_id, invitation_id,
     actor_user_id, note, metadata)
  VALUES (p_entity_id, p_event, p_subject, p_invitation,
          p_actor, p_note, COALESCE(p_metadata, '{}'));
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE ALL ON FUNCTION
  log_authority_event(uuid, text, uuid, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5) manager_invitations — «Bli betalingsansvarlig».
--    token_hash er NULLABLE: rå-tokenet genereres av Edge Function
--    payments-notify i utsendelsesøyeblikket (B3 — aldri i DB/
--    pg_net-kø); sent_at settes etter Resend-OK. Reminder ROTERER
--    hashen. Maks én pending per (enhet, e-post).
-- ============================================================
CREATE TABLE public.manager_invitations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_club_entity_id uuid NOT NULL
    REFERENCES public.legal_club_entities(id) ON DELETE CASCADE,
  invited_name         text NOT NULL,
  invited_email        text NOT NULL CHECK (invited_email LIKE '%@%'),
  invited_phone        text,
  source               text NOT NULL CHECK (source IN ('claim','ops','manager')),
  claim_id             uuid REFERENCES public.club_claims(id),
  created_by           uuid REFERENCES public.profiles(id),
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','accepted','awaiting_review','declined','revoked','expired')),
  token_hash           text UNIQUE,
  sent_at              timestamptz,
  reminded_at          timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_by          uuid REFERENCES public.profiles(id),
  accepted_at          timestamptz,
  decided_by           uuid REFERENCES public.profiles(id),
  decided_at           timestamptz,
  -- Avviksdata ved awaiting_review: kontoens e-post, profilnavn,
  -- navnematch-flagg (beslutningsstøtte for ops — aldri fasit).
  mismatch             jsonb,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_manager_invitations_one_pending
  ON public.manager_invitations (legal_club_entity_id, lower(invited_email))
  WHERE status = 'pending';

CREATE INDEX idx_manager_invitations_entity
  ON public.manager_invitations (legal_club_entity_id, created_at DESC);

ALTER TABLE public.manager_invitations ENABLE ROW LEVEL SECURITY;
-- Deny all — alt går gjennom RPC-ene under.


-- ============================================================
-- 6) heia_support_defaults (B2) — global standard, singleton-rad.
--    KOPIERES inn i enhetens konfig ved godkjenning (aldri levende
--    fallback); endring her når kun NYE aktiveringer. Nytt
--    prispunkt krever avrundingssjekk i sandbox FØRST (låst).
--    + club_support_defaults re-scopes til enheten.
-- ============================================================
CREATE TABLE public.heia_support_defaults (
  singleton        boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  amount_minor     int  NOT NULL CHECK (amount_minor > 0),
  currency         text NOT NULL DEFAULT 'nok' CHECK (currency ~ '^[a-z]{3}$'),
  billing_interval text NOT NULL DEFAULT 'month'
                     CHECK (billing_interval IN ('month')),
  fee_model        text NOT NULL
                     CHECK (fee_model IN ('bps','fixed_club_amount')),
  fee_bps          int  NOT NULL CHECK (fee_bps BETWEEN 0 AND 10000),
  club_fixed_minor int  CHECK (club_fixed_minor > 0),
  note             text,
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (fee_model = 'bps' AND club_fixed_minor IS NULL)
    OR (fee_model = 'fixed_club_amount'
        AND club_fixed_minor IS NOT NULL
        AND club_fixed_minor < amount_minor)
  )
);

ALTER TABLE public.heia_support_defaults ENABLE ROW LEVEL SECURITY;
-- Deny all — kun approve_club_claim (definer) og ops/SQL leser.

INSERT INTO public.heia_support_defaults
  (amount_minor, fee_model, fee_bps, club_fixed_minor, note)
VALUES (7900, 'fixed_club_amount', 2405, 6000,
        '79/60 — sandbox-verifisert avrunding (fase 0). LÅST kommunikasjon.');

-- Re-scope av club_support_defaults (klubbrad → enhet).
ALTER TABLE public.club_support_defaults
  ADD COLUMN legal_club_entity_id uuid
    REFERENCES public.legal_club_entities(id) ON DELETE CASCADE;

UPDATE public.club_support_defaults d
SET legal_club_entity_id = l.legal_club_entity_id
FROM public.club_legal_entity_links l
WHERE l.club_id = d.club_id AND l.status = 'active';

-- Dubletter (to rader → samme enhet): behold nyeste.
DELETE FROM public.club_support_defaults d
USING public.club_support_defaults d2
WHERE d.legal_club_entity_id = d2.legal_club_entity_id
  AND d.legal_club_entity_id IS NOT NULL
  AND d.created_at < d2.created_at;

DO $$
DECLARE v_n int;
BEGIN
  DELETE FROM public.club_support_defaults
  WHERE legal_club_entity_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '00062: % foreldreløse defaults-rader slettet', v_n;
END $$;

ALTER TABLE public.club_support_defaults
  ALTER COLUMN legal_club_entity_id SET NOT NULL;
ALTER TABLE public.club_support_defaults
  DROP CONSTRAINT club_support_defaults_pkey;
ALTER TABLE public.club_support_defaults DROP COLUMN club_id;
ALTER TABLE public.club_support_defaults
  ADD PRIMARY KEY (legal_club_entity_id);

COMMENT ON TABLE public.club_support_defaults IS
  'Enhetens eksplisitte standardtilbud (v2, 00062 — re-scopet fra klubbrad). Kopieres fra heia_support_defaults ved godkjenning; arves inn i versjonerte offerings ved lag-godkjenning. Aldri lest fra den globale raden i etterkant.';


-- ============================================================
-- 7) club_claims — nominasjonen + orgnr-duplikatvernet.
-- ============================================================
ALTER TABLE public.club_claims
  ADD COLUMN nominee_is_self boolean NOT NULL DEFAULT true,
  ADD COLUMN nominee_name    text,
  ADD COLUMN nominee_email   text,
  ADD COLUMN nominee_phone   text;

COMMENT ON COLUMN public.club_claims.nominee_is_self IS
  'Autoritetsmodellen v2: hvem nomineres som betalingsansvarlig? true = claimanten selv (rollen tildeles eksplisitt ved godkjenning); false = en annen (invitasjon opprettes ved godkjenning).';

-- Død 'expired'-verdi fjernes (aldri satt — verifiseres her).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_claims WHERE status = 'expired') THEN
    RAISE EXCEPTION '00062: uventet expired-claim funnet — migrasjonen antar null';
  END IF;
END $$;

ALTER TABLE public.club_claims DROP CONSTRAINT club_claims_status_check;
ALTER TABLE public.club_claims
  ADD CONSTRAINT club_claims_status_check
    CHECK (status IN ('submitted','in_review','approved','rejected'));

-- Maks én åpen aktiveringsprosess per normalisert orgnr — på tvers
-- av klubbrader (II.7). RPC-vakten gir pen melding; indexen vinner racet.
CREATE UNIQUE INDEX idx_club_claims_one_open_per_org
  ON public.club_claims (claimed_org_number)
  WHERE status IN ('submitted','in_review');


-- ============================================================
-- 8) submit_club_claim v2 — nominasjon + orgnr-vaktene.
--    Nye parametre har DEFAULTS: utrullede klienter (TestFlight
--    1.0 (4)) fortsetter å virke som selv-nominasjon.
--    Gammel signatur droppes (ellers to overloads i PostgREST).
-- ============================================================
DROP FUNCTION submit_club_claim(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION submit_club_claim(
  p_club_id         uuid,
  p_org_number      text,
  p_legal_name      text,
  p_role            text,
  p_contact_email   text,
  p_contact_phone   text DEFAULT NULL,
  p_nominee_is_self boolean DEFAULT true,
  p_nominee_name    text DEFAULT NULL,
  p_nominee_email   text DEFAULT NULL,
  p_nominee_phone   text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_org    text := regexp_replace(COALESCE(p_org_number, ''), '[^0-9]', '', 'g');
  v_name   text := NULLIF(trim(COALESCE(p_legal_name, '')), '');
  v_role   text := NULLIF(trim(COALESCE(p_role, '')), '');
  v_email  text := NULLIF(trim(COALESCE(p_contact_email, '')), '');
  v_n_name text := NULLIF(trim(COALESCE(p_nominee_name, '')), '');
  v_n_mail text := NULLIF(trim(COALESCE(p_nominee_email, '')), '');
  v_taken  text;
  v_id     uuid;
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

  IF COALESCE(v_email NOT LIKE '%@%', true) THEN
    RAISE EXCEPTION 'Skriv inn en e-postadresse vi kan nå deg på.';
  END IF;

  -- Nominasjonen (v2): en annen krever navn + e-post.
  IF NOT p_nominee_is_self THEN
    IF v_n_name IS NULL THEN
      RAISE EXCEPTION 'Skriv inn navnet på den som skal være betalingsansvarlig.';
    END IF;
    IF COALESCE(v_n_mail NOT LIKE '%@%', true) THEN
      RAISE EXCEPTION 'Skriv inn e-postadressen til den som skal være betalingsansvarlig.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.club_legal_entity_links l
    WHERE l.club_id = p_club_id AND l.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Klubben er allerede aktivert for støtte.';
  END IF;

  -- II.7: orgnr som allerede er aktivert (via en ANNEN klubbrad) —
  -- tydelig brukerrettet stopp, aldri stille gjenbruk.
  SELECT e.legal_name INTO v_taken
  FROM public.legal_club_entities e
  JOIN public.club_legal_entity_links l
    ON l.legal_club_entity_id = e.id AND l.status = 'active'
  WHERE e.org_number = v_org
  LIMIT 1;
  IF v_taken IS NOT NULL THEN
    RAISE EXCEPTION '«%» er allerede aktivert for støtte i Heia. Laget ditt ser ut til å ligge under en egen oppføring av klubben — ta kontakt på hello@heiaapp.no, så kobler vi laget riktig.', v_taken;
  END IF;

  -- II.7: én åpen aktiveringsprosess per orgnr, på tvers av rader.
  IF EXISTS (
    SELECT 1 FROM public.club_claims
    WHERE claimed_org_number = v_org
      AND status IN ('submitted','in_review')
  ) THEN
    RAISE EXCEPTION 'Det pågår allerede en aktivering for denne klubben — ta kontakt på hello@heiaapp.no hvis den burde vært deres.';
  END IF;

  BEGIN
    INSERT INTO public.club_claims (
      club_id, claimed_org_number, claimed_legal_name,
      claimant_user_id, claimed_role, contact_email, contact_phone,
      nominee_is_self, nominee_name, nominee_email, nominee_phone
    ) VALUES (
      p_club_id, v_org, v_name,
      v_uid, v_role, v_email, NULLIF(trim(COALESCE(p_contact_phone, '')), ''),
      p_nominee_is_self,
      CASE WHEN p_nominee_is_self THEN NULL ELSE v_n_name END,
      CASE WHEN p_nominee_is_self THEN NULL ELSE lower(v_n_mail) END,
      CASE WHEN p_nominee_is_self THEN NULL
           ELSE NULLIF(trim(COALESCE(p_nominee_phone, '')), '') END
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Det ligger allerede en søknad til vurdering for denne klubben.';
  END;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_club_claim(
  uuid, text, text, text, text, text, boolean, text, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION submit_club_claim(
  uuid, text, text, text, text, text, boolean, text, text, text)
  FROM PUBLIC, anon;


-- ============================================================
-- 9) approve_club_claim v3 — hard duplikatstopp + EKSPLISITT
--    rolletildeling (erstatter 00048s auto-INSERT til claimant).
--    Samme signatur som før (ops_approve_club_claim kaller den).
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
  v_claim       public.club_claims%ROWTYPE;
  v_org         text;
  v_name        text;
  v_entity_id   uuid;
  v_reused      boolean := false;
  v_status      text;
  v_other_link  boolean;
  v_acct        record;
  v_account_id  uuid;
  v_acct_status text;
  v_invite_id   uuid;
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

  SELECT id, verification_status INTO v_entity_id, v_status
  FROM public.legal_club_entities
  WHERE org_number = v_org
  FOR UPDATE;

  IF FOUND THEN
    IF v_status = 'revoked' THEN
      RAISE EXCEPTION 'Enheten for orgnr % er tilbakekalt (revoked) — manuell oppfølging kreves', v_org;
    END IF;

    -- II.7 HARD STOPP: aktiv link til en ANNEN klubbrad → en ny
    -- rad skal aldri kobles/arve via godkjenning. Riktig verktøy er
    -- ops_move_team_to_club (flytt laget til den kanoniske raden).
    SELECT EXISTS (
      SELECT 1 FROM public.club_legal_entity_links l
      WHERE l.legal_club_entity_id = v_entity_id AND l.status = 'active'
    ) INTO v_other_link;
    IF v_other_link THEN
      RAISE EXCEPTION 'Orgnr % er allerede aktivert for en annen klubboppføring — avslå og flytt laget (ops_move_team_to_club), aldri ny godkjenning.', v_org;
    END IF;

    -- II.7 HARD STOPP: konto med påbegynt/fullført onboarding
    -- gjenbrukes aldri stille.
    SELECT provider_account_id, status INTO v_acct
    FROM public.club_payment_accounts
    WHERE legal_club_entity_id = v_entity_id AND provider = 'stripe';
    IF FOUND AND (v_acct.provider_account_id IS NOT NULL
                  OR v_acct.status <> 'pending_onboarding') THEN
      RAISE EXCEPTION 'Betalingskontoen for orgnr % har historikk (status «%») — manuell ops-vurdering kreves, ingen stille gjenbruk.', v_org, v_acct.status;
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

  INSERT INTO public.club_payment_accounts (legal_club_entity_id, provider, initiated_by)
  VALUES (v_entity_id, 'stripe', v_claim.claimant_user_id)
  ON CONFLICT (legal_club_entity_id, provider) DO NOTHING;

  SELECT id, status INTO v_account_id, v_acct_status
  FROM public.club_payment_accounts
  WHERE legal_club_entity_id = v_entity_id AND provider = 'stripe';

  -- B2: enhetens konfig kopieres ÉN gang fra den globale raden
  -- (gjenbrukt enhet beholder alltid sin eksisterende konfig).
  INSERT INTO public.club_support_defaults
    (legal_club_entity_id, amount_minor, currency, billing_interval,
     fee_model, fee_bps, club_fixed_minor, note)
  SELECT v_entity_id, h.amount_minor, h.currency, h.billing_interval,
         h.fee_model, h.fee_bps, h.club_fixed_minor,
         'Kopiert fra heia_support_defaults ved godkjenning ' || now()::date
  FROM public.heia_support_defaults h
  ON CONFLICT (legal_club_entity_id) DO NOTHING;

  -- EKSPLISITT rolletildeling (v2 — erstatter 00048s automatikk):
  IF v_claim.nominee_is_self THEN
    INSERT INTO public.club_payment_managers
      (legal_club_entity_id, user_id, source, note)
    VALUES (v_entity_id, v_claim.claimant_user_id, 'claim',
            'Selv-nominert og verifisert i claim-review ' || v_claim.id)
    ON CONFLICT (legal_club_entity_id, user_id) DO NOTHING;

    PERFORM log_authority_event(
      v_entity_id, 'granted', v_claim.claimant_user_id, NULL, p_reviewer,
      COALESCE(p_note, 'Godkjent claim (selv-nominasjon)'),
      jsonb_build_object('claim_id', v_claim.id, 'source', 'claim'));
  ELSE
    INSERT INTO public.manager_invitations
      (legal_club_entity_id, invited_name, invited_email, invited_phone,
       source, claim_id, created_by, note)
    VALUES (v_entity_id, v_claim.nominee_name, v_claim.nominee_email,
            v_claim.nominee_phone, 'claim', v_claim.id, p_reviewer,
            'Nominert i søknaden, verifisert i claim-review')
    RETURNING id INTO v_invite_id;

    PERFORM log_authority_event(
      v_entity_id, 'invite_issued', NULL, v_invite_id, p_reviewer,
      'Invitasjon fra godkjent claim',
      jsonb_build_object('claim_id', v_claim.id, 'source', 'claim'));

    -- E-posten (med token generert i Edge) sendes kun når
    -- web-landingen finnes (WEB_INVITE_BASE_URL — payments-notify
    -- skipper ellers og sent_at forblir NULL).
    PERFORM notify_payments_event('invitation',
      jsonb_build_object('invitation_id', v_invite_id));
  END IF;

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
    'account_status', v_acct_status,
    'granted_manager', v_claim.nominee_is_self,
    'invitation_id', v_invite_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 10) Navnematch-hjelper (beslutningsstøtte — speiler claim-notify:
--     ordene i det ene navnet finnes i det andre).
-- ============================================================
CREATE OR REPLACE FUNCTION payment_names_match(a text, b text)
RETURNS boolean AS $$
DECLARE
  wa text[];
  wb text[];
BEGIN
  wa := regexp_split_to_array(upper(regexp_replace(COALESCE(a,''), '[^A-ZÆØÅa-zæøå0-9 ]', ' ', 'g')), '\s+');
  wb := regexp_split_to_array(upper(regexp_replace(COALESCE(b,''), '[^A-ZÆØÅa-zæøå0-9 ]', ' ', 'g')), '\s+');
  wa := array_remove(wa, '');
  wb := array_remove(wb, '');
  IF array_length(wa,1) IS NULL OR array_length(wb,1) IS NULL THEN
    RETURN false;
  END IF;
  RETURN (wa <@ wb) OR (wb <@ wa);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

REVOKE ALL ON FUNCTION payment_names_match(text, text)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 11) redeem_manager_invitation — innløsningen (web-akseptsiden).
--     Atomisk engangsbruk, lat utløp, avvikskontroll (B1).
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_manager_invitation(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_verified timestamptz;
  v_pname    text;
  v_hash     text;
  v_inv      public.manager_invitations%ROWTYPE;
  v_legal    text;
  v_existing public.club_payment_managers%ROWTYPE;
  v_match    boolean;
  v_names    boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_verified
  FROM auth.users u WHERE u.id = v_uid;
  IF v_verified IS NULL THEN
    RAISE EXCEPTION 'Bekreft e-postadressen din først — sjekk innboksen.';
  END IF;

  IF p_token IS NULL OR length(p_token) < 20 THEN
    PERFORM log_authority_event(NULL, 'invite_attempt_invalid', v_uid,
      NULL, v_uid, 'For kort/tomt token');
    RAISE EXCEPTION 'Lenken er ugyldig eller allerede brukt.';
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.manager_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM log_authority_event(NULL, 'invite_attempt_invalid', v_uid,
      NULL, v_uid, 'Ukjent token-hash');
    RAISE EXCEPTION 'Lenken er ugyldig eller allerede brukt.';
  END IF;

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = v_inv.legal_club_entity_id;

  IF v_inv.status <> 'pending' THEN
    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_attempt_invalid', v_uid, v_inv.id, v_uid,
      'Innløsningsforsøk på ikke-pending invitasjon (' || v_inv.status || ')');
    RAISE EXCEPTION 'Lenken er ugyldig eller allerede brukt.';
  END IF;

  -- Lat utløpshåndhevelse (cron er kun opprydding/varsling).
  IF v_inv.expires_at < now() THEN
    UPDATE public.manager_invitations
    SET status = 'expired' WHERE id = v_inv.id;
    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_expired', NULL, v_inv.id, v_uid, 'Utløpt ved innløsningsforsøk');
    IF NOT entity_has_active_manager(v_inv.legal_club_entity_id) THEN
      PERFORM notify_payments_event('managerless', jsonb_build_object(
        'legal_club_entity_id', v_inv.legal_club_entity_id,
        'reason', 'invitasjon utløp'));
    END IF;
    RAISE EXCEPTION 'Lenken er utløpt — be om en ny invitasjon.';
  END IF;

  -- Suspendert for enheten? Reaktivering er en ops-beslutning.
  SELECT * INTO v_existing
  FROM public.club_payment_managers
  WHERE legal_club_entity_id = v_inv.legal_club_entity_id AND user_id = v_uid;
  IF FOUND AND v_existing.status = 'suspended' THEN
    RAISE EXCEPTION 'Kontoen din er suspendert for denne klubben — kontakt hello@heiaapp.no.';
  END IF;

  SELECT display_name INTO v_pname FROM public.profiles WHERE id = v_uid;
  v_match := lower(trim(v_email)) = lower(trim(v_inv.invited_email));
  v_names := payment_names_match(v_pname, v_inv.invited_name);

  IF v_match THEN
    INSERT INTO public.club_payment_managers
      (legal_club_entity_id, user_id, source, note)
    VALUES (v_inv.legal_club_entity_id, v_uid, 'invite',
            'Akseptert invitasjon ' || v_inv.id)
    ON CONFLICT (legal_club_entity_id, user_id) DO NOTHING;

    UPDATE public.manager_invitations
    SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
    WHERE id = v_inv.id;

    PERFORM log_authority_event(v_inv.legal_club_entity_id, 'accepted',
      v_uid, v_inv.id, v_uid, NULL,
      jsonb_build_object('email_match', true));
    PERFORM log_authority_event(v_inv.legal_club_entity_id, 'granted',
      v_uid, v_inv.id, v_uid, 'Aktiv rolle ved akseptert invitasjon');

    -- Claimanten (når invitasjonen kom fra en søknad) + øvrige
    -- aktive ansvarlige får beskjed.
    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT c.claimant_user_id, NULL, 'system',
           'Betalingsansvarlig på plass 💚',
           COALESCE(v_inv.invited_name, 'Den inviterte') ||
             ' har takket ja til å være betalingsansvarlig for ' ||
             COALESCE(v_legal, 'klubben') || '.',
           jsonb_build_object('screen', 'support_setup'),
           'manager_invitation', v_inv.id, now()
    FROM public.club_claims c
    WHERE c.id = v_inv.claim_id AND c.claimant_user_id <> v_uid;

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT m.user_id, NULL, 'system',
           'Ny betalingsansvarlig',
           COALESCE(v_pname, 'En ny person') || ' er nå betalingsansvarlig for ' ||
             COALESCE(v_legal, 'klubben') || '.',
           jsonb_build_object('screen', 'club_payments'),
           'manager_invitation', v_inv.id, now()
    FROM public.club_payment_managers m
    WHERE m.legal_club_entity_id = v_inv.legal_club_entity_id
      AND m.status = 'active' AND m.user_id <> v_uid;

    PERFORM notify_payments_event('accepted',
      jsonb_build_object('invitation_id', v_inv.id));

    RETURN jsonb_build_object('outcome', 'accepted', 'legal_name', v_legal);
  END IF;

  -- AVVIK (B1): registrer innløsningen, men INGEN aktiv rolle —
  -- ops må bekrefte gjennom auditert flate FØR aktivering.
  UPDATE public.manager_invitations
  SET status = 'awaiting_review', accepted_by = v_uid, accepted_at = now(),
      mismatch = jsonb_build_object(
        'account_email', v_email,
        'invited_email', v_inv.invited_email,
        'profile_name', v_pname,
        'invited_name', v_inv.invited_name,
        'name_match', v_names)
  WHERE id = v_inv.id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id,
    'invite_redeemed_review', v_uid, v_inv.id, v_uid,
    'E-postavvik ved innløsning — venter ops-kontroll',
    jsonb_build_object('name_match', v_names));

  PERFORM notify_payments_event('review_needed',
    jsonb_build_object('invitation_id', v_inv.id));

  RETURN jsonb_build_object('outcome', 'awaiting_review', 'legal_name', v_legal);
END;
-- search_path inkluderer extensions: pgcrypto (digest) kan bo der
-- eller i public avhengig av prosjektets historikk.
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================
-- 12) decline_manager_invitation — den inviterte takker nei.
-- ============================================================
CREATE OR REPLACE FUNCTION decline_manager_invitation(
  p_token text,
  p_note  text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_inv   public.manager_invitations%ROWTYPE;
  v_legal text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RAISE EXCEPTION 'Lenken er ugyldig eller allerede brukt.';
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.manager_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND OR v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Lenken er ugyldig eller allerede brukt.';
  END IF;

  UPDATE public.manager_invitations
  SET status = 'declined', accepted_by = v_uid, accepted_at = now(),
      note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), note)
  WHERE id = v_inv.id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id,
    'invite_declined', v_uid, v_inv.id, v_uid,
    NULLIF(trim(COALESCE(p_note, '')), ''));

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = v_inv.legal_club_entity_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT c.claimant_user_id, NULL, 'system',
         'Invitasjonen ble ikke akseptert',
         COALESCE(v_inv.invited_name, 'Den inviterte') ||
           ' takket nei til å være betalingsansvarlig for ' ||
           COALESCE(v_legal, 'klubben') ||
           '. Ta kontakt på hello@heiaapp.no for å nominere en annen.',
         jsonb_build_object('screen', 'support_setup'),
         'manager_invitation', v_inv.id, now()
  FROM public.club_claims c
  WHERE c.id = v_inv.claim_id;

  IF NOT entity_has_active_manager(v_inv.legal_club_entity_id) THEN
    PERFORM notify_payments_event('managerless', jsonb_build_object(
      'legal_club_entity_id', v_inv.legal_club_entity_id,
      'reason', 'invitasjon avslått'));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================
-- 13) issue_manager_invitation — aktiv betalingsansvarlig inviterer
--     en ny (B5: øvrige ansvarlige varsles; INGEN rutinemessig
--     ops-e-post; forsøk fra suspendert konto = sikkerhetsvarsel).
-- ============================================================
CREATE OR REPLACE FUNCTION issue_manager_invitation(
  p_entity_id uuid,
  p_name      text,
  p_email     text,
  p_note      text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_row   public.club_payment_managers%ROWTYPE;
  v_name  text := NULLIF(trim(COALESCE(p_name, '')), '');
  v_email text := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
  v_legal text;
  v_pname text;
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  SELECT * INTO v_row
  FROM public.club_payment_managers
  WHERE legal_club_entity_id = p_entity_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan invitere.';
  END IF;
  IF v_row.status = 'suspended' THEN
    PERFORM log_authority_event(p_entity_id, 'invite_attempt_invalid',
      v_uid, NULL, v_uid, 'Invitasjonsforsøk fra suspendert konto');
    PERFORM notify_payments_event('security', jsonb_build_object(
      'legal_club_entity_id', p_entity_id,
      'reason', 'Invitasjonsforsøk fra suspendert betalingsansvarlig',
      'user_id', v_uid));
    RAISE EXCEPTION 'Kontoen din er suspendert for denne klubben — kontakt hello@heiaapp.no.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Skriv inn navnet på den du inviterer.';
  END IF;
  IF COALESCE(v_email NOT LIKE '%@%', true) THEN
    RAISE EXCEPTION 'Skriv inn en gyldig e-postadresse.';
  END IF;

  BEGIN
    INSERT INTO public.manager_invitations
      (legal_club_entity_id, invited_name, invited_email, source,
       created_by, note)
    VALUES (p_entity_id, v_name, v_email, 'manager', v_uid,
            NULLIF(trim(COALESCE(p_note, '')), ''))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Det ligger allerede en åpen invitasjon til denne adressen.';
  END;

  PERFORM log_authority_event(p_entity_id, 'invite_issued', NULL, v_id,
    v_uid, NULLIF(trim(COALESCE(p_note, '')), ''),
    jsonb_build_object('source', 'manager'));

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = p_entity_id;
  SELECT display_name INTO v_pname FROM public.profiles WHERE id = v_uid;

  -- Øvrige aktive ansvarlige varsles (app her; e-post i payments-notify).
  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT m.user_id, NULL, 'system',
         'Ny betalingsansvarlig invitert',
         COALESCE(v_pname, 'En betalingsansvarlig') || ' har invitert ' ||
           v_name || ' som betalingsansvarlig for ' ||
           COALESCE(v_legal, 'klubben') || '.',
         jsonb_build_object('screen', 'club_payments'),
         'manager_invitation', v_id, now()
  FROM public.club_payment_managers m
  WHERE m.legal_club_entity_id = p_entity_id
    AND m.status = 'active' AND m.user_id <> v_uid;

  PERFORM notify_payments_event('manager_issued',
    jsonb_build_object('invitation_id', v_id));
  PERFORM notify_payments_event('invitation',
    jsonb_build_object('invitation_id', v_id));

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 14) Ops-RPC-ene — hele rollelivssyklusen som produktflyt
--     (produksjonskrav 2: aldri rå SQL for dette).
-- ============================================================
CREATE OR REPLACE FUNCTION ops_issue_manager_invitation(
  p_entity_id uuid,
  p_name      text,
  p_email     text,
  p_note      text
)
RETURNS uuid AS $$
DECLARE
  v_name  text := NULLIF(trim(COALESCE(p_name, '')), '');
  v_email text := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
  v_note  text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_id    uuid;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Skriv hvordan personen/fullmakten ble verifisert — det logges.';
  END IF;
  IF v_name IS NULL OR COALESCE(v_email NOT LIKE '%@%', true) THEN
    RAISE EXCEPTION 'Navn og gyldig e-post kreves.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_club_entities WHERE id = p_entity_id) THEN
    RAISE EXCEPTION 'Fant ikke enheten.';
  END IF;

  BEGIN
    INSERT INTO public.manager_invitations
      (legal_club_entity_id, invited_name, invited_email, source,
       created_by, note)
    VALUES (p_entity_id, v_name, v_email, 'ops', auth.uid(), v_note)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Det ligger allerede en åpen invitasjon til denne adressen.';
  END;

  PERFORM log_authority_event(p_entity_id, 'invite_issued', NULL, v_id,
    auth.uid(), v_note, jsonb_build_object('source', 'ops'));
  PERFORM notify_payments_event('invitation',
    jsonb_build_object('invitation_id', v_id));

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_revoke_manager_invitation(
  p_invitation_id uuid,
  p_note          text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_inv  public.manager_invitations%ROWTYPE;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Tilbaketrekking krever en begrunnelse — den logges.';
  END IF;

  SELECT * INTO v_inv FROM public.manager_invitations
  WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke invitasjonen.';
  END IF;
  IF v_inv.status NOT IN ('pending','awaiting_review') THEN
    RAISE EXCEPTION 'Invitasjonen har status «%» — bare åpne kan trekkes.', v_inv.status;
  END IF;

  UPDATE public.manager_invitations
  SET status = 'revoked', decided_by = auth.uid(), decided_at = now(),
      note = v_note
  WHERE id = p_invitation_id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id, 'invite_revoked',
    v_inv.accepted_by, p_invitation_id, auth.uid(), v_note);

  -- Sto den i avvikskontroll, får innløseren beskjed.
  IF v_inv.status = 'awaiting_review' AND v_inv.accepted_by IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    VALUES (v_inv.accepted_by, NULL, 'system',
      'Rollen ble ikke aktivert',
      'Heia kunne ikke bekrefte invitasjonen som betalingsansvarlig. Ta kontakt på hello@heiaapp.no om dette er feil.',
      jsonb_build_object('screen', 'support_setup'),
      'manager_invitation', p_invitation_id, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ops-beslutningen i avvikskontrollen (B1): bekreft → aktiv rolle.
CREATE OR REPLACE FUNCTION ops_confirm_invitation_review(
  p_invitation_id uuid,
  p_note          text
)
RETURNS void AS $$
DECLARE
  v_note  text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_inv   public.manager_invitations%ROWTYPE;
  v_legal text;
  v_pname text;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Beskriv hvordan identiteten ble bekreftet — det logges.';
  END IF;

  SELECT * INTO v_inv FROM public.manager_invitations
  WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke invitasjonen.';
  END IF;
  IF v_inv.status <> 'awaiting_review' THEN
    RAISE EXCEPTION 'Invitasjonen har status «%» — bare avvikskontroll kan bekreftes.', v_inv.status;
  END IF;

  INSERT INTO public.club_payment_managers
    (legal_club_entity_id, user_id, source, note)
  VALUES (v_inv.legal_club_entity_id, v_inv.accepted_by, 'invite',
          'Bekreftet av ops etter avvikskontroll (' || p_invitation_id || ')')
  ON CONFLICT (legal_club_entity_id, user_id) DO NOTHING;

  UPDATE public.manager_invitations
  SET status = 'accepted', decided_by = auth.uid(), decided_at = now(),
      note = v_note
  WHERE id = p_invitation_id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id, 'review_confirmed',
    v_inv.accepted_by, p_invitation_id, auth.uid(), v_note);
  PERFORM log_authority_event(v_inv.legal_club_entity_id, 'granted',
    v_inv.accepted_by, p_invitation_id, auth.uid(),
    'Aktiv rolle etter ops-bekreftet avvikskontroll');

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = v_inv.legal_club_entity_id;
  SELECT display_name INTO v_pname
  FROM public.profiles WHERE id = v_inv.accepted_by;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (v_inv.accepted_by, NULL, 'system',
    'Du er betalingsansvarlig 💚',
    'Heia har bekreftet deg som betalingsansvarlig for ' ||
      COALESCE(v_legal, 'klubben') || '.',
    jsonb_build_object('screen', 'club_payments'),
    'manager_invitation', p_invitation_id, now());

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT m.user_id, NULL, 'system',
         'Ny betalingsansvarlig',
         COALESCE(v_pname, 'En ny person') || ' er nå betalingsansvarlig for ' ||
           COALESCE(v_legal, 'klubben') || '.',
         jsonb_build_object('screen', 'club_payments'),
         'manager_invitation', p_invitation_id, now()
  FROM public.club_payment_managers m
  WHERE m.legal_club_entity_id = v_inv.legal_club_entity_id
    AND m.status = 'active' AND m.user_id <> v_inv.accepted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_reject_invitation_review(
  p_invitation_id uuid,
  p_note          text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_inv  public.manager_invitations%ROWTYPE;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Avvisning krever en begrunnelse — den logges.';
  END IF;

  SELECT * INTO v_inv FROM public.manager_invitations
  WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke invitasjonen.';
  END IF;
  IF v_inv.status <> 'awaiting_review' THEN
    RAISE EXCEPTION 'Invitasjonen har status «%» — bare avvikskontroll kan avvises.', v_inv.status;
  END IF;

  UPDATE public.manager_invitations
  SET status = 'revoked', decided_by = auth.uid(), decided_at = now(),
      note = v_note
  WHERE id = p_invitation_id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id, 'review_rejected',
    v_inv.accepted_by, p_invitation_id, auth.uid(), v_note);

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (v_inv.accepted_by, NULL, 'system',
    'Rollen ble ikke aktivert',
    'Heia kunne ikke bekrefte deg som betalingsansvarlig. Ta kontakt på hello@heiaapp.no om dette er feil.',
    jsonb_build_object('screen', 'support_setup'),
    'manager_invitation', p_invitation_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_suspend_manager(
  p_entity_id uuid,
  p_user_id   uuid,
  p_note      text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Suspensjon krever en begrunnelse — den logges.';
  END IF;

  UPDATE public.club_payment_managers
  SET status = 'suspended'
  WHERE legal_club_entity_id = p_entity_id AND user_id = p_user_id
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ingen aktiv betalingsansvarlig å suspendere.';
  END IF;

  PERFORM log_authority_event(p_entity_id, 'suspended', p_user_id, NULL,
    auth.uid(), v_note);

  -- Suspensjon av siste aktive er LOV (sikkerhet trumfer) — men da
  -- er enheten managerløs og ops varsles eksplisitt.
  IF NOT entity_has_active_manager(p_entity_id) THEN
    PERFORM notify_payments_event('managerless', jsonb_build_object(
      'legal_club_entity_id', p_entity_id,
      'reason', 'siste aktive ansvarlige suspendert'));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_reactivate_manager(
  p_entity_id uuid,
  p_user_id   uuid,
  p_note      text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Reaktivering krever en begrunnelse — den logges.';
  END IF;

  UPDATE public.club_payment_managers
  SET status = 'active'
  WHERE legal_club_entity_id = p_entity_id AND user_id = p_user_id
    AND status = 'suspended';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ingen suspendert betalingsansvarlig å reaktivere.';
  END IF;

  PERFORM log_authority_event(p_entity_id, 'reactivated', p_user_id, NULL,
    auth.uid(), v_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ops_remove_manager(
  p_entity_id uuid,
  p_user_id   uuid,
  p_note      text
)
RETURNS void AS $$
DECLARE
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_row  public.club_payment_managers%ROWTYPE;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Fjerning krever en begrunnelse — den logges.';
  END IF;

  SELECT * INTO v_row FROM public.club_payment_managers
  WHERE legal_club_entity_id = p_entity_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ingen betalingsansvarlig å fjerne.';
  END IF;

  -- Siste-aktive-vernet: administrativ fjerning av siste aktive
  -- avvises (suspender, eller inviter erstatter først).
  -- Kontosletting (GDPR) går IKKE denne veien og kan aldri nektes.
  IF v_row.status = 'active' AND NOT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE legal_club_entity_id = p_entity_id
      AND status = 'active' AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Kan ikke fjerne den siste aktive betalingsansvarlige — suspender kontoen eller få en erstatter på plass først.';
  END IF;

  DELETE FROM public.club_payment_managers
  WHERE legal_club_entity_id = p_entity_id AND user_id = p_user_id;

  PERFORM log_authority_event(p_entity_id, 'removed', p_user_id, NULL,
    auth.uid(), v_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auditert lagflytting — verktøyet for lag under feil/duplikat
-- klubbrad (II.7). Aldri rå SQL.
CREATE OR REPLACE FUNCTION ops_move_team_to_club(
  p_team_id        uuid,
  p_target_club_id uuid,
  p_note           text
)
RETURNS void AS $$
DECLARE
  v_note   text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_from   uuid;
  v_entity uuid;
BEGIN
  IF NOT is_ops_admin() THEN
    RAISE EXCEPTION 'Kun Heia-ops.';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Lagflytting krever en begrunnelse — den logges.';
  END IF;

  SELECT club_id INTO v_from FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke laget.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_target_club_id) THEN
    RAISE EXCEPTION 'Fant ikke målklubben.';
  END IF;
  IF v_from = p_target_club_id THEN
    RAISE EXCEPTION 'Laget ligger allerede i denne klubben.';
  END IF;

  UPDATE public.teams SET club_id = p_target_club_id WHERE id = p_team_id;

  SELECT legal_club_entity_id INTO v_entity
  FROM public.club_legal_entity_links
  WHERE club_id = p_target_club_id AND status = 'active';

  PERFORM log_authority_event(v_entity, 'team_moved', NULL, NULL,
    auth.uid(), v_note,
    jsonb_build_object('team_id', p_team_id,
                       'from_club_id', v_from,
                       'to_club_id', p_target_club_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ops-oversikten: enheter, kontoer, klubbrader, managere,
-- invitasjoner (inkl. review-køen) og siste hendelser — flaten som
-- gjør SQL-editoren til nødfallback.
CREATE OR REPLACE FUNCTION ops_list_payment_entities()
RETURNS jsonb AS $$
BEGIN
  IF NOT is_ops_admin() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(obj ORDER BY legal_name), '[]'::jsonb)
    FROM (
      SELECT e.legal_name, jsonb_build_object(
        'entity', jsonb_build_object(
          'id', e.id, 'legal_name', e.legal_name,
          'org_number', e.org_number,
          'verification_status', e.verification_status),
        'account', (
          SELECT jsonb_build_object(
            'status', a.status, 'charges_enabled', a.charges_enabled)
          FROM public.club_payment_accounts a
          WHERE a.legal_club_entity_id = e.id AND a.provider = 'stripe'),
        'clubs', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name) ORDER BY l.created_at), '[]'::jsonb)
          FROM public.club_legal_entity_links l
          JOIN public.clubs c ON c.id = l.club_id
          WHERE l.legal_club_entity_id = e.id AND l.status = 'active'),
        'managers', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'name', p.display_name,
            'status', m.status,
            'source', m.source,
            'created_at', m.created_at) ORDER BY m.created_at), '[]'::jsonb)
          FROM public.club_payment_managers m
          JOIN public.profiles p ON p.id = m.user_id
          WHERE m.legal_club_entity_id = e.id),
        'invitations', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'invited_name', i.invited_name,
            'invited_email', i.invited_email,
            'status', i.status,
            'source', i.source,
            'sent_at', i.sent_at,
            'reminded_at', i.reminded_at,
            'expires_at', i.expires_at,
            'accepted_by_name', (SELECT p2.display_name FROM public.profiles p2
                                 WHERE p2.id = i.accepted_by),
            'mismatch', i.mismatch,
            'note', i.note,
            'created_at', i.created_at) ORDER BY i.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT * FROM public.manager_invitations mi
            WHERE mi.legal_club_entity_id = e.id
            ORDER BY mi.created_at DESC LIMIT 20
          ) i),
        'events', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'event', ev.event,
            'subject', (SELECT p3.display_name FROM public.profiles p3
                        WHERE p3.id = ev.subject_user_id),
            'actor', (SELECT p4.display_name FROM public.profiles p4
                      WHERE p4.id = ev.actor_user_id),
            'note', ev.note,
            'created_at', ev.created_at) ORDER BY ev.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT * FROM public.payment_authority_events pe
            WHERE pe.legal_club_entity_id = e.id
            ORDER BY pe.created_at DESC LIMIT 20
          ) ev)
      ) AS obj
      FROM public.legal_club_entities e
    ) x
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 15) get_club_payments_overview v2 — enhets-scopet, additiv
--     payload ('club' = kanonisk/eldste lenkede rad, så utrullede
--     klienter leser videre). Nytt: clubs[], managers[],
--     invitations[], entity-id, unresolved_cancellations (delfeil-
--     fiksen for deaktivering).
-- ============================================================
CREATE OR REPLACE FUNCTION get_club_payments_overview()
RETURNS jsonb AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_payment_manager_anywhere() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(club_obj ORDER BY legal_name), '[]'::jsonb)
    FROM (
      SELECT e.legal_name, jsonb_build_object(
        'entity', jsonb_build_object(
          'id', e.id, 'legal_name', e.legal_name, 'org_number', e.org_number),
        -- Bakoverkompatibelt: kanonisk klubbrad (eldste aktive link).
        'club', (
          SELECT jsonb_build_object('id', c.id, 'name', c.name)
          FROM public.club_legal_entity_links l
          JOIN public.clubs c ON c.id = l.club_id
          WHERE l.legal_club_entity_id = e.id AND l.status = 'active'
          ORDER BY l.created_at LIMIT 1),
        'clubs', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name) ORDER BY l.created_at), '[]'::jsonb)
          FROM public.club_legal_entity_links l
          JOIN public.clubs c ON c.id = l.club_id
          WHERE l.legal_club_entity_id = e.id AND l.status = 'active'),
        'account', (
          SELECT jsonb_build_object(
            'status', cpa.status, 'charges_enabled', cpa.charges_enabled)
          FROM public.club_payment_accounts cpa
          WHERE cpa.legal_club_entity_id = e.id AND cpa.provider = 'stripe'),
        'requests', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', a.id,
            'team_space_id', a.team_space_id,
            'team_name', ts.display_name,
            'age_group', t.age_group,
            'gender', t.gender,
            'member_count', (
              SELECT count(*) FROM public.memberships ms
              WHERE ms.team_space_id = a.team_space_id
                AND ms.status = 'active'),
            'requested_by', p.display_name,
            'requested_at', a.created_at
          ) ORDER BY a.created_at), '[]'::jsonb)
          FROM public.team_support_approvals a
          JOIN public.team_spaces ts ON ts.id = a.team_space_id
          JOIN public.teams t ON t.id = ts.team_id
          JOIN public.profiles p ON p.id = a.requested_by
          JOIN public.club_legal_entity_links l2
            ON l2.club_id = a.club_id AND l2.status = 'active'
          WHERE l2.legal_club_entity_id = e.id AND a.status = 'pending'
        ),
        'teams', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'team_space_id', ts.id,
            'team_name', ts.display_name,
            'age_group', t.age_group,
            'state', CASE
              WHEN EXISTS (
                SELECT 1 FROM public.support_offerings o
                WHERE o.team_space_id = ts.id AND o.status = 'active')
                THEN 'collecting'
              WHEN EXISTS (
                SELECT 1 FROM public.team_support_approvals a2
                WHERE a2.team_space_id = ts.id AND a2.status = 'pending')
                THEN 'pending'
              ELSE COALESCE((
                SELECT CASE la.action
                  WHEN 'pause' THEN 'paused'
                  WHEN 'deactivate' THEN 'deactivated'
                  ELSE 'none' END
                FROM public.team_support_actions la
                WHERE la.team_space_id = ts.id
                  AND la.action IN ('pause','deactivate','approve')
                ORDER BY la.created_at DESC LIMIT 1), 'none')
            END,
            'live_subscriptions', team_live_subscription_count(ts.id),
            -- Delfeil-fiksen: levende abonnementer UTEN cancel_at på
            -- et deaktivert lag = Stripe-kallet nådde ikke frem →
            -- «Fullfør deaktiveringen»-knappen i flaten.
            'unresolved_cancellations', (
              SELECT CASE WHEN (
                SELECT la2.action FROM public.team_support_actions la2
                WHERE la2.team_space_id = ts.id
                  AND la2.action IN ('pause','deactivate','approve')
                ORDER BY la2.created_at DESC LIMIT 1) = 'deactivate'
              THEN (
                SELECT count(*)::int FROM public.support_subscriptions ss
                WHERE ss.team_space_id = ts.id
                  AND ss.status IN ('active','past_due')
                  AND ss.cancel_at IS NULL)
              ELSE 0 END)
          ) ORDER BY ts.display_name), '[]'::jsonb)
          FROM public.teams t
          JOIN public.team_spaces ts ON ts.team_id = t.id
          JOIN public.club_legal_entity_links l3
            ON l3.club_id = t.club_id AND l3.status = 'active'
          WHERE l3.legal_club_entity_id = e.id
        ),
        'log', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'action', x.action,
            'team_name', x.team_name,
            'actor', x.actor,
            'note', x.note,
            'affected_subscriptions', x.affected_subscriptions,
            'created_at', x.created_at
          ) ORDER BY x.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT act.action, ts2.display_name AS team_name,
                   p2.display_name AS actor, act.note,
                   act.affected_subscriptions, act.created_at
            FROM public.team_support_actions act
            JOIN public.club_legal_entity_links l4
              ON l4.club_id = act.club_id AND l4.status = 'active'
            JOIN public.team_spaces ts2 ON ts2.id = act.team_space_id
            JOIN public.profiles p2 ON p2.id = act.actor_user_id
            WHERE l4.legal_club_entity_id = e.id
            ORDER BY act.created_at DESC
            LIMIT 20
          ) x
        ),
        'managers', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'name', p5.display_name,
            'status', m.status,
            'source', m.source,
            'is_me', m.user_id = v_uid) ORDER BY m.created_at), '[]'::jsonb)
          FROM public.club_payment_managers m
          JOIN public.profiles p5 ON p5.id = m.user_id
          WHERE m.legal_club_entity_id = e.id),
        'invitations', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'invited_name', i.invited_name,
            'status', i.status,
            'source', i.source,
            'sent_at', i.sent_at,
            'expires_at', i.expires_at,
            'created_at', i.created_at) ORDER BY i.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT * FROM public.manager_invitations mi
            WHERE mi.legal_club_entity_id = e.id
              AND (mi.status IN ('pending','awaiting_review')
                   OR mi.created_at > now() - interval '30 days')
            ORDER BY mi.created_at DESC LIMIT 10
          ) i)
      ) AS club_obj
      FROM public.legal_club_entities e
      JOIN public.club_payment_managers me
        ON me.legal_club_entity_id = e.id
       AND me.user_id = v_uid AND me.status = 'active'
    ) clubs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 16) get_support_activation_status v4 — awaiting_manager +
--     can_onboard. Ellers 00047-formen (team-blokk uendret).
-- ============================================================
CREATE OR REPLACE FUNCTION get_support_activation_status(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_club_id   uuid;
  v_club_name text;
  v_entity    record;
  v_claim     record;
  v_team      jsonb;
  v_mgr       boolean;
  v_inv       record;
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

  -- Lagets dør-tilstand (uendret fra 00047).
  v_team := jsonb_build_object(
    'support_state', CASE
      WHEN EXISTS (
        SELECT 1 FROM public.support_offerings o
        WHERE o.team_space_id = ts_id AND o.status = 'active')
        THEN 'collecting'
      WHEN EXISTS (
        SELECT 1 FROM public.team_support_approvals a
        WHERE a.team_space_id = ts_id AND a.status = 'pending')
        THEN 'pending'
      ELSE COALESCE((
        SELECT CASE la.action
          WHEN 'pause' THEN 'paused'
          WHEN 'deactivate' THEN 'deactivated'
          ELSE 'none' END
        FROM public.team_support_actions la
        WHERE la.team_space_id = ts_id
          AND la.action IN ('pause','deactivate','approve')
        ORDER BY la.created_at DESC LIMIT 1), 'none')
    END,
    'approval', (
      SELECT jsonb_build_object(
        'id', a.id, 'status', a.status, 'note', a.note,
        'created_at', a.created_at, 'decided_at', a.decided_at)
      FROM public.team_support_approvals a
      WHERE a.team_space_id = ts_id
      ORDER BY (a.status = 'pending') DESC, a.created_at DESC
      LIMIT 1
    )
  );

  SELECT e.id AS entity_id, e.org_number, e.legal_name,
         cpa.id AS account_id, cpa.status,
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
    v_mgr := is_entity_payment_manager(v_entity.entity_id);

    -- AWAITING_MANAGER (v2): verifisert enhet, men ingen aktiv
    -- betalingsansvarlig — KYC og port 3 venter på rollen.
    IF NOT entity_has_active_manager(v_entity.entity_id) THEN
      SELECT invited_name, status INTO v_inv
      FROM public.manager_invitations
      WHERE legal_club_entity_id = v_entity.entity_id
      ORDER BY created_at DESC LIMIT 1;

      RETURN jsonb_build_object(
        'state', 'awaiting_manager',
        'club', jsonb_build_object('id', v_club_id, 'name', v_club_name),
        'entity', jsonb_build_object(
          'org_number', v_entity.org_number,
          'legal_name', v_entity.legal_name),
        'account', NULL,
        'claim', NULL,
        'team', v_team,
        'is_payment_manager', false,
        'can_onboard', false,
        'manager_pending', CASE WHEN v_inv.invited_name IS NULL THEN NULL
          ELSE jsonb_build_object(
            'invited_name', v_inv.invited_name,
            'status', CASE v_inv.status
              WHEN 'pending' THEN 'invited'
              WHEN 'awaiting_review' THEN 'in_review'
              ELSE v_inv.status END) END
      );
    END IF;

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
      'claim', NULL,
      'team', v_team,
      'is_payment_manager', v_mgr,
      'can_onboard', v_mgr
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
      'entity', NULL, 'account', NULL, 'claim', NULL,
      'team', v_team,
      'is_payment_manager', false,
      'can_onboard', false
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
    ),
    'team', v_team,
    'is_payment_manager', false,
    'can_onboard', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 17) request_team_support_approval v2 — mottakere via enhetens
--     AKTIVE ansvarlige + e-post; managerløs enhet → ops-fallback
--     (ingen forespørsel forsvinner til null mottakere).
-- ============================================================
CREATE OR REPLACE FUNCTION request_team_support_approval(ts_id uuid)
RETURNS uuid AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_club_id   uuid;
  v_entity_id uuid;
  v_team_name text;
  v_id        uuid;
  v_receivers int;
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(is_team_admin(ts_id), false) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere kan be om godkjenning.';
  END IF;

  SELECT c.id, ts.display_name INTO v_club_id, v_team_name
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  WHERE ts.id = ts_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Laget mangler klubb.';
  END IF;

  SELECT l.legal_club_entity_id INTO v_entity_id
  FROM public.club_legal_entity_links l
  WHERE l.club_id = v_club_id AND l.status = 'active';
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Klubben er ikke aktivert for støtte ennå.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_offerings
    WHERE team_space_id = ts_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Laget samler allerede inn støtte.';
  END IF;

  BEGIN
    INSERT INTO public.team_support_approvals
      (team_space_id, club_id, requested_by)
    VALUES (ts_id, v_club_id, v_uid)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Laget har allerede en forespørsel til vurdering.';
  END;

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, approval_id, action, actor_user_id)
  VALUES (v_club_id, ts_id, v_id, 'request', v_uid);

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT
    m.user_id, NULL, 'system',
    'Lag ber om godkjenning',
    '«' || v_team_name || '» vil samle inn støtte. Godkjenn under ' ||
      'Klubbbetalinger på Profil.',
    jsonb_build_object(
      'screen', 'club_payments',
      'club_id', v_club_id,
      'team_space_id', ts_id,
      'approval_id', v_id
    ),
    'team_support_approval', v_id, now()
  FROM public.club_payment_managers m
  WHERE m.legal_club_entity_id = v_entity_id AND m.status = 'active';
  GET DIAGNOSTICS v_receivers = ROW_COUNT;

  IF v_receivers = 0 THEN
    -- Managerløs enhet: ops er fallback-mottakeren (II.9).
    PERFORM notify_payments_event('team_request_no_manager',
      jsonb_build_object('approval_id', v_id));
  ELSE
    PERFORM notify_payments_event('team_request',
      jsonb_build_object('approval_id', v_id));
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 18) approve_team_support v2 — kanonisk aktiv-predikat + defaults
--     via enheten. (reject_team_support er UENDRET — avslag skal
--     alltid være mulig; manager-gaten der virker via wrapperen.)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_team_support(p_approval_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_approval  public.team_support_approvals%ROWTYPE;
  v_entity_id uuid;
  v_defaults  public.club_support_defaults%ROWTYPE;
  v_team_name text;
  v_result    jsonb;
BEGIN
  SELECT * INTO v_approval
  FROM public.team_support_approvals
  WHERE id = p_approval_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke forespørselen.';
  END IF;
  IF v_uid IS NULL OR NOT is_club_payment_manager(v_approval.club_id) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan godkjenne lag.';
  END IF;
  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'Forespørselen er allerede behandlet.';
  END IF;

  SELECT l.legal_club_entity_id INTO v_entity_id
  FROM public.club_legal_entity_links l
  WHERE l.club_id = v_approval.club_id AND l.status = 'active';
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Klubben er ikke lenger aktivert for støtte.';
  END IF;

  -- Kjeden (II.4): godkjenning av lag krever at Stripe-kontoen er
  -- AKTIV — det kanoniske predikatet, aldri en svakere parallell.
  IF NOT payment_account_ready_for_entity(v_entity_id) THEN
    RAISE EXCEPTION 'Klubbens Stripe-konto er ikke aktiv ennå — godkjenningen åpner når registreringen hos Stripe er fullført. Forespørselen blir liggende her.';
  END IF;

  SELECT * INTO v_defaults
  FROM public.club_support_defaults
  WHERE legal_club_entity_id = v_entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klubben mangler standardtilbud fra Heia — kontakt hello@heiaapp.no.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_offerings
    WHERE team_space_id = v_approval.team_space_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Laget samler allerede inn støtte.';
  END IF;

  v_result := create_support_offering(
    v_approval.team_space_id,
    v_defaults.amount_minor,
    v_defaults.fee_model,
    v_defaults.fee_bps,
    v_defaults.club_fixed_minor,
    v_uid
  );

  UPDATE public.team_support_approvals SET
    status = 'approved',
    decided_by = v_uid,
    decided_at = now(),
    resulting_offering_id = (v_result->>'offering_id')::uuid
  WHERE id = p_approval_id;

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, approval_id, action, actor_user_id)
  VALUES (v_approval.club_id, v_approval.team_space_id, p_approval_id,
          'approve', v_uid);

  SELECT display_name INTO v_team_name
  FROM public.team_spaces WHERE id = v_approval.team_space_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_approval.requested_by, v_approval.team_space_id, 'system',
    'Laget er godkjent for støtte 💚',
    'Klubben godkjente «' || v_team_name || '» — «Støtt laget» er nå ' ||
      'åpen for medlemmene.',
    jsonb_build_object(
      'screen', 'support_setup',
      'team_space_id', v_approval.team_space_id
    ),
    'team_support_approval', p_approval_id, now()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 19) deactivate_team_support_data — manager-vakten via enheten
--     (service role only; Edge Function-en er uendret).
-- ============================================================
CREATE OR REPLACE FUNCTION deactivate_team_support_data(
  p_team_space_id uuid,
  p_actor_user_id uuid,
  p_note          text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_club_id   uuid;
  v_entity_id uuid;
  v_subs      text[];
BEGIN
  SELECT t.club_id INTO v_club_id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_space_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Fant ikke laget.';
  END IF;

  SELECT l.legal_club_entity_id INTO v_entity_id
  FROM public.club_legal_entity_links l
  WHERE l.club_id = v_club_id AND l.status = 'active';

  IF v_entity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE legal_club_entity_id = v_entity_id
      AND user_id = p_actor_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan deaktivere støtte.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('support_offering'), hashtext(p_team_space_id::text));

  UPDATE public.support_offerings
  SET status = 'archived'
  WHERE team_space_id = p_team_space_id AND status = 'active';

  SELECT COALESCE(array_agg(provider_subscription_id), '{}')
  INTO v_subs
  FROM public.support_subscriptions
  WHERE team_space_id = p_team_space_id
    AND status IN ('active','past_due')
    AND provider_subscription_id IS NOT NULL;

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, action, actor_user_id, note,
     affected_subscriptions)
  VALUES (v_club_id, p_team_space_id, 'deactivate', p_actor_user_id,
          NULLIF(trim(COALESCE(p_note, '')), ''),
          COALESCE(array_length(v_subs, 1), 0));

  RETURN jsonb_build_object(
    'subscription_ids', to_jsonb(v_subs),
    'count', COALESCE(array_length(v_subs, 1), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 20) delete_account_data — rolleopprydding med hendelseslogg og
--     managerløs-varsel (GDPR kan aldri nektes; ops varsles).
--     Resten er uendret fra 00047.
-- ============================================================
CREATE OR REPLACE FUNCTION delete_account_data(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_profile record;
  v_entity  uuid;
BEGIN
  SELECT p.id, p.deleted_at
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET display_name = 'Slettet bruker',
      avatar_url   = NULL,
      phone        = NULL,
      household_id = NULL,
      deleted_at   = now()
  WHERE id = p_user_id;

  DELETE FROM public.event_rsvps WHERE user_id = p_user_id;
  DELETE FROM public.memberships WHERE user_id = p_user_id;
  DELETE FROM public.managed_children WHERE managed_by = p_user_id;

  DELETE FROM public.household_members WHERE profile_id = p_user_id;
  DELETE FROM public.households h
  WHERE h.created_by = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.household_members hm WHERE hm.household_id = h.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.managed_children mc WHERE mc.household_id = h.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.household_id = h.id);

  DELETE FROM public.user_devices WHERE user_id = p_user_id;
  DELETE FROM public.device_tokens WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;

  -- Betalingsansvarlig-rollen (v2): logg fjerningen per enhet, og
  -- varsle ops umiddelbart om enheter som blir managerløse.
  FOR v_entity IN
    SELECT legal_club_entity_id FROM public.club_payment_managers
    WHERE user_id = p_user_id
  LOOP
    PERFORM log_authority_event(v_entity, 'removed', p_user_id, NULL,
      NULL, 'Kontosletting (GDPR)');
  END LOOP;

  DELETE FROM public.club_payment_managers WHERE user_id = p_user_id;

  FOR v_entity IN
    SELECT DISTINCT e.legal_club_entity_id
    FROM public.payment_authority_events e
    WHERE e.subject_user_id = p_user_id AND e.event = 'removed'
      AND e.legal_club_entity_id IS NOT NULL
      AND NOT entity_has_active_manager(e.legal_club_entity_id)
  LOOP
    PERFORM notify_payments_event('managerless', jsonb_build_object(
      'legal_club_entity_id', v_entity,
      'reason', 'betalingsansvarlig slettet kontoen sin'));
  END LOOP;

  DELETE FROM public.reactions WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account_data(uuid) TO service_role;


-- ============================================================
-- 21) Rettigheter (00046-lærdommen: REVOKE må ta PUBLIC — anon
--     arver PUBLIC-granten funksjoner fødes med).
-- ============================================================
GRANT EXECUTE ON FUNCTION redeem_manager_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_manager_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_manager_invitation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_issue_manager_invitation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_revoke_manager_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_confirm_invitation_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_reject_invitation_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_suspend_manager(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_reactivate_manager(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_remove_manager(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_move_team_to_club(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ops_list_payment_entities() TO authenticated;

REVOKE ALL ON FUNCTION redeem_manager_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION decline_manager_invitation(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION issue_manager_invitation(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_issue_manager_invitation(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_revoke_manager_invitation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_confirm_invitation_review(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_reject_invitation_review(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_suspend_manager(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_reactivate_manager(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_remove_manager(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_move_team_to_club(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ops_list_payment_entities() FROM PUBLIC, anon;
