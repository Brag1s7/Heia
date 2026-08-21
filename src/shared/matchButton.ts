import type {HeiableMoment} from './matchEngagement';
import type {MatchStatus} from './types';

/**
 * KAMPKNAPPEN — tab-barens midtplass, som tilstandsmaskin (P4, skive 10).
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DEN BOR HER OG IKKE I KOMPONENTEN
 *
 * Knappen er den ene flaten i Heia som betyr fire forskjellige ting avhengig
 * av hvor du står og hvem du er. Alt som kan gå galt med den — at den lyver om
 * stillingen, at den tilbyr HEIA på et mål imot, at den blir stående «live»
 * etter slutt — er tilstand, ikke tegning. Da skal den kunne bevises uten å
 * montere en tab-bar.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DEN LAGER INGEN NY KAMPSTATUS.
 *
 * `liveMatch` kommer fra `getLiveMatch()`, som er den samme spørringen
 * `TeamHomeScreen` og `InboxScreen` alltid har brukt, med den samme
 * `MATCH_STATUS_MAP`. `presence` settes av kampskjermen selv, som ALLEREDE
 * vet hvem som er reporter og hva som kan heies på. Denne fila kombinerer to
 * eksisterende sannheter; den slår ikke opp noe eget.
 *
 * Fasit for tilstandene: `docs/prototypes/kampskjerm/index.html`, `btnState()`.
 */

/** Kampen brukeren STÅR I, meldt inn av `EventDetailScreen` ved fokus. */
export interface MatchPresence {
  eventId: string;
  /** Kampens reporter er meg. Da er knappen et verktøy, ikke en jubel. */
  isReporter: boolean;
  /** Reporterdokken står åpen ⇒ knappen sier «LUKK». */
  dockOpen: boolean;
  /** Nyeste øyeblikk å heie på, eller null om ingenting har skjedd ennå. */
  heiaTarget: HeiableMoment | null;
  /**
   * HVA TRYKKET GJØR — eid av kampskjermen.
   *
   * ⚠️ Handlingen bor HER og ikke i tab-baren, fordi den trenger ting bare
   * kampskjermen har: den optimistiske engasjementspatchen, pending-låsen for
   * HEIA, og dokkens av/på. Skulle baren gjort det selv, måtte den ha hatt en
   * kopi av halve kampskjermens tilstand — altså nettopp den parallelle
   * modellen skiva ikke skal lage.
   */
  onPress: () => void;
}

/** Live kamp for laget, sett UTENFRA. */
export interface LiveMatchSummary {
  eventId: string;
  status: MatchStatus;
  home: number;
  away: number;
  /** Vårt lags navn — VoiceOver skal si hvem som leder, ikke bare et tall. */
  teamName: string;
  opponent: string;
}

export type MatchButtonKind =
  /**
   * ⚠️ VI VET IKKE ENNÅ — og da skal knappen ikke PÅSTÅ noe.
   *
   * Brage 2026-08-21: «når man går inn på appen og det er en pågående kamp,
   * så viser knappen først kamp, deretter hopper den over til stillingen.»
   * `KAMP` betyr «ingen kamp pågår», og det er en påstand vi ikke har dekning
   * for før første henting har landet. Hoppet var altså ikke en animasjonsfeil
   * — flaten sa noe usant i et halvt sekund.
   */
  | 'unknown'
  | 'idle'
  | 'live'
  | 'pause'
  | 'heia'
  | 'heiet'
  | 'heia-tom'
  | 'rapporter'
  | 'lukk';

