import {supabase} from '../supabase';
import {mapNotificationRow} from '../../shared/inbox';

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

/** Egne varsler for det aktive laget, nyeste først. */
export async function getNotifications(
  teamSpaceId: string,
  limit = 50,
): Promise<HeiaNotification[]> {
  const {data, error} = await supabase
    .from('notifications')
    .select(
      'id, category, title, body, data, read_at, created_at, team_space_id',
    )
    .or(scopeToTeam(teamSpaceId))
    .order('created_at', {ascending: false})
    .limit(limit);

  if (error) {
    throw error;
  }
  return (data || []).map(mapNotificationRow);
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
