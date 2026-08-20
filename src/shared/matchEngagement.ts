import type {MatchEventType} from './types';

/**
 * KAMPENS ENGASJEMENT — hvilken post et øyeblikk henger på, og hva man får
 * lov til å gjøre med det.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DETTE LIGGER I `shared/` OG IKKE I KOMPONENTEN
 *
 * To regler her er PRODUKTBESLUTNINGER, ikke visning:
 *
 *   1. Hvilken feed-post som er den KANONISKE for et øyeblikk. Koblingen
 *      `feed_posts.match_event_id` er 1:N med vilje (00071), så valget må
 *      være deterministisk — ellers kan to klienter heie på hver sin post
 *      for det samme målet, og tellerne blir uenige for alltid.
 *   2. At det ikke finnes HEIA på mål imot (P1, låst av Brage 2026-08-20).
 *
 * Begge skal kunne testes uten å montere en skjerm, og begge skal gjelde
 * uendret når feedens egen gate bygges (skive 9).
 */

/** Én rad fra `get_match_feed` (00071), mappet. */
export interface MatchFeedPost {
  postId: string;
  /** Øyeblikket posten hører til. Mangler på frittstående lagposter. */
  matchEventId?: string;
  /** `feed_posts.type` — 'match_start' | 'match_event' | 'match_end' | 'bilde' … */
  postType: string;
  createdAt: Date;
  heiaCount: number;
  commentCount: number;
  iReacted: boolean;
}

/** Det en engasjementslinje trenger for å tegne seg og kunne trykkes. */
export interface MatchEngagement {
  postId: string;
  heiaCount: number;
  commentCount: number;
  iReacted: boolean;
}

/** Eldst først, med id som tie-break så to poster i samme millisekund aldri
 *  bytter plass mellom to klienter. */
function oldestFirst(a: MatchFeedPost, b: MatchFeedPost): number {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.postId < b.postId ? -1 : a.postId > b.postId ? 1 : 0)
  );
}

/**
 * DEN KANONISKE POSTEN FOR ETT ØYEBLIKK.
 *
 * Regelen er «eldste rad der `post_type <> 'bilde'`»: hendelsens egen post
 * skrives i SAMME transaksjon som hendelsen (00020/00021), mens bildepostene
 * kommer etterpå og kan være mange.
 *
 * ⚠️ MEN DEN MÅ HA EN FALLBACK, OG DET ER IKKE TEORI.
 * «Slett innlegget» i feeden treffer i dag målposter (P3s andre halvvei, som
 * står ÅPEN i prod til skive 8). Sletter reporteren målposten sin, står
 * hendelsen igjen i kampforløpet med bare bildeposten sin — og uten fallback
 * ville raden sagt «heia her» uten å ha noe å heie på. Da velger vi eldste
 * tilgjengelige post i stedet. Engasjementet lander på bildet, som er det
 * eneste som er igjen av øyeblikket, og knappen er aldri død.
 */
export function pickCanonicalPost(
  posts: MatchFeedPost[],
): MatchFeedPost | undefined {
  if (posts.length === 0) {
    return undefined;
  }
  const sorted = [...posts].sort(oldestFirst);
  return sorted.find(p => p.postType !== 'bilde') ?? sorted[0];
}

/**
 * Radene fra RPC-en, gjort til de to oppslagene forløpet trenger:
 *
 *   · `byMatchEvent` — én kanonisk post per øyeblikk (mål, oppdatering).
 *   · `byPost` — direkte oppslag for et FRITTSTÅENDE kampbilde, som er sin
 *     egen rad i forløpet og derfor sin egen post. (`MatchPhoto.id` ER
 *     post-id-en — se `getMatchPhotos`.)
 */
export function buildMatchEngagement(posts: MatchFeedPost[]): {
  byMatchEvent: Map<string, MatchEngagement>;
  byPost: Map<string, MatchEngagement>;
} {
  const grouped = new Map<string, MatchFeedPost[]>();
  const byPost = new Map<string, MatchEngagement>();

  for (const post of posts) {
    byPost.set(post.postId, toEngagement(post));
    if (!post.matchEventId) {
      continue;
    }
    const list = grouped.get(post.matchEventId);
    if (list) {
      list.push(post);
    } else {
      grouped.set(post.matchEventId, [post]);
    }
  }

  const byMatchEvent = new Map<string, MatchEngagement>();
  for (const [matchEventId, list] of grouped) {
    const canonical = pickCanonicalPost(list);
    if (canonical) {
      byMatchEvent.set(matchEventId, toEngagement(canonical));
    }
  }

  return {byMatchEvent, byPost};
}

function toEngagement(post: MatchFeedPost): MatchEngagement {
  return {
    postId: post.postId,
    heiaCount: post.heiaCount,
    commentCount: post.commentCount,
    iReacted: post.iReacted,
  };
}

export interface EngagementSubject {
  type: MatchEventType;
  teamSide?: 'home' | 'away';
}

/**
 * HAR ØYEBLIKKET EN ENGASJEMENTSLINJE I DET HELE TATT?
 *
 * Rytmemarkørene (avspark, pause, 2. omgang, slutt) HAR feed-poster — de
 * skrives av `start_match`/`report_match_event` som alt annet — men de er
 * kampens gater, ikke øyeblikk man reagerer på. Fasiten kaller ikke
 * `engRow()` på dem, og en krittstrek med et HEIA-tall under ville gjort
 * rytmen til innhold.
 *
 * `bytte`/`kort` finnes kun som historiske importdata og rapporteres aldri
 * fra appen, så de har ingen post å henge på.
 */
export function showsEngagement(event: EngagementSubject): boolean {
  return event.type === 'mål' || event.type === 'melding';
}

/**
 * ⚠️ P1, LÅST AV BRAGE 2026-08-20: INGEN HEIA PÅ MÅL IMOT.
 *
 * Verken i kampen eller i feeden — det er samme kanoniske post, så regelen
 * må gjelde begge flatene. Kommentarer er tillatt: et mål imot er noe man
 * snakker om, ikke noe man feirer.
 *
 * ⚠️ `teamSide` kan mangle (skal ikke skje etter 00020). Da behandles målet
 * som mål imot — samme forsiktighetsregel som `nodeKindFor` bruker: bedre å
 * underfeire eget mål enn å feire motstanderens.
 */
export function allowsHeia(event: EngagementSubject): boolean {
  if (event.type === 'mål') {
    return event.teamSide === 'home';
  }
  return event.type === 'melding';
}
