-- Bevisfil for 00083 (varsel når klubbens betalingskonto blir aktiv).
-- Kjøres med: node scripts/run-sql.mjs scripts/verify-00083.sql
--
-- A-testene leser bare katalogen. B-testen gjør en EKTE overgang til
-- 'active' på en ekte konto og teller varslene — men hele blokken
-- rulles tilbake av en RAISE EXCEPTION til slutt, så ingen varsler
-- havner hos ekte brukere og ingen betalingsstatus endres.

-- ── A. Dørene og formen ────────────────────────────────────────────
SELECT
  'A1 funksjonen finnes' AS test,
  count(*) = 1 AS bestatt,
  count(*)::text AS detalj
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_on_club_payment_active'

UNION ALL
SELECT
  'A2 search_path har pg_temp SIST',
  p.proconfig @> ARRAY['search_path=public, pg_temp'],
  array_to_string(p.proconfig, ' | ')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_on_club_payment_active'

UNION ALL
SELECT
  'A3 SECURITY DEFINER',
  p.prosecdef,
  p.prosecdef::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_on_club_payment_active'

UNION ALL
SELECT
  'A4 anon kan IKKE kjøre',
  NOT has_function_privilege('anon', p.oid, 'EXECUTE'),
  has_function_privilege('anon', p.oid, 'EXECUTE')::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_on_club_payment_active'

UNION ALL
SELECT
  'A5 authenticated kan IKKE kjøre',
  NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_on_club_payment_active'

UNION ALL
SELECT
  'A6 triggeren er AFTER UPDATE OF status',
  t.tgtype & 1 = 0 AND t.tgtype & 16 = 16,
  pg_get_triggerdef(t.oid)
FROM pg_trigger t
WHERE t.tgrelid = 'public.club_payment_accounts'::regclass
  AND t.tgname = 'trg_notify_club_payment_active'

UNION ALL
SELECT
  'A7 kategorien system er lovlig',
  pg_get_constraintdef(oid) LIKE '%''system''%',
  'notifications_category_check'
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
  AND conname = 'notifications_category_check'

UNION ALL
-- Fanger en fremtidig regresjon: hvis appen slutter å rute på
-- support_setup, peker varselet ingen steder.
SELECT
  'A8 push-triggeren står på notifications',
  count(*) = 1,
  count(*)::text
FROM pg_trigger
WHERE tgrelid = 'public.notifications'::regclass
  AND tgname = 'trg_push_on_notifications';

-- ── B. Ekte overgang, rullet tilbake ───────────────────────────────
-- Velger en konto som IKKE er aktiv, flipper den, teller varslene som
-- ble laget, og kaster så en exception som ruller ALT tilbake.
DO $$
DECLARE
  v_id      uuid;
  v_for     int;
  v_etter   int;
  v_andre   int;
  v_skjerm  int;
BEGIN
  SELECT id INTO v_id
    FROM public.club_payment_accounts
   WHERE status <> 'active'
   ORDER BY created_at
   LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'B-TEST HOPPET OVER: ingen ikke-aktiv konto å teste med';
  END IF;

  SELECT count(*) INTO v_for FROM public.notifications
   WHERE source_entity_type = 'club_payment_account';

  UPDATE public.club_payment_accounts SET status = 'active' WHERE id = v_id;

  SELECT count(*) INTO v_etter FROM public.notifications
   WHERE source_entity_type = 'club_payment_account' AND source_entity_id = v_id;

  -- Idempotens: en ny UPDATE som IKKE endrer status skal ikke gi flere.
  UPDATE public.club_payment_accounts SET status = 'active' WHERE id = v_id;

  SELECT count(*) INTO v_andre FROM public.notifications
   WHERE source_entity_type = 'club_payment_account' AND source_entity_id = v_id;

  SELECT count(*) INTO v_skjerm FROM public.notifications
   WHERE source_entity_type = 'club_payment_account' AND source_entity_id = v_id
     AND data->>'screen' = 'support_setup'
     AND data->>'team_space_id' IS NOT NULL;

  RAISE EXCEPTION
    'B-RESULTAT (rullet tilbake) | konto=% | varsler for=% | etter forste flipp=% | etter andre update=% (skal vaere likt) | med riktig skjerm=%',
    v_id, v_for, v_etter, v_andre, v_skjerm;
END $$;
