-- ============================================================
-- 00080_broadcast_backend.sql — S3a: Broadcast-backend (dual-run)
-- Skaleringsplan v2.1 §1.1–1.3 + §9 S3a. Godkjent av Brage 2026-08-30.
--
-- HVA DETTE ER
--   Serversiden av transportbyttet postgres_changes → Broadcast:
--   join-policyer på realtime.messages (kanaldørene) og triggere som
--   kringkaster hver hendelse med realtime.send. REN DUAL-RUN:
--   publikasjonen fra 00020/00025 står urørt, runtime_config (00079)
--   står på 'pgc' for alle domener, og INGEN klient endrer oppførsel.
--   Klientene kommer i S3b/S3c og skal abonnere med {private: true}.
--
-- KANALPLANEN (§1.1)
--   user:{userId}       notif · membership_revoked   (selv-match)
--   team:{teamSpaceId}  feed_post · reaction · comment · live
--   match:{sessionId}   match_event · session · engagement · photo
--                       · reaction · comment (samme deltaer som
--                       kampskjermen leser via postgres_changes i dag)
--
-- KONVOLUTTEN (§1.2, LÅST §0.1-2)
--   {v:1, message_id, entity_id, seq, emitted_at, data}
--   message_id = unik PER LEVERING (gen_random_uuid ved send) — brukes
--   KUN mot transport-duplikater. Tilstand appliseres på entity_id +
--   monoton seq (apply-hvis-nyere); en UPDATE av samme entity har ny
--   seq og dedupliseres ALDRI bort. seq per domene: match_events →
--   sequence (int), session/live → {status, updated_at}, feed →
--   {created_at, updated_at}-cursor, varsler → {id, created_at},
--   reaksjoner/kommentarer → {created_at(, updated_at)}. DELETE-events
--   bærer op='DELETE' i data og appliseres som fjern-ved-id
--   (idempotent — apply-hvis-nyere gjelder ikke sletting).
--
-- FEILDISIPLIN (§1.2)
--   realtime.send har egen feilfangst (verifisert mot supabase/realtime-
--   tenant-migrasjonene: feil logges som warning, kalltransaksjonen
--   overlever). Derfor har INGEN funksjon her EXCEPTION WHEN OTHERS.
--   Routing-miss der FK-er garanterer treff = invariantbrudd → RAISE
--   WARNING 'heia_broadcast: …' + RETURN NULL. Miss i DELETE-grener er
--   VENTET (ON DELETE CASCADE sletter forelderen først) og er stille.
--
--   Logs Explorer-spørringen som overvåker begge feilklassene (kjøres
--   etter staging-/lasttest, S8 asserterer null treff):
--
--     select event_message, timestamp
--     from postgres_logs
--     cross join unnest(metadata) m
--     cross join unnest(m.parsed) p
--     where p.error_severity = 'WARNING'
--       and (event_message like '%heia_broadcast%'
--            or event_message like '%realtime.send%')
--     order by timestamp desc;
--
-- MEDLEMSKAPSREVOKERING (§1.3, LÅST §0.1-1)
--   Kontrolleventet membership_revoked sendes KUN privat på
--   user:{userId} — aldri på team-kanalen (transportlaget skal ikke
--   avsløre hvem som mistet tilgang). Godkjent variant: ÉN trigger på
--   memberships (ikke kall i hver RPC) — dekker remove_team_member,
--   leave_team, kontosletting og alt fremtidig, der sannheten bor
--   (samme argument som 00049 for push).
--
-- OBLIGATORISK S3b-EXIT-KRITERIUM (Brage 2026-08-30)
--   Kanalpolicyene MÅ testes gjennom EKTE private WebSocket-joins
--   fra klienten ({private: true} i channel-configen): egen user-/
--   team-/match-kanal TILLATES; annen brukers user-kanal og fremmed
--   lags team-kanal NEKTES. SQL-emuleringen i verify-00080 (rolle +
--   claims + realtime.topic-GUC) beviser policyuttrykkene, men
--   ERSTATTER IKKE denne ende-til-ende-testen — Realtime-tjenestens
--   egen join-/re-auth-mekanikk er bare bevist når en ekte klient
--   har vært gjennom den. S3b lukkes ikke uten dette.
--
-- ROLLBACK: DROP-ene nederst i kommentaren — triggere, policyer,
-- funksjoner. Ingen klient leser dette før flagget flippes (S3b/c).
-- ============================================================


