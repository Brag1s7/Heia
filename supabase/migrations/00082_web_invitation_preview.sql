-- ============================================================
-- 00082 — Web-invitasjonslanding (fase B-1): lesende forhåndsvisning.
--
-- Landingssiden skal vise juridisk navn, invitert navn og innlogget
-- konto FØR eksplisitt aksept (AUTORITET §II.5). `redeem_manager_
-- invitation` er skrivende og kan aldri brukes til å «titte» — derfor
-- denne rent lesende RPC-en. Ingen sideeffekter, ingen logging (tokenet
-- er 256-bit og hashes; forsøk logges ved innløsning som før).
--
-- Kontrakt: {found:false} for ukjent/tomt token; ellers status,
-- expired (pending + utløpt), juridisk enhet, invitert navn, maskert
-- invitert e-post, kontoens e-post + verifisert-flagg og om e-posten
-- matcher (B1-avvikskontrollen forhåndsvist — avgjørelsen tas i redeem).
-- ============================================================

CREATE OR REPLACE FUNCTION public.peek_manager_invitation(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_verified timestamptz;
  v_hash     text;
  v_inv      record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Logg inn først.';
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_verified
  FROM auth.users u WHERE u.id = v_uid;

  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT i.status, i.expires_at, i.invited_name, i.invited_email, i.source,
         e.legal_name, e.org_number
    INTO v_inv
  FROM public.manager_invitations i
  JOIN public.legal_club_entities e ON e.id = i.legal_club_entity_id
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_inv.status,
    'expired', (v_inv.status = 'pending' AND v_inv.expires_at < now()),
    'expires_at', v_inv.expires_at,
    'legal_name', v_inv.legal_name,
    'org_number', v_inv.org_number,
    'invited_name', v_inv.invited_name,
    'invited_email_masked',
      regexp_replace(v_inv.invited_email, '^(.).*(@.*)$', '\1***\2'),
    'source', v_inv.source,
    'account_email', v_email,
    'email_verified', v_verified IS NOT NULL,
    'email_matches', lower(trim(v_email)) = lower(trim(v_inv.invited_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.peek_manager_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peek_manager_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.peek_manager_invitation(text) IS
  'Web-landing B-1: lesende forhåndsvisning av manager-invitasjon (00082).';
