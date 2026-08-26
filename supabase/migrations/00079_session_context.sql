-- ============================================================
-- 00079_session_context.sql
-- S2 i skaleringsplan v2.1 (§1.4 + §1.5): kontekst-RPC-en for boot/
-- foreground-resume, og den serverstyrte runtime-configen (kill-switch).
--
-- ---------------------------------------------------------------------------
-- HVA DETTE ER (og ikke er)
--
-- ⚠️ ADDITIV migrasjon. Ingen eksisterende tabell, policy, trigger eller
-- funksjon røres. Gamle klienter kaller aldri `get_session_context` og er
-- upåvirket; nye klienter faller tilbake til de gamle enkeltkallene hvis
-- RPC-en mangler eller feiler. Rollback = DROP FUNCTION + DROP TABLE.
--
-- 1) `runtime_config` (§1.5): ÉN rad som styrer transportvalget for
--    Broadcast-overgangen (S3) og fallback-pollingen. I S2 LESES den bare
--    (servert i kontekst-payloaden) — ingen klientatferd endres av den før
--    S3. Rollback for hele flåten = én UPDATE på denne raden.
--
-- 2) `get_session_context` (§1.4): den ENE nye, lille RPC-en som erstatter
--    boot-viften (profil + memberships + membercount + unread + livekamp +
--    lagkassa = 6 kall) med ETT kall. Feed/events er BEVISST utenfor —
--    de gjenbruker sine beviste, vaktede RPC-er og avfyres parallelt
--    (mega-RPC-en er forkastet, se planens §1.4-tabell).
--
-- ---------------------------------------------------------------------------
-- 🔒 SIKKERHETSMODELLEN (00076/00077-lærdommene, anvendt fra fødselen)
--
-- `get_session_context` er SECURITY DEFINER og BYPASSER RLS — derfor er
-- HVER spørring i kroppen eksplisitt scopet til `auth.uid()` eller gatet på
-- `is_team_member`. Payloaden inneholder KUN det klienten allerede kan lese
-- i dag via RLS-vaktede enkeltkall (paritet, ingen ny eksponering):
--
--   profil            → egen rad (`profiles.id = auth.uid()`)
--   memberships       → egne rader (`user_id = auth.uid()`), samme embed
--                       som getUserMemberships (team_space/team/club/sport
--                       er lesbare for medlemmer i dag)
--   member_count/unread/live_match → gatet på `is_team_member`; en
--                       ikke-medlems-id gir NULL-felter, aldri en feil
--   support_summary   → gjenbruker `get_team_support_summary` (00040),
--                       som har sin egen medlemsvakt
--   runtime_flags     → global konfig, ingen persondata
--
-- Dørene: GRANT til authenticated FØR REVOKE fra PUBLIC+anon (00076-
-- rekkefølgen — en funksjon fødes med EXECUTE til PUBLIC, GRANT alene
-- stenger ingenting). Anon-proben skal gi 42501, ikke P0001. `search_path`
-- pinnes med `pg_temp` EKSPLISITT SIST (00077-rettelsen). `is_team_member`
-- er selv upinnet frem til S5, men arver denne funksjonens pinnede sti for
-- kallets varighet — trygt herfra allerede nå.
-- ============================================================


