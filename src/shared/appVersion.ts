/**
 * Versjonsstrengen slik den står i «Om Heia».
 *
 * Ren funksjon med vilje: selve LESINGEN av versjonen er native (se
 * `src/lib/appVersion.ts`), men formen på strengen er den eneste delen som
 * kan gå feil på en måte en test kan fange.
 *
 * Formen er «Versjon 1.0 (3)» — markedsføringsversjonen er det brukeren
 * kjenner igjen, byggnummeret i parentes er det en TestFlight-tester faktisk
 * må oppgi når hun melder en feil. To TestFlight-bygg deler ofte samme
 * versjon og skilles KUN på byggnummeret.
 *
 * ⚠️ Uten versjon returneres `null`, ALDRI en gjettet verdi. Raden sto i to
 * år med hardkodet «v0.1.0» mens bygget sa noe annet — et tall vi ikke har
 * lest fra bundelen er verre enn ingen undertekst i det hele tatt.
 */
export interface NativeRelease {
  /** CFBundleShortVersionString — «1.0» */
  version?: string | null;
  /** CFBundleVersion — «3» */
  build?: string | null;
}

export function formatAppVersion(release: NativeRelease | null): string | null {
  const version = release?.version?.trim();
  if (!version) return null;

  const build = release?.build?.trim();
  // Byggnummeret er valgfritt: mangler det, er versjonen alene fortsatt
  // sann — og sannhet er hele poenget med denne raden.
  return build ? `Versjon ${version} (${build})` : `Versjon ${version}`;
}
