import {supabase} from '../supabase';
import type {
  EventAttendee,
  EventType,
  HeiaEvent,
  HeiaEventDetail,
  MatchEvent,
  MatchEventType,
  MatchStatus,
  RSVPStatus,
  RSVPSummary,
} from '../../shared/types';

// Databasen har flere event-typer enn appen viser chip for. `mote` og
// `turnering` faller ned i `annet` til vi har egne chips for dem.
const EVENT_TYPE_MAP: Record<string, EventType> = {
  trening: 'trening',
  kamp: 'kamp',
  sosialt: 'sosialt',
  mote: 'annet',
  turnering: 'annet',
  annet: 'annet',
};

// match_sessions.status (norsk, DB) → MatchStatus (appens union).
const MATCH_STATUS_MAP: Record<string, MatchStatus> = {
  planlagt: 'upcoming',
  live: 'live',
  pause: 'halfTime',
  ferdig: 'finished',
  avlyst: 'cancelled',
};

const SESSION_COLUMNS =
  'id, opponent, home_score, away_score, is_home, status, reporter_id, started_at';

const EVENT_COLUMNS = `
  id, type, title, description, location, start_time, end_time,
  match_sessions ( ${SESSION_COLUMNS} )
`;

// `!inner` gjør at et filter på match_sessions faktisk luker bort event-rader.
// Uten det ville et vanlig embed bare returnert eventet med tom relasjon.
const LIVE_MATCH_COLUMNS = `
  id, type, title, description, location, start_time, end_time,
  match_sessions!inner ( ${SESSION_COLUMNS} )
`;

const emptyRsvp = (): RSVPSummary => ({
  coming: 0,
  notComing: 0,
  pending: 0,
  myStatus: 'venter',
});

// match_sessions har UNIQUE(event_id), men PostgREST kan levere embeddet
// relasjon som objekt eller array avhengig av hvordan den utledes.
function firstOf<T>(embedded: T | T[] | null | undefined): T | undefined {
  if (!embedded) return undefined;
  return Array.isArray(embedded) ? embedded[0] : embedded;
}

/**
 * Rader fra `events` (+ embeddet match_session) → HeiaEvent.
 * team_space_id stemples fra argumentet, som i getTeamFeed.
 *
 * home_score/away_score tolkes som «oss/dem» uavhengig av is_home —
 * ScoreBoard viser alltid eget lag først.
 */
function mapEventRow(
  row: any,
  teamSpaceId: string,
  rsvp: RSVPSummary,
): HeiaEvent {
  const session = firstOf<any>(row.match_sessions);

  return {
    id: row.id,
    teamSpaceId,
    type: EVENT_TYPE_MAP[row.type as string] ?? 'annet',
    title: row.title,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    rsvp,
    opponent: session?.opponent ?? undefined,
    score: session
      ? {home: session.home_score, away: session.away_score}
      : undefined,
    matchStatus: session
      ? (MATCH_STATUS_MAP[session.status as string] ?? 'upcoming')
      : undefined,
    reporterId: session?.reporter_id ?? undefined,
    matchSessionId: session?.id ?? undefined,
    startedAt: session?.started_at ? new Date(session.started_at) : undefined,
  };
}

/**
 * Teller RSVP-er for en gruppe events i én spørring. RLS lar medlemmer se
 * lagets svar. Raden uten child_id er brukerens eget svar.
 *
 * Merk: `pending` teller kun eksplisitte «venter»-rader, ikke medlemmer som
 * aldri har svart. RSVPBar skjuler seg selv når totalen er 0.
 */
async function getRsvpSummaries(
  eventIds: string[],
): Promise<Map<string, RSVPSummary>> {
  const summaries = new Map<string, RSVPSummary>();
  for (const id of eventIds) {
    summaries.set(id, emptyRsvp());
  }

  const [
    {
      data: {user},
    },
    {data, error},
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('event_rsvps')
      .select('event_id, user_id, child_id, status')
      .in('event_id', eventIds),
  ]);

  if (error) {
    throw error;
  }

  for (const row of (data || []) as any[]) {
    const summary = summaries.get(row.event_id);
    if (!summary) continue;

    if (row.status === 'kommer') summary.coming += 1;
    else if (row.status === 'kan_ikke') summary.notComing += 1;
    else summary.pending += 1;

    if (user && row.user_id === user.id && row.child_id === null) {
      summary.myStatus = row.status as RSVPStatus;
    }
  }

  return summaries;
}

/** Alle hendelser for et lagrom, kronologisk (tidligste først). */
export async function getTeamEvents(teamSpaceId: string): Promise<HeiaEvent[]> {
  const {data, error} = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('team_space_id', teamSpaceId)
    .is('deleted_at', null)
    .order('start_time', {ascending: true});

  if (error) {
    throw error;
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) {
    return [];
  }

  const summaries = await getRsvpSummaries(rows.map(r => r.id));
  return rows.map(row =>
    mapEventRow(row, teamSpaceId, summaries.get(row.id) ?? emptyRsvp()),
  );
}

