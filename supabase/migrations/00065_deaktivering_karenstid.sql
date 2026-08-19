-- ============================================================
-- 00065_deaktivering_karenstid
--
-- FUNN I FASE A3-DOGFOODEN (2026-08-19, telefon, Stripe sandbox):
-- rett etter en HELT VELLYKKET deaktivering viste Klubbetalinger det
-- gule varselet «Deaktiveringen ble ikke fullført — 1 støtteavtale er
-- fortsatt løpende og trekkes videre», med knappen «Fullfør
-- deaktiveringen». Ingenting var galt: DB-en arkiverer først, Edge-
-- funksjonen ber Stripe om cancel_at_period_end etterpå, og `cancel_at`
-- bokføres av WEBHOOKEN noen sekunder senere. I det vinduet er
-- betingelsen «levende abonnement uten cancel_at på et deaktivert lag»
-- sann for helt normal drift.
--
-- Boksen ble stående til brukeren dro ned for å oppdatere. En
-- klubbleder som leser at foreldre «trekkes videre» trykker knappen —
-- en unødvendig, men heldigvis idempotent, ny runde mot Stripe.
--
-- FIKSEN: telles kun når deaktiveringen er eldre enn 5 minutter. Det
-- dekker webhook-forsinkelse og Stripes egne retries. En ekte delfeil
-- står fortsatt igjen etterpå, og knappen virker som før.
--
-- Ren erstatning av get_club_payments_overview() fra 00062 — ingen
-- signaturendring, ingen nye grants (grants følger funksjonsnavnet og
-- består gjennom CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION get_club_payments_overview()
RETURNS jsonb AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_payment_manager_anywhere() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(club_obj ORDER BY legal_name), '[]'::jsonb)
    FROM (
      SELECT e.legal_name, jsonb_build_object(
        'entity', jsonb_build_object(
          'id', e.id, 'legal_name', e.legal_name, 'org_number', e.org_number),
        -- Bakoverkompatibelt: kanonisk klubbrad (eldste aktive link).
        'club', (
          SELECT jsonb_build_object('id', c.id, 'name', c.name)
          FROM public.club_legal_entity_links l
          JOIN public.clubs c ON c.id = l.club_id
          WHERE l.legal_club_entity_id = e.id AND l.status = 'active'
          ORDER BY l.created_at LIMIT 1),
        'clubs', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name) ORDER BY l.created_at), '[]'::jsonb)
          FROM public.club_legal_entity_links l
          JOIN public.clubs c ON c.id = l.club_id
          WHERE l.legal_club_entity_id = e.id AND l.status = 'active'),
        'account', (
          SELECT jsonb_build_object(
            'status', cpa.status, 'charges_enabled', cpa.charges_enabled)
          FROM public.club_payment_accounts cpa
          WHERE cpa.legal_club_entity_id = e.id AND cpa.provider = 'stripe'),
        'requests', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', a.id,
            'team_space_id', a.team_space_id,
            'team_name', ts.display_name,
            'age_group', t.age_group,
            'gender', t.gender,
            'member_count', (
              SELECT count(*) FROM public.memberships ms
              WHERE ms.team_space_id = a.team_space_id
                AND ms.status = 'active'),
            'requested_by', p.display_name,
            'requested_at', a.created_at
          ) ORDER BY a.created_at), '[]'::jsonb)
          FROM public.team_support_approvals a
          JOIN public.team_spaces ts ON ts.id = a.team_space_id
          JOIN public.teams t ON t.id = ts.team_id
          JOIN public.profiles p ON p.id = a.requested_by
          JOIN public.club_legal_entity_links l2
            ON l2.club_id = a.club_id AND l2.status = 'active'
          WHERE l2.legal_club_entity_id = e.id AND a.status = 'pending'
        ),
        'teams', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'team_space_id', ts.id,
            'team_name', ts.display_name,
            'age_group', t.age_group,
            'state', CASE
              WHEN EXISTS (
                SELECT 1 FROM public.support_offerings o
                WHERE o.team_space_id = ts.id AND o.status = 'active')
                THEN 'collecting'
              WHEN EXISTS (
                SELECT 1 FROM public.team_support_approvals a2
                WHERE a2.team_space_id = ts.id AND a2.status = 'pending')
                THEN 'pending'
              ELSE COALESCE((
                SELECT CASE la.action
                  WHEN 'pause' THEN 'paused'
                  WHEN 'deactivate' THEN 'deactivated'
                  ELSE 'none' END
                FROM public.team_support_actions la
                WHERE la.team_space_id = ts.id
                  AND la.action IN ('pause','deactivate','approve')
                ORDER BY la.created_at DESC LIMIT 1), 'none')
            END,
            'live_subscriptions', team_live_subscription_count(ts.id),
            -- Delfeil-fiksen: levende abonnementer UTEN cancel_at på
            -- et deaktivert lag = Stripe-kallet nådde ikke frem →
            -- «Fullfør deaktiveringen»-knappen i flaten.
            'unresolved_cancellations', (
              SELECT CASE WHEN (
                -- KARENSTID (00065): Stripe-kallet er asynkront, og cancel_at
                -- skrives av WEBHOOKEN et par sekunder senere. Uten en frist
                -- her ropte flaten «Deaktiveringen ble ikke fullført» i det
                -- normale vinduet rett etter et VELLYKKET kall — dogfood
                -- 2026-08-19: boksen sto til brukeren dro ned og oppdaterte.
                -- Et varsel som er sant i noen sekunder hver eneste gang er
                -- ikke et varsel, det er støy — og her er støyen «foreldrene
                -- trekkes fortsatt penger», det verst tenkelige å rope ulv om.
                -- 5 minutter dekker webhook-forsinkelse OG Stripes retry.
                SELECT la2.action FROM public.team_support_actions la2
                WHERE la2.team_space_id = ts.id
                  AND la2.action IN ('pause','deactivate','approve')
                  AND la2.created_at < now() - interval '5 minutes'
                ORDER BY la2.created_at DESC LIMIT 1) = 'deactivate'
              THEN (
                SELECT count(*)::int FROM public.support_subscriptions ss
                WHERE ss.team_space_id = ts.id
                  AND ss.status IN ('active','past_due')
                  AND ss.cancel_at IS NULL)
              ELSE 0 END)
          ) ORDER BY ts.display_name), '[]'::jsonb)
          FROM public.teams t
          JOIN public.team_spaces ts ON ts.team_id = t.id
          JOIN public.club_legal_entity_links l3
            ON l3.club_id = t.club_id AND l3.status = 'active'
          WHERE l3.legal_club_entity_id = e.id
        ),
        'log', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'action', x.action,
            'team_name', x.team_name,
            'actor', x.actor,
            'note', x.note,
            'affected_subscriptions', x.affected_subscriptions,
            'created_at', x.created_at
          ) ORDER BY x.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT act.action, ts2.display_name AS team_name,
                   p2.display_name AS actor, act.note,
                   act.affected_subscriptions, act.created_at
            FROM public.team_support_actions act
            JOIN public.club_legal_entity_links l4
              ON l4.club_id = act.club_id AND l4.status = 'active'
            JOIN public.team_spaces ts2 ON ts2.id = act.team_space_id
            JOIN public.profiles p2 ON p2.id = act.actor_user_id
            WHERE l4.legal_club_entity_id = e.id
            ORDER BY act.created_at DESC
            LIMIT 20
          ) x
        ),
        'managers', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'name', p5.display_name,
            'status', m.status,
            'source', m.source,
            'is_me', m.user_id = v_uid) ORDER BY m.created_at), '[]'::jsonb)
          FROM public.club_payment_managers m
          JOIN public.profiles p5 ON p5.id = m.user_id
          WHERE m.legal_club_entity_id = e.id),
        'invitations', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'invited_name', i.invited_name,
            'status', i.status,
            'source', i.source,
            'sent_at', i.sent_at,
            'expires_at', i.expires_at,
            'created_at', i.created_at) ORDER BY i.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT * FROM public.manager_invitations mi
            WHERE mi.legal_club_entity_id = e.id
              AND (mi.status IN ('pending','awaiting_review')
                   OR mi.created_at > now() - interval '30 days')
            ORDER BY mi.created_at DESC LIMIT 10
          ) i)
      ) AS club_obj
      FROM public.legal_club_entities e
      JOIN public.club_payment_managers me
        ON me.legal_club_entity_id = e.id
       AND me.user_id = v_uid AND me.status = 'active'
    ) clubs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
