-- ============================================================
-- 00034_club_logo.sql
-- P4: klubblogo + laglogo (design-polish-planen).
--
-- Modell (LÅST 2026-07-31): logoen bor på KLUBBEN.
-- clubs.logo_url finnes fra 00002 (dødt felt til nå). Lagadmin i
-- et av klubbens lag kan LEGGE TIL logo når klubben mangler en —
-- aldri overskrive (write-once, samme governance som klubbnavnet:
-- første bruker skriver, alle senere gjenbruker). Endringer =
-- manuelt (SQL/dashboard) til en klubbadmin-rolle finnes.
--
-- Laglogo (team_spaces.logo_url) er per-lag-OVERRIDE og endres
-- fritt av lagadmin — dekkes allerede av «Admins can update team
-- space» (00014), ingen ny RLS der.
--
-- OFFENTLIG bucket «club-logos»: en logo er ikke persondata, og
-- signerte URL-er utløper (headeren og klubbsøket rendres
-- konstant). Paths: {club_id}/logo-… (klubb) og
-- {team_space_id}/logo-… (lag) — uuid-er kolliderer ikke, så
-- policyene skiller på hva første segment ER admin for.
-- ============================================================

-- ─── helper: er caller lagadmin i et av klubbens lag? ────────
-- Speiler is_team_admin (00008), men via teams.club_id. Brukes
-- av både RPC-vakten og storage-policyen, så drive-by-opplasting
-- på fremmede klubber stoppes begge steder.
CREATE OR REPLACE FUNCTION is_club_team_admin(c_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.team_spaces ts ON ts.id = m.team_space_id
    JOIN public.teams t ON t.id = ts.team_id
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('trener', 'lagleder', 'admin')
      AND t.club_id = c_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── offentlig bucket ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

-- ─── storage-policyer ───────────────────────────────────────
-- Klubblogo: kun lagadmin i klubben, og kun mens klubben mangler
-- logo (write-once også på filnivå — RPC-vakten speiles).
CREATE POLICY "Club team admins can upload club logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club-logos'
    AND is_club_team_admin((storage.foldername(name))[1]::uuid)
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.logo_url IS NULL
    )
  );

-- Laglogo: lagadmin laster opp og kan slette (bytte/fjerne rydder
-- den gamle filen). is_team_admin på en club_id gir false — ingen
-- kan slette klubblogoer fra klienten.
CREATE POLICY "Team admins can upload team logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club-logos'
    AND is_team_admin((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Team admins can delete team logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'club-logos'
    AND is_team_admin((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- set_club_logo(club_id, url)
-- Skriver clubs.logo_url — write-once. SECURITY DEFINER fordi
-- clubs er client-read-only (00016-mønsteret), så vaktene bor her.
-- Alle nullbare sjekker i COALESCE (NULL-fella fra 00020).
-- ============================================================
CREATE OR REPLACE FUNCTION set_club_logo(p_club_id uuid, p_url text)
RETURNS void AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT COALESCE(is_club_team_admin(p_club_id), false) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere i klubbens lag kan legge til logoen.';
  END IF;

  -- URL-en må peke inn i klubbens egen mappe i club-logos-bucketen.
  IF NOT COALESCE(
    p_url LIKE '%/storage/v1/object/public/club-logos/' || p_club_id::text || '/%',
    false
  ) THEN
    RAISE EXCEPTION 'Ugyldig logo-URL.';
  END IF;

  -- FOR UPDATE: to samtidige opplastinger skal ikke begge passere write-once.
  SELECT logo_url INTO v_existing
  FROM public.clubs
  WHERE id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fant ikke klubben.';
  END IF;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Klubben har allerede en logo.';
  END IF;

  UPDATE public.clubs SET logo_url = p_url WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
