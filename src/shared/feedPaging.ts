// ---------------------------------------------------------------------------
// Feed-pagineringens RENE logikk (B2): cursor-valg og side-flating.
//
// Ligger utenfor `lib/queries/feed` med vilje — samme grep som `shared/inbox`:
// der bor query-cachen og nettverkskoblingen, her er alt rene funksjoner som
// kan verifiseres uten app og uten simulator.
//
// Bakteppet er sorteringen i `get_team_feed` (00029):
//   ORDER BY is_pinned DESC, created_at DESC ... AND created_at < cursor
// Pinnede poster resorteres altså ØVERST på HVER side, også når deres
// created_at er eldre enn cursoren. Det gir to feller cursor-laget må løse:
//   1. Cursoren til neste side må være eldste U-PINNEDE rad på siden —
//      var siste rad en gammel pinnet post, ville alt mellom den og siste
//      vanlige post blitt hoppet over.
//   2. En pinnet post dukker opp igjen på senere sider (created_at < cursor
//      slipper den gjennom, sorteringen løfter den opp) — flatingen deduper
//      derfor på id.
// ---------------------------------------------------------------------------

import type {FeedItem} from './types';

/** Sidestørrelsen feeden henter med (RPC-ens `lim`). */
export const FEED_PAGE_SIZE = 20;

/**
 * Cursor til NESTE side, eller null når det ikke finnes flere.
 *
 * RPC-en har ikke noe hasMore-signal (LIMIT uten +1), så «kort side» er
 * slutt-heuristikken: en side med færre enn `pageSize` rader er den siste.
 * Deler totalen seg nøyaktig på sidestørrelsen koster det ÉN tom
 * ekstra-henting — akseptert fremfor å endre RPC-signaturen (00060-grantene
 * er bundet til eksakt signatur).
 *
 * KJENT GRENSE: cursoren er `created_at` alene (strikt `<` i 00029, ingen
 * id-tiebreaker), og JS-Date trunkerer DB-ens mikrosekunder til ms — så både
 * rader i SAMME transaksjon (identisk timestamp) og rader i samme
 * MILLISEKUND som grenseraden kan hoppes over til neste kalde last, hvis
 * sidegrensen lander midt i gruppen. Ordentlig fiks krever sammensatt cursor
 * i RPC-en (egen migrasjon + gjenskapte grants); tas den dagen det
 * observeres.
 */
export function nextFeedCursor(
  page: FeedItem[],
  pageSize: number = FEED_PAGE_SIZE,
): string | null {
  if (page.length < pageSize) {
    return null;
  }
  for (let i = page.length - 1; i >= 0; i--) {
    if (!page[i].isPinned) {
      return page[i].createdAt.toISOString();
    }
  }
  // Hele siden pinnet (kan bare skje når laget har ≥ pageSize pinnede
  // poster): gå videre fra siste rad — bedre å risikere et hopp enn å
  // paginere i ring.
  return page[page.length - 1].createdAt.toISOString();
}

/**
 * Sidene → ÉN visningsliste. Rekkefølgen bevares (side 1 først), duplikater
 * fjernes på id — det er slik de resorterte pinnede postene fra felle 2
 * over forsvinner: første forekomst (øverst på side 1) vinner.
 */
export function flattenFeedPages(pages: FeedItem[][]): FeedItem[] {
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const page of pages) {
    for (const item of page) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}
