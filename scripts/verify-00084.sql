-- Bevisfil for 00084 (anon-døren + pinnet search_path).
-- Kjøres med: node scripts/run-sql.mjs scripts/verify-00084.sql
-- KJØRES FØR OG ETTER db push: før for å se utgangspunktet, etter for
-- å bevise at døren faktisk er lukket (regelen fra 00075-bommen).
--
-- Rent lesende. Ingen rader røres.

WITH f AS (
  SELECT p.oid,
         p.proname,
         array_to_string(p.proconfig, ',')       AS cfg,
         p.prorettype = 'trigger'::regtype       AS is_trigger,
         has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_kan,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_kan
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
)
SELECT 'A1 anon kan KUN kjøre lookup_invite_code' AS test,
       count(*) = 0                               AS bestatt,
       coalesce(string_agg(proname, ', '), 'ingen') AS detalj
  FROM f
 WHERE anon_kan AND NOT is_trigger AND proname <> 'lookup_invite_code'

UNION ALL
SELECT 'A2 lookup_invite_code er FORTSATT anon (bevisst)',
       bool_or(anon_kan),
       'onboarding slår opp koden før innlogging'
  FROM f WHERE proname = 'lookup_invite_code'

UNION ALL
-- Fanger den farlige feilen: at REVOKE stengte ute de innloggede også.
SELECT 'A3 authenticated kan fortsatt kjøre alt som var åpent',
       count(*) = 0,
       coalesce(string_agg(proname, ', '), 'ingen')
  FROM f
 WHERE NOT is_trigger AND NOT auth_kan
   AND proname IN (
     'activate_team_space','create_event','create_team_from_scratch',
     'get_my_support_overview','get_payment_account_for_team_space',
     'get_support_activation_status','get_support_offering_for_team_space',
     'get_team_support_summary','inbox_enabled','is_club_team_admin',
     'is_team_admin','is_team_member','notify_event_change',
     'register_device_token','remove_team_member','report_content',
     'report_match_event','set_club_logo','set_match_cancelled',
     'soft_delete_comment','soft_delete_post','start_match',
     'unregister_device_token','update_event','upsert_rsvp')

UNION ALL
SELECT 'A4 ingen eksplisitt search_path UTEN pg_temp',
       count(*) = 0,
       coalesce(string_agg(proname || ' → ' || cfg, ' | '), 'ingen')
  FROM f
 WHERE cfg IS NOT NULL AND cfg NOT LIKE '%pg_temp%'

UNION ALL
SELECT 'A5 is_team_member er pinnet (RLS + realtime-join)',
       cfg LIKE '%pg_temp%',
       coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'is_team_member'

UNION ALL
SELECT 'A6 is_team_admin er pinnet',
       cfg LIKE '%pg_temp%',
       coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'is_team_admin'

UNION ALL
SELECT 'A7 redeem_manager_invitation er pinnet',
       cfg LIKE '%pg_temp%',
       coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'redeem_manager_invitation'

UNION ALL
SELECT 'A8 decline_manager_invitation er pinnet',
       cfg LIKE '%pg_temp%',
       coalesce(cfg, '(ingen sti)')
  FROM f WHERE proname = 'decline_manager_invitation'

UNION ALL
-- Restansen, så neste samtale ser hvor stor den er uten å telle på nytt.
SELECT 'B1 gjenstår UTEN search_path (egen skive)',
       true,
       count(*)::text || ' funksjoner'
  FROM f WHERE cfg IS NULL;
