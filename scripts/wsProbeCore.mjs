/**
 * Ren probelogikk for `verify-s3b-ws.mjs` — skilt ut hit så den kan
 * jest-testes uten nettverk (`__tests__/wsProbeCore.test.js`).
 *
 * Reglene her er Brages presiseringer til S3b-1 (2026-08-30):
 *   1. En TIMED_OUT er ALDRI en grønn sikkerhetsnekt. Kun en eksplisitt
 *      policyavvisning (CHANNEL_ERROR med reason) teller som NEKT; alt
 *      annet uten SUBSCRIBED er UAVKLART og feiler kjøringen.
 *   2. Negativene beviser bare noe når positivene er grønne I SAMME
 *      KJØRING — ellers kan «nekt» skyldes feil årsak (manglende
 *      innlogging, nede-tjeneste). `applyPositiveGate` håndhever det.
 *   3. Ingen produksjonsdata i utskrift: `maskUuids` kjøres på alt som
 *      skal ut, også server-reasons som ekkoer topicet.
 */

const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

export function maskUuids(text) {
  return String(text ?? '').replace(UUID_RE, '<uuid>');
}

/**
 * Ett subscribe-forsøk → delresultat. `reason` maskeres allerede her, så
 * ingen senere sti kan lekke en umaskert variant.
 */
export function classifyAttempt(status, reason) {
  if (status === 'SUBSCRIBED') {
    return {kind: 'ok', reason: null};
  }
  if (status === 'CHANNEL_ERROR' && reason) {
    return {kind: 'denied', reason: maskUuids(reason)};
  }
  // TIMED_OUT, CLOSED og CHANNEL_ERROR uten reason: uavklart — kandidat
  // for retry, aldri for grønn nekt.
  return {kind: 'inconclusive', reason: reason ? maskUuids(reason) : status};
}

/**
 * Kombiner forsøkene for én probe. En vellykket join DOMINERER alltid:
 * for en nekt-probe er den et sikkerhetsbrudd uansett hva andre forsøk
 * sa, og et brudd skal aldri maskeres av en senere timeout.
 */
export function combineAttempts(attempts) {
  if (attempts.some(a => a.kind === 'ok')) {
    return {outcome: 'OK', reason: null};
  }
  const denied = attempts.find(a => a.kind === 'denied');
  if (denied) {
    return {outcome: 'NEKT', reason: denied.reason};
  }
  return {
    outcome: 'UAVKLART',
    reason: attempts.map(a => a.reason).join(' | '),
  };
}

/** UAVKLART er ⚠️ uansett forventning — aldri grønn, aldri «bevist rød». */
export function evaluateProbe(expected, outcome) {
  if (outcome === 'UAVKLART') {
    return '⚠️';
  }
  if (expected === 'allow') {
    return outcome === 'OK' ? '✅' : '❌';
  }
  return outcome === 'NEKT' ? '✅' : '❌';
}

/**
 * Positiv-gaten: feiler én positiv probe, nedgraderes hver grønn nekt til
 * ⚠️ «ugyldig» — de kan ha bestått av feil årsak.
 */
export function applyPositiveGate(results) {
  const positivesGreen = results
    .filter(r => r.expected === 'allow')
    .every(r => r.mark === '✅');
  if (positivesGreen) {
    return results;
  }
  return results.map(r =>
    r.expected === 'deny' && r.mark === '✅'
      ? {
          ...r,
          mark: '⚠️',
          note: 'ugyldig — positiv kontroll feilet i samme kjøring',
        }
      : r,
  );
}

export function summarize(results) {
  const green = results.filter(r => r.mark === '✅').length;
  return {
    green,
    total: results.length,
    exitCode: green === results.length ? 0 : 1,
  };
}
