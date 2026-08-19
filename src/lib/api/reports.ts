import {supabase} from '../supabase';

/** Årsakene `report_content` (00041) godtar — holdes i synk med CHECK-en. */
export type ReportReason = 'upassende' | 'trakassering' | 'annet';

/**
 * Innholdstypene som kan rapporteres. `avatar` kom med profilbilde-skiva
 * (00068): et profilbilde er UGC, og en person kan ha et upassende bilde
 * uten noen gang å poste — uten denne veien fantes det da ingen vei til
 * Heia i det hele tatt. `entity_id` er da PROFILEN bildet hører til.
 */
export type ReportableEntity = 'feed_post' | 'comment' | 'avatar';

/**
 * Rapporterer innhold til Heia (Apple 1.2 — UGC-krav). Rapporten lander i
 * `content_reports`, som klienten aldri kan lese — saksbehandlingen er
 * manuell hos Heia (service role), som klubb-claimene.
 *
 * RPC-en er idempotent: å rapportere det samme to ganger gir fortsatt bare
 * én åpen sak, og begge kallene lykkes.
 */
export async function reportContent(
  entityType: ReportableEntity,
  entityId: string,
  reason: ReportReason,
): Promise<void> {
  const {error} = await supabase.rpc('report_content', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_reason: reason,
  });
  if (error) {
    throw error;
  }
}
