-- ============================================================
-- 00063 — autoritetsmodellen v2: tidsstyringen for invitasjoner.
--
-- Utløp håndheves LAT ved innløsning (00062) — cron-jobben her er
-- opprydding og varsling: flipper pending → expired etter 14 dager
-- (med claimant-varsel + managerløs-sjekk), og ber payments-notify
-- sende påminnelsen dag 7. Påminnelsen ROTERER tokenet (B3) —
-- payments-notify eier både generering, hash-skriving og
-- reminded_at (settes først etter Resend-OK, så en feilet
-- utsendelse prøves igjen neste døgn).
--
-- Mønster: 00055 (pg_cron + unschedule-guard).
-- ============================================================

CREATE OR REPLACE FUNCTION expire_and_remind_manager_invitations()
RETURNS void AS $$
DECLARE
  v_inv   record;
  v_legal text;
BEGIN
  -- 1) Utløp: pending forbi fristen.
  FOR v_inv IN
    SELECT i.id, i.legal_club_entity_id, i.claim_id, i.invited_name
    FROM public.manager_invitations i
    WHERE i.status = 'pending' AND i.expires_at < now()
    FOR UPDATE
  LOOP
    UPDATE public.manager_invitations
    SET status = 'expired' WHERE id = v_inv.id;

    PERFORM log_authority_event(v_inv.legal_club_entity_id,
      'invite_expired', NULL, v_inv.id, NULL, 'Utløpt (cron)');

    SELECT legal_name INTO v_legal
    FROM public.legal_club_entities
    WHERE id = v_inv.legal_club_entity_id;

    -- Claimanten (når invitasjonen kom fra en søknad) får beskjed.
    INSERT INTO public.notifications
      (user_id, team_space_id, category, title, body, data,
       source_entity_type, source_entity_id, sent_at)
    SELECT c.claimant_user_id, NULL, 'system',
           'Invitasjonen utløp',
           COALESCE(v_inv.invited_name, 'Den inviterte') ||
             ' rakk ikke å svare på invitasjonen som betalingsansvarlig for ' ||
             COALESCE(v_legal, 'klubben') ||
             '. Ta kontakt på hello@heiaapp.no for en ny invitasjon.',
           jsonb_build_object('screen', 'support_setup'),
           'manager_invitation', v_inv.id, now()
    FROM public.club_claims c
    WHERE c.id = v_inv.claim_id;

    IF NOT entity_has_active_manager(v_inv.legal_club_entity_id) THEN
      PERFORM notify_payments_event('managerless', jsonb_build_object(
        'legal_club_entity_id', v_inv.legal_club_entity_id,
        'reason', 'invitasjon utløp uten svar'));
    END IF;
  END LOOP;

  -- 2) Påminnelse dag 7 — kun invitasjoner som faktisk er sendt.
  FOR v_inv IN
    SELECT i.id
    FROM public.manager_invitations i
    WHERE i.status = 'pending'
      AND i.sent_at IS NOT NULL
      AND i.reminded_at IS NULL
      AND i.created_at < now() - interval '7 days'
      AND i.expires_at > now()
  LOOP
    PERFORM notify_payments_event('reminder',
      jsonb_build_object('invitation_id', v_inv.id));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION expire_and_remind_manager_invitations()
  FROM PUBLIC, anon, authenticated;

-- Daglig kl. 08 UTC (09/10 norsk — påminnelser på dagtid).
SELECT cron.unschedule('heia-manager-invitations')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'heia-manager-invitations'
);

SELECT cron.schedule(
  'heia-manager-invitations',
  '0 8 * * *',
  $$SELECT public.expire_and_remind_manager_invitations()$$
);
