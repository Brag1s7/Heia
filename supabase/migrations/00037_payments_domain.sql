-- ============================================================
-- 00037_payments_domain.sql
-- FASE 1: Betalingsdomenet (Heia Supporter).
--
-- Grunnlag: beslutningsboken (godkjent 2026-08-01) + fase 0-
-- sandbox-spiken (alle 16 bevispunkter bevist samme dag).
-- Se docs/PAYMENTS.md for hele beslutningsgrunnlaget.
--
-- Modellen i én setning: clubs er en SOSIAL oppføring (fritekst,
-- duplikater tolereres); den juridiske organisasjonen (orgnr) er
-- legal_club_entities; betalingskapabiliteten bor på
-- club_payment_accounts per juridisk enhet og provider; lagene
-- arver den via kjeden
--   team_space → team → club → (aktiv link) → legal_entity
--     → payment_account.
-- Pengekjeden: user → payment_customers → support_subscriptions
--   → payment_transactions (frossen økonomi per trekk).
--
-- Harde invariants som håndheves HER (ikke i appkode):
--   * ett orgnr = én juridisk enhet (UNIQUE)
--   * én clubs-rad → maks én AKTIV juridisk enhet (partiell unik)
--   * én juridisk enhet → maks én konto per provider (UNIQUE)
--   * én aktiv støtteavtale per (bruker, lag) (partiell unik)
--   * offerings er VERSJONERTE og økonomisk immutable (trigger)
--   * transaksjoner er append-only, beløp kan aldri endres (trigger)
--   * webhook-events er unike per (provider, event_id)
--
-- RLS-filosofi: deny-by-default. KUN to smale klient-SELECT-er
-- (egne abonnementer, egne claims). Alt annet går via SECURITY
-- DEFINER-RPC-er som kommer i fase 3–5 — bl.a. fordi
-- support_offerings bærer splitten (ulåst kommersiell beslutning,
-- skal ikke leses rått av klienter) og club_payment_accounts
-- bærer requirements-payload fra Stripe.
--
-- Ingen pris eller split er hardkodet noe sted — offerings er data.
-- ============================================================


-- ============================================================
-- 1) legal_club_entities — organisasjonen bak klubben(e)
-- verification_status er HEIAS kontroll (orgnr + representasjon,
-- manuell i MVP). Stripes KYC-status bor på kontoen — to felter,
-- to betydninger, blandes aldri (beslutningsbok §3).
-- ============================================================
CREATE TABLE public.legal_club_entities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_number          text NOT NULL UNIQUE
                        CHECK (org_number ~ '^[0-9]{9}$'),
  legal_name          text NOT NULL,
  country             text NOT NULL DEFAULT 'NO',
  verification_status text NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN ('unverified','verified','revoked')),
  verified_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_legal_club_entities_updated_at
  BEFORE UPDATE ON public.legal_club_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2) club_claims — aktiveringsforespørsel + manuell review.
-- Opprettes av lagadmin via RPC (fase 3). Godkjenning (Heia,
-- service role) skaper juridisk enhet + link + konto i én
-- transaksjon. resulting_legal_entity_id settes ved godkjenning.
-- ============================================================
CREATE TABLE public.club_claims (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                    uuid NOT NULL REFERENCES public.clubs(id),
  claimed_org_number         text NOT NULL
                               CHECK (claimed_org_number ~ '^[0-9]{9}$'),
  claimed_legal_name         text NOT NULL,
  claimant_user_id           uuid NOT NULL REFERENCES public.profiles(id),
  claimed_role               text NOT NULL,
  contact_email              text,
  contact_phone              text,
  status                     text NOT NULL DEFAULT 'submitted'
                               CHECK (status IN ('submitted','in_review','approved','rejected','expired')),
  reviewed_by                uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at                timestamptz,
  review_note                text,
  resulting_legal_entity_id  uuid REFERENCES public.legal_club_entities(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_claims_club ON public.club_claims (club_id);
CREATE INDEX idx_club_claims_status ON public.club_claims (status)
  WHERE status IN ('submitted','in_review');

CREATE TRIGGER set_club_claims_updated_at
  BEFORE UPDATE ON public.club_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 3) club_legal_entity_links — N:1-koblingen.
-- Flere clubs-rader (duplikater: «Ridabu IL», «Ridabu») kan peke
-- på SAMME juridiske enhet, men én clubs-rad har maks ÉN aktiv
-- link (partiell unik). Allianseidrettslag (én oppføring, flere
-- orgnr) løses operasjonelt i reviewen: splitt/flytt FØR kobling.
-- ============================================================
CREATE TABLE public.club_legal_entity_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id),
  legal_club_entity_id  uuid NOT NULL REFERENCES public.legal_club_entities(id),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','ended')),
  claim_id              uuid REFERENCES public.club_claims(id),
  linked_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ended_at              timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Invarianten: én sosial klubb → maks én aktiv juridisk enhet.
