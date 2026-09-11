import React, {useCallback, useEffect, useState} from 'react';
import {AuthPanel, signOut, useSession} from '../lib/auth';
import {declineInvitation, formatDate, peekInvitation, redeemInvitation, type InvitationPreview, type RedeemOutcome} from '../lib/api';
import {Button, Card, Field, Notice, Row, Spinner} from './ui';

const CONTACT = 'hello@heiaapp.no';

/**
 * /invitasjon#<token> — «Bli betalingsansvarlig» (fase B-1, AUTORITET §II.5).
 *
 * Tokenet leses fra fragmentet én gang, fjernes fra adressefeltet med
 * replaceState og lever kun i React-state. Det sendes bare i RPC-kall til
 * Supabase — aldri i URL, referrer eller logger. Siden laster ingen
 * tredjepartsskript. Full omlasting mister tokenet med vilje: da ber vi
 * brukeren åpne lenken fra e-posten på nytt.
 */
type Phase =
  | {kind: 'no-token'}
  | {kind: 'preview'; data: InvitationPreview}
  | {kind: 'done'; outcome: RedeemOutcome | 'declined'; legalName: string | null};

function readTokenFromHash(): string | null {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return null;
  const m = raw.match(/^(?:inv=)?([A-Za-z0-9_-]{16,})$/);
  return m ? m[1] : null;
}

