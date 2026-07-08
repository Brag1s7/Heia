-- ============================================================
-- 00018_feed_media_storage.sql
-- Storage for feed image posts (Fase 2C).
--
-- PRIVAT bucket: Heia er en ungdomslag-app; bilder kan være av
-- barn. Personvern går foran enkelhet — ingen public URL-er.
-- Klienten henter signerte URL-er ved behov (feeden refetches).
--
-- Path-konvensjon: {team_space_id}/{filnavn}
-- Storage-policyene gates på lagmedlemskap ved å lese første
-- mappe-segment (team_space_id) fra objektnavnet.
-- ============================================================

-- ─── privat bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-media', 'feed-media', false)
ON CONFLICT (id) DO NOTHING;

-- ─── storage-policyer på storage.objects ────────────────────
-- (storage.foldername(name))[1] = team_space_id-segmentet.

CREATE POLICY "Team members can upload feed media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feed-media'
    AND is_team_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Team members can view feed media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feed-media'
    AND is_team_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Team members can delete feed media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'feed-media'
    AND is_team_member((storage.foldername(name))[1]::uuid)
  );
