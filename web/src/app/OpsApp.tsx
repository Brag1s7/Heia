import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AuthPanel, signOut, useSession} from '../lib/auth';
import {
  formatDate,
  formatDateTime,
  getOpsClaim,
  isOpsAdmin,
  listOpsClaims,
  opsApproveClaim,
  opsConfirmInvitationReview,
  opsIssueManagerInvitation,
  opsListPaymentEntities,
  opsListTeamsForClubs,
  opsMoveTeamToClub,
  opsReactivateManager,
  opsRejectClaim,
  opsRejectInvitationReview,
  opsRemoveManager,
  opsRequestClaimInfo,
  opsRevokeManagerInvitation,
  opsSuspendManager,
  type OpsClaim,
  type OpsClubTeam,
  type OpsPaymentEntity,
} from '../lib/api';
import {Badge, Button, Card, Empty, Notice, PromptDialog, Row, Spinner, Tabs, useToast, type PromptSpec} from './ui';

// ---------------------------------------------------------------------------
// /ops — Heia Ops på web (fase B-3). Statisk Astro: all ruting er
// klientside. Direkte lenker fra e-post er /ops/claims/<id> (Vercel
// rewriter til /ops/), og ?claim=<id> / ?entity=<id> virker også. Oppfrisking
// beholder visningen fordi tilstanden leses fra URL-en ved oppstart.
// ---------------------------------------------------------------------------

type View =
  | {kind: 'claims'}
  | {kind: 'claim'; id: string}
  | {kind: 'entities'}
  | {kind: 'entity'; id: string};

function readView(): View {
  const path = location.pathname.replace(/\/+$/, '');
  const m = path.match(/^\/ops\/(claims|entities)\/([0-9a-f-]{36})$/i);
  if (m) return {kind: m[1] === 'claims' ? 'claim' : 'entity', id: m[2]};
  const q = new URLSearchParams(location.search);
  if (q.get('claim')) return {kind: 'claim', id: q.get('claim')!};
  if (q.get('entity')) return {kind: 'entity', id: q.get('entity')!};
  if (path.endsWith('/entities') || q.get('view') === 'entities') return {kind: 'entities'};
  return {kind: 'claims'};
}

function viewUrl(v: View): string {
  if (v.kind === 'claim') return `/ops/claims/${v.id}`;
  if (v.kind === 'entity') return `/ops/entities/${v.id}`;
  if (v.kind === 'entities') return '/ops/entities';
  return '/ops/';
}

const CLAIM_STATUS: Record<string, {label: string; tone: 'info' | 'warn' | 'good' | 'bad' | 'neutral'}> = {
  submitted: {label: 'Ny', tone: 'info'},
  in_review: {label: 'Venter svar', tone: 'warn'},
  approved: {label: 'Godkjent', tone: 'good'},
  rejected: {label: 'Avslått', tone: 'bad'},
  expired: {label: 'Utløpt', tone: 'neutral'},
};

const INVITATION_LABEL: Record<string, string> = {
  pending: 'Venter på svar',
  awaiting_review: 'AVVIKSKONTROLL',
  accepted: 'Akseptert',
  declined: 'Takket nei',
  revoked: 'Trukket tilbake',
  expired: 'Utløpt',
};

const EVENT_LABEL: Record<string, string> = {
  granted: 'Rolle gitt',
  accepted: 'Invitasjon akseptert',
  suspended: 'Satt på pause',
  reactivated: 'Reaktivert',
  removed: 'Fjernet',
  invite_issued: 'Invitasjon utstedt',
  invite_reminder: 'Påminnelse sendt',
  invite_revoked: 'Invitasjon trukket',
  invite_declined: 'Invitasjon avslått',
  invite_expired: 'Invitasjon utløpt',
  invite_redeemed_review: 'Innløst med avvik',
  review_confirmed: 'Avvik bekreftet',
  review_rejected: 'Avvik avvist',
  invite_attempt_invalid: 'Ugyldig forsøk',
  team_moved: 'Lag flyttet',
};

