-- ============================================================
-- 00085 — «Deaktiver støtte» tåler avbrudd og kan FORTSETTE
-- (punkt 107 i docs/GJENSTÅR.md, skive 2).
--
-- FEILEN SOM RETTES. `deactivate_team_support_data` returnerte ALLE
-- levende abonnementer (status active/past_due) hver eneste gang —
-- også de som allerede var satt til kansellering. Edge-funksjonen
-- (club-support-deactivate) går serielt gjennom lista mot Stripe, så
-- et nytt forsøk gjorde ALLTID hele jobben om igjen. For et lag som
-- ikke rekker gjennom lista innenfor funksjonens veggklokke betyr
-- det: «Et lag som ikke rekker gjennom på ett forsøk, rekker aldri
-- gjennom» (punktets egne ord). Skjermkommentaren i
-- ClubPaymentsScreen («den tar kun de som mangler») var en LØGN før
-- denne migrasjonen — nå blir den sann.
--
-- FIKSEN ER ÉN LINJE i utvalget: `AND cancel_at IS NULL`. Sannheten
-- om «satt til kansellering» bor i `cancel_at`, som SKRIVES AV
-- WEBHOOKEN (fase 0-funnet: boolean-en forble false, timestampen er
-- fasit). Dermed:
--   · Fremdriften bor der sannheten bor — i Stripe + webhook-bokført
--     rad. Ingen ny tilstandstabell, ingen ny kolonne.
--   · Dør Edge-funksjonen midt i lista (veggklokke, nettglipp), er
--     de POST-ede abonnementene alt på vei inn via webhooken — neste
--     kall får KUN resten. Hvert trykk krymper arbeidsmengden
--     monotont, og et vilkårlig stort lag konvergerer.
--   · Gjentatt kall når alt er bekreftet returnerer tom liste —
--     idempotent, som før.
--
-- SAMSPILLET MED KARENSTIDEN (00065). Flatens «unresolved_cancellations»
-- teller levende rader UTEN cancel_at, men først 5 minutter etter
-- siste deaktiveringshandling (webhooken er asynkron). Hvert
-- fortsettelsestrykk logger en ny handling og nullstiller dermed
-- vinduet — riktig: etter et trykk skal webhookene få de samme 5
-- minuttene før flaten roper.
--
-- LOGGRADEN. `affected_subscriptions` teller nå det KALLET faktisk
-- omfattet (resten), ikke historisk totalsum — et fortsettelsestrykk
-- logger altså 3 når 3 gjensto. Førstegangstrykket er uendret (alle).
--
-- DØRENE (00084-regelen: en funksjon fødes kallbar av PUBLIC, og
-- CREATE OR REPLACE beholder eksisterende ACL — men denne fila skal
-- stå på egne ben ved en db reset). MÅLT I PROD FØR PUSH
-- (verify-00085 A3, 2026-09-12): anon=f, auth=f, svc=t — funksjonen
-- er allerede service-role-only (den kalles KUN fra Edge-funksjonens
-- admin-klient; rollevakten inne i kroppen er porten for aktøren).
-- Dørene under GJENTAR den målte tilstanden — de åpner ingenting.
--
-- search_path pinnes med pg_temp EKSPLISITT SIST (00077/00084-
-- regelen) — kroppen bruker allerede public.-prefiks overalt.
--
-- TILBAKEFØRING: kjør 00062 §19-versjonen på nytt (uten
-- cancel_at-filteret). Ingen datarader røres av denne migrasjonen.
-- ============================================================

CREATE OR REPLACE FUNCTION deactivate_team_support_data(
  p_team_space_id uuid,
  p_actor_user_id uuid,
  p_note          text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_club_id   uuid;
  v_entity_id uuid;
  v_subs      text[];
BEGIN
  SELECT t.club_id INTO v_club_id
  FROM public.team_spaces ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_space_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Fant ikke laget.';
  END IF;

  SELECT l.legal_club_entity_id INTO v_entity_id
  FROM public.club_legal_entity_links l
  WHERE l.club_id = v_club_id AND l.status = 'active';

  IF v_entity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.club_payment_managers
    WHERE legal_club_entity_id = v_entity_id
      AND user_id = p_actor_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Bare klubbens betalingsansvarlige kan deaktivere støtte.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('support_offering'), hashtext(p_team_space_id::text));

  -- Idempotent på gjenkjøring: alt er allerede arkivert → 0 rader.
  UPDATE public.support_offerings
  SET status = 'archived'
  WHERE team_space_id = p_team_space_id AND status = 'active';

  -- KUN de som gjenstår (punkt 107): cancel_at settes av webhooken når
  -- Stripe har bekreftet kanselleringen — de radene er FERDIGE og skal
  -- aldri i Stripe-løkka igjen. Et abonnement som ble POST-et i et
  -- avbrutt forsøk, men hvis webhook ennå ikke har landet, kommer med
  -- én gang til — det er trygt (samme felt, samme verdi) og nettopp
  -- det som gjør at ingen kan falle mellom to stoler.
  SELECT COALESCE(array_agg(provider_subscription_id), '{}')
  INTO v_subs
  FROM public.support_subscriptions
  WHERE team_space_id = p_team_space_id
    AND status IN ('active','past_due')
    AND provider_subscription_id IS NOT NULL
    AND cancel_at IS NULL;

  INSERT INTO public.team_support_actions
    (club_id, team_space_id, action, actor_user_id, note,
     affected_subscriptions)
  VALUES (v_club_id, p_team_space_id, 'deactivate', p_actor_user_id,
          NULLIF(trim(COALESCE(p_note, '')), ''),
          COALESCE(array_length(v_subs, 1), 0));

  RETURN jsonb_build_object(
    'subscription_ids', to_jsonb(v_subs),
    'count', COALESCE(array_length(v_subs, 1), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dørene: service-role-only, nøyaktig som målt i prod før push.
REVOKE ALL ON FUNCTION public.deactivate_team_support_data(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.deactivate_team_support_data(uuid, uuid, text)
  SET search_path = public, pg_temp;
