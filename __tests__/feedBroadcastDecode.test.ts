/**
 * @format
 *
 * S3c: feed-dekoderen — fryser dekodetabellen fra
 * docs/S3C-BROADCAST-FEED-NOTIF.md §3 (pgc-paritet med `subscribeToFeed`).
 */

import {
  createFeedDecodeState,
  decodeFeedBroadcast,
} from '../src/lib/api/feedBroadcastDecode';

const HEIA = '👏';
const ME = 'user-me';

let idCounter = 0;
function envelope(data: Record<string, unknown>, messageId?: string) {
  idCounter += 1;
  return {
    v: 1,
    message_id:
      messageId ??
      `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    entity_id: '00000000-0000-4000-8000-0000000000aa',
    seq: {created_at: '2026-01-01T12:00:00+00:00'},
    emitted_at: '2026-01-01T12:00:00+00:00',
    data,
  };
}

function decode(
  eventName: string,
  data: Record<string, unknown>,
  state = createFeedDecodeState(),
) {
  return decodeFeedBroadcast(eventName, envelope(data), ME, HEIA, state);
}

describe('konvolutt og dedupe (delt §1–§2)', () => {
  it('ugyldig konvolutt → fallback; ukjent v → fallback', () => {
    const state = createFeedDecodeState();
    expect(decodeFeedBroadcast('feed_post', null, ME, HEIA, state)).toEqual([
      {kind: 'fallback'},
    ]);
    expect(
      decodeFeedBroadcast(
        'feed_post',
        {v: 2, message_id: 'x', data: {}},
        ME,
        HEIA,
        state,
      ),
    ).toEqual([{kind: 'fallback'}]);
  });

  it('kjent message_id droppes stille — redelivery teller aldri dobbelt', () => {
    const state = createFeedDecodeState();
    const env = envelope({op: 'INSERT', id: 'p1'});
    expect(decodeFeedBroadcast('feed_post', env, ME, HEIA, state)).toEqual([
      {kind: 'postNew'},
    ]);
    expect(decodeFeedBroadcast('feed_post', env, ME, HEIA, state)).toEqual([]);
  });
});

describe('feed_post', () => {
  it('INSERT → postNew; soft-slettet INSERT → ingenting', () => {
    expect(decode('feed_post', {op: 'INSERT', id: 'p1'})).toEqual([
      {kind: 'postNew'},
    ]);
    expect(
      decode('feed_post', {op: 'INSERT', id: 'p1', deleted_at: '2026-01-01'}),
    ).toEqual([]);
  });

  it('UPDATE med id → postUpdate med raden; uten id → fallback', () => {
    expect(
      decode('feed_post', {op: 'UPDATE', id: 'p1', is_pinned: true}),
    ).toEqual([
      {
        kind: 'postUpdate',
        row: expect.objectContaining({id: 'p1', is_pinned: true}),
      },
    ]);
    expect(decode('feed_post', {op: 'UPDATE'})).toEqual([{kind: 'fallback'}]);
  });

  it('ukjent op (triggeren er kun I/U) → fallback', () => {
    expect(decode('feed_post', {op: 'DELETE', id: 'p1'})).toEqual([
      {kind: 'fallback'},
    ]);
  });
});

describe('reaction — ekko-filteret fra pgc-stien', () => {
  const base = {feed_post_id: 'p1', user_id: 'user-other', emoji: HEIA};

  it('INSERT/DELETE fra andre med 👏 → reaction ±1', () => {
    expect(decode('reaction', {...base, op: 'INSERT'})).toEqual([
      {kind: 'reaction', postId: 'p1', delta: 1},
    ]);
    expect(decode('reaction', {...base, op: 'DELETE'})).toEqual([
      {kind: 'reaction', postId: 'p1', delta: -1},
    ]);
  });

  it('eget ekko og annen emoji → ingenting (alt applisert optimistisk)', () => {
    expect(decode('reaction', {...base, op: 'INSERT', user_id: ME})).toEqual(
      [],
    );
    expect(decode('reaction', {...base, op: 'INSERT', emoji: '🔥'})).toEqual(
      [],
    );
  });

  it('manglende feed_post_id → fallback; ukjent op → ingenting', () => {
    expect(
      decode('reaction', {op: 'INSERT', user_id: 'u2', emoji: HEIA}),
    ).toEqual([{kind: 'fallback'}]);
    expect(decode('reaction', {...base, op: 'UPDATE'})).toEqual([]);
  });
});

describe('comment — soft-delete er en UPDATE (pgc-paritet)', () => {
  it('INSERT → +1; UPDATE m/ deleted_at → −1', () => {
    expect(decode('comment', {op: 'INSERT', feed_post_id: 'p1'})).toEqual([
      {kind: 'commentDelta', postId: 'p1', delta: 1},
    ]);
    expect(
      decode('comment', {op: 'UPDATE', feed_post_id: 'p1', deleted_at: 'nå'}),
    ).toEqual([{kind: 'commentDelta', postId: 'p1', delta: -1}]);
  });

  it('redigering (UPDATE uten deleted_at) og hard DELETE → ingenting', () => {
    expect(decode('comment', {op: 'UPDATE', feed_post_id: 'p1'})).toEqual([]);
    expect(decode('comment', {op: 'DELETE', feed_post_id: 'p1'})).toEqual([]);
  });

  it('manglende feed_post_id → fallback', () => {
    expect(decode('comment', {op: 'INSERT'})).toEqual([{kind: 'fallback'}]);
  });
});

describe('fremoverkompatibilitet', () => {
  it('live og ukjente eventnavn → ingenting i feed-dekoderen', () => {
    expect(decode('live', {op: 'UPDATE', status: 'live'})).toEqual([]);
    expect(decode('fremtidig_event', {op: 'INSERT'})).toEqual([]);
  });
});
