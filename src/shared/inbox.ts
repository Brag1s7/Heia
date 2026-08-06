// ---------------------------------------------------------------------------
// Innboksens RENE logikk: hvordan en varselrad fra basen tolkes, og hvordan
// varsler samles til oppføringer.
//
// Ligger utenfor `lib/api/notifications` med vilje: der bor nettverkskallene,
// og den modulen kan ikke lastes uten en Supabase-klient. Her er alt rene
// funksjoner, så grupperingen kan kjøres og VERIFISERES uten app, uten
// simulator og uten å røre produksjonsdata.
//
// Regelen som gjør Varsler til «lagets puls»: alt som deler
// `match.sessionId` er ÉN kamp. Kampen beveger seg kommende → live →
// ferdig; den blir aldri flere kort.
// ---------------------------------------------------------------------------

/**
 * Kamphendelsen bak et `match_live`-varsel (00051).
 *
 * ⚠️ MÅ speile CHECK-en på `match_events.type` (00009) FULLSTENDIG. Lista
 * under er filteret som avgjør om et varsel får kampkontekst — mangler en
 * type, faller den hendelsen ut av grupperingen og blir en løs rad. Det
 * skjedde med `avspark` og `andre_omgang`: «Kampen er i gang» og «Andre
 * omgang» ble stående alene ved siden av sin egen kamp.
 */
export type MatchEventType =
  | 'avspark'
  | 'mål'
  | 'pause'
  | 'andre_omgang'
  | 'slutt'
  | 'bytte'
  | 'kort'
  | 'melding';

export const MATCH_EVENT_TYPES: MatchEventType[] = [
  'avspark',
  'mål',
  'pause',
  'andre_omgang',
  'slutt',
  'bytte',
  'kort',
  'melding',
];

/** Speiler CHECK-en på `notifications.category` (00011, utvidet i 00024). */
export type NotificationCategory =
  | 'event_reminder'
  | 'rsvp_update'
  | 'match_live'
  | 'new_post'
  | 'new_comment'
  | 'new_reaction'
  | 'admin_message'
  | 'system';

/**
 * Kampkonteksten på et `match_live`-varsel (00051).
 *
 * `homeScore`/`awayScore` er «oss/dem» uavhengig av hjemmebane — samme
 * konvensjon som ScoreBoard og feeden. `teamSide` sier hvem som scoret.
 */
export interface NotificationMatch {
  sessionId: string;
  eventType: MatchEventType;
  minute: number | null;
  teamSide: 'home' | 'away' | null;
  homeScore: number;
  awayScore: number;
  opponent: string | null;
}

/** Mennesket bak et varsel (00051) — kommentar, 👏 eller trenerbeskjed. */
export interface NotificationActor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface HeiaNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  /** Deep-link-mål. Stemplet i `data` av push-fanout. */
  feedPostId?: string;
  eventId?: string;
  teamSpaceId?: string;
  /** Klubbdør-varsler (00047) peker på en skjerm i Profil-stacken. */
  targetScreen?: 'club_payments' | 'support_setup';
  /** Satt fra 00051 på kampvarsler. Mangler på eldre rader. */
  match?: NotificationMatch;
  /** Satt fra 00051 der handlingen kom fra en person. Mangler på eldre rader. */
  actor?: NotificationActor;
}

/**
 * Kampkontekst fra `data` (00051). Returnerer undefined for alt som er
 * skrevet FØR migrasjonen — da faller varselet tilbake til den rolige
 * raden i stedet for å rendre et halvt kampkort.
 */
export function mapMatch(
  data: Record<string, any>,
): NotificationMatch | undefined {
  const sessionId = data.match_session_id;
  const eventType = data.match_event_type;
  if (typeof sessionId !== 'string' || !MATCH_EVENT_TYPES.includes(eventType)) {
    return undefined;
  }
  return {
    sessionId,
    eventType,
    minute: typeof data.minute === 'number' ? data.minute : null,
    teamSide:
      data.team_side === 'home' || data.team_side === 'away'
        ? data.team_side
        : null,
    homeScore: typeof data.home_score === 'number' ? data.home_score : 0,
    awayScore: typeof data.away_score === 'number' ? data.away_score : 0,
    opponent: typeof data.opponent === 'string' ? data.opponent : null,
  };
}

