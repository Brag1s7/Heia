-- ============================================================
-- 00067_forlat_lag.sql
--
-- «Forlat lag» — dormant-modellen (FROSSET 2026-08-19, se
-- docs/FORLAT-LAG-DORMANT-2026-08.md — kanonisk beslutningsgrunnlag,
-- §-referansene under peker dit).
--
-- Grunnmodellen: laget er en selvstendig beholder som består med
-- null medlemmer. Utmelding rører KUN medlemskapet — ingen Stripe,
-- ingen sletting. Medlemskap og støtte er separate relasjoner.
-- deleted_at settes ALDRI her («Legg ned laget» er egen skive).
--
-- Migrasjonen bærer også de tre utestående A3-payload-fiksene
-- (avtalt: samme fremovermigrasjon som leave, §7):
--   A1. «Klubbbetalinger» → «Klubbetalinger» i RPC-varselteksten
--       (00062:1947, arvet fra 00047 — tre b-er er feil norsk).
--   A2. nominee-feltene i ops_claim_payload (kjent avvik 1 fra A2).
--   A3. manager-navnet i get_support_activation_status (avvik 2).
--
-- Leave-skiva (§7 i frysdokumentet):
--   B.  Kolonner: memberships.left_reason + ended_by (+ backfill),
--       memberships.requested_role, team_spaces.dormant_at
--       (+ backfill for alt tomme lag), profiles.onboarding_completed_at
--       (+ backfill + INSERT-trigger som dekker alle innmeldingsdører).
--   C.  Hjelpere: has_active_team_admin (den KANONISKE porten §3a —
--       utledet, aldri i utakt) + register_team_dormant_if_empty.
--   D.  RPC-er: leave_team · set_member_role (+ decline_role_request)
--       · join_team_space v4 (rolleavvisning §5, portene §3a/b,
--       requested_role, admin-varsel, gjenåpning §3f, nuller
--       dormant_at) · remove_team_member v2 (left_reason/ended_by)
--       · delete_account_data v4 (dormant-registrering + varsel).
--   E.  Leseflater: get_team_members v2 (+requested_role),
--       NY get_team_authors (forfatter-oppslaget som overlever
--       utmelding — kommentarfeltet mistet navn/avatar),
--       lookup_invite_code v4 (+has_active_admin),
--       get_club_payments_overview (+dormant_at — §3f-4-innsynet).
-- ============================================================


-- ============================================================
-- A1) request_team_support_approval — KUN tekstrettelsen
--     «Klubbbetalinger» → «Klubbetalinger». Ellers identisk 00062 §17.
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
      'Klubbetalinger på Profil.',
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
-- A2) ops_claim_payload — + de fire nominee-feltene (kjent avvik 1
--     fra A2: detaljskjermen kunne si AT en annen var nominert, men
--     ikke hvem). Ellers identisk 00046.
-- ============================================================
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
    'nominee_is_self', c.nominee_is_self,
    'nominee_name', c.nominee_name,
    'nominee_email', c.nominee_email,
    'nominee_phone', c.nominee_phone,
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


-- ============================================================
-- A3) get_support_activation_status v5 — + 'manager' (navnet på en
--     aktiv betalingsansvarlig) i enhet-med-manager-grenen, så
--     KYC-kortet kan si «venter på at [navn] fullfører hos Stripe»
--     også når det ikke er DEG (kjent avvik 2 fra A2).
--     Ellers identisk v4 (00062 §16).
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
      'can_onboard', v_mgr,
      -- A3-fiksen: navnet på EN aktiv betalingsansvarlig (eldste rolle
      -- først — deterministisk), så trenerkortet kan navngi hvem KYC
      -- venter på også når v_mgr er false.
      'manager', (
        SELECT jsonb_build_object('name', p.display_name)
        FROM public.club_payment_managers cpm
        JOIN public.profiles p ON p.id = cpm.user_id
        WHERE cpm.legal_club_entity_id = v_entity.entity_id
          AND cpm.status = 'active'
        ORDER BY cpm.created_at LIMIT 1)
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
-- B) Kolonnene.
-- ============================================================