CREATE UNIQUE INDEX idx_club_links_one_active_per_club
  ON public.club_legal_entity_links (club_id)
  WHERE status = 'active';

CREATE INDEX idx_club_links_entity
  ON public.club_legal_entity_links (legal_club_entity_id);


-- ============================================================
-- 4) club_payment_accounts — betalingskonto per juridisk enhet
-- og provider. Status drives UTELUKKENDE av provider-webhooks
-- (account.updated) — aldri av klientkall (fase 2).
-- Hard UNIQUE per (enhet, provider): å erstatte en disabled konto
-- er en bevisst manuell operasjon, ikke en ny rad i farta.
-- ============================================================
CREATE TABLE public.club_payment_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_club_entity_id  uuid NOT NULL REFERENCES public.legal_club_entities(id),
  provider              text NOT NULL DEFAULT 'stripe'
                          CHECK (provider IN ('stripe')),
  provider_account_id   text,
  status                text NOT NULL DEFAULT 'pending_onboarding'
                          CHECK (status IN ('pending_onboarding','onboarding_started','active','restricted','disabled')),
  charges_enabled       boolean NOT NULL DEFAULT false,
  payouts_enabled       boolean NOT NULL DEFAULT false,
  requirements          jsonb NOT NULL DEFAULT '{}',
  initiated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (legal_club_entity_id, provider)
);

CREATE UNIQUE INDEX idx_payment_accounts_provider_id
  ON public.club_payment_accounts (provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL;

CREATE TRIGGER set_club_payment_accounts_updated_at
  BEFORE UPDATE ON public.club_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 5) support_offerings — VERSJONERT pris-/splitkonfig per lag.
--
-- LÅST invariant: økonomisk immutable. Endret pris/split = NY
-- versjon (version + 1); eksisterende abonnementer beholder sin
-- offering med mindre de migreres EKSPLISITT (fase 0 / P16:
-- teknisk mulig hos Stripe, gjelder fra neste faktura — reservert
-- varslede kampanjer). Triggeren under håndhever immutabiliteten
-- også mot service role (triggere bypasses ikke av RLS-fritak).
--
-- fee_bps er ALLTID satt og er det som sendes til Stripe
-- (application_fee_percent = fee_bps / 100.0 — bps gir nøyaktig
-- Stripes to desimaler). Ved fee_model='fixed_club_amount'
-- dokumenterer club_fixed_minor intensjonen (f.eks. 6000 øre av
-- 7900), og fee_bps er den DERIVERTE prosenten hvis avrunding må
-- verifiseres per prispunkt (fase 0: 2405 bps × 7900 øre rundet
-- OPP til 1900 — stemmer for 79 kr, IKKE garantert for andre).
-- 75/25 vs fast 60 er en ULÅST kommersiell beslutning — derfor
-- finnes begge modellene som data, og ingenting er hardkodet.
-- ============================================================
CREATE TABLE public.support_offerings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_space_id        uuid NOT NULL REFERENCES public.team_spaces(id),
  version              int  NOT NULL CHECK (version >= 1),
  amount_minor         int  NOT NULL CHECK (amount_minor > 0),
  currency             text NOT NULL DEFAULT 'nok'
                         CHECK (currency ~ '^[a-z]{3}$'),
  billing_interval     text NOT NULL DEFAULT 'month'
                         CHECK (billing_interval IN ('month')),
  fee_model            text NOT NULL
                         CHECK (fee_model IN ('bps','fixed_club_amount')),
  fee_bps              int  NOT NULL CHECK (fee_bps BETWEEN 0 AND 10000),
  club_fixed_minor     int  CHECK (club_fixed_minor > 0),
  provider             text NOT NULL DEFAULT 'stripe'
                         CHECK (provider IN ('stripe')),
  provider_product_id  text,
  provider_price_id    text,
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','archived')),
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (team_space_id, version),

  -- fixed-modellen krever dokumentert fast klubbandel < brutto;
  -- bps-modellen skal IKKE bære et (villedende) fastbeløp
  CHECK (
    (fee_model = 'bps' AND club_fixed_minor IS NULL)
    OR (fee_model = 'fixed_club_amount'
        AND club_fixed_minor IS NOT NULL
        AND club_fixed_minor < amount_minor)
  )
);