/** Mennesket bak varselet (00051). Uten navn er det ingen person å vise. */
export function mapActor(
  data: Record<string, any>,
): NotificationActor | undefined {
  if (typeof data.actor_id !== 'string' || typeof data.actor_name !== 'string') {
    return undefined;
  }
  return {
    id: data.actor_id,
    name: data.actor_name,
    avatarUrl:
      typeof data.actor_avatar === 'string' ? data.actor_avatar : undefined,
  };
}

/** Én rå rad fra `notifications` → appens modell. */
export function mapNotificationRow(row: any): HeiaNotification {
  const data = (row.data ?? {}) as Record<string, any>;
  return {
    id: row.id,
    category: row.category as NotificationCategory,
    title: row.title,
    body: row.body,
    createdAt: new Date(row.created_at),
    readAt: row.read_at ? new Date(row.read_at) : null,
    feedPostId: data.feed_post_id ?? undefined,
    eventId: data.event_id ?? undefined,
    teamSpaceId: row.team_space_id ?? undefined,
    targetScreen:
      data.screen === 'club_payments' || data.screen === 'support_setup'
        ? data.screen
        : undefined,
    match: mapMatch(data),
    actor: mapActor(data),
  };
}

/**
 * Én oppføring i lista. Kampvarsler kollapser til ETT kamp-objekt; alt
 * annet er en rolig rad.
 */
export type Entry =
  | {kind: 'match'; key: string; sessionId: string; items: HeiaNotification[]}
  | {kind: 'row'; key: string; item: HeiaNotification};

export function newestAt(entry: Entry): number {
  return entry.kind === 'match'
    ? entry.items[0].createdAt.getTime()
    : entry.item.createdAt.getTime();
}

/**
 * Grupperer varslene: alt som deler `match.sessionId` blir én oppføring.
 * Kampvarsler UTEN kontekst (skrevet før 00051) faller gjennom som vanlige
 * rader — de har ingen stilling å vise.
 */
export function buildEntries(items: HeiaNotification[]): Entry[] {
  const matches = new Map<string, HeiaNotification[]>();
  const entries: Entry[] = [];

  for (const item of items) {
    const sessionId = item.match?.sessionId;
    if (sessionId) {
      const bucket = matches.get(sessionId);
      if (bucket) {
        bucket.push(item);
      } else {
        matches.set(sessionId, [item]);
      }
    } else {
      entries.push({kind: 'row', key: item.id, item});
    }
  }

  for (const [sessionId, group] of matches) {
    entries.push({
      kind: 'match',
      key: `match-${sessionId}`,
      sessionId,
      items: group,
    });
  }

  // Serveren leverer nyest først; grupperingen kan ha stokket om.
  return entries.sort((a, b) => newestAt(b) - newestAt(a));
}

const HOUR_MS = 3_600_000;

/**
 * «Nå / I dag / Tidligere» — ren lesehjelp. «Nå» er siste time, altså det
 * som faktisk har skjedd siden du sist så på telefonen.
 */
export function groupByAge(
  entries: Entry[],
  now: number = Date.now(),
): {label: string; entries: Entry[]}[] {
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();

  const labelFor = (t: number): string => {
    if (t >= now - HOUR_MS) return 'Nå';
    if (t >= startOfToday) return 'I dag';
    return 'Tidligere';
  };

  const sections: {label: string; entries: Entry[]}[] = [];
  for (const entry of entries) {
    const label = labelFor(newestAt(entry));
    const last = sections[sections.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      sections.push({label, entries: [entry]});
    }
  }
  return sections;
}
