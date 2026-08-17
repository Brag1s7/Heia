-- ============================================================
-- 00060_sikkerhet_policyer_indekser.sql
-- Fase B3 — P10-sikkerhetsfunnene («må» 1–3 + «bør» 4–5).
-- Nummer 00058 finnes ikke: cacheControl/bucket-limits ble config
-- via API, ikke SQL (satt 2026-08-17, verifisert).
--
-- P10 #6 (oppryddingsjobb for foreldreløse filer) er bevisst IKKE
-- her — det er en ops-jobb, ikke en migrasjon. #7 (getRsvpSummaries
-- 414-risiko) løses av events-datovinduet i B2.
-- ============================================================

-- ─── 1. Feed-media DELETE: opplaster eller lagadmin ──────────
-- 00018 lot ETHVERT lagmedlem slette ALLE lagets filer. Strammes
-- til: opplasteren (owner settes av storage-API-et ved klient-
-- opplasting) eller trener/lagleder/admin.
--
-- Backfill-variantene (2026-08-17) er lastet opp av service_role
-- og har owner NULL — et vanlig medlem som sletter sin egen
-- LEGACY-post etterlater da variantfila som foreldreløs. Det er
-- akseptert modell: deletePost er allerede best-effort på storage
-- (feed.ts:233-235), posten soft-slettes uansett, og opprydding
-- av foreldreløse filer er ops-jobben i P10 #6. Admin kan alltid
-- slette. owner (uuid, eldre) OG owner_id (text, kanonisk) sjekkes
-- for robusthet på tvers av storage-api-versjoner.

DROP POLICY IF EXISTS "Team members can delete feed media" ON storage.objects;

CREATE POLICY "Uploader or team admin can delete feed media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'feed-media'
    AND is_team_member((storage.foldername(name))[1]::uuid)
    AND (
      owner = auth.uid()
      OR owner_id = auth.uid()::text
      OR is_team_admin((storage.foldername(name))[1]::uuid)
    )
  );

-- ─── 2. team_spaces.logo_url: formvalidering ─────────────────
-- logo_url eksponeres til anon via invite-preview (00050) og
-- rendres hos foreldre/barn. Uten validering kan et hvilket som
-- helst medlem peke den mot en ekstern sporingspiksel. Samme
-- mønster som klubblogo-RPC-en (00034): URL-en MÅ peke inn i
-- radens egen mappe i club-logos-bucketen.
--
-- NOT VALID: eksisterende rader røres ikke (alle er lastet opp
-- via uploadLogo og matcher mønsteret, men vi tvinger ingen
-- revalidering i migrasjonen); alle NYE skriv valideres.

ALTER TABLE public.team_spaces
  ADD CONSTRAINT team_spaces_logo_url_shape CHECK (
    logo_url IS NULL
    OR logo_url LIKE
      '%/storage/v1/object/public/club-logos/' || id::text || '/%'
  ) NOT VALID;

-- ─── 3. Lese-RPC-ene: eksplisitt REVOKE fra anon ─────────────
-- Defense-in-depth: funksjonene sjekker auth.uid()/medlemskap
-- selv, men skal ikke engang kunne KALLES av anon. 00046-lærdommen:
-- REVOKE må ta PUBLIC også — og da MÅ authenticated få eksplisitt
-- GRANT, ellers mister appen tilgangen i samme sekund.
-- lookup_invite_code (00017/00050) er bevisst anon og røres IKKE.

REVOKE ALL ON FUNCTION get_team_feed(uuid, int, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_event_with_rsvp(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_match_photos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_team_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_season_stats(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_team_feed(uuid, int, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_with_rsvp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_photos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_season_stats(uuid) TO authenticated;

-- ─── 4. club-logos SELECT: kun authenticated ─────────────────
-- 00036 åpnet SELECT uten TO-klausul → anon kan liste mappenavn
-- via storage-API-et. Offentlige nedlastinger går via public-URL
-- UTENOM RLS og påvirkes ikke; policyen trengs bare for opplasting
-- (INSERT … RETURNING) — og opplastere er alltid authenticated.

DROP POLICY IF EXISTS "Anyone can view club logos" ON storage.objects;

CREATE POLICY "Authenticated can view club logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'club-logos');

-- ─── 5. Manglende indekser ───────────────────────────────────
-- feed_posts(event_id): kampbildeskjermen filtrerer på event_id
-- og gjør i dag seq scan. Partiell — de fleste poster har NULL.
-- notifications(source_entity_type, source_entity_id): cron-jobben
-- (hvert 10. min) og varsel-oppslag treffer paret.

CREATE INDEX IF NOT EXISTS idx_feed_posts_event_id
  ON public.feed_posts (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_source_entity
  ON public.notifications (source_entity_type, source_entity_id);
