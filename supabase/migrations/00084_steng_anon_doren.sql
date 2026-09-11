-- ============================================================
-- 00084 — Dørene: steng anon på alle SECURITY DEFINER-RPC-er.
--
-- BAKGRUNN. En PostgreSQL-funksjon fødes med EXECUTE til PUBLIC, og
-- `anon` er medlem av PUBLIC. En GRANT ... TO authenticated legger
-- derfor bare til en rolle som allerede kom inn — døren lukkes av
-- REVOKE. Regelen er dokumentert (00076/00077 kostet to migrasjoner),
-- men var per 2026-09-11 anvendt på 16 av 102 funksjoner.
--
-- MÅLT I PROD samme dag, ikke lest ut av migrasjonsfilene:
--   102 SECURITY DEFINER (20 triggere)
--   26 ikke-trigger-funksjoner som `anon` KAN kjøre
--   85 helt uten search_path, 2 med search_path UTEN pg_temp
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
-- HVA DETTE IKKE GJØR: det utvider ingen tilgang. Funksjonene er i dag
-- kallbare av PUBLIC (= alle roller). Etterpå er de kallbare av
-- `authenticated`. Det er strengt smalere, aldri bredere.
--
-- UNNTAK: `lookup_invite_code` er BEVISST anon — «Bli med i lag» slår
-- opp koden i onboarding-stacken, før brukeren har logget inn.
-- ============================================================

DO $$
DECLARE
  r         record;
  v_antall  int := 0;
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
       AND p.proname <> 'lookup_invite_code'         -- bevisst anon
  LOOP
    -- Rekkefølgen er LÅST: GRANT først (ulik mottaker), REVOKE etterpå.
    -- Motsatt rekkefølge ville latt den siste oppheve den første.
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
      r.proname, r.args);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      r.proname, r.args);
    v_antall := v_antall + 1;
  END LOOP;

  RAISE NOTICE '00084: stengte anon-døren på % funksjoner', v_antall;
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
-- tas her; resten av de 85 er en egen skive (se docs/GJENSTÅR.md).
ALTER FUNCTION public.is_team_member(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_team_admin(uuid)  SET search_path = public, pg_temp;
