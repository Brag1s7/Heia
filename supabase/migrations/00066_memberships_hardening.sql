-- ============================================================
-- 00066_memberships_hardening.sql
--
-- SIKKERHETSSKIVE (isolert, 2026-08-19): all medlemsadministrasjon
-- skal gå gjennom RPC-ene — de direkte skrivepolicyene på
-- memberships fra 00014 droppes, og medlemslesing av ANDRES rader
-- strammes til aktive rader. Funnet i memberships-auditen før
-- «forlat lag»-skiva; skilt ut som egen leveranse fordi hullene
-- finnes UAVHENGIG av produktbeslutningen der.
--
-- HULLENE (alle utnyttbare via rå PostgREST i dag):
--   * "Users can update own membership" — USING/WITH CHECK er kun
--     user_id = auth.uid(), ingen kolonne- eller statusvakt: et
--     medlem kan sette role='admin' på sin egen rad (privilegie-
--     eskalering), og en removed-rad kan flippes tilbake til
--     'active' — hele fjernings-/utmeldingsmodellen kan omgås.
--   * "Admins can update memberships" — treffer også removed-
--     rader (gjenoppliving utenom join_team_space, uten nytt
--     joined_at) og tillater vilkårlige rollebytter uten vaktene
--     en rollebytte-RPC skal ha.
--   * "Admins can remove members" — hard DELETE fra klienten;
--     remove_team_member (00041) finnes nettopp fordi vaktene må
--     bo i databasen, og status='removed' skal bære historikk.
--   * "Admins can invite members" (INSERT) — DØD VEKT med
--     angrepsflate: ingenting i appen eller RPC-ene skaper
--     'invited'-rader (verifisert: alle fire INSERT-ene i
--     migrasjonene er SECURITY DEFINER-RPC-er som setter 'active'),
--     men policyen lot en lagadmin sette inn rader med vilkårlig
--     rolle for VILKÅRLIGE brukere i eget lag. En invitasjons-
--     funksjon bygges som RPC den dagen den kommer.
--   * "Members can view team memberships" — uten status-filter:
--     lagkamerater kunne lese alles removed-historikk (hvem som
--     har forlatt/blitt fjernet, og når) via rå PostgREST.
--
-- HVORFOR TRYGT: appen skriver ALDRI memberships direkte
-- (verifisert i auditen: kun to SELECT-er i src, teams.ts:79/176;
-- all skriving går via SECURITY DEFINER-RPC-er som join_team_space,
-- activate_team_space, remove_team_member og delete_account_data —
-- og Edge Functions bruker service role, som ikke ser RLS).
-- Lesestrammingen er også trygg: eneste klientlesing av ANDRES
-- rader er medlemstallet (teams.ts:176), som alt filtrerer
-- status='active'; medlemslista går via get_team_members-RPC-en
-- (SECURITY DEFINER), og ingen Realtime-kanal abonnerer på
-- memberships. Egne rader (alle statuser) leses fortsatt — egen
-- historikk er ens egen.
--
-- ETTER DENNE MIGRASJONEN har memberships NØYAKTIG to policyer:
--   * "Users can view own memberships"          (SELECT, uendret)
--   * "Members can view active team memberships" (SELECT, ny)
-- Ingen klient-skriving. Vaktene bor i databasen.
--
-- VERIFISERING: scripts/verify-membership-hardening.mjs (testkonto,
-- rå PostgREST) beviser at UPDATE/DELETE/INSERT treffer null rader,
-- at andres ikke-aktive rader er usynlige, og at egen historikk
-- fortsatt kan leses.
-- ============================================================

DROP POLICY IF EXISTS "Users can update own membership" ON public.memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
DROP POLICY IF EXISTS "Admins can remove members" ON public.memberships;
DROP POLICY IF EXISTS "Admins can invite members" ON public.memberships;

DROP POLICY IF EXISTS "Members can view team memberships" ON public.memberships;
CREATE POLICY "Members can view active team memberships"
  ON public.memberships FOR SELECT
  USING (status = 'active' AND is_team_member(team_space_id));
