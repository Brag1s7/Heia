-- ============================================================
-- 00073_kampuret.sql
-- P2: kampuret viser FAKTISK SPILT TID, og serveren eier det.
--
-- ---------------------------------------------------------------------------
-- HVA SOM ER GALT I DAG
--
-- Klokka er `now() - started_at`, overalt. Den teller altså VIDERE gjennom
-- pausen — både i appen (tre uavhengige regnestykker: `EventDetailScreen`,
-- `LiveMatchBanner`, `InboxScreen`) og på serveren, som stempler
-- `match_events.minute` med `FLOOR((now() - started_at)/60)` (00020:175,
-- 00021:95). En kamp med 15 minutters pause viser 15 minutter for mye resten
-- av kampen, og de minuttene står permanent i kampforløpet.
--
-- P2 er låst: klokka starter ved avspark, FRYSES i pause, og andre omgang
-- fortsetter fra minuttet første omgang sluttet. Ingen normert 45/35/30/25,
-- ingen «45+2», ingen ekstra opplysning ved kampstart.
--
-- ---------------------------------------------------------------------------
-- MODELLEN: AKKUMULERT TID + NÅR KLOKKA SIST STARTET
--
--   played_seconds    spilletid fram til forrige stopp
--   clock_started_at  når klokka sist ble startet; NULL = den står
--
--   spilt tid nå = played_seconds + (clock_started_at IS NULL
--                                     ? 0 : now() - clock_started_at)
--
-- Det er to tall og ingen historikk å tolke. Alternativet — å summere
-- pausene fra `match_events` hver gang — ville gjort klokka avhengig av at
-- forløpet er komplett og korrekt sortert, og skive 8 (angre) kommer til å
-- fjerne hendelser fra det forløpet.
--
-- ⚠️ `started_at` SKAL ALDRI SKRIVES OM. Historikken er historikk: den sier
-- når kampen faktisk begynte, og brukes av alt som spør «når var dette».
-- Klokka er `clock_started_at`. De to er IKKE det samme etter første pause.
--
-- ---------------------------------------------------------------------------
-- ⚠️⚠️ DEPLOYREKKEFØLGE (P2, ordrett): SERVER FØRST, VERIFISERT MED EN
-- MANUELL PAUSE/GJENOPPTA-RUNDE MOT PROD, DERETTER APP.
--
-- Motsatt rekkefølge gir en skjerm som viser 25′ over en tidslinje som sier
-- 35′. Appen i denne grenen TÅLER at migrasjonen mangler — da faller
-- `src/shared/matchClock.ts` tilbake på dagens `now() - started_at` — men
-- den tåler IKKE at appen er eldre enn serveren og fortsatt regner selv.
-- ============================================================


-- ============================================================
-- 1) Kolonnene
-- ============================================================
ALTER TABLE public.match_sessions
  ADD COLUMN IF NOT EXISTS played_seconds int NOT NULL DEFAULT 0
    CHECK (played_seconds >= 0),
  ADD COLUMN IF NOT EXISTS clock_started_at timestamptz;

COMMENT ON COLUMN public.match_sessions.played_seconds IS
  'Akkumulert FAKTISK SPILT TID i sekunder, fram til forrige stopp. Legges '
  'på ved pause og ved slutt. Se 00073 (P2).';

COMMENT ON COLUMN public.match_sessions.clock_started_at IS
  'Når kampuret sist ble startet (avspark eller andre omgang). NULL = uret '
  'står (pause, ferdig, ikke begynt). ⚠️ IKKE det samme som started_at, som '
  'aldri skrives om. Se 00073 (P2).';


-- ============================================================
-- 2) Den ENE formelen
--    Serveren stempler `match_events.minute` med denne. Appen regner det
--    samme i `src/shared/matchClock.ts` — to implementasjoner av én formel,
--    fordi appen må telle videre mellom rundturene.
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_played_seconds(
  p_played int,
  p_clock  timestamptz
)
RETURNS int AS $$
  SELECT GREATEST(
    0,
    COALESCE(p_played, 0)
      + CASE
          WHEN p_clock IS NULL THEN 0
          ELSE FLOOR(EXTRACT(EPOCH FROM (now() - p_clock)))::int
        END
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.match_played_seconds(int, timestamptz) IS
  'Faktisk spilt tid NÅ, i sekunder. STABLE (ikke IMMUTABLE) — den leser '
  'now(). Se 00073 (P2).';

REVOKE ALL ON FUNCTION public.match_played_seconds(int, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_played_seconds(int, timestamptz)
  TO authenticated;


-- ============================================================
-- 3) BACKFILL — ingen kamp skal hoppe i det migrasjonen kjører
--
-- ⚠️ Vi kan ikke rekonstruere pausene som allerede har vært; de finnes ikke
-- som varighet noe sted. Målet er derfor beskjedent og eksplisitt: vis det
-- SAMME som appen viser i dag, i det øyeblikket migrasjonen kjører, og la
-- den nye modellen gjelde derfra.
--
--   live    → uret går, og har «gått» siden avspark  (som i dag)
--   pause   → uret FRYSES nå, på det tallet som står  (ny oppførsel, ønsket)
--   ferdig  → fryst på finished_at − started_at
-- ============================================================
UPDATE public.match_sessions
SET played_seconds = 0,
    clock_started_at = started_at
WHERE started_at IS NOT NULL
  AND status = 'live'
  AND clock_started_at IS NULL
  AND played_seconds = 0;

UPDATE public.match_sessions
SET played_seconds = GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (now() - started_at)))::int
    ),
    clock_started_at = NULL
