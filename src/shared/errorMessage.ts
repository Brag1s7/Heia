/**
 * Feilmeldingen slik brukeren skal se den.
 *
 * FUNNET I A3-DOGFOODEN (2026-08-19): siste-aktive-vernet avviste fjerningen
 * med en presis, håndskrevet beskjed fra databasen — «Kan ikke fjerne den
 * siste aktive betalingsansvarlige — suspender kontoen eller få en erstatter
 * på plass først.» Brukeren fikk «Handlingen feilet. Prøv igjen om litt.»
 *
 * Årsaken: `supabase.rpc()` gir en PostgrestError, som er et VANLIG OBJEKT —
 * ikke en `Error`-instans. Mønsteret `e instanceof Error ? e.message : ...`
 * traff derfor aldri, og hver eneste vaktmelding i betalings- og ops-flatene
 * ble byttet ut med et råd som umulig kan virke: vernet er permanent, så
 * «prøv igjen om litt» er feil uansett hvor lenge du venter.
 *
 * Meldingene ER skrevet for å bli lest — de forteller hva du skal gjøre i
 * stedet. Denne funksjonen er det eneste stedet som avgjør om de kommer frem.
 */
export function errorMessage(
  e: unknown,
  fallback = 'Prøv igjen om litt.',
): string {
  const msg = (e as {message?: unknown} | null | undefined)?.message;
  return typeof msg === 'string' && msg.trim().length > 0 ? msg : fallback;
}
