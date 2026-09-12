-- ============================================================
-- 00086 — FEEDEN SLUTTER Å BETALE EN EKSTRA RUNDTUR (punkt 100)
--
-- `get_team_feed` sier hvor mange som har reagert, men ikke om JEG har
-- det. Klienten har derfor alltid sendt en ekstra spørring mot
-- `reactions` ETTER at feeden er hentet — og den kan ikke parallelliseres,
-- for den trenger post-id-ene fra svaret. Målt i
-- `__tests__/bootHttpBudget.test.tsx`: ett ekstra kall i alle tre
-- oppstartsscenariene, og 150–300 ms lagt til HVER feed-åpning på
-- mobilnett.
--
-- ⚠️ KOLONNEN HETER `my_reactions`, IKKE `i_reacted`, OG DET ER MED VILJE.
-- 00071 (kampfeeden) tok nøyaktig dette valget og skrev ned hvorfor:
--
--     «👏 er appens merkevare-emoji, og den bor ETT sted: HEIA_EMOJI i
--      src/lib/api/feed.ts. Returnerer vi et ferdig heia_count må emojien
--      hardkodes her også, og da har den to hjem som kan drifte fra
--      hverandre. […] my_reactions lar klienten avgjøre «har JEG heiet»
--      med den samme konstanten — uten den ekstra reactions-spørringen
--      feeden betaler per skjermlast i dag.»
--
-- Denne migrasjonen er den siste setningen i det sitatet, gjort.
-- Emojien forblir uskrevet i SQL.
--
-- ---------------------------------------------------------------------
-- HVORFOR DROP OG IKKE CREATE OR REPLACE
--
-- Returtypen endres (én kolonne til), og PostgreSQL nekter å erstatte en
-- funksjon med ny returtype. Signaturen (uuid, int, timestamptz) er
-- UENDRET, så alle kallsteder — inkludert bygg 1.0 (4) som står på
-- telefonene i dag — treffer den samme funksjonen som før.
--
-- ⚠️ 00061-FELLA: en DROP tar rettighetene med seg. GRANT-linjene nederst
-- er ikke pynt — uten dem er feeden borte for alle.
--
-- BAKOVERKOMPATIBILITET (bevist i scripts/verify-00086.sql, test B4):
-- de 22 gamle kolonnene står i SAMME REKKEFØLGE med samme typer, og
-- `my_reactions` er lagt til SIST. PostgREST leverer JSON, så en klient
-- som ikke kjenner nøkkelen ser den ikke. 1.0 (4) fortsetter å gjøre sin
-- egen reactions-spørring og oppfører seg nøyaktig som før.
--
-- SIKKERHET, samme slengen: funksjonen er SECURITY DEFINER og hadde
-- INGEN `search_path` (målt i prod 2026-09-12: proconfig = null). Den er
-- altså én av de 83 i punkt 98. Når vi først gjenskaper den, settes den —
-- `pg_temp` SIST, som resten av huset (00077).
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
  match_event_type    text,
  match_event_side    text,
  -- ⚠️ SIST I LISTA. Rekkefølgen på de 21 over er kontrakten mot klienter
  -- som allerede er ute; nye kolonner legges til bakerst, aldri imellom.
  my_reactions        text[]
) AS $$
DECLARE
  v_uid uuid := auth.uid();
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
    me.team_side   AS match_event_side,
    (
      -- Mine egne reaksjoner på posten. Tom array (ikke NULL) når jeg ikke
      -- har reagert, så klienten slipper en null-sjekk per rad. Ordrett
      -- samme uttrykk som `get_match_feed` (00071).
      SELECT COALESCE(array_agg(r2.emoji), ARRAY[]::text[])
      FROM public.reactions r2
      WHERE r2.feed_post_id = fp.id AND r2.user_id = v_uid
    ) AS my_reactions
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

-- ⚠️ 00061-FELLA. Uten disse linjene er feeden borte for alle.
-- Gjenoppretter NØYAKTIG den ACL-en som ble målt i prod 2026-09-12:
--   postgres=X/postgres authenticated=X/postgres service_role=X/postgres
REVOKE ALL ON FUNCTION public.get_team_feed(uuid, int, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_feed(uuid, int, timestamptz)
  TO authenticated, service_role;

-- ============================================================
-- TILBAKEFØRING: scripts/rollback-00086.sql
--   node scripts/run-sql.mjs scripts/rollback-00086.sql
-- Den gjenskaper 00072-definisjonen ORDRETT (uten search_path, slik den
-- faktisk sto) og den samme ACL-en. `git checkout` er ikke en
-- database-tilbakeføring.
--
-- BEVIS: scripts/verify-00086.sql
--   node scripts/run-sql.mjs scripts/verify-00086.sql
-- Den tørrkjører HELE migrasjonen + tilbakeføringen i én subtransaksjon
-- som rulles tilbake, og sammenlikner md5 av funksjonsdefinisjonen og
-- ACL-en før og etter.
-- ============================================================
