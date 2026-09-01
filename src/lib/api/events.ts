import {supabase} from '../supabase';
import {getUserIdOrNull} from './authUser';
import {invalidateEventQueries} from '../queries/invalidate';
import {
  acquireChannel,
  isChannelJoinError,
  isChannelReady,
  isChannelResync,
} from '../realtimeChannels';
import {getRuntimeConfig} from '../runtimeConfig';
import {
  createMatchDecodeState,
  decodeMatchBroadcast,
} from './matchBroadcastDecode';
import {dayKey, eachDay, type BusyDays} from '../../shared/calendar';
import type {EditableEvent} from '../../shared/eventForm';
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

// Databasen har flere event-typer enn appen viser chip for. `mote` faller
// ned i `annet` til den får en egen chip.
const EVENT_TYPE_MAP: Record<string, EventType> = {
  trening: 'trening',
  kamp: 'kamp',
  turnering: 'turnering',
  sosialt: 'sosialt',
  mote: 'annet',
  annet: 'annet',
};

// match_sessions.status (norsk, DB) → MatchStatus (appens union).
// Eksportert: feed.ts bruker samme mapping på kampkonteksten fra 00029.
export const MATCH_STATUS_MAP: Record<string, MatchStatus> = {
  planlagt: 'upcoming',
  live: 'live',
  pause: 'halfTime',
  ferdig: 'finished',
  avlyst: 'cancelled',
};

// ⚠️ EKSPLISITT KOLONNELISTE — en ny kolonne i `match_sessions` når IKKE
// appen før den står her. `played_seconds`/`clock_started_at` (00073) er
// kampuret; uten dem i denne strengen ville banneret og innboksen falt
// tilbake på den gamle klokka som teller gjennom pausen, mens kampskjermen
// (som går via `get_event_with_rsvp`) viste riktig tid. To flater, to
// minutter — nøyaktig feilen P2 finnes for å hindre.
const SESSION_COLUMNS =
  'id, opponent, home_score, away_score, is_home, status, reporter_id, ' +
  'started_at, played_seconds, clock_started_at';

