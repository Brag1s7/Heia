-- ============================================================
-- 00042_account_deletion.sql
-- V1-HYGIENE del 2: kontosletting i appen (Apple 5.1.1(v) —
-- hardt review-krav).
--
-- Modellen (besluttet 2026-08-02): ANONYMISER, IKKE UTRADER.
-- Profilraden består som anonymt spøkelse («Slettet bruker») av to
-- grunner:
--   1. Bokføringsloven: payment-domenet (support_subscriptions.
--      user_id er NOT NULL uten cascade, transaksjonene er append-
--      only med slettevern-trigger) SKAL beholde historikken. En
--      hard delete av profilen ville uansett feilet på FK-en.
--   2. Innhold delt med laget blir stående uten navn — samme
--      prinsipp som remove_team_member (00041): sletting er
--      tilgangs- og identitetsstyring, ikke historieomskriving.
--      Lesestiene henter forfatternavn fra profiles, så «Slettet
--      bruker» vises av seg selv.
--
-- Alt PERSONLIG slettes: medlemskap (hard delete — ikke 'removed';
-- GDPR-sletting er sterkere enn moderasjonsfjerning), RSVP-er,
-- forvaltede barn (navn er barne-PII), husstand, enhets-/push-
-- tokens, varsler, reaksjoner — og til slutt anonymiseres profilen.
-- auth-brukeren (e-post + passord) slettes av Edge Function-en
-- delete-account ETTER at denne RPC-en har kjørt.
--
-- FK-en profiles.id → auth.users(id) ON DELETE CASCADE droppes:
-- den ville dratt profilraden (og dermed finansradene, via FK-feil)
-- med seg når auth-brukeren slettes. handle_new_user-triggeren
-- trenger den ikke — nye brukere får nye uuid-er, så foreldreløse
-- profilrader kolliderer aldri.
--
-- KJENTE BEGRENSNINGER (akseptert v1):
--   * Er brukeren eneste trener/lagleder, blir laget stående uten
--     voksen — remove_team_member-vaktene gjelder ikke egen konto
--     (Apple krever at sletting alltid er mulig). Volumet i dag er
--     Brage + testkontoer; rollebytte-verktøy er backlog.
--   * En annen forelder i samme husstand mister koblingen til barn
--     denne brukeren forvaltet (memberships.managed_child_id blir
--     NULL via FK-en) — barnets navn er den slettende forelderens
--     data å ta med seg.
-- ============================================================


-- ============================================================
-- 1) Dropp cascade-FK-en profiles → auth.users.
-- Oppslag via pg_constraint i stedet for hardkodet navn — feiler
-- aldri på navnedrift, og er idempotent ved re-kjøring.
-- ============================================================
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT c.conname INTO v_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.profiles'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'auth.users'::regclass;

  IF v_name IS NULL THEN
    RAISE NOTICE 'profiles har ingen FK til auth.users — allerede droppet';
  ELSE
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_name);
  END IF;
END $$;


-- ============================================================
-- 2) delete_account_data() — hele DB-siden av kontosletting,
-- i én transaksjon. Service role only (ops-mønsteret fra 00038):
-- klienten skal aldri kunne tømme databasen mens Stripe-avtalen
-- løper videre — Edge Function-en kansellerer hos Stripe FØRST.
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

  -- Reaksjoner er aktivitetsdata, ikke laginnhold — slettes.
  -- Innlegg/kommentarer/kampdata består (se headeren); det samme
  -- gjør content_reports (frossen moderasjonshistorikk), audit_log,
  -- club_claims og HELE payment-domenet — alle peker nå på et
  -- anonymt spøkelse.
  DELETE FROM public.reactions WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kun service role (Edge Function-en delete-account) — aldri klienter.
REVOKE ALL ON FUNCTION delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account_data(uuid) TO service_role;
