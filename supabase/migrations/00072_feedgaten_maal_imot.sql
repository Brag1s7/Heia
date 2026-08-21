-- ============================================================
-- 00072_feedgaten_maal_imot.sql
-- P1 i feeden: ingen HEIA på mål imot — heller ikke fra Hjem-skjermen.
--
-- ---------------------------------------------------------------------------
-- HVA SOM FAKTISK ER GALT I DAG
--
-- P1 er LÅST: «Ingen HEIA på mål imot — verken i kampen ELLER i feeden.»
-- Kampskjermen har respektert det siden skive 4 (`allowsHeia`,
-- src/shared/matchEngagement.ts). Feeden har ikke kunnet det, fordi den ikke
-- VET hva posten er: `get_team_feed` (00029 → 00070) returnerer bare
-- `match_minute`, `match_status`, `match_home` og `match_away`. Et baklengsmål
-- og en beskjed fra treneren ser identiske ut for klienten, og HEIA-pillen
-- tegnes på begge.
--
-- Det er samme kanoniske post som i kampen. En HEIA i feeden ville altså
-- dukket opp på det samme målet inne i kampskjermen, der knappen bevisst
-- ikke finnes.
--
-- ---------------------------------------------------------------------------
-- INGEN SKJEMAENDRING. To kolonner ut av en join som ALLEREDE er der.
--
-- `LEFT JOIN public.match_events me ON me.id = fp.match_event_id` har stått i
-- funksjonen siden 00029 — den brukes til `me.minute`. Vi leser `me.type` og
-- `me.team_side` fra den samme raden. Ingen ny join, ingen ny indeks, ingen
-- ekstra rundtur.
--
-- ---------------------------------------------------------------------------
-- ⚠️ EGEN MIGRASJON, IKKE SLÅTT SAMMEN MED 00071 (P1, ordrett)
--
-- «Ikke i samme migrasjon: en grant-feil skal ikke kunne ta ned feeden og
-- kampen på én gang.» 00071 er i prod og verifisert; denne rører kun feeden.
--
-- ⚠️ DROP+CREATE ⇒ GRANTENE FORSVINNER MED FUNKSJONEN (00061-fella).
-- Ny kolonne i RETURNS TABLE kan ikke gjøres med CREATE OR REPLACE. Grantene
-- gjenskapes nederst — uten dem mister appen feeden i samme sekund.
-- Kontrollér vanlig medlemsadgang eksplisitt etterpå (se KONTROLL nederst).
--
-- ---------------------------------------------------------------------------
-- ⚠️ GATEN ER I KLIENTEN, IKKE I SKRIVERETTIGHETENE — OG DET ER MED VILJE.
--
-- Denne migrasjonen gir klienten det den trenger for å la være å TEGNE
-- knappen. Den hindrer ikke en spesiallaget klient i å skrive en reaksjon på
-- et baklengsmål. Det er samme nivå som kampskjermen har i dag, og å legge en
-- policy/trigger på `reactions` her ville vært å endre skriverettigheter i en
-- migrasjon som ellers bare leser.
--
-- ➡️ Hører hjemme i SKIVE 8 (P3/angre), som uansett åpner RLS-policyene og
--    stenger «Slett innlegget» for systemgenererte målposter. Da gjøres
--    skrivesidens gate ETT sted, med prod-verifisering, i stedet for i to
--    halve slag.
-- ============================================================

-- ============================================================
-- get_team_feed — + match_event_type, match_event_side
-- Ellers ORDRETT 00070.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_team_feed(uuid, int, timestamptz);

CREATE FUNCTION public.get_team_feed(
  ts_id  uuid,
  lim    int DEFAULT 20,
  cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  type                text,
  content             text,
  is_pinned           boolean,
  created_at          timestamptz,
  event_id            uuid,
  match_event_id      uuid,
  author_id           uuid,
  author_name         text,
  author_avatar       text,
  author_avatar_color text,
  author_role         text,
  comment_count       bigint,
  reaction_counts     jsonb,
  media               jsonb,
  match_minute        int,
  match_status        text,
  match_home          int,
  match_away          int,
  -- P1: hva øyeblikket ER. NULL for alt som ikke er en kamphendelse — altså
  -- for de aller fleste postene i feeden, som skal beholde HEIA som før.
  match_event_type    text,
  match_event_side    text
) AS $$
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fp.id,
    fp.type,
    fp.content,
    fp.is_pinned,
    fp.created_at,
    fp.event_id,
    fp.match_event_id,
    p.id AS author_id,
    p.display_name AS author_name,
    p.avatar_url AS author_avatar,
    p.avatar_color AS author_avatar_color,
    m.role AS author_role,
    (
      SELECT count(*)
      FROM public.comments c
      WHERE c.feed_post_id = fp.id AND c.deleted_at IS NULL
    ) AS comment_count,
    (
      SELECT jsonb_object_agg(sub.emoji, sub.cnt)
      FROM (
        SELECT r.emoji, count(*) AS cnt
        FROM public.reactions r
        WHERE r.feed_post_id = fp.id
        GROUP BY r.emoji
      ) sub
    ) AS reaction_counts,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', med.id,
          'storage_path', med.storage_path,
          'thumbnail_path', med.thumbnail_path,
          'mime_type', med.mime_type
        ) ORDER BY ma.sort_order
      )
      FROM public.media_attachments ma
      JOIN public.media med ON med.id = ma.media_id
      WHERE ma.entity_type = 'feed_post'
        AND ma.entity_id = fp.id
        AND med.deleted_at IS NULL
    ) AS media,
    me.minute      AS match_minute,
    ms.status      AS match_status,
    ms.home_score  AS match_home,
    ms.away_score  AS match_away,
    me.type        AS match_event_type,
    me.team_side   AS match_event_side
  FROM public.feed_posts fp
  LEFT JOIN public.profiles p ON p.id = fp.author_id
  LEFT JOIN public.memberships m
    ON m.user_id = fp.author_id
    AND m.team_space_id = ts_id
    AND m.status = 'active'
    AND m.managed_child_id IS NULL
  LEFT JOIN public.match_events me ON me.id = fp.match_event_id
  LEFT JOIN public.match_sessions ms ON ms.event_id = fp.event_id
  WHERE fp.team_space_id = ts_id
    AND fp.deleted_at IS NULL
    AND (cursor IS NULL OR fp.created_at < cursor)
  ORDER BY fp.is_pinned DESC, fp.created_at DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ⚠️ 00061-FELLA. Uten disse to linjene er feeden borte for alle.
REVOKE ALL ON FUNCTION get_team_feed(uuid, int, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_feed(uuid, int, timestamptz) TO authenticated;


-- ============================================================
-- KONTROLL ETTER PUSH (kjøres manuelt, ikke av migrasjonen)
--
--   1) Grantene finnes, og anon har INGEN:
--      SELECT grantee, privilege_type
--        FROM information_schema.role_routine_grants
--       WHERE routine_name = 'get_team_feed';
--      ⇒ forventet: KUN 'authenticated' (+ eier). Står 'anon' der, STOPP.
--
--   2) Et vanlig medlem får fortsatt feeden sin (ikke bare eieren):
--      logg inn som medlem i appen og last Hjem. Tom feed = grant-feil,
--      ikke tom database.
--
--   3) Kolonnene bærer verdi på et ekte mål:
--      SELECT content, match_event_type, match_event_side
--        FROM get_team_feed('<team_space_id>', 50)
--       WHERE match_event_type IS NOT NULL;
--      ⇒ et baklengsmål skal ha ('mål', 'away').
-- ============================================================