export interface MatchButtonState {
  kind: MatchButtonKind;
  /** Teksten i pillen. */
  label: string;
  /**
   * Kortform, brukt KUN når den fulle etiketten ikke får plass (320 pt).
   *
   * ⚠️ Kom av telefonen (Brage 2026-08-21): «RAPPORTER» ble kuttet til
   * «RAPPORT…». Å la iOS klippe et ord er å la flaten lyve — da er en
   * kortere, hel setning bedre enn en lang, halv. `a11yLabel` er uendret,
   * så skjermleseren hører alltid hele meningen.
   */
  shortLabel?: string;
  /** Den lille etiketten UNDER pillen — fanens navn. */
  tabLabel: string;
  /** Hva knappen gjør, som setning. «Kamp» alene sier ingenting i VoiceOver. */
  a11yLabel: string;
  /** Ingenting å heie på ennå: knappen er ekte disabled, ikke stille død. */
  disabled: boolean;
  /**
   * Posten et HEIA skal lande på. Satt KUN i `heia`.
   * `heiet` har den bevisst ikke — se under.
   */
  heiaPostId?: string;
  /** Kampen som skal åpnes. Satt i `live` og `pause`. */
  openEventId?: string;
}

const IDLE: MatchButtonState = {
  kind: 'idle',
  label: 'KAMP',
  // Prototypens sublabel: knappen fører til Sesongen når ingenting pågår,
  // og da skal etiketten si hvor du havner — ikke hva knappen heter.
  tabLabel: 'Sesongen',
  a11yLabel: 'Kamp. Åpner Sesongen',
  disabled: false,
};

const UNKNOWN: MatchButtonState = {
  kind: 'unknown',
  // Tom etikett: pillen står som en rolig plass til svaret lander. Et ord
  // her ville vært det samme hoppet, bare med en annen tekst.
  label: '',
  tabLabel: 'Kamp',
  a11yLabel: 'Kamp. Henter kampstatus',
  disabled: false,
};

/** «2–1», med den samme tankestreken stillingen ellers bruker i appen. */
function scoreText(m: LiveMatchSummary): string {
  return `${m.home}–${m.away}`;
}

/**
 * HAR TILSTANDEN EN GLYF FORAN ORDET?
 *
 * ⚠️ DETTE ER TILSTANDENS SVAR, IKKE ET GJETT PÅ ORDLENGDE. Første utkast
 * lot geometrien anta «langt ord ⇒ ingen glyf», og da trodde den at
 * «RAPPORT» (7 tegn) hadde et ikon komponenten aldri tegnet — 20 pt bredde
 * som ikke fantes. To kilder til det samme spørsmålet er én for mye.
 *
 * `rapporter`/`lukk` har ingen: de er de lengste ordene, og et verktøy
 * trenger ingen dekorasjon foran seg.
 *
 * `pause` har heller ingen, og det er en RETTELSE: prikken kostet 24 pt, og
 * «PAUSE 2–1» fikk da ikke plass på NOEN telefon. Den er dessuten stillestående
 * i pause (samme regel som `LiveBadge`), så den bar nesten ingenting — gullet
 * og ordet gjør hele jobben. `live` beholder sin: der PUSTER den, og den er
 * hele live-signalet ved siden av et ord på tre tegn.
 */
export function matchButtonHasGlyph(kind: MatchButtonKind): boolean {
  return kind !== 'rapporter' && kind !== 'lukk' && kind !== 'pause';
}

/**
 * Skal skiftet MERKES med et sprett?
 *
 * ⚠️ NEI, når vi går fra «vet ikke» til det første svaret. Det er ikke en
 * nyhet — det er at flaten endelig kan si hva den vet. Et sprett der ville
 * gjort oppstarten urolig, som er nøyaktig det denne runden retter.
 */
export function shouldNudge(
  from: MatchButtonKind | null,
  to: MatchButtonKind,
): boolean {
  return from !== null && from !== 'unknown' && from !== to;
}

/**
 * Kampen er I GANG — pause teller med. Klokka står stille i pause, men
 * kampen er ikke over, og knappen skal ikke falle til `KAMP` i pausen.
 */
export function isUnderwayStatus(status: MatchStatus): boolean {
  return status === 'live' || status === 'halfTime';
}

/**
 * ⚠️ FLERE SAMTIDIGE LIVEKAMPER ER UTSATT (P4), IKKE GLEMT.
 *
 * `getLiveMatch` returnerer nyeste avspark og bare den (`limit 1`). Knappen
 * viser da ÉN ekte livekamp — den lyver ikke, den er bare ikke uttømmende.
 * Prototypens «N LIVE»-velger krever cross-team-støtte, som ikke finnes ennå.
 * Når den kommer, er det HER en `many`-tilstand skal inn.
 */
