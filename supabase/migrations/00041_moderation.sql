-- ============================================================
-- 00041_moderation.sql
-- V1-HYGIENE del 1: moderasjon (Apple 1.2 — UGC-kravene).
--
-- Tre ting, samme skive:
--   1. Sletting av innlegg/kommentarer — soft delete. deleted_at
--      har eksistert siden 00009, og HELE lesestien filtrerer
--      allerede på den (get_team_feed, comment_count, RLS-SELECT).
--      RPC-er (ikke direkte UPDATE fra klienten) fordi en soft-
--      slettet rad ikke lenger passerer SELECT-policyen — et
--      `UPDATE … RETURNING` gir da 0 rader OGSÅ når slettingen
--      lyktes (samme familie som 00036-lærdommen), og klienten
--      kunne ikke skilt suksess fra RLS-avslag.
--   2. Rapportering til Heia — content_reports. Deny-by-default:
--      RLS er PÅ uten policies; skriving skjer kun via RPC-en,
--      lesing kun som service role/SQL-editor (ops er manuell,
--      som club_claims-reviewen i 00038).
--   3. Fjerning av medlem — status='removed', IKKE hard delete.
--      Skjemaet har forberedt dette siden 00007: CHECK-en kjenner
--      'removed', left_at finnes, og unik-indeksen gjelder kun
--      status='active' — så personen kan inviteres inn igjen
--      senere uten kollisjon, og historikken består.
--      KJENT BEGRENSNING: en fjernet person som fortsatt husker
--      invitasjonskoden kan bli med igjen via join_team_space.
--      Rotering av invitasjonskode er backlog — i lukket
--      lagkontekst er dette akseptert i v1.
--
-- Innhold FRA en fjernet/slettet forfatter blir stående (author
-- består) — fjerning er tilgangsstyring, ikke historieomskriving.
-- ============================================================


-- ============================================================
-- content_reports — rapporter til Heia.
--
-- content_snapshot fryser innholdet på rapporttidspunktet: en
-- admin kan slette innlegget FØR Heia rekker å se på saken, og
-- da må rapporten fortsatt kunne vurderes.
-- ============================================================
CREATE TABLE public.content_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_space_id     uuid NOT NULL REFERENCES public.team_spaces(id) ON DELETE CASCADE,
  reporter_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type       text NOT NULL CHECK (entity_type IN ('feed_post','comment')),
  entity_id         uuid NOT NULL,
  reason            text NOT NULL CHECK (reason IN ('upassende','trakassering','annet')),
  details           text,
  content_snapshot  text,
  content_author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','resolved','dismissed')),
  resolved_at       timestamptz,
  resolution_note   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Én ÅPEN rapport per person per innhold — «Rapporter» to ganger
