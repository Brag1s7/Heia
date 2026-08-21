-- ============================================================
-- 00075_korriger_maal.sql
-- SKIVE 8 — «KORRIGER MÅL» som DOMENEHANDLING, og de to farlige
-- halvveiene i P3 stenges i samme slag.
--
-- ---------------------------------------------------------------------------
-- HVA DENNE ERSTATTER
--
-- P3 beskrev et 10-sekunders angrevindu. Brage har forkastet det til fordel
-- for en VARIG korrigering: et mål kan rettes eller annulleres av reporteren
-- eller en lagadmin så lenge kampen finnes. Ingen nedtelling, ingen utsatt
-- push, og ingen «må være nyeste hendelse» — et mål fra 12′ skal kunne rettes
-- i 78′, og da må stillingen regnes ut på nytt, ikke justeres med én.
--
-- ---------------------------------------------------------------------------
-- ⚠️ TO FARLIGE HALVVEIER SOM STÅR I PROD I DAG, OG SOM LUKKES HER
--
-- 1. RLS-policyen «Reporter or admin can delete match events» (00014:163-172)
--    er kallbar fra hvilken som helst klient, uten opprydding. En DELETE der
--    lot hendelsen forsvinne mens stillingen, feed-posten og innboksvarselet
--    ble stående. Policyen fjernes: `match_events` har etter dette INGEN
--    DELETE-policy, og den eneste veien ut er RPC-en under (SECURITY DEFINER,
--    som ikke går gjennom RLS).
--
-- 2. «Slett innlegget» i feeden treffer målposter. Posten forsvinner, men
--    stillingen står på 2–1, hendelsen står i kampforløpet og varselet ligger
--    i innboksen. Brukeren TROR hun har angret, og det er verre enn ingen
--    angrefunksjon. Stenges BÅDE i `soft_delete_post` og i UPDATE-policyene
--    på `feed_posts`, så en spesiallaget klient ikke kan sette `deleted_at`
--    selv.
--
-- 3. Skrivesidens HEIA-gate for mål imot — gjelden 00072 skrev opp. Klienten
--    lot være å TEGNE knappen; nå avviser basen skrivingen. Den hører hjemme
--    her fordi korrigeringen kan GJØRE et mål til et mål imot lenge etter at
--    noen har heiet.
--
-- ---------------------------------------------------------------------------
-- ⚠️ REPLICA IDENTITY FULL PÅ match_events
--
-- Uten den når en DELETE aldri tilskuerne: payloaden bærer kun PK, filteret
-- `match_session_id=eq.…` matcher ikke, og Realtime kan heller ikke
-- RLS-sjekke DELETE-hendelser — de slippes derfor ikke ut i det hele tatt.
-- Resultatet ville vært korrigert stilling i toppen og et annullert mål som
-- blir stående i forløpet til neste refetch. Samme begrunnelse som 00059 ga
-- for `reactions`.
--
-- ---------------------------------------------------------------------------
-- ⚠️⚠️ DEPLOYREKKEFØLGE: SERVER FØRST, VERIFISERT MOT PROD, DERETTER APP.
-- Bevisfil: `scripts/verify-00075.sql`. Appen tåler at migrasjonen mangler
-- (menyen feiler med en lesbar melding), men serveren må aldri være eldre
-- enn en app som tror den kan korrigere.
-- ============================================================


-- ============================================================
-- 1) REPLICA IDENTITY — så annulleringen når tilskuerne
--
-- Kostnad: WAL-raden for UPDATE/DELETE på match_events bærer hele den gamle
-- raden (åtte små kolonner). Reversering:
--   ALTER TABLE public.match_events REPLICA IDENTITY DEFAULT;
-- ============================================================
ALTER TABLE public.match_events REPLICA IDENTITY FULL;


-- ============================================================
-- 2) HALVVEI 1 STENGES — den frie DELETE-døren i match_events
--
-- ⚠️ Det finnes ingen UPDATE-policy på match_events fra før (00014 har kun
-- SELECT + INSERT + DELETE), så når DELETE-policyen forsvinner er tabellen
-- lukket for alt annet enn RPC-ene. Det er med vilje: en kamphendelse er
-- ikke en rad brukeren eier, den er en påstand om hva som skjedde.
-- ============================================================
DROP POLICY IF EXISTS "Reporter or admin can delete match events"
  ON public.match_events;