export function matchButtonState(input: {
  presence: MatchPresence | null;
  liveMatch: LiveMatchSummary | null;
  /**
   * Første henting har landet (eller vi har noe i cachen). Er den `false`,
   * VET vi ikke om det pågår en kamp — se `unknown`.
   */
  known?: boolean;
}): MatchButtonState {
  const {presence, liveMatch, known = true} = input;

  // ---------------------------------------------------------------------
  // INNE I KAMPEN. Kampskjermen har meldt seg på, og den vet mer enn oss.
  // ---------------------------------------------------------------------
  if (presence !== null) {
    if (presence.isReporter) {
      return presence.dockOpen
        ? {
            kind: 'lukk',
            label: 'LUKK',
            tabLabel: 'Kamp',
            a11yLabel: 'Lukk rapporteringsverktøyet',
            disabled: false,
          }
        : {
            kind: 'rapporter',
            label: 'RAPPORTER',
            shortLabel: 'RAPPORT',
            tabLabel: 'Kamp',
            a11yLabel: 'Åpne rapportering for kampen',
            disabled: false,
          };
    }

    const target = presence.heiaTarget;

    if (target === null) {
      // Rett etter avspark: ingenting har skjedd. En knapp som ser trykkbar
      // ut og stille ikke gjør noe er verre enn en som sier at den ikke er
      // klar — samme regel som `MatchEngagementRow` følger før posten finnes.
      return {
        kind: 'heia-tom',
        label: 'HEIA!',
        tabLabel: 'Kamp',
        a11yLabel: 'Ingen øyeblikk å heie på ennå',
        disabled: true,
      };
    }

    if (target.iReacted) {
      // ⚠️ INGEN `heiaPostId` HER, MED VILJE. Kampknappen er en JUBEL, ikke
      // en bryter: den skal aldri kunne FJERNE en heia. Uten post-id-en
      // finnes det ikke noe å skrive, uansett hva kallstedet finner på.
      return {
        kind: 'heiet',
        label: 'HEIET',
        tabLabel: 'Kamp',
        a11yLabel: 'Du har heiet på dette øyeblikket',
        disabled: false,
      };
    }

    return {
      kind: 'heia',
      label: 'HEIA!',
      tabLabel: 'Kamp',
      a11yLabel: `Heia på ${target.what}`,
      disabled: false,
      heiaPostId: target.postId,
    };
  }

  // ---------------------------------------------------------------------
  // UTENFOR KAMPEN.
  // ---------------------------------------------------------------------
  // ⚠️ FØR VI VET: tegn en rolig plass, ikke et svar. Knappen er trykkbar
  // (Sesongen er riktig mål uansett hva svaret blir), men den sier ingenting
  // den kan bli tatt i å ta feil av.
  if (!known) {
    return UNKNOWN;
  }

  if (liveMatch === null || !isUnderwayStatus(liveMatch.status)) {
    return IDLE;
  }

  const score = scoreText(liveMatch);
  const who = `${liveMatch.teamName} ${score} ${liveMatch.opponent}`.trim();

  if (liveMatch.status === 'halfTime') {
    return {
      kind: 'pause',
      label: `PAUSE ${score}`,
      // Gullfargen og prikken bærer «pause» også uten ordet; stillingen
      // finnes uansett inne i kampen.
      shortLabel: score,
      tabLabel: 'Kamp',
      a11yLabel: `Pause: ${who}. Åpne kampen`,
      disabled: false,
      openEventId: liveMatch.eventId,
    };
  }

  return {
    kind: 'live',
    label: score,
    tabLabel: 'Kamp',
    // ⚠️ «Åpne kampen» — IKKE «heia». Et trykk her registrerer ingenting;
    // det flytter deg. Sa labelen noe annet, ville skjermleserbrukeren
    // trodd hun nettopp heiet.
    a11yLabel: `Live: ${who}. Åpne kampen`,
    disabled: false,
    openEventId: liveMatch.eventId,
  };
}
