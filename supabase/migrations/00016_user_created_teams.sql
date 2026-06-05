-- ============================================================
-- 00016_user_created_teams.sql
-- Supports the team-first / invite-first onboarding model:
-- users create clubs + teams from scratch (no canonical import
-- required). Adds provenance columns and a single SECURITY
-- DEFINER RPC that creates club → team → team_space → creator
-- membership in one transaction.
--
-- No new RLS: all writes go through the SECURITY DEFINER RPC,
-- so clubs/teams stay client-read-only (same pattern as
-- activate_team_space). activate_team_space() is kept for a
-- future "activate an imported/official team" flow.
-- ============================================================

-- ─── provenance columns ─────────────────────────────────────
-- created_by NULL = official/imported; set = user-created.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- All Heia team spaces are private; visibility is future-proofing
-- (RLS already enforces privacy at the team_space level).
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'invite_only'
    CHECK (visibility IN ('invite_only', 'public'));


-- ============================================================
-- create_team_from_scratch()
-- Creates a club (find-or-create by id/name), a team, an
-- activated team_space with a unique invite code, and the
-- creator's 'trener' membership — all in one transaction.
-- Returns { team_space_id, invite_code, membership_id }.
-- ============================================================
CREATE OR REPLACE FUNCTION create_team_from_scratch(
  p_team_name text,
  p_sport     text,
  p_age_group text,
  p_club_id   uuid DEFAULT NULL,
  p_club_name text DEFAULT NULL,
  p_gender    text DEFAULT NULL,
  p_level     text DEFAULT NULL,
  p_color     text DEFAULT '#6366F1'
)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_sport    uuid;
  v_club     uuid;
  v_team     uuid;
  v_space    uuid;
  v_member   uuid;
  v_code     text;
  v_attempts int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve sport by slug
  SELECT id INTO v_sport FROM public.sports WHERE slug = p_sport;
  IF v_sport IS NULL THEN
    RAISE EXCEPTION 'Unknown sport: %', p_sport;
  END IF;

  -- Resolve club: existing id, or create new by name (dedup deferred)
  IF p_club_id IS NOT NULL THEN
    v_club := p_club_id;
  ELSIF p_club_name IS NOT NULL AND length(trim(p_club_name)) > 0 THEN
    INSERT INTO public.clubs (name, created_by)
    VALUES (trim(p_club_name), v_uid)
    RETURNING id INTO v_club;
  ELSE
    RAISE EXCEPTION 'Club required: pass p_club_id or p_club_name';
  END IF;

  -- Create the team (user-created → created_by set, invite_only)
  INSERT INTO public.teams (
    club_id, sport_id, name, age_group, gender, level, created_by
  ) VALUES (
    v_club, v_sport, p_team_name, p_age_group, p_gender, p_level, v_uid
  )
  RETURNING id INTO v_team;

  -- Generate a unique invite code (reuse generate_invite_code + retry)
  LOOP
    v_code := generate_invite_code();
    v_attempts := v_attempts + 1;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.team_spaces WHERE invite_code = v_code
    );
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique invite code';
    END IF;
  END LOOP;

  -- Create the activated team space
  INSERT INTO public.team_spaces (
    team_id, display_name, color, invite_code,
    is_activated, activated_at, activated_by
  ) VALUES (
    v_team, p_team_name, p_color, v_code,
    true, now(), v_uid
  )
  RETURNING id INTO v_space;

  -- Creator becomes the initial trener
  INSERT INTO public.memberships (
    user_id, team_space_id, role, status, joined_at
  ) VALUES (
    v_uid, v_space, 'trener', 'active', now()
  )
  RETURNING id INTO v_member;

  RETURN jsonb_build_object(
    'team_space_id', v_space,
    'invite_code', v_code,
    'membership_id', v_member
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
