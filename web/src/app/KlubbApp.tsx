import React, {useCallback, useEffect, useState} from 'react';
import {AuthPanel, signOut, useSession} from '../lib/auth';
import {
  approveTeamSupport,
  deactivateTeamSupport,
  formatDate,
  formatDateTime,
  getClubPaymentsOverview,
  issueManagerInvitation,
  pauseTeamSupport,
  rejectTeamSupport,
  startStripeOnboarding,
  type ClubPaymentsClub,
  type ClubPaymentTeam,
} from '../lib/api';
import {Badge, Button, Card, Empty, Notice, PromptDialog, Spinner, useToast, type PromptSpec} from './ui';

const STATE: Record<ClubPaymentTeam['state'], {label: string; tone: 'good' | 'warn' | 'neutral' | 'bad'}> = {
  collecting: {label: 'Samler inn', tone: 'good'},
  pending: {label: 'Til godkjenning', tone: 'warn'},
  paused: {label: 'Pauset', tone: 'neutral'},
  deactivated: {label: 'Deaktivert', tone: 'bad'},
  none: {label: 'Ikke aktiv', tone: 'neutral'},
};

const ACCOUNT: Record<string, {label: string; tone: 'good' | 'warn' | 'neutral' | 'bad' | 'info'; help: string}> = {
  pending_onboarding: {label: 'Ikke satt opp', tone: 'warn', help: 'Utbetaling er ikke satt opp hos Stripe ennå. Start oppsettet for å kunne ta imot støtte.'},
  onboarding_started: {label: 'Påbegynt', tone: 'info', help: 'Stripe-oppsettet er påbegynt, men ikke fullført. Hent en fersk lenke og fullfør.'},
  restricted: {label: 'Trenger handling', tone: 'warn', help: 'Stripe trenger mer informasjon før utbetaling kan skje. Åpne oppsettet og fullfør det Stripe ber om.'},
  active: {label: 'Utbetaling aktiv', tone: 'good', help: 'Klubben kan ta imot støtte. Utbetalinger går til kontoen registrert hos Stripe.'},
  disabled: {label: 'Deaktivert', tone: 'bad', help: 'Stripe har deaktivert kontoen. Ta kontakt med Heia.'},
};

const INVITATION_LABEL: Record<string, string> = {
  pending: 'Invitert — venter på svar',
  awaiting_review: 'Akseptert — Heia bekrefter identiteten',
  accepted: 'Akseptert',
  declined: 'Takket nei',
  revoked: 'Trukket tilbake',
  expired: 'Utløpt',
};

const ACTION_LABEL: Record<string, string> = {
  request: 'Ba om godkjenning',
  approve: 'Godkjent',
  reject: 'Avslått',
  pause: 'Pauset',
  deactivate: 'Deaktivert',
};

/**
 * /klubb — Klubbetalinger for betalingsansvarlige (fase B-2). Samme RPC-er og
 * vakter som appens ClubPaymentsScreen; hver skrivende handling går via en
 * dialog med begrunnelse der backend krever det.
 */
