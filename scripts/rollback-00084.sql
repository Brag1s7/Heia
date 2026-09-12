-- ============================================================
-- TILBAKEFØRING av 00084 — gjenoppretter NØYAKTIG tilstanden i prod
-- slik den ble målt 2026-09-11 kl. 20, FØR migrasjonen ble kjørt.
--
--   node scripts/run-sql.mjs scripts/rollback-00084.sql
--
-- Utgangspunktet for hver av de 25 funksjonene var det samme:
--   acl = =X/postgres anon=X/postgres authenticated=X/postgres
--         service_role=X/postgres
-- altså EXECUTE til PUBLIC + eksplisitt til anon, authenticated og
-- service_role. Linjene under gjenoppretter presis det.
--
-- Signaturene er kopiert fra pg_proc samme dag, ikke skrevet på nytt.
-- Ingen datarader ble rørt av 00084, så det finnes ingenting å
-- gjenopprette utover rettigheter og search_path.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.activate_team_space(p_team_id uuid, p_display_name text, p_color text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_event(p_team_space_id uuid, p_type text, p_title text, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_location text, p_description text, p_opponent text, p_is_home boolean, p_parent_event_id uuid, p_meeting_time timestamp with time zone) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_from_scratch(p_team_name text, p_sport text, p_age_group text, p_club_id uuid, p_club_name text, p_gender text, p_level text, p_color text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_support_overview() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_support_activation_status(ts_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_support_offering_for_team_space(ts_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_team_support_summary(ts_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_device_token(p_token text, p_platform text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_team_member(p_team_space_id uuid, p_user_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_content(p_entity_type text, p_entity_id uuid, p_reason text, p_details text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_match_event(p_match_session_id uuid, p_type text, p_team_side text, p_description text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_logo(p_club_id uuid, p_url text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_match_cancelled(p_event_id uuid, p_cancelled boolean) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(p_comment_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_post(p_post_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_match(p_event_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unregister_device_token(p_token text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_event(p_event_id uuid, p_title text, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_location text, p_description text, p_opponent text, p_is_home boolean, p_meeting_time timestamp with time zone) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_rsvp(p_event_id uuid, p_status text, p_child_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(ts_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_admin(ts_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_club_team_admin(c_id uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inbox_enabled(p_user uuid, p_team uuid, p_category text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_event_change(p_event_id uuid, p_changes jsonb) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_account_for_team_space(ts_id uuid, p_provider text) TO PUBLIC, anon, authenticated, service_role;

-- search_path tilbake til slik den sto (ingen sti på is_team_member/
-- is_team_admin; uten pg_temp på de to invitasjonsfunksjonene).
ALTER FUNCTION public.is_team_member(uuid) RESET search_path;
ALTER FUNCTION public.is_team_admin(uuid)  RESET search_path;
ALTER FUNCTION public.redeem_manager_invitation(text)
  SET search_path = public, extensions;
ALTER FUNCTION public.decline_manager_invitation(text, text)
  SET search_path = public, extensions;

-- Kontroll: skal gi 26 igjen (25 + lookup_invite_code).
SELECT count(*) AS anon_apne_etter_tilbakeforing
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prosecdef
   AND p.prorettype <> 'trigger'::regtype
   AND has_function_privilege('anon', p.oid, 'EXECUTE');
