-- ============================================================
-- 00035_fix_club_logo_policy.sql
-- Fiks av 00034 (funnet på telefon: «new row violates row-level
-- security policy» ved klubblogo-opplasting).
--
-- I klubb-INSERT-policyens EXISTS-subquery ble det ukvalifiserte
-- `name` bundet til clubs.name (nærmeste relasjon i subqueryen),
-- ikke storage.objects.name. Write-once-sjekken sammenlignet
-- dermed klubb-id mot foldername('Hamkam') = NULL → EXISTS ble
-- alltid false → policyen nektet alle opplastinger.
--
-- Regel (samme familie som COALESCE-NULL-fella fra 00020):
-- i en policy-subquery MÅ ytre kolonner kvalifiseres med
-- tabellnavnet (objects.name) — ukvalifisert binder de til
-- subqueryens egen tabell om kolonnenavnet finnes der.
-- ============================================================

DROP POLICY IF EXISTS "Club team admins can upload club logo" ON storage.objects;

CREATE POLICY "Club team admins can upload club logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club-logos'
    AND is_club_team_admin((storage.foldername(objects.name))[1]::uuid)
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = (storage.foldername(objects.name))[1]::uuid
        AND c.logo_url IS NULL
    )
  );
