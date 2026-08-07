-- ============================================================
-- 00057 — REDIGERING AV ARRANGEMENT
--
-- Brage 2026-08-07. Til nå kunne appen opprette et arrangement, men aldri
-- rette det. Triggerne fra 00054 var korrekte og har ligget klare siden da —
-- de fyrer for enhver UPDATE — men ingenting i appen gjorde en UPDATE.
-- Endringsvarslene har derfor aldri vært testbare fra telefonen.
--
-- Denne migrasjonen gir fem ting:
--   1. `update_event()`   — rette et arrangement, med samme vakt som
--                           `create_event` (is_team_admin, SECURITY DEFINER).
--   2. `set_match_cancelled()` — «Avlys kamp» som en STATUSENDRING, ikke en
--                           sletting. En avlyst kamp skal fortsatt kunne ses.
--   3. En VAKT mot historikk i `notify_event_change()` — den åpne saken
--                           00056 lot stå igjen.
--   4. Turneringens sluttdato som en varslet endring.
--   5. Tydeligere pushtekst når en kamp avlyses.
--
-- ⛔ IKKE her: sletting av arrangement, bytte av TYPE (trening ↔ kamp), og
-- flytting av en kamp inn i eller ut av en turnering. Alle tre er egne skiver
-- med egne spørsmål — en typeendring må opprette eller fjerne en
-- match_session, og det er ikke en «rettelse».
-- ============================================================


