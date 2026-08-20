-- ============================================================
-- 00071_kampfeed.sql
-- Kampens engasjement: HEIA og kommentarer på øyeblikkene i kampforløpet.
--
-- ---------------------------------------------------------------------------
-- INGEN SKJEMAENDRING. SKRIVESTIEN ER ALLEREDE ROBUST.
--
-- `report_match_event` (00021:150-153) og `start_match` (00020:82-89) gjør en
-- UBETINGET `INSERT INTO feed_posts (…, match_event_id)` i samme transaksjon
-- som hendelsen, utenfor alle IF-grener. Alle seks typene som kan opprettes
-- fra appen får derfor sin post, og koblingen har alltid vært der.
--
-- Det som manglet var LESESTIEN: `get_event_with_rsvp` returnerer ingen
-- feed_post_id (00020:289-303), så klienten kunne se hendelsen, men ikke
-- finne posten engasjementet henger på. Denne RPC-en er den lesestien.
--
-- ---------------------------------------------------------------------------
-- INGEN INDEKS PÅ `match_event_id`.
--
-- Vi filtrerer på `fp.event_id`, som allerede er indeksert
-- (`idx_feed_posts_event_id`, 00060:96-98), og grupperer klientside — samme
-- mønster som `MatchTimeline` bruker for bildene. En indeks på
-- `match_event_id` ville vært død vekt på en tabell som skrives til i
-- kampens mest tidskritiske øyeblikk.
--
-- ---------------------------------------------------------------------------
-- INGEN UNIQUE PÅ `match_event_id`.
--
-- Koblingen er 1:N MED VILJE: et kampbilde bærer samme `match_event_id`
-- (00028:5-8, `createImagePost`), så «her jubler Thomas» henger på 1–0-målet.
-- En unique-constraint ville brutt bildeopplasting og kunne feilet mot
-- eksisterende prod-data. Den KANONISKE posten velges i stedet deterministisk
-- klientside: eldste rad der `post_type <> 'bilde'` — se
-- `src/shared/matchEngagement.ts`.
--
-- ---------------------------------------------------------------------------
-- HVORFOR `reaction_counts` OG `my_reactions`, OG IKKE `heia_count`/`i_reacted`
--
-- 👏 er appens merkevare-emoji, og den bor ETT sted: `HEIA_EMOJI` i
-- `src/lib/api/feed.ts`. Returnerer vi et ferdig `heia_count` må emojien
-- hardkodes her også, og da har den to hjem som kan drifte fra hverandre.
-- `reaction_counts` er ordrett formen `get_team_feed` (00029/00070) allerede
-- returnerer, og `my_reactions` lar klienten avgjøre «har JEG heiet» med den
-- samme konstanten — uten den ekstra `reactions`-spørringen feeden betaler
-- per skjermlast i dag.
-- ============================================================

CREATE OR REPLACE FUNCTION get_match_feed(evt_id uuid)
RETURNS TABLE (
  post_id         uuid,
  match_event_id  uuid,
  post_type       text,
  created_at      timestamptz,
  comment_count   bigint,
  reaction_counts jsonb,
  my_reactions    text[]
) AS $$
DECLARE
  v_ts_id uuid;
  v_uid   uuid := auth.uid();
BEGIN
  SELECT e.team_space_id INTO v_ts_id
  FROM public.events e
  WHERE e.id = evt_id;

  IF v_ts_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_member(v_ts_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fp.id   AS post_id,
    fp.match_event_id,
    fp.type AS post_type,
    fp.created_at,
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
      -- Mine egne reaksjoner på posten. Tom array (ikke NULL) når jeg ikke
      -- har reagert, så klienten slipper en null-sjekk per rad.
      SELECT COALESCE(array_agg(r.emoji), ARRAY[]::text[])
      FROM public.reactions r
      WHERE r.feed_post_id = fp.id AND r.user_id = v_uid
    ) AS my_reactions
  FROM public.feed_posts fp
  WHERE fp.event_id = evt_id
    AND fp.deleted_at IS NULL
  -- Eldste først: det kanoniske valget klientside er «eldste rad som ikke er
  -- et bilde», og da skal rekkefølgen komme fra serveren, ikke fra en
  -- klientsortering som kan gjøres feil på neste refaktorering.
  ORDER BY fp.created_at ASC, fp.id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Funksjonsdøren er lukket for anon, åpen for innloggede — `is_team_member`
-- over vokter innenfor. Samme mønster som 00060/00061.
REVOKE ALL ON FUNCTION get_match_feed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_match_feed(uuid) TO authenticated;
