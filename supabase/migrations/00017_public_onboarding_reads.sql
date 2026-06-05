-- ============================================================
-- 00017_public_onboarding_reads.sql
-- Intent-first / auth-before-commit onboarding needs read access
-- to reference data BEFORE the user has an account:
--   * sports  — the sport picker on CreateTeam
--   * clubs   — club autocomplete on CreateTeam
--   * lookup_invite_code() — preview the team before joining
--
-- The original policies/guards required the 'authenticated' role,
-- so a guest (anon) got empty results / "Not authenticated".
-- Relax these to public. Teams and team_spaces stay private
-- (invite-only via is_team_member); only public, non-sensitive
-- reference data is opened, and the actual writes (create/join)
-- still require an authenticated user.
-- ============================================================

-- ─── sports: public read ────────────────────────────────────
DROP POLICY IF EXISTS "Anyone authenticated can read sports" ON public.sports;
CREATE POLICY "Public can read sports"
  ON public.sports FOR SELECT
  USING (true);

-- ─── clubs: public read (for autocomplete) ──────────────────
DROP POLICY IF EXISTS "Anyone authenticated can read clubs" ON public.clubs;
CREATE POLICY "Public can read clubs"
  ON public.clubs FOR SELECT
  USING (true);

-- ─── lookup_invite_code(): allow pre-auth preview ───────────
-- You need a valid invite code to get anything back, so exposing
-- the team-space preview to anon (code holders) is safe. Joining
-- still requires auth via join_team_space().
CREATE OR REPLACE FUNCTION lookup_invite_code(code text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ts.id,
    'display_name', ts.display_name,
    'color', ts.color,
    'club_name', c.name,
    'sport', s.slug,
    'member_count', (
      SELECT count(*) FROM public.memberships m
      WHERE m.team_space_id = ts.id AND m.status = 'active'
    )
  ) INTO result
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.sports s ON s.id = t.sport_id
  WHERE ts.invite_code = upper(code)
    AND ts.deleted_at IS NULL
    AND ts.is_activated = true;

  RETURN result; -- null if not found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
