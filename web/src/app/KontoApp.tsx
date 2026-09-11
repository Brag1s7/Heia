import React, {useEffect, useState} from 'react';
import {AuthPanel, signOut, useSession} from '../lib/auth';
import {isOpsAdmin, isPaymentManager} from '../lib/api';
import {Button, Card, Spinner} from './ui';

/**
 * /konto — innlogging og «hvor hører jeg hjemme på web». Web er for
 * klubbens betalingsansvarlige og Heia internt; feeden bor i appen, og
 * det sier flaten tydelig så vanlige brukere ikke leter etter laget her.
 */
export default function KontoApp() {
  const {session, loading} = useSession();
  const [roles, setRoles] = useState<{manager: boolean; ops: boolean} | null>(null);
  const next = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('next') : null;

  useEffect(() => {
    if (!session) {
      setRoles(null);
      return;
    }
    let alive = true;
    Promise.all([isPaymentManager(), isOpsAdmin()]).then(([manager, ops]) => {
      if (!alive) return;
      setRoles({manager, ops});
      // Kom brukeren hit for å nå en bestemt side, send henne dit når
      // rollen bekrefter at siden finnes for henne.
      if (next && /^\/(klubb|ops|invitasjon)\/?/.test(next)) {
        if ((next.startsWith('/klubb') && manager) || (next.startsWith('/ops') && ops)) {
          location.replace(next);
        }
      }
    });
    return () => {
      alive = false;
    };
  }, [session, next]);

  if (loading) return <Spinner />;

  if (!session) {
    return (
      <div className="app-grid app-grid-2">
        <Card>
          <AuthPanel reason="Logg inn med samme konto som i Heia-appen." />
        </Card>
        <Card title="Hva du finner på web">
          <p className="muted">Nettsiden er arbeidsflaten for de som forvalter støtte til laget. Selve laglivet — feeden, kampene og bildene — bor i appen.</p>
          <ul className="mt-1" style={{paddingLeft: 22, color: 'var(--ink-2)', display: 'grid', gap: 6}}>
            <li><b>Klubbetalinger</b> — for klubbens betalingsansvarlige: lagforespørsler, Stripe-oppsett, roller og historikk.</li>
            <li><b>Invitasjoner</b> — «Bli betalingsansvarlig» aksepteres her, med lenken fra e-posten.</li>
            <li><b>Heia Ops</b> — Heias egen arbeidsflate for søknader og roller.</li>
          </ul>
        </Card>
      </div>
    );
  }

  const name = (session.user.user_metadata?.display_name as string | undefined) ?? session.user.email;

  return (
    <div className="app-grid app-grid-2">
      <Card title="Kontoen din" aside={<Button type="button" onClick={() => signOut()}>Logg ut</Button>}>
        <p><b>{name}</b><br /><span className="muted">{session.user.email}</span></p>
        <p className="muted small mt-1">Navn, passord og lag styrer du i appen under Profil.</p>
      </Card>
      <Card title="Dine flater på web">
        {!roles ? (
          <Spinner label="Sjekker roller …" />
        ) : (
          <ul className="ui-list">
            {roles.manager && (
              <li><a className="ui-item link" href="/klubb/"><span><b>Klubbetalinger</b><small>Lagforespørsler, Stripe-oppsett, betalingsansvarlige og historikk</small></span><span>→</span></a></li>
            )}
            {roles.ops && (
              <li><a className="ui-item link" href="/ops/"><span><b>Heia Ops</b><small>Søknader, klubber og roller</small></span><span>→</span></a></li>
            )}
            {!roles.manager && !roles.ops && (
              <li className="ui-empty">Kontoen din har ingen roller på web ennå. Laget ditt finner du i Heia-appen. Er du invitert som betalingsansvarlig, åpner du lenken fra e-posten.</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
