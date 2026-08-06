-- ============================================================
-- 00050 — laglogo i invitasjons-forhåndsvisningen
--
-- Brages ønske (2026-08-05): når man skriver inn koden på
-- «Bli med i laget», skal kortet vise lagets LOGO der det i dag
-- bare viser en fargeflate — når laget faktisk har lastet opp en.
--
-- Appen har allerede kjeden (TeamBadge: laglogo → klubblogo →
-- initialer på lagfarge). Det eneste som manglet var at
-- lookup_invite_code() aldri returnerte URL-en, så innmeldings-
-- kortet var det ene stedet merket ikke kunne vises.
--
-- Fallbacken gjøres i SQL (coalesce) av samme grunn som i
-- appen: et lag uten egen logo tilhører ofte en klubb som HAR
-- en, og klubbmerket er riktigere enn to bokstaver.
--
-- Bildet ligger i den OFFENTLIGE club-logos-bucketen (00034), så
-- en gjest som ennå ikke har logget inn kan laste det. Ingen
-- rettighetsendring her: funksjonen er uendret STABLE/SECURITY
-- DEFINER og krever fortsatt en gyldig, aktiv invitasjonskode.
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_invite_code(code text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ts.id,
    'display_name', ts.display_name,
    'color', ts.color,
    'logo_url', coalesce(ts.logo_url, c.logo_url),
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
