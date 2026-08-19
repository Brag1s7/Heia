/**
 * Profilbilde-siden av mediepipelinen (00068).
 *
 * Hele modulen finnes for å holde ÉN ting sant overalt: en avatar er en
 * `MediaRef` mot den private `avatars`-bucketen, aldri en URL. `avatarRef`
 * er derfor den eneste veien fra `profiles.avatar_url` (som bærer en PATH,
 * se COMMENT-en i 00068) til noe UI-et kan tegne.
 */
import {uploadFileToBucket} from './upload';
import {
  AVATARS_BUCKET,
  invalidateMediaCache,
  primeMediaUrls,
} from './resolver';
import {supabase} from '../supabase';
import type {MediaRef} from './types';
import type {PickedImage} from '../media';

/**
 * `profiles.avatar_url`-verdien → MediaRef. `null`/tom = ingen bilde, og
 * `Avatar` viser initialer.
 *
 * Profilbilder har KUN én variant (256 px — se AVATAR_PICKER_OPTIONS), så
 * `thumbPath` settes bevisst ikke: `mediaPathFor` faller da tilbake til
 * `path` for begge variantene, og en fremtidig thumb kan legges til uten å
 * røre et eneste kallsted.
 */
export function avatarRef(path?: string | null): MediaRef | null {
  return path ? {path, bucket: AVATARS_BUCKET} : null;
}

/** Samler avatar-paths fra en liste og varmer dem i ÉN signeringsbatch. */
export async function primeAvatars(
  paths: (string | null | undefined)[],
): Promise<void> {
  const clean = paths.filter((p): p is string => !!p);
  if (clean.length === 0) return;
  await primeMediaUrls(clean, AVATARS_BUCKET);
}

/**
 * Laster opp et nytt profilbilde og returnerer path-en. Skriver IKKE til
 * profiles — kalleren gjør det (updateProfile), slik at en feilet
 * DB-skriving ikke etterlater seg en halvferdig tilstand i UI-et.
 *
 * Path: `{user_id}/avatar-{ms}.jpg`. Første segment er det storage-
 * policyene gates på (00068), og nytt filnavn per opplasting gjør at
 * `x-upsert: false` aldri kan overskrive — den forrige fila blir entydig
 * død og slettes av kalleren.
 *
 * cacheControl 1 år: path-en er immutabel, så innholdet på den kan aldri
 * endre seg. Samme resonnement som club-logos (P1) — men bucketen er
 * privat, så cachen som gjør jobben er enhetens egen (expo-image, nøklet
 * på bucket+path), ikke en CDN.
 */
export async function uploadAvatar(
  userId: string,
  image: PickedImage,
): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  await uploadFileToBucket({
    bucket: AVATARS_BUCKET,
    path,
    fileUri: image.fileUri,
    contentType: image.mimeType,
    cacheControlS: 31536000,
  });
  return path;
}

/**
 * Rydder bort en avatar-fil som ikke lenger er referert — ved bytte og ved
 * fjerning. Best-effort, som `updateTeamLogo` og `deletePost`: fasiten er
 * `profiles.avatar_url`, og er den nullet/byttet er bildet borte fra alle
 * levende flater uansett. Feiler slettingen, blir fila liggende ubrukt.
 *
 * Signert-URL-cachen invalideres først — ellers ville en fersk URL til et
 * nettopp slettet objekt blitt liggende i AsyncStorage i inntil 24 t og
 * gitt 404 i stedet for initialer.
 */
export async function deleteAvatarFile(path: string): Promise<void> {
  invalidateMediaCache([path], AVATARS_BUCKET);
  try {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  } catch {
    // Ubrukt fil er ikke en feil brukeren skal se.
  }
}