-- Maks én aktiv offering per lag — nyeste versjon er den som gjelder.
CREATE UNIQUE INDEX idx_support_offerings_one_active
  ON public.support_offerings (team_space_id)
  WHERE status = 'active';

CREATE TRIGGER set_support_offerings_updated_at
  BEFORE UPDATE ON public.support_offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Immutability-vakten: økonomifeltene og identiteten er frosset
-- etter INSERT. provider_product_id/provider_price_id kan settes
-- ÉN gang (NULL → verdi) når Stripe-objektene opprettes. Status
-- (active/paused/archived) er den eneste frie endringen.
CREATE OR REPLACE FUNCTION billing_offering_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.team_space_id    IS DISTINCT FROM OLD.team_space_id
  OR NEW.version          IS DISTINCT FROM OLD.version
  OR NEW.amount_minor     IS DISTINCT FROM OLD.amount_minor
  OR NEW.currency         IS DISTINCT FROM OLD.currency
  OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
  OR NEW.fee_model        IS DISTINCT FROM OLD.fee_model
  OR NEW.fee_bps          IS DISTINCT FROM OLD.fee_bps
  OR NEW.club_fixed_minor IS DISTINCT FROM OLD.club_fixed_minor
  OR NEW.provider         IS DISTINCT FROM OLD.provider THEN
    RAISE EXCEPTION 'support_offerings er økonomisk immutable — opprett en ny versjon i stedet';
  END IF;

  IF (OLD.provider_product_id IS NOT NULL
      AND NEW.provider_product_id IS DISTINCT FROM OLD.provider_product_id)
  OR (OLD.provider_price_id IS NOT NULL
      AND NEW.provider_price_id IS DISTINCT FROM OLD.provider_price_id) THEN
    RAISE EXCEPTION 'provider-ID-er på en offering kan bare settes én gang';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_offerings_guard
  BEFORE UPDATE ON public.support_offerings
  FOR EACH ROW EXECUTE FUNCTION billing_offering_guard();

CREATE OR REPLACE FUNCTION billing_forbid_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% er append-only — rader slettes aldri', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_offerings_no_delete
  BEFORE DELETE ON public.support_offerings
  FOR EACH ROW EXECUTE FUNCTION billing_forbid_delete();


-- ============================================================
-- 6) payment_customers — plattformkunden, én per (bruker, provider).
-- Opprettes lat ved første checkout (fase 4). Bevisst uten
-- status-felt (beslutningsbok §5). Erstatter det døde feltet
-- profiles.stripe_customer_id (droppes nederst).
-- ============================================================
CREATE TABLE public.payment_customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider              text NOT NULL DEFAULT 'stripe'
                          CHECK (provider IN ('stripe')),
  provider_customer_id  text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, provider),
  UNIQUE (provider, provider_customer_id)
);