export default function KlubbApp() {
  const {session, loading} = useSession();
  const [clubs, setClubs] = useState<ClubPaymentsClub[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const [toast, showToast] = useToast();
  const [onboarding, setOnboarding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClubs(await getClubPaymentsOverview());
    } catch (e) {
      setError((e as Error).message);
      setClubs(null);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setClubs(undefined);
      return;
    }
    load();
  }, [loading, session, load]);

  if (loading) return <Spinner />;
  if (!session) {
    return (
      <Card>
        <AuthPanel reason="Klubbetalinger er for klubbens betalingsansvarlige. Logg inn med samme konto som i Heia-appen." />
      </Card>
    );
  }
  if (clubs === undefined) return <Spinner label="Henter klubbene dine …" />;
  if (error) {
    return (
      <Card title="Kunne ikke hente Klubbetalinger">
        <Notice tone="error">{error}</Notice>
        <Button type="button" onClick={load}>Prøv igjen</Button>
      </Card>
    );
  }
  if (clubs === null || clubs.length === 0) {
    return (
      <Card title="Ingen klubb å forvalte" aside={<Button type="button" onClick={() => signOut()}>Logg ut</Button>}>
        <p className="muted">Kontoen <b>{session.user.email}</b> er ikke betalingsansvarlig for noen klubb. Rollen gis av Heia ved godkjenning av klubbsøknaden, eller gjennom en invitasjon fra en annen betalingsansvarlig.</p>
        <p className="muted mt-1">Er du invitert, åpner du lenken fra e-posten «Bli betalingsansvarlig». Ellers: <a href="mailto:hello@heiaapp.no">hello@heiaapp.no</a>.</p>
      </Card>
    );
  }

  const done = (msg?: string) => {
    setPrompt(null);
    if (msg) showToast(msg);
    load();
  };

  const startOnboarding = async (club: ClubPaymentsClub) => {
    // stripe-onboarding tar team_space_id og finner enheten via laget —
    // et hvilket som helst lag under enheten duger. Uten lag finnes det
    // ingenting å koble utbetaling til ennå.
    const ts = club.teams[0]?.teamSpaceId ?? club.requests[0]?.teamSpaceId ?? null;
    if (!ts) {
      setError('Klubben har ingen lag i Heia ennå. Når et lag ber om godkjenning, kan du sette opp utbetaling.');
      return;
    }
    setOnboarding(club.entity?.id ?? 'x');
    try {
      const {url} = await startStripeOnboarding(ts);
      location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setOnboarding(null);
    }
  };

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>Klubbetalinger</h1>
          <p className="sub">{session.user.email}</p>
        </div>
        <div className="app-nav">
          <a href="/konto/">Konto</a>
          <button type="button" onClick={() => signOut()}>Logg ut</button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      {clubs.map((club) => {
        const key = club.entity?.id ?? club.club?.id ?? 'club';
        const acct = club.account ? ACCOUNT[club.account.status] ?? {label: club.account.status, tone: 'neutral' as const, help: ''} : null;
        const canCollect = !!club.account?.chargesEnabled;
        return (
          <div key={key} className="app-grid app-grid-side">
            <div className="app-grid" style={{gap: 14}}>
              <Card title={club.entity?.legalName ?? club.club?.name ?? 'Klubb'}>
                {club.entity && <p className="muted small">org.nr. {club.entity.orgNumber}</p>}
                {club.clubs.length > 0 && <p className="muted small">Klubb i Heia: {club.clubs.map((c) => c.name).join(', ')}</p>}
                <div className="mt-2">
                  {acct ? <Badge tone={acct.tone}>{acct.label}</Badge> : <Badge tone="warn">Ikke koblet til Stripe</Badge>}
                  {club.account?.chargesEnabled && <Badge tone="good">Kan ta imot støtte</Badge>}
                </div>
                <p className="muted small mt-1">{acct?.help ?? 'Utbetaling må settes opp hos Stripe før lagene kan ta imot støtte.'}</p>
                {!canCollect && (
                  <div className="ui-actions">
                    <Button type="button" primary busy={onboarding === (club.entity?.id ?? 'x')} onClick={() => startOnboarding(club)}>
                      {club.account?.status === 'pending_onboarding' || !club.account ? 'Sett opp utbetaling hos Stripe' : 'Fortsett Stripe-oppsettet'}
                    </Button>
                  </div>
                )}
                {canCollect && (
                  <div className="ui-actions">
                    <Button type="button" className="ui-btn-sm" busy={onboarding === (club.entity?.id ?? 'x')} onClick={() => startOnboarding(club)}>Oppdater opplysninger hos Stripe</Button>
                  </div>
                )}
                <p className="muted small mt-1">Stripe åpnes i denne fanen. Når du er ferdig, kommer du tilbake hit. Statusen oppdateres av Stripe — det kan ta et øyeblikk.</p>
              </Card>

              <Card title="Betalingsansvarlige" aside={
                club.entity && (
                  <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
                    title: 'Inviter ny betalingsansvarlig',
                    message: 'Personen får en e-post med lenke til «Bli betalingsansvarlig». Rollen blir aktiv først når invitasjonen aksepteres med riktig e-postkonto — ellers bekrefter Heia identiteten manuelt.',
                    confirm: 'Send invitasjon',
                    fields: [{key: 'name', label: 'Navn', required: true}, {key: 'email', label: 'E-post', type: 'email', required: true}],
                    run: async (note, f) => {
                      const r = await issueManagerInvitation({entityId: club.entity!.id, name: f.name, email: f.email, note: note || undefined});
                      if (r.outcome === 'suspended') throw new Error('Kontoen din er satt på pause som betalingsansvarlig. Ta kontakt med Heia.');
                      return 'Invitasjonen er registrert.';
                    },
                  })}>Inviter</Button>
                )
              }>
                <ul className="ui-list">
                  {club.managers.map((m) => (
                    <li key={m.userId} className="ui-item"><span><b>{m.name}{m.isMe ? ' (deg)' : ''}</b><small>{m.source ? `Kilde: ${m.source}` : ''}</small></span><Badge tone={m.status === 'active' ? 'good' : 'warn'}>{m.status === 'active' ? 'Aktiv' : 'Pauset'}</Badge></li>
                  ))}
                  {club.invitations.map((i) => (
                    <li key={i.id} className="ui-item"><span><b>{i.invitedName}</b><small>{INVITATION_LABEL[i.status] ?? i.status}{i.status === 'pending' && !i.sentAt ? ' · e-posten er ikke sendt ennå' : ''}{i.expiresAt && i.status === 'pending' ? ` · gyldig til ${formatDate(i.expiresAt)}` : ''}</small></span><Badge tone={i.status === 'pending' ? 'info' : i.status === 'awaiting_review' ? 'warn' : i.status === 'accepted' ? 'good' : 'neutral'}>{i.status}</Badge></li>
                  ))}
                  {club.managers.length === 0 && club.invitations.length === 0 && <li><Empty>Ingen betalingsansvarlige.</Empty></li>}
                </ul>
              </Card>
            </div>

            <div className="app-grid" style={{gap: 14}}>
              <Card title="Lagforespørsler" aside={club.requests.length > 0 && <Badge tone="warn">{club.requests.length} venter</Badge>}>
                {club.requests.length === 0 ? <Empty>Ingen lag venter på godkjenning.</Empty> : (
                  <ul className="ui-list">
                    {club.requests.map((r) => (
                      <li key={r.id} className="ui-item">
                        <span><b>{r.teamName}{r.ageGroup ? ` · ${r.ageGroup}` : ''}</b><small>{r.memberCount} medlemmer · bedt om av {r.requestedBy} {formatDate(r.requestedAt)}</small></span>
                        <span className="ui-actions">
                          <Button type="button" primary className="ui-btn-sm" disabled={!canCollect} title={!canCollect ? 'Sett opp utbetaling hos Stripe først' : undefined} onClick={() => setPrompt({
                            title: `Godkjenn ${r.teamName}`,
                            message: 'Laget får klubbens standardtilbud (79 kr i måneden, 60 kr til laget) og «Støtt laget» blir synlig for familiene.',
                            confirm: 'Godkjenn',
                            run: async () => { await approveTeamSupport(r.id); return `${r.teamName} er godkjent.`; },
                          })}>Godkjenn</Button>
                          <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
                            title: `Avslå ${r.teamName}`,
                            message: 'Treneren ser begrunnelsen i appen.',
                            confirm: 'Avslå',
                            destructive: true,
                            requireNote: true,
                            run: async (note) => { await rejectTeamSupport(r.id, note); return 'Forespørselen er avslått.'; },
                          })}>Avslå</Button>
                        </span>
                        {!canCollect && <small style={{gridColumn: '1 / -1'}}>Godkjenning krever at utbetaling er satt opp hos Stripe.</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Lag">
                {club.teams.length === 0 ? <Empty>Ingen lag er koblet til klubben ennå.</Empty> : (
                  <ul className="ui-list">
                    {club.teams.map((t) => (
                      <li key={t.teamSpaceId} className="ui-item">
                        <span>
                          <b>{t.teamName}{t.ageGroup ? ` · ${t.ageGroup}` : ''}</b>
                          <small>{t.liveSubscriptions === 0 ? 'Ingen aktive støttespillere' : `${t.liveSubscriptions} aktive støttespillere`}{t.dormantAt ? ' · laget står uten aktive medlemmer' : ''}</small>
                        </span>
                        <Badge tone={STATE[t.state].tone}>{STATE[t.state].label}</Badge>
                        {(t.state === 'collecting' || t.state === 'paused' || t.unresolvedCancellations > 0) && (
                          <span className="ui-actions">
                            {t.state === 'collecting' && (
                              <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
                                title: `Pause nye støttespillere for ${t.teamName}`,
                                message: 'Eksisterende avtaler fortsetter. Nye kan ikke tegnes før du godkjenner laget på nytt fra appen.',
                                confirm: 'Pause',
                                run: async (note) => { await pauseTeamSupport(t.teamSpaceId, note || undefined); return 'Laget er pauset.'; },
                              })}>Pause</Button>
                            )}
                            {(t.state === 'collecting' || t.state === 'paused') && (
                              <Button type="button" danger className="ui-btn-sm" onClick={() => setPrompt({
                                title: `Deaktiver støtte for ${t.teamName}`,
                                message: <>Nye støttespillere stoppes, og de {t.liveSubscriptions} aktive avtalene avsluttes ved periodeslutt. Ingen refusjon av betalt periode.</>,
                                confirm: 'Deaktiver',
                                destructive: true,
                                run: async (note) => { const r = await deactivateTeamSupport(t.teamSpaceId, note || undefined); return `Deaktivert — ${r.count} avtaler avsluttes ved periodeslutt.`; },
                              })}>Deaktiver</Button>
                            )}
                            {t.unresolvedCancellations > 0 && (
                              <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
                                title: 'Fullfør deaktiveringen',
                                message: `${t.unresolvedCancellations} avtaler ble ikke avsluttet hos Stripe. Kjør deaktiveringen på nytt (trygt å gjenta).`,
                                confirm: 'Kjør på nytt',
                                run: async () => { const r = await deactivateTeamSupport(t.teamSpaceId); return `${r.count} avtaler avsluttes ved periodeslutt.`; },
                              })}>Fullfør deaktiveringen</Button>
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Historikk">
                {club.log.length === 0 ? <Empty>Ingen hendelser ennå.</Empty> : (
                  <ul className="log">
                    {club.log.slice(0, 30).map((l, i) => (
                      <li key={i}><time>{formatDateTime(l.createdAt)}</time><span><b>{ACTION_LABEL[l.action] ?? l.action}</b> · {l.teamName} · {l.actor}{l.affectedSubscriptions != null ? ` · ${l.affectedSubscriptions} avtaler` : ''}{l.note && <span className="note">«{l.note}»</span>}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        );
      })}

      <PromptDialog spec={prompt} onClose={() => setPrompt(null)} onDone={done} />
      {toast}
    </div>
  );
}
