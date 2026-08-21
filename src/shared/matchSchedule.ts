import type {HeiaEvent} from './types';

/**
 * KAMPPROGRAMMET, SORTERT SLIK EN TRENER LESER DET (skive 10.1).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR DET ER EN REN FUNKSJON OG IKKE EN `.sort()` I SKJERMEN
 *
 * Brage, etter telefontesten: «dagens kamp tydelig prioritert». Det er en
 * PRIORITERINGSREGEL, ikke en sortering — og den har tre nivåer som lett
 * kan bli feil hver for seg:
 *
 *   1. En PÅGÅENDE kamp slår alt. Den er grunnen til at man åpnet siden.
 *      Pause teller med: kampen er ikke over, klokka står bare stille.
 *   2. DAGENS kamper kommer deretter, tidligst først.
 *   3. Resten er «kommende», tidligst først.
 *
 * En kamp som pågår KAN ha startet i går (sen kveldskamp, lang turnering),
 * og da hører den fortsatt til i toppen — ikke under «i går».
 */

export interface MatchScheduleSections {
  /** Pågående nå — live eller pause. Nyeste avspark først. */
  live: HeiaEvent[];
  /** I dag, men ikke i gang ennå. */
  today: HeiaEvent[];
  /** Senere. */
  upcoming: HeiaEvent[];
}

/** Samme dag i LOKAL tid — ikke UTC, som ville flyttet kvelden en dag fram. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isUnderway(event: HeiaEvent): boolean {
  return event.matchStatus === 'live' || event.matchStatus === 'halfTime';
}

export function buildMatchSchedule(
  matches: readonly HeiaEvent[],
  now: Date = new Date(),
): MatchScheduleSections {
  const live: HeiaEvent[] = [];
  const today: HeiaEvent[] = [];
  const upcoming: HeiaEvent[] = [];

  for (const m of matches) {
    if (isUnderway(m)) {
      live.push(m);
      continue;
    }
    // ⚠️ En kamp som IKKE er i gang og som lå i går, er ikke «kommende».
    // Den er enten glemt eller avlyst uten at noen sa fra, og den skal ikke
    // legge seg øverst i programmet som om den var neste kamp.
    if (m.startTime < now && !sameDay(m.startTime, now)) {
      continue;
    }
    (sameDay(m.startTime, now) ? today : upcoming).push(m);
  }

  // Nyeste avspark først blant de pågående — samme regel som `getLiveMatch`
  // bruker når den må velge én.
  live.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  today.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {live, today, upcoming};
}
