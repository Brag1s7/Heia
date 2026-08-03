-- ============================================================
-- 00047 — KLUBBDØREN: klubbgodkjenning av lag (låst 2026-08-03,
-- PAYMENTS.md §Åpne beslutninger «KLUBBDØREN»).
--
-- Tre-porter-modellen:
--   personen er autorisert av klubben (claim-review = autorisasjonen)
--   + klubben er godkjent av Stripe/KYC (kontostatus fra webhooks)
--   + det konkrete laget er godkjent av betalingsansvarlig (denne fila)
--   = laget kan samle inn støtte.
--
-- Rollen heter BETALINGSANSVARLIG. Ingen får den automatisk — første
-- hovedansvarlige backfilles fra den godkjente claim-reviewen (seedet
-- nederst; ALDRI mekanisk fra claims-raden — 00046-funnet: claimanten
-- kan være en testkonto). Senere ansvarlige inviteres av eksisterende
-- hovedansvarlig; invitasjonsflaten er en senere skive — inntil da
-- seeder ops nye ansvarlige (PAYMENTS.md pkt. 1).
--
-- Prisinvarianten står: klubbens standardtilbud er DATA i
-- club_support_defaults (deny-by-default), seedet av Heia ved
-- klubbgodkjenning. Betalingsansvarlig ser/velger ALDRI pris.
-- create_support_offering forblir ops-only — godkjenningsstien
-- kaller den internt (SECURITY DEFINER kjører som eier), så
-- versjonering/arkivering/advisory-lås deles, aldri dupliseres.
--
-- Varsler er notifications-rader (00023-idiomet — inbox virker uten
-- APNs; push følger gratis når nøkkelen settes). Varsler til
-- betalingsansvarlig er GLOBALE (team_space_id NULL): ansvarlig er
-- ikke nødvendigvis medlem av laget som spør.
-- ============================================================


-- ============================================================
-- 1) club_payment_managers — betalingsansvarlig-rollen.
-- ============================================================
CREATE TABLE public.club_payment_managers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Sporet inn: claim-backfill (autorisert representant), ops-seed
  -- eller (senere skive) invitasjon fra eksisterende hovedansvarlig.
  source     text NOT NULL DEFAULT 'ops'
               CHECK (source IN ('claim_backfill','ops','invite')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (club_id, user_id)
);

CREATE INDEX idx_club_payment_managers_user
  ON public.club_payment_managers (user_id);

ALTER TABLE public.club_payment_managers ENABLE ROW LEVEL SECURITY;
-- Ingen policies = deny all. Lesing skjer gjennom RPC-ene under.

CREATE OR REPLACE FUNCTION is_club_payment_manager(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profil-raden trenger et billig «er jeg betalingsansvarlig et sted?».
CREATE OR REPLACE FUNCTION is_payment_manager_anywhere()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_payment_managers WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_club_payment_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_payment_manager_anywhere() TO authenticated;
REVOKE ALL ON FUNCTION is_club_payment_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_payment_manager_anywhere() FROM PUBLIC, anon;


-- ============================================================
-- 2) club_support_defaults — klubbens standardtilbud (79/60) som
-- DATA. Seedet av Heia ved klubbgodkjenning; laget ARVER dette ved
-- godkjenning. CHECK-hygienen speiler support_offerings (00037).
-- ============================================================
CREATE TABLE public.club_support_defaults (
  club_id          uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  amount_minor     int  NOT NULL CHECK (amount_minor > 0),
  currency         text NOT NULL DEFAULT 'nok' CHECK (currency ~ '^[a-z]{3}$'),
  billing_interval text NOT NULL DEFAULT 'month'
                     CHECK (billing_interval IN ('month')),
  fee_model        text NOT NULL
                     CHECK (fee_model IN ('bps','fixed_club_amount')),
  fee_bps          int  NOT NULL CHECK (fee_bps BETWEEN 0 AND 10000),
  club_fixed_minor int  CHECK (club_fixed_minor > 0),
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (fee_model = 'bps' AND club_fixed_minor IS NULL)
    OR (fee_model = 'fixed_club_amount'
        AND club_fixed_minor IS NOT NULL
        AND club_fixed_minor < amount_minor)
  )
);

