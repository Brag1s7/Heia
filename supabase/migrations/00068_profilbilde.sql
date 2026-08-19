-- ============================================================
-- 00068_profilbilde.sql
-- PROFILBILDE (avatar-opplasting) — backend.
--
-- TO PRODUKTBESLUTNINGER, LÅST AV BRAGE 2026-08-19:
--   1. HVEM: alle med konto. Alle rollene som finnes er designet for
--      voksne — `forelder`, `supporter` (00045: «besteforeldre/tanter/
--      venner … eneste forskjell er etiketten») og lagadmin. `spiller`
--      er den eneste barne-aktige rollen, og appens innmeldingsskjerm
--      tilbyr den ikke; `set_member_role` (00067) nekter dessuten å
--      gi den til noen. Barn UTEN konto (`managed_children.avatar_url`)
--      er en ANNEN dør, og den forblir lukket i v1.
--   2. BUCKET: privat, feed-media-mønsteret — IKKE klubblogo-mønsteret.
--      Avgjørende var ikke hvem som laster opp, men at et profilbilde
--      i praksis ofte ER et bilde av et barn (norske foreldre bruker
--      barnet sitt som profilbilde). En offentlig bucket serverer
--      bytene utenom RLS, og 00042:99 nuller `avatar_url` ved
--      kontosletting UTEN å slette fila — i en offentlig bucket ville
--      bildet altså overlevd en GDPR-sletting på en åpen URL.
--
-- ⚠️ `profiles.avatar_url` BÆRER FRA NÅ EN STORAGE-PATH, IKKE EN URL.
--    Den MÅ gjøre det: signerte URL-er utløper (24 t, P1 — TTL-en ER
--    tilbakekallingsmekanismen), så en URL kan ikke lagres i en kolonne.
--    Kolonnen er IKKE døpt om, og det er en bevisst avveining: åtte
--    deployede RPC-er leser `p.avatar_url` inne i plpgsql-kropper
--    (get_team_feed, get_team_members, get_team_authors, get_match_photos,
--    get_event_with_rsvp, de tre varsel-triggerne). plpgsql binder
--    kolonnenavn ved FØRSTE KJØRING, ikke ved definisjon — et
--    `RENAME COLUMN` ville altså ikke feilet her, men i produksjon,
--    én RPC av gangen. Prisen for et ærlig navn er DROP+CREATE av åtte
--    funksjoner med gjenskapte 00060-grants; gevinsten er null, siden
--    appen uansett aldri ser verdien (MediaRef-kontrakten, P4/P12).
--    Appsiden heter derfor `avatarPath` overalt — det er DER navnet
--    måtte være ærlig. COMMENT-en under er kanonisk.
--
-- Innhold:
--   1. privat bucket `avatars` (m/ størrelses- og mime-grenser i SQL —
--      versjonert, i motsetning til feed-media/club-logos som ble satt
--      via Storage-API-et i fase A)
--   2. `shares_team_with(uuid)` — leserettens kanoniske definisjon
--   3. storage-policyer (INSERT/SELECT/DELETE)
--   4. profiles-UPDATE-policyen strammet: du kan bare peke på DIN egen
--      mappe (ellers kunne hvem som helst sette en annens bilde på seg)
--   5. `remove_member_avatar` — lagadmins moderasjonsknapp
--   6. `content_reports` + `report_content` utvidet med 'avatar':
--      profilbilde er UGC, og Apple 1.2 krever en flaggemekanisme.
--      Uten dette punktet ville skiva lagt til en ny UGC-flate uten
--      rapporteringsvei rett før App Store-innsending.
-- ============================================================