-- ============================================================
-- 3) match_event_headline() — ÉN KILDE TIL FEEDTEKSTEN
--
-- Teksten på en målpost er et STILLINGSSNAPSHOT: «⚽ MÅL! Heia 2–1 VIF».
-- Rettes et mål fra 12′, blir teksten på ALLE senere målposter feil. De må
-- derfor skrives om — og da må omskrivingen bruke NØYAKTIG samme formel som
-- `report_match_event` brukte da posten ble skrevet, ellers får laget en
-- feed der gamle og korrigerte poster er formulert ulikt.
--
-- Strengene er ordrett 00021/00073. `report_match_event` kalles om under, så
-- det finnes bare ett sted formelen bor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_event_headline(
  p_type      text,
  p_team_side text,
  p_team      text,
  p_opponent  text,
  p_home      int,
  p_away      int
)
RETURNS text AS $$
  SELECT CASE
    WHEN p_type = 'mål' AND p_team_side = 'home'
      THEN format('⚽ MÅL! %s %s–%s %s', p_team, p_home, p_away, p_opponent)
    WHEN p_type = 'mål'
      THEN format('Mål til %s. %s %s–%s %s', p_opponent, p_team, p_home, p_away, p_opponent)
    WHEN p_type = 'pause'
      THEN format('⏸ Pause. %s %s–%s %s', p_team, p_home, p_away, p_opponent)
    WHEN p_type = 'andre_omgang'
      THEN format('▶️ Andre omgang i gang. %s %s–%s %s', p_team, p_home, p_away, p_opponent)
    WHEN p_type = 'slutt'
      THEN format('🏁 Slutt! %s %s–%s %s', p_team, p_home, p_away, p_opponent)
    ELSE NULL
  END;
$$ LANGUAGE sql STABLE;


-- ============================================================
-- 4) rebuild_match_feed_texts() — stillingssnapshotene rulles på nytt
--
-- Går gjennom øktas hendelser i `sequence`-rekkefølge, holder en løpende
-- stilling, og skriver om den kanoniske posten til hver hendelse som BÆRER en
-- stilling. Det er nøyaktig «oppdater eventuelle senere stillingssnapshots».
--
-- ⚠️ TRE TING SOM ER MED VILJE:
--
--   · `avspark` og `melding` hoppes over. Avsparksposten («⚽ Kampen er i
--     gang: X mot Y», 00020/00073) bærer ingen stilling, og en melding er
--     reporterens egne ord. Å røre dem ville vært å skrive om noe som ikke
--     er blitt feil.
--   · KUN systemposten (`match_event`/`match_start`/`match_end`). Bildeposter
--     deler `match_event_id` med øyeblikket (00028) og er BRUKERENS innhold —
--     de har aldri båret en stilling og skal aldri omskrives.
--   · `IS DISTINCT FROM` på innholdet. Uten den ville hver korrigering gitt
--     en UPDATE på hver eneste målpost i kampen, altså en realtime-storm om
--     ingenting.
--
-- ⚠️ `notify_on_feed_post` er AFTER **INSERT** (00022:165-167), så omskrivingen
-- utløser ingen nye varsler. Det er hele grunnen til at teksten kan rettes
-- uten at telefonen buzzer på nytt.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rebuild_match_feed_texts(
  p_match_session_id uuid
)
RETURNS void AS $$
DECLARE
  v_ms       record;
  v_team     text;
  v_home     int := 0;
  v_away     int := 0;
  v_e        record;
  v_head     text;
  v_content  text;