CREATE TRIGGER set_payment_customers_updated_at
  BEFORE UPDATE ON public.payment_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 7) support_subscriptions — støtteavtalen.
-- club_payment_account_id er FROSSEN mottaker fra tegningen:
-- flyttes laget til annen juridisk enhet senere, håndteres det
-- som kanseller + re-tegn med varsling (beslutningsbok §F).
-- Statuser speiler Stripe i egen enum; rå providerstatus lagres
-- ved siden av. KUN webhooks (fase 2) flytter status — retur fra
-- checkout beviser ingenting.
-- Fase 0-lærdom: «kansellert ved periodeslutt» uttrykkes med
-- cancel_at (timestamp) — cancel_at_period_end-boolean forble
-- false ved portal-kansellering. Derfor cancel_at-kolonne her.
-- ============================================================
CREATE TABLE public.support_subscriptions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES public.profiles(id),
  team_space_id                 uuid NOT NULL REFERENCES public.team_spaces(id),
  offering_id                   uuid NOT NULL REFERENCES public.support_offerings(id),
  payment_customer_id           uuid NOT NULL REFERENCES public.payment_customers(id),
  club_payment_account_id       uuid NOT NULL REFERENCES public.club_payment_accounts(id),
  provider                      text NOT NULL DEFAULT 'stripe'
                                  CHECK (provider IN ('stripe')),
  provider_checkout_session_id  text,
  provider_subscription_id      text,
  provider_status               text,
  status                        text NOT NULL DEFAULT 'checkout_pending'
                                  CHECK (status IN ('checkout_pending','incomplete','active','past_due','canceled','abandoned')),
  cancel_at                     timestamptz,
  canceled_at                   timestamptz,
  current_period_end            timestamptz,
  started_at                    timestamptz,
  ended_at                      timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- Én levende støtteavtale per (bruker, lag). canceled/abandoned
-- teller ikke — brukeren kan tegne på nytt.
CREATE UNIQUE INDEX idx_support_subscriptions_one_live
  ON public.support_subscriptions (user_id, team_space_id)
  WHERE status IN ('checkout_pending','incomplete','active','past_due');

CREATE UNIQUE INDEX idx_support_subscriptions_provider_id
  ON public.support_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- Webhook-oppslag (checkout.session.completed ankommer SIST —
-- fase 0/P13 — så sesjons-ID-en er nøkkelen i pending-fasen).
CREATE UNIQUE INDEX idx_support_subscriptions_checkout_session
  ON public.support_subscriptions (provider, provider_checkout_session_id)
  WHERE provider_checkout_session_id IS NOT NULL;

-- Lagaggregater (fase 5) og «mine abonnementer».
CREATE INDEX idx_support_subscriptions_team
  ON public.support_subscriptions (team_space_id);
CREATE INDEX idx_support_subscriptions_user
  ON public.support_subscriptions (user_id);

CREATE TRIGGER set_support_subscriptions_updated_at
  BEFORE UPDATE ON public.support_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 8) payment_transactions — frossen økonomi per trekk.
