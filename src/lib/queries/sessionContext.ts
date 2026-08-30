import {queryClient} from './queryClient';
// Nøklene DIREKTE fra keys.ts, ikke via liveMatch/supportSummary-modulene:
// de to importerer nå `pendingSessionContext` herfra (S7b), og modulveien
// ville gitt importsirkler. Verdiene er identiske (key-funksjonene er rene
// passthroughs til queryKeys).
import {queryKeys} from './keys';
import {prefetchTeamFeedFirstPage} from './feed';
import {prefetchTeamEvents} from './events';
// Direkte fil-import (ikke api-barrelen) — samme sirkelvern som resten av
// queries-laget.
import {getSessionContext, type SessionContext} from '../api/sessionContext';
import {setRuntimeConfig} from '../runtimeConfig';
import {readStoredActiveTeamSpaceId} from '../activeTeamStorage';
import {primeAvatars} from '../media/avatar';

/**
 * ORKESTRATOREN FOR BOOT-/RESUME-KONTEKSTEN (S2, skaleringsplan §1.4).
 *
 * Fire kontekster vil ha hver sin bit av det samme svaret (UserContext:
 * profilen, TeamContext: memberships + membercount, NotificationsContext:
 * unread, MatchButtonContext: livekampen) — og de skal IKKE koste fire kall.
 * Derfor bor hentingen her, utenfor React-treet, med:
 *
 *  - SINGLE-FLIGHT: alle kall i samme vindu deler ett HTTP-kall. `inflight`
 *    settes SYNKRONT i kalløyeblikket, så fire AppState-lyttere som fyrer i
 *    samme tick alltid blir ett kall — samme garanti som resolverens
 *    inflight-dedupe (S1-e).
 *  - SEEDING: livekamp og lagkassa skrives RETT i query-cachen
 *    (`setQueryData` = fersk `dataUpdatedAt`), så `useLiveMatch`/
 *    `useSupportSummary` ikke refetcher når skjermene monterer innenfor
 *    staleTime. Profil/memberships/unread bor i context-state, ikke i
 *    cachen — de leveres via returverdien og `peekSessionContext`.
 *  - FALLBACK VED FEIL: svaret er null (aldri throw) — konsumentene tar da
 *    sine gamle enkeltkall. En app mot en base uten 00079 oppfører seg
 *    dermed NØYAKTIG som før S2.
 *
 * Kandidatlaget: eksplisitt fra kalleren når det er kjent (foreground),
 * ellers forrige økts lagrede valg (boot — TeamContext har ikke valgt ennå).
 * RPC-en validerer medlemskapet selv; et foreldet kandidatlag gir udekkede
 * felter og konsumentene henter dem med enkeltkall (= dagens oppførsel).
 */

let inflight: Promise<SessionContext | null> | null = null;
let last: {ctx: SessionContext; fetchedAt: number} | null = null;
// Utlogging på en delt enhet: et kall i flukt for FORRIGE bruker skal aldri
// få seede den nye brukerens tomme cache. Telleren bumper i
// abandonSessionContext (koblet på clearLocalCaches), og et svar med feil
// generasjon kastes.
let generation = 0;

const FRESH_MS = 60_000; // samme 60 s-regel som resten av huset