-- ============================================================
-- 0) VAKT: rør aldri ukjente policyer på realtime.messages.
-- Finnes det policyer vi ikke eier, skal migrasjonen STOPPE (hele
-- migrasjonen kjører i én transaksjon — ingenting appliseres), og
-- avviket rapporteres før noe endres. Egne navn er unntatt så
-- migrasjonen er trygg å kjøre på nytt.
-- ============================================================
DO $$
DECLARE
  v_cnt  int;
  v_list text;
BEGIN
  SELECT count(*),
         string_agg(policyname || ' (' || cmd || ' → ' ||
                    array_to_string(roles, ',') || ')', '; ')
  INTO v_cnt, v_list
  FROM pg_policies
  WHERE schemaname = 'realtime' AND tablename = 'messages'
    AND policyname NOT IN ('heia_user_channel_join',
                           'heia_team_channel_join',
                           'heia_match_channel_join');
  IF v_cnt > 0 THEN
    RAISE EXCEPTION
      'heia_broadcast: % UKJENT(E) policy(er) på realtime.messages — '
      'stopp og rapportér før noe endres: %', v_cnt, v_list;
  END IF;
END $$;


-- ============================================================
-- 1) try_uuid — uuid-søppel i et topic skal gi NEKT, aldri SQL-feil.
-- En rå ::uuid-cast i policyen ville kastet exception på
-- «team:ikke-en-uuid»; her blir det NULL → is_team_member(NULL) →
-- false → join nektes stille. Verify-scriptet prober akkurat dette.
-- ============================================================
CREATE OR REPLACE FUNCTION public.try_uuid(p_text text)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN p_text::uuid
  END;
$$;

-- Dørene, i 00076-rekkefølgen: GRANT (authenticated trenger den i
-- policy-evalueringen) FØR REVOKE (som er det som faktisk stenger).
GRANT EXECUTE ON FUNCTION public.try_uuid(text) TO authenticated;
REVOKE ALL ON FUNCTION public.try_uuid(text) FROM PUBLIC, anon;


-- ============================================================
-- 2) is_match_session_member — session → event → aktivt medlemskap.
-- SECURITY DEFINER slik at policy-evalueringen ikke går via RLS-ene
-- på match_sessions/events (samme mønster som is_team_member, 00008).
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_match_session_member(p_session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_sessions ms
    JOIN public.events e       ON e.id = ms.event_id
    JOIN public.memberships m  ON m.team_space_id = e.team_space_id
    WHERE ms.id = p_session_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_match_session_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_match_session_member(uuid) FROM PUBLIC, anon;


-- ============================================================
-- 3) heia_broadcast_envelope — konvolutten, ett hjem (§0.1-2).
-- Kun for triggerne — ingen klientrolle får kalle den.
-- ============================================================
CREATE OR REPLACE FUNCTION public.heia_broadcast_envelope(
  p_entity_id uuid,
  p_seq       jsonb,
  p_data      jsonb
)
RETURNS jsonb
LANGUAGE sql VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'v',          1,
    'message_id', gen_random_uuid(),
    'entity_id',  p_entity_id,
    'seq',        p_seq,
    'emitted_at', now(),
    'data',       p_data
  );
$$;

REVOKE ALL ON FUNCTION public.heia_broadcast_envelope(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 4) Join-policyene på realtime.messages (§1.1).
-- Supabase-mønsteret: realtime.topic() (aldri rå topic-kolonne) og
-- extension = 'broadcast' i HVER policy, så ingen annen Realtime-type
-- autoriseres utilsiktet. KUN SELECT (join/receive) — det finnes
-- ingen INSERT-policy, så klienter kan aldri publisere; payload-
-- integriteten garanteres av at kun DB-triggerne kringkaster (§4).
-- ============================================================

