-- ============================================================
-- 00055 — planlagt påminnelse: «Oppmøte om én time»
--
-- Brage 2026-08-06: «Oppmøte om én time» dersom oppmøtetid finnes,
-- ellers «Kampen starter om én time». Send ALDRI begge.
--
-- Regelen løses med ett ankerpunkt: coalesce(meeting_time, start_time).
-- Finnes oppmøtetid er DEN klokka foreldre skal forholde seg til, og
-- starttiden er da irrelevant for påminnelsen. Ett anker = umulig å
-- sende begge.
--
-- IDEMPOTENS uten skjemaendring: vi sender kun hvis det ikke allerede
-- finnes et påminnelsesvarsel (`data->>'kind' = 'reminder'`) for
-- arrangementet. Cron kan dermed kjøre så ofte den vil, og en forsinket
-- kjøring tar igjen det tapte uten å dublere.
--
-- VINDUET er 50–70 minutter før ankeret. Et arrangement som opprettes
-- INNE i vinduet får ingen påminnelse — det ville sagt «om én time» om
-- noe som skjer om ti minutter, og opprettelsesvarselet har nettopp gått.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ============================================================
-- send_event_reminders() — kjøres av cron. Én rad per mottaker.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS integer AS $$
DECLARE
  v_evt   record;
  v_title text;
  v_body  text;
  v_sent  int := 0;
BEGIN
  FOR v_evt IN
    SELECT e.id, e.team_space_id, e.title, e.type, e.location,
           e.start_time, e.meeting_time,
           coalesce(e.meeting_time, e.start_time) AS anchor
    FROM public.events e
    LEFT JOIN public.match_sessions ms ON ms.event_id = e.id
    WHERE e.deleted_at IS NULL
      AND coalesce(e.meeting_time, e.start_time)
            BETWEEN now() + interval '50 minutes'
                AND now() + interval '70 minutes'
      -- En avlyst kamp skal ikke minne noen på oppmøte.
      AND coalesce(ms.status, 'planlagt') <> 'avlyst'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.source_entity_type = 'event'
          AND n.source_entity_id = e.id
          AND n.data->>'kind' = 'reminder'
      )
  LOOP
    -- Oppmøtetid VINNER. Uten den er starttiden ankeret, og teksten
    -- sier «starter», ikke «oppmøte».
    IF v_evt.meeting_time IS NOT NULL THEN
      v_title := v_evt.title || ' — oppmøte om én time';
      v_body  := 'Oppmøte '
                 || public.fmt_event_time(v_evt.meeting_time, false)
                 || coalesce(', ' || nullif(v_evt.location, ''), '')
                 || '. Start '
                 || public.fmt_event_time(v_evt.start_time, false)
                 || '.';
    ELSE
      v_title := v_evt.title
                 || CASE WHEN v_evt.type = 'kamp'
                         THEN ' — kampen starter om én time'
                         ELSE ' starter om én time' END;
      v_body  := 'Start '
                 || public.fmt_event_time(v_evt.start_time, false)
                 || coalesce(', ' || nullif(v_evt.location, ''), '')
                 || '.';
    END IF;

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT DISTINCT m.user_id, v_evt.team_space_id, 'event_reminder',
           v_title, v_body,
           jsonb_build_object(
             'kind',          'reminder',
             'event_id',      v_evt.id,
             'team_space_id', v_evt.team_space_id,
             'anchor',        CASE WHEN v_evt.meeting_time IS NOT NULL
                                   THEN 'meeting' ELSE 'start' END
           ),
           'event', v_evt.id, now()
    FROM public.memberships m
    WHERE m.team_space_id = v_evt.team_space_id
      AND m.status = 'active'
      AND public.inbox_enabled(m.user_id, v_evt.team_space_id, 'event_reminder');

    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Klientene skal aldri kunne fyre påminnelser.
REVOKE ALL ON FUNCTION public.send_event_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_event_reminders() FROM anon;
REVOKE ALL ON FUNCTION public.send_event_reminders() FROM authenticated;


-- ============================================================
-- Cron: hvert tiende minutt. Vinduet er 20 minutter bredt, så en
-- hoppet kjøring tas igjen av den neste.
-- ============================================================
SELECT cron.unschedule('heia-event-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'heia-event-reminders'
);

SELECT cron.schedule(
  'heia-event-reminders',
  '*/10 * * * *',
  $$SELECT public.send_event_reminders()$$
);
