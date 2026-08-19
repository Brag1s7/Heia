-- ============================================================
-- 00064 — autoritetsmodellen v2, oppfølging: FORSØK OG UTLØP MÅ
-- OVERLEVE. Funnet av verify-00062 test 21 (2026-08-18).
--
-- FUNNET: PL/pgSQL ruller tilbake ALT arbeid i en funksjon som
-- avslutter med RAISE EXCEPTION — også INSERT-ene i
-- payment_authority_events og statusflippen til 'expired'. Tre
-- LÅSTE krav i frysen (II.5/II.9) var dermed ikke oppfylt i
-- praksis, selv om koden så riktig ut:
--   * «alle hendelser OG forsøk logges» — invite_attempt_invalid
--     forsvant sammen med feilmeldingen.
--   * «utløp håndheves ved innløsning» — statusen forble 'pending'
--     til cron ryddet (inntil ~24 t), og managerløs-varselet uteble.
--   * sikkerhetsvarselet ved invitasjonsforsøk fra SUSPENDERT
--     betalingsansvarlig (B5-unntakslisten) ble rullet tilbake.
--
-- Sikkerheten var ALDRI svekket (ingen rolle ble gitt i noen av
-- tilfellene, og utløpte/brukte tokens ble avvist som de skulle) —
-- det som manglet var sporet og varslingen.
--
-- FIKSEN: forventede utfall RETURNERES som outcome i stedet for å
-- kastes som exception, så sideeffektene committer. Exceptions
-- beholdes KUN der det ikke finnes noe spor å bevare (ikke
-- innlogget, uverifisert e-post, ugyldig input, duplikat, manglende
-- rolle) — der er en feilmelding hele poenget.
--
-- KONTRAKTEN (web-landingen i fase B + appflatene i A2):
--   redeem_manager_invitation(token) → jsonb
--     outcome: accepted | awaiting_review | invalid | expired
--              | suspended   (+ legal_name der den er kjent)
--   decline_manager_invitation(token, note) → jsonb
--     outcome: declined | invalid
--   issue_manager_invitation(entity, navn, e-post, note) → jsonb
--     outcome: issued (+ invitation_id) | suspended
--
-- «invalid» skiller BEVISST ikke mellom ukjent, brukt og trukket
-- token — en innløser skal ikke kunne kartlegge hvilke tokens som
-- finnes. Ops ser forskjellen i hendelsesloggen.
-- ============================================================


