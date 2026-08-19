-- ============================================================
-- 00069_avatar_path_cleanup.sql
-- ETTERSLEP FRA 00068 — én linje, men den lukker en ekte felle.
--
-- 00068 strammet profiles-UPDATE-policyen med en WITH CHECK som
-- krever at `avatar_url` peker på DIN egen mappe. WITH CHECK
-- evaluerer HELE den nye raden, ikke bare kolonnene som endres —
-- så en profil som ligger med en verdi i `avatar_url` som IKKE
-- passer mønsteret, blir umulig å oppdatere i det hele tatt.
-- Brukeren ville ikke fått endret telefonnummeret sitt engang, og
-- feilmeldingen ville sagt «new row violates row-level security
-- policy», som ikke peker på noe som helst.
--
-- Forventet effekt i prod: NULL RADER. Ingenting i appen har noen
-- gang kunnet SETTE `avatar_url` — feltet ble lest av sju flater og
-- skrevet av ingen, og det var hele grunnen til at profilbilde-skiva
-- fantes. Men «forventet» er ikke «verifisert», og prisen for å ta
-- feil er en konto som er låst ute fra sin egen profil.
--
-- Verdiene som ev. nulles er uansett ubrukelige etter 00068: de
-- tolkes som paths i `avatars`-bucketen, der de ikke finnes, og gir
-- initialer i appen. Vi mister altså ingen visning — vi fjerner en
-- verdi som allerede var død.
-- ============================================================

DO $$
DECLARE
  v_cnt int;
BEGIN
  UPDATE public.profiles
  SET avatar_url = NULL
  WHERE avatar_url IS NOT NULL
    AND avatar_url NOT LIKE id::text || '/%';

  GET DIAGNOSTICS v_cnt = ROW_COUNT;

  IF v_cnt > 0 THEN
    RAISE NOTICE '00069: nullet % avatar_url-verdi(er) som ikke pekte på eierens egen mappe (ville låst profilen for UPDATE).', v_cnt;
  ELSE
    RAISE NOTICE '00069: 0 rader — som forventet, ingenting har noen gang skrevet avatar_url.';
  END IF;
END $$;
