-- ============================================================
-- 00074_hendelsens_tidspunkt.sql
-- Pulsen: hendelsen skal ligge der den skjedde, med en gang.
--
-- ---------------------------------------------------------------------------
-- FEILEN BRAGE SÅ (2026-08-21, etter at 00073 var i prod)
--
-- «Når man legger til en hendelse så vises de først helt til venstre på
-- pulsskiva, deretter hopper den til høyre hvor den skal ligge.»
--
-- ---------------------------------------------------------------------------
-- ÅRSAKEN: PULSEN HADDE ALDRI HENDELSENS EGET TIDSPUNKT
--
-- `stampOf` (src/shared/matchPulse.ts) har tre kilder, i rekkefølge:
--   1. `match_event.created_at` — «finnes i typen, men mappes ikke fra
--      get_event_with_rsvp i dag». Altså: den har ALDRI vært tilgjengelig.
--   2. Den kanoniske feed-postens `created_at` — skrevet i samme
--      transaksjon. Dette har vært kilden i praksis.
--   3. `started_at + minute * 60_000` — siste utvei.
--
-- Kilde 2 kommer via en EGEN RPC, et par hundre millisekunder etter at
-- hendelsen selv dukker opp i kampforløpet. I det vinduet gjelder kilde 3.
--
-- ⚠️ OG KILDE 3 BLE FEIL DA 00073 LANDET. Etter kampuret er `minute`
-- FAKTISK SPILT TID, mens `started_at` er KLOKKETID. De to er ikke lenger
-- samme akse: etter et kvarters pause peker `started_at + minute` et kvarter
-- for tidlig. Derfor landet den ferske hendelsen langt til venstre, og hoppet
-- til riktig sted så snart feed-posten kom. **Regresjonen ble innført av
-- 00073, men muligheten lå der hele tiden** — kilde 3 var alltid en gjetning.
--
-- ---------------------------------------------------------------------------
-- RETTELSEN: GI PULSEN KILDE 1
--
-- `match_events.created_at` har eksistert siden 00009:47 med
-- `DEFAULT now()`. Den har bare aldri blitt lest ut. Med den på plass:
--   · ingen vindu — tidspunktet kommer i SAMME svar som hendelsen
--   · ingen gjetning — kilde 3 blir uåpnet i praksis
--   · ingen blanding av spilt tid og klokketid
--
-- ⚠️ Ingen skjemaendring, ingen ny join. Én kolonne ut av en tabell som
-- allerede leses. `get_event_with_rsvp` returnerer jsonb, så CREATE OR
-- REPLACE holder — ingen DROP, altså ingen 00061-felle.
--
-- ⚠️ ORDRETT SOM I 00073, med NØYAKTIG én ny nøkkel. Samme begrunnelse som
-- der: en run-time omskriving med `pg_get_functiondef` kan ikke leses i en
-- diff.
--
-- ⚠️ APPEN MÅ FØLGE ETTER. `mapMatchEventRow` må mappe `created_at`, og
-- pulsens tidsakse må bruke KLOKKETID for posisjoner (minuttet er fortsatt
-- spilt tid, men det er en ETIKETT, ikke en posisjon). Uten app-halvdelen
-- gjør denne migrasjonen ingen skade — den legger bare til et felt ingen
-- leser.
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
              'reported_by', me.reported_by,
              -- ⚠️ 00074: SELVE TIDSPUNKTET. Se migrasjonens toppkommentar
              -- for hvorfor pulsen sto og hoppet uten den.
              'created_at', me.created_at
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
-- KONTROLL ETTER PUSH
--
--   SELECT jsonb_pretty(
--     get_event_with_rsvp('<event_id>') -> 'match_session' -> 'match_events');
--   ⇒ hver hendelse skal ha `created_at`.
--
--   Og på telefonen: rapporter et mål i en LIVE kamp som HAR hatt pause.
--   Markøren skal legge seg der den hører hjemme MED EN GANG — ingen
--   venstrestart, ingen hopp.
-- ============================================================
