import type {MatchEngagement} from './matchEngagement';
import type {MatchEvent, MatchEventType} from './types';

/**
 * KAMPENS PULS — modellen, som ren regning.
 *
 * ---------------------------------------------------------------------------
 * HVA DEN ER (Brages bestilling 2026-08-21, etter at runde 2 ble avvist)
 *
 * «Et komprimert kardiogram av kampen og en inngang til historien — ikke en
 * tilfeldig bølge basert på antall hendelser.» På tre sekunder skal man se
 * når det skjedde mye, når det var stille, hvem som scoret, hva slags
 * øyeblikk det var, hva som skapte HEIA — og hvor i kampen det skjedde.
 *
 * Fire regler bærer hele modellen, og alle fire er PRODUKT, ikke tegning:
 *
 *   1. **X ER EKTE KAMPTID.** Ikke jevn fordeling etter arrayindeks. En
 *      hendelse i 10′ ligger en firedel inn i en 40-minutters kamp, og en
 *      stille periode blir en faktisk lang, rolig strek.
 *   2. **MIDTLINJA GIR RETNING.** Over = oss, under = motstanderen, og
 *      underlinja er RESERVERT for mål imot. Da betyr opp og ned noe.
 *   3. **HEIA OG KOMMENTARER ER RESPONS, IKKE HENDELSER.** De lager aldri
 *      et punkt på tidsaksen og rører aldri kurvens form — bare lyset.
 *   4. **MINUTT-TICKEREN REGENERERER ALDRI KURVEN.** `nowMinute` finnes
 *      ikke i geometrien. Se `matchPulseTimeline`.
 *
 * Modellen er tegnet og SETT gjennom åtte scenarier i
 * `__tests__/pulseModel.harness.test.ts` før den ble skrevet. Se
 * `docs/KAMPENS-PULS-MODELL.md`.
 */

// ---------------------------------------------------------------------------
// GEOMETRIENS FASTE MÅL
// ---------------------------------------------------------------------------

/** Båndets luft over og under. Uten den klippes markørene på de høyeste toppene. */
export const PULSE_VPAD = 15;
/** Vår halvdel. Større enn motstanderens: Heia feirer OSS. */
export const PULSE_UP = 38;
/** Motstanderens halvdel. Mindre, men ekte — 0–3 skal se ut som 0–3. */
export const PULSE_DOWN = 26;
export const PULSE_BAND = PULSE_VPAD * 2 + PULSE_UP + PULSE_DOWN;
export const PULSE_MID = PULSE_VPAD + PULSE_UP;
/**
 * NODENS radius — den lille prikken som markerer et MÅL på kurven.
 *
 * ⚠️ HISTORIKKEN ER VERDT Å KJENNE. Dette var 15 (en 30 pt ikonmarkør), så
 * 11, og nå 6. Hvert steg kom fra telefonen, og de peker samme vei: pulsen
 * er FORMEN, ikke en rad med knapper. Ved 15 dekket markørene kurven
 * fullstendig i en tett kamp; ved 11 kunne man se svaiene, men flaten var
 * fortsatt en navigator. Forenklingen 2026-08-21 fjernet ikonene helt, og da
 * er det ingenting igjen som trenger plass — bare et punkt som sier «her sto
 * det et mål».
 *
 * ⚠️ DEN KLEMMER OGSÅ NODEN INN I BÅNDET (`PULSE_MARK_R + 1`). En STOR
 * radius dyttet noden vekk fra kurvetoppen den skulle sitte på; med 6 følger
 * den svaien.
 */