-- ============================================================
-- 1) Privat bucket `avatars`
--
-- Path-konvensjon: {user_id}/avatar-{epoch_ms}.jpg
-- Første mappesegment er user_id — samme grep som feed-media
-- ({team_space_id}) og club-logos ({club_id}/{team_space_id}):
-- policyene leser segment 1 og gater på det.
--
-- Nytt filnavn per opplasting (epoch_ms). Ikke for cachens skyld
-- (expo-image nøkles på path, ikke URL — B1), men fordi et byttet
-- bilde skal ha en NY path: den gamle blir da entydig død, og
-- `x-upsert: false` i uploadFileToBucket kan aldri overskrive.
--
-- 2 MiB / kun bilde-mime: pickeren leverer 256 px (~25 kB), så taket
-- er ren sabotasjegrense. Samme mime-liste som feed-media fra fase A.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================
-- 2) shares_team_with(other) — hvem får SE bildet ditt?
--
-- Definisjonen SPEILER `get_team_authors` (00067) med vilje: den
-- returnerer navn og avatar for alle som NOEN GANG har hatt en
-- medlemsrad i laget, nettopp fordi innlegg og kommentarer består
-- når noen melder seg ut (§2 i frysdokumentet). Krevde vi AKTIVT
-- medlemskap på BEGGE sider, ville hver gamle kommentar mistet
-- ansiktet i det forfatteren forlot laget — en regresjon i den
-- skiva som akkurat ble lukket.
--
-- Asymmetrien er derfor bevisst og er selve poenget:
--   · LESEREN må være AKTIVT medlem (ellers er man ikke i laget)
--   · EIEREN trenger bare å ha en rad der (uansett status)
--
-- Konsekvens å kjenne: melder du deg ut, kan laget du forlot
-- fortsatt se profilbildet ditt i den gamle historikken. Det er
-- samme opplysning som navnet ditt, som allerede blir stående.
-- Vil du bort fra den, fjerner du bildet — da er det borte overalt.
-- ============================================================
CREATE OR REPLACE FUNCTION shares_team_with(other_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships me
    JOIN public.memberships them
      ON them.team_space_id = me.team_space_id
    WHERE me.user_id = auth.uid()
      AND me.status = 'active'
      AND them.user_id = other_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION shares_team_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION shares_team_with(uuid) TO authenticated;


-- ============================================================
-- 3) Storage-policyer på `avatars`
--
-- NB (00035-lærdommen): ytre kolonner MÅ kvalifiseres i policy-
-- uttrykk — ukvalifisert `name` binder til nærmeste relasjon.
-- NB (00036-lærdommen): en bucket det lastes opp til trenger alltid
-- en SELECT-policy som dekker opplasterens egne rader, fordi
-- Storage-API-et gjør INSERT … RETURNING.
--
-- ⚠️ INVARIANT FOR HELE storage.objects: flere permissive policyer for
-- samme kommando OR-es sammen, så SELECT-policyen under evalueres også
-- mot rader i feed-media og club-logos. `::uuid`-castet ville da kastet
-- på en path hvis første segment IKKE er en uuid. Det holder i dag
-- (feed-media = {team_space_id}, club-logos = {club_id}/{team_space_id},
-- avatars = {user_id}), og 00018 har nøyaktig samme forutsetning.
-- LEGGER DU TIL EN BUCKET: første mappesegment MÅ være en uuid.
-- ============================================================

-- Du skriver kun i din egen mappe.
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(objects.name))[1] = auth.uid()::text
  );

-- Du ser ditt eget bilde, og bildet til alle du deler lag med.
CREATE POLICY "Team mates can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(objects.name))[1] = auth.uid()::text
      OR shares_team_with((storage.foldername(objects.name))[1]::uuid)
    )
  );

-- Sletting: din egen mappe — ELLER lagadmin i et lag eieren er med i.
-- Admin-grenen er moderasjonsknappen (punkt 5): uten den kan et
-- upassende profilbilde nulles i basen, men fila ville blitt liggende
-- og fortsatt vist seg i varslene som frøs path-en (00051).
-- Speiler `soft_delete_post` (00041): lagadmin kan fjerne andres innhold.
CREATE POLICY "Owner or team admin can delete avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(objects.name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.memberships owner_m
        WHERE owner_m.user_id = (storage.foldername(objects.name))[1]::uuid
          AND is_team_admin(owner_m.team_space_id)
      )
    )
  );


-- ============================================================
-- 4) profiles.avatar_url — kanonisk betydning + skrivevakt
--
-- Uten WITH CHECK-vakten kunne hvem som helst sette `avatar_url` til
-- en ANNENS path (policyen fra 00005 sjekket bare `id = auth.uid()`,
-- ingen kolonnevakt). Lesingen ville fortsatt vært lovlig — man ser
-- jo lagkameratens bilde uansett — men navnet ditt ville stått under
-- et annet menneskes ansikt i feeden. Det er identitet, ikke tilgang,
-- og det stoppes her.
--
-- Merk at vakten er en PREFIKS-sjekk, ikke en eksistenssjekk: at
-- fila faktisk finnes er storage sitt ansvar, og en path som peker
-- på ingenting gir initialer i appen (Avatar faller tilbake).
-- ============================================================
COMMENT ON COLUMN public.profiles.avatar_url IS
  'Storage-PATH i den private bucketen «avatars» ({user_id}/avatar-{ms}.jpg), '
  'IKKE en URL — signerte URL-er utløper og kan ikke lagres. NULL = ingen '
  'profilbilde (appen viser initialer). Navnet er beholdt fordi åtte '
  'deployede RPC-er leser kolonnen; appsiden heter avatarPath. Se 00068.';

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      avatar_url IS NULL
      OR avatar_url LIKE auth.uid()::text || '/%'
    )
  );