/**
 * Pågående kamp for hero-banneret på TeamHome, eller null.
 * Vi henter ikke RSVP her: banneret viser stilling, ikke oppmøte.
 *
 * `pause` er også «pågående» — kampen er ikke over, den har bare stoppet
 * klokka. Uten den forsvant banneret i pausen og dukket opp igjen i andre
 * omgang, som om kampen hadde tatt slutt og startet på nytt.
 */
export async function getLiveMatch(
  teamSpaceId: string,
): Promise<HeiaEvent | null> {
  const {data, error} = await supabase
    .from('events')
    .select(LIVE_MATCH_COLUMNS)
    .eq('team_space_id', teamSpaceId)
    .is('deleted_at', null)
    .in('match_sessions.status', ['live', 'pause'])
    .order('start_time', {ascending: false})
    .limit(1);

  if (error) {
    throw error;
  }

  const row = (data || [])[0];
  return row ? mapEventRow(row, teamSpaceId, emptyRsvp()) : null;
}

/** Felter `NewEventScreen` samler inn. `opponent`/`isHome` gjelder kun kamp. */
export interface CreateEventInput {
  teamSpaceId: string;
  type: EventType;
  title: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  description?: string;
  opponent?: string;
  isHome?: boolean;
}

/**
 * Oppretter en hendelse via `create_event` (SECURITY DEFINER). RPC-en er
 * nødvendig for at en kamp og dens match_session skal bli til i samme
 * transaksjon — to klient-inserts kunne etterlatt en kamp uten session.
 * Returnerer id-en til den nye hendelsen.
 */
export async function createEvent(input: CreateEventInput): Promise<string> {
  const isMatch = input.type === 'kamp';

  const {data, error} = await supabase.rpc('create_event', {
    p_team_space_id: input.teamSpaceId,
    p_type: input.type,
    p_title: input.title,
    p_start_time: input.startTime.toISOString(),
    p_end_time: input.endTime?.toISOString() ?? null,
    p_location: input.location ?? null,
    p_description: input.description ?? null,
    p_opponent: isMatch ? (input.opponent ?? null) : null,
    p_is_home: isMatch ? (input.isHome ?? true) : true,
  });

  if (error) {
    throw error;
  }

  return (data as any).event_id as string;
}

/**
 * Lagrer brukerens eget svar via `upsert_rsvp` (SECURITY DEFINER).
 * RPC-en validerer medlemskap og status-verdien selv.
 *
 * `child_id` utelates: v1 lar en forelder kun svare for seg selv. Skal en
 * forelder svare for et barn, sendes `p_child_id` — RPC-en sjekker eierskap.
 */
export async function setRsvp(
  eventId: string,
  status: RSVPStatus,
): Promise<void> {
  const {error} = await supabase.rpc('upsert_rsvp', {
    p_event_id: eventId,
    p_status: status,
  });

  if (error) {
    throw error;
  }
}

/**
 * Tildeler kampreporter. Ingen RPC trengs — RLS på `match_sessions` slipper
 * gjennom en admin i lagrommet (eller reporteren selv).
 *
 * UPDATE-policyen i `00014` har ingen `WITH CHECK`, så Postgres gjenbruker
 * `USING`. En reporter som ikke er admin kan derfor ikke peke rollen videre:
 * den nye raden ville ikke lenger matche `reporter_id = auth.uid()`. Kun admin
 * skal se «Bytt»-knappen.
 *
 * Nekter RLS oppdateringen via `USING` får vi ingen feil, bare null rader —
 * derfor `.select()` og en eksplisitt sjekk, ellers ville et avvist bytte sett
 * ut som et vellykket et.
 */
export async function setMatchReporter(
  matchSessionId: string,
  userId: string,
): Promise<void> {
  const {data, error} = await supabase
    .from('match_sessions')
    .update({reporter_id: userId})
    .eq('id', matchSessionId)
    .select('id');

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Du har ikke tilgang til å bytte kampreporter.');
  }
}

/**
 * Blåser i gang kampen via `start_match`. RPC-en setter `live` + `started_at`,
 * og gjør den som starter til kampreporter hvis ingen er utpekt — det er slik
 * «bare trykk start, så rapporterer du» blir sant.
 *
 * Kun trener/lagleder/admin eller en allerede utpekt reporter slipper til.
 */
export async function startMatch(eventId: string): Promise<void> {
  const {error} = await supabase.rpc('start_match', {p_event_id: eventId});

  if (error) {
    throw error;
  }
}

/** Hendelsene `ReporterActions` kan sende. RPC-en avviser alt annet. */
export type ReportableEventType =
  | 'mål'
  | 'pause'
  | 'andre_omgang'
  | 'slutt'
  | 'melding';

export interface ReportMatchEventInput {
  type: ReportableEventType;
  /** Påkrevd for mål. `home` = oss, `away` = motstander. */
  teamSide?: 'home' | 'away';
  description?: string;
}

