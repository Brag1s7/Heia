-- ============================================================
-- 00076_korriger_maal_dorer.sql
-- RETTELSE TIL 00075: dørene, og search_path på funksjonskroppene.
--
-- ---------------------------------------------------------------------------
-- ⚠️ HVA SOM VAR GALT, OG HVORFOR EN `GRANT` ALENE IKKE ER EN DØR
--
-- 00075 gjorde `GRANT EXECUTE … TO authenticated` og stoppet der. Men i
-- PostgreSQL **fødes en funksjon med EXECUTE til `PUBLIC`**, og `anon` er
-- medlem av PUBLIC. En GRANT legger altså bare til en rolle som allerede kom
-- inn; den stenger ingenting. Døren lukkes av REVOKE, ikke av GRANT.
--
-- Bevist mot ekte prod med anon-nøkkelen FØR denne migrasjonen:
--
--   correct_match_goal        → HTTP 400  P0001 «Not authenticated»
--   rebuild_match_feed_texts  → HTTP 204  ⛔ KJØRTE
--   match_event_headline      → HTTP 200  «⚽ MÅL! A 1–0 B»
--
-- ⚠️ `rebuild_match_feed_texts` ER DEN ALVORLIGE. Den er SECURITY DEFINER og
-- SKRIVER til `feed_posts`. En uautentisert kaller med en gyldig
-- `match_session_id` kunne tvinge fram en omskriving av kampens feedtekster
-- — og hver kjøring fyrer `set_feed_posts_updated_at` og dermed en
-- realtime-UPDATE til alle som følger laget. Den er riktignok idempotent
-- (den regner ut det SANNE snapshotet fra `match_events`, så ingen data blir
-- feil), men en uautentisert skrivevei inn i feeden er uansett en dør som
-- ikke skal stå åpen.
--
-- ⚠️ FORSKJELLEN PÅ 42501 OG P0001 ER IKKE KOSMETIKK. `P0001 Not
-- authenticated` betyr at kallet NÅDDE funksjonskroppen og ble stoppet av en
-- `IF auth.uid() IS NULL`-linje inne i den. Da er selvvakten den eneste
-- vakten, og en fremtidig redigering som flytter eller mister den linjen
-- åpner funksjonen for hele internett uten at noe annet endres.
-- `42501 permission denied for function` betyr at kallet ble avvist av
-- rettighetssystemet FØR kroppen kjørte. Det er den ekte døren.
--
-- ---------------------------------------------------------------------------
-- ⚠️ REKKEFØLGEN GRANT → REVOKE ER MED VILJE (samme som 00047:677-686).
-- GRANT gjelder `authenticated`, REVOKE gjelder `PUBLIC` og `anon` — ulike
-- mottakere, så den siste opphever ikke den første. `anon` nevnes eksplisitt
-- i tillegg til PUBLIC fordi privilegiet kan komme fra begge.
--
-- ---------------------------------------------------------------------------
-- 📋 AVGRENSNING — DETTE ER *IKKE* EN OPPRYDDING AV HELE BASEN.
--
-- Samme probe viste at TRE ELDRE skrive-RPC-er har nøyaktig samme svakhet,
-- og har hatt den lenge (fra 00020/00021/00041-æraen):
--
--   start_match          → P0001, ikke 42501
--   report_match_event   → P0001, ikke 42501
--   soft_delete_post     → P0001, ikke 42501
--
-- Til sammenligning er lesestien allerede riktig lukket:
-- `get_team_feed` og `get_event_with_rsvp` svarer 42501.
--
-- ⚠️ De tre er BEVISST IKKE RØRT HER. 00075 gjorde `CREATE OR REPLACE` på to
-- av dem, og `CREATE OR REPLACE` BEHOLDER eksisterende grants — de står altså
-- nøyaktig som før skive 8, verken bedre eller verre. Å endre grants på dem
-- er en egen hardening-skive med sin egen telefonkontroll: tar man feil av
-- hvilken rolle appen faktisk kaller med, slutter mål å kunne rapporteres i
-- prod. Denne migrasjonen rører KUN det 00075 selv opprettet.
--
-- ➡️ Se `### 🔒 DØRENE PÅ SKRIVE-RPC-ENE` i STATUS-HANDOFF.md.
-- ============================================================