export default function InvitationApp() {
  const {session, loading} = useSession();
  const [token] = useState<string | null>(() => {
    const t = readTokenFromHash();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    return t;
  });
  const [phase, setPhase] = useState<Phase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [showDecline, setShowDecline] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setPhase({kind: 'no-token'});
      return;
    }
    if (!session) return;
    setError(null);
    try {
      const data = await peekInvitation(token);
      setPhase({kind: 'preview', data});
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, session]);

  useEffect(() => {
    if (loading) return;
    load();
  }, [loading, session, load]);

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await redeemInvitation(token);
      setPhase({kind: 'done', outcome: r.outcome, legalName: r.legalName});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await declineInvitation(token, declineNote || undefined);
      setPhase({kind: 'done', outcome: r === 'declined' ? 'declined' : 'invalid', legalName: null});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  if (!token || phase?.kind === 'no-token') {
    return (
      <Card title="Lenken mangler kode">
        <p className="muted">Invitasjonen åpnes fra lenken i e-posten «Bli betalingsansvarlig». Har du lastet siden på nytt, må du åpne lenken igjen — koden i lenken lagres aldri i nettleseren.</p>
        <p className="muted mt-1">Finner du ikke e-posten, ta kontakt på <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </Card>
    );
  }

  if (!session) {
    return (
      <div className="app-grid app-grid-2">
        <Card>
          <AuthPanel reason="Logg inn — eller opprett konto — for å se invitasjonen. Bruk e-postadressen invitasjonen ble sendt til, ellers må Heia bekrefte identiteten din manuelt." />
        </Card>
        <Card title="Om rollen">
          <p className="muted">Som betalingsansvarlig forvalter du klubbens støtteordning i Heia: du godkjenner hvilke lag som kan ta imot støtte, setter opp utbetaling via Stripe, og kan invitere flere ansvarlige. Rollen blir aktiv først når du aksepterer.</p>
        </Card>
      </div>
    );
  }

  if (error && !phase) {
    return (
      <Card title="Kunne ikke hente invitasjonen">
        <Notice tone="error">{error}</Notice>
        <Button type="button" onClick={load}>Prøv igjen</Button>
      </Card>
    );
  }

  if (!phase) return <Spinner label="Henter invitasjonen …" />;

  if (phase.kind === 'done') {
    const o = phase.outcome;
    return (
      <Card title={
        o === 'accepted' ? 'Du er betalingsansvarlig' :
        o === 'awaiting_review' ? 'Akseptert — Heia bekrefter identiteten' :
        o === 'declined' ? 'Du takket nei' :
        o === 'expired' ? 'Invitasjonen er utløpt' :
        o === 'suspended' ? 'Kontoen er satt på pause' : 'Invitasjonen kan ikke brukes'}>
        {o === 'accepted' && (
          <>
            <Notice tone="success">Rollen for <b>{phase.legalName}</b> er aktiv. Neste steg er Klubbetalinger: koble til utbetaling hos Stripe og godkjenn lagene.</Notice>
            <Button type="button" primary onClick={() => location.assign('/klubb/')}>Gå til Klubbetalinger</Button>
          </>
        )}
        {o === 'awaiting_review' && (
          <Notice tone="warn">E-postadressen på kontoen din er ikke den invitasjonen ble sendt til. Aksepten er registrert, men rollen for <b>{phase.legalName}</b> blir aktiv først når Heia har bekreftet at det er deg. Du får e-post når det er gjort — normalt innen én virkedag. Spørsmål: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</Notice>
        )}
        {o === 'declined' && <p className="muted">Den som inviterte deg får beskjed. Ombestemmer du deg, kan de sende en ny invitasjon.</p>}
        {o === 'expired' && <p className="muted">Invitasjoner varer i 14 dager. Be den som inviterte deg — eller Heia på <a href={`mailto:${CONTACT}`}>{CONTACT}</a> — om en ny.</p>}
        {o === 'suspended' && <p className="muted">Kontoen din er satt på pause som betalingsansvarlig. Ta kontakt på <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>}
        {o === 'invalid' && <p className="muted">Lenken er brukt, trukket tilbake eller ugyldig. Be om en ny invitasjon, eller ta kontakt på <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>}
      </Card>
    );
  }

  const d = phase.data;
  if (!d.found) {
    return (
      <Card title="Invitasjonen finnes ikke">
        <p className="muted">Lenken er ugyldig, brukt opp eller erstattet av en nyere (påminnelsen dag 7 sender en ny lenke som erstatter den forrige). Be om en ny invitasjon, eller ta kontakt på <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </Card>
    );
  }
  const closed = d.status !== 'pending';
  const expired = d.expired;

  return (
    <div className="app-grid app-grid-2">
      <Card title="Bli betalingsansvarlig">
        <Row label="Klubb (juridisk)">{d.legalName}<br /><span className="muted small">org.nr. {d.orgNumber}</span></Row>
        <Row label="Invitert">{d.invitedName}<br /><span className="muted small">{d.invitedEmailMasked}</span></Row>
        <Row label="Din konto">{d.accountEmail}{d.emailMatches ? <span className="ui-badge ui-badge-good" style={{marginLeft: 8}}>Matcher</span> : <span className="ui-badge ui-badge-warn" style={{marginLeft: 8}}>Annen adresse</span>}</Row>
        <Row label="Gyldig til">{formatDate(d.expiresAt)}</Row>

        {closed && <Notice tone="info">Denne invitasjonen er allerede {d.status === 'accepted' ? 'akseptert' : d.status === 'awaiting_review' ? 'akseptert og venter på Heias bekreftelse' : d.status === 'declined' ? 'avslått' : d.status === 'revoked' ? 'trukket tilbake' : 'utløpt'}.</Notice>}
        {!closed && expired && <Notice tone="warn">Invitasjonen er utløpt. Be om en ny.</Notice>}
        {!closed && !expired && !d.emailMatches && (
          <Notice tone="warn">
            Du er logget inn som <b>{d.accountEmail}</b>, men invitasjonen gikk til <b>{d.invitedEmailMasked}</b>. Du kan akseptere likevel — da må Heia bekrefte identiteten din manuelt før rollen blir aktiv. Er du eieren av den inviterte adressen, er det raskere å <button type="button" className="ui-btn ui-btn-sm" onClick={() => signOut()}>bytte konto</button>.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        {!closed && !expired && (
          <>
            <div className="ui-actions">
              <Button type="button" primary busy={busy} onClick={accept}>Aksepter og bli betalingsansvarlig</Button>
              <Button type="button" onClick={() => setShowDecline((s) => !s)} disabled={busy}>Takk nei</Button>
            </div>
            {showDecline && (
              <div className="mt-2">
                <Field label="Vil du si hvorfor? (valgfritt)" value={declineNote} onChange={setDeclineNote} textarea />
                <Button type="button" danger busy={busy} onClick={decline}>Bekreft at du takker nei</Button>
              </div>
            )}
          </>
        )}
      </Card>
      <Card title="Hva rollen innebærer">
        <ul style={{paddingLeft: 22, color: 'var(--ink-2)', display: 'grid', gap: 8}}>
          <li>Du godkjenner hvilke lag i klubben som kan ta imot støtte fra familiene.</li>
          <li>Du setter opp utbetaling for klubben hos Stripe (kort identitetskontroll, klubbens konto).</li>
          <li>Du ser beløp per lag og historikk — aldri hvem som gir.</li>
          <li>Du kan invitere flere betalingsansvarlige, og Heia kan suspendere rollen ved behov.</li>
        </ul>
        <p className="muted small mt-2">Alt logges. Rollen er knyttet til klubben som juridisk enhet, ikke til enkeltlag.</p>
      </Card>
    </div>
  );
}