export default function OpsApp() {
  const {session, loading} = useSession();
  const [ops, setOps] = useState<boolean | null>(null);
  const [view, setViewState] = useState<View>(() => readView());
  const [toast, showToast] = useToast();
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const [refresh, setRefresh] = useState(0);

  const setView = useCallback((v: View) => {
    history.pushState(null, '', viewUrl(v));
    setViewState(v);
  }, []);

  useEffect(() => {
    const onPop = () => setViewState(readView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!session) {
      setOps(null);
      return;
    }
    let alive = true;
    isOpsAdmin().then((v) => alive && setOps(v));
    return () => {
      alive = false;
    };
  }, [session]);

  if (loading) return <Spinner />;
  if (!session) {
    return (
      <Card>
        <AuthPanel reason="Heia Ops er Heias interne arbeidsflate. Logg inn med ops-kontoen din." />
      </Card>
    );
  }
  if (ops === null) return <Spinner label="Sjekker tilgang …" />;
  if (!ops) {
    return (
      <Card title="Ingen tilgang" aside={<Button type="button" onClick={() => signOut()}>Logg ut</Button>}>
        <p className="muted">Kontoen <b>{session.user.email}</b> er ikke registrert i Heia Ops. Tilgangen håndheves i databasen — ingen data er hentet.</p>
      </Card>
    );
  }

  const done = (msg?: string) => {
    setPrompt(null);
    if (msg) showToast(msg);
    setRefresh((n) => n + 1);
  };

  const tab = view.kind === 'claims' || view.kind === 'claim' ? 'claims' : 'entities';

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>Heia Ops</h1>
          <p className="sub">{session.user.email}</p>
        </div>
        <div className="app-nav">
          <Tabs value={tab} onChange={(t) => setView(t === 'claims' ? {kind: 'claims'} : {kind: 'entities'})} items={[{key: 'claims', label: 'Søknader'}, {key: 'entities', label: 'Klubber og roller'}]} />
          <button type="button" onClick={() => signOut()}>Logg ut</button>
        </div>
      </div>

      {view.kind === 'claims' && <ClaimsList key={refresh} onOpen={(id) => setView({kind: 'claim', id})} />}
      {view.kind === 'claim' && <ClaimDetail key={view.id + refresh} id={view.id} onBack={() => setView({kind: 'claims'})} onEntity={(id) => setView({kind: 'entity', id})} setPrompt={setPrompt} />}
      {view.kind === 'entities' && <EntitiesList key={refresh} onOpen={(id) => setView({kind: 'entity', id})} />}
      {view.kind === 'entity' && <EntityDetail key={view.id + refresh} id={view.id} onBack={() => setView({kind: 'entities'})} setPrompt={setPrompt} />}

      <PromptDialog spec={prompt} onClose={() => setPrompt(null)} onDone={done} />
      {toast}
    </div>
  );
}

// ── Søknader ────────────────────────────────────────────────────────────────