-- ============================================================
-- 1. update_event()
--
-- FULL ERSTATNING, ikke en patch: skjemaet sender alltid hele arrangementet,
-- og NULL betyr «feltet er tomt» — ikke «ikke rør det». Det er den eneste
-- tolkningen som lar en trener SLETTE et sted eller en beskjed. Unntaket er
-- `p_is_home`, som skjemaet ikke viser for annet enn kamp: der betyr NULL
-- «behold», så en eldre klient ikke snur hjemme/borte i det stille.
--
-- Typen kan ikke endres. En trening som blir en kamp trenger en
-- match_session, en kamp som blir en trening må kvitte seg med en — det er
-- ikke en rettelse, og RPC-en later ikke som om det er det.
-- ============================================================
CREATE OR REPLACE FUNCTION update_event(
  p_event_id     uuid,
  p_title        text,
  p_start_time   timestamptz,
  p_end_time     timestamptz DEFAULT NULL,
  p_location     text DEFAULT NULL,
  p_description  text DEFAULT NULL,
  p_opponent     text DEFAULT NULL,
  p_is_home      boolean DEFAULT NULL,
  p_meeting_time timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_title    text := trim(COALESCE(p_title, ''));
  v_opponent text := NULLIF(trim(COALESCE(p_opponent, '')), '');
  v_evt      record;
  v_session  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.id, e.team_space_id, e.type
    INTO v_evt
  FROM public.events e
  WHERE e.id = p_event_id AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_admin(v_evt.team_space_id) THEN
    RAISE EXCEPTION 'Only coaches, team leaders and admins can edit events';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'Title required';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Start time required';
  END IF;

  -- Samme tre reglene som create_event. De speiler CHECK-constraintene, men
  -- gir en feil vi kan oversette i appen i stedet for en rå constraint-feil.
  IF p_end_time IS NOT NULL AND p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  IF p_meeting_time IS NOT NULL AND p_meeting_time > p_start_time THEN
    RAISE EXCEPTION 'Meeting time must be at or before start time';
  END IF;

  IF v_evt.type = 'kamp' AND v_opponent IS NULL THEN
    RAISE EXCEPTION 'Opponent required for a match';
  END IF;

  UPDATE public.events SET
    title        = v_title,
    start_time   = p_start_time,
    end_time     = p_end_time,
    meeting_time = p_meeting_time,
    location     = NULLIF(trim(COALESCE(p_location, '')), ''),
    description  = NULLIF(trim(COALESCE(p_description, '')), '')
  WHERE id = p_event_id;

  -- ⚠️ REKKEFØLGEN ER MENINGSBÆRENDE. Begge UPDATE-ene fyrer hver sin trigger
  -- fra 00054, og begge går inn i `notify_event_change()`. Den første setter
  -- inn varselet, den andre finner det ULESTE varselet og SLÅR SEG SAMMEN med
  -- det. Push henger på INSERT (00049), ikke på UPDATE — derfor blir det
  -- nøyaktig én push selv når både tid og motstander endres i samme lagring.
  IF v_evt.type = 'kamp' THEN
    UPDATE public.match_sessions
    SET opponent = v_opponent,
        is_home  = COALESCE(p_is_home, is_home)
    WHERE event_id = p_event_id
    RETURNING id INTO v_session;
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'match_session_id', v_session
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_event(
  uuid, text, timestamptz, timestamptz, text, text, text, boolean, timestamptz
) IS
  'Retter et eksisterende arrangement. Full erstatning av feltene skjemaet '
  'eier; typen og turneringstilknytningen kan ikke endres. Vaktet av '
  'is_team_admin, som create_event (00019).';

-- Eksplisitt, selv om nye funksjoner får EXECUTE til PUBLIC som standard:
-- vakten er `is_team_admin` inne i funksjonen, og det skal stå svart på hvitt
-- hvem som i det hele tatt kan kalle den (samme idiom som 00046).
GRANT EXECUTE ON FUNCTION update_event(
  uuid, text, timestamptz, timestamptz, text, text, text, boolean, timestamptz
) TO authenticated;


-- ============================================================
-- 2. set_match_cancelled()
--
-- «Avlys kamp» er en STATUS, ikke en sletting: kampen skal bli stående i
-- kalenderen med «Avlyst»-pill, slik at foreldre som husker at det skulle
-- være kamp faktisk finner svaret. En slettet kamp ser ut som en kamp man
-- selv har husket feil.
--
-- Avlysningen er en ADMIN-handling. RLS på match_sessions slipper også
-- kampreporteren gjennom (00014) — hun skal rapportere kampen, ikke avlyse
-- den — så vakten må ligge her.
--
-- Statusvarselet skrives allerede av triggeren fra 00054 («kampen er avlyst»
-- / «kampen spilles likevel»), og den nye historikkvakten under gjør at en
-- kamp fra i går kan ryddes opp i uten at noen får push.
-- ============================================================
CREATE OR REPLACE FUNCTION set_match_cancelled(
  p_event_id  uuid,
  p_cancelled boolean
)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_evt     record;
  v_session record;
  v_next    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.id, e.team_space_id
    INTO v_evt
  FROM public.events e
  WHERE e.id = p_event_id AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT is_team_admin(v_evt.team_space_id) THEN
    RAISE EXCEPTION 'Only coaches, team leaders and admins can cancel a match';
  END IF;

  SELECT ms.id, ms.status INTO v_session
  FROM public.match_sessions ms
  WHERE ms.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event is not a match';
  END IF;

  v_next := CASE WHEN p_cancelled THEN 'avlyst' ELSE 'planlagt' END;

  IF v_session.status = v_next THEN
    -- Allerede der. Ingen UPDATE = ingen trigger = ingen varsel om ingenting.
    RETURN jsonb_build_object('match_session_id', v_session.id,
                              'status', v_session.status);
  END IF;

  -- En kamp som er i gang eller ferdigspilt avlyses ikke — den er jo spilt.
  -- «Slutt» er reporterens knapp, og en igangværende kamp som blir brutt er
  -- en annen sak enn en avlysning.
  IF p_cancelled AND v_session.status <> 'planlagt' THEN
    RAISE EXCEPTION 'Only a scheduled match can be cancelled';
  END IF;

  IF NOT p_cancelled AND v_session.status <> 'avlyst' THEN
    RAISE EXCEPTION 'Match is not cancelled';
  END IF;

  UPDATE public.match_sessions
  SET status = v_next
  WHERE id = v_session.id;

  RETURN jsonb_build_object('match_session_id', v_session.id, 'status', v_next);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_match_cancelled(uuid, boolean) IS
  'Avlyser eller gjenåpner en kamp som en statusendring på match_sessions. '
  'Kun trener/lagleder/admin. Varselet skrives av triggeren fra 00054.';

GRANT EXECUTE ON FUNCTION set_match_cancelled(uuid, boolean) TO authenticated;


-- ============================================================
-- 3. notify_event_change() — VAKT MOT HISTORIKK
--
-- Den åpne saken 00056 lot stå: «ny hendelse»-varselet ble stoppet for
-- fortiden, men ENDRINGSvarselet ble det ikke. Retter noen opp en kamp fra i
-- går — legger inn stedet, fikser motstanderens navn, rydder etter seg —
-- fikk hele laget push om et arrangement som var over.
--
-- Grensen er `now()`, ikke «i dag»: en trening som startet kl. 12 er
-- historikk kl. 16, selv om datoen er dagens. Samme test som 00056 og som
-- appen bruker når den spør «legge inn noe som har vært?».
--
-- ⚠️ Det er den NYE starttiden som avgjør, og det er med vilje. Triggerne er
-- AFTER UPDATE, så raden vi slår opp her er den oppdaterte. Flytter noen en
-- utsatt kamp fra i går til neste tirsdag, er arrangementet FRAMTIDIG etter
-- lagringen — og da skal laget selvsagt vite det. Går flyttingen andre veien
-- (noen retter et feilskrevet årstall tilbake i tid), er arrangementet
-- historikk etterpå, og stillhet er riktig.
--
-- Vakten ligger HER og ikke i de to triggerne, fordi dette er det ene stedet
-- begge går gjennom — én regel, ett sted.
--
-- Ellers identisk med 00054, pluss `body`-overstyringen i punkt 5.
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

  SELECT e.id, e.team_space_id, e.title, e.type, e.start_time
    INTO v_evt
  FROM public.events e
  WHERE e.id = p_event_id AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- NYTT i 00057: et arrangement som alt har startet varsler ikke.
  IF v_evt.start_time < now() THEN
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
    -- `body` er en valgfri overstyring (00057): «gammel → ny» er riktig for
    -- en flyttet tid, men tomt for en avlysning. Se punkt 5.
    v_body  := COALESCE(
      v_first->>'body',
      (v_first->>'old') || ' → ' || (v_first->>'new')
    );
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

COMMENT ON FUNCTION public.notify_event_change(uuid, jsonb) IS
  'Felles inngang for endringsvarsler fra events og match_sessions. Slår '
  'sammen mot et ulest varsel for samme arrangement (< 10 min), så én '
  'lagring gir ett varsel. Varsler ALDRI om et arrangement som alt har '
  'startet (00057).';


-- ============================================================
-- 4. notify_on_event_updated() — turneringens SISTE DAG
--
-- `end_time` var ikke blant de varslede feltene i 00054, og for en trening er
-- det riktig: sluttiden er en avledet varighet ingen planlegger etter.
--
-- For en TURNERING er `end_time` noe helt annet: den bærer sluttDATOEN (siste
-- dag 23:59), altså hvor lenge cupen varer. Blir cup-helga en dag lengre, er
-- det nøyaktig like relevant som at den flyttes en dag — og uten denne
-- grenen var det den ENESTE datoendringen i appen som ikke sa fra.
--
-- Formatert som en DATO, ikke gjennom `fmt_event_time` — «16.08. kl. 23:59»
-- ville lekket klokkeslettet som bare er et lagringstriks.
--
-- Resten av funksjonen er uendret fra 00054.
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

  -- Kun turneringen: der ER end_time perioden.
  IF NEW.type = 'turnering'
     AND OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'end_time',
      'label', 'siste dag er endret',
      'old',   CASE WHEN OLD.end_time IS NULL THEN 'ikke satt'
               ELSE to_char(OLD.end_time AT TIME ZONE 'Europe/Oslo', 'DD.MM.')
               END,
      'new',   CASE WHEN NEW.end_time IS NULL THEN 'ikke satt'
               ELSE to_char(NEW.end_time AT TIME ZONE 'Europe/Oslo', 'DD.MM.')
               END
    );
  END IF;

  -- ⚠️ Sammenligner KLOKKESLETTET, ikke tidsstempelet. Skjemaet flytter
  -- oppmøtet sammen med starten når datoen endres, slik at «møt opp 30 min
  -- før» fortsatt stemmer. Tidsstempelet er da et annet, men klokkeslettet er
  -- det samme — og «17:30 → 17:30» er en linje som bare skaper tvil. Selve
  -- flyttingen står allerede i datolinja over.
  IF OLD.meeting_time IS DISTINCT FROM NEW.meeting_time
     AND public.fmt_event_time(OLD.meeting_time, false)
         IS DISTINCT FROM public.fmt_event_time(NEW.meeting_time, false) THEN
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


