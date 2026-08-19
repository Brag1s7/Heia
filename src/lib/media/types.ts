/**
 * MediaRef — path-kontrakten (P4/P12, LÅST): UI-et refererer media som
 * path + ønsket variant, ALDRI som leverandør-URL. Signering, token-utløp,
 * CDN og leverandør er resolverens sak — bytte av lagringsleverandør skal
 * være én ny resolver.ts, ikke en jakt gjennom skjermene.
 */
export interface MediaRef {
  /**
   * Objektets sti i bucketen. `feed-media`: `{team_space_id}/{filnavn}`.
   * `avatars`: `{user_id}/avatar-{ms}.jpg`.
   */
  path: string;
  /**
   * 480px-varianten (media.thumbnail_path). Skrives av backfill-scriptet i A
   * og av opplastingen fra B — null/undefined betyr «finnes ikke ennå», og
   * `thumb`-oppslaget faller da tilbake til `path`.
   */
  thumbPath?: string | null;
  /**
   * Bucketen path-en bor i. Utelatt = `feed-media` (alt som fantes før
   * profilbilde-skiva). Feltet er valgfritt MED VILJE: kallstedene for
   * feed/kamp/galleri er uendret, og en ref uten bucket kan aldri havne i
   * feil bucket ved et uhell.
   */
  bucket?: string;
}

/**
 * `display` = 2048-masteren (P2). `thumb` = 480-varianten med fallback til
 * `path`. `full` finnes bevisst IKKE: display ER master — ingen
 * kameraoriginal lagres hos Heia for nye opplastinger.
 *
 * Profilbilder har KUN én variant (256 px, se media.ts): begge verdiene
 * peker da på samme path, og `thumb` er default fra `Avatar`.
 */
export type MediaVariant = 'thumb' | 'display';

/** Stien en variant faktisk leses fra. */
export function mediaPathFor(ref: MediaRef, variant: MediaVariant): string {
  return variant === 'thumb' ? ref.thumbPath ?? ref.path : ref.path;
}