function ClaimsList({onOpen}: {onOpen: (id: string) => void}) {
  const [claims, setClaims] = useState<OpsClaim[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  useEffect(() => {
    listOpsClaims().then(setClaims).catch((e) => setError(e.message));
  }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (claims === undefined) return <Spinner label="Henter søknader …" />;
  if (claims === null) return <Notice tone="warn">Ingen tilgang.</Notice>;
  const open = claims.filter((c) => c.status === 'submitted' || c.status === 'in_review');
  const shown = filter === 'open' ? open : claims;
  return (
    <Card title="Klubbsøknader" aside={<Tabs value={filter} onChange={setFilter} items={[{key: 'open', label: 'Åpne', count: open.length}, {key: 'all', label: 'Alle'}]} />}>
      {shown.length === 0 ? <Empty>Ingen søknader {filter === 'open' ? 'venter' : 'finnes'}.</Empty> : (
        <ul className="ui-list">
          {shown.map((c) => (
            <li key={c.id}>
              <a className="ui-item link" href={`/ops/claims/${c.id}`} onClick={(e) => { e.preventDefault(); onOpen(c.id); }}>
                <span><b>{c.legalName}</b><small>org.nr. {c.orgNumber} · {c.club?.name ?? 'ukjent klubbrad'} · søker {c.claimant?.displayName ?? '?'} · {formatDate(c.createdAt)}{c.nomineeIsSelf ? '' : ` · nominert: ${c.nomineeName ?? '?'}`}</small></span>
                <Badge tone={CLAIM_STATUS[c.status]?.tone ?? 'neutral'}>{CLAIM_STATUS[c.status]?.label ?? c.status}</Badge>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ClaimDetail({id, onBack, onEntity, setPrompt}: {id: string; onBack: () => void; onEntity: (id: string) => void; setPrompt: (p: PromptSpec) => void}) {
  const [claim, setClaim] = useState<OpsClaim | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  useEffect(() => {
    getOpsClaim(id).then(setClaim).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (claim === undefined) return <Spinner label="Henter søknaden …" />;
  if (claim === null) return <Card title="Fant ikke søknaden"><p className="muted">Sjekk lenken, eller gå <button className="ui-btn ui-btn-sm" type="button" onClick={onBack}>tilbake til køen</button>.</p></Card>;
  const open = claim.status === 'submitted' || claim.status === 'in_review';
  const b = claim.brreg;
  return (
    <div className="app-grid app-grid-2">
      <div className="app-grid" style={{gap: 14}}>
        <Card title={claim.legalName} aside={<Badge tone={CLAIM_STATUS[claim.status]?.tone ?? 'neutral'}>{CLAIM_STATUS[claim.status]?.label ?? claim.status}</Badge>}>
          <button type="button" className="ui-btn ui-btn-sm" onClick={onBack} style={{marginBottom: 12}}>‹ Alle søknader</button>
          <Row label="Orgnr"><span className="mono">{claim.orgNumber}</span></Row>
          <Row label="Klubbrad i Heia">{claim.club?.name ?? '–'}{claim.clubAlreadyLinked && <Badge tone="warn">Alt koblet</Badge>}</Row>
          <Row label="Søker">{claim.claimant?.displayName ?? '?'} · oppgitt rolle: {claim.claimedRole}</Row>
          <Row label="Kontakt">{claim.contactEmail ?? '–'}{claim.contactPhone ? ` · ${claim.contactPhone}` : ''}</Row>
          <Row label="Nominert">{claim.nomineeIsSelf ? 'Søkeren selv' : <>{claim.nomineeName} · {claim.nomineeEmail}{claim.nomineePhone ? ` · ${claim.nomineePhone}` : ''}</>}</Row>
          <Row label="Sendt">{formatDateTime(claim.createdAt)}</Row>
          {claim.existingEntity && <Notice tone="warn">Orgnr finnes fra før som «{claim.existingEntity.legalName}» ({claim.existingEntity.verificationStatus}). Godkjenning gjenbruker enheten — dobbeltsjekk at det ikke er en duplikat klubbrad.</Notice>}
          {claim.infoRequestNote && <Notice tone="info"><b>Du ba om mer informasjon:</b> {claim.infoRequestNote}</Notice>}
          {claim.reviewNote && <Notice tone={claim.status === 'approved' ? 'success' : 'warn'}><b>Beslutning:</b> {claim.reviewNote}{claim.reviewedAt ? ` (${formatDateTime(claim.reviewedAt)})` : ''}</Notice>}
          {outcome && <Notice tone="success">{outcome}</Notice>}

          {open && (
            <div className="ui-actions">
              <Button type="button" primary onClick={() => setPrompt({
                title: 'Godkjenn søknaden',
                message: <>Beskriv hvordan autorisasjonen ble verifisert (styreverv i Brønnøysund, kontakt med klubben, …). Teksten lagres som review_note og i audit-loggen. {claim.nomineeIsSelf ? 'Søkeren får rollen som betalingsansvarlig med en gang.' : `${claim.nomineeName} får en invitasjon (e-post sendes når web-landingen er aktivert).`}</>,
                confirm: 'Godkjenn',
                requireNote: true,
                run: async (note) => {
                  const r = await opsApproveClaim(claim.id, note);
                  setOutcome(r.grantedManager ? 'Godkjent — søkeren er betalingsansvarlig.' : r.invitationId ? 'Godkjent — invitasjon opprettet til den nominerte.' : 'Godkjent.');
                  return 'Søknaden er godkjent.';
                },
              })}>Godkjenn</Button>
              <Button type="button" onClick={() => setPrompt({
                title: 'Be om mer informasjon',
                message: 'Søkeren ser meldingen i appen og svarer til hello@heiaapp.no.',
                confirm: 'Send',
                requireNote: true,
                run: async (note) => { await opsRequestClaimInfo(claim.id, note); return 'Forespørselen er registrert.'; },
              })}>Be om mer info</Button>
              <Button type="button" danger onClick={() => setPrompt({
                title: 'Avslå søknaden',
                message: 'Søkeren ser begrunnelsen i appen.',
                confirm: 'Avslå',
                destructive: true,
                requireNote: true,
                run: async (note) => { await opsRejectClaim(claim.id, note); return 'Søknaden er avslått.'; },
              })}>Avslå</Button>
            </div>
          )}
        </Card>

        <Card title="Audit">
          {claim.audit.length === 0 ? <Empty>Ingen handlinger ennå.</Empty> : (
            <ul className="log">
              {claim.audit.map((a, i) => (
                <li key={i}><time>{formatDateTime(a.createdAt)}</time><span><b>{a.action === 'approve' ? 'Godkjent' : a.action === 'reject' ? 'Avslått' : 'Ba om info'}</b>{a.actor ? ` · ${a.actor}` : ''}<span className="note">«{a.note}»</span></span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Brønnøysund (beslutningsgrunnlag)">
        {!b ? <Empty>Ingen registerdata hentet.</Empty> : b.notFound ? <Notice tone="error">Orgnr finnes ikke i Enhetsregisteret.</Notice> : b.unreachable ? <Notice tone="warn">Brønnøysund var utilgjengelig da søknaden kom inn.</Notice> : (
          <div className="brreg">
            {b.enhet && (
              <>
                <Row label="Registrert navn">{b.enhet.navn} {b.checks?.navnMatch ? <Badge tone="good">Navn matcher</Badge> : <Badge tone="warn">Navn avviker</Badge>}</Row>
                <Row label="Org.form">{b.enhet.orgformKode} · {b.enhet.orgformTekst}</Row>
                {(b.enhet.slettedato || b.enhet.konkurs || b.enhet.underAvvikling) && <Notice tone="error">Enheten er {b.enhet.slettedato ? 'slettet' : b.enhet.konkurs ? 'konkurs' : 'under avvikling'}.</Notice>}
                <Row label="Kontakt i registeret">{b.enhet.epostadresse ?? '–'}{b.enhet.telefon ? ` · ${b.enhet.telefon}` : ''}</Row>
              </>
            )}
            <p className="muted small" style={{margin: '10px 0 6px'}}>Roller ({b.roller.length}). Treff på {b.checks?.nomineeIsSelf === false ? 'den nominerte ◆' : 'søkeren'} er markert.</p>
            <table>
              <tbody>
                {b.roller.map((r, i) => (
                  <tr key={i} className={r.matchSoker || r.matchNominert ? 'hit' : ''}><td>{r.rolle}</td><td>{r.navn}{r.matchNominert ? ' ◆' : ''}{r.matchSoker ? ' ●' : ''}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted small mt-1">Registermatch er bevis, aldri fasit — Stripe tar KYC, Heia tar autorisasjonskontrollen. Hentet {formatDateTime(b.fetchedAt)}.</p>
          </div>
        )}
        {claim.status === 'approved' && <p className="mt-2"><button type="button" className="ui-btn ui-btn-sm" onClick={() => onEntity('')}>Til Klubber og roller →</button></p>}
      </Card>
    </div>
  );
}

// ── Klubber og roller ───────────────────────────────────────────────────────

function EntitiesList({onOpen}: {onOpen: (id: string) => void}) {
  const [entities, setEntities] = useState<OpsPaymentEntity[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    opsListPaymentEntities().then(setEntities).catch((e) => setError(e.message));
  }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (entities === undefined) return <Spinner label="Henter klubber …" />;
  if (entities === null) return <Notice tone="warn">Ingen tilgang.</Notice>;
  return (
    <Card title="Klubber og roller">
      {entities.length === 0 ? <Empty>Ingen godkjente enheter ennå.</Empty> : (
        <ul className="ui-list">
          {entities.map((e) => {
            const active = e.managers.filter((m) => m.status === 'active').length;
            const review = e.invitations.filter((i) => i.status === 'awaiting_review').length;
            return (
              <li key={e.entity.id}>
                <a className="ui-item link" href={`/ops/entities/${e.entity.id}`} onClick={(ev) => { ev.preventDefault(); onOpen(e.entity.id); }}>
                  <span><b>{e.entity.legalName}</b><small>org.nr. {e.entity.orgNumber} · {e.clubs.map((c) => c.name).join(', ') || 'ingen klubbrad'} · {active} aktiv{active === 1 ? '' : 'e'} betalingsansvarlig{active === 1 ? '' : 'e'}</small></span>
                  <span style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                    {review > 0 && <Badge tone="warn">{review} avvik</Badge>}
                    {active === 0 && <Badge tone="bad">Managerløs</Badge>}
                    <Badge tone={e.account?.chargesEnabled ? 'good' : 'neutral'}>{e.account?.chargesEnabled ? 'Utbetaling aktiv' : e.account?.status ?? 'ingen konto'}</Badge>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function EntityDetail({id, onBack, setPrompt}: {id: string; onBack: () => void; setPrompt: (p: PromptSpec) => void}) {
  const [entities, setEntities] = useState<OpsPaymentEntity[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<OpsClubTeam[]>([]);
  useEffect(() => {
    opsListPaymentEntities().then(setEntities).catch((e) => setError(e.message));
  }, [id]);
  const entity = useMemo(() => entities?.find((e) => e.entity.id === id) ?? null, [entities, id]);
  const allClubs = useMemo(() => (entities ?? []).flatMap((e) => e.clubs.map((c) => ({...c, entityName: e.entity.legalName}))), [entities]);
  useEffect(() => {
    if (!entity) return;
    opsListTeamsForClubs(entity.clubs.map((c) => c.id)).then(setTeams).catch(() => setTeams([]));
  }, [entity]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (entities === undefined) return <Spinner label="Henter enheten …" />;
  if (!entity) return <Card title="Fant ikke enheten"><button className="ui-btn ui-btn-sm" type="button" onClick={onBack}>‹ Alle klubber</button></Card>;

  const e = entity;
  const managerAction = (title: string, confirm: string, destructive: boolean, run: (note: string) => Promise<void>, msg: string) =>
    setPrompt({title, confirm, destructive, requireNote: true, run: async (note) => { await run(note); return msg; }});

  return (
    <div className="app-grid app-grid-2">
      <div className="app-grid" style={{gap: 14}}>
        <Card title={e.entity.legalName} aside={<Badge tone={e.account?.chargesEnabled ? 'good' : 'neutral'}>{e.account?.chargesEnabled ? 'Utbetaling aktiv' : e.account?.status ?? 'ingen konto'}</Badge>}>
          <button type="button" className="ui-btn ui-btn-sm" onClick={onBack} style={{marginBottom: 12}}>‹ Alle klubber</button>
          <Row label="Orgnr"><span className="mono">{e.entity.orgNumber}</span></Row>
          <Row label="Verifisering">{e.entity.verificationStatus}</Row>
          <Row label="Klubbrader">{e.clubs.length === 0 ? '–' : e.clubs.map((c) => c.name).join(', ')}</Row>
          <Row label="Stripe">{e.account ? `${e.account.status}${e.account.chargesEnabled ? ' · charges enabled' : ''}` : 'ingen konto'}</Row>
        </Card>

        <Card title="Betalingsansvarlige" aside={
          <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
            title: 'Utsted invitasjon fra Heia Ops',
            message: 'Reparasjons-/førstegangsinvitasjon. E-posten sendes når WEB_INVITE_BASE_URL er satt — ellers står den som «ikke sendt».',
            confirm: 'Utsted',
            requireNote: true,
            fields: [{key: 'name', label: 'Navn', required: true}, {key: 'email', label: 'E-post', type: 'email', required: true}],
            run: async (note, f) => { await opsIssueManagerInvitation({entityId: e.entity.id, name: f.name, email: f.email, note}); return 'Invitasjonen er utstedt.'; },
          })}>Inviter</Button>
        }>
          {e.managers.length === 0 ? <Notice tone="warn">Enheten er managerløs — lagforespørsler faller tilbake på ops-e-post.</Notice> : (
            <ul className="ui-list">
              {e.managers.map((m) => (
                <li key={m.userId} className="ui-item">
                  <span><b>{m.name}</b><small>{m.source ? `kilde: ${m.source} · ` : ''}siden {formatDate(m.createdAt)}</small></span>
                  <Badge tone={m.status === 'active' ? 'good' : 'warn'}>{m.status === 'active' ? 'Aktiv' : 'Pauset'}</Badge>
                  <span className="ui-actions">
                    {m.status === 'active' ? (
                      <Button type="button" className="ui-btn-sm" onClick={() => managerAction(`Sett ${m.name} på pause`, 'Suspender', true, (n) => opsSuspendManager(e.entity.id, m.userId, n), 'Rollen er satt på pause.')}>Suspender</Button>
                    ) : (
                      <Button type="button" className="ui-btn-sm" onClick={() => managerAction(`Reaktiver ${m.name}`, 'Reaktiver', false, (n) => opsReactivateManager(e.entity.id, m.userId, n), 'Rollen er reaktivert.')}>Reaktiver</Button>
                    )}
                    <Button type="button" danger className="ui-btn-sm" onClick={() => managerAction(`Fjern ${m.name}`, 'Fjern', true, (n) => opsRemoveManager(e.entity.id, m.userId, n), 'Rollen er fjernet.')}>Fjern</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Invitasjoner">
          {e.invitations.length === 0 ? <Empty>Ingen invitasjoner.</Empty> : (
            <ul className="ui-list">
              {e.invitations.map((i) => (
                <li key={i.id} className="ui-item">
                  <span>
                    <b>{i.invitedName} <span className="muted" style={{fontWeight: 400}}>{i.invitedEmail}</span></b>
                    <small>{INVITATION_LABEL[i.status] ?? i.status} · fra {i.source} · {formatDate(i.createdAt)}{i.status === 'pending' ? (i.sentAt ? ` · sendt ${formatDate(i.sentAt)}` : ' · IKKE SENDT (WEB_INVITE_BASE_URL mangler)') : ''}{i.expiresAt && i.status === 'pending' ? ` · utløper ${formatDate(i.expiresAt)}` : ''}</small>
                    {i.mismatch && (
                      <small style={{color: '#8a6d1a'}}>Avvik: konto {i.mismatch.accountEmail} ({i.mismatch.profileName}) ≠ invitert {i.mismatch.invitedEmail} ({i.mismatch.invitedName}) · navnematch: {i.mismatch.nameMatch ? 'ja' : 'nei'}</small>
                    )}
                    {i.note && <small>«{i.note}»</small>}
                  </span>
                  <Badge tone={i.status === 'awaiting_review' ? 'warn' : i.status === 'pending' ? 'info' : i.status === 'accepted' ? 'good' : 'neutral'}>{i.status}</Badge>
                  {(i.status === 'pending' || i.status === 'awaiting_review') && (
                    <span className="ui-actions">
                      {i.status === 'awaiting_review' && (
                        <>
                          <Button type="button" primary className="ui-btn-sm" onClick={() => managerAction('Bekreft identiteten og aktiver rollen', 'Bekreft', false, (n) => opsConfirmInvitationReview(i.id, n), 'Rollen er aktivert.')}>Bekreft avvik</Button>
                          <Button type="button" danger className="ui-btn-sm" onClick={() => managerAction('Avvis innløsningen', 'Avvis', true, (n) => opsRejectInvitationReview(i.id, n), 'Innløsningen er avvist.')}>Avvis</Button>
                        </>
                      )}
                      {i.status === 'pending' && (
                        <Button type="button" danger className="ui-btn-sm" onClick={() => managerAction('Trekk tilbake invitasjonen', 'Trekk tilbake', true, (n) => opsRevokeManagerInvitation(i.id, n), 'Invitasjonen er trukket tilbake.')}>Trekk tilbake</Button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="app-grid" style={{gap: 14}}>
        <Card title="Lag under enheten">
          {teams.length === 0 ? <Empty>Ingen lag under klubbradene.</Empty> : (
            <ul className="ui-list">
              {teams.map((t) => (
                <li key={t.teamId} className="ui-item">
                  <span><b>{t.name}{t.ageGroup ? ` · ${t.ageGroup}` : ''}</b><small>klubbrad: {e.clubs.find((c) => c.id === t.clubId)?.name ?? t.clubId}</small></span>
                  <Button type="button" className="ui-btn-sm" onClick={() => setPrompt({
                    title: `Flytt ${t.name} til en annen klubbrad`,
                    message: <>Velg mål-klubbrad (id). Tilgjengelige: {allClubs.map((c) => `${c.name} [${c.entityName}] = ${c.id}`).join(' · ')}</>,
                    confirm: 'Flytt',
                    requireNote: true,
                    fields: [{key: 'club', label: 'Mål-klubbrad (uuid)', required: true}],
                    run: async (note, f) => { await opsMoveTeamToClub(t.teamId, f.club.trim(), note); return 'Laget er flyttet.'; },
                  })}>Flytt</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Hendelseslogg">
          {e.events.length === 0 ? <Empty>Ingen hendelser.</Empty> : (
            <ul className="log">
              {e.events.slice(0, 50).map((ev, i) => (
                <li key={i}><time>{formatDateTime(ev.createdAt)}</time><span><b>{EVENT_LABEL[ev.event] ?? ev.event}</b>{ev.subject ? ` · ${ev.subject}` : ''}{ev.actor ? ` · av ${ev.actor}` : ''}{ev.note && <span className="note">«{ev.note}»</span>}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
