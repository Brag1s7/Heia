-- ============================================================
-- 00070_avatar_farge.sql
-- SELVVALGT AVATARFARGE — del to av profilbilde-skiva.
--
-- BRAGES BESLUTNING 2026-08-19 (etter at 00068 var telefontestet OK):
-- fargen er IKKE en unik identifikator og skal ikke behandles som en.
-- Den gir personlighet, og den er et godt alternativ for brukere som
-- BEVISST ikke vil ha profilbilde. Det er et reelt segment i en app for
-- ungdomslag, og for dem er avataren ellers to bokstaver i en farge de
-- ikke har valgt.
--
-- ⚠️ DERFOR ER DEN HELLER IKKE PÅKREVD. NULL = ingen valgt farge, og da
-- gjelder navne-hashen som før. Alle eksisterende kontoer ser nøyaktig
-- like ut etter denne migrasjonen som før den — ingen backfill, ingen
-- default. Fargen dukker opp først i det noen velger en.
--
-- FORMAT-CHECK, IKKE VERDI-CHECK. Paletten er kuratert i appen
-- (src/shared/avatarColors.ts), ikke låst i basen — nøyaktig samme valg
-- som `team_spaces.color` (00007) tok for lagfargen. Å legge til en
-- farge skal ikke kreve en migrasjon. Eksponeringen er dessuten mindre
-- her enn for lagfargen: en rå-klient som setter en vilkårlig hex
-- påvirker bare sin EGEN avatar, ikke en hel lagflate.
--
-- HVORFOR TRE FUNKSJONER MÅ RØRES: fargen er verdiløs hvis den bare
-- vises for deg selv. Den må følge personen dit personen VISES, og de
-- tre leseflatene er get_team_feed (forfatteren i feeden),
-- get_team_members (lagoversikten) og get_team_authors (kommentarene,
-- inkludert utmeldte forfattere). Alle tre får ny kolonne i RETURNS
-- TABLE, altså DROP + CREATE + GJENSKAPTE 00060-GRANTS — den fella
-- kostet en runde i 00061 og står dokumentert i 00067.
--
-- ⚠️ VARSLENE ER BEVISST IKKE MED. `notifications.data` FRYSER
-- avsenderen (00051: «et varsel er et historisk faktum»), og det er
-- riktig for navn og bilde: de VAR sånn da det skjedde. En farge er
-- ikke et historisk faktum, den er en stående preferanse — fryses den,
-- ville et gammelt varsel vist en farge du forlot for lenge siden.
-- Appen slår derfor opp fargen live fra forfatter-cachen i
-- varsellista. Ingen av de tre trigger-funksjonene røres.
--
-- ⚠️ KJENT OG AKSEPTERT: `delete_account_data` nuller `display_name` og
-- `avatar_url`, men ikke denne kolonnen — funksjonen røres ikke her
-- (150 linjer som ville måttet kopieres for én linjes gevinst). En
-- slettet konto beholder altså fargen sin bak «Slettet bruker».
-- Det lekker ingenting: spøkelsene har allerede hver sin profil-id, som
-- appen ser, så fargen skiller ikke to slettede brukere fra hverandre
-- på noen måte id-en ikke allerede gjør. Tas hvis funksjonen uansett
-- skal endres.
-- ============================================================


-- ============================================================
-- 1) Kolonnen
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN avatar_color text
    CHECK (avatar_color ~ '^#[0-9a-fA-F]{6}$');

COMMENT ON COLUMN public.profiles.avatar_color IS
  'Selvvalgt bakgrunnsfarge for initial-avataren (#RRGGBB). NULL = ingen '
  'valgt farge; appen faller da tilbake på navne-hashen (AVATAR_HASH_COLORS '
  'i src/shared/avatarColors.ts). Ikke en identifikator — flere kan ha samme. '
  'Vises kun når personen ikke har profilbilde. Se 00070.';


-- ============================================================
-- 2) get_team_feed — + author_avatar_color
--    Ellers ORDRETT 00029. Ny kolonne i RETURNS TABLE ⇒ DROP+CREATE,
--    og da forsvinner 00060-grantene med funksjonen. De gjenskapes
--    nederst; uten det mister appen feeden i samme sekund.
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
  match_away          int
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
    ms.away_score  AS match_away
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

REVOKE ALL ON FUNCTION get_team_feed(uuid, int, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_feed(uuid, int, timestamptz) TO authenticated;


-- ============================================================
-- 3) get_team_members — + avatar_color. Ellers ORDRETT 00067 E1.
-- ============================================================
DROP FUNCTION IF EXISTS get_team_members(uuid);

CREATE FUNCTION get_team_members(ts_id uuid)
RETURNS TABLE (
  membership_id    uuid,
  user_id          uuid,
  display_name     text,
  avatar_url       text,
  avatar_color     text,
  role             text,
  status           text,
  joined_at        timestamptz,
  managed_child_id uuid,
  child_name       text,
  phone            text,
  requested_role   text
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
    p.avatar_color,
    m.role,
    m.status,
    m.joined_at,
    m.managed_child_id,
    mc.display_name AS child_name,
    CASE
      WHEN m.user_id = auth.uid() THEN p.phone
      WHEN v_is_admin AND m.role <> 'spiller' THEN p.phone
      ELSE NULL
    END AS phone,
    m.requested_role
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

REVOKE ALL ON FUNCTION get_team_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_members(uuid) TO authenticated;


-- ============================================================
-- 4) get_team_authors — + avatar_color. Ellers ORDRETT 00067 E2.
--    Fortsatt kun navn/farge/avatar/rolle: aldri telefon, aldri barn,
--    aldri status (00066-innstrammingen står).
-- ============================================================
DROP FUNCTION IF EXISTS get_team_authors(uuid);

CREATE FUNCTION get_team_authors(ts_id uuid)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  avatar_color text,
  role         text
) AS $$
BEGIN
  IF NOT is_team_member(ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    p.display_name,
    p.avatar_url,
    p.avatar_color,
    m.role
  FROM public.memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.team_space_id = ts_id
  ORDER BY m.user_id,
    (m.status = 'active') DESC,
    (m.managed_child_id IS NULL) DESC,
    m.joined_at DESC NULLS LAST,
    m.id DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION get_team_authors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_team_authors(uuid) TO authenticated;