-- Revisjonssporet (§3c): radene er de-facto append-only per episode
-- (gjeninntreden skaper NY rad), så hvordan en episode endte hører
-- hjemme på raden. left_reason skiller frivillig utmelding fra
-- fjerning — det er DENNE forskjellen §3b-porten leser.
ALTER TABLE public.memberships
  ADD COLUMN left_reason text
    CHECK (left_reason IN ('left','removed')),
  ADD COLUMN ended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.memberships.left_reason IS
  '§3c: hvordan episoden endte — ''left'' (frivillig utmelding) eller '
  '''removed'' (fjernet av lagadmin). NULL på levende rader.';
COMMENT ON COLUMN public.memberships.ended_by IS
  '§3c: hvem som avsluttet episoden — brukeren selv ved utmelding, '
  'administratoren ved fjerning. NULL = ukjent (backfill før 00067).';

-- Backfill (§3c, entydig): ALLE eksisterende removed-rader kom fra
-- remove_team_member — frivillig utmelding har aldri eksistert.
-- ended_by settes IKKE (ukjent, dokumentert). Dermed kan
-- legacy-fjernede ikke bruke koden i låste lag — som besluttet.
UPDATE public.memberships
SET left_reason = 'removed'
WHERE status = 'removed' AND left_reason IS NULL;

-- Innløserflaten (§5): «Jeg er trener» gir aktivt medlemskap som
-- supporter + en stående forespørsel. Koden gir ALDRI administrative
-- rettigheter direkte; godkjenningen er set_member_role.
ALTER TABLE public.memberships
  ADD COLUMN requested_role text
    CHECK (requested_role IN ('trener'));

COMMENT ON COLUMN public.memberships.requested_role IS
  '§5: stående rolleforespørsel fra join-flyten (''trener''). '
  'Godkjenn = set_member_role, avslå = decline_role_request.';

-- Dormant-registreringen (§3e): kan ikke utledes i ettertid
-- (kontosletting hard-sletter radene), så øyeblikket REGISTRERES.
-- Vedlikeholdes KUN av skrivedørene (leave_team, delete_account_data,
-- join_team_space/gjenåpning) — trygt fordi 00066 fjernet all
-- klient-skriving på memberships.
ALTER TABLE public.team_spaces
  ADD COLUMN dormant_at timestamptz;

COMMENT ON COLUMN public.team_spaces.dormant_at IS
  '§3e: når laget sist ble stående uten aktive medlemmer. Nulles av '
  'join_team_space. Utløser ALDRI sletting — kun innsyn og varsel.';

-- Backfill: lag som ALLEREDE står uten aktive medlemmer (foreldreløse
-- via kontosletting) er dormant i dag — registrer det, så ops-innsynet
-- er sant fra dag én. Tidspunktet er ukjent; migrasjonsøyeblikket er
-- den ærligste tilnærmingen vi har.
UPDATE public.team_spaces ts
SET dormant_at = now()
WHERE ts.deleted_at IS NULL
  AND ts.is_activated = true
  AND ts.dormant_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.team_space_id = ts.id AND m.status = 'active');

-- Den lagløse grenen (§3d, BESLUTTET): eksplisitt fullført-stempel
-- fremfor utledning fra medlems-/støtterader — skalerbart mot
-- nettsiden. (profiles.onboarding_completed fra 00003 er en ubrukt
-- boolean som aldri skrives — den lar vi ligge; stempelet er kanonisk.)
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  '§3d: første fullførte join/create. Navigator-porten: satt → '
  'hovedappen (Profil-rotet ved null aktive lag); NULL → onboarding. '
  'Påvirker ALDRI støtteavtalers livssyklus.';

-- Backfill: alle med en medlemsrad (uansett status) har fullført
-- onboardingen — første radens created_at er det sanneste tidspunktet.
UPDATE public.profiles p
SET onboarding_completed_at = m.first_at
FROM (
  SELECT user_id, min(created_at) AS first_at
  FROM public.memberships
  GROUP BY user_id
) m
WHERE m.user_id = p.id AND p.onboarding_completed_at IS NULL;

-- Stemplet settes av en INSERT-trigger, ikke i hver enkelt RPC:
-- join_team_space, create_team_from_scratch og activate_team_space
-- setter alle inn medlemsrader, og en fremtidig innmeldingsdør skal
-- ikke kunne glemme stempelet. Kun første gang (COALESCE-vakt i WHERE).
CREATE OR REPLACE FUNCTION stamp_onboarding_completed()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET onboarding_completed_at = now()
  WHERE id = NEW.user_id AND onboarding_completed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_memberships_stamp_onboarding
  AFTER INSERT ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION stamp_onboarding_completed();


-- ============================================================
-- C) Hjelperne.
-- ============================================================

-- Den KANONISKE porten (§3a): et lag uten aktiv lagadmin er låst for
-- ukjente kodebrukere. Ingen egen lås-kolonne — porten er utledet og
-- kan derfor aldri komme i utakt. (is_team_admin er auth-scopet og
-- kan ikke brukes: dette spør om LAGET, ikke om innringeren.)
CREATE OR REPLACE FUNCTION has_active_team_admin(ts_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE team_space_id = ts_id
      AND status = 'active'
      AND role IN ('trener','lagleder','admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION has_active_team_admin(uuid)
  FROM PUBLIC, anon, authenticated;

-- Dormant-registreringen (§3e), delt av leave_team og
-- delete_account_data: står laget uten aktive medlemmer settes
-- dormant_at (én gang), og ops får informasjonsvarsel når laget har
-- innhold eller levende avtaler — et tomt testlag varsler ingen.
-- Returnerer true når laget NÅ ble registrert dormant.
CREATE OR REPLACE FUNCTION register_team_dormant_if_empty(
  p_team_space_id uuid,
  p_reason        text
)
RETURNS boolean AS $$
DECLARE
  v_has_content boolean;
  v_live        int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE team_space_id = p_team_space_id AND status = 'active'
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.team_spaces
  SET dormant_at = now()
  WHERE id = p_team_space_id
    AND dormant_at IS NULL
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false; -- allerede registrert (eller nedlagt)
  END IF;

  v_has_content := EXISTS (
      SELECT 1 FROM public.feed_posts
      WHERE team_space_id = p_team_space_id)
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE team_space_id = p_team_space_id);

  SELECT count(*)::int INTO v_live
  FROM public.support_subscriptions
  WHERE team_space_id = p_team_space_id
    AND status IN ('active','past_due');

  IF v_has_content OR v_live > 0 THEN
    PERFORM notify_payments_event('team_dormant', jsonb_build_object(
      'team_space_id', p_team_space_id,
      'reason', p_reason,
      'has_content', v_has_content,
      'live_subscriptions', v_live));
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION register_team_dormant_if_empty(uuid, text)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- D1) leave_team — utmeldingen (§2).
--
-- Gjelder HELE personen: alle rader (personlig + barn) flippes
-- 'active'/'invited' → 'removed' med left_reason='left' og
-- ended_by=brukeren selv. Fremtidige RSVP-er slettes (user_id på
-- RSVP-raden er forelderen også for barne-RSVP-er); historikken
-- består. INGEN Stripe-kall — støtte og medlemskap er separate
-- relasjoner (modell B), avtaler administreres i «Min støtte».
--
-- Utfall som DATA (00064-kontrakten — exceptions kun der ingen
-- sideeffekt skal bevares, og her vil appen rute på utfallet):
--   'left'       — utmeldt. team_dormant sier om laget ble stående tomt.
--   'last_admin' — blokkert: siste aktive lagadmin kan ikke forlate et
--                  lag med andre aktive medlemmer (§2) — rollen må
--                  overdras først (set_member_role).
--   'not_member' — ingen levende rader (stale UI / dobbelttrykk).
-- ============================================================
CREATE OR REPLACE FUNCTION leave_team(p_team_space_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_rows    int;
  v_dormant boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke innlogget.';
  END IF;

  -- Serialiser mot samtidige utmeldinger/rollebytter i samme lag —
  -- to «siste admins» som forlater i samme sekund skal ikke kunne
  -- smyge seg forbi vakten hver for seg.
  PERFORM pg_advisory_xact_lock(
    hashtext('team_admin_guard'), hashtext(p_team_space_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_uid AND team_space_id = p_team_space_id
      AND status IN ('active','invited')
  ) THEN
    RETURN jsonb_build_object('outcome', 'not_member');
  END IF;

  -- Siste-admin-vakten (§2): siste aktive trener/lagleder/admin kan
  -- ikke forlate et lag som fortsatt har andre aktive medlemmer.
  IF EXISTS (
       SELECT 1 FROM public.memberships
       WHERE user_id = v_uid AND team_space_id = p_team_space_id
         AND status = 'active' AND role IN ('trener','lagleder','admin'))
     AND NOT EXISTS (
       SELECT 1 FROM public.memberships
       WHERE team_space_id = p_team_space_id AND status = 'active'
         AND role IN ('trener','lagleder','admin') AND user_id <> v_uid)
     AND EXISTS (
       SELECT 1 FROM public.memberships
       WHERE team_space_id = p_team_space_id AND status = 'active'
         AND user_id <> v_uid)
  THEN
    RETURN jsonb_build_object('outcome', 'last_admin');
  END IF;

  UPDATE public.memberships
  SET status = 'removed',
      left_at = now(),
      left_reason = 'left',
      ended_by = v_uid,
      requested_role = NULL
  WHERE user_id = v_uid AND team_space_id = p_team_space_id
    AND status IN ('active','invited');
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Samme RSVP-opprydding som remove_team_member (00041): «N kommer»
  -- skal ikke telle folk som ikke lenger er med; historikken består.
  DELETE FROM public.event_rsvps er
  USING public.events e
  WHERE er.event_id = e.id
    AND e.team_space_id = p_team_space_id
    AND er.user_id = v_uid
    AND e.start_time > now();

  v_dormant := register_team_dormant_if_empty(
    p_team_space_id, 'siste medlem forlot laget');

  RETURN jsonb_build_object(
    'outcome', 'left',
    'removed_rows', v_rows,
    'team_dormant', v_dormant);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION leave_team(uuid) TO authenticated;
REVOKE ALL ON FUNCTION leave_team(uuid) FROM PUBLIC, anon;


-- ============================================================
-- D2) set_member_role — rolleadministrasjonen (§2/§5).
--
-- Bruker-scopet (ikke rad-scopet) fordi CHECK-constrainten i 00007
-- forbyr lederroller på barne-rader: rollen bor alltid på den
-- PERSONLIGE raden. Spillere kan ikke promoteres i v1. Vakten
-- speiler siste-admin-vakten: laget skal aldri stå uten aktiv
-- lagadmin så lenge det har andre medlemmer — dermed kan siste
-- admin heller ikke demotere seg selv.
-- Godkjenning av trenerforespørsel = set_member_role(..., 'trener'):
-- enhver rollesetting nuller requested_role.
-- ============================================================
CREATE OR REPLACE FUNCTION set_member_role(
  p_team_space_id uuid,
  p_user_id       uuid,
  p_role          text
)
RETURNS jsonb AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_row  public.memberships%ROWTYPE;
  v_team text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke innlogget.';
  END IF;
  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere kan endre roller.';
  END IF;
  IF p_role NOT IN ('trener','lagleder','admin','forelder','supporter') THEN
    RAISE EXCEPTION 'Ugyldig rolle.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('team_admin_guard'), hashtext(p_team_space_id::text));

  SELECT * INTO v_row
  FROM public.memberships
  WHERE user_id = p_user_id AND team_space_id = p_team_space_id
    AND status = 'active' AND managed_child_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personen har ingen personlig rad i laget — rollen kan ikke endres her.';
  END IF;
  IF v_row.role = 'spiller' THEN
    RAISE EXCEPTION 'Spillere kan ikke gis en annen rolle ennå.';
  END IF;

  IF v_row.role = p_role THEN
    -- Idempotent — men en stående forespørsel på samme rolle er
    -- dermed innfridd og skal bort.
    UPDATE public.memberships SET requested_role = NULL
    WHERE id = v_row.id AND requested_role IS NOT NULL;
    RETURN jsonb_build_object('outcome', 'unchanged', 'role', p_role);
  END IF;

  -- Vakt: en demotering får aldri etterlate laget uten aktiv lagadmin
  -- (dekker også «siste admin demoterer seg selv»).
  IF v_row.role IN ('trener','lagleder','admin')
     AND p_role NOT IN ('trener','lagleder','admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.memberships
       WHERE team_space_id = p_team_space_id AND status = 'active'
         AND role IN ('trener','lagleder','admin')
         AND user_id <> p_user_id)
  THEN
    RAISE EXCEPTION 'Laget må ha minst én trener eller lagleder — gi noen andre rollen først.';
  END IF;

  UPDATE public.memberships
  SET role = p_role, requested_role = NULL
  WHERE id = v_row.id;

  IF p_user_id <> v_uid THEN
    SELECT display_name INTO v_team
    FROM public.team_spaces WHERE id = p_team_space_id;

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    VALUES (p_user_id, p_team_space_id, 'system',
      'Ny rolle i laget',
      'Du er nå ' || p_role || ' i «' || COALESCE(v_team, 'laget') || '».',
      jsonb_build_object(
        'screen', 'team_members', 'team_space_id', p_team_space_id),
      'membership', v_row.id, now());
  END IF;

  RETURN jsonb_build_object('outcome', 'changed', 'role', p_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION set_member_role(uuid, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION set_member_role(uuid, uuid, text) FROM PUBLIC, anon;


-- Avslå-veien (§5): forespørselen nulles, personen består som
-- supporter, og får rolig beskjed — aldri stille forsvinning.
CREATE OR REPLACE FUNCTION decline_role_request(
  p_team_space_id uuid,
  p_user_id       uuid
)
RETURNS jsonb AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_row  public.memberships%ROWTYPE;
  v_team text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke innlogget.';
  END IF;
  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere kan behandle forespørsler.';
  END IF;

  SELECT * INTO v_row
  FROM public.memberships
  WHERE user_id = p_user_id AND team_space_id = p_team_space_id
    AND status = 'active' AND managed_child_id IS NULL
    AND requested_role IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'none');
  END IF;

  UPDATE public.memberships SET requested_role = NULL WHERE id = v_row.id;

  SELECT display_name INTO v_team
  FROM public.team_spaces WHERE id = p_team_space_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (p_user_id, p_team_space_id, 'system',
    'Forespørselen ble ikke godkjent',
    'Forespørselen din om å bli trener i «' || COALESCE(v_team, 'laget') ||
      '» ble ikke godkjent denne gangen. Du er fortsatt med som supporter.',
    jsonb_build_object(
      'screen', 'team_members', 'team_space_id', p_team_space_id),
    'membership', v_row.id, now());

  RETURN jsonb_build_object('outcome', 'declined');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_role_request(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION decline_role_request(uuid, uuid) FROM PUBLIC, anon;


-- ============================================================
-- D3) join_team_space v4 — innløserflaten (§5) + portene (§3a/b)
--     + gjenåpningen (§3f-2).
--
-- Signaturen får p_reopen — den gamle 3-args-varianten MÅ droppes,
-- ellers står to overloads og PostgREST nekter å velge.
--
-- Portrekkefølgen er bevisst:
--   1. §3b (fjernet sist → aldri inn via koden — gjelder også
--      LEVENDE lag; en eldre frivillig utmelding gir aldri adgang
--      etter en senere fjerning, «siste episode avgjør»).
--   2. §3a (låst lag = ingen aktiv lagadmin): gjenåpning for
--      kvalifisert tidligere admin, ellers kun frivillig utmeldte
--      tilbake — alle andre henvises til Heia.
--   3. Normal innmelding: lagleder/admin avvises som innløserrolle,
--      «trener» blir supporter + requested_role + varsel til alle
--      aktive lagadmins.
-- Enhver vellykket innmelding nuller dormant_at.
-- ============================================================
DROP FUNCTION IF EXISTS join_team_space(text, text, uuid);

CREATE FUNCTION join_team_space(
  p_invite_code      text,
  p_role             text DEFAULT 'forelder',
  p_managed_child_id uuid DEFAULT NULL,
  p_reopen           boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_space     record;
  v_last      record;
  v_pers      record;
  v_resident  boolean;
  v_role      text;
  v_requested text;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke innlogget.';
  END IF;

  -- §5: koden gir aldri administrative rettigheter direkte.
  IF p_role NOT IN ('trener','forelder','spiller','supporter') THEN
    RAISE EXCEPTION 'Rollen «%» kan ikke velges med invitasjonskode.', p_role;
  END IF;

  IF p_managed_child_id IS NOT NULL AND p_role != 'forelder' THEN
    RAISE EXCEPTION 'Role must be forelder when managed_child_id is set';
  END IF;

  IF p_managed_child_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.managed_children mc
      WHERE mc.id = p_managed_child_id
        AND mc.managed_by = v_uid
    ) THEN
      RAISE EXCEPTION 'Child does not belong to this user';
    END IF;
  END IF;

  SELECT ts.id, ts.display_name
  INTO v_space
  FROM public.team_spaces ts
  WHERE ts.invite_code = upper(p_invite_code)
    AND ts.deleted_at IS NULL
    AND ts.is_activated = true;

  IF v_space IS NULL THEN
    RAISE EXCEPTION 'Ugyldig eller utløpt invitasjonskode.';
  END IF;

  -- Egen historikk i laget: NYESTE rad avgjør (§3b — høyeste
  -- joined_at, id som tiebreak; invited-rader uten joined_at sist).
  SELECT * INTO v_last
  FROM public.memberships
  WHERE user_id = v_uid AND team_space_id = v_space.id
  ORDER BY joined_at DESC NULLS LAST, id DESC
  LIMIT 1;

  -- Bor brukeren alt i laget (aktiv/invitert rad)? Da gjelder ingen
  -- av historikk-portene — hen er ikke en «ukjent kodebruker» (§3a),
  -- og en forelder i et låst lag skal kunne legge til barn nr. 2.
  v_resident := EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_uid AND team_space_id = v_space.id
      AND status IN ('active','invited'));

  -- §3b: siste episode var en fjerning → koden virker ikke, i noe lag.
  IF NOT v_resident AND v_last.id IS NOT NULL AND v_last.status = 'removed'
     AND COALESCE(v_last.left_reason, 'removed') = 'removed' THEN
    RAISE EXCEPTION 'Du ble fjernet fra dette laget. En trener eller lagleder må slippe deg inn igjen.';
  END IF;

  IF NOT has_active_team_admin(v_space.id) THEN
    IF p_reopen THEN
      -- §3f-2: «Gjenåpne laget» — uttrykkelig valg som gjeninnsetter
      -- gammel adminrolle i samme bevisste handling. Myndigheten
      -- leses av nyeste PERSONLIGE rad (§3b): adminrolle + frivillig
      -- utmelding. Barne-rader gir aldri gjenåpningsmyndighet.
      SELECT * INTO v_pers
      FROM public.memberships
      WHERE user_id = v_uid AND team_space_id = v_space.id
        AND managed_child_id IS NULL
      ORDER BY joined_at DESC NULLS LAST, id DESC
      LIMIT 1;

      IF v_pers.id IS NULL OR v_pers.status <> 'removed'
         OR v_pers.left_reason IS DISTINCT FROM 'left'
         OR v_pers.role NOT IN ('trener','lagleder','admin') THEN
        RAISE EXCEPTION 'Bare en tidligere trener eller lagleder som selv meldte seg ut kan gjenåpne laget.';
      END IF;

      INSERT INTO public.memberships (
        user_id, team_space_id, role, status, managed_child_id, joined_at
      ) VALUES (
        v_uid, v_space.id, v_pers.role, 'active', NULL, now()
      )
      RETURNING id INTO v_member_id;

      UPDATE public.team_spaces
      SET dormant_at = NULL
      WHERE id = v_space.id AND dormant_at IS NOT NULL;

      RETURN jsonb_build_object(
        'membership_id', v_member_id,
        'team_space_id', v_space.id,
        'display_name', v_space.display_name,
        'outcome', 'reopened',
        'role', v_pers.role);
    END IF;

    -- §3a: låst lag — kun beboere og brukere hvis siste episode var
    -- en frivillig utmelding slipper inn. Alle andre henvises til Heia.
    IF NOT v_resident
       AND (v_last.id IS NULL OR v_last.status <> 'removed'
            OR v_last.left_reason IS DISTINCT FROM 'left') THEN
      RAISE EXCEPTION 'Dette laget tar ikke imot nye medlemmer akkurat nå. Ta kontakt på hello@heiaapp.no hvis du mener dette er feil.';
    END IF;
  ELSIF p_reopen THEN
    RAISE EXCEPTION 'Laget er allerede i gang — bli med på vanlig måte.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.team_space_id = v_space.id
      AND m.status = 'active'
      AND COALESCE(m.managed_child_id, '00000000-0000-0000-0000-000000000000')
        = COALESCE(p_managed_child_id, '00000000-0000-0000-0000-000000000000')
  ) THEN
    RAISE EXCEPTION 'Du er allerede medlem av laget.';
  END IF;

  -- §5: «Jeg er trener» → aktivt medlemskap som supporter + stående
  -- forespørsel. Rollen gis først når en lagadmin godkjenner.
  v_role := p_role;
  v_requested := NULL;
  IF p_role = 'trener' THEN
    v_role := 'supporter';
    v_requested := 'trener';
  END IF;

  INSERT INTO public.memberships (
    user_id, team_space_id, role, status, managed_child_id, joined_at,
    requested_role
  ) VALUES (
    v_uid, v_space.id, v_role, 'active', p_managed_child_id, now(),
    v_requested
  )
  RETURNING id INTO v_member_id;

  UPDATE public.team_spaces
  SET dormant_at = NULL
  WHERE id = v_space.id AND dormant_at IS NOT NULL;

  -- Varsel til alle aktive lagadmins ved trenerforespørsel (§5).
  -- I et låst lag finnes ingen — forespørselen blir stående, og ops
  -- er fallback-godkjenner (§3f-3).
  IF v_requested IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT DISTINCT m.user_id, v_space.id, 'system',
      'Trenerforespørsel',
      (SELECT p.display_name FROM public.profiles p WHERE p.id = v_uid) ||
        ' vil bli trener i «' || v_space.display_name ||
        '». Godkjenn eller avslå i lagoversikten.',
      jsonb_build_object(
        'screen', 'team_members', 'team_space_id', v_space.id),
      'membership', v_member_id, now()
    FROM public.memberships m
    WHERE m.team_space_id = v_space.id
      AND m.status = 'active'
      AND m.role IN ('trener','lagleder','admin')
      AND m.user_id <> v_uid;
  END IF;

  RETURN jsonb_build_object(
    'membership_id', v_member_id,
    'team_space_id', v_space.id,
    'display_name', v_space.display_name,
    'outcome', 'joined',
    'role', v_role,
    'pending_role', v_requested);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_team_space(text, text, uuid, boolean)
  TO authenticated;
REVOKE ALL ON FUNCTION join_team_space(text, text, uuid, boolean)
  FROM PUBLIC, anon;


-- ============================================================
-- D4) remove_team_member v2 — §3c-sporet på fjerninger:
--     left_reason='removed' + ended_by=administratoren.
--     Ellers identisk 00041 (vaktene står).
-- ============================================================
CREATE OR REPLACE FUNCTION remove_team_member(
  p_team_space_id uuid,
  p_user_id       uuid
)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Only team admins can remove members';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.team_space_id = p_team_space_id
      AND m.status IN ('active','invited')
      AND m.role IN ('trener','lagleder','admin')
  ) THEN
    RAISE EXCEPTION 'Team admins cannot be removed';
  END IF;

  UPDATE public.memberships
  SET status = 'removed', left_at = now(),
      left_reason = 'removed', ended_by = v_uid,
      requested_role = NULL
  WHERE user_id = p_user_id
    AND team_space_id = p_team_space_id
    AND status IN ('active','invited');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  DELETE FROM public.event_rsvps er
  USING public.events e
  WHERE er.event_id = e.id
    AND e.team_space_id = p_team_space_id
    AND er.user_id = p_user_id
    AND e.start_time > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- D5) delete_account_data v4 — dormant-registrering (§3e/§4).
--     Kontosletting er ellers URØRT: GDPR kan aldri nektes,
--     medlemsradene hard-slettes som før, brukerens egne avtaler
--     kanselleres av Edge Function-en FØR dette kallet. Laget blir
--     dormant, aldri nedlagt.
-- ============================================================
CREATE OR REPLACE FUNCTION delete_account_data(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_profile record;
  v_entity  uuid;
  v_teams   uuid[];
  v_ts      uuid;
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

  -- Lagene brukeren er aktiv i — leses FØR radene slettes, for
  -- dormant-registreringen etterpå (§3e: kan ikke utledes i ettertid).
  SELECT COALESCE(array_agg(DISTINCT team_space_id), '{}')
  INTO v_teams
  FROM public.memberships
  WHERE user_id = p_user_id AND status = 'active';

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

  -- Lag som ble stående uten aktive medlemmer: registrer dormant og
  -- varsle ops når laget har innhold eller avtaler (§3e). Aldri
  -- sletting — laget består som beholder.
  FOREACH v_ts IN ARRAY v_teams LOOP
    PERFORM register_team_dormant_if_empty(
      v_ts, 'siste medlem slettet kontoen sin');
  END LOOP;

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
-- E1) get_team_members v2 — + requested_role, så lagoversikten kan
--     vise og behandle trenerforespørsler. Ny kolonne i RETURNS
--     TABLE = DROP + CREATE + gjenskapte 00060-grants (00061-lærdommen).
-- ============================================================
DROP FUNCTION IF EXISTS get_team_members(uuid);

CREATE FUNCTION get_team_members(ts_id uuid)
RETURNS TABLE (
  membership_id    uuid,
  user_id          uuid,
  display_name     text,
  avatar_url       text,
  role             text,
  status           text,
  joined_at        timestamptz,
  managed_child_id uuid,
  child_name       text,
  phone            text,
  requested_role   text
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_is_admin := is_team_admin(ts_id);

  RETURN QUERY
  SELECT
    m.id AS membership_id,
    m.user_id,
    p.display_name,
    p.avatar_url,
    m.role,
    m.status,
    m.joined_at,
    m.managed_child_id,
    mc.display_name AS child_name,
    CASE
      WHEN m.user_id = auth.uid() THEN p.phone
      WHEN v_is_admin AND m.role <> 'spiller' THEN p.phone
      ELSE NULL
    END AS phone,
    m.requested_role
  FROM public.memberships m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.managed_children mc ON mc.id = m.managed_child_id
  WHERE m.team_space_id = ts_id
    AND m.status IN ('active', 'invited')
  ORDER BY
    CASE m.role
      WHEN 'trener' THEN 1
      WHEN 'lagleder' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'forelder' THEN 4
      WHEN 'spiller' THEN 5
      WHEN 'supporter' THEN 6
    END,
    p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION get_team_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_members(uuid) TO authenticated;


-- ============================================================
-- E2) get_team_authors — forfatter-oppslaget som overlever
--     utmelding (§2: «innhold slettes aldri, forfatterskap består»).
--
-- Kommentarfeltet slo opp navn/avatar via get_team_members, som kun
-- returnerer levende medlemmer — en utmeldt forfatters kommentarer
-- mistet navn og avatar. Denne returnerer ÉN rad per person som
-- NOEN GANG har hatt en medlemsrad i laget: kun navn/avatar/rolle —
-- aldri telefon, barn eller status (historikk-lesing av andres rader
-- er ellers strammet inn i 00066, og det skal den forbli).
-- Radvalget per person: aktiv først, så personlig rad, så nyeste.
-- ============================================================
CREATE OR REPLACE FUNCTION get_team_authors(ts_id uuid)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  role         text
) AS $$
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    p.display_name,
    p.avatar_url,
    m.role
  FROM public.memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.team_space_id = ts_id
  ORDER BY m.user_id,
    (m.status = 'active') DESC,
    (m.managed_child_id IS NULL) DESC,
    m.joined_at DESC NULLS LAST,
    m.id DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION get_team_authors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_authors(uuid) TO authenticated;


-- ============================================================
-- E3) lookup_invite_code v4 — + has_active_admin (§3a/§3f-UX:en).
--
-- Appen trenger å vite FØR innmelding om laget er låst (ingen aktiv
-- lagadmin): da kan den vise «Gjenåpne laget» for kvalifiserte og en
-- ærlig forklaring for alle andre, i stedet for å la porten i
-- join_team_space være første beskjed. At et lag står uten aktiv
-- admin er samme opplysningsklasse som medlemstallet funksjonen
-- allerede deler — og porten selv håndheves uansett server-side.
-- Ellers identisk 00050 (fortsatt bevisst anon — 00060-notatet står).
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_invite_code(code text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ts.id,
    'display_name', ts.display_name,
    'color', ts.color,
    'logo_url', coalesce(ts.logo_url, c.logo_url),
    'club_name', c.name,
    'sport', s.slug,
    'member_count', (
      SELECT count(*) FROM public.memberships m
      WHERE m.team_space_id = ts.id AND m.status = 'active'
    ),
    'has_active_admin', has_active_team_admin(ts.id)
  ) INTO result
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.sports s ON s.id = t.sport_id
  WHERE ts.invite_code = upper(code)
    AND ts.deleted_at IS NULL
    AND ts.is_activated = true;

  RETURN result; -- null if not found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- E4) get_club_payments_overview — + dormant_at på lagradene
--     (§3e-innsynet/§3f-4: betalingsansvarlig får dormant-markering,
--     aldri myndighet over laginnhold). Ellers identisk 00065.
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
            -- §3e: dormant-markeringen — innsyn, aldri myndighet.
            'dormant_at', ts.dormant_at,
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
                -- KARENSTID (00065): Stripe-kallet er asynkront, og cancel_at
                -- skrives av WEBHOOKEN et par sekunder senere. Uten en frist
                -- her ropte flaten «Deaktiveringen ble ikke fullført» i det
                -- normale vinduet rett etter et VELLYKKET kall — dogfood
                -- 2026-08-19: boksen sto til brukeren dro ned og oppdaterte.
                -- Et varsel som er sant i noen sekunder hver eneste gang er
                -- ikke et varsel, det er støy — og her er støyen «foreldrene
                -- trekkes fortsatt penger», det verst tenkelige å rope ulv om.
                -- 5 minutter dekker webhook-forsinkelse OG Stripes retry.
                SELECT la2.action FROM public.team_support_actions la2
                WHERE la2.team_space_id = ts.id
                  AND la2.action IN ('pause','deactivate','approve')
                  AND la2.created_at < now() - interval '5 minutes'
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