DROP POLICY IF EXISTS heia_user_channel_join ON realtime.messages;
CREATE POLICY heia_user_channel_join ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() = 'user:' || (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS heia_team_channel_join ON realtime.messages;
CREATE POLICY heia_team_channel_join ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() LIKE 'team:%'
    AND public.is_team_member(
          public.try_uuid(split_part(realtime.topic(), ':', 2)))
  );

DROP POLICY IF EXISTS heia_match_channel_join ON realtime.messages;
CREATE POLICY heia_match_channel_join ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() LIKE 'match:%'
    AND public.is_match_session_member(
          public.try_uuid(split_part(realtime.topic(), ':', 2)))
  );


-- ============================================================
-- 5) notifications → user:{userId} 'notif'.
-- Statement-nivå med transition table (00049-mønsteret): en feed-post
-- til et lag med 20 medlemmer er ÉN insert-statement → én loop, én
-- realtime.send per mottaker, hver KUN på mottakerens private kanal.
-- Payloaden er hele raden — identisk med det postgres_changes leverer
-- til samme bruker i dag, så klient-handleren i S3c er uendret.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT * FROM new_rows LOOP
    PERFORM realtime.send(
      public.heia_broadcast_envelope(
        rec.id,
        jsonb_build_object('id', rec.id, 'created_at', rec.created_at),
        to_jsonb(rec)),
      'notif',
      'user:' || rec.user_id::text,
      true);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_notifications ON public.notifications;
CREATE TRIGGER trg_broadcast_notifications
  AFTER INSERT ON public.notifications
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.broadcast_on_notifications();


