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
  const net = networkKind(e);
  if (net === 'timeout') {
    return 'Nettet svarte ikke. Prøv igjen når du har bedre dekning.';
  }
  if (net === 'offline') {
    return 'Ingen kontakt med Heia. Sjekk nettet, og prøv igjen.';
  }
  const msg = (e as {message?: unknown} | null | undefined)?.message;
  return typeof msg === 'string' && msg.trim().length > 0 ? msg : fallback;
}

/**
 * NETTVERKSFEIL SKAL SI HVA DU KAN GJØRE (punkt 40).
 *
 * Uten dette fikk brukeren rå transportprat: «TypeError: Network request
 * failed», eller — etter at tidsgrensa kom på plass — «Error: heia/timeout».
 * Begge er sanne og begge er ubrukelige; de sier ingenting om hva som er
 * galt eller hva man skal gjøre nå.
 *
 * ⚠️ GJENKJENNES PÅ TEKST, og det er et bevisst valg. supabase-js pakker
 * feilen inn på vei opp (`${navn}: ${melding}`), og PostgrestError er ikke
 * engang en `Error`-instans — se toppen av fila. Teksten er det eneste som
 * overlever alle tre lagene (postgrest, storage, gotrue, functions).
 */
type NetworkKind = 'timeout' | 'offline' | null;

function networkKind(e: unknown): NetworkKind {
  const raw = (e as {message?: unknown} | null | undefined)?.message;
  if (typeof raw !== 'string') {
    return null;
  }
  // Merket vår egen tidsgrense setter (`lib/netMetrics`).
  if (raw.includes('heia/timeout')) {
    return 'timeout';
  }
  // RN-fetch ved ingen dekning/DNS; nettleserens variant tas med for web.
  if (
    raw.includes('Network request failed') ||
    raw.includes('Failed to fetch') ||
    raw.includes('heia/offline')
  ) {
    return 'offline';
  }
  return null;
}

/**
 * Var dette nettet, og ikke oss? Kallsteder som SKRIVER bruker den til å si
 * noe annet enn «det feilet»: ved et tidsavbrudd vet vi faktisk ikke om
 * serveren rakk å fullføre — se `uncertainWriteMessage`.
 */
export function isNetworkError(e: unknown): boolean {
  return networkKind(e) !== null;
}

/**
 * SKRIVEHANDLINGER SOM IKKE FIKK SVAR (punkt 40).
 *
 * ⚠️ «Det gikk ikke» er en PÅSTAND VI IKKE HAR DEKNING FOR. Et tidsavbrudd
 * betyr at vi ikke fikk svaret — ikke at serveren ikke gjorde jobben. Sier
 * flaten «feilet» og brukeren trykker igjen, er det slik man får to mål på
 * stillingen eller to like innlegg i feeden.
 *
 * `action` er handlingen i ubestemt form, slik den leses i setningen:
 * «Vi vet ikke om MÅLET ble registrert.»
 */
export function uncertainWriteMessage(e: unknown, action: string): string {
  if (networkKind(e) === 'timeout') {
    return `Nettet svarte ikke i tide. Vi vet ikke om ${action} ble lagret — sjekk før du prøver på nytt.`;
  }
  return errorMessage(e);
}
