-- ============================================================
-- 00084 — Dørene: steng anon på SECURITY DEFINER-RPC-ene, og steng
--         de interne hjelperne helt.
--
-- BAKGRUNN. En PostgreSQL-funksjon fødes med EXECUTE til PUBLIC, og
-- `anon` er medlem av PUBLIC. En GRANT ... TO authenticated legger
-- derfor bare til en rolle som allerede kom inn — døren lukkes av
-- REVOKE. Regelen er dokumentert (00076/00077 kostet to migrasjoner),
-- men var per 2026-09-11 anvendt på 16 av 102 funksjoner.
--
-- MÅLT I PROD 2026-09-11, ikke lest ut av migrasjonsfilene:
--   102 SECURITY DEFINER i alt, hvorav 82 ikke er triggere
--   26 av de 82 kan `anon` kjøre
--   85 helt uten search_path (73 av dem ikke-triggere)
--   2 med search_path UTEN pg_temp
--
-- Alle 26 har i dag en fungerende selvvakt (`auth.uid()` NULL → RAISE,
-- eller filtrering på medlemskap), så det er ikke et åpent hull nå.
-- Poenget er at selvvakten er den ENESTE vakten: én omskriving som
-- flytter `v_uid`-tilordningen, og hvem som helst kan kalle funksjonen
-- med anon-nøkkelen, som ligger i klartekst i nettsidens bundle.
--
-- HVORFOR KATALOGDREVET. Håndskrevne REVOKE-linjer krever eksakt
-- signatur; tar man feil, stenges ingenting og ingen test feiler.
-- Her leses signaturene ut av pg_proc, så de er per definisjon riktige.
--
-- ── TRE GRUPPER, IKKE ÉN ──────────────────────────────────────────
-- Første utkast ga `authenticated` til alle 25 likt. Det er riktig for
-- bruker-RPC-er og galt for interne hjelpere. Gruppene er satt etter
-- en måling mot prod: hvem står i et RLS-uttrykk, hvem kalles av annen
-- SQL, og hvem kalles av klientkoden (app, nettside, Edge Functions) —
-- både i HEAD og i kilden til bygg 1.0 (4), som er det som står på
-- telefonene i dag.
--
-- A. BRUKER-RPC-er (19). Kalles av appen. GRANT authenticated,
--    REVOKE PUBLIC + anon.
--
-- B. VAKTER I RLS-UTTRYKK (3): is_team_member (20 policyer),
--    is_team_admin (13), is_club_team_admin (1).
--    ⚠️ MÅ BEHOLDE EXECUTE FOR `authenticated`. Dette ble avklart
--    empirisk i en transaksjon som ble rullet tilbake, 2026-09-11:
--    etter `revoke ... from authenticated` feilet en helt vanlig
--    `select count(*) from feed_posts` for en innlogget bruker med
--    42501 «permission denied for function is_team_member» — der den
--    før ga 296 rader. Postgres sjekker altså EXECUTE for rollen som
--    kjører spørringen, ikke for tabelleieren. Å behandle disse som
--    «interne hjelpere» ville tatt ned feed, kamp, kalender og
--    realtime-join i ett jafs.
--
-- C. INTERNE HJELPERE (3): inbox_enabled, notify_event_change,
--    get_payment_account_for_team_space.
--    Null policyer, null treff i app-, nettside- og Edge-kode (både
--    HEAD og bygg 1.0 (4)), og de kalles bare fra andre SECURITY
--    DEFINER-funksjoner — som kjører som eier og derfor ikke trenger
--    kallerens EXECUTE. REVOKE fra PUBLIC, anon OG authenticated.
--
--    Dette er fiksen for punkt 111: `inbox_enabled(p_user, p_team,
--    p_category)` har ingen `auth.uid()`-sjekk overhodet, så å bare
--    stenge `anon` ville smalnet den fra «hvem som helst på
--    internett» til «hvilken som helst innlogget Heia-bruker», som
--    fortsatt kan slå opp andres varselinnstillinger. En
--    `auth.uid()`-vakt er FEIL medisin her: funksjonen kalles av
--    triggere, på vegne av andre brukere enn den som utløste dem, og
--    en slik vakt ville slått ut varslingen. Riktig fiks er at ingen
--    klientrolle kan kalle den i det hele tatt.
--
-- D. BEVISST ANON (1): `lookup_invite_code` — «Bli med i lag» slår opp
--    koden i onboarding-stacken, før brukeren har logget inn. Røres ikke.
--
-- HVA DETTE IKKE GJØR: det utvider ingen tilgang. Funksjonene er i dag
-- kallbare av PUBLIC (= alle roller). Etterpå er de kallbare av
-- `authenticated` (A og B) eller bare av eier og service_role (C).
-- Strengt smalere, aldri bredere. `service_role` har egne, eksplisitte
-- GRANT-er som en REVOKE fra PUBLIC/anon/authenticated ikke rører.
--
-- TILBAKEFØRING: se `scripts/rollback-00084.sql`. Ingen datarader
-- røres av denne migrasjonen — bare rettigheter og search_path.
-- ============================================================

