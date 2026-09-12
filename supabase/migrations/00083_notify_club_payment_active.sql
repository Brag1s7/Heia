-- ============================================================
-- 00083 — Varselet som aldri kom: klubben er klar for støtte.
--
-- SupportSetup-skjermen lover treneren «Du får varsel her når klubben
-- er klar for støtte» (SupportSetupScreen.tsx:543) mens klubbens
-- Stripe-konto står i onboarding. Ingen kode oppfylte den lovnaden:
-- `stripe-webhook` → onAccountUpdated skriver bare status på
-- `club_payment_accounts` og oppretter ingen notification. Treneren
-- ventet på noe som aldri skjedde.
--
-- Hvorfor trigger og ikke kode i Edge Function: statusen settes fra
-- webhooken i dag, men også av ops-verktøy og backfill. En trigger
-- kan ikke omgås, og fanger overgangen uansett hvem som skriver.
--
-- Kontrakt:
--   * Fyrer KUN på overgangen til 'active' (OLD.status IS DISTINCT
--     FROM 'active'). Stripe sender mange account.updated for samme
--     konto — bare den første som gjør kontoen aktiv gir varsel.
--   * Mottakere: aktive trenere i lagene under klubbene som er AKTIVT
--     lenket til den juridiske enheten. Ett varsel per person (ikke
--     per lag), med `screen: 'support_setup'` + laget deres, som er
--     nøyaktig skjermen lovnaden står på.
--   * Push følger gratis: `trg_push_on_notifications` (00049) er en
--     statement-trigger på INSERT i notifications.
--   * Feil i varselet skal ALDRI rulle tilbake betalingsstatusen —
--     derfor EXCEPTION WHEN OTHERS med RAISE WARNING.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_club_payment_active()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    BEGIN
      INSERT INTO public.notifications
        (user_id, team_space_id, category, title, body, data,
         source_entity_type, source_entity_id, sent_at)
      SELECT DISTINCT ON (m.user_id)
        m.user_id,
        ts.id,
        'system',
        'Klubben er klar for støtte 💚',
        'Klubben har fullført registreringen. Er laget godkjent, kan '
          || 'medlemmene nå støtte det i Heia.',
        jsonb_build_object(
          'screen', 'support_setup',
          'team_space_id', ts.id
        ),
        'club_payment_account', NEW.id, now()
      FROM public.club_legal_entity_links l
      JOIN public.teams t
        ON t.club_id = l.club_id
      JOIN public.team_spaces ts
        ON ts.team_id = t.id
      JOIN public.memberships m
        ON m.team_space_id = ts.id
       AND m.role = 'trener'
       AND m.status = 'active'
      WHERE l.legal_club_entity_id = NEW.legal_club_entity_id
        AND l.status = 'active'
      ORDER BY m.user_id, ts.created_at;
    EXCEPTION WHEN OTHERS THEN
      -- Betalingsstatusen er sannheten om pengene. Et varsel som feiler
      -- skal ikke kunne hindre at kontoen blir aktiv.
      RAISE WARNING 'notify_on_club_payment_active: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger-funksjoner trenger ingen EXECUTE (Postgres kaller dem som
-- eierens trigger), men PUBLIC arver uansett — så vi stenger døren.
REVOKE ALL ON FUNCTION public.notify_on_club_payment_active()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_club_payment_active
  ON public.club_payment_accounts;

CREATE TRIGGER trg_notify_club_payment_active
  AFTER UPDATE OF status ON public.club_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_club_payment_active();

COMMENT ON FUNCTION public.notify_on_club_payment_active() IS
  'Varsler trenerne i klubbens lag når betalingskontoen blir aktiv (00083) '
  '— oppfyller lovnaden i SupportSetup «Du får varsel her når klubben er klar».';