CREATE TRIGGER set_club_support_defaults_updated_at
  BEFORE UPDATE ON public.club_support_defaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.club_support_defaults ENABLE ROW LEVEL SECURITY;
-- Deny all — splitten forlater aldri serveren (00037-invarianten).


-- ============================================================
-- 3) team_support_approvals — godkjenninger er RADER (hvem/når/
-- status/note). Maks én åpen per lag; avslag krever begrunnelse
-- som treneren ser. + team_support_actions: append-only logg over
-- ALLE dørhandlinger (request/approve/reject/pause/deactivate).
-- ============================================================
CREATE TABLE public.team_support_approvals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_space_id         uuid NOT NULL REFERENCES public.team_spaces(id),
  -- Denormalisert for ansvarlig-oppslaget (lag→klubb-kjeden er stabil).
  club_id               uuid NOT NULL REFERENCES public.clubs(id),
  requested_by          uuid NOT NULL REFERENCES public.profiles(id),
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  decided_by            uuid REFERENCES public.profiles(id),
  decided_at            timestamptz,
  -- Avslagsbegrunnelsen — påkrevd i RPC-en, treneren ser den i appen.
  note                  text,
  resulting_offering_id uuid REFERENCES public.support_offerings(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_team_support_approvals_one_open
  ON public.team_support_approvals (team_space_id)
  WHERE status = 'pending';

CREATE INDEX idx_team_support_approvals_club
  ON public.team_support_approvals (club_id, status);
CREATE INDEX idx_team_support_approvals_team
  ON public.team_support_approvals (team_space_id, created_at DESC);

ALTER TABLE public.team_support_approvals ENABLE ROW LEVEL SECURITY;
-- Deny all — leses gjennom get_club_payments_overview /
-- get_support_activation_status.

CREATE TABLE public.team_support_actions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                uuid NOT NULL REFERENCES public.clubs(id),
  team_space_id          uuid NOT NULL REFERENCES public.team_spaces(id),
  approval_id            uuid REFERENCES public.team_support_approvals(id),
  action                 text NOT NULL
    CHECK (action IN ('request','approve','reject','pause','deactivate')),
  actor_user_id          uuid NOT NULL REFERENCES public.profiles(id),
  note                   text,
  -- Antall levende abonnementer i handlingsøyeblikket (pause/deaktiver
  -- viser tallet i bekreftelsesdialogen — her er det bokført).
  affected_subscriptions int,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_support_actions_club
  ON public.team_support_actions (club_id, created_at DESC);

ALTER TABLE public.team_support_actions ENABLE ROW LEVEL SECURITY;
-- Deny all. Append-only (gjenbruker forbid_mutation fra 00046).
CREATE TRIGGER trg_team_support_actions_immutable
  BEFORE UPDATE OR DELETE ON public.team_support_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();


-- ============================================================
-- 4) Intern hjelper: levende abonnementer for et lag (active +
-- past_due — past_due er fortsatt en løpende avtale hos Stripe).
-- ============================================================
CREATE OR REPLACE FUNCTION team_live_subscription_count(ts_id uuid)
RETURNS int AS $$
  SELECT count(*)::int FROM public.support_subscriptions
  WHERE team_space_id = ts_id AND status IN ('active','past_due');
$$ LANGUAGE sql STABLE;