-- skal ikke gi to saker (RPC-en gjør ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX idx_content_reports_open_unique
  ON public.content_reports (reporter_id, entity_type, entity_id)
  WHERE status = 'open';

-- Ops-køen: «hva er åpent?» er det eneste spørsmålet som stilles ofte.
CREATE INDEX idx_content_reports_open
  ON public.content_reports (created_at)
  WHERE status = 'open';

-- RLS PÅ, ingen policies = deny all for klienter (med vilje).
-- report_content (SECURITY DEFINER) er eneste vei inn; service
-- role/SQL-editor er eneste vei til lesing og saksbehandling.
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- report_content() — klient-RPC, medlemsgatet.
--
-- Filtrerer IKKE på deleted_at ved oppslag: rapporten kan komme
-- i kapp med at admin sletter innholdet, og da skal takk-svaret
-- fortsatt være sant.
-- ============================================================
CREATE OR REPLACE FUNCTION report_content(
  p_entity_type text,
  p_entity_id   uuid,
  p_reason      text,
  p_details     text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_team_space_id uuid;
  v_author_id     uuid;
  v_content       text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_entity_type NOT IN ('feed_post','comment') THEN
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;
  IF p_reason NOT IN ('upassende','trakassering','annet') THEN
    RAISE EXCEPTION 'Invalid reason: %', p_reason;
  END IF;

  IF p_entity_type = 'feed_post' THEN
    SELECT fp.team_space_id, fp.author_id, fp.content
    INTO v_team_space_id, v_author_id, v_content
    FROM public.feed_posts fp
    WHERE fp.id = p_entity_id;
  ELSE
    SELECT fp.team_space_id, c.author_id, c.content
    INTO v_team_space_id, v_author_id, v_content
    FROM public.comments c
    JOIN public.feed_posts fp ON fp.id = c.feed_post_id
    WHERE c.id = p_entity_id;
  END IF;

  IF v_team_space_id IS NULL THEN
    RAISE EXCEPTION 'Content not found';
  END IF;
  IF NOT is_team_member(v_team_space_id) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  INSERT INTO public.content_reports (
    team_space_id, reporter_id, entity_type, entity_id,
    reason, details, content_snapshot, content_author_id
  ) VALUES (
    v_team_space_id, v_uid, p_entity_type, p_entity_id,
    p_reason, p_details, v_content, v_author_id
  )
  ON CONFLICT (reporter_id, entity_type, entity_id)
    WHERE status = 'open'
    DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- soft_delete_post() — forfatter ELLER lagadmin.
--
-- Returnerer storage-pathene til bildene som ble soft-slettet,
-- så klienten kan fjerne selve filene best-effort (storage-
-- policyen fra 00018 lar lagmedlemmer slette i egen lagmappe).
-- Feiler filslettingen er bildet uansett usynlig — media-raden
-- er soft-slettet, og alle lesestier filtrerer på den.
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

  SELECT fp.id, fp.team_space_id, fp.author_id, fp.deleted_at
  INTO v_post
  FROM public.feed_posts fp
  WHERE fp.id = p_post_id
  FOR UPDATE;

  IF v_post.id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
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
-- soft_delete_comment() — forfatter ELLER lagadmin (for laget
-- kommentarens innlegg hører til).
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete_comment(p_comment_id uuid)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id, c.author_id, c.deleted_at, fp.team_space_id
  INTO v_row
  FROM public.comments c
  JOIN public.feed_posts fp ON fp.id = c.feed_post_id
  WHERE c.id = p_comment_id
  FOR UPDATE OF c;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT (v_row.author_id = v_uid OR is_team_admin(v_row.team_space_id)) THEN
    RAISE EXCEPTION 'Not allowed to delete this comment';
  END IF;
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN; -- idempotent, som soft_delete_post
  END IF;

  UPDATE public.comments
  SET deleted_at = now()
  WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- remove_team_member() — lagadmin fjerner et medlem.
--
-- RPC og ikke direkte DELETE (policyen fra 00014 finnes) fordi
-- vaktene må bo i databasen, ikke i UI-et:
--   * du kan ikke fjerne deg selv (å forlate laget er en annen
--     flyt, med andre konsekvenser)
--   * trener/lagleder/admin kan ikke fjernes — ellers kunne to
--     admins fjerne hverandre og etterlate laget uten voksne.
--     Rollebytte først, så fjerning, den dagen det trengs.
-- Fjerner ALLE medlemskapsradene til personen i laget (en
-- forelder med to barn har to rader — barna følger forelderen).
-- RSVP-er på FREMTIDIGE hendelser slettes så «N kommer» ikke
-- teller folk som ikke lenger er med; historikken består.
-- ============================================================
CREATE OR REPLACE FUNCTION remove_team_member(
  p_team_space_id uuid,
  p_user_id       uuid
)
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Only team admins can remove members';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.team_space_id = p_team_space_id
      AND m.status IN ('active','invited')
      AND m.role IN ('trener','lagleder','admin')
  ) THEN
    RAISE EXCEPTION 'Team admins cannot be removed';
  END IF;

  UPDATE public.memberships
  SET status = 'removed', left_at = now()
  WHERE user_id = p_user_id
    AND team_space_id = p_team_space_id
    AND status IN ('active','invited');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  DELETE FROM public.event_rsvps er
  USING public.events e
  WHERE er.event_id = e.id
    AND e.team_space_id = p_team_space_id
    AND er.user_id = p_user_id
    AND e.start_time > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