-- ============================================================
-- 1) redeem_manager_invitation — outcome-basert.
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_manager_invitation(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_verified timestamptz;
  v_pname    text;
  v_hash     text;
  v_inv      public.manager_invitations%ROWTYPE;
  v_legal    text;
  v_existing public.club_payment_managers%ROWTYPE;
  v_match    boolean;
  v_names    boolean;
BEGIN
  -- Ingen sideeffekt å bevare her → exception er riktig.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_verified
  FROM auth.users u WHERE u.id = v_uid;
  IF v_verified IS NULL THEN
    RAISE EXCEPTION 'Bekreft e-postadressen din først — sjekk innboksen.';
  END IF;

  IF p_token IS NULL OR length(p_token) < 20 THEN
    PERFORM log_authority_event(NULL, 'invite_attempt_invalid', v_uid,
      NULL, v_uid, 'For kort/tomt token');
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.manager_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM log_authority_event(NULL, 'invite_attempt_invalid', v_uid,
      NULL, v_uid, 'Ukjent token-hash');
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = v_inv.legal_club_entity_id;

  IF v_inv.status <> 'pending' THEN
    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_attempt_invalid', v_uid, v_inv.id, v_uid,
      'Innløsningsforsøk på ikke-pending invitasjon (' || v_inv.status || ')');
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  -- Lat utløpshåndhevelse — NÅ overlever både statusflippen,
  -- hendelsen og managerløs-varselet (00064-fiksen).
  IF v_inv.expires_at < now() THEN
    UPDATE public.manager_invitations
    SET status = 'expired' WHERE id = v_inv.id;
    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_expired', NULL, v_inv.id, v_uid, 'Utløpt ved innløsningsforsøk');
    IF NOT entity_has_active_manager(v_inv.legal_club_entity_id) THEN
      PERFORM notify_payments_event('managerless', jsonb_build_object(
        'legal_club_entity_id', v_inv.legal_club_entity_id,
        'reason', 'invitasjon utløp'));
    END IF;
    RETURN jsonb_build_object('outcome', 'expired', 'legal_name', v_legal);
  END IF;

  -- Suspendert for enheten: reaktivering er en ops-beslutning, og
  -- forsøket er et sikkerhetsavvik som SKAL varsles (B5-unntak).
  SELECT * INTO v_existing
  FROM public.club_payment_managers
  WHERE legal_club_entity_id = v_inv.legal_club_entity_id AND user_id = v_uid;
  IF FOUND AND v_existing.status = 'suspended' THEN
    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_attempt_invalid', v_uid, v_inv.id, v_uid,
      'Innløsningsforsøk fra suspendert konto');
    PERFORM notify_payments_event('security', jsonb_build_object(
      'legal_club_entity_id', v_inv.legal_club_entity_id,
      'reason', 'Innløsningsforsøk fra suspendert betalingsansvarlig',
      'user_id', v_uid));
    RETURN jsonb_build_object('outcome', 'suspended', 'legal_name', v_legal);
  END IF;

  SELECT display_name INTO v_pname FROM public.profiles WHERE id = v_uid;
  v_match := lower(trim(v_email)) = lower(trim(v_inv.invited_email));
  v_names := payment_names_match(v_pname, v_inv.invited_name);

  IF v_match THEN
    INSERT INTO public.club_payment_managers
      (legal_club_entity_id, user_id, source, note)
    VALUES (v_inv.legal_club_entity_id, v_uid, 'invite',
            'Akseptert invitasjon ' || v_inv.id)
    ON CONFLICT (legal_club_entity_id, user_id) DO NOTHING;

    UPDATE public.manager_invitations
    SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
    WHERE id = v_inv.id;

    PERFORM log_authority_event(v_inv.legal_club_entity_id, 'accepted',
      v_uid, v_inv.id, v_uid, NULL,
      jsonb_build_object('email_match', true));
    PERFORM log_authority_event(v_inv.legal_club_entity_id, 'granted',
      v_uid, v_inv.id, v_uid, 'Aktiv rolle ved akseptert invitasjon');

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT c.claimant_user_id, NULL, 'system',
           'Betalingsansvarlig på plass 💚',
           COALESCE(v_inv.invited_name, 'Den inviterte') ||
             ' har takket ja til å være betalingsansvarlig for ' ||
             COALESCE(v_legal, 'klubben') || '.',
           jsonb_build_object('screen', 'support_setup'),
           'manager_invitation', v_inv.id, now()
    FROM public.club_claims c
    WHERE c.id = v_inv.claim_id AND c.claimant_user_id <> v_uid;

    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT m.user_id, NULL, 'system',
           'Ny betalingsansvarlig',
           COALESCE(v_pname, 'En ny person') || ' er nå betalingsansvarlig for ' ||
             COALESCE(v_legal, 'klubben') || '.',
           jsonb_build_object('screen', 'club_payments'),
           'manager_invitation', v_inv.id, now()
    FROM public.club_payment_managers m
    WHERE m.legal_club_entity_id = v_inv.legal_club_entity_id
      AND m.status = 'active' AND m.user_id <> v_uid;

    PERFORM notify_payments_event('accepted',
      jsonb_build_object('invitation_id', v_inv.id));

    RETURN jsonb_build_object('outcome', 'accepted', 'legal_name', v_legal);
  END IF;

  -- AVVIK (B1): registrer innløsningen, men INGEN aktiv rolle —
  -- ops må bekrefte gjennom auditert flate FØR aktivering.
  UPDATE public.manager_invitations
  SET status = 'awaiting_review', accepted_by = v_uid, accepted_at = now(),
      mismatch = jsonb_build_object(
        'account_email', v_email,
        'invited_email', v_inv.invited_email,
        'profile_name', v_pname,
        'invited_name', v_inv.invited_name,
        'name_match', v_names)
  WHERE id = v_inv.id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id,
    'invite_redeemed_review', v_uid, v_inv.id, v_uid,
    'E-postavvik ved innløsning — venter ops-kontroll',
    jsonb_build_object('name_match', v_names));

  PERFORM notify_payments_event('review_needed',
    jsonb_build_object('invitation_id', v_inv.id));

  RETURN jsonb_build_object('outcome', 'awaiting_review', 'legal_name', v_legal);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================
-- 2) decline_manager_invitation — outcome-basert (og forsøk logges).
-- ============================================================
DROP FUNCTION IF EXISTS decline_manager_invitation(text, text);