-- ============================================================
-- 1) correct_match_goal — den ENE som skal kunne kalles fra appen
-- ============================================================
GRANT EXECUTE ON FUNCTION
  public.correct_match_goal(uuid, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION
  public.correct_match_goal(uuid, text, text, text, text) FROM PUBLIC, anon;


-- ============================================================
-- 2) De interne hjelperne — ingen klient skal nå dem, heller ikke
--    en innlogget bruker.
--
-- ⚠️ AT `authenticated` OGSÅ MISTER DEM BRYTER INGENTING:
-- `correct_match_goal` og `report_match_event` er SECURITY DEFINER og kjører
-- som funksjonens EIER, ikke som kalleren. Eieren beholder rettighetene sine,
-- så de indre kallene går som før. Det er hele poenget med en intern hjelper.
--
-- ⚠️ Trigger-funksjonen trenger heller ingen EXECUTE: PostgreSQL sjekker ikke
-- EXECUTE når en trigger fyrer. `trg_no_heia_on_opponent_goal` virker uendret.
-- ============================================================
REVOKE ALL ON FUNCTION public.rebuild_match_feed_texts(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.match_event_headline(text, text, text, text, int, int)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.enforce_no_heia_on_opponent_goal()
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 3) LÅST search_path PÅ ALLE FUNKSJONSKROPPENE 00075 EIER
--
-- En SECURITY DEFINER-funksjon uten låst `search_path` kjører med KALLERENS
-- søkesti. Kan kalleren lage objekter i en skjema som ligger foran `public`,
-- kan hun skygge for en tabell eller en funksjon kroppen bruker — og koden
-- kjører da med eierens rettigheter mot angriperens objekter.
--
-- ⚠️ `= public`, IKKE `= public, extensions` som 00062/00064 bruker. De to
-- trengte `extensions` fordi de kaller pgcrypto (`digest`). Ingen av
-- funksjonene her gjør det, og en søkesti skal være så kort som den kan være.
-- Legger noen inn et pgcrypto-kall senere, må stien utvides i samme slag.
--
-- ⚠️ `pg_temp` er BEVISST UTELATT. Står den i stien, kan en kaller lage en
-- midlertidig tabell som skygger for en ekte — altså nøyaktig angrepet vi
-- lukker. `pg_catalog` søkes alltid først og trenger ikke nevnes.
--
-- ⚠️ ALTER, ikke CREATE OR REPLACE: kroppene er uendret fra 00075, og å
-- skrive dem av på nytt ville vært en ren avskriftsrisiko uten gevinst.
-- ============================================================
ALTER FUNCTION public.correct_match_goal(uuid, text, text, text, text)
  SET search_path = public;
ALTER FUNCTION public.rebuild_match_feed_texts(uuid)
  SET search_path = public;
ALTER FUNCTION public.enforce_no_heia_on_opponent_goal()
  SET search_path = public;
ALTER FUNCTION public.match_event_headline(text, text, text, text, int, int)
  SET search_path = public;

-- Disse to ble gjenskapt av 00075 og er dermed skive 8s kropper.
-- ⚠️ KUN `search_path` — grants røres IKKE, se avgrensningen øverst.
ALTER FUNCTION public.report_match_event(uuid, text, text, text)
  SET search_path = public;
ALTER FUNCTION public.soft_delete_post(uuid)
  SET search_path = public;


-- ============================================================
-- ✅ KONTROLL — kjør dette rett etter push. Alle fire skal være `f`/`t`
--    som angitt, og anon-proben skal gi 42501, ikke P0001.
--
--   SELECT
--     has_function_privilege('anon','public.correct_match_goal(uuid,text,text,text,text)','EXECUTE')        AS anon_correct,      -- f
--     has_function_privilege('authenticated','public.correct_match_goal(uuid,text,text,text,text)','EXECUTE') AS auth_correct,    -- t
--     has_function_privilege('anon','public.rebuild_match_feed_texts(uuid)','EXECUTE')                       AS anon_rebuild,     -- f
--     has_function_privilege('authenticated','public.rebuild_match_feed_texts(uuid)','EXECUTE')              AS auth_rebuild;     -- f
--
--   SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('correct_match_goal','rebuild_match_feed_texts',
--                       'match_event_headline','enforce_no_heia_on_opponent_goal',
--                       'report_match_event','soft_delete_post');
--   -- proconfig skal inneholde {search_path=public} på ALLE SEKS.
-- ============================================================
