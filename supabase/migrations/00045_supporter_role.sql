-- ============================================================
-- 00045 — supporter-rollen (Brages beslutning 2026-08-03, LÅST).
--
-- Besteforeldre/tanter/venner melder seg inn NØYAKTIG som foreldre:
-- samme invitasjonskode, samme rettigheter — eneste forskjell er
-- etiketten. Rollen er IKKE admin (is_team_admin er uendret) og har
-- ingen barnekobling.
--
-- Dette lukker «ikke-medlem-støtte»-flagget i betalingssporet: en
-- supporter ER medlem, så den medlemsgatede checkouten
-- (stripe-checkout) virker uendret — web-checkout trengs ikke.
--
-- To berøringspunkter i DB (resten av systemet er rolle-agnostisk
-- eller svarteliste-basert og trenger INGEN endring — verifisert i
-- kodegjennomgangen 2026-08-03: remove_team_member nekter kun
-- trener/lagleder/admin, RSVP/feed/checkout gater på medlemskap):
--   1. CHECK-constrainten på memberships.role
--   2. rollelisten i join_team_space()
-- ============================================================

ALTER TABLE public.memberships
  DROP CONSTRAINT memberships_role_check;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('trener','lagleder','admin','forelder','spiller','supporter'));


-- ============================================================
-- join_team_space() — uendret fra 00015 bortsett fra rollelisten.
-- ============================================================
CREATE OR REPLACE FUNCTION join_team_space(
  p_invite_code      text,
  p_role             text DEFAULT 'forelder',
  p_managed_child_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_space     record;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate role
  IF p_role NOT IN ('trener','lagleder','admin','forelder','spiller','supporter') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- If managed_child_id provided, role must be forelder
  IF p_managed_child_id IS NOT NULL AND p_role != 'forelder' THEN
    RAISE EXCEPTION 'Role must be forelder when managed_child_id is set';
  END IF;

  -- Validate managed child belongs to user's household
  IF p_managed_child_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.managed_children mc
      WHERE mc.id = p_managed_child_id
        AND mc.managed_by = v_uid
    ) THEN
      RAISE EXCEPTION 'Child does not belong to this user';
    END IF;
  END IF;

  -- Find the team space
  SELECT ts.id, ts.display_name
  INTO v_space
  FROM public.team_spaces ts
  WHERE ts.invite_code = upper(p_invite_code)
    AND ts.deleted_at IS NULL
    AND ts.is_activated = true;

  IF v_space IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- Check not already active member (with same child)
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.team_space_id = v_space.id
      AND m.status = 'active'
      AND COALESCE(m.managed_child_id, '00000000-0000-0000-0000-000000000000')
        = COALESCE(p_managed_child_id, '00000000-0000-0000-0000-000000000000')
  ) THEN
    RAISE EXCEPTION 'Already an active member';
  END IF;

  -- Create membership
  INSERT INTO public.memberships (
    user_id, team_space_id, role, status, managed_child_id, joined_at
  ) VALUES (
    v_uid, v_space.id, p_role, 'active', p_managed_child_id, now()
  )
  RETURNING id INTO v_member_id;

  RETURN jsonb_build_object(
    'membership_id', v_member_id,
    'team_space_id', v_space.id,
    'display_name', v_space.display_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- get_team_members() — uendret fra 00027 bortsett fra eksplisitt
-- supporter-gren i sorteringen (uten den havnet supporter sist via
-- NULL uansett, men implisitt sortering er skjør ved neste rolle).
-- Telefon-grensen består: admin ser voksnes nummer — supportere er
-- voksne, så de behandles som foreldre.
-- ============================================================
CREATE OR REPLACE FUNCTION get_team_members(ts_id uuid)
RETURNS TABLE (
  membership_id    uuid,
  user_id          uuid,
  display_name     text,
  avatar_url       text,
  role             text,
  status           text,
  joined_at        timestamptz,
  managed_child_id uuid,
  child_name       text,
  phone            text
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_is_admin := is_team_admin(ts_id);

  RETURN QUERY
  SELECT
    m.id AS membership_id,
    m.user_id,
    p.display_name,
    p.avatar_url,
    m.role,
    m.status,
    m.joined_at,
    m.managed_child_id,
    mc.display_name AS child_name,
    CASE
      WHEN m.user_id = auth.uid() THEN p.phone
      WHEN v_is_admin AND m.role <> 'spiller' THEN p.phone
      ELSE NULL
    END AS phone
  FROM public.memberships m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.managed_children mc ON mc.id = m.managed_child_id
  WHERE m.team_space_id = ts_id
    AND m.status IN ('active', 'invited')
  ORDER BY
    CASE m.role
      WHEN 'trener' THEN 1
      WHEN 'lagleder' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'forelder' THEN 4
      WHEN 'spiller' THEN 5
      WHEN 'supporter' THEN 6
    END,
    p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