-- ============================================================
-- 5. notify_on_match_session_updated() — tydelig avlysning
--
-- «satt opp → avlyst» er riktig i inboxraden, som tegner forskjellen som to
-- kolonner. Men det er den SAMME teksten som havner i pushen, og på låst
-- skjerm er «satt opp → avlyst» en gåte. En avlysning er det varselet i hele
-- appen som haster mest — foreldre er i ferd med å sette seg i bilen.
--
-- `body` overstyrer derfor pushteksten når avlysningen står alene, og sier
-- hvilken kamp som ryker: «Lørdag 16.08. kl. 12:00 — kampen spilles ikke».
-- Inboxraden er uendret; den leser `old`/`new`, ikke `body`.
--
-- Resten av funksjonen er uendret fra 00054.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_match_session_updated()
RETURNS trigger AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_start   timestamptz;
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
    SELECT e.start_time INTO v_start
    FROM public.events e WHERE e.id = NEW.event_id;

    IF NEW.status = 'avlyst' THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'status',
        'label', 'kampen er avlyst',
        'old',   'satt opp',
        'new',   'avlyst',
        'body',  COALESCE(
                   to_char(v_start AT TIME ZONE 'Europe/Oslo',
                           'DD.MM. "kl." HH24:MI') || ' — kampen spilles ikke',
                   'Kampen spilles ikke'
                 )
      );
    ELSIF OLD.status = 'avlyst' AND NEW.status = 'planlagt' THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'status',
        'label', 'kampen spilles likevel',
        'old',   'avlyst',
        'new',   'satt opp',
        'body',  COALESCE(
                   to_char(v_start AT TIME ZONE 'Europe/Oslo',
                           'DD.MM. "kl." HH24:MI') || ' — kampen spilles likevel',
                   'Kampen spilles likevel'
                 )
      );
    END IF;
  END IF;

  PERFORM public.notify_event_change(NEW.event_id, v_changes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggerne fra 00054 peker allerede på begge funksjonene og røres ikke.