export const PULSE_MARK_R = 6;
/** Den lille tidsmarkøren for pause. Sitter PÅ midtlinja, deler ingenting. */
export const PULSE_TICK_R = 7;
/**
 * ⚠️ NÅR TO MARKØRER BLIR ÉN — og hvorfor terskelen er MINDRE enn markøren.
 *
 * Med 30 pt markører og en 60-minutters kamp er det bare plass til elleve
 * på rad. Slås alt sammen som ikke får full klaring, forsvinner gull- og
 * kremmarkørene i en helt vanlig kamp — og da kan man ikke lenger lese om
 * et øyeblikk var et mål, en oppdatering eller et bilde.
 *
 * De males i rang: bildet nederst, oppdateringen over, målet øverst. Først
 * når de i praksis dekker hverandre blir de ÉN markør med ×N, og valget
 * forklarer flokken.
 *
 * ⚠️ TERSKELEN ER MED VILJE IKKE ENDRET DA MARKØREN KRYMPET (R 15 → 11).
 * Med 22 pt diameter og terskel 22 møtes markørene nå akkurat, i stedet for
 * å overlappe med opptil 8 pt. Det er en gratis forbedring — og viktigere:
 * klyngene, ×N-tallene og trykkgruppene blir NØYAKTIG som før, så
 * krympingen er en ren tegneendring uten ny modell å teste.
 */
const VISUAL_MERGE = 22;
/** Hvor mange punkter kurven tegnes av. */
const SAMPLES = 140;

// ---------------------------------------------------------------------------
// ØYEBLIKKENE
// ---------------------------------------------------------------------------

export type PulseKind = 'goalUs' | 'goalThem' | 'update' | 'photo';

/** Det pulsen trenger av et kampbilde. `MatchPhoto` oppfyller den. */
export interface PulsePhoto {
  id: string;
  createdAt: Date;
  authorName?: string;
  /** Satt når bildet hører til ett bestemt øyeblikk. */
  matchEventId?: string;
}

export interface PulseMoment {
  key: string;
  /** Hendelsen dette punktet peker på — inngangen til «Vis i historien». */
  eventId?: string;
  photoId?: string;
  /** Avrundet kampminutt — brukes KUN i tekst, aldri til posisjon. */
  minute: number;
  /**
   * ⚠️ POSISJONEN PÅ TIDSAKSEN: sekunder siden avspark.
   *
   * Kampminuttet er et heltall, og en kamp som varer under ett minutt får
   * da alle hendelsene sine i «0′». Sekundene kommer fra den kanoniske
   * feed-postens `created_at`, som skrives i samme transaksjon som
   * hendelsen — se `MatchEngagement.createdAt`.
   */
  seconds: number;
  /** Serverens rekkefølge. Gjør rekkefølgen DETERMINISTISK. */
  sequence: number;
  kind: PulseKind;
  /** Målscorer, fotograf eller reporter — «Mål — Jarle». */
  actor?: string;
  /** Stillingen ETTER øyeblikket, satt på mål. */
  score?: string;
  heia: number;
  comments: number;
  iReacted: boolean;
}

/**
 * Utslaget per type.
 *
 * ⚠️ NØYTRALE HENDELSER LIGGER LAVT MED VILJE (Brage): en oppdatering eller
 * et bilde ligger OVER midtlinja fordi det er vår reporter og våre bilder,
 * men amplituden er så lav at den aldri kan forveksles med et mål. Formen og
 * ikonet gjør resten — rundere og bredere svai, gull og krem mot mint.
 */
const SPEC: Record<
  PulseKind,
  {side: 1 | -1; amp: number; rise: number; fall: number}
> = {
  goalUs: {side: 1, amp: 1, rise: 5, fall: 9},
  goalThem: {side: -1, amp: 1, rise: 5, fall: 9},
  update: {side: 1, amp: 0.3, rise: 7, fall: 12},
  photo: {side: 1, amp: 0.26, rise: 10, fall: 16},
};

/**
 * Hvilken type som LEDER en flokk når flere øyeblikk smelter sammen.
 *
 * ⚠️ VAR EKSPORTERT (`PULSE_RANK`) fordi komponenten malte markørene i denne
 * rekkefølgen — målet øverst, aldri under et bilde. Markørene er borte
 * (forenklingen 2026-08-21), men rangen betyr fortsatt noe i MODELLEN: den
 * avgjør om flokken regnes som et mål, og dermed om den får en node.
 */
const RANK: Record<PulseKind, number> = {
  goalUs: 3,
  goalThem: 3,
  update: 2,
  photo: 1,
};