-- ============================================================
-- 1) runtime_config — én-rads tabell (§1.5)
--
-- CHECK-ene er rollback-vernet: kill-switchen ER en UPDATE på denne raden
-- i en driftssituasjon, og en skrivefeil («broadcst») skal feile høyt i
-- SQL-editoren — ikke seile ut til flåten og sanitiseres stille til 'pgc'
-- av klienten. (Klienten sanitiserer OGSÅ, som belte og bukse.)
-- ============================================================
CREATE TABLE public.runtime_config (
  -- `true` som PK + CHECK = maks én rad, og raden har en stabil adresse:
  -- UPDATE public.runtime_config SET ... WHERE id;
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT runtime_config_single_row CHECK (id),
  realtime_transport jsonb NOT NULL
    DEFAULT '{"match":"pgc","feed":"pgc","notif":"pgc"}'::jsonb
    CONSTRAINT runtime_config_transport_valid CHECK (
      realtime_transport->>'match' IN ('broadcast', 'pgc')
      AND realtime_transport->>'feed' IN ('broadcast', 'pgc')
      AND realtime_transport->>'notif' IN ('broadcast', 'pgc')
    ),
  live_fallback_poll_s integer NOT NULL DEFAULT 0
    CONSTRAINT runtime_config_poll_valid CHECK (
      live_fallback_poll_s BETWEEN 0 AND 3600
    ),
  min_build integer NOT NULL DEFAULT 0
    CONSTRAINT runtime_config_min_build_valid CHECK (min_build >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.runtime_config IS
  'Én rad. Serverstyrt transportflagg + kill-switch (skaleringsplan §1.5). '
  'Skrives KUN av service/ops (ingen klient-skrivepolicy); leses av '
  'get_session_context. Rollback for flåten = én UPDATE her.';

ALTER TABLE public.runtime_config ENABLE ROW LEVEL SECURITY;

-- Lesing: alle innloggede (flagget er globalt og upersonlig).
-- Skriving: INGEN policy for klientroller = RLS avviser alt; service_role
-- (ops/dashboard) bypasser RLS. I tillegg trekkes tabell-privilegiene
-- (Supabase default-grants gir klientrollene ALL på nye tabeller i public
-- — samme «fødes åpen»-felle som EXECUTE på funksjoner).
CREATE POLICY "Authenticated read runtime config"
  ON public.runtime_config FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE public.runtime_config FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.runtime_config FROM authenticated;
GRANT SELECT ON TABLE public.runtime_config TO authenticated;

-- Startraden = dagens faktiske atferd: postgres_changes overalt, ingen
-- fallback-polling (60 s-pollingen er fortsatt klientens egen konstant
-- frem til S3c). Mangler raden likevel, har både RPC-en (COALESCE under)
-- og klienten samme standardverdier.
INSERT INTO public.runtime_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2) get_session_context — boot-/resume-konteksten (§1.4)
--
-- Payload-kontrakten (v-feltet gir evolusjon uten klientbrudd):
--   {
--     v: 1,
--     profile:         profiles-raden (som `select *`),
--     memberships:     [rader formet NØYAKTIG som PostgREST-embedden i
--                       getUserMemberships — klienten gjenbruker samme
--                       mapper],
--     team_space_id:   laget de scopede feltene gjelder, eller NULL når
--                       p_team_space_id mangler/ikke er et medlemskap
--                       (da er de fire under NULL og klienten henter dem
--                       selv — samme kall som i dag),
--     member_count, unread_count, live_match, support_summary,
--     runtime_flags:   {realtime_transport, live_fallback_poll_s, min_build}
--   }
--
-- STABLE: ren lesing. Ikke en mega-RPC: feed/events er utenfor med vilje.
-- ============================================================
CREATE FUNCTION public.get_session_context(p_team_space_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_covered   boolean := false;
  v_profile   jsonb;
  v_members   jsonb;
  v_count     integer;
  v_unread    integer;
  v_live      jsonb;
  v_support   jsonb;
  v_flags     jsonb;
BEGIN
  -- Selvvakt. Den EKTE døren er REVOKE-en under (anon skal få 42501 før
  -- kroppen kjører) — denne linja er kun belte-og-bukse mot en fremtidig
  -- grant-glipp, samme tolkning som 00076 dokumenterer.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_uid;

  -- Samme rader, samme filtre og samme sortering som getUserMemberships
  -- (aktive medlemskap, ikke-slettede lagrom, joined_at + id som stabil
  -- rekkefølge). LEFT JOIN på club/sport/managed_child speiler PostgREST:
  -- mangler relasjonen, er nøkkelen null — ikke utelatt.
  SELECT COALESCE(jsonb_agg(row ORDER BY joined_at, id), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      m.joined_at,
      m.id,
      to_jsonb(m)
        || jsonb_build_object(
             'managed_child',
             CASE WHEN mc.id IS NULL THEN NULL
                  ELSE jsonb_build_object('display_name', mc.display_name)
             END,
             'team_space',
             to_jsonb(ts)
               || jsonb_build_object(
                    'team',
                    to_jsonb(t)
                      || jsonb_build_object(
                           'club', to_jsonb(c),
                           'sport', to_jsonb(s)
                         )
                  )
           ) AS row
    FROM public.memberships m
    JOIN public.team_spaces ts ON ts.id = m.team_space_id
    JOIN public.teams t ON t.id = ts.team_id
    LEFT JOIN public.clubs c ON c.id = t.club_id
    LEFT JOIN public.sports s ON s.id = t.sport_id
    LEFT JOIN public.managed_children mc ON mc.id = m.managed_child_id
    WHERE m.user_id = v_uid
      AND m.status = 'active'
      AND ts.deleted_at IS NULL
  ) enriched;

  -- De lag-scopede feltene KUN for et lag kalleren faktisk er medlem av.
  -- En fremmed/foreldet id (fjernet fra laget siden sist) gir NULL-felter,
  -- og klienten faller tilbake til enkeltkallene sine — aldri en feil, og
  -- aldri et annet lags data.
  IF p_team_space_id IS NOT NULL
     AND COALESCE(public.is_team_member(p_team_space_id), false) THEN
    v_covered := true;

    -- Samme telling som getTeamMemberCount (aktive memberships-RADER).
    SELECT count(*) INTO v_count
    FROM public.memberships
    WHERE team_space_id = p_team_space_id
      AND status = 'active';

    -- Samme scope som getUnreadCount: lagets varsler + globale
    -- (team_space_id IS NULL). user_id-filteret er IKKE valgfritt her:
    -- definer bypasser RLS-en som ellers hadde lagt det på.
    SELECT count(*) INTO v_unread
    FROM public.notifications
    WHERE user_id = v_uid
      AND read_at IS NULL
      AND (team_space_id = p_team_space_id OR team_space_id IS NULL);

    -- Samme rad og form som getLiveMatch (LIVE_MATCH_COLUMNS): pågående
    -- ELLER pauset kamp, nyeste først. Kolonnene er EKSPLISITTE og skal
    -- holdes i takt med SESSION_COLUMNS i src/lib/api/events.ts — en ny
    -- kolonne der når ikke klienten før den også står her (P2-regelen).
    SELECT jsonb_build_object(
             'id', e.id,
             'type', e.type,
             'title', e.title,
             'description', e.description,
             'location', e.location,
             'start_time', e.start_time,
             'end_time', e.end_time,
             'match_sessions', jsonb_build_object(
               'id', ms.id,
               'opponent', ms.opponent,
               'home_score', ms.home_score,
               'away_score', ms.away_score,
               'is_home', ms.is_home,
               'status', ms.status,
               'reporter_id', ms.reporter_id,
               'started_at', ms.started_at,
               'played_seconds', ms.played_seconds,
               'clock_started_at', ms.clock_started_at
             )
           )
    INTO v_live
    FROM public.events e
    JOIN public.match_sessions ms ON ms.event_id = e.id
    WHERE e.team_space_id = p_team_space_id
      AND e.deleted_at IS NULL
      AND ms.status IN ('live', 'pause')
    ORDER BY e.start_time DESC
    LIMIT 1;

    -- Gjenbruk, ikke avskrift: medlemsvakten og beløpslogikken bor i 00040
    -- og skal fortsette å bo der.
    v_support := public.get_team_support_summary(p_team_space_id);
  END IF;

  -- Flaggene serveres ALLTID — også når laget ikke er dekket. Mangler
  -- raden (skal ikke skje, men en TRUNCATE i drift skal ikke velte boot),
  -- er svaret identisk med tabellens defaults = dagens atferd.
  SELECT jsonb_build_object(
           'realtime_transport', rc.realtime_transport,
           'live_fallback_poll_s', rc.live_fallback_poll_s,
           'min_build', rc.min_build
         )
  INTO v_flags
  FROM public.runtime_config rc;

  v_flags := COALESCE(
    v_flags,
    '{"realtime_transport":{"match":"pgc","feed":"pgc","notif":"pgc"},"live_fallback_poll_s":0,"min_build":0}'::jsonb
  );

  RETURN jsonb_build_object(
    'v', 1,
    'profile', v_profile,
    'memberships', v_members,
    'team_space_id', CASE WHEN v_covered THEN p_team_space_id END,
    'member_count', v_count,
    'unread_count', v_unread,
    'live_match', v_live,
    'support_summary', v_support,
    'runtime_flags', v_flags
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

-- Dørene, i 00076-rekkefølgen: GRANT (authenticated) FØR REVOKE
-- (PUBLIC + anon — ulike mottakere, den siste opphever ikke den første).
GRANT EXECUTE ON FUNCTION public.get_session_context(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_session_context(uuid) FROM PUBLIC, anon;


-- ============================================================
-- ✅ KONTROLL — kjør etter push (scripts/verify-00079.sql tar helheten):
--
--   SELECT
--     has_function_privilege('anon','public.get_session_context(uuid)','EXECUTE')          AS anon_ctx,   -- f
--     has_function_privilege('authenticated','public.get_session_context(uuid)','EXECUTE') AS auth_ctx,   -- t
--     has_table_privilege('anon','public.runtime_config','SELECT')                          AS anon_rc,    -- f
--     has_table_privilege('authenticated','public.runtime_config','SELECT')                 AS auth_rc_r,  -- t
--     has_table_privilege('authenticated','public.runtime_config','UPDATE')                 AS auth_rc_w;  -- f
--
--   SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'get_session_context';
--   -- prosecdef = t, proconfig = {"search_path=public, pg_temp"}
--
--   Anon-proben mot /rest/v1/rpc/get_session_context skal gi 42501.
-- ============================================================
