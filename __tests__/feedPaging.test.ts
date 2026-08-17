import {
  FEED_PAGE_SIZE,
  flattenFeedPages,
  nextFeedCursor,
} from '../src/shared/feedPaging';
import type {FeedItem} from '../src/shared/types';

// ---------------------------------------------------------------------------
// Feed-pagineringen (B2) mot sorteringen i get_team_feed (00029):
//   ORDER BY is_pinned DESC, created_at DESC ... AND created_at < cursor
//
// De to fellene som voktes:
//   1. Cursoren må være eldste U-PINNEDE rad — en gammel pinnet post som
//      resorteres øverst har eldre created_at enn resten av siden, og som
//      cursor ville den hoppet over alt imellom.
//   2. Den samme pinnede posten dukker opp IGJEN på senere sider (strikt
//      `<` slipper den gjennom, sorteringen løfter den opp) — flatingen må
//      dedupe på id, første forekomst vinner.
// ---------------------------------------------------------------------------

function post(id: string, iso: string, pinned = false): FeedItem {
  return {
    id,
    teamSpaceId: 'ts-1',
    type: 'melding',
    author: {id: 'u-1', name: 'Test'},
    createdAt: new Date(iso),
    content: '',
    isPinned: pinned,
  };
}

/** Full side: nyeste først, slik RPC-en leverer. */
function fullPage(prefix: string, pinnedFirst?: FeedItem): FeedItem[] {
  const rows: FeedItem[] = pinnedFirst ? [pinnedFirst] : [];
  let minute = 59;
  while (rows.length < FEED_PAGE_SIZE) {
    rows.push(post(`${prefix}-${rows.length}`, `2026-08-10T12:${minute--}:00Z`));
  }
  return rows;
}

describe('nextFeedCursor', () => {
  it('kort side = siste side → null', () => {
    expect(nextFeedCursor([post('a', '2026-08-10T12:00:00Z')])).toBeNull();
    expect(nextFeedCursor([])).toBeNull();
  });

  it('full side → created_at til siste rad', () => {
    const page = fullPage('p');
    expect(nextFeedCursor(page)).toBe(
      page[page.length - 1].createdAt.toISOString(),
    );
  });

  it('hopper over en gammel PINNET post i bunnen (felle 1)', () => {
    // Pinned øverst i visningen, men vi bygger et tilfelle der en pinnet
    // rad står SIST i arrayet med eldst created_at: cursoren skal komme
    // fra den u-pinnede raden foran, ellers hoppes alt mellom dem over.
    const page = fullPage('p').slice(0, FEED_PAGE_SIZE - 1);
    const lastPlain = page[page.length - 1];
    page.push(post('gammel-pinnet', '2026-07-01T09:00:00Z', true));

    expect(nextFeedCursor(page)).toBe(lastPlain.createdAt.toISOString());
  });

  it('side med KUN pinnede → går videre fra siste rad', () => {
    const page = Array.from({length: FEED_PAGE_SIZE}, (_, i) =>
      post(`pin-${i}`, `2026-08-10T12:${59 - i}:00Z`, true),
    );
    expect(nextFeedCursor(page)).toBe(
      page[page.length - 1].createdAt.toISOString(),
    );
  });
});

describe('flattenFeedPages', () => {
  it('bevarer siderekkefølgen', () => {
    const p1 = [post('a', '2026-08-10T12:02:00Z'), post('b', '2026-08-10T12:01:00Z')];
    const p2 = [post('c', '2026-08-10T12:00:00Z')];
    expect(flattenFeedPages([p1, p2]).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('fjerner den pinnede posten som resorteres inn på side 2 (felle 2)', () => {
    const pinnet = post('viktig', '2026-08-01T10:00:00Z', true);
    const p1 = [pinnet, post('a', '2026-08-10T12:02:00Z')];
    // RPC-en løfter den pinnede ØVERST også på side 2 — første forekomst
    // (fra side 1) skal vinne.
    const p2 = [pinnet, post('b', '2026-08-05T09:00:00Z')];

    expect(flattenFeedPages([p1, p2]).map(i => i.id)).toEqual([
      'viktig',
      'a',
      'b',
    ]);
  });
});