-- ============================================================
-- 6) feed_posts → team:{teamSpaceId} 'feed_post'
--    (+ speil til match:{sessionId} 'photo'/'engagement' ved INSERT
--    med event_id — samme hendelser kampskjermen leser i dag).
-- UPDATE dekker soft-delete (deleted_at) og pin-endringer; op ligger
-- i data. team_space_id er NOT NULL — ingen routing-miss mulig her.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_feed_posts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session uuid;
BEGIN
  PERFORM realtime.send(
    public.heia_broadcast_envelope(
      NEW.id,
      jsonb_build_object('created_at', NEW.created_at,
                         'updated_at', NEW.updated_at),
      to_jsonb(NEW) || jsonb_build_object('op', TG_OP)),
    'feed_post',
    'team:' || NEW.team_space_id::text,
    true);

  IF TG_OP = 'INSERT' AND NEW.event_id IS NOT NULL THEN
    SELECT ms.id INTO v_session
    FROM public.match_sessions ms
    WHERE ms.event_id = NEW.event_id;
    IF FOUND THEN
      PERFORM realtime.send(
        public.heia_broadcast_envelope(
          NEW.id,
          jsonb_build_object('created_at', NEW.created_at,
                            'updated_at', NEW.updated_at),
          to_jsonb(NEW) || jsonb_build_object('op', TG_OP)),
        CASE WHEN NEW.type = 'bilde' THEN 'photo' ELSE 'engagement' END,
        'match:' || v_session::text,
        true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_feed_posts()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_feed_posts ON public.feed_posts;
CREATE TRIGGER trg_broadcast_feed_posts
  AFTER INSERT OR UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_on_feed_posts();


-- ============================================================
-- 7) reactions → team 'reaction' (+ match-speil). INSERT + DELETE
-- (toggle-av). Routing via feed_posts-oppslaget (FK-garantert ved
-- INSERT → miss der er invariantbrudd og skal SYNES som warning;
-- ved DELETE er miss ventet cascade fra slettet post → stille).
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_reactions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.reactions%ROWTYPE;
  v_ts      uuid;
  v_event   uuid;
  v_session uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  SELECT fp.team_space_id, fp.event_id INTO v_ts, v_event
  FROM public.feed_posts fp
  WHERE fp.id = v_row.feed_post_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;  -- ON DELETE CASCADE: forelderen er alt slettet.
    END IF;
    RAISE WARNING 'heia_broadcast: reactions % uten feed_posts-rad %',
      v_row.id, v_row.feed_post_id;
    RETURN NULL;
  END IF;

  v_payload := public.heia_broadcast_envelope(
    v_row.id,
    jsonb_build_object('created_at', v_row.created_at),
    to_jsonb(v_row) || jsonb_build_object('op', TG_OP));

  PERFORM realtime.send(v_payload, 'reaction', 'team:' || v_ts::text, true);

  IF v_event IS NOT NULL THEN
    SELECT ms.id INTO v_session
    FROM public.match_sessions ms WHERE ms.event_id = v_event;
    IF FOUND THEN
      PERFORM realtime.send(v_payload, 'reaction',
                            'match:' || v_session::text, true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_reactions()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_reactions ON public.reactions;
CREATE TRIGGER trg_broadcast_reactions
  AFTER INSERT OR DELETE ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_on_reactions();


-- ============================================================
-- 8) comments → team 'comment' (+ match-speil). INSERT + UPDATE
-- (redigering/soft-delete) + DELETE. Samme routing- og
-- cascade-disiplin som reactions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_comments()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.comments%ROWTYPE;
  v_ts      uuid;
  v_event   uuid;
  v_session uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  SELECT fp.team_space_id, fp.event_id INTO v_ts, v_event
  FROM public.feed_posts fp
  WHERE fp.id = v_row.feed_post_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;  -- ON DELETE CASCADE: forelderen er alt slettet.
    END IF;
    RAISE WARNING 'heia_broadcast: comments % uten feed_posts-rad %',
      v_row.id, v_row.feed_post_id;
    RETURN NULL;
  END IF;

  v_payload := public.heia_broadcast_envelope(
    v_row.id,
    jsonb_build_object('created_at', v_row.created_at,
                       'updated_at', v_row.updated_at),
    to_jsonb(v_row) || jsonb_build_object('op', TG_OP));

  PERFORM realtime.send(v_payload, 'comment', 'team:' || v_ts::text, true);

  IF v_event IS NOT NULL THEN
    SELECT ms.id INTO v_session
    FROM public.match_sessions ms WHERE ms.event_id = v_event;
    IF FOUND THEN
      PERFORM realtime.send(v_payload, 'comment',
                            'match:' || v_session::text, true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_comments()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_comments ON public.comments;
CREATE TRIGGER trg_broadcast_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_on_comments();


-- ============================================================
-- 9) match_events → match:{sessionId} 'match_event'.
-- Full rad + seq = sequence (den monotone kampordningen, 00020).
-- DELETE dekker korrigering (delete + re-insert er kontrakten) —
-- DELETE-eventet appliseres som fjern-ved-id hos klienten.
-- Topic bæres av raden selv — ingen oppslag, ingen miss.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_match_events()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.match_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  PERFORM realtime.send(
    public.heia_broadcast_envelope(
      v_row.id,
      to_jsonb(v_row.sequence),
      to_jsonb(v_row) || jsonb_build_object('op', TG_OP)),
    'match_event',
    'match:' || v_row.match_session_id::text,
    true);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_match_events()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_match_events ON public.match_events;
CREATE TRIGGER trg_broadcast_match_events
  AFTER INSERT OR UPDATE OR DELETE ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_on_match_events();


-- ============================================================
-- 10) match_sessions → match:{id} 'session' + team:{teamSpaceId}
-- 'live'. Kun UPDATE: raden fødes som 'planlagt' ved event-opprettelse
-- (00019/00032/00053) og all statusdrift (live/pause/ferdig, skår,
-- klokke) er UPDATEs. 'live' på team-kanalen er det S3c bygger
-- kampknappen på (erstatter 60 s-pollingen). seq = (status,
-- updated_at) per §1.2. event_id er NOT NULL FK → miss på
-- team-oppslaget er invariantbrudd og skal SYNES.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_match_sessions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ts      uuid;
  v_payload jsonb;