REVOKE ALL ON FUNCTION team_live_subscription_count(uuid)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5) request_team_support_approval — lagadmin ber om godkjenning.
-- Null friksjon: ingenting nytt å fylle ut; forespørselskortet hos
-- betalingsansvarlig viser kun eksisterende data.
-- ============================================================
CREATE OR REPLACE FUNCTION request_team_support_approval(ts_id uuid)
RETURNS uuid AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_club_id   uuid;
  v_team_name text;
  v_id        uuid;
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

  -- Port 1+2 må være åpnet først: klubben er godkjent og koblet.
  IF NOT EXISTS (
    SELECT 1 FROM public.club_legal_entity_links l
    WHERE l.club_id = v_club_id AND l.status = 'active'
  ) THEN
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

  -- Varsle alle betalingsansvarlige i klubben. GLOBALT varsel
  -- (team_space_id NULL): ansvarlig er ikke nødvendigvis medlem av
  -- laget som spør, og inboxen er lag-scopet med null-gren.
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
  WHERE m.club_id = v_club_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6) get_club_payments_overview — hele «Klubbbetalinger»-flaten i
-- ett kall. NULL for ikke-ansvarlige (probe-vernet). Forespørsels-
-- kortet viser KUN eksisterende data (lagnavn, årskull/kjønn, hvem
-- som spør, antall medlemmer) — aldri pris.
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
    SELECT COALESCE(jsonb_agg(club_obj ORDER BY club_name), '[]'::jsonb)
    FROM (
      SELECT c.name AS club_name, jsonb_build_object(
        'club', jsonb_build_object('id', c.id, 'name', c.name),
        'entity', (
          SELECT jsonb_build_object(
            'legal_name', e.legal_name, 'org_number', e.org_number)
          FROM public.club_legal_entity_links l
          JOIN public.legal_club_entities e ON e.id = l.legal_club_entity_id
          WHERE l.club_id = c.id AND l.status = 'active'
        ),
        'account', (
          SELECT jsonb_build_object(
            'status', cpa.status, 'charges_enabled', cpa.charges_enabled)
          FROM public.club_legal_entity_links l
          JOIN public.club_payment_accounts cpa
            ON cpa.legal_club_entity_id = l.legal_club_entity_id
           AND cpa.provider = 'stripe'
          WHERE l.club_id = c.id AND l.status = 'active'
        ),
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
          WHERE a.club_id = c.id AND a.status = 'pending'
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
            'live_subscriptions', team_live_subscription_count(ts.id)
          ) ORDER BY ts.display_name), '[]'::jsonb)
          FROM public.teams t
          JOIN public.team_spaces ts ON ts.team_id = t.id
          WHERE t.club_id = c.id
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
            JOIN public.team_spaces ts2 ON ts2.id = act.team_space_id
            JOIN public.profiles p2 ON p2.id = act.actor_user_id
            WHERE act.club_id = c.id
            ORDER BY act.created_at DESC
            LIMIT 20
          ) x
        )
      ) AS club_obj
      FROM public.clubs c
      JOIN public.club_payment_managers m
        ON m.club_id = c.id AND m.user_id = v_uid
    ) clubs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 7) approve_team_support — ett trykk «Godkjenn»: laget ARVER
