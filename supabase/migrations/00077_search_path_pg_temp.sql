-- ============================================================
-- 00077_search_path_pg_temp.sql
-- RETTELSE TIL 00076: `pg_temp` må stå EKSPLISITT SIST.
--
-- ---------------------------------------------------------------------------
-- ⚠️ 00076 PÅSTO NOE SOM ER FEIL, OG PÅSTANDEN STÅR I FILA I PROD
--
-- 00076 satte `SET search_path = public` og begrunnet det med at «`pg_temp` er
-- BEVISST UTELATT — står den i stien, kan en kaller lage en midlertidig tabell
-- som skygger for en ekte».
--
-- **Det er motsatt.** PostgreSQL-dokumentasjonen er tydelig: nevnes `pg_temp`
-- ikke i `search_path`, søkes det likevel — og da IMPLISITT FØRST (for
-- tabeller og views). Å utelate det er derfor ikke å fjerne det; det er å
-- plassere det på den ENESTE plassen vi ikke vil ha det. `= public` ga altså
-- ikke beskyttelsen 00076 beskrev.
--
-- Nevnes `pg_temp` derimot eksplisitt, plasseres det NØYAKTIG der man skriver
-- det. `= public, pg_temp` gir dermed rekkefølgen vi faktisk vil ha:
--
--     pg_catalog  (alltid implisitt først)
--     public      ← det betrodde skjemaet
--     pg_temp     ← eksplisitt SIST, kan ikke lenger skygge for noe i public
--
-- ⚠️ 00076 ER IKKE REDIGERT. Den er anvendt i prod, og en anvendt migrasjon
-- skrives ikke om — da ville fil og database sagt to forskjellige ting.
-- Den feilaktige kommentaren blir stående som historikk; DENNE fila er
-- rettelsen. Se `#### 🔒 DØRENE PÅ SKRIVE-RPC-ENE` i STATUS-HANDOFF.md.
--
-- ---------------------------------------------------------------------------
-- ⚠️ INGEN FUNKSJONSKROPP RØRES, OG INGEN RETTIGHET ENDRES.
-- `ALTER FUNCTION … SET` bytter kun konfigurasjonen på funksjonen.
-- GRANT/REVOKE fra 00076 står urørt.
--
-- Samme seks funksjoner som 00076, altså alle kroppene 00075 eier.
-- `= public, pg_temp` og ikke `public, extensions, pg_temp`: ingen av dem
-- kaller pgcrypto. Legger noen inn et `digest()` senere, må stien utvides i
-- samme slag — og `pg_temp` skal FORTSATT stå sist.
-- ============================================================

ALTER FUNCTION public.correct_match_goal(uuid, text, text, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.rebuild_match_feed_texts(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_no_heia_on_opponent_goal()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.match_event_headline(text, text, text, text, int, int)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.report_match_event(uuid, text, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.soft_delete_post(uuid)
  SET search_path = public, pg_temp;


-- ============================================================
-- ✅ KONTROLL — alle seks skal vise {"search_path=public, pg_temp"}:
--
--   SELECT p.proname, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('correct_match_goal','rebuild_match_feed_texts',
--                       'match_event_headline','enforce_no_heia_on_opponent_goal',
--                       'report_match_event','soft_delete_post');
--
-- `scripts/verify-00075.sql` A7 vokter det samme.
-- ============================================================