BEGIN
  v_payload := public.heia_broadcast_envelope(
    NEW.id,
    jsonb_build_object('status', NEW.status, 'updated_at', NEW.updated_at),
    to_jsonb(NEW) || jsonb_build_object('op', TG_OP));

  PERFORM realtime.send(v_payload, 'session',
                        'match:' || NEW.id::text, true);

  SELECT e.team_space_id INTO v_ts
  FROM public.events e WHERE e.id = NEW.event_id;
  IF NOT FOUND THEN
    RAISE WARNING 'heia_broadcast: match_sessions % uten events-rad %',
      NEW.id, NEW.event_id;
    RETURN NULL;
  END IF;

  PERFORM realtime.send(v_payload, 'live', 'team:' || v_ts::text, true);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_match_sessions()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_match_sessions ON public.match_sessions;
CREATE TRIGGER trg_broadcast_match_sessions
  AFTER UPDATE ON public.match_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_on_match_sessions();


-- ============================================================
-- 11) membership_revoked → user:{userId}, KUN privat (LÅST §0.1-1).
-- Trigger på memberships selv (godkjent variant): fyrer når et AKTIVT
-- medlemskap mister status (remove_team_member, leave_team,
-- kontosletting — og alt fremtidig), eller når raden hardslettes.
-- Payloaden er bevisst minimal: lag + medlemskaps-id + op — aldri
-- left_reason/ended_by (klienten trenger dem ikke for teardown).
-- Klientens plikt (S3c): riv team-/match-kanaler, purg lag-prefikset,
-- resync memberships.
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_on_membership_revoked()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.memberships%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  PERFORM realtime.send(
    public.heia_broadcast_envelope(
      v_row.id,
      jsonb_build_object('updated_at', v_row.updated_at),
      jsonb_build_object(
        'membership_id', v_row.id,
        'team_space_id', v_row.team_space_id,
        'op',            TG_OP)),
    'membership_revoked',
    'user:' || v_row.user_id::text,
    true);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_on_membership_revoked()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_membership_revoked_upd
  ON public.memberships;
CREATE TRIGGER trg_broadcast_membership_revoked_upd
  AFTER UPDATE ON public.memberships
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION public.broadcast_on_membership_revoked();

DROP TRIGGER IF EXISTS trg_broadcast_membership_revoked_del
  ON public.memberships;
CREATE TRIGGER trg_broadcast_membership_revoked_del
  AFTER DELETE ON public.memberships
  FOR EACH ROW
  WHEN (OLD.status = 'active')
  EXECUTE FUNCTION public.broadcast_on_membership_revoked();


-- ============================================================
-- ROLLBACK-OPPSKRIFTEN (kjøres manuelt ved behov — S3-rollback er
-- primært flagg-flipp i runtime_config, dette er beltet):
--   DROP TRIGGER trg_broadcast_notifications ON public.notifications;
--   DROP TRIGGER trg_broadcast_feed_posts ON public.feed_posts;
--   DROP TRIGGER trg_broadcast_reactions ON public.reactions;
--   DROP TRIGGER trg_broadcast_comments ON public.comments;
--   DROP TRIGGER trg_broadcast_match_events ON public.match_events;
--   DROP TRIGGER trg_broadcast_match_sessions ON public.match_sessions;
--   DROP TRIGGER trg_broadcast_membership_revoked_upd ON public.memberships;
--   DROP TRIGGER trg_broadcast_membership_revoked_del ON public.memberships;
--   DROP POLICY heia_user_channel_join ON realtime.messages;
--   DROP POLICY heia_team_channel_join ON realtime.messages;
--   DROP POLICY heia_match_channel_join ON realtime.messages;
--   DROP FUNCTION public.broadcast_on_notifications();
--   DROP FUNCTION public.broadcast_on_feed_posts();
--   DROP FUNCTION public.broadcast_on_reactions();
--   DROP FUNCTION public.broadcast_on_comments();
--   DROP FUNCTION public.broadcast_on_match_events();
--   DROP FUNCTION public.broadcast_on_match_sessions();
--   DROP FUNCTION public.broadcast_on_membership_revoked();
--   DROP FUNCTION public.heia_broadcast_envelope(uuid, jsonb, jsonb);
--   DROP FUNCTION public.is_match_session_member(uuid);
--   DROP FUNCTION public.try_uuid(text);
-- ============================================================
