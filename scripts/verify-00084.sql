-- Bevisfil for 00084 (anon-døren, de interne hjelperne, search_path).
--   node scripts/run-sql.mjs scripts/verify-00084.sql
--
-- KJØRES FØR OG ETTER db push: før for å se utgangspunktet, etter for
-- å bevise at døren faktisk er lukket (regelen fra 00075-bommen).
-- Rent lesende. Ingen rader røres.
--
-- «bestatt» skal være true på ALLE rader etter push. Før push er
-- A1, A4, A5, A6, A9 og A10 forventet false — det er utgangspunktet.

WITH f AS (
  SELECT p.oid,
         p.proname,
         array_to_string(p.proconfig, ',')                         AS cfg,
         p.prorettype = 'trigger'::regtype                         AS is_trigger,
         has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_kan,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_kan,
         has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc_kan
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
)
-- A1 er også den varige vakten mot at en NY SECURITY DEFINER-funksjon
-- fødes anon-åpen. scripts/lint-security-definer.mjs fanger det samme i
-- CI, men den kan bare lese migrasjonsfilene; denne er sannheten.
SELECT 'A1 anon kan KUN kjøre lookup_invite_code' AS test,
       count(*) = 0                                 AS bestatt,
       coalesce(string_agg(proname, ', '), 'ingen') AS detalj
  FROM f
 WHERE anon_kan AND NOT is_trigger AND proname <> 'lookup_invite_code'

UNION ALL
SELECT 'A2 lookup_invite_code er FORTSATT anon (gruppe D, bevisst)',
       bool_or(anon_kan),
       'onboarding slår opp koden før innlogging'
  FROM f WHERE proname = 'lookup_invite_code'

UNION ALL
-- Den farligste feilen: at REVOKE stengte ute de innloggede også.
-- Gruppe A — de 19 bruker-RPC-ene appen faktisk kaller.
SELECT 'A3 gruppe A: authenticated kan kjøre alle 19 bruker-RPC-ene',
       count(*) = 0,
       coalesce(string_agg(proname, ', '), 'ingen')
  FROM f
 WHERE NOT is_trigger AND NOT auth_kan
   AND proname IN (
     'activate_team_space','create_event','create_team_from_scratch',
     'get_my_support_overview','get_support_activation_status',
     'get_support_offering_for_team_space','get_team_support_summary',
     'register_device_token','remove_team_member','report_content',
     'report_match_event','set_club_logo','set_match_cancelled',
     'soft_delete_comment','soft_delete_post','start_match',
     'unregister_device_token','update_event','upsert_rsvp')

UNION ALL
-- Gruppe B — vaktene i RLS-uttrykk. Mister authenticated EXECUTE her,
-- faller feed, kamp, kalender og realtime-join med 42501. Avklart
-- empirisk 2026-09-11 i en transaksjon som ble rullet tilbake.
SELECT 'A4 gruppe B: RLS-vaktene har FORTSATT authenticated',
       count(*) = 3,
       coalesce(string_agg(proname || '=' || auth_kan::text, ', '), 'ingen')
  FROM f
 WHERE NOT is_trigger AND auth_kan
   AND proname IN ('is_team_member', 'is_team_admin', 'is_club_team_admin')

UNION ALL
-- Gruppe C — de interne hjelperne. Punkt 111: å stenge bare `anon`
-- ville latt hvilken som helst innlogget bruker slå opp andres
-- varselinnstillinger.
SELECT 'A5 gruppe C: ingen klientrolle kan kalle de interne hjelperne',
       count(*) = 0,
       coalesce(string_agg(proname || ' (anon=' || anon_kan::text ||
                           ' auth=' || auth_kan::text || ')', ', '), 'ingen')
  FROM f
 WHERE NOT is_trigger AND (anon_kan OR auth_kan)
   AND proname IN ('inbox_enabled', 'notify_event_change',
                   'get_payment_account_for_team_space')

UNION ALL
-- …men de MÅ fortsatt virke for baksiden.
SELECT 'A6 gruppe C: service_role beholder EXECUTE',
       count(*) = 3,
       coalesce(string_agg(proname, ', '), 'ingen')
  FROM f
 WHERE NOT is_trigger AND svc_kan
   AND proname IN ('inbox_enabled', 'notify_event_change',
                   'get_payment_account_for_team_space')

UNION ALL
SELECT 'A7 ingen eksplisitt search_path UTEN pg_temp',
       count(*) = 0,
       coalesce(string_agg(proname || ' → ' || cfg, ' | '), 'ingen')
  FROM f
 WHERE cfg IS NOT NULL AND cfg NOT LIKE '%pg_temp%'

UNION ALL
SELECT 'A8 is_team_member er pinnet (RLS + realtime-join)',
       cfg LIKE '%pg_temp%', coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'is_team_member'

UNION ALL
SELECT 'A9 is_team_admin er pinnet',
       cfg LIKE '%pg_temp%', coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'is_team_admin'

UNION ALL
SELECT 'A10 redeem_manager_invitation er pinnet',
       cfg LIKE '%pg_temp%', coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'redeem_manager_invitation'

UNION ALL
SELECT 'A11 decline_manager_invitation er pinnet',
       cfg LIKE '%pg_temp%', coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'decline_manager_invitation'

UNION ALL
-- Restansen, så neste samtale ser hvor stor den er uten å telle på nytt.
SELECT 'B1 gjenstår UTEN search_path (punkt 98, egen skive)',
       true,
       count(*)::text || ' funksjoner'
  FROM f WHERE cfg IS NULL;
