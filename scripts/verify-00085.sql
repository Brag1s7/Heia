-- Bevisfil for 00085 («Deaktiver støtte» kan fortsette — punkt 107).
--   node scripts/run-sql.mjs scripts/verify-00085.sql
--
-- A-testene leser katalogen (dører, search_path, filteret i kroppen).
-- B-testene gjør en EKTE deaktivering på et ekte lag med levende
-- avtaler og beviser at gjentatt kall KRYMPER: webhooken simuleres ved
-- å sette cancel_at på ett av de returnerte abonnementene, og kall to
-- skal returnere nøyaktig resten. HELE mutasjonsblokken rulles tilbake
-- av en sentinel-exception (00113-arbeidsmåten: transaksjon som rulles
-- tilbake, mål begge retninger inne i den). Advisory-låsen er
-- xact-scopet og slippes når forespørselens transaksjon ender.
--
-- «bestatt» skal være true på alle rader. B-radene viser
-- «HOPPET OVER …» i detalj hvis prod ikke har noe lag med levende
-- avtaler å bevise på (da er de null, ikke false).

CREATE TEMP TABLE IF NOT EXISTS bevis(
  rk int, test text, bestatt boolean, detalj text);

INSERT INTO bevis
SELECT 1, 'A1 funksjonen finnes og er SECURITY DEFINER',
       count(*) = 1 AND bool_and(p.prosecdef),
       count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'deactivate_team_support_data';

INSERT INTO bevis
SELECT 2, 'A2 search_path har pg_temp SIST',
       p.proconfig @> ARRAY['search_path=public, pg_temp'],
       array_to_string(p.proconfig, ' | ')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'deactivate_team_support_data';

INSERT INTO bevis
SELECT 3, 'A3 service-role-only: verken anon eller authenticated kan kjøre',
       NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE'),
       format('anon=%s auth=%s svc=%s',
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         has_function_privilege('service_role', p.oid, 'EXECUTE'))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'deactivate_team_support_data';

INSERT INTO bevis
SELECT 4, 'A4 kroppen filtrerer på cancel_at IS NULL (00085 er den som står)',
       prosrc LIKE '%cancel_at IS NULL%',
       CASE WHEN prosrc LIKE '%cancel_at IS NULL%'
            THEN 'filteret står' ELSE '00062-versjonen står fortsatt' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'deactivate_team_support_data';

-- ── B. Krymping, bevist på ekte data, rullet tilbake ───────────────
DO $$
DECLARE
  v_ts        uuid;
  v_actor     uuid;
  v_r1        jsonb;
  v_r2        jsonb;
  v_n1        int;
  v_n2        int;
  v_done_sub  text;
  v_b1        boolean; v_b1d text := 'HOPPET OVER: ingen lag med levende avtaler';
  v_b2        boolean; v_b2d text := 'HOPPET OVER: ingen lag med levende avtaler';
  v_b3        boolean; v_b3d text := 'HOPPET OVER: ingen lag med levende avtaler';
BEGIN
  BEGIN
    -- Fixture: et ekte lag med minst én levende avtale uten cancel_at,
    -- og lagets aktive betalingsansvarlige som aktør.
    SELECT ss.team_space_id, m.user_id
      INTO v_ts, v_actor
      FROM public.support_subscriptions ss
      JOIN public.team_spaces ts ON ts.id = ss.team_space_id
      JOIN public.teams t        ON t.id = ts.team_id
      JOIN public.club_legal_entity_links l
        ON l.club_id = t.club_id AND l.status = 'active'
      JOIN public.club_payment_managers m
        ON m.legal_club_entity_id = l.legal_club_entity_id
       AND m.status = 'active'
     WHERE ss.status IN ('active','past_due')
       AND ss.provider_subscription_id IS NOT NULL
       AND ss.cancel_at IS NULL
     LIMIT 1;

    IF v_ts IS NOT NULL THEN
      -- Kall 1: skal returnere alle gjenstående (uten cancel_at) og
      -- ALDRI et abonnement som alt bærer cancel_at.
      v_r1 := public.deactivate_team_support_data(v_ts, v_actor, 'verify-00085');
      v_n1 := (v_r1->>'count')::int;
      v_b1 := v_n1 >= 1 AND NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements_text(v_r1->'subscription_ids') AS x(id)
          JOIN public.support_subscriptions ss2
            ON ss2.provider_subscription_id = x.id
         WHERE ss2.team_space_id = v_ts AND ss2.cancel_at IS NOT NULL);
      v_b1d := format('%s gjenstående, ingen med cancel_at', v_n1);

      -- Simuler webhookens bokføring for ETT av dem …
      v_done_sub := v_r1->'subscription_ids'->>0;
      UPDATE public.support_subscriptions
         SET cancel_at = now()
       WHERE team_space_id = v_ts
         AND provider_subscription_id = v_done_sub;

      -- … og kall 2 skal returnere nøyaktig resten.
      v_r2 := public.deactivate_team_support_data(v_ts, v_actor, 'verify-00085 pass 2');
      v_n2 := (v_r2->>'count')::int;
      v_b2 := v_n2 = v_n1 - 1 AND NOT (v_r2->'subscription_ids') ? v_done_sub;
      v_b2d := format('%s → %s, ute av lista=%s (%s)', v_n1, v_n2,
        NOT (v_r2->'subscription_ids') ? v_done_sub, v_done_sub);

      -- Loggradene teller det HVERT kall omfattet. Begge radene fikk
      -- samme created_at (now() er frosset i transaksjonen), så de to
      -- nyeste sammenlignes som mengde {n1, n2} — eldre rader har
      -- reelt eldre created_at og faller utenfor.
      SELECT (array_agg(x.affected_subscriptions ORDER BY x.affected_subscriptions)
              = ARRAY[least(v_n1, v_n2), greatest(v_n1, v_n2)])
        INTO v_b3
        FROM (SELECT a.affected_subscriptions
                FROM public.team_support_actions a
               WHERE a.team_space_id = v_ts AND a.action = 'deactivate'
               ORDER BY a.created_at DESC LIMIT 2) x;
      v_b3d := format('de to nyeste radene teller {%s, %s}', v_n1, v_n2);
    END IF;

    RAISE EXCEPTION 'HEIA-ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'HEIA-ROLLBACK' THEN
      v_b1 := false; v_b1d := 'FEIL: ' || SQLERRM;
    END IF;
  END;

  INSERT INTO pg_temp.bevis VALUES
    (5, 'B1 kall 1 tar kun gjenstående (aldri cancel_at-satte)', v_b1, v_b1d),
    (6, 'B2 kall 2 krymper: bekreftet abonnement er ute av lista', v_b2, v_b2d),
    (7, 'B3 loggraden teller det kallet omfattet', v_b3, v_b3d);
END $$;

SELECT test, bestatt, detalj FROM pg_temp.bevis ORDER BY rk;