async function fetchAndApply(
  candidateTeamSpaceId: string | null,
  bootPrefetchUserId: string | undefined,
): Promise<SessionContext | null> {
  const gen = generation;
  try {
    const candidate =
      candidateTeamSpaceId ?? (await readStoredActiveTeamSpaceId());

    // Boot-trioen (§1.4): feed side 1 + events avfyres PARALLELT med
    // kontekst-RPC-en — de tre kallene deler RTT i stedet for å stå i kø
    // bak hverandre. Kun ved boot (flagget), og kun når kandidaten finnes.
    if (bootPrefetchUserId && candidate && gen === generation) {
      prefetchTeamFeedFirstPage(candidate, bootPrefetchUserId);
      prefetchTeamEvents(candidate);
    }

    const ctx = await getSessionContext(candidate);
    if (gen !== generation) {
      return null;
    }

    // Flaggene først — de skal være satt før noen leser dem. Trygge
    // defaults ved alt av feil ligger i sanitiseringen (api-laget).
    setRuntimeConfig(ctx.runtimeFlags);

    if (ctx.coveredTeamSpaceId) {
      // null er et ekte svar («ingen pågående kamp») og skal seedes som
      // data — undefined ville slettet cache-posten.
      queryClient.setQueryData(
        queryKeys.liveMatch(ctx.coveredTeamSpaceId),
        ctx.liveMatch,
      );
      queryClient.setQueryData(
        queryKeys.supportSummary(ctx.coveredTeamSpaceId),
        ctx.supportSummary,
      );
    }

    // Samme signeringsregel som getProfile: eget bilde tegnes med én gang.
    if (ctx.profile?.avatarPath) {
      primeAvatars([ctx.profile.avatarPath]).catch(() => {});
    }

    last = {ctx, fetchedAt: Date.now()};
    return ctx;
  } catch {
    // Konsumentene faller tilbake til enkeltkallene sine — feilen skal
    // aldri velte boot (samme «sekundært blokkerer aldri»-regel som badgen).
    return null;
  }
}

/**
 * Hent (eller del) konteksten. `maxAgeMs > 0` godtar et ferskt svar fra
 * minnet — boot-fan-in-en bruker det så UserContext kan dele TeamContexts
 * kall uansett effektrekkefølge; foreground-lytterne kaller med 0 (alltid
 * ferskt, single-flight gjør dem til ett kall likevel).
 */
export function refreshSessionContext(
  candidateTeamSpaceId?: string | null,
  opts?: {maxAgeMs?: number; bootPrefetchUserId?: string},
): Promise<SessionContext | null> {
  const maxAgeMs = opts?.maxAgeMs ?? 0;
  if (
    maxAgeMs > 0 &&
    last &&
    Date.now() - last.fetchedAt <= maxAgeMs &&
    (candidateTeamSpaceId == null ||
      last.ctx.coveredTeamSpaceId === candidateTeamSpaceId)
  ) {
    return Promise.resolve(last.ctx);
  }
  if (inflight) {
    return inflight;
  }
  inflight = fetchAndApply(
    candidateTeamSpaceId ?? null,
    opts?.bootPrefetchUserId,
  ).finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * S7b: det PÅGÅENDE kontekst-kallet, om noe — ALDRI et nytt kall. Frø-boot
 * monterer hjemskjermen mens kallet fortsatt er i flukt, og da skal
 * livekamp/badge/lagkassa VENTE på svaret som uansett seeder dem, i stedet
 * for å fyre duplikate enkeltkall (bootbudsjettet ≤7 er LÅST, §0.1-3).
 * Promiset resolver alltid (fetchAndApply kaster aldri) — null ved feil, og
 * da tar kallerne sine vanlige enkeltkall som fallback.
 */
export function pendingSessionContext(): Promise<SessionContext | null> | null {
  return inflight;
}

/**
 * Rent minneoppslag — ALDRI nettverk. Brukes der et kall ville vært feil
 * medisin: NotificationsContext' mount-effekt fyrer både ved boot (svaret
 * ligger her — null HTTP) og ved lagbytte (svaret dekker gamle laget —
 * miss, og kalleren tar dagens HEAD-kall).
 */
export function peekSessionContext(
  teamSpaceId: string,
  maxAgeMs: number = FRESH_MS,
): {ctx: SessionContext; fetchedAt: number} | null {
  if (
    last &&
    Date.now() - last.fetchedAt <= maxAgeMs &&
    last.ctx.coveredTeamSpaceId === teamSpaceId
  ) {
    return last;
  }
  return null;
}

/**
 * Utlogging/kontosletting (kobles på clearLocalCaches): glem alt, og merk
 * eventuelle svar i flukt som døde — de tilhører forrige bruker.
 */
export function abandonSessionContext(): void {
  generation += 1;
  inflight = null;
  last = null;
}
