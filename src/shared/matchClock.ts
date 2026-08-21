/**
 * KAMPURET — ÉN utregning, delt av alt som viser kampminuttet.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ P2, LÅST: HEIA VISER FAKTISK SPILT TID.
 *
 * Klokka starter ved avspark, FRYSES i pause, og andre omgang fortsetter fra
 * minuttet første omgang sluttet. Ingen normert 45/35/30/25-modell, ingen
 * «45+2», og ingen ekstra opplysning ved kampstart — reporteren skal ikke
 * taste omgangslengde i appens mest tidskritiske øyeblikk, og Heia har
 * uansett ikke datagrunnlag for en fotballkonvensjon som varierer per
 * aldersklasse og idrett.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DENNE FILA FINNES
 *
 * Før 00073 fantes klokka TRE steder — `EventDetailScreen`,
 * `LiveMatchBanner` og `InboxScreen` — som hver sin `Date.now() - startedAt`.
 * Ingen av dem trakk fra pausen, og serveren gjorde det heller ikke, så en
 * kamp med et kvarters pause viste et kvarter for mye resten av kampen. De
 * minuttene ble dessuten stående PERMANENT i kampforløpet, fordi
 * `match_events.minute` stemples med samme regnestykke.
 *
 * «App, server, push, puls, tidslinje og sticky-bar skal arve SAMME beregnede
 * tid» (P2). Serveren eier tallene; denne fila er den ene måten appen leser
 * dem på.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ SERVEREN EIER TILSTANDEN, APPEN TELLER BARE VIDERE.
 *
 * Vi henter ikke minuttet fra serveren hvert sekund — vi henter de to
 * tallene som definerer uret, og regner lokalt mellom rundturene. Det er
 * samme modell som `match_played_seconds(int, timestamptz)` i 00073, og de
 * to må endres i takt.
 */

/** Urets tilstand, slik den kommer fra `match_sessions` (00073). */
export interface MatchClock {
  /** Akkumulert spilt tid fram til forrige stopp. */
  playedSeconds?: number;
  /** Når uret sist ble startet. `undefined` = uret står. */
  clockStartedAt?: Date;
  /**
   * ⚠️ HISTORIKK, IKKE KLOKKE. Når kampen faktisk begynte. Skrives aldri om.
   * Brukes her KUN som reserve mot en server uten 00073 — se `playedSeconds`
   * under.
   */
  startedAt?: Date;
}

/**
 * Faktisk spilt tid NÅ, i sekunder.
 *
 * ⚠️ RESERVEN ER BEVISST OG MIDLERTIDIG. Er `playedSeconds` `undefined`, er
 * serveren eldre enn 00073, og da finnes ikke tallene i det hele tatt. Vi
 * faller da tilbake på den GAMLE oppførselen (`now − started_at`, som teller
 * gjennom pausen) i stedet for å vise 0′ på en kamp som er i gang. En feil
 * klokke er dårlig; en klokke som står på null mens kampen spilles er verre.
 *
 * ➡️ Reserven kan fjernes når 00073 har stått i prod en stund. Da skal
 *    `playedSeconds ?? 0` være nok, og `startedAt` kan ut av dette
 *    grensesnittet helt.
 */
export function matchPlayedSeconds(clock: MatchClock, nowMs: number): number {
  if (clock.playedSeconds === undefined) {
    if (!clock.startedAt) {
      return 0;
    }
    return Math.max(0, Math.floor((nowMs - clock.startedAt.getTime()) / 1000));
  }

  const running = clock.clockStartedAt
    ? Math.floor((nowMs - clock.clockStartedAt.getTime()) / 1000)
    : 0;
  return Math.max(0, clock.playedSeconds + running);
}

/**
 * Kampminuttet NÅ.
 *
 * ⚠️ GULVET, IKKE AVRUNDING. Et mål i sekund 119 er i minutt 1, ikke 2 —
 * samme konvensjon som serveren stempler `match_events.minute` med, og som
 * folk leser en kampklokke på. Avrunding ville gjort at appen og forløpet
 * viste ulikt minutt for det samme øyeblikket i halvparten av tilfellene.
 */
export function matchMinute(clock: MatchClock, nowMs: number): number {
  return Math.floor(matchPlayedSeconds(clock, nowMs) / 60);
}

/**
 * Går uret akkurat nå?
 *
 * ⚠️ SPØR URET, IKKE STATUSEN. `matchStatus` sier hva kampen ER; dette sier
 * om tallet kommer til å endre seg. De to kan være uenige i et kort vindu
 * rundt en pause (statusen kommer via realtime, uret via samme rad), og da
 * er uret fasit for om det er noe å telle.
 */
export function matchClockRunning(clock: MatchClock): boolean {
  if (clock.playedSeconds === undefined) {
    // Server uten 00073: den gamle klokka gikk alltid, også i pause.
    return clock.startedAt !== undefined;
  }
  return clock.clockStartedAt !== undefined;
}