-- klubbens standardtilbud og offering v1 opprettes i SAMME
-- transaksjon (via create_support_offering — delt mekanikk:
-- advisory-lås, arkiver + ny versjon; funksjonen er fortsatt
-- ops-only utenfra).
-- ============================================================
CREATE OR REPLACE FUNCTION approve_team_support(p_approval_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_approval  public.team_support_approvals%ROWTYPE;
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

  -- Klubben må fortsatt være koblet (port 1+2 kan i teorien ha
  -- blitt lukket siden forespørselen kom).
  IF NOT EXISTS (
    SELECT 1 FROM public.club_legal_entity_links l
    WHERE l.club_id = v_approval.club_id AND l.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Klubben er ikke lenger aktivert for støtte.';
  END IF;

  SELECT * INTO v_defaults
  FROM public.club_support_defaults
  WHERE club_id = v_approval.club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klubben mangler standardtilbud fra Heia — kontakt hello@heiaapp.no.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_offerings
    WHERE team_space_id = v_approval.team_space_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Laget samler allerede inn støtte.';
  END IF;

  -- Delt mekanikk: SECURITY DEFINER kjører som eier, så ops-REVOKE-en
  -- på create_support_offering gjelder ikke her. Prisen er klubbens
  -- standardtilbud — betalingsansvarlig har aldri sett eller valgt den.
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

  -- Treneren som spurte får beskjed — lag-scopet varsel.
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
-- 8) reject_team_support — avslag KREVER begrunnelse (treneren ser
-- den i appen — samme mønster som claim-avslag).
-- ============================================================
CREATE OR REPLACE FUNCTION reject_team_support(
  p_approval_id uuid,
  p_note        text
)
RETURNS void AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_note     text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_approval public.team_support_approvals%ROWTYPE;
  v_team_name text;
BEGIN
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'Avslag krever en begrunnelse — treneren ser den i appen.';
  END IF;

  SELECT * INTO v_approval
  FROM public.team_support_approvals
  WHERE id = p_approval_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke forespørselen.';
  END IF;
  IF v_uid IS NULL OR NOT is_club_payment_manager(v_approval.club_id) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan avslå lag.';
  END IF;
  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'Forespørselen er allerede behandlet.';
  END IF;

  UPDATE public.team_support_approvals SET
    status = 'rejected',
    decided_by = v_uid,
    decided_at = now(),
    note = v_note
  WHERE id = p_approval_id;

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, approval_id, action, actor_user_id, note)
  VALUES (v_approval.club_id, v_approval.team_space_id, p_approval_id,
          'reject', v_uid, v_note);

  SELECT display_name INTO v_team_name
  FROM public.team_spaces WHERE id = v_approval.team_space_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  VALUES (
    v_approval.requested_by, v_approval.team_space_id, 'system',
    'Forespørselen ble ikke godkjent',
    'Klubbens betalingsansvarlige godkjente ikke «' || v_team_name ||
      '»: ' || v_note,
    jsonb_build_object(
      'screen', 'support_setup',
      'team_space_id', v_approval.team_space_id
    ),
    'team_support_approval', p_approval_id, now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 9) pause_team_support — «Pause nye støttespillere»: offeringen
-- arkiveres (nye checkouts stoppes — stripe-checkout finner ingen
-- aktiv offering), EKSISTERENDE abonnementer fortsetter urørt.
-- Presist språk, aldri «revoke» (låst). Reaktivering = laget ber
-- om godkjenning på nytt (ny versjon arves da automatisk).
-- ============================================================
CREATE OR REPLACE FUNCTION pause_team_support(
  ts_id  uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_club_id uuid;
  v_count   int;
BEGIN
  SELECT t.club_id INTO v_club_id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = ts_id;

  IF v_uid IS NULL OR v_club_id IS NULL
     OR NOT is_club_payment_manager(v_club_id) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan pause støtte.';
  END IF;

  -- Samme lås som create_support_offering — pause og godkjenning
  -- serialiseres per lag.
  PERFORM pg_advisory_xact_lock(hashtext('support_offering'), hashtext(ts_id::text));

  UPDATE public.support_offerings
  SET status = 'archived'
  WHERE team_space_id = ts_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laget har ingen aktiv støtte å pause.';
  END IF;

  v_count := team_live_subscription_count(ts_id);

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, action, actor_user_id, note,
     affected_subscriptions)
  VALUES (v_club_id, ts_id, 'pause', v_uid,
          NULLIF(trim(COALESCE(p_note, '')), ''), v_count);

  RETURN jsonb_build_object('live_subscriptions', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 10) deactivate_team_support_data — DB-siden av «Deaktiver støtte
