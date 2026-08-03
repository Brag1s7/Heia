// ---------------------------------------------------------------------------
// Brønnøysundregistrene — åpent API, ingen nøkkel. Brukes av
// SupportSetupScreen til å stoppe ugyldige organisasjonsnumre FØR de blir
// en ops-sak (Brages beslutning 2026-08-03), og til å hente registerets
// juridiske navn som autoritativ verdi i søknaden.
//
// Nettverksfeil er ALDRI blokkerende (fail-open): da sendes søknaden som
// før, og den manuelle reviewen — med claim-notify-bevisene — fanger det.
// ---------------------------------------------------------------------------

export type BrregLookup =
  | {
      status: 'found';
      navn: string;
      orgformKode: string;
      /** Slettet/konkurs/under avvikling — skal blokkere innsending. */
      inactive: boolean;
      inactiveReason: string | null;
    }
  | {status: 'not_found'}
  | {status: 'unreachable'};

export async function lookupBrregEnhet(orgNumber: string): Promise<BrregLookup> {
  const org = orgNumber.replace(/[^0-9]/g, '');
  if (org.length !== 9) return {status: 'not_found'};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${org}`,
      {signal: controller.signal, headers: {Accept: 'application/json'}},
    );
    clearTimeout(timeout);

    if (res.status === 404) return {status: 'not_found'};
    if (!res.ok) return {status: 'unreachable'};

    const enhet = await res.json();
    const reason = enhet.slettedato
      ? `slettet ${enhet.slettedato}`
      : enhet.konkurs
        ? 'registrert konkurs'
        : enhet.underAvvikling
          ? 'under avvikling'
          : null;
    return {
      status: 'found',
      navn: String(enhet.navn ?? ''),
      orgformKode: String(enhet.organisasjonsform?.kode ?? '?'),
      inactive: reason !== null,
      inactiveReason: reason,
    };
  } catch {
    return {status: 'unreachable'};
  }
}
