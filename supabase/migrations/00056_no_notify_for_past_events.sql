-- ============================================================
-- 00056 — ingen «ny hendelse»-varsling for noe som alt har vært
--
-- Brage 2026-08-06, sammen med kalendervelgeren: trener og lagleder kan nå
-- velge datoer inntil 30 dager TILBAKE. «Vi spilte i går og glemte å legge
-- den inn» er et ekte tilfelle — kamprapporten, bildene og resultatet henger
-- alle på arrangementet, så kampen må kunne opprettes i etterkant.
--
-- Uten denne vakten ville hele laget fått push om «Kamp mot Lyn — 01.08. kl.
-- 18:00» flere dager etter at kampen var spilt. Et varsel om noe som skal
-- skje er nyttig; det samme varselet om noe som har skjedd er støy, og det
-- undergraver tilliten til at varsler betyr «dette angår deg NÅ».
--
-- Funksjonen er ellers uendret fra 00033 (som la til turneringsvakten, som
-- igjen bygde på 00023). Kun én ny tidlig retur.
--
-- REN funksjonserstatning: ingen skjemaendring, ingen ny trigger.
-- `trg_notify_on_event_created` fra 00023 peker allerede hit.
--
-- Grensen er `now()`, ikke «i dag» — en trening som startet kl. 12 er
-- historikk kl. 16, selv om datoen er dagens. Appen bruker nøyaktig samme
-- test når den ber om bekreftelse, så det brukeren får beskjed om er det
-- som faktisk skjer.
--
-- IKKE rørt her: endringsvarslene (00054). Redigerer noen et historisk
-- arrangement, varsles laget fortsatt. Det hører til redigeringsskiva, som
-- kommer etter denne.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_event_created()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_when  text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Turneringens kamper varsler ikke hver for seg (00033).
  IF NEW.parent_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- NYTT i 00056: historikk varsler ikke.
  IF NEW.start_time < now() THEN
    RETURN NEW;
  END IF;

  SELECT ts.display_name INTO v_title
  FROM public.team_spaces ts WHERE ts.id = NEW.team_space_id;

  v_when := to_char(NEW.start_time AT TIME ZONE 'Europe/Oslo', 'DD.MM. "kl." HH24:MI');

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT DISTINCT m.user_id, NEW.team_space_id, 'event_reminder',
         COALESCE(v_title, 'Heia'),
         NEW.title || ' — ' || v_when,
         jsonb_build_object(
           'event_id',      NEW.id,
           'team_space_id', NEW.team_space_id
         ),
         'event', NEW.id, now()
  FROM public.memberships m
  WHERE m.team_space_id = NEW.team_space_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.created_by
    AND public.inbox_enabled(m.user_id, NEW.team_space_id, 'event_reminder');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_on_event_created() IS
  'Varsler laget om et nytt arrangement. Hopper over turneringskamper '
  '(00033) og arrangementer som alt har startet (00056).';

-- Den planlagte påminnelsen (00055) trenger ingen tilsvarende vakt: vinduet
-- er 50–70 minutter FØR ankeret, så et arrangement i fortiden kan aldri
-- treffe det. Verifisert mot 00055 før denne migrasjonen ble skrevet.
