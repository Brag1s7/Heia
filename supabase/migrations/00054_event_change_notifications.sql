-- ============================================================
-- 00054 — endringsvarsler: si hva som FAKTISK ble endret
--
-- Brages retning (2026-08-06): Varsler er endringsloggen. Ved endring
-- skal varselet fremheve selve FORSKJELLEN — gammel og ny verdi — ikke
-- gjenta hele arrangementet.
--
-- Varsles: dato, starttid, oppmøtetid, sted/bane, tittel, motstander,
-- avlysning og gjenåpning.
-- Varsles IKKE: beskrivelse (den endres ofte og betyr sjelden noe for
-- oppmøtet).
--
-- ⚠️ «ÉN LAGRING = ETT VARSEL» er hovedkravet, og det er vanskeligere
-- enn det ser ut: tid/sted bor i `events`, motstander og avlysning i
-- `match_sessions`. To tabeller = to triggere = to varsler hvis vi er
-- naive. Derfor går BEGGE gjennom `notify_event_change()`, som slår
-- sammen mot et eksisterende ULEST endringsvarsel for samme arrangement
-- innenfor et kort vindu — samme idiom som samlevarselet for 👏 (00026).
--
-- ⚠️ MERK: appen har ingen redigeringsflyt ennå (ingen updateEvent, ingen
-- skjerm). Triggerne er korrekte og fyrer for enhver UPDATE — også fra
-- SQL/ops — men de blir først synlige for brukerne når redigering finnes.
-- ============================================================


-- ─── Tidsformat, ett sted ────────────────────────────────────
-- Samme dag → bare klokkeslett («18:00 → 18:30»). Ny dag → dato med,
-- ellers ser en flytting til neste uke ut som en halvtimes justering.
CREATE OR REPLACE FUNCTION public.fmt_event_time(
  p_time timestamptz,
  p_with_date boolean
)
RETURNS text AS $$
  SELECT CASE
    WHEN p_time IS NULL THEN 'ikke satt'
    WHEN p_with_date
      THEN to_char(p_time AT TIME ZONE 'Europe/Oslo', 'DD.MM. "kl." HH24:MI')
    ELSE to_char(p_time AT TIME ZONE 'Europe/Oslo', 'HH24:MI')
  END;
$$ LANGUAGE sql IMMUTABLE;


-- ============================================================
-- notify_event_change() — felles inngang for begge triggerne.
--
-- p_changes er en array av {field, label, old, new}. Funksjonen bygger
-- tittel og body av den, og SLÅR SAMMEN med et eksisterende ulest
-- endringsvarsel for samme arrangement (< 10 min) i stedet for å lage
-- et nytt. Dermed gir én lagring ett varsel, selv når den treffer både
-- events og match_sessions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_event_change(
  p_event_id uuid,
  p_changes  jsonb
)
RETURNS void AS $$
DECLARE
  v_evt      record;
  v_existing record;
  v_merged   jsonb;
  v_title    text;
  v_body     text;
  v_count    int;
  v_first    jsonb;
  v_actor    uuid := auth.uid();