BEGIN
  SELECT ms.*, e.team_space_id
  INTO v_ms
  FROM public.match_sessions ms
  JOIN public.events e ON e.id = ms.event_id
  WHERE ms.id = p_match_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT display_name INTO v_team
  FROM public.team_spaces WHERE id = v_ms.team_space_id;

  FOR v_e IN
    SELECT me.id, me.type, me.team_side, me.description
    FROM public.match_events me
    WHERE me.match_session_id = p_match_session_id
    ORDER BY me.sequence, me.created_at, me.id
  LOOP
    -- Stillingen oppdateres FØR teksten bygges: posten viser resultatet
    -- ETTER hendelsen. Samme konvensjon som report_match_event.
    IF v_e.type = 'mål' THEN
      IF v_e.team_side = 'home' THEN
        v_home := v_home + 1;
      ELSE
        v_away := v_away + 1;
      END IF;
    END IF;

    v_head := public.match_event_headline(
      v_e.type, v_e.team_side, COALESCE(v_team, 'Laget'),
      COALESCE(v_ms.opponent, 'motstanderen'), v_home, v_away
    );

    IF v_head IS NULL THEN
      CONTINUE;
    END IF;

    v_content := btrim(v_head || COALESCE(E'\n' || NULLIF(btrim(COALESCE(v_e.description, '')), ''), ''));

    UPDATE public.feed_posts fp
    SET content = v_content
    WHERE fp.match_event_id = v_e.id
      AND fp.type IN ('match_event', 'match_start', 'match_end')
      AND fp.deleted_at IS NULL
      AND fp.content IS DISTINCT FROM v_content;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5) report_match_event() — ORDRETT 00073, med ÉN endring:
--    overskriften kommer nå fra `match_event_headline`.
--
-- Grunnen til at den skrives om i det hele tatt: står formelen to steder,
-- drifter en korrigert målpost fra en fersk en første gang noen retter et
-- komma i teksten. Resten av funksjonen — kampuret, vaktene, overgangene —
-- er uendret fra 00073.
-- ============================================================
CREATE OR REPLACE FUNCTION report_match_event(
  p_match_session_id uuid,
  p_type             text,
  p_team_side        text DEFAULT NULL,
  p_description      text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_ms      record;
  v_evt     record;
  v_team    text;
  v_minute  int;
  v_seq     int;
  v_me      uuid;
  v_head    text;
  v_content text;
  v_desc    text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_feed    text := 'match_event';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_type NOT IN ('mål', 'pause', 'andre_omgang', 'slutt', 'melding') THEN
    RAISE EXCEPTION 'Unsupported match event type: %', p_type;
  END IF;

  IF p_type = 'mål' AND COALESCE(p_team_side, '') NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'A goal needs team_side home or away';
  END IF;

  IF p_type = 'melding' AND v_desc IS NULL THEN
    RAISE EXCEPTION 'A message needs a description';
  END IF;

  SELECT * INTO v_ms
  FROM public.match_sessions
  WHERE id = p_match_session_id
  FOR UPDATE;

  IF v_ms IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  SELECT * INTO v_evt FROM public.events WHERE id = v_ms.event_id;

  IF NOT (
    COALESCE(v_ms.reporter_id = v_uid, false)
    OR is_team_admin(v_evt.team_space_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_ms.status NOT IN ('live', 'pause') THEN
    RAISE EXCEPTION 'Match is not underway';
  END IF;

  IF p_type = 'pause' AND v_ms.status <> 'live' THEN
    RAISE EXCEPTION 'Match is not live';
  END IF;

  IF p_type = 'andre_omgang' AND v_ms.status <> 'pause' THEN
    RAISE EXCEPTION 'Match is not paused';
  END IF;

  -- FAKTISK SPILT TID — pausene er allerede trukket fra (00073).
  v_minute := FLOOR(
    public.match_played_seconds(v_ms.played_seconds, v_ms.clock_started_at) / 60
  )::int;

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_seq
  FROM public.match_events
  WHERE match_session_id = v_ms.id;

  IF p_type = 'mål' THEN
    UPDATE public.match_sessions
    SET home_score = home_score + (CASE WHEN p_team_side = 'home' THEN 1 ELSE 0 END),
        away_score = away_score + (CASE WHEN p_team_side = 'away' THEN 1 ELSE 0 END)
    WHERE id = v_ms.id
    RETURNING * INTO v_ms;

  ELSIF p_type = 'pause' THEN
    UPDATE public.match_sessions
    SET status           = 'pause',
        played_seconds   = public.match_played_seconds(played_seconds, clock_started_at),
        clock_started_at = NULL
    WHERE id = v_ms.id RETURNING * INTO v_ms;

  ELSIF p_type = 'andre_omgang' THEN
    UPDATE public.match_sessions
    SET status           = 'live',
        clock_started_at = now()
    WHERE id = v_ms.id RETURNING * INTO v_ms;

  ELSIF p_type = 'slutt' THEN
    UPDATE public.match_sessions
    SET status           = 'ferdig',
        finished_at      = now(),
        played_seconds   = public.match_played_seconds(played_seconds, clock_started_at),
        clock_started_at = NULL
    WHERE id = v_ms.id RETURNING * INTO v_ms;
    v_feed := 'match_end';
  END IF;

  INSERT INTO public.match_events
    (match_session_id, type, minute, team_side, description, reported_by, sequence)
  VALUES
    (v_ms.id, p_type, v_minute, p_team_side, v_desc, v_uid, v_seq)
  RETURNING id INTO v_me;

  SELECT display_name INTO v_team
  FROM public.team_spaces WHERE id = v_evt.team_space_id;

  -- ⚠️ ENESTE ENDRINGEN FRA 00073: formelen bor i én funksjon nå, så
  -- korrigerte og ferske målposter aldri kan formuleres ulikt.
  v_head := public.match_event_headline(
    p_type, p_team_side, COALESCE(v_team, 'Laget'),
    COALESCE(v_ms.opponent, 'motstanderen'), v_ms.home_score, v_ms.away_score
  );

  v_content := btrim(COALESCE(v_head, '') || COALESCE(E'\n' || v_desc, ''));

  INSERT INTO public.feed_posts
    (team_space_id, author_id, type, content, event_id, match_event_id)
  VALUES
    (v_evt.team_space_id, v_uid, v_feed, v_content, v_evt.id, v_me);

  RETURN jsonb_build_object(
    'match_event_id', v_me,
    'minute',         v_minute,
    'home_score',     v_ms.home_score,
    'away_score',     v_ms.away_score,
    'status',         v_ms.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6) correct_match_goal() — SELVE DOMENEHANDLINGEN
--
-- Én RPC, to handlinger: 'edit' og 'cancel'. Alt skjer i ÉN transaksjon, så
-- det finnes ikke et øyeblikk der hendelsen er rettet men stillingen ikke er
-- det.
--
-- ---------------------------------------------------------------------------
-- ⚠️ STILLINGEN REGNES UT PÅ NYTT FRA MÅLHISTORIKKEN — ALDRI JUSTERT MED ÉN.
--
-- «Trekk fra én» er riktig nøyaktig så lenge ingenting annet noen gang har
-- gått galt. Er stillingen alt kommet i utakt (en halvferdig sletting via
-- policyen vi fjerner over, en importert kamp, en fremtidig feil), sementerer
-- en justering feilen for alltid. En opptelling av `type = 'mål'` gjør
-- korrigeringen til en SELVREPARASJON: etter hvert kall er stillingen per
-- definisjon lik målene som finnes.
--
-- ---------------------------------------------------------------------------
-- ⚠️ HVA SOM SKJER MED ENGASJEMENTET
--
--   · EGET MÅL → MÅL IMOT: HEIA-ene er ikke lenger gyldige (P1: ingen HEIA
--     på mål imot) og slettes, sammen med varslene de utløste. KOMMENTARENE
--     BEHOLDES — et mål imot er noe man snakker om, og samtalen under posten
--     er lagets, ikke systemets.
--   · MÅL IMOT → EGET MÅL: ingenting slettes. Det finnes ingen HEIA å rydde,
--     og posten åpner seg for heiing av seg selv.
--   · ANNULLERING: systemposten soft-slettes og engasjementet på den fjernes.
--     ⚠️ BRUKERENS BILDEPOSTER OVERLEVER. De deler `match_event_id` med
--     øyeblikket (00028), men er brukerens innhold — FK-en er
--     `ON DELETE SET NULL` (00009:63), så de løsner fra hendelsen og blir
--     liggende i feeden med bilde, tekst, HEIA og kommentarer i behold.
--
-- ---------------------------------------------------------------------------
-- ⚠️ KORRIGERINGSVARSELET SENDES KUN NÅR STILLINGEN FAKTISK ENDRET SEG.
--
-- Rettes bare målscorerens navn, har ingen telefon vist noe galt, og et
-- varsel ville vært støy. Endres stillingen, har den derimot ALLEREDE ligget
-- på en låseskjerm — pushen er ute i samme sekund som målet (00049), og den
-- kan ikke trekkes tilbake. Da er stillhet verre enn støy.
--
-- Varselet er en ren `notifications`-rad, IKKE en feed-post: en post ville
-- utløst `notify_on_feed_post` og lagt en «systemmelding» midt i lagets feed.
-- Pushen følger gratis via `trg_push_on_notifications` (00049).
-- `match_event_type` utelates bevisst fra `data`, så `mapMatch` i appen
-- returnerer undefined og raden tegnes ROLIG — en korrigering er en setning,
-- ikke et målkort.
-- ============================================================
CREATE OR REPLACE FUNCTION public.correct_match_goal(
  p_match_event_id uuid,
  p_action         text,
  p_team_side      text DEFAULT NULL,
  p_player_name    text DEFAULT NULL,
  p_description    text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_me        record;
  v_ms        record;
  v_evt       record;
  v_post_id   uuid;
  v_team      text;
  v_side      text;
  v_player    text := NULLIF(btrim(COALESCE(p_player_name, '')), '');
  v_desc      text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_was_home  int;
  v_was_away  int;
  v_home      int;
  v_away      int;
  v_body      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_action NOT IN ('edit', 'cancel') THEN
    RAISE EXCEPTION 'Unsupported correction: %', p_action;
  END IF;

  -- ⚠️ LÅSEN FØRST, HENDELSEN ETTERPÅ — og rekkefølgen er ikke stil.
  -- Leses hendelsen før økta er låst, kan en annen reporter rette det SAMME
  -- målet i mellomtiden; da står `v_me.team_side` på en verdi som ikke lenger
  -- er sann, og «ble dette et mål imot nå?» under (som sletter HEIA-ene)
  -- svarer feil. Stillingen telles opp under samme lås.
  SELECT ms.* INTO v_ms
  FROM public.match_sessions ms
  WHERE ms.id = (
    SELECT me.match_session_id
    FROM public.match_events me
    WHERE me.id = p_match_event_id
  )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match event not found';
  END IF;

  SELECT * INTO v_me
  FROM public.match_events
  WHERE id = p_match_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match event not found';
  END IF;

  -- Bare MÅL. Rytmemarkørene (avspark, pause, 2. omgang, slutt) eier
  -- kampuret (00073) og kan ikke rettes uten å reversere tid; meldinger er
  -- reporterens egne ord og har ingen stilling å regne om.
  IF v_me.type <> 'mål' THEN
    RAISE EXCEPTION 'Only goals can be corrected';
  END IF;

  SELECT * INTO v_evt FROM public.events WHERE id = v_ms.event_id;

  -- Se COALESCE-kommentaren i start_match: uten den slipper et vanlig medlem
  -- gjennom på en kamp der reporter_id er NULL.
  IF NOT (
    COALESCE(v_ms.reporter_id = v_uid, false)
    OR is_team_admin(v_evt.team_space_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_was_home := v_ms.home_score;
  v_was_away := v_ms.away_score;

  -- Den KANONISKE posten for øyeblikket. Samme regel som appen bruker
  -- (`pickCanonicalPost`, shared/matchEngagement): systemposten, aldri et
  -- bilde. Eldst først, med id som tie-break, så to klienter aldri velger
  -- hver sin.
  -- ⚠️ KUN ID-EN, IKKE HELE RADEN. En `record` som ikke traff noe er ubehagelig
  -- å feltlese i plpgsql; en uuid er utvetydig NULL.
  SELECT fp.id INTO v_post_id
  FROM public.feed_posts fp
  WHERE fp.match_event_id = p_match_event_id
    AND fp.type IN ('match_event', 'match_start', 'match_end')
    AND fp.deleted_at IS NULL
  ORDER BY fp.created_at, fp.id
  LIMIT 1;

  -- ─── HANDLINGEN ──────────────────────────────────────────
  IF p_action = 'edit' THEN
    v_side := COALESCE(p_team_side, v_me.team_side);
    IF v_side NOT IN ('home', 'away') THEN
      RAISE EXCEPTION 'A goal needs team_side home or away';
    END IF;

    UPDATE public.match_events
    SET team_side   = v_side,
        player_name = v_player,
        description = v_desc
    WHERE id = p_match_event_id;

    -- Ble målet vårt til et mål imot, er HEIA-ene ugyldige (P1).
    -- Kommentarene står.
    IF v_side = 'away' AND v_me.team_side IS DISTINCT FROM 'away'
       AND v_post_id IS NOT NULL THEN
      DELETE FROM public.reactions WHERE feed_post_id = v_post_id;
      DELETE FROM public.notifications
      WHERE category = 'new_reaction'
        AND source_entity_type = 'feed_post'
        AND source_entity_id = v_post_id;
    END IF;

  ELSE  -- 'cancel'
    IF v_post_id IS NOT NULL THEN
      UPDATE public.feed_posts
      SET deleted_at = now(), is_pinned = false
      WHERE id = v_post_id;

      DELETE FROM public.reactions WHERE feed_post_id = v_post_id;

      -- Alle varsler posten har utløst — målvarselet, heia-varslene og
      -- kommentarvarslene — bærer samme source_entity (00051), så én DELETE
      -- tar innboksen ren.
      DELETE FROM public.notifications
      WHERE source_entity_type = 'feed_post'
        AND source_entity_id = v_post_id;
    END IF;

    -- Hard sletting: målet skal ikke finnes i forløpet. Bildepostene løsner
    -- via FK-en (ON DELETE SET NULL) og blir liggende — de blir frittstående
    -- kampbilder, som er nøyaktig det de er når målet ikke skjedde.
    -- ⚠️ Den soft-slettede systemposten mister også koblingen sin. Derfor
    -- bærer audit-raden under `feed_post_id`: uten den ville en gjenoppretting
    -- (ops, service role) ikke visst hvilken post som hørte til hendelsen.
    -- ⚠️ Nås tilskuerne kun fordi tabellen har REPLICA IDENTITY FULL (punkt 1).
    DELETE FROM public.match_events WHERE id = p_match_event_id;
  END IF;

  -- ─── STILLINGEN, TELT OPP PÅ NYTT ────────────────────────
  -- ⚠️ `IS DISTINCT FROM 'home'` på motstandersiden, ikke `= 'away'`: et mål
  -- uten side (importerte data) skal telle som mål IMOT. Samme
  -- forsiktighetsregel som `isOpponentGoal` i appen — bedre å underfeire eget
  -- mål enn å feire motstanderens.
  SELECT
    (count(*) FILTER (WHERE me.team_side = 'home'))::int,
    (count(*) FILTER (WHERE me.team_side IS DISTINCT FROM 'home'))::int
  INTO v_home, v_away
  FROM public.match_events me
  WHERE me.match_session_id = v_ms.id
    AND me.type = 'mål';

  UPDATE public.match_sessions
  SET home_score = v_home, away_score = v_away
  WHERE id = v_ms.id
  RETURNING * INTO v_ms;

  -- ─── SNAPSHOTENE ─────────────────────────────────────────
  PERFORM public.rebuild_match_feed_texts(v_ms.id);

  -- ─── INTERN AUDIT (service-role-only, 00012) ─────────────
  INSERT INTO public.audit_log
    (actor_id, team_space_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    v_uid, v_evt.team_space_id,
    'correct_match_goal:' || p_action,
    'match_event', p_match_event_id,
    jsonb_build_object(
      'type',           v_me.type,
      'minute',         v_me.minute,
      'team_side',      v_me.team_side,
      'player_name',    v_me.player_name,
      'description',    v_me.description,
      'sequence',       v_me.sequence,
      'reported_by',    v_me.reported_by,
      'created_at',     v_me.created_at,
      'feed_post_id',   v_post_id,
      'home_score',     v_was_home,
      'away_score',     v_was_away
    ),
    -- ⚠️ COALESCE, ikke bar CASE: `NULL || jsonb` er NULL i Postgres, så en
    -- annullering ville mistet stillingen sin i auditen helt stille.
    COALESCE(
      CASE WHEN p_action = 'cancel' THEN NULL ELSE jsonb_build_object(
        'team_side',   v_side,
        'player_name', v_player,
        'description', v_desc
      ) END,
      jsonb_build_object('cancelled', true)
    ) || jsonb_build_object('home_score', v_home, 'away_score', v_away)
  );

  -- ─── KORRIGERINGSVARSELET ────────────────────────────────
  IF v_home <> v_was_home OR v_away <> v_was_away THEN
    SELECT display_name INTO v_team
    FROM public.team_spaces WHERE id = v_evt.team_space_id;

    v_body := format(
      'Stillingen er rettet: %s %s–%s %s',
      COALESCE(v_team, 'Laget'), v_home, v_away,
      COALESCE(v_ms.opponent, 'motstanderen')
    );

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT DISTINCT m.user_id, v_evt.team_space_id, 'match_live',
           COALESCE(v_team, 'Heia'), v_body,
           jsonb_build_object(
             'event_id',         v_evt.id,
             'team_space_id',    v_evt.team_space_id,
             'match_session_id', v_ms.id,
             'type',             'match_correction',
             'home_score',       v_home,
             'away_score',       v_away,
             'opponent',         v_ms.opponent
           ),
           'match_session', v_ms.id, now()
    FROM public.memberships m
    WHERE m.team_space_id = v_evt.team_space_id
      AND m.status = 'active'
      AND m.user_id IS DISTINCT FROM v_uid
      AND public.inbox_enabled(m.user_id, v_evt.team_space_id, 'match_live');
  END IF;

  RETURN jsonb_build_object(
    'match_event_id', p_match_event_id,
    'action',         p_action,
    'home_score',     v_home,
    'away_score',     v_away,
    'status',         v_ms.status,
    'score_changed',  (v_home <> v_was_home OR v_away <> v_was_away)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.correct_match_goal(uuid, text, text, text, text)
  TO authenticated;


-- ============================================================
-- 7) HALVVEI 2 STENGES — «Slett innlegget» treffer ikke målposter
--
-- ⚠️ TO LAG, OG BEGGE TRENGS. `soft_delete_post` er SECURITY DEFINER og går
-- ikke gjennom RLS, så en sperre der stopper appen. UPDATE-policyene stopper
-- en spesiallaget klient som setter `deleted_at` direkte på tabellen. Uten
-- begge er halvveien fortsatt åpen — bare litt vanskeligere å finne.
--
-- ⚠️ BILDEPOSTER SKAL FORTSATT KUNNE SLETTES. De bærer `match_event_id`
-- (00028) men er brukerens eget innhold. Derfor er gaten på POSTTYPE, ikke
-- på `match_event_id` alene: systemets poster er `match_event`,
-- `match_start` og `match_end`.
--
-- `resultat`-poster har ingen `match_event_id` og er uberørt.
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete_post(p_post_id uuid)
RETURNS text[] AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_post  record;
  v_paths text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT fp.id, fp.team_space_id, fp.author_id, fp.deleted_at,
         fp.type, fp.match_event_id
  INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = p_post_id
  FOR UPDATE;

  IF v_post.id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- ⚠️ P3, SKIVE 8: en målpost er ikke et innlegg man sletter.
  -- Sletter man den, står stillingen på 2–1, hendelsen står i kampforløpet
  -- og varselet ligger i innboksen — brukeren TROR hun har angret. Kampens
  -- poster endres kun gjennom `correct_match_goal`.
  IF v_post.match_event_id IS NOT NULL
     AND v_post.type IN ('match_event', 'match_start', 'match_end') THEN
    RAISE EXCEPTION
      'Kamphendelser rettes i kampen, ikke i feeden'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (v_post.author_id = v_uid OR is_team_admin(v_post.team_space_id)) THEN
    RAISE EXCEPTION 'Not allowed to delete this post';
  END IF;

  -- Idempotent: to raske trykk (eller admin + forfatter samtidig)
  -- skal ikke gi feil nummer to.
  IF v_post.deleted_at IS NOT NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  -- is_pinned = false samtidig: en slettet post skal ikke ligge og
  -- «holde» viktig-plassen. Pin-triggeren (00024) vokter kun veien
  -- INN i festet tilstand, så dette passerer for alle forfattere.
  UPDATE public.feed_posts
  SET deleted_at = now(), is_pinned = false
  WHERE id = p_post_id;

  -- Kommentarene under røres ikke: de er alt usynlige via postens
  -- SELECT-kjede, og en gjenoppretting (ops, service role) skal
  -- kunne ta med seg tråden.
  WITH att AS (
    SELECT ma.media_id
    FROM public.media_attachments ma
    WHERE ma.entity_type = 'feed_post' AND ma.entity_id = p_post_id
  ), upd AS (
    UPDATE public.media m
    SET deleted_at = now()
    FROM att
    WHERE m.id = att.media_id AND m.deleted_at IS NULL
    RETURNING m.storage_path
  )
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
  INTO v_paths
  FROM upd;

  RETURN v_paths;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 8) …og i rettighetene. Ordrett 00014:188-196, med unntaket lagt til.
--
-- ⚠️ «Løsne»-knappen (feed.ts: UPDATE is_pinned = false) går gjennom disse
-- policyene. Målposter festes aldri — `report_match_event` setter ikke
-- `is_pinned` — så unntaket kan ikke ta livet av den knappen.
-- ============================================================
DROP POLICY IF EXISTS "Authors can update own posts" ON public.feed_posts;
CREATE POLICY "Authors can update own posts"
  ON public.feed_posts FOR UPDATE
  USING (
    author_id = (SELECT auth.uid())
    AND NOT (
      match_event_id IS NOT NULL
      AND type IN ('match_event', 'match_start', 'match_end')
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND NOT (
      match_event_id IS NOT NULL
      AND type IN ('match_event', 'match_start', 'match_end')
    )
  );

DROP POLICY IF EXISTS "Admins can moderate posts" ON public.feed_posts;
CREATE POLICY "Admins can moderate posts"
  ON public.feed_posts FOR UPDATE
  USING (
    is_team_admin(team_space_id)
    AND NOT (
      match_event_id IS NOT NULL
      AND type IN ('match_event', 'match_start', 'match_end')
    )
  );


-- ============================================================
-- 9) SKRIVESIDENS HEIA-GATE FOR MÅL IMOT — gjelden fra 00072
--
-- 00072 ga klienten det den trengte for å la være å TEGNE knappen, og skrev
-- eksplisitt at skriverettigheten hørte hjemme i skive 8. Her er den.
--
-- ⚠️ TRIGGER, IKKE RLS-POLICY. En WITH CHECK som feiler gir «new row violates
-- row-level security policy» — en setning som ikke kan vises til noen. En
-- trigger kan si hva regelen er, og feilen kan oversettes i appen.
--
-- ⚠️ GATEN ER SMAL, OG DET ER DEN FARLIGSTE DETALJEN HER (samme advarsel som
-- 00072 punkt 3). Den treffer KUN systemposten til et mål imot. Bildeposter
-- deler `match_event_id` med øyeblikket — et bilde tatt i det motstanderen
-- scoret er fortsatt brukerens bilde, og HEIA på det er ikke en feiring av
-- baklengsmålet. Uten `fp.type`-vilkåret ville denne triggeren gjort et
-- lovlig bilde uheiebart, og ingen enkelttest på et mål ville fanget det.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_no_heia_on_opponent_goal()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.feed_posts fp
    JOIN public.match_events me ON me.id = fp.match_event_id
    WHERE fp.id = NEW.feed_post_id
      AND fp.type IN ('match_event', 'match_start', 'match_end')
      AND me.type = 'mål'
      AND me.team_side IS DISTINCT FROM 'home'
  ) THEN
    RAISE EXCEPTION 'Det finnes ingen HEIA på mål imot'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_no_heia_on_opponent_goal ON public.reactions;
CREATE TRIGGER trg_no_heia_on_opponent_goal
  BEFORE INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_heia_on_opponent_goal();


-- ============================================================
-- ✅ KONTROLL ETTER `supabase db push` — kjør disse tre i SQL-editoren.
--
-- 1) REPLICA IDENTITY er FULL (uten den når annullering aldri tilskuerne):
--
--      SELECT relreplident FROM pg_class
--      WHERE oid = 'public.match_events'::regclass;
--      -- forventet: f
--
-- 2) DELETE-døren er borte, og RPC-en har grant:
--
--      SELECT polname, polcmd FROM pg_policy
--      WHERE polrelid = 'public.match_events'::regclass;
--      -- forventet: ingen rad med polcmd = 'd'
--
--      SELECT has_function_privilege(
--        'authenticated',
--        'public.correct_match_goal(uuid,text,text,text,text)', 'EXECUTE');
--      -- forventet: t
--
-- 3) Feeden lever fortsatt for et vanlig medlem (UPDATE-policyene ble
--    DROP+CREATE-et — les feeden fra appen, eller:)
--
--      SELECT count(*) FROM public.feed_posts;   -- som service role: > 0
--
-- ➡️ Den fulle beviskjeden mot ekte prod ligger i `scripts/verify-00075.sql`.
-- ============================================================