DO $$
DECLARE
  r        record;
  v_a      int := 0;
  v_b      int := 0;
  v_c      int := 0;
  -- Gruppe B — vakter i RLS-uttrykk. Beholder authenticated.
  b_rls    text[] := ARRAY['is_team_member', 'is_team_admin', 'is_club_team_admin'];
  -- Gruppe C — interne hjelpere. Stenges for alle klientroller.
  c_intern text[] := ARRAY['inbox_enabled', 'notify_event_change',
                           'get_payment_account_for_team_space'];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef                               -- kun SECURITY DEFINER
       AND p.prorettype <> 'trigger'::regtype        -- triggere kalles ikke
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND p.proname <> 'lookup_invite_code'         -- gruppe D, bevisst anon
  LOOP
    IF r.proname = ANY(c_intern) THEN
      -- Gruppe C: ingen klientrolle skal kunne kalle den.
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
        r.proname, r.args);
      v_c := v_c + 1;
    ELSE
      -- Gruppe A og B: rekkefølgen er LÅST — GRANT først (ulik mottaker),
      -- REVOKE etterpå. Motsatt rekkefølge ville latt den siste oppheve
      -- den første.
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        r.proname, r.args);
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
        r.proname, r.args);
      IF r.proname = ANY(b_rls) THEN v_b := v_b + 1; ELSE v_a := v_a + 1; END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '00084: % bruker-RPC-er, % RLS-vakter, % interne hjelpere', v_a, v_b, v_c;

  -- Sikringen mot at gruppelistene råtner: navn som ikke lenger finnes
  -- blant de anon-åpne skal ikke passere i stillhet.
  --
  -- Betinget av at løkka fant NOE. Kjøres migrasjonen om igjen mot en base
  -- der døren allerede er lukket, finner løkka null rader — og da er 0/0
  -- riktig svar, ikke et avvik. Uten dette ville en `db reset` eller en
  -- gjenkjøring feilet på sin egen suksess.
  IF (v_a + v_b + v_c) = 0 THEN
    RAISE NOTICE '00084: ingen anon-åpne funksjoner igjen — allerede kjørt.';
  ELSIF v_b <> 3 OR v_c <> 3 THEN
    RAISE EXCEPTION '00084: forventet 3 RLS-vakter og 3 interne hjelpere, fikk % og %', v_b, v_c;
  END IF;
END $$;

-- ── search_path: pg_temp MÅ stå eksplisitt SIST ────────────────────
-- Utelates pg_temp fra en EKSPLISITT sti, søkes det likevel — og da
-- implisitt FØRST. Disse to er de eneste i basen som har fått en sti
-- og likevel bommet, og de er funksjonene som deler ut betalings-
-- myndighet over en juridisk enhet. ALTER ... SET rører verken kropp
-- eller rettigheter (00077 brukte samme grep).
ALTER FUNCTION public.redeem_manager_invitation(text)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.decline_manager_invitation(text, text)
  SET search_path = public, extensions, pg_temp;

-- ── is_team_member / is_team_admin: pinn stien ─────────────────────
-- Disse to er vakten i nesten hver RLS-policy OG i join-policyen for
-- realtime-kanalene (00080). Kalt fra en policy arver de kallerens
-- search_path. De er de mest kalte funksjonene i hele systemet, så de
-- tas her; resten av de 73 er en egen skive (se docs/GJENSTÅR.md).
ALTER FUNCTION public.is_team_member(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_team_admin(uuid)  SET search_path = public, pg_temp;