BEGIN
  IF p_changes IS NULL OR jsonb_array_length(p_changes) = 0 THEN
    RETURN;
  END IF;

  SELECT e.id, e.team_space_id, e.title, e.type
    INTO v_evt
  FROM public.events e
  WHERE e.id = p_event_id AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Finnes et ULEST endringsvarsel for samme arrangement? Da er dette
  -- samme lagring (eller en umiddelbar oppfølging) — slå sammen.
  SELECT n.id, n.data INTO v_existing
  FROM public.notifications n
  WHERE n.category = 'event_reminder'
    AND n.source_entity_type = 'event'
    AND n.source_entity_id = p_event_id
    AND n.read_at IS NULL
    AND n.data->>'kind' = 'change'
    AND n.created_at > now() - interval '10 minutes'
  ORDER BY n.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Nyeste verdi vinner per felt: en trener som retter seg selv skal
    -- ikke etterlate to motstridende linjer i samme varsel.
    v_merged := (
      SELECT coalesce(jsonb_agg(c ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (c->>'field') c, ord
        FROM (
          SELECT c, ord FROM jsonb_array_elements(
            coalesce(v_existing.data->'changes', '[]'::jsonb)
          ) WITH ORDINALITY t(c, ord)
          UNION ALL
          SELECT c, ord + 1000 FROM jsonb_array_elements(p_changes)
            WITH ORDINALITY t2(c, ord)
        ) u
        ORDER BY c->>'field', ord DESC
      ) d
    );
  ELSE
    v_merged := p_changes;
  END IF;

  v_count := jsonb_array_length(v_merged);
  v_first := v_merged->0;

  -- Tittelen navngir arrangementet og sier HVA som skjedde. Ett felt →
  -- den konkrete endringen. Flere → samlet, med detaljene i body-en.
  IF v_count = 1 THEN
    v_title := v_evt.title || ' — ' || (v_first->>'label');
    v_body  := (v_first->>'old') || ' → ' || (v_first->>'new');
  ELSE
    v_title := v_evt.title || ' er endret';
    v_body := (
      SELECT string_agg(
        (c->>'label') || ': ' || (c->>'old') || ' → ' || (c->>'new'),
        ' · ' ORDER BY ord
      )
      FROM jsonb_array_elements(v_merged) WITH ORDINALITY t(c, ord)
    );
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.notifications
    SET title = v_title,
        body  = v_body,
        data  = data || jsonb_build_object('changes', v_merged),
        sent_at = now(),
        created_at = now()
    WHERE source_entity_type = 'event'
      AND source_entity_id = p_event_id
      AND category = 'event_reminder'
      AND read_at IS NULL
      AND data->>'kind' = 'change'
      AND created_at > now() - interval '10 minutes';
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, v_evt.team_space_id, 'event_reminder',
         v_title, v_body,
         jsonb_build_object(
           'kind',          'change',
           'event_id',      v_evt.id,
           'team_space_id', v_evt.team_space_id,
           'event_title',   v_evt.title,
           'changes',       v_merged
         ),
         'event', v_evt.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = v_evt.team_space_id
    AND m.status = 'active'
    -- Den som gjorde endringen trenger ikke beskjed om sin egen endring.
    AND m.user_id IS DISTINCT FROM v_actor
    AND public.inbox_enabled(m.user_id, v_evt.team_space_id, 'event_reminder');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- events: dato, starttid, oppmøtetid, sted, tittel
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_event_updated()
RETURNS trigger AS $$
DECLARE
  v_changes  jsonb := '[]'::jsonb;
  v_same_day boolean;
BEGIN
  -- Sletting og gjenoppretting er ikke «endring» — egen sak.
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    RETURN NEW;
  END IF;

  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    v_same_day := (OLD.start_time AT TIME ZONE 'Europe/Oslo')::date
                = (NEW.start_time AT TIME ZONE 'Europe/Oslo')::date;
    v_changes := v_changes || jsonb_build_object(
      'field', 'start_time',
      'label', CASE WHEN v_same_day THEN 'tidspunktet er endret'
                    ELSE 'datoen er endret' END,
      'old',   public.fmt_event_time(OLD.start_time, NOT v_same_day),
      'new',   public.fmt_event_time(NEW.start_time, NOT v_same_day)
    );
  END IF;

  IF OLD.meeting_time IS DISTINCT FROM NEW.meeting_time THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'meeting_time',
      'label', 'oppmøtet er flyttet',
      'old',   public.fmt_event_time(OLD.meeting_time, false),
      'new',   public.fmt_event_time(NEW.meeting_time, false)
    );
  END IF;

  IF COALESCE(OLD.location, '') IS DISTINCT FROM COALESCE(NEW.location, '') THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'location',
      'label', 'nytt sted',
      'old',   COALESCE(NULLIF(OLD.location, ''), 'ikke satt'),
      'new',   COALESCE(NULLIF(NEW.location, ''), 'ikke satt')
    );
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'title',
      'label', 'nytt navn',
      'old',   OLD.title,
      'new',   NEW.title
    );
  END IF;

  -- Beskrivelse er BEVISST utelatt (Brage 2026-08-06).

  PERFORM public.notify_event_change(NEW.id, v_changes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_event_updated ON public.events;
CREATE TRIGGER trg_notify_on_event_updated
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_updated();


-- ============================================================
-- match_sessions: motstander, avlysning og gjenåpning
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_match_session_updated()
RETURNS trigger AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
BEGIN
  IF OLD.opponent IS DISTINCT FROM NEW.opponent THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'opponent',
      'label', 'ny motstander',
      'old',   OLD.opponent,
      'new',   NEW.opponent
    );
  END IF;

  -- Avlysning og gjenåpning. Live/pause/ferdig er kampens gang, ikke en
  -- endring av arrangementet — de varsles av kamphendelsene (00051).
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'avlyst' THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'status',
        'label', 'kampen er avlyst',
        'old',   'satt opp',
        'new',   'avlyst'
      );
    ELSIF OLD.status = 'avlyst' AND NEW.status = 'planlagt' THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'status',
        'label', 'kampen spilles likevel',
        'old',   'avlyst',
        'new',   'satt opp'
      );
    END IF;
  END IF;

  PERFORM public.notify_event_change(NEW.event_id, v_changes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_match_session_updated ON public.match_sessions;
CREATE TRIGGER trg_notify_on_match_session_updated
  AFTER UPDATE ON public.match_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_on_match_session_updated();