const EVENT_COLUMNS = `
  id, type, title, description, location, start_time, end_time, meeting_time,
  parent_event_id,
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
    meetingTime: row.meeting_time ? new Date(row.meeting_time) : undefined,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    rsvp,
    opponent: session?.opponent ?? undefined,
    score: session
      ? {home: session.home_score, away: session.away_score}
      : undefined,
    matchStatus: session
      ? MATCH_STATUS_MAP[session.status as string] ?? 'upcoming'
      : undefined,
    reporterId: session?.reporter_id ?? undefined,
    matchSessionId: session?.id ?? undefined,
    startedAt: session?.started_at ? new Date(session.started_at) : undefined,
    // P2/00073: kampuret. To tall, ikke ett — `started_at` teller gjennom
    // pausen og er historikk, ikke klokke. Mangler de, er serveren eldre enn
    // 00073, og `matchClock` faller tilbake på den gamle oppførselen.
    playedSeconds:
      session?.played_seconds === null || session?.played_seconds === undefined
        ? undefined
        : Number(session.played_seconds),
    clockStartedAt: session?.clock_started_at
      ? new Date(session.clock_started_at)
      : undefined,
    parentEventId: row.parent_event_id ?? undefined,
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

  // Lokal sesjonslesing, ikke getUser-rundtur (P5): id-en brukes kun til å
  // plukke «min» rad i minnet — RLS har alt avgjort hva vi får se.
  const [myUserId, {data, error}] = await Promise.all([
    getUserIdOrNull(),
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

    if (myUserId && row.user_id === myUserId && row.child_id === null) {
      summary.myStatus = row.status as RSVPStatus;
    }
  }

  return summaries;
}

/**
 * Alle hendelser for et lagrom, kronologisk (tidligste først).
 *
 * ⚠️ Turnerings-CONTAINEREN er MED (Brage 2026-08-06). Den ble filtrert bort
 * fram til nå, fordi turneringer «bodde på sesongsiden». Rollefordelingen er
 * nå en annen: Sesong er den sportslige oversikten og administrasjonsflaten,
 * Kalender er den kronologiske fasiten — SAMME objekt vises begge steder.
 *
 * Kampene i en turnering er helt vanlige kamper med `parent_event_id`. De
 * kommer med her som alle andre kamper, og grupperes under turneringen av
 * `shared/calendarList.ts` — det finnes bare ETT kampobjekt, og det skal
 * aldri dupliseres.
 */
export async function getTeamEvents(
  teamSpaceId: string,
  window?: {from: Date; to: Date},
): Promise<HeiaEvent[]> {
  // Datovinduet (B2/P10 #7): uten det vokser både raden-hentingen og
  // getRsvpSummaries' `.in(eventIds)`-URL med lagets historikk for alltid —
  // ved ~200 hendelser sprenger URL-en serverens grense (HTTP 414).
  // Vinduet settes av query-laget (src/lib/queries/events.ts); direkte kall
  // uten vindu beholder gammel oppførsel.
  let query = supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('team_space_id', teamSpaceId)
    .is('deleted_at', null);
  if (window) {
    query = query
      .gte('start_time', window.from.toISOString())
      .lte('start_time', window.to.toISOString());
  }
  const {data, error} = await query.order('start_time', {ascending: true});

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
 * Dagene laget alt har noe på, til prikkene i datovelgeren.
 *
 * Egen, mager spørring i stedet for `getTeamEvents`: vi trenger to kolonner
 * og ingen RSVP-opptelling. Å gjenbruke getTeamEvents ville betydd en ekstra
 * rundtur til `event_rsvps` for tall som aldri vises.
 *
 * Turneringer er MED her, i motsetning til i kalenderlista. En cup-helg er
 * den mest opptatte dagen laget har — at containeren bor på sesongsiden gjør
 * den ikke ledig.
 *
 * Feiler den, feiler bare prikkene: kalenderen skal kunne brukes med én gang.
 */
export async function getBusyDays(
  teamSpaceId: string,
  from: Date,
  to: Date,
): Promise<BusyDays> {
  const {data, error} = await supabase
    .from('events')
    .select('start_time, end_time, type')
    .eq('team_space_id', teamSpaceId)
    .is('deleted_at', null)
    .gte('start_time', from.toISOString())
    .lte('start_time', to.toISOString());

  if (error) {
    throw error;
  }

  const days: BusyDays = {};
  const mark = (date: Date, type: EventType) => {
    const key = dayKey(date);
    const existing = days[key];
    if (!existing) {
      days[key] = [type];
    } else if (!existing.includes(type)) {
      // Tre treninger samme dag skal gi én prikk, ikke tre.
      existing.push(type);
    }
  };

  for (const row of (data || []) as any[]) {
    const type = EVENT_TYPE_MAP[row.type as string] ?? 'annet';
    const start = new Date(row.start_time);

    // En turnering opptar HELE perioden sin, ikke bare den første dagen —
    // en cup lørdag til søndag skal gi prikk begge dagene. Kun turneringer:
    // en trening 18–19:30 er ikke «opptatt» to dager selv om den skulle
    // krysse midnatt.
    if (type === 'turnering' && row.end_time) {
      for (const day of eachDay(start, new Date(row.end_time))) {
        mark(day, type);
      }
    } else {
      mark(start, type);
    }
  }
  return days;
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

/**
 * get_session_context (S2) leverer livekamp-raden formet nøyaktig som
 * LIVE_MATCH_COLUMNS over — samme mapper, én kilde. RSVP hentes ikke der
 * heller (banneret viser stilling, ikke oppmøte).
 */
export function mapLiveMatchRow(row: any, teamSpaceId: string): HeiaEvent {
  return mapEventRow(row, teamSpaceId, emptyRsvp());
}

/** Felter `NewEventScreen` samler inn. `opponent`/`isHome` gjelder kun kamp. */
export interface CreateEventInput {
  teamSpaceId: string;
  type: EventType;
  title: string;
  startTime: Date;
  endTime?: Date;
  /** Frivillig oppmøtetid (00053). Må være <= startTime. */
  meetingTime?: Date;
  location?: string;
  description?: string;
  opponent?: string;
  isHome?: boolean;
  /** Turneringen kampen hører til. RPC-en krever da type 'kamp'. */
  parentEventId?: string;
}

/**
 * Oppretter en hendelse via `create_event` (SECURITY DEFINER). RPC-en er
 * nødvendig for at en kamp og dens match_session skal bli til i samme
 * transaksjon — to klient-inserts kunne etterlatt en kamp uten session.
 * Returnerer id-en til den nye hendelsen.
 */
/**
 * KAMPPROGRAMMET — pågående og kommende kamper for laget (skive 10.1).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DEN FINNES VED SIDEN AV `get_season_stats`
 *
 * Sesongsiden viste bare FERDIGSPILTE kamper: RPC-en filtrerer på
 * `ms.status = 'ferdig'` i både totalene og kamplista (00032). Det var
 * riktig så lenge siden var et arkiv — men fra skive 10 fører kampknappen
 * hit, og da forventer man å finne DAGENS kamp (Brage 2026-08-21).
 *
 * Løsningen er en egen, mager spørring og IKKE en endring av RPC-en:
 * sesongtallene er historikk og skal fortsette å telle bare det som er spilt.
 * Å blande «kommende» inn i «vunnet/uavgjort/tapt» ville gjort tallene
 * usanne. To spørsmål, to spørringer.
 *
 * ⚠️ VINDUET STARTER I GÅR. En kamp som fortsatt er live kan ha startet sent
 * i går kveld; med `>= i dag` ville nettopp den kampen — den ene man virkelig
 * leter etter — falt ut.
 *
 * Ferdige og avlyste lukes bort klientside i stedet for i spørringen: en
 * kamp uten `match_sessions`-rad har ingen status å filtrere på, og et
 * `!inner`-filter ville skjult den helt.
 */
export async function getMatchSchedule(
  teamSpaceId: string,
  now: Date = new Date(),
): Promise<HeiaEvent[]> {
  const from = new Date(now);
  from.setDate(from.getDate() - 1);
  from.setHours(0, 0, 0, 0);

  const {data, error} = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('team_space_id', teamSpaceId)
    .eq('type', 'kamp')
    .is('deleted_at', null)
    .gte('start_time', from.toISOString())
    .order('start_time', {ascending: true})
    // Programmet er «det som kommer», ikke hele sesongen. Taket holder
    // spørringen mager og URL-en kort (samme grunn som datovinduet i
    // getTeamEvents).
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data || []) as any[])
    .map(row => mapEventRow(row, teamSpaceId, emptyRsvp()))
    .filter(e => e.matchStatus !== 'finished' && e.matchStatus !== 'cancelled');
}

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
    p_opponent: isMatch ? input.opponent ?? null : null,
    p_is_home: isMatch ? input.isHome ?? true : true,
    p_parent_event_id: input.parentEventId ?? null,
    p_meeting_time: input.meetingTime?.toISOString() ?? null,
  });

  if (error) {
    throw error;
  }

  // B2: med staleTime på event-listene ville en ny hendelse ellers ikke
  // vist seg før neste resync — mutasjonene sier selv fra.
  invalidateEventQueries();
  return (data as any).event_id as string;
}

/**
 * Arrangementet slik redigeringsskjemaet trenger det.
 *
 * Egen, mager spørring i stedet for `getEventDetail`: den går gjennom
 * `get_event_with_rsvp` og teller oppmøte, og den returnerer verken `is_home`,
 * `meeting_time` eller `parent_event_id` — de tre feltene skjemaet må ha for
 * ikke å ødelegge noe det ikke viser. RLS «Members can view events» dekker
 * lesingen; skriveretten vaktes av `update_event`.
 */
export async function getEventForEdit(
  eventId: string,
  teamSpaceId: string,
): Promise<EditableEvent> {
  const {data, error} = await supabase
    .from('events')
    .select(
      `id, type, title, description, location, start_time, end_time,
       meeting_time, parent_event_id,
       match_sessions ( opponent, is_home, status )`,
    )
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Fant ikke hendelsen');
  }

  const row = data as any;
  const session = firstOf<any>(row.match_sessions);

  return {
    id: row.id,
    teamSpaceId,
    type: EVENT_TYPE_MAP[row.type as string] ?? 'annet',
    title: row.title,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    meetingTime: row.meeting_time ? new Date(row.meeting_time) : undefined,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    opponent: session?.opponent ?? undefined,
    isHome: session?.is_home ?? true,
    parentEventId: row.parent_event_id ?? undefined,
    matchStatus: session
      ? MATCH_STATUS_MAP[session.status as string] ?? 'upcoming'
      : undefined,
  };
}

/** Feltene `update_event` erstatter. Se `UpdateEventInput`-kommentaren. */
export interface UpdateEventInput {
  eventId: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  meetingTime?: Date;
  location?: string;
  description?: string;
  /** Kun kamp. RPC-en krever den når arrangementet ER en kamp. */
  opponent?: string;
  isHome?: boolean;
}

/**
 * Retter et arrangement via `update_event` (SECURITY DEFINER, 00057).
 *
 * ⚠️ FULL ERSTATNING, ikke en patch: et utelatt felt BLIR tømt. Det er den
 * eneste tolkningen som lar en trener slette et sted eller en beskjed, og
 * derfor bygger `shared/eventForm.ts` alltid hele nyttelasten — inkludert de
 * to feltene skjemaet ikke viser (`endTime`, `meetingTime`), som arves fra
 * det lagrede arrangementet.
 *
 * Typen og turneringstilknytningen kan ikke endres herfra. Endringsvarselet
 * skrives av triggerne fra 00054, og går ALDRI ut for et arrangement som alt
 * har startet (00057).
 */
export async function updateEvent(input: UpdateEventInput): Promise<void> {
  const {error} = await supabase.rpc('update_event', {
    p_event_id: input.eventId,
    p_title: input.title,
    p_start_time: input.startTime.toISOString(),
    p_end_time: input.endTime?.toISOString() ?? null,
    p_location: input.location ?? null,
    p_description: input.description ?? null,
    p_opponent: input.opponent ?? null,
    p_is_home: input.isHome ?? null,
    p_meeting_time: input.meetingTime?.toISOString() ?? null,
  });

  if (error) {
    throw error;
  }
  invalidateEventQueries(input.eventId);
}

/**
 * Avlyser eller gjenåpner en kamp via `set_match_cancelled` (00057).
 *
 * En avlysning er en STATUSENDRING, ikke en sletting: kampen blir stående i
 * kalenderen med «Avlyst»-pill, så en forelder som husker at det skulle være
 * kamp faktisk finner svaret. En slettet kamp ser ut som en kamp man har
 * husket feil.
 *
 * RPC-en er nødvendig fordi RLS også slipper kampREPORTEREN inn på
 * `match_sessions` (00014) — hun skal rapportere kampen, ikke avlyse den.
 */
export async function setMatchCancelled(
  eventId: string,
  cancelled: boolean,
): Promise<void> {
  const {error} = await supabase.rpc('set_match_cancelled', {
    p_event_id: eventId,
    p_cancelled: cancelled,
  });

  if (error) {
    throw error;
  }
  invalidateEventQueries(eventId);
}

/** En turnering i kampskjemaets velger. */
export interface TournamentOption {
  id: string;
  title: string;
}

/**
 * Aktuelle turneringer til «Turnering»-feltet i kampskjemaet: nylige (siste
 * 60 dager) og kommende. En cup fra i fjor skal ikke stå og støye i skjemaet
 * — historikken bor på sesongsiden.
 */
export async function getTournaments(
  teamSpaceId: string,
): Promise<TournamentOption[]> {
  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const {data, error} = await supabase
    .from('events')
    .select('id, title, start_time')
    .eq('team_space_id', teamSpaceId)
    .eq('type', 'turnering')
    .is('deleted_at', null)
    .gte('start_time', cutoff)
    .order('start_time', {ascending: false});

  if (error) {
    throw error;
  }

  return ((data || []) as any[]).map(row => ({
    id: row.id as string,
    title: row.title as string,
  }));
}

/**
 * Kampene i en turnering, i avsparksrekkefølge (dagens kjøreplan).
 * Direkte select — RLS «members can view» dekker, samme som getTeamEvents.
 * RSVP hentes ikke: man melder seg på turneringsDAGEN, ikke enkeltkamper.
 */
export async function getTournamentMatches(
  tournamentEventId: string,
  teamSpaceId: string,
): Promise<HeiaEvent[]> {
  const {data, error} = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('parent_event_id', tournamentEventId)
    .is('deleted_at', null)
    .order('start_time', {ascending: true});

  if (error) {
    throw error;
  }

  return ((data || []) as any[]).map(row =>
    mapEventRow(row, teamSpaceId, emptyRsvp()),
  );
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
  // RSVP-tallet vises i listeradene på Hjem/Kalender — si fra til cachen.
  invalidateEventQueries(eventId);
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

/** Hva «Korriger mål» faktisk gjør (skive 8, `correct_match_goal` 00075). */
export interface CorrectMatchGoalInput {
  /** `edit` retter målet, `cancel` annullerer det. */
  action: 'edit' | 'cancel';
  /** `home` = oss, `away` = motstander. Kun ved `edit`. */
  teamSide?: 'home' | 'away';
  /** Fri beskrivelse → `match_events.description`. Tom tekst blir NULL. */
  description?: string;
  /**
   * ⚠️ MÅLSCORER ER BEVISST IKKE MED (Brage 2026-08-21).
   *
   * RPC-en har fortsatt parameteren `p_player_name` for kompatibilitet, men
   * KLIENTEN SKAL IKKE EKSPONERE DEN: `report_match_event` har i dag ett
   * fritekstfelt som havner i `description`, så et eget målscorerfelt bare i
   * korrigeringen ville gitt to ulike sannheter om hva en målscorer er.
   * Utsatt til det kan gjøres konsekvent i opprettelse, redigering, feed og
   * historikk.
   *
   * Vi sender derfor alltid `null`, og `00078` gjør at NULL betyr «ikke rør»
   * — en importert målscorer overlever en korrigering.
   */
}

/**
 * KORRIGER ET MÅL — reporterens og lagadmins domenehandling (skive 8).
 *
 * ⚠️ DETTE ER IKKE «REDIGER/SLETT INNLEGG», OG DET ER HELE POENGET.
 * Den generiske sletteveien i feeden er stengt for målposter (00075): den
 * fjernet posten, men lot stillingen, hendelsen og innboksvarselet stå — og
 * brukeren trodde hun hadde angret. Alt som må skje sammen, skjer i RPC-ens
 * ENE transaksjon: hendelsen, stillingen (telt opp på nytt fra
 * målhistorikken), feedens stillingssnapshots, engasjementet, varslene og
 * auditen.
 *
 * ⚠️ INGEN LOKAL PATCHING AV STILLINGEN. Den regnes ut server-side, og
 * halvparten av grunnen til at RPC-en finnes er at klienten ikke skal gjette
 * den. Kalleren refetcher; realtime gjør resten for de andre telefonene.
 */
export async function correctMatchGoal(
  matchEventId: string,
  input: CorrectMatchGoalInput,
): Promise<void> {
  const {error} = await supabase.rpc('correct_match_goal', {
    p_match_event_id: matchEventId,
    p_action: input.action,
    p_team_side: input.teamSide ?? null,
    // ⚠️ ALLTID null — se `CorrectMatchGoalInput`. `00078` tolker NULL som
    // «ikke rør», så en eksisterende målscorer blir stående.
    p_player_name: null,
    p_description: input.description ?? null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Lytter på en pågående kamp. To adskilte callbacks (P6-splitten):
 * `onMatchChange` for stilling/forløp, `onPhotoPost` KUN for nye kampbilder.
 *
 * Splitten er halve realtime-hygienen: `report_match_event` skriver tre
 * tabeller i én transaksjon (match_events + match_sessions + feed-posten),
 * så ett mål ga tre meldinger — og før dette utløste hver av dem BÅDE
 * event-refetch og re-lasting av alle kampbilder (F18). Bare et faktisk
 * bilde (`type = 'bilde'`) rører fotostien.
 *
 * Payload-først (B3, P6): et mål hos N tilskuere er nå N payload-appliseringer
 * og NULL refetch — `matchEvent` bærer selve match_events-raden (append i
 * cachen) og `session` den oppdaterte match_sessions-raden (stillingen ligger
 * komplett i den). `fallback` = payload manglet felter → kalleren refetcher
 * debounced (P6s sikkerhetsnett). `resync` = kanalen har vært nede → full
 * refetch, hendelser kan være tapt. Realtime respekterer RLS, så bare lagets
 * medlemmer får hendelsene.
 *
 * SKIVE 4 la til engasjementet: `reaction` og `commentDelta` justerer tellerne
 * lokalt (ingen refetch), og `engagementPost` sier at et ferskt øyeblikk
 * nettopp fikk sin kanoniske post. Uten det siste ville det NYESTE målet vært
 * det eneste man ikke kunne heie på — og det er nettopp det man vil heie på.
 *
 * Returnerer en oppryddingsfunksjon — kall den når skjermen forlates, ellers
 * blir kanalen liggende åpen.
 */
export type MatchRealtimeEvent =
  | {kind: 'matchEvent'; row: any}
  /**
   * En hendelse ble RETTET (skive 8). Bærer hele den nye raden, så forløpet
   * kan byttes ut på plass uten refetch — stillingen kommer uansett som
   * `session`, siden korrigeringen skriver `match_sessions` i samme
   * transaksjon.
   */
  | {kind: 'matchEventUpdate'; row: any}
  /**
   * En hendelse ble ANNULLERT (skive 8).
   *
   * ⚠️ NÅR OSS KUN FORDI `match_events` HAR REPLICA IDENTITY FULL (00075).
   * Uten den bærer DELETE-payloaden bare PK, filteret `match_session_id`
   * matcher ikke, og Realtime kan ikke RLS-sjekke hendelsen i det hele tatt —
   * tilskueren ville sittet igjen med korrigert stilling i toppen og et
   * annullert mål i forløpet.
   */
  | {kind: 'matchEventDelete'; id: string}
  | {kind: 'session'; row: any}
  | {kind: 'photo'}
  /**
   * HEIA fra en annen tilskuer (skive 4). `userId` følger med i stedet for å
   * filtreres bort her: kanalen deles via `acquireChannel`, så en «hvem er
   * jeg»-verdi fanget i oppsettet ville tilhørt den FØRSTE abonnenten for
   * alltid. Kalleren kjenner alltid sin egen id, og filtrerer eget ekko der.
   */
  | {kind: 'reaction'; postId: string; userId?: string; delta: 1 | -1}
  /** Ny eller soft-slettet kommentar på en post i kampen. */
  | {kind: 'commentDelta'; postId: string; delta: 1 | -1}
  /**
   * En ny post med `match_event_id` — altså et ferskt øyeblikk som nettopp
   * fikk sin kanoniske post. Uten denne ville det nyeste målet stått uten
   * post-id å heie på til neste refetch, og det er nøyaktig det målet folk
   * vil heie på.
   */
  | {kind: 'engagementPost'}
  | {kind: 'fallback'}
  | {kind: 'resync'};

/**
 * S3b-2: transportbryteren. `runtime_config.realtime_transport.match` (lest
 * ved boot/foreground, default 'pgc') velger sti ved SUBSCRIBE-tidspunktet —
 * en flaggflipp virker altså ved neste subscribe, ikke øyeblikkelig for en
 * allerede åpen skjerm (blur/fokus roterer naturlig). Begge stier leverer
 * samme `MatchRealtimeEvent`-union — skjermen kan ikke merke byttet.
 * Fasit for broadcast-dekodingen: docs/S3B2-BROADCAST-DECODE.md.
 */
export function subscribeToMatch(
  matchSessionId: string,
  eventId: string,
  onEvent: (event: MatchRealtimeEvent) => void,
): () => void {
  if (getRuntimeConfig().realtimeTransport.match === 'broadcast') {
    return subscribeToMatchBroadcast(matchSessionId, eventId, onEvent);
  }
  return subscribeToMatchPgc(
    matchSessionId,
    eventId,
    onEvent,
    `match:${matchSessionId}`,
  );
}

/**
 * Dagens postgres_changes-sti — UENDRET oppførsel (dual-run-kontrakten).
 * `topic` er parameter kun fordi nødkanalen fra broadcast-stien må hete
 * `pgc:match:{id}`: bibliotekets `channel(topic)`-dedupe gjør at samme
 * topic aldri kan bære to transporter.
 */
function subscribeToMatchPgc(
  matchSessionId: string,
  eventId: string,
  onEvent: (event: MatchRealtimeEvent) => void,
  topic: string,
): () => void {
  return acquireChannel(
    topic,
    (channel, emit) => {
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'match_events',
            filter: `match_session_id=eq.${matchSessionId}`,
          },
          payload => {
            const row = (payload.new ?? {}) as any;
            // minute kan være 0 (avspark) — sjekk mot undefined, ikke falsy.
            emit(
              row.id && row.type && row.minute !== undefined
                ? {kind: 'matchEvent', row}
                : {kind: 'fallback'},
            );
          },
        )
        // KORRIGERINGEN (skive 8). To egne abonnementer, ikke en utvidelse av
        // INSERT-et over: `matchEvent` APPENDER i cachen, og en rettelse som
        // ble appendet ville gitt målet to ganger i forløpet.
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'match_events',
            filter: `match_session_id=eq.${matchSessionId}`,
          },
          payload => {
            const row = (payload.new ?? {}) as any;
            emit(
              row.id && row.type && row.minute !== undefined
                ? {kind: 'matchEventUpdate', row}
                : {kind: 'fallback'},
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'match_events',
            filter: `match_session_id=eq.${matchSessionId}`,
          },
          payload => {
            // `old` er komplett takket være REPLICA IDENTITY FULL. Er den
            // likevel tom, står serveren uten migrasjonen — da er en refetch
            // det eneste ærlige svaret.
            const row = (payload.old ?? {}) as any;
            emit(
              row.id
                ? {kind: 'matchEventDelete', id: row.id}
                : {kind: 'fallback'},
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'match_sessions',
            filter: `id=eq.${matchSessionId}`,
          },
          payload => {
            const row = (payload.new ?? {}) as any;
            emit(
              row.home_score !== undefined &&
                row.away_score !== undefined &&
                row.status
                ? {kind: 'session', row}
                : {kind: 'fallback'},
            );
          },
        )
        // Kampbilder er feed_posts med event_id (00028) — de rører verken
        // match_events eller match_sessions, så uten denne dukket reporterens
        // bilde først opp hos andre etter en manuell refresh. Målpostene
        // (type match_event/resultat) kommer også hit — de gates bort på
        // type, ellers ville hvert mål re-lastet alle kampbildene.
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feed_posts',
            filter: `event_id=eq.${eventId}`,
          },
          payload => {
            const row = (payload.new ?? {}) as any;
            if (row.type === 'bilde') {
              emit({kind: 'photo'});
            }
            // Posten som bærer øyeblikket. Et bilde festet til et mål har
            // BEGGE deler, og skal derfor treffe begge stiene.
            if (row.match_event_id) {
              emit({kind: 'engagementPost'});
            }
          },
        )
        // ⚠️ UFILTRERT, OG DET ER TRYGT. `reactions` og `comments` har ingen
        // event_id å filtrere på — samme situasjon som feeden (`subscribeToFeed`)
        // løste på samme måte. RLS slipper kun gjennom rader du uansett kunne
        // lest, og en patch for en post som ikke er i kampens oppslag er en
        // no-op.
        //
        // DELETE på reactions krever REPLICA IDENTITY FULL (00059) for at
        // old-raden skal bære feed_post_id — uten den faller vi tilbake.
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'reactions'},
          payload => {
            const p = payload as any;
            const row =
              p.eventType === 'INSERT'
                ? p.new
                : p.eventType === 'DELETE'
                ? p.old
                : null;
            if (!row) return;
            if (!row.feed_post_id) {
              emit({kind: 'fallback'});
              return;
            }
            emit({
              kind: 'reaction',
              postId: row.feed_post_id,
              userId: row.user_id,
              delta: p.eventType === 'INSERT' ? 1 : -1,
            });
          },
        )
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'comments'},
          payload => {
            const p = payload as any;
            // Soft-delete (00041) er en UPDATE med deleted_at satt; en
            // REDIGERING har deleted_at null og skal ikke røre telleren.
            const delta: 1 | -1 | null =
              p.eventType === 'INSERT'
                ? 1
                : p.eventType === 'UPDATE' && p.new?.deleted_at
                ? -1
                : null;
            if (delta === null) return;
            emit(
              p.new?.feed_post_id
                ? {kind: 'commentDelta', postId: p.new.feed_post_id, delta}
                : {kind: 'fallback'},
            );
          },
        );
    },
    payload => {
      if (isChannelResync(payload)) {
        onEvent({kind: 'resync'});
        return;
      }
      // S3b-2-sentinelene tilhører broadcast-stien: pgc-atferden ved første
      // join (ingen emit) og ved join-feil (phoenix' egen rejoin) er uendret.
      if (isChannelReady(payload) || isChannelJoinError(payload)) {
        return;
      }
      onEvent(payload as MatchRealtimeEvent);
    },
  );
}

// Broadcast-eventene 00080-triggerne sender på match:{sessionId} — én
// `.on('broadcast', …)` per navn; dekodetabellen ligger i
// matchBroadcastDecode.ts (fasit: docs/S3B2-BROADCAST-DECODE.md).
const MATCH_BROADCAST_EVENTS = [
  'match_event',
  'session',
  'photo',
  'engagement',
  'reaction',
  'comment',
] as const;

/**
 * Broadcast-stien (S3b-2). Privat kanal (`{private: true}` — join-policyene
 * fra 00080 håndhever medlemskap, bevist i S3b-1), DB-triggerne er eneste
 * avsender. Dekodetilstanden er per registrering; skjermkontrakten er
 * identisk med pgc-stien.
 *
 * Feildisiplin (S3b-1-klassifiseringen, LÅST): CHANNEL_ERROR før første
 * join → én retry med FRISK kanal (race-fiksen garanterer ny), deretter
 * terminal → pgc-nødkanalen under `pgc:match:{id}` + én resync. TIMED_OUT
 * er transient og håndteres av phoenix-rejoin + resync-handleren.
 */
function subscribeToMatchBroadcast(
  matchSessionId: string,
  eventId: string,
  onEvent: (event: MatchRealtimeEvent) => void,
): () => void {
  const state = createMatchDecodeState();
  let joinErrors = 0;
  let downgraded = false;
  let released = false;
  let releaseCurrent: () => void = () => {};

  const listener = (payload: unknown) => {
    if (released) return;
    if (isChannelResync(payload)) {
      onEvent({kind: 'resync'});
      return;
    }
    if (isChannelReady(payload)) {
      // Fallback-emitten som lukker fetch→subscribe-vinduet (§5 i fasiten):
      // skjermens debouncede refetch gir snapshotet ved-eller-etter join.
      onEvent({kind: 'fallback'});
      return;
    }
    if (isChannelJoinError(payload)) {
      handleJoinError();
      return;
    }
    const msg = payload as {event?: unknown; payload?: unknown};
    if (typeof msg?.event !== 'string') return;
    for (const evt of decodeMatchBroadcast(msg.event, msg.payload, state)) {
      onEvent(evt);
    }
  };

  const acquireBroadcast = () =>
    acquireChannel(
      `match:${matchSessionId}`,
      (channel, emit) => {
        for (const name of MATCH_BROADCAST_EVENTS) {
          channel.on('broadcast', {event: name}, message => {
            emit({event: name, payload: (message as any)?.payload});
          });
        }
      },
      listener,
      {config: {private: true}},
    );

  const handleJoinError = () => {
    if (released || downgraded) return;
    joinErrors += 1;
    if (joinErrors === 1) {
      // Retry med frisk kanal. Med flere samtidige lyttere på registreringen
      // blir dette en no-op (kanalen holdes i live av de andre) — da feller
      // neste JOIN_ERROR avgjørelsen i stedet. Se fasiten §7.
      releaseCurrent();
      releaseCurrent = acquireBroadcast();
      return;
    }
    // Terminal nekt: over på dagens transport under EGEN nøkkel, og hent
    // alt friskt — broadcast kan ha mistet hendelser siden join-forsøket.
    downgraded = true;
    releaseCurrent();
    releaseCurrent = subscribeToMatchPgc(
      matchSessionId,
      eventId,
      onEvent,
      `pgc:match:${matchSessionId}`,
    );
    onEvent({kind: 'resync'});
  };

  releaseCurrent = acquireBroadcast();
  return () => {
    released = true;
    releaseCurrent();
  };
}

function mapAttendees(rows: any): EventAttendee[] {
  return ((rows ?? []) as any[]).map(a => ({
    id: a.id,
    name: a.name ?? 'Medlem',
    avatarPath: a.avatar ?? undefined,
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

/**
 * Én `match_events`-rad → MatchEvent. Eksportert for B3: realtime-payloaden
 * er nøyaktig en slik rad, og queries/eventDetail appender den i cachen med
 * SAMME mapping som getEventDetail — én kilde til beskrivelses-/spillerlogikk.
 * `opponent` trengs for tekstene («1–0 til motstanderen»); kalleren har den
 * fra sesjonen eller den cachede detaljen.
 */
export function mapMatchEventRow(
  me: any,
  matchSessionId: string,
  opponent: string,
): MatchEvent {
  const teamSide = (me.team_side as 'home' | 'away' | null) ?? undefined;
  const {description, player} = describeMatchEvent(
    me.type as MatchEventType,
    teamSide,
    me.description ?? undefined,
    opponent,
  );

  return {
    id: me.id,
    matchId: matchSessionId,
    type: me.type as MatchEventType,
    minute: me.minute,
    player: me.player_name ?? player,
    // ⚠️ Kun når `player_name` finnes er de to feltene GARANTERT forskjellige
    // ting (skive 8 skrev dem fra hverandre). På en eldre målrad ligger
    // scoreren i `description`, og den er alt vist som `player` over —
    // uten dette vilkåret ville navnet stått to ganger på raden.
    note: me.player_name ? me.description ?? undefined : undefined,
    // Kolonnen rå — se `MatchEvent.descriptionRaw` for hvorfor den ikke er
    // den samme som `note`.
    descriptionRaw: me.description ?? undefined,
    description,
    teamSide,
    reportedBy: me.reported_by ?? undefined,
    // ⚠️ 00074. Uten denne hadde pulsen aldri hendelsens EGET tidspunkt og
    // måtte gjette seg til posisjonen fra `minute` — som etter 00073 er
    // spilt tid, altså en annen akse enn resten av kurven. Se
    // `stampOf` i src/shared/matchPulse.ts.
    createdAt: me.created_at ? new Date(me.created_at) : undefined,
  };
}

function mapMatchEvents(session: any): MatchEvent[] {
  const opponent = (session.opponent as string) ?? 'motstanderen';

  return ((session.match_events ?? []) as any[]).map(me =>
    mapMatchEventRow(me, session.id, opponent),
  );
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