/** Typegruppe. Et mål og en oppdatering slås ALDRI sammen visuelt. */
const GROUP: Record<PulseKind, string> = {
  goalUs: 'mål',
  goalThem: 'mål',
  update: 'oppdatering',
  photo: 'bilde',
};

/**
 * Hvilket kampminutt et bilde hører til.
 *
 * Samme regnestykke som serveren bruker i `report_match_event`, så bilder og
 * hendelser havner på én og samme minuttskala. Delt med `MatchTimeline` med
 * vilje: to kopier kunne satt det samme bildet på to ulike minutter i samme
 * scroll. `MAX_SAFE_INTEGER` = ukjent kampstart.
 */
export function matchPhotoMinute(photo: PulsePhoto, startedAt?: Date): number {
  if (!startedAt) return Number.MAX_SAFE_INTEGER;
  return Math.max(
    0,
    Math.floor((photo.createdAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

/**
 * ⚠️ RYTMEMARKØRENE FORMER IKKE PULSEN — de er kampens gater, ikke øyeblikk
 * man kjenner noe over. De blir diskrete tidsstreker i stedet (se `ticks`).
 * `bytte`/`kort` finnes kun som historiske importdata.
 *
 * ⚠️ `teamSide` kan mangle (skal ikke skje etter 00020). Da behandles målet
 * som mål imot — bedre å underfeire eget mål enn å feire motstanderens.
 */
function pulseKindFor(
  type: MatchEventType,
  teamSide?: 'home' | 'away',
): PulseKind | undefined {
  if (type === 'mål') return teamSide === 'home' ? 'goalUs' : 'goalThem';
  if (type === 'melding') return 'update';
  return undefined;
}

export interface PulseInput {
  matchEvents: MatchEvent[];
  photos: PulsePhoto[];
  startedAt?: Date;
  /** HEIA + kommentarer per øyeblikk — fra `buildMatchEngagement` (skive 4). */
  byMatchEvent: Map<string, MatchEngagement>;
  /** Et frittstående kampbilde ER sin egen post. */
  byPost: Map<string, MatchEngagement>;
  /** Slår opp reporteren bak en oppdatering. */
  authorFor?: (userId: string) => {name: string} | undefined;
}

/**
 * ØYEBLIKKENE, i kronologisk rekkefølge.
 *
 * Stillingen regnes underveis med nøyaktig samme regel som `MatchTimeline`
 * bruker (tell mål i serverens `sequence`-rekkefølge), så valgpanelet og
 * kampforløpet aldri kan vise to ulike stillinger for det samme målet.
 */
export function buildPulseMoments(
  input: PulseInput,
  timeline: PulseTimeline,
): PulseMoment[] {
  const {matchEvents, photos, startedAt, byMatchEvent, byPost} = input;
  const out: PulseMoment[] = [];

  let home = 0;
  let away = 0;
  matchEvents.forEach((event, index) => {
    if (event.type === 'mål' && event.teamSide) {
      if (event.teamSide === 'home') home += 1;
      else away += 1;
    }
    const kind = pulseKindFor(event.type, event.teamSide);
    if (!kind) return;
    const eng = byMatchEvent.get(event.id);
    const stamp = stampOf(event, byMatchEvent, startedAt);
    out.push({
      key: event.id,
      eventId: event.id,
      minute: event.minute,
      seconds:
        stamp !== undefined
          ? pulseSecondsOf(stamp, timeline)
          : event.minute * 60,
      sequence: index,
      kind,
      // ⚠️ For mål er `description` SYNTETISK og reporterens frie tekst
      // ligger i `player` — samme felle `matchEventA11yLabel` dokumenterer.
      actor:
        kind === 'update'
          ? event.reportedBy
            ? input.authorFor?.(event.reportedBy)?.name
            : undefined
          : event.player,
      score: event.type === 'mål' ? `${home}–${away}` : undefined,
      heia: eng?.heiaCount ?? 0,
      comments: eng?.commentCount ?? 0,
      iReacted: eng?.iReacted ?? false,
    });
  });

  photos.forEach((photo, index) => {
    // Et bilde på en hendelse hører til hendelsen sin, som i forløpet.
    if (photo.matchEventId) return;
    const minute = matchPhotoMinute(photo, startedAt);
    if (minute === Number.MAX_SAFE_INTEGER) return;
    const eng = byPost.get(photo.id);
    out.push({
      key: photo.id,
      photoId: photo.id,
      minute,
      seconds: pulseSecondsOf(photo.createdAt.getTime(), timeline),
      sequence: matchEvents.length + index,
      kind: 'photo',
      actor: photo.authorName,
      heia: eng?.heiaCount ?? 0,
      comments: eng?.commentCount ?? 0,
      iReacted: eng?.iReacted ?? false,
    });
  });

  return out.sort((a, b) => a.seconds - b.seconds || a.sequence - b.sequence);
}

/**
 * RYTMEMARKØRENE SOM RENE TIDSPUNKTER.
 *
 * ⚠️ PAUSE ER ÉN LITEN MARKØR PÅ EN SAMMENHENGENDE LINJE (Brage) — ikke en
 * strek som deler kurven i to, og aldri en nullstilling av tiden. Avspark og
 * slutt er linjas to ender og trenger ingen egen markør; `andre_omgang`
 * ligger på samme tidspunkt som pausen og ville bare doblet den.
 */
export function buildPulseTicks(
  matchEvents: MatchEvent[],
  byMatchEvent: Map<string, MatchEngagement>,
  startedAt: Date | undefined,
  timeline: PulseTimeline,
): {seconds: number; kind: 'pause'}[] {
  return matchEvents
    .filter(e => e.type === 'pause')
    .map(e => {
      const stamp = stampOf(e, byMatchEvent, startedAt);
      return {
        seconds:
          stamp !== undefined ? pulseSecondsOf(stamp, timeline) : e.minute * 60,
        kind: 'pause' as const,
      };
    });
}

// ---------------------------------------------------------------------------
// TIDSAKSEN
// ---------------------------------------------------------------------------

/**
 * KAMPENS TIDSAKSE, I SEKUNDER.
 *
 * ⚠️ IKKE AVRUNDEDE MINUTTER, OG INGEN KVANTISERING (Brage, telefonrunde
 * 2026-08-21). Begge var feil, og telefonen viste hvorfor: en kamp som varte
 * under ett minutt fikk `span = 5 minutter` fra et gulv i den gamle
 * modellen, og alle hendelsene lå i «0′». Hele pulsen kollapset til venstre
 * kant, selv om hendelsene kom med flere SEKUNDERS mellomrom.
 *
 * Nå: `t = 0` er AVSPARK, `t = span` er SLUTT, og en ferdig kamp bruker
 * derfor ALLTID hele bredden.
 *
 * ⚠️ TIDSPUNKTENE KOMMER FRA FEED-POSTEN, ikke fra `minute`. Se
 * `MatchEngagement.createdAt` for hvorfor det er den eneste kilden vi har i
 * dag — og hvorfor `created_at` ut av `get_event_with_rsvp` er den riktige
 * langsiktige løsningen.
 *
 * ⚠️ PAUSE NULLSTILLER INGENTING. Tiden løper sammenhengende fra avspark;
 * pausen er en liten markør PÅ linja, ikke et brudd i den.
 */
export interface PulseTimeline {
  /** Millisekundet avsparket gikk. */
  origin: number;
  /** Kampens lengde i sekunder. Alltid minst 1. */
  span: number;
}

/**
 * Hendelsens tidspunkt i millisekunder, eller `undefined` om vi ikke vet.
 *
 * Tre kilder, i denne rekkefølgen:
 *   1. **`event.createdAt`** — finnes i typen, men mappes ikke fra
 *      `get_event_with_rsvp` i dag. Den dagen `created_at` kommer ut av den
 *      RPC-en, blir pulsen bedre uten at en linje her endres.
 *   2. **Den kanoniske feed-postens `created_at`** — skrevet i SAMME
 *      transaksjon som hendelsen, altså samme millisekund. Dette er kilden
 *      i dag.
 *   3. Det avrundede minuttet. Siste utvei, og nettopp det som kollapser en
 *      kamp på under ett minutt — derfor bare en fallback.
 */
function stampOf(
  event: MatchEvent,
  byMatchEvent: Map<string, MatchEngagement>,
  startedAt?: Date,
): number | undefined {
  if (event.createdAt) return event.createdAt.getTime();
  const posted = byMatchEvent.get(event.id)?.createdAt;
  if (posted) return posted.getTime();
  if (startedAt) return startedAt.getTime() + event.minute * 60_000;
  return undefined;
}

/**
 * ⚠️ TIDSAKSEN ER KLOKKETID, IKKE SPILT TID — OG DET ER EN RETTELSE.
 *
 * Fram til 00074 fikk denne funksjonen `nowMinute`, og regnet høyre kant som
 * `startedAt + nowMinute * 60_000`. Det var riktig helt til 00073 gjorde
 * `minute` til FAKTISK SPILT TID: da pekte uttrykket et kvarters pause for
 * tidlig, mens hendelsene på kurven lå på klokketid fra feed-posten. Nå-
 * prikken havnet dermed til VENSTRE for den ferskeste hendelsen.
 *
 * Regelen er nå: **posisjoner er klokketid, minuttet er en etikett.**
 * `nowMs` kommer fra skjermens tick, aldri fra `Date.now()` her inne (P2).
 */
export function matchPulseTimeline(
  matchEvents: MatchEvent[],
  byMatchEvent: Map<string, MatchEngagement>,
  startedAt: Date | undefined,
  nowMs: number | undefined,
  finished: boolean,
): PulseTimeline {
  const stamps = matchEvents
    .map(e => stampOf(e, byMatchEvent, startedAt))
    .filter((n): n is number => n !== undefined);

  const kickoff = matchEvents.find(e => e.type === 'avspark');
  const origin =
    (kickoff ? stampOf(kickoff, byMatchEvent, startedAt) : undefined) ??
    startedAt?.getTime() ??
    (stamps.length ? Math.min(...stamps) : 0);

  const last = stamps.length ? Math.max(...stamps) : origin;

  if (finished) {
    const slutt = matchEvents.find(e => e.type === 'slutt');
    const end =
      (slutt ? stampOf(slutt, byMatchEvent, startedAt) : undefined) ?? last;
    return {origin, span: Math.max(1, (end - origin) / 1000)};
  }

  // Live: høyre kant er NÅ — i klokketid, samme akse som hendelsene ligger
  // på. `Math.max(now, last)` står igjen som vakt: en hendelse rapportert i
  // sekundet mellom to tick ville ellers falt utenfor bredden.
  const now = nowMs ?? last;
  return {origin, span: Math.max(1, (Math.max(now, last) - origin) / 1000)};
}

/** Sekunder siden avspark. */
export function pulseSecondsOf(stamp: number, timeline: PulseTimeline): number {
  return (stamp - timeline.origin) / 1000;
}

/**
 * MEMOISERINGSNØKKELEN — LÅST (P-bolken), utvidet for modellen.
 *
 * `matchEvents.length` alene gir stale kurver ved redigering, sletting,
 * angre eller endret hendelsesdata uten endret antall. Nøkkelen dekker
 * event-id (en angret hendelse forsvinner fra arrayet), type, side, minutt,
 * sekvens, HEIA-summen, `startedAt` og **hele tidslinja**.
 *
 * ⚠️ HENDELSENES TIDSSTEMPEL ER MED. Det er posisjonen på tidsaksen nå, og
 * det kommer fra feed-posten — kommer den etter kampforløpet (egen RPC),
 * skal kurven tegnes på nytt når tidspunktene lander.
 * ⚠️ KOMMENTARTALLET ER MED, men bare fordi det tegnes som en boble.
 * ⚠️ `nowMinute` ER IKKE MED — kun tidslinja, som allerede har tatt den inn.
 */
export function pulseSignature(
  input: PulseInput,
  timeline: PulseTimeline,
): string {
  const parts: string[] = [
    `o${timeline.origin}`,
    `s${timeline.span.toFixed(2)}`,
    String(input.startedAt?.getTime() ?? 0),
  ];
  input.matchEvents.forEach((e, i) => {
    const eng = input.byMatchEvent.get(e.id);
    parts.push(
      `${i}:${e.id}:${e.type}:${e.teamSide ?? '-'}:${e.minute}:${
        e.createdAt?.getTime() ?? eng?.createdAt?.getTime() ?? 0
      }:${eng?.heiaCount ?? 0}:${eng?.commentCount ?? 0}:${
        eng?.iReacted ? 1 : 0
      }`,
    );
  });
  input.photos.forEach((p, i) => {
    const eng = input.byPost.get(p.id);
    parts.push(
      `p${i}:${p.id}:${p.matchEventId ?? '-'}:${p.createdAt.getTime()}:${
        eng?.heiaCount ?? 0
      }:${eng?.commentCount ?? 0}:${eng?.iReacted ? 1 : 0}`,
    );
  });
  return parts.join('|');
}

// ---------------------------------------------------------------------------
// MODELLEN
// ---------------------------------------------------------------------------

export interface PulseCluster {
  key: string;
  x: number;
  /** Markørens senter, klemt inne i lerretet. */
  y: number;
  side: 1 | -1;
  /** Flokkens ledende type — den bestemmer ikonet. */
  kind: PulseKind;
  moments: PulseMoment[];
  /** Gløderadien. HEIA, og INGENTING annet, bor her. */
  glow: number;
  comments: number;
  iReacted: boolean;
}

export interface PulsePhase {
  kind: 'busiest' | 'quiet';
  from: number;
  to: number;
}

export interface PulseModel {
  span: number;
  /** Kurvens midtstrek, i lerretets koordinater. */
  line: string;
  /** Kurven lukket mot midtlinja — klippes to ganger av komponenten. */
  fill: string;
  /** Båndet med varierende halvbredde — «tykkere lys» der det skjer mye. */
  ribbon: string;
  /** Pausemarkøren(e): små punkter PÅ midtlinja, aldri delestreker. */
  ticks: {x: number; kind: 'pause'}[];
  clusters: PulseCluster[];
  phases: PulsePhase[];
  /** Alle øyeblikk i tidsrekkefølge — VoiceOver blar gjennom denne. */
  moments: PulseMoment[];
}

export interface PulseBox {
  width: number;
  pad: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Gløderadien. Base + HEIA, klemt — 400 heier fyller ikke rommet. */
function glowFor(heia: number): number {
  return 6 + Math.min(11, heia * 0.28);
}

/**
 * ØYEBLIKKENE → MODELLEN.
 *
 * ⚠️ INGEN `nowMinute`-PARAMETER, MED VILJE. `span` kommer ferdig kvantisert
 * inn; tallet som tikker finnes ikke her, så det kan ikke snike seg inn i en
 * avhengighet senere heller.
 */
export function buildPulseModel(
  moments: PulseMoment[],
  ticks: {seconds: number; kind: 'pause'}[],
  timeline: PulseTimeline,
  box: PulseBox,
): PulseModel {
  const inner = box.width - box.pad * 2;
  // ⚠️ EKTE KAMPTID. En ferdig kamp bruker derfor ALLTID hele bredden:
  // avspark på `box.pad`, slutt på `box.pad + inner`.
  const xOf = (seconds: number) =>
    box.pad + (clamp(seconds, 0, timeline.span) / timeline.span) * inner;

  // --- 1. Visuelle flokker -------------------------------------------------
  // ⚠️ INGEN MINUTTBØTTER. Det var den gamle modellens feil: to hendelser ni
  // sekunder fra hverandre viste begge «1′» og ble slått sammen, selv om de
  // ligger 50 pt fra hverandre på skjermen. Nå slås markører sammen KUN når
  // de faktisk overlapper — og trykkflatene grupperes for seg, på 44 pt.
  const merged: {
    side: 1 | -1;
    group: string;
    x: number;
    moments: PulseMoment[];
  }[] = [];
  for (const m of [...moments].sort(
    (a, b) => a.seconds - b.seconds || a.sequence - b.sequence,
  )) {
    const side = SPEC[m.kind].side;
    const group = GROUP[m.kind];
    const x = xOf(m.seconds);
    // ⚠️ SLÅS SAMMEN PÅ KOLLISJON, IKKE PÅ TYPE. Med 30 pt markører finnes
    // det ikke plass til to som overlapper — uansett om den ene er et mål og
    // den andre et bilde. Da er ÉN markør med ×N og en forklaring ved valg
    // både ærligere og mer lesbar enn to som dekker hverandre. Den ledende
    // typen (mål > oppdatering > bilde) bestemmer ikonet.
    const neighbour = [...merged].reverse().find(n => n.side === side);
    if (neighbour && x - neighbour.x < VISUAL_MERGE) {
      neighbour.moments.push(m);
    } else {
      merged.push({side, group, x, moments: [m]});
    }
  }

  // --- 2. Kurven -----------------------------------------------------------
  // Svaienes bredde er i PUNKTER, ikke i sekunder: en kamp på 60 sekunder og
  // en på 60 minutter skal ha like tydelige utslag.
  const swells = merged.map(m => {
    const sum = m.moments.reduce((a, mo) => a + SPEC[mo.kind].amp, 0);
    const lead = [...m.moments].sort((a, b) => RANK[b.kind] - RANK[a.kind])[0];
    const spec = SPEC[lead.kind];
    return {
      x: m.x,
      side: m.side,
      // Mykt tak: ett mål ≈ 0.65 av halvbåndet, to ≈ 0.88, fem ≈ 1.0.
      amp: 1 - Math.exp(-sum * 1.05),
      rise: spec.rise,
      fall: spec.fall,
      lead,
      moments: m.moments,
    };
  });

  const half = (side: 1 | -1) => (side === 1 ? PULSE_UP : PULSE_DOWN);
  const yAt = (x: number): number => {
    let v = 0;
    for (const s of swells) {
      const d = x - s.x;
      const t = d < 0 ? d / s.rise : d / s.fall;
      v += s.side * s.amp * half(s.side) * Math.exp(-t * t);
    }
    return PULSE_MID - v;
  };
  const densityAt = (x: number): number => {
    let v = 0;
    for (const s of swells) {
      const d = (x - s.x) / 22;
      v += s.amp * Math.exp(-d * d);
    }
    return Math.min(1, v);
  };

  const pts: {x: number; y: number}[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = box.pad + (i / (SAMPLES - 1)) * inner;
    pts.push({x, y: yAt(x)});
  }
  const line = pts
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const fill = `${line} L${(box.pad + inner).toFixed(1)} ${PULSE_MID} L${
    box.pad
  } ${PULSE_MID} Z`;
  const halfWidth = (x: number) => 0.9 + 2.4 * densityAt(x);
  const ribbon = `${pts
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${(p.y - halfWidth(p.x)).toFixed(
          1,
        )}`,
    )
    .join(' ')} ${pts
    .slice()
    .reverse()
    .map(p => `L${p.x.toFixed(1)} ${(p.y + halfWidth(p.x)).toFixed(1)}`)
    .join(' ')} Z`;

  // --- 3. Markørene --------------------------------------------------------
  // Markøren sitter PÅ sin egen topp, klemt inne i lerretet. Ingen stabling:
  // med 30 pt markører finnes det ikke plass, og to som kolliderer er
  // allerede slått sammen til én med ×N.
  const clusters: PulseCluster[] = swells.map(s => ({
    key: s.moments[0].key,
    x: s.x,
    y: clamp(yAt(s.x), PULSE_MARK_R + 1, PULSE_BAND - PULSE_MARK_R - 1),
    side: s.side,
    kind: s.lead.kind,
    moments: s.moments,
    glow: glowFor(s.moments.reduce((a, m) => a + m.heia, 0)),
    comments: s.moments.reduce((a, m) => a + m.comments, 0),
    iReacted: s.moments.some(m => m.iReacted),
  }));
  clusters.sort((a, b) => a.x - b.x || b.side - a.side);

  // ⚠️ TRYKKFLATENE ER BORTE (forenklingen 2026-08-21). Pulsen var blitt en
  // PARALLELL HENDELSESNAVIGATOR som duplisert kamphistorien rett under.
  // Modellen vet fortsatt alt den visste — `clusters` bærer type, side, HEIA
  // og kommentarer — men ingenting av det er lenger en knapp.

  return {
    span: timeline.span,
    line,
    fill,
    ribbon,
    ticks: ticks.map(t => ({x: xOf(t.seconds), kind: t.kind})),
    clusters,
    // Fasene er MINUTT-språk («MEST LIV · 34′–41′»), så de får kampens
    // lengde i minutter. En kamp på 60 sekunder har ingen faser, og det er
    // riktig: det finnes ikke en «rolig periode» i en kamp som varte ett minutt.
    phases: pulsePhases(moments, timeline.span / 60),
    moments: [...moments].sort(
      (a, b) => a.seconds - b.seconds || a.sequence - b.sequence,
    ),
  };
}

// ---------------------------------------------------------------------------
// FASENE
//
// ⚠️ DE SKAL FAKTISK FINNES, OG DE SKAL VÆRE DETERMINISTISKE (Brage: dette
// var hovedkritikken). Men de skal også TIE når datagrunnlaget er tynt — en
// kamp med tre hendelser skal ikke få en dramatisk konklusjon.
//
// ⚠️ ALDRI «PRESS» ELLER «DOMINANS». Vi kjenner bare RAPPORTERTE hendelser,
// og fraværet av en rapport er ikke fraværet av spill.
// ---------------------------------------------------------------------------

export function pulsePhases(
  moments: PulseMoment[],
  span: number,
): PulsePhase[] {
  const minutes = moments.map(m => m.minute).sort((a, b) => a - b);
  const phases: PulsePhase[] = [];

  // MEST LIV: glidende vindu med flest hendelser. Kun hvis vinduet både har
  // nok i seg OG er dobbelt så tett som kampen ellers.
  let busiest: PulsePhase | undefined;
  if (minutes.length >= 3) {
    const win = Math.max(4, Math.round(span / 6));
    let best = 0;
    let bestAt = 0;
    for (let m = 0; m + win <= span; m++) {
      const n = minutes.filter(x => x >= m && x <= m + win).length;
      if (n > best) {
        best = n;
        bestAt = m;
      }
    }
    const average = (minutes.length * win) / Math.max(1, span);
    if (best >= 3 && best >= 2 * average) {
      busiest = {
        kind: 'busiest',
        from: bestAt,
        to: Math.min(span, bestAt + win),
      };
      phases.push(busiest);
    }
  }

  // ROLIG: lengste hull. Må være reelt langt, og må ikke påstå noe om et
  // minutt MEST LIV allerede har uttalt seg om.
  if (minutes.length >= 2) {
    const marks = [0, ...minutes, span];
    let longest = 0;
    let at: [number, number] = [0, 0];
    for (let i = 1; i < marks.length; i++) {
      const gap = marks[i] - marks[i - 1];
      if (gap > longest) {
        longest = gap;
        at = [marks[i - 1], marks[i]];
      }
    }
    // ⚠️ DE TO SKAL ALDRI PÅSTÅ NOE OM SAMME MINUTT — men den rolige
    // perioden BESKJÆRES heller enn å forsvinne. «Mest liv 0′–10′» ved
    // siden av «Rolig 6′–48′» er selvmotsigende; «Rolig 10′–48′» er sant,
    // og en kamp med en lang stille periode skal få si det.
    if (busiest && at[0] < busiest.to && at[1] > busiest.from) {
      const før: [number, number] = [at[0], Math.min(at[1], busiest.from)];
      const etter: [number, number] = [Math.max(at[0], busiest.to), at[1]];
      at = etter[1] - etter[0] >= før[1] - før[0] ? etter : før;
      longest = at[1] - at[0];
    }
    if (longest >= Math.max(8, span * 0.25)) {
      phases.push({kind: 'quiet', from: at[0], to: at[1]});
    }
  }

  return phases;
}
