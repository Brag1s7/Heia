import {supabase} from '../supabase';
import {mapNotificationRow} from '../../shared/inbox';
import {primeAvatars} from '../media/avatar';
// ⚠️ Egen import, i tillegg til re-eksporten under. `export type {…} from`
// er en REN videresending: den binder ingen navn lokalt, så typen kunne ikke
// brukes som returtype her uten denne linja.
import type {HeiaNotification} from '../../shared/inbox';

/**
 * Inbox — leser `notifications`-tabellen (00011) direkte.
 *
 * Ingen RPC trengs: RLS (00014) gir «Users view own notifications» (SELECT)
 * og «Users mark own notifications read» (UPDATE), så hver spørring her er
 * automatisk avgrenset til innlogget bruker. Radene skrives av Edge Function
 * `push-fanout` — én rad per mottaker per feed-post.
 *
 * MODELLEN OG GRUPPERINGEN bor i `shared/inbox` — rene funksjoner uten
 * Supabase-klient, så de kan verifiseres uten app og uten simulator.
 * Typene re-eksporteres her fordi skjermene alltid har hentet dem herfra.
 */
export type {
  MatchEventType,
  NotificationCategory,
  NotificationMatch,
  NotificationActor,
  HeiaNotification,
} from '../../shared/inbox';

// Lag-varsler + eventuelle globale (team_space_id null, f.eks. 'system').
// Uten null-grenen ville en systemmelding aldri dukket opp i inboxen.
function scopeToTeam(teamSpaceId: string): string {
  return `team_space_id.eq.${teamSpaceId},team_space_id.is.null`;
}

export interface GetNotificationsOpts {
  limit?: number;
  /** Keyset bakover: kun rader ELDRE enn dette (paginering på scroll). */
  before?: Date;
  /** Keyset fremover: kun rader NYERE enn dette (inkrementell resync, B2). */
  after?: Date;
}

/**
 * Egne varsler for det aktive laget, nyeste først.
 *
 * `before`/`after` er rene klient-filtre på `created_at` — ingen RPC trengs,
 * og indeksen idx_notifications_user_all (00013: user_id, created_at DESC)
 * dekker begge. Strikt `<`/`>` betyr at rader med identisk timestamp på en
 * sidegrense kan hoppes over (triggere skriver flere rader i samme
 * transaksjon) — flettingen deduper på id, og neste fulle last rydder opp.
 * Merk at team-scopet (inkl. null-grenen for systemvarsler) alltid står PÅ
 * begge filtrene — de kombineres med AND av PostgREST.
 */
export async function getNotifications(
  teamSpaceId: string,
  {limit = 50, before, after}: GetNotificationsOpts = {},
): Promise<HeiaNotification[]> {
  let query = supabase
    .from('notifications')
    .select(
      'id, category, title, body, data, read_at, created_at, team_space_id',
    )
    .or(scopeToTeam(teamSpaceId));
  if (before) {
    query = query.lt('created_at', before.toISOString());
  }
  if (after) {
    query = query.gt('created_at', after.toISOString());
  }
  const {data, error} = await query
    .order('created_at', {ascending: false})
    .limit(limit);

  if (error) {
    throw error;
  }
  const items = (data || []).map(mapNotificationRow);
  // Varsel-lista tegner ett ansikt per rad (00051). Én signeringsbatch for
  // hele siden — samme regel som feeden og lagoversikten (P1).
  await primeAvatars(items.map(n => n.actor?.avatarPath));
  return items;
}

/** Antall uleste — driver badgen på Varsler-fanen. */
export async function getUnreadCount(teamSpaceId: string): Promise<number> {
  const {count, error} = await supabase
    .from('notifications')
    .select('id', {count: 'exact', head: true})
    .or(scopeToTeam(teamSpaceId))
    .is('read_at', null);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

/**
 * Marker som lest. `.is('read_at', null)` gjør kallet idempotent —
 * et nytt trykk på en alt lest rad flytter ikke tidspunktet.
 */
export async function markAsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const {error} = await supabase
    .from('notifications')
    .update({read_at: new Date().toISOString()})
    .in('id', ids)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}

/** «Merk alle som lest» — uten den kan badgen bli stående for alltid. */
export async function markAllAsRead(teamSpaceId: string): Promise<void> {
  const {error} = await supabase
    .from('notifications')
    .update({read_at: new Date().toISOString()})
    .or(scopeToTeam(teamSpaceId))
    .is('read_at', null);

  if (error) {
    throw error;
  }
}