CREATE FUNCTION decline_manager_invitation(
  p_token text,
  p_note  text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_inv   public.manager_invitations%ROWTYPE;
  v_legal text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  IF p_token IS NULL OR length(p_token) < 20 THEN
    PERFORM log_authority_event(NULL, 'invite_attempt_invalid', v_uid,
      NULL, v_uid, 'Avslagsforsøk med for kort/tomt token');
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.manager_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND OR v_inv.status <> 'pending' THEN
    PERFORM log_authority_event(
      CASE WHEN FOUND THEN v_inv.legal_club_entity_id ELSE NULL END,
      'invite_attempt_invalid', v_uid,
      CASE WHEN FOUND THEN v_inv.id ELSE NULL END, v_uid,
      'Avslagsforsøk på ukjent/behandlet invitasjon');
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  UPDATE public.manager_invitations
  SET status = 'declined', accepted_by = v_uid, accepted_at = now(),
      note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), note)
  WHERE id = v_inv.id;

  PERFORM log_authority_event(v_inv.legal_club_entity_id,
    'invite_declined', v_uid, v_inv.id, v_uid,
    NULLIF(trim(COALESCE(p_note, '')), ''));

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = v_inv.legal_club_entity_id;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT c.claimant_user_id, NULL, 'system',
         'Invitasjonen ble ikke akseptert',
         COALESCE(v_inv.invited_name, 'Den inviterte') ||
           ' takket nei til å være betalingsansvarlig for ' ||
           COALESCE(v_legal, 'klubben') ||
           '. Ta kontakt på hello@heiaapp.no for å nominere en annen.',
         jsonb_build_object('screen', 'support_setup'),
         'manager_invitation', v_inv.id, now()
  FROM public.club_claims c
  WHERE c.id = v_inv.claim_id;

  IF NOT entity_has_active_manager(v_inv.legal_club_entity_id) THEN
    PERFORM notify_payments_event('managerless', jsonb_build_object(
      'legal_club_entity_id', v_inv.legal_club_entity_id,
      'reason', 'invitasjon avslått'));
  END IF;

  RETURN jsonb_build_object('outcome', 'declined', 'legal_name', v_legal);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================
-- 3) issue_manager_invitation — outcome-basert (sikkerhetsvarselet
--    ved suspendert utsteder må overleve).
-- ============================================================
DROP FUNCTION IF EXISTS issue_manager_invitation(uuid, text, text, text);

CREATE FUNCTION issue_manager_invitation(
  p_entity_id uuid,
  p_name      text,
  p_email     text,
  p_note      text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_row   public.club_payment_managers%ROWTYPE;
  v_name  text := NULLIF(trim(COALESCE(p_name, '')), '');
  v_email text := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
  v_legal text;
  v_pname text;
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  SELECT * INTO v_row
  FROM public.club_payment_managers
  WHERE legal_club_entity_id = p_entity_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan invitere.';
  END IF;

  -- Sideeffekt som MÅ committe → outcome, ikke exception.
  IF v_row.status = 'suspended' THEN
    PERFORM log_authority_event(p_entity_id, 'invite_attempt_invalid',
      v_uid, NULL, v_uid, 'Invitasjonsforsøk fra suspendert konto');
    PERFORM notify_payments_event('security', jsonb_build_object(
      'legal_club_entity_id', p_entity_id,
      'reason', 'Invitasjonsforsøk fra suspendert betalingsansvarlig',
      'user_id', v_uid));
    RETURN jsonb_build_object('outcome', 'suspended');
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Skriv inn navnet på den du inviterer.';
  END IF;
  IF COALESCE(v_email NOT LIKE '%@%', true) THEN
    RAISE EXCEPTION 'Skriv inn en gyldig e-postadresse.';
  END IF;

  BEGIN
    INSERT INTO public.manager_invitations
      (legal_club_entity_id, invited_name, invited_email, source,
       created_by, note)
    VALUES (p_entity_id, v_name, v_email, 'manager', v_uid,
            NULLIF(trim(COALESCE(p_note, '')), ''))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Det ligger allerede en åpen invitasjon til denne adressen.';
  END;

  PERFORM log_authority_event(p_entity_id, 'invite_issued', NULL, v_id,
    v_uid, NULLIF(trim(COALESCE(p_note, '')), ''),
    jsonb_build_object('source', 'manager'));

  SELECT legal_name INTO v_legal
  FROM public.legal_club_entities WHERE id = p_entity_id;
  SELECT display_name INTO v_pname FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.notifications
    (user_id, team_space_id, category, title, body, data,
     source_entity_type, source_entity_id, sent_at)
  SELECT m.user_id, NULL, 'system',
         'Ny betalingsansvarlig invitert',
         COALESCE(v_pname, 'En betalingsansvarlig') || ' har invitert ' ||
           v_name || ' som betalingsansvarlig for ' ||
           COALESCE(v_legal, 'klubben') || '.',
         jsonb_build_object('screen', 'club_payments'),
         'manager_invitation', v_id, now()
  FROM public.club_payment_managers m
  WHERE m.legal_club_entity_id = p_entity_id
    AND m.status = 'active' AND m.user_id <> v_uid;

  PERFORM notify_payments_event('manager_issued',
    jsonb_build_object('invitation_id', v_id));
  PERFORM notify_payments_event('invitation',
    jsonb_build_object('invitation_id', v_id));

  RETURN jsonb_build_object('outcome', 'issued', 'invitation_id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4) Rettigheter på nytt (DROP+CREATE nullstiller grants).
-- ============================================================
GRANT EXECUTE ON FUNCTION decline_manager_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_manager_invitation(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION decline_manager_invitation(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION issue_manager_invitation(uuid, text, text, text) FROM PUBLIC, anon;