-- ============================================================
-- 5) remove_member_avatar — lagadmins moderasjonsknapp
--
-- «Fjern fra laget» (00041) var frem til nå eneste maktmiddel mot et
-- upassende profilbilde — en trener måtte kaste ut en forelder for å
-- bli kvitt et bilde. Dette er den forholdsmessige knappen.
--
-- Returnerer path-en så klienten kan slette selve fila (best-effort,
-- samme mønster som updateTeamLogo og deletePost). Kolonnen er
-- fasiten: er den NULL, er bildet borte fra ALLE levende flater
-- (feed, kommentarer, lagoversikt, profil) med én gang. Kun frosne
-- varselrader (00051 `actor_avatar`) bærer path-en videre, og de
-- faller til initialer i det fila faktisk er slettet.
-- ============================================================
CREATE OR REPLACE FUNCTION remove_member_avatar(
  p_team_space_id uuid,
  p_user_id       uuid
)
RETURNS jsonb AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_path text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke innlogget.';
  END IF;
  IF NOT is_team_admin(p_team_space_id) THEN
    RAISE EXCEPTION 'Bare trenere og lagledere kan fjerne et profilbilde.';
  END IF;

  -- Personen må høre til laget. Alle statuser godtas — en utmeldt
  -- forfatter vises fortsatt med bilde i gamle kommentarer
  -- (get_team_authors), så bildet må kunne fjernes derfra også.
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE team_space_id = p_team_space_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Personen hører ikke til dette laget.';
  END IF;

  SELECT avatar_url INTO v_path FROM public.profiles WHERE id = p_user_id;

  IF v_path IS NULL THEN
    RETURN jsonb_build_object('outcome', 'none');
  END IF;

  UPDATE public.profiles SET avatar_url = NULL WHERE id = p_user_id;

  RETURN jsonb_build_object('outcome', 'cleared', 'path', v_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION remove_member_avatar(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_member_avatar(uuid, uuid) TO authenticated;


-- ============================================================
-- 6) Rapportering av profilbilde (Apple 1.2)
--
-- Et profilbilde er brukergenerert innhold, og frem til nå kunne det
-- ikke rapporteres — `content_reports` kjente bare feed_post og
-- comment (00041:44). En person kan ha et upassende profilbilde uten
-- noen gang å poste, og da fantes det ingen vei til Heia i det hele
-- tatt. Denne grenen lukker hullet.
--
-- entity_id = profilen (personen bildet hører til).
-- content_snapshot = path-en på rapporttidspunktet. Merk forskjellen
-- fra tekst: en frossen tekst overlever at innholdet slettes, en
-- frossen path gjør det IKKE — er fila borte når Heia ser på saken,
-- er saken løst av seg selv, og det er nettopp utfallet vi ville hatt.
-- ============================================================
ALTER TABLE public.content_reports
  DROP CONSTRAINT content_reports_entity_type_check;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_entity_type_check
  CHECK (entity_type IN ('feed_post','comment','avatar'));


-- CREATE OR REPLACE beholder grants (signaturen er uendret) — kun
-- avatar-grenen er ny, resten er ordrett 00041.
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
  IF p_entity_type NOT IN ('feed_post','comment','avatar') THEN
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
  ELSIF p_entity_type = 'comment' THEN
    SELECT fp.team_space_id, c.author_id, c.content
    INTO v_team_space_id, v_author_id, v_content
    FROM public.comments c
    JOIN public.feed_posts fp ON fp.id = c.feed_post_id
    WHERE c.id = p_entity_id;
  ELSE
    -- Avatar: laget utledes av at BEGGE er der. Deler de flere lag,
    -- er valget vilkårlig men deterministisk (eldste medlemskap) —
    -- rapporten skal uansett til Heia, og team_space_id er kontekst
    -- for saksbehandleren, ikke en tilgangsavgjørelse.
    SELECT me.team_space_id, p.id, p.avatar_url
    INTO v_team_space_id, v_author_id, v_content
    FROM public.memberships me
    JOIN public.memberships them
      ON them.team_space_id = me.team_space_id
     AND them.user_id = p_entity_id
    JOIN public.profiles p ON p.id = p_entity_id
    WHERE me.user_id = v_uid
      AND me.status = 'active'
    ORDER BY me.created_at
    LIMIT 1;
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
