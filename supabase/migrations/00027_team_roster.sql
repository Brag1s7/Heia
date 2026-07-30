-- ============================================================
-- 00027_team_roster.sql
-- Lagoversikt: get_team_members() returnerer også telefonnummer.
--
-- Bakgrunn: laget var usynlig i appen — foreldre så ikke hvem andre som
-- var med, og trenere hadde ingen måte å nå én forelder på. Telefonnummer
-- i lagoversikten er det bevisste (og trygge) svaret på det behovet, i
-- stedet for direktemeldinger mellom voksne og barn.
--
-- To grenser håndheves her i SECURITY DEFINER-funksjonen, ikke i UI-et:
--   1. Bare lagadmin (trener/lagleder/admin) får se andres telefonnummer.
--   2. Spillerkontoer — som i praksis er barna — får ALDRI telefonnummeret
--      sitt eksponert til noen. Voksne når barnet gjennom forelderen.
-- Du ser alltid ditt eget nummer, uansett rolle.
-- ============================================================

-- Returtypen endres, så funksjonen må slippes først.
DROP FUNCTION IF EXISTS get_team_members(uuid);

CREATE FUNCTION get_team_members(ts_id uuid)
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
    END,
    p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