WHERE started_at IS NOT NULL
  AND status = 'pause'
  AND clock_started_at IS NULL
  AND played_seconds = 0;

UPDATE public.match_sessions
SET played_seconds = GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at)))::int
    ),
    clock_started_at = NULL
WHERE started_at IS NOT NULL
  AND status = 'ferdig'
  AND clock_started_at IS NULL
  AND played_seconds = 0;


-- ============================================================
-- 4) start_match — ORDRETT 00020, bortsett fra at uret startes
-- ============================================================
CREATE OR REPLACE FUNCTION start_match(p_event_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_evt  record;
  v_ms   record;
  v_me   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_evt
  FROM public.events
  WHERE id = p_event_id AND deleted_at IS NULL;

  IF v_evt IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT * INTO v_ms
  FROM public.match_sessions
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_ms IS NULL THEN
    RAISE EXCEPTION 'Event is not a match';
  END IF;

  IF NOT (
    is_team_admin(v_evt.team_space_id)
    OR COALESCE(v_ms.reporter_id = v_uid, false)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_ms.status <> 'planlagt' THEN
    RAISE EXCEPTION 'Match already started';
  END IF;

  -- Avspark: `started_at` settes ÉN gang, og uret starter samtidig. Fra og
  -- med første pause er de to tallene forskjellige.
  UPDATE public.match_sessions
  SET status           = 'live',
      started_at       = now(),
      clock_started_at = now(),
      played_seconds   = 0,
      reporter_id      = COALESCE(reporter_id, v_uid)
  WHERE id = v_ms.id
  RETURNING * INTO v_ms;

  INSERT INTO public.match_events
    (match_session_id, type, minute, description, reported_by, sequence)
  VALUES
    (v_ms.id, 'avspark', 0, 'Kampen er i gang', v_uid, 1)
  RETURNING id INTO v_me;

  INSERT INTO public.feed_posts
    (team_space_id, author_id, type, content, event_id, match_event_id)
  SELECT
    v_evt.team_space_id, v_uid, 'match_start',
    format('⚽ Kampen er i gang: %s mot %s', ts.display_name, v_ms.opponent),
    v_evt.id, v_me
  FROM public.team_spaces ts
  WHERE ts.id = v_evt.team_space_id;

  RETURN jsonb_build_object(
    'match_session_id',  v_ms.id,
    'reporter_id',       v_ms.reporter_id,
    'started_at',        v_ms.started_at,
    'clock_started_at',  v_ms.clock_started_at,
    'played_seconds',    v_ms.played_seconds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5) report_match_event — ORDRETT 00021, bortsett fra klokka
--
-- ⚠️ REKKEFØLGEN ER KRITISK: `v_minute` regnes FØR overgangene under.
-- Ellers ville pausehendelsen selv fått minuttet den fryser PÅ, og en
-- «andre_omgang» fått minuttet fra et ur som nettopp ble startet på nytt.
-- (Rekkefølgen er den samme som 00021 alltid har hatt — det er verdt å vite
-- at den nå BETYR noe.)
-- ============================================================
CREATE OR REPLACE FUNCTION report_match_event(
  p_match_session_id uuid,
  p_type             text,
  p_team_side        text DEFAULT NULL,
  p_description      text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_ms      record;
  v_evt     record;
  v_team    text;
  v_minute  int;
  v_seq     int;
  v_me      uuid;
  v_head    text;
  v_content text;
  v_desc    text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_feed    text := 'match_event';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_type NOT IN ('mål', 'pause', 'andre_omgang', 'slutt', 'melding') THEN
    RAISE EXCEPTION 'Unsupported match event type: %', p_type;
  END IF;

  IF p_type = 'mål' AND COALESCE(p_team_side, '') NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'A goal needs team_side home or away';
  END IF;

  IF p_type = 'melding' AND v_desc IS NULL THEN
    RAISE EXCEPTION 'A message needs a description';
  END IF;

  SELECT * INTO v_ms
  FROM public.match_sessions
  WHERE id = p_match_session_id
  FOR UPDATE;

  IF v_ms IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  SELECT * INTO v_evt FROM public.events WHERE id = v_ms.event_id;

  IF NOT (
    COALESCE(v_ms.reporter_id = v_uid, false)
    OR is_team_admin(v_evt.team_space_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_ms.status NOT IN ('live', 'pause') THEN
    RAISE EXCEPTION 'Match is not underway';
  END IF;

  IF p_type = 'pause' AND v_ms.status <> 'live' THEN
    RAISE EXCEPTION 'Match is not live';
  END IF;

  IF p_type = 'andre_omgang' AND v_ms.status <> 'pause' THEN
    RAISE EXCEPTION 'Match is not paused';
  END IF;

  -- FAKTISK SPILT TID — pausene er allerede trukket fra. Regnes før
  -- overgangene under, se kommentaren over funksjonen.
  v_minute := FLOOR(
    public.match_played_seconds(v_ms.played_seconds, v_ms.clock_started_at) / 60
  )::int;

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_seq
  FROM public.match_events
  WHERE match_session_id = v_ms.id;

  IF p_type = 'mål' THEN
    UPDATE public.match_sessions
    SET home_score = home_score + (CASE WHEN p_team_side = 'home' THEN 1 ELSE 0 END),
        away_score = away_score + (CASE WHEN p_team_side = 'away' THEN 1 ELSE 0 END)
    WHERE id = v_ms.id
    RETURNING * INTO v_ms;

  ELSIF p_type = 'pause' THEN
    -- Uret STOPPER: det som har gått legges på, og startpunktet nulles.
    -- ⚠️ `started_at` røres ikke.
    UPDATE public.match_sessions
    SET status           = 'pause',
        played_seconds   = public.match_played_seconds(played_seconds, clock_started_at),
        clock_started_at = NULL
    WHERE id = v_ms.id RETURNING * INTO v_ms;

  ELSIF p_type = 'andre_omgang' THEN
    -- Uret STARTER igjen, fra det tallet det sto på. Andre omgang
    -- fortsetter fra minuttet første omgang sluttet — det er hele P2.
    UPDATE public.match_sessions
    SET status           = 'live',
        clock_started_at = now()
    WHERE id = v_ms.id RETURNING * INTO v_ms;

  ELSIF p_type = 'slutt' THEN
    -- Fryser på sluttminuttet. `match_played_seconds` håndterer begge
    -- tilfellene: slutt blåst mens uret går, og slutt blåst i pause.
    UPDATE public.match_sessions
    SET status           = 'ferdig',
        finished_at      = now(),
        played_seconds   = public.match_played_seconds(played_seconds, clock_started_at),
        clock_started_at = NULL
    WHERE id = v_ms.id RETURNING * INTO v_ms;
    v_feed := 'match_end';
  END IF;

  INSERT INTO public.match_events
    (match_session_id, type, minute, team_side, description, reported_by, sequence)
  VALUES
    (v_ms.id, p_type, v_minute, p_team_side, v_desc, v_uid, v_seq)
  RETURNING id INTO v_me;

  SELECT display_name INTO v_team
  FROM public.team_spaces WHERE id = v_evt.team_space_id;

  v_head := CASE
    WHEN p_type = 'mål' AND p_team_side = 'home'
      THEN format('⚽ MÅL! %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'mål'
      THEN format('Mål til %s. %s %s–%s %s', v_ms.opponent, v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'pause'
      THEN format('⏸ Pause. %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'andre_omgang'
      THEN format('▶️ Andre omgang i gang. %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    WHEN p_type = 'slutt'
      THEN format('🏁 Slutt! %s %s–%s %s', v_team, v_ms.home_score, v_ms.away_score, v_ms.opponent)
    ELSE NULL
  END;

  v_content := btrim(COALESCE(v_head, '') || COALESCE(E'\n' || v_desc, ''));

  INSERT INTO public.feed_posts
    (team_space_id, author_id, type, content, event_id, match_event_id)
  VALUES
    (v_evt.team_space_id, v_uid, v_feed, v_content, v_evt.id, v_me);

  RETURN jsonb_build_object(
    'match_event_id', v_me,
    'minute',         v_minute,
    'home_score',     v_ms.home_score,
    'away_score',     v_ms.away_score,
    'status',         v_ms.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6) LESESTIEN — get_event_with_rsvp må bære de to tallene ut
--
-- Uten dette kan appen ikke regne klokka, og faller tilbake på
-- `now() - started_at`, altså feilen denne migrasjonen retter.
--
-- ⚠️ Funksjonen returnerer jsonb (ikke RETURNS TABLE), så CREATE OR REPLACE
-- holder — ingen DROP, og dermed ingen 00061-felle her.
--
-- ⚠️ ORDRETT 00020:245-393, med NØYAKTIG to nye nøkler i `match_session`.
-- Den er gjengitt i sin helhet med vilje: en `pg_get_functiondef` +
-- streng-erstatning i en DO-blokk ble prøvd først og forkastet — en
-- run-time omskriving av en SECURITY DEFINER-funksjon er ikke noe man skal
-- måtte stole på i prod, og den kan ikke leses i en diff.
-- ============================================================
CREATE OR REPLACE FUNCTION get_event_with_rsvp(evt_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_evt    record;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_evt
  FROM public.events
  WHERE id = evt_id AND deleted_at IS NULL;

  IF v_evt IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_member(v_evt.team_space_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'id', e.id,
    'type', e.type,
    'title', e.title,
    'description', e.description,
    'location', e.location,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'all_day', e.all_day,
    'created_by', e.created_by,
    -- Match session (null if not a match)
    'match_session', (
      SELECT jsonb_build_object(
        'id', ms.id,
        'opponent', ms.opponent,
        'home_score', ms.home_score,
        'away_score', ms.away_score,
        'is_home', ms.is_home,
        'status', ms.status,
        'reporter_id', ms.reporter_id,
        'started_at', ms.started_at,
        -- P2 (00073): de to tallene appen regner klokka av. `started_at`
        -- blir stående som historikk og skrives aldri om.
        'clock_started_at', ms.clock_started_at,
        'played_seconds', ms.played_seconds,
        'match_events', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', me.id,
              'type', me.type,
              'minute', me.minute,
              'player_name', me.player_name,
              'team_side', me.team_side,
              'description', me.description,
              'reported_by', me.reported_by
            ) ORDER BY me.sequence
          ), '[]'::jsonb)
          FROM public.match_events me
          WHERE me.match_session_id = ms.id
        )
      )
      FROM public.match_sessions ms
      WHERE ms.event_id = e.id
    ),
    -- RSVP summary
    'rsvp_summary', (
      SELECT jsonb_build_object(
        'coming', count(*) FILTER (WHERE er.status = 'kommer'),
        'not_coming', count(*) FILTER (WHERE er.status = 'kan_ikke'),
        'pending', count(*) FILTER (WHERE er.status = 'venter')
      )
      FROM public.event_rsvps er
      WHERE er.event_id = e.id
    ),
    -- Current user's own RSVP (no child)
    'my_rsvp', (
      SELECT er.status
      FROM public.event_rsvps er
      WHERE er.event_id = e.id
        AND er.user_id = v_uid
        AND er.child_id IS NULL
    ),
    -- Current user's child RSVPs
    'my_child_rsvps', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'child_id', er.child_id,
          'child_name', mc.display_name,
          'status', er.status
        )
      ), '[]'::jsonb)
      FROM public.event_rsvps er
      JOIN public.managed_children mc ON mc.id = er.child_id
      WHERE er.event_id = e.id
        AND er.user_id = v_uid
        AND er.child_id IS NOT NULL
    ),
    -- Attendee lists
    'attendees', jsonb_build_object(
      'coming', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'kommer'
      ),
      'not_coming', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'kan_ikke'
      ),
      'pending', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'avatar', p.avatar_url,
            'child_name', mc.display_name
          )
        ), '[]'::jsonb)
        FROM public.event_rsvps er
        JOIN public.profiles p ON p.id = er.user_id
        LEFT JOIN public.managed_children mc ON mc.id = er.child_id
        WHERE er.event_id = e.id AND er.status = 'venter'
      )
    )
  ) INTO v_result
  FROM public.events e
  WHERE e.id = evt_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- KONTROLL ETTER PUSH (kjøres manuelt — P2 krever en ekte runde)
--
--   1) Kolonnene og formelen finnes:
--      SELECT played_seconds, clock_started_at FROM match_sessions LIMIT 1;
--      SELECT public.match_played_seconds(120, now() - interval '30 seconds');
--      ⇒ forventet: 150
--
--   2) Lesestien bærer dem:
--      SELECT get_event_with_rsvp('<event_id>') -> 'match_session';
--      ⇒ skal inneholde clock_started_at OG played_seconds.
--
--   3) ⚠️⚠️ DEN MANUELLE PAUSE/GJENOPPTA-RUNDEN (P2 krever den):
--      · start en testkamp, vent ~2 min          → minuttet teller
--      · sett PAUSE, vent ~2 min                 → minuttet står BOM STILLE
--      · andre omgang, vent ~1 min               → fortsetter fra der det sto
--      · rapporter et mål                        → match_events.minute skal
--        være spilt tid, IKKE klokketid siden avspark
--      · sammenlign: SELECT minute FROM match_events ORDER BY sequence;
--        ⇒ ingen hopp over pausen.
--
--   4) FØRST DERETTER: bygg og distribuer appen.
-- ============================================================