/**
 * Rapporterer én kamphendelse via `report_match_event`.
 *
 * RPC-en gjør tre ting i én transaksjon: skriver `match_events`, oppdaterer
 * stillingen på `match_sessions`, og legger en post i feeden. Feed-posten er
 * hele poenget — det er den som når foreldre som ikke sitter på kampskjermen.
 *
 * Kampminuttet regnes ut server-side fra `started_at` og sendes ikke inn.
 */
export async function reportMatchEvent(
  matchSessionId: string,
  input: ReportMatchEventInput,
): Promise<void> {
  const {error} = await supabase.rpc('report_match_event', {
    p_match_session_id: matchSessionId,
    p_type: input.type,
    p_team_side: input.teamSide ?? null,
    p_description: input.description ?? null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Lytter på en pågående kamp og kaller `onChange` når noe skjer.
 *
 * Vi refetcher i stedet for å flette inn payloaden: en `match_events`-INSERT
 * må uansett inn i kampforløpet i riktig rekkefølge, og en refetch kan ikke
 * komme ut av synk med serveren. Realtime respekterer RLS, så bare lagets
 * medlemmer får hendelsene.
 *
 * Returnerer en oppryddingsfunksjon — kall den når skjermen forlates, ellers
 * blir kanalen liggende åpen.
 */
export function subscribeToMatch(
  matchSessionId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`match:${matchSessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'match_events',
        filter: `match_session_id=eq.${matchSessionId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_sessions',
        filter: `id=eq.${matchSessionId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function mapAttendees(rows: any): EventAttendee[] {
  return ((rows ?? []) as any[]).map(a => ({
    id: a.id,
    name: a.name ?? 'Medlem',
    avatarUrl: a.avatar ?? undefined,
    childName: a.child_name ?? undefined,
  }));
}

/**
 * Hva raden skal si i kampforløpet.
 *
 * For et mål er `description` det reporteren skrev — som regel hvem som scoret.
 * Den flyttes derfor til `player`, og selve linjen forteller hvem målet var
 * for. Uten dette ville et mål uten scorernavn blitt en tom rad, og et mål med
 * navn ville sagt «Ola» uten å røpe hvilket lag som ledet.
 */
function describeMatchEvent(
  type: MatchEventType,
  teamSide: 'home' | 'away' | undefined,
  description: string | undefined,
  opponent: string,
): {description: string; player?: string} {
  if (type === 'mål') {
    return {
      description: teamSide === 'away' ? `Mål for ${opponent}` : 'Mål for oss',
      player: description || undefined,
    };
  }

  // De øvrige får en beskrivelse fra RPC-en (avspark, melding) eller ingen.
  const fallback: Partial<Record<MatchEventType, string>> = {
    avspark: 'Kampen er i gang',
    pause: 'Pause',
    andre_omgang: 'Andre omgang',
    slutt: 'Slutt',
  };

  return {description: description || fallback[type] || ''};
}

function mapMatchEvents(session: any): MatchEvent[] {
  const opponent = (session.opponent as string) ?? 'motstanderen';

  return ((session.match_events ?? []) as any[]).map(me => {
    const teamSide = (me.team_side as 'home' | 'away' | null) ?? undefined;
    const {description, player} = describeMatchEvent(
      me.type as MatchEventType,
      teamSide,
      me.description ?? undefined,
      opponent,
    );

    return {
      id: me.id,
      matchId: session.id,
      type: me.type as MatchEventType,
      minute: me.minute,
      player: me.player_name ?? player,
      description,
      teamSide,
      reportedBy: me.reported_by ?? undefined,
    };
  });
}

/**
 * Full event-detalj via get_event_with_rsvp (SECURITY DEFINER). RPC-en er
 * nødvendig for oppmøtelistene: profiles-RLS lar deg ikke lese lagkameraters
 * navn direkte. teamSpaceId stemples fra kalleren — RPC-en returnerer det ikke.
 */
export async function getEventDetail(
  eventId: string,
  teamSpaceId: string,
): Promise<HeiaEventDetail> {
  const {data, error} = await supabase.rpc('get_event_with_rsvp', {
    evt_id: eventId,
  });

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Fant ikke hendelsen');
  }

  const evt = data as any;
  const session = evt.match_session ?? undefined;
  const summary = evt.rsvp_summary ?? {};

  const rsvp: RSVPSummary = {
    coming: Number(summary.coming ?? 0),
    notComing: Number(summary.not_coming ?? 0),
    pending: Number(summary.pending ?? 0),
    myStatus: (evt.my_rsvp as RSVPStatus) ?? 'venter',
  };

  const base = mapEventRow(
    {
      id: evt.id,
      type: evt.type,
      title: evt.title,
      description: evt.description,
      location: evt.location,
      start_time: evt.start_time,
      end_time: evt.end_time,
      match_sessions: session,
    },
    teamSpaceId,
    rsvp,
  );

  return {
    ...base,
    matchEvents: session ? mapMatchEvents(session) : undefined,
    attendees: {
      coming: mapAttendees(evt.attendees?.coming),
      notComing: mapAttendees(evt.attendees?.not_coming),
      pending: mapAttendees(evt.attendees?.pending),
    },
  };
}
