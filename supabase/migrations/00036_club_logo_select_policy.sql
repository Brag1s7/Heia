-- ============================================================
-- 00036_club_logo_select_policy.sql
-- Fiks nr. 2 av klubblogo-opplastingen (samme telefonfunn som
-- 00035: «new row violates row-level security policy»).
--
-- Storage-API-et laster opp med INSERT … RETURNING, og RETURNING
-- krever at raden også passerer en SELECT-policy. `club-logos`
-- hadde ingen (antagelsen «offentlig bucket trenger ikke
-- SELECT-policy» gjaldt bare nedlasting — public-URL-er går
-- utenom RLS, men API-ets egen insert-returning gjør ikke det).
-- feed-media fungerte hele tiden fordi 00018 har SELECT-policy.
--
-- Regel: en bucket det skal LASTES OPP til trenger alltid en
-- SELECT-policy som dekker opplasterens rader — også når
-- bucketen er offentlig.
-- ============================================================

-- Metadata i club-logos er like offentlig som filene: åpen lesing.
CREATE POLICY "Anyone can view club logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');

-- Gjenopprett laglogo-INSERT-policyen etter feilsøkingen (den ble
-- midlertidig forenklet til kun bucket-sjekk via ALTER POLICY for å
-- isolere feilen — dette er den kanoniske definisjonen fra 00034).
DROP POLICY IF EXISTS "Team admins can upload team logo" ON storage.objects;

CREATE POLICY "Team admins can upload team logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club-logos'
    AND is_team_admin((storage.foldername(name))[1]::uuid)
  );