-- LÅST invariant: historiske beløp beregnes ALDRI på nytt fra
-- dagens split — raden fryser alt som gjaldt i betalingsøyeblikket.
-- Append-only: beløp og anvendt split er immutable (trigger),
-- rader slettes aldri. Status går kun fremover (fase 2 håndhever
-- overgangene); refunded_minor og provider_fee_minor er de eneste
-- verdifeltene som oppdateres (refusjon akkumulerer; gebyret
-- ankommer med balance transaction, én gang).
-- subscription_id er nullable + origin-felt: engangsbetalinger
-- senere lander i SAMME tabell uten migrasjon (beslutningsbok §F).
-- ============================================================
CREATE TABLE public.payment_transactions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin                      text NOT NULL DEFAULT 'subscription_invoice'
                                CHECK (origin IN ('subscription_invoice')),
  subscription_id             uuid REFERENCES public.support_subscriptions(id),
  team_space_id               uuid NOT NULL REFERENCES public.team_spaces(id),
  club_payment_account_id     uuid NOT NULL REFERENCES public.club_payment_accounts(id),
  provider                    text NOT NULL DEFAULT 'stripe'
                                CHECK (provider IN ('stripe')),
  provider_invoice_id         text,
  provider_payment_intent_id  text,
  provider_charge_id          text,
  provider_transfer_id        text,
  provider_balance_txn_id     text,
  gross_minor                 int  NOT NULL CHECK (gross_minor > 0),
  currency                    text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  club_share_minor            int  NOT NULL CHECK (club_share_minor >= 0),
  platform_fee_minor          int  NOT NULL CHECK (platform_fee_minor >= 0),
  provider_fee_minor          int,
  fee_model_applied           text NOT NULL
                                CHECK (fee_model_applied IN ('bps','fixed_club_amount')),
  fee_bps_applied             int  NOT NULL CHECK (fee_bps_applied BETWEEN 0 AND 10000),
  club_fixed_minor_applied    int,
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','succeeded','failed','partially_refunded','refunded','disputed','dispute_won','dispute_lost')),
  refunded_minor              int  NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  occurred_at                 timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CHECK (club_share_minor + platform_fee_minor = gross_minor),

  -- samme modellhygiene som på offerings
  CHECK (
    (fee_model_applied = 'bps' AND club_fixed_minor_applied IS NULL)
    OR (fee_model_applied = 'fixed_club_amount'
        AND club_fixed_minor_applied IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_payment_transactions_charge
  ON public.payment_transactions (provider, provider_charge_id)
  WHERE provider_charge_id IS NOT NULL;

CREATE INDEX idx_payment_transactions_subscription
  ON public.payment_transactions (subscription_id);
CREATE INDEX idx_payment_transactions_team_time
  ON public.payment_transactions (team_space_id, occurred_at DESC);
CREATE INDEX idx_payment_transactions_account
  ON public.payment_transactions (club_payment_account_id);

CREATE TRIGGER set_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Frossen økonomi-vakten. Gjelder også service role — triggere
-- bypasses ikke slik RLS gjør.
CREATE OR REPLACE FUNCTION billing_transaction_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.origin                   IS DISTINCT FROM OLD.origin
  OR NEW.subscription_id          IS DISTINCT FROM OLD.subscription_id
  OR NEW.team_space_id            IS DISTINCT FROM OLD.team_space_id
  OR NEW.club_payment_account_id  IS DISTINCT FROM OLD.club_payment_account_id
  OR NEW.provider                 IS DISTINCT FROM OLD.provider
  OR NEW.gross_minor              IS DISTINCT FROM OLD.gross_minor
  OR NEW.currency                 IS DISTINCT FROM OLD.currency
  OR NEW.club_share_minor         IS DISTINCT FROM OLD.club_share_minor
  OR NEW.platform_fee_minor       IS DISTINCT FROM OLD.platform_fee_minor
  OR NEW.fee_model_applied        IS DISTINCT FROM OLD.fee_model_applied
  OR NEW.fee_bps_applied          IS DISTINCT FROM OLD.fee_bps_applied
  OR NEW.club_fixed_minor_applied IS DISTINCT FROM OLD.club_fixed_minor_applied
  OR NEW.occurred_at              IS DISTINCT FROM OLD.occurred_at THEN
    RAISE EXCEPTION 'payment_transactions er frossen økonomi — beløp og allokering endres aldri';
  END IF;

  IF OLD.provider_fee_minor IS NOT NULL
     AND NEW.provider_fee_minor IS DISTINCT FROM OLD.provider_fee_minor THEN
    RAISE EXCEPTION 'provider_fee_minor kan bare settes én gang';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_transactions_guard
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION billing_transaction_guard();

CREATE TRIGGER trg_payment_transactions_no_delete
  BEFORE DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION billing_forbid_delete();


-- ============================================================
-- 9) webhook_events — idempotens + reprosessering.
-- UNIQUE (provider, event_id) er selve duplikatvernet: fase 2-
-- prosesseringen gjør INSERT ... ON CONFLICT DO NOTHING og
-- behandler kun rader den selv fikk inn. Fase 0/P13: rekkefølgen
-- er IKKE intuitiv (checkout.session.completed ankommer SIST),
-- så hver hendelse må kunne stå alene.
-- ============================================================
CREATE TABLE public.webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL DEFAULT 'stripe'
                  CHECK (provider IN ('stripe')),
  event_id      text NOT NULL,
  event_type    text NOT NULL,
  api_version   text,
  payload       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','processed','failed','skipped')),
  error         text,
  attempts      int NOT NULL DEFAULT 0,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,

  UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_unprocessed
  ON public.webhook_events (received_at)
  WHERE status IN ('received','failed');

CREATE TRIGGER trg_webhook_events_no_delete
  BEFORE DELETE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION billing_forbid_delete();


-- ============================================================
-- Kapabilitetsoppslaget — invariant 5 som funksjon.
-- Returnerer aktiv betalingskonto (med charges_enabled) for et
-- lag, eller NULL. Brukes av fase 3-CTA-en («Be klubben aktivere
-- støtte» når NULL) og fase 4-checkouten (hard vakt: ingen
-- checkout uten entydig aktiv mottaker).
-- Gatet på lagmedlemskap: PostgREST eksponerer funksjoner for
-- alle innloggede, og uten vakten kunne hvem som helst probe
-- vilkårlige team_space-id-er. Service role (Edge Functions)
-- slipper forbi medlemssjekken.
-- ============================================================
CREATE OR REPLACE FUNCTION get_payment_account_for_team_space(
  ts_id uuid,
  p_provider text DEFAULT 'stripe'
)
RETURNS uuid AS $$
  SELECT cpa.id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.club_legal_entity_links l
    ON l.club_id = t.club_id AND l.status = 'active'
  JOIN public.club_payment_accounts cpa
    ON cpa.legal_club_entity_id = l.legal_club_entity_id
   AND cpa.provider = p_provider
   AND cpa.status = 'active'
   AND cpa.charges_enabled
  WHERE ts.id = ts_id
    AND (auth.role() = 'service_role' OR is_team_member(ts_id));
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- RLS — deny-by-default. Kun to smale klient-SELECT-er; all
-- annen lesing/skriving skjer via service role (Edge Functions)
-- og SECURITY DEFINER-RPC-er som kommer i fase 3–5.
-- ============================================================
ALTER TABLE public.legal_club_entities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_claims             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_legal_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_payment_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_offerings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events          ENABLE ROW LEVEL SECURITY;

-- Brukeren ser sine egne støtteavtaler (Profil, fase 5).
CREATE POLICY "Users view own support subscriptions"
  ON public.support_subscriptions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Innsenderen følger sin egen claim-status (fase 3-UI).
CREATE POLICY "Claimants view own club claims"
  ON public.club_claims FOR SELECT
  USING (claimant_user_id = (SELECT auth.uid()));

-- BEVISST INGEN klientpolicyer på: legal_club_entities,
-- club_legal_entity_links, club_payment_accounts (requirements-
-- payload skal aldri leses rått), support_offerings (bærer den
-- ulåste splitten — fase 4-RPC returnerer kun pris/valuta),
-- payment_customers, payment_transactions og webhook_events
-- (service role only, audit_log-mønsteret fra 00012).


-- ============================================================
-- Opprydding: de to døde Stripe-feltene fra 00003/00007.
-- Kontrollert 2026-08-01: null referanser i src/, Edge Functions
-- og øvrige migrasjoner; feltene har aldri vært skrevet til.
-- Erstattet av payment_customers og club_payment_accounts.
-- ============================================================
ALTER TABLE public.profiles    DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.team_spaces DROP COLUMN IF EXISTS stripe_account_id;