-- for laget». SERVICE ROLE ONLY: Stripe-kallene
-- (cancel_at_period_end per abonnement) bor i Edge Function
-- club-support-deactivate, som kaller hit FØRST (nye checkouts
-- stoppes atomisk) og deretter kansellerer hos Stripe — webhookene
-- bokfører cancel_at som vanlig. Idempotent: alt-arkivert offering
-- hoppes over, og listen returneres på nytt til retry.
-- ============================================================
CREATE OR REPLACE FUNCTION deactivate_team_support_data(
  p_team_space_id uuid,
  p_actor_user_id uuid,
  p_note          text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_club_id uuid;
  v_subs    text[];
BEGIN
  SELECT t.club_id INTO v_club_id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_space_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Fant ikke laget.';
  END IF;

  -- Forsvaret i dybden: Edge Function-en har autentisert brukeren,
  -- men rollen sjekkes også her.
  IF NOT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE club_id = v_club_id AND user_id = p_actor_user_id
  ) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan deaktivere støtte.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('support_offering'), hashtext(p_team_space_id::text));

  -- Arkiver hvis aktiv — deaktivering skal også virke på et alt
  -- pauset lag med løpende abonnementer.
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
-- Rettigheter — 00046-lærdommen: REVOKE må ta PUBLIC også, anon
-- arver PUBLIC-granten funksjoner fødes med.
-- ============================================================
GRANT EXECUTE ON FUNCTION request_team_support_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_club_payments_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_team_support(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_team_support(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION pause_team_support(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION request_team_support_approval(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_club_payments_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION approve_team_support(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reject_team_support(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pause_team_support(uuid, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION deactivate_team_support_data(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION deactivate_team_support_data(uuid, uuid, text)
  TO service_role;


-- ============================================================
-- 11) get_support_activation_status — utvidet med lagets dør-
-- tilstand ('team') + 'is_payment_manager' (kontekstuell snarvei i
-- Laginnstillinger/SupportSetup). Ellers uendret fra 00046.
-- ============================================================
CREATE OR REPLACE FUNCTION get_support_activation_status(ts_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_club_id uuid;
  v_club_name text;
  v_entity  record;
  v_claim   record;
  v_team    jsonb;
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

  -- Lagets dør-tilstand (samme avledning som get_club_payments_overview).
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
      'claim', NULL,
      'team', v_team,
      'is_payment_manager', is_club_payment_manager(v_club_id)
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
      'is_payment_manager', is_club_payment_manager(v_club_id)
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
    'is_payment_manager', is_club_payment_manager(v_club_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- 12) Kontosletting rydder rollen — anonymiserte spøkelser skal
-- ALDRI beholde godkjenningsmakt (låst; ops kan alltid seede en ny
-- ansvarlig). Resten av funksjonen er uendret fra 00042.
-- ============================================================
CREATE OR REPLACE FUNCTION delete_account_data(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_profile record;
BEGIN
  SELECT p.id, p.deleted_at
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Idempotent: feiler auth-slettingen i Edge Function-en, skal et
  -- nytt forsøk gli rett gjennom hit uten å røre noe på nytt.
  IF v_profile.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Anonymiseringen først (rekkefølgen er likegyldig for atomikken,
  -- men household-oppryddingen under sjekker profiles.household_id
  -- og skal ikke se vår egen peker).
  UPDATE public.profiles
  SET display_name = 'Slettet bruker',
      avatar_url   = NULL,
      phone        = NULL,
      household_id = NULL,
      deleted_at   = now()
  WHERE id = p_user_id;

  -- RSVP-ene (alle — historikk med navn på er personopplysning;
  -- «N kommer»-tellerne på gamle hendelser får tåle det).
  DELETE FROM public.event_rsvps WHERE user_id = p_user_id;

  -- Medlemskapene: HARD delete, ikke status='removed' — kontosletting
  -- er GDPR, ikke moderasjon. Barnas rader har user_id = forelderen,
  -- så de følger med her.
  DELETE FROM public.memberships WHERE user_id = p_user_id;

  -- Forvaltede barn (navn + fødselsår = barne-PII). Cascade tar
  -- barnas RSVP-er; andre foreldres memberships-pekere blir NULL.
  DELETE FROM public.managed_children WHERE managed_by = p_user_id;

  -- Husstanden: egen medlemsrad ut; husstander brukeren opprettet
  -- slettes når de står helt tomme igjen (navnet kan være PII —
  -- «Familien …»). Har andre fortsatt et bein der, består raden og
  -- created_by peker på det anonymiserte spøkelset.
  DELETE FROM public.household_members WHERE profile_id = p_user_id;
  DELETE FROM public.households h
  WHERE h.created_by = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.household_members hm WHERE hm.household_id = h.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.managed_children mc WHERE mc.household_id = h.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.household_id = h.id);

  -- Enheter, push og varsler.
  DELETE FROM public.user_devices WHERE user_id = p_user_id;
  DELETE FROM public.device_tokens WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;

  -- Betalingsansvarlig-rollen (00047): spøkelser beholder aldri
  -- godkjenningsmakt. Approval-/actions-radene består (peker på
  -- det anonymiserte spøkelset — revisjonshistorikk, som claims).
  DELETE FROM public.club_payment_managers WHERE user_id = p_user_id;

  -- Reaksjoner er aktivitetsdata, ikke laginnhold — slettes.
  -- Innlegg/kommentarer/kampdata består (se headeren); det samme
  -- gjør content_reports (frossen moderasjonshistorikk), audit_log,
  -- club_claims og HELE payment-domenet — alle peker nå på et
  -- anonymt spøkelse.
  DELETE FROM public.reactions WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account_data(uuid) TO service_role;


-- ============================================================
-- 13) Seed/backfill.
--
-- a) Standardtilbudet: for hver klubb med aktiv kobling kopieres
--    klubbens nyeste AKTIVE offering (Ridabu: fast-60-v2). Nye
--    klubber seedes av Heia ved godkjenning (ops-runbooken).
-- b) Betalingsansvarlig for Ridabu: Brage — backfillet fra den
--    godkjente claim-REVIEWEN, slått opp på e-post (00046-funnet:
--    claimant-raden er en testkonto; aldri seed makt fra claims).
--    Telefonkontoen (s2212930@bi.no) er med for TestFlight-dogfood
--    og fjernes med en DELETE når dogfooden er over.
-- ============================================================
INSERT INTO public.club_support_defaults
  (club_id, amount_minor, currency, billing_interval, fee_model,
   fee_bps, club_fixed_minor, note)
SELECT DISTINCT ON (l.club_id)
  l.club_id, o.amount_minor, o.currency, o.billing_interval, o.fee_model,
  o.fee_bps, o.club_fixed_minor,
  'Backfill 00047 — kopiert fra klubbens aktive offering'
FROM public.club_legal_entity_links l
JOIN public.teams t ON t.club_id = l.club_id
JOIN public.team_spaces ts ON ts.team_id = t.id
JOIN public.support_offerings o
  ON o.team_space_id = ts.id AND o.status = 'active'
WHERE l.status = 'active'
ORDER BY l.club_id, o.created_at DESC;

INSERT INTO public.club_payment_managers (club_id, user_id, source, note)
SELECT l.club_id, u.id, 'claim_backfill',
  CASE u.email
    WHEN 'brage.lothe.weium@gmail.com'
      THEN 'Brage — autorisert representant (godkjent claim-review)'
    ELSE 'Dogfood-telefonkonto — FJERNES etter klubbdør-testen'
  END
FROM public.club_legal_entity_links l
CROSS JOIN auth.users u
WHERE l.status = 'active'
  AND u.email IN ('brage.lothe.weium@gmail.com', 's2212930@bi.no')
ON CONFLICT (club_id, user_id) DO NOTHING;
