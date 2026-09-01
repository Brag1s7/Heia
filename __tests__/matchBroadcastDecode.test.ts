/**
 * @format
 *
 * S3b-2: dekoderens vakter — fryser reglene i docs/S3B2-BROADCAST-DECODE.md
 * (fasiten). Fixturene er FULLSTENDIG ANONYMISERTE: strukturen (feltnavn,
 * typer, seq-form) fra ekte 00080-konvolutter, alle id-er/navn/tekster er
 * syntetiske.
 */
import {
  createMatchDecodeState,
  decodeMatchBroadcast,
  type MatchDecodeState,
} from '../src/lib/api/matchBroadcastDecode';

// ---------------------------------------------------------------------------
// Anonymisert fixture — strukturen fra en ekte 00080-rad, syntetisk innhold.
// ---------------------------------------------------------------------------
const SESSION_ID = '00000000-0000-4000-8000-0000000000ff';

let idCounter = 0;
function envelope(overrides: Record<string, unknown> = {}) {
  idCounter += 1;
  return {
    v: 1,
    message_id: `00000000-0000-4000-8000-${String(idCounter).padStart(
      12,
      '0',
    )}`,
    entity_id: '00000000-0000-4000-8000-0000000000aa',
    seq: 1,
    emitted_at: '2026-01-01T12:00:00.000000+00:00',
    data: {},
    ...overrides,
  };
}

function matchEventEnvelope(
  seq: number,
  op: string,
  rowOverrides: Record<string, unknown> = {},
) {
  return envelope({
    seq,
    data: {
      id: `00000000-0000-4000-8000-9990000000${String(seq).padStart(2, '0')}`,
      match_session_id: SESSION_ID,
      type: 'mål',
      minute: 10 + seq,
      team_side: 'home',
      description: 'Testscorer',
      reported_by: '00000000-0000-4000-8000-0000000000cc',
      sequence: seq,
      created_at: '2026-01-01T12:00:00+00:00',
      op,
      ...rowOverrides,
    },
  });
}

function sessionEnvelope(
  updatedAt: string,
  overrides: Record<string, unknown> = {},
) {
  return envelope({
    seq: {status: 'live', updated_at: updatedAt},
    data: {
      id: SESSION_ID,
      event_id: '00000000-0000-4000-8000-0000000000ee',
      status: 'live',
      home_score: 2,
      away_score: 1,
      updated_at: updatedAt,
      op: 'UPDATE',
      ...overrides,
    },
  });
}

let state: MatchDecodeState;
beforeEach(() => {
  state = createMatchDecodeState();
});

// ---------------------------------------------------------------------------
// §1 Konvoluttvalidering
// ---------------------------------------------------------------------------
test('ugyldig konvolutt → fallback: null, feil v, manglende message_id, data ikke objekt', () => {
  for (const bad of [
    null,
    'streng',
    envelope({v: 2}),
    envelope({message_id: undefined}),
    envelope({data: null}),
    envelope({data: 'ikke-objekt'}),
  ]) {
    expect(decodeMatchBroadcast('match_event', bad, state)).toEqual([
      {kind: 'fallback'},
    ]);
  }
});

// ---------------------------------------------------------------------------
// §2 Dedupe KUN på message_id
// ---------------------------------------------------------------------------
test('samme message_id leveres én gang; LRU kaster de eldste', () => {
  const env = matchEventEnvelope(1, 'INSERT');
  expect(decodeMatchBroadcast('match_event', env, state)).toHaveLength(1);
  expect(decodeMatchBroadcast('match_event', env, state)).toEqual([]);

  // 200 nye id-er dytter den første ut av LRU-en → den slipper gjennom igjen
  // (og fanges da av seq-/apply-laget, ikke av dedupen).
  for (let i = 0; i < 200; i++) {
    decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'UPDATE'), state);
  }
  expect(decodeMatchBroadcast('match_event', env, state)).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// §3 seq-reglene (planjustering 3, LÅST)
// ---------------------------------------------------------------------------
test('INSERT i rekkefølge → matchEvent; gap (seq > lastSeq+1) → resync alene', () => {
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(1, 'INSERT'), state),
  ).toEqual([
    {kind: 'matchEvent', row: expect.objectContaining({sequence: 1})},
  ]);
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'INSERT'), state),
  ).toEqual([
    {kind: 'matchEvent', row: expect.objectContaining({sequence: 2})},
  ]);
  // 2 → 5 er gap: 3 og 4 mangler. Full resync, raden appliseres ikke.
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(5, 'INSERT'), state),
  ).toEqual([{kind: 'resync'}]);
  // Vannmerket fulgte med til 5: neste INSERT 6 er IKKE gap.
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(6, 'INSERT'), state),
  ).toEqual([
    {kind: 'matchEvent', row: expect.objectContaining({sequence: 6})},
  ]);
});

test('seq-gjenbruk er lovlig: INSERT med seq <= lastSeq appliseres (annullering + ny hendelse)', () => {
  decodeMatchBroadcast('match_event', matchEventEnvelope(1, 'INSERT'), state);
  decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'INSERT'), state);
  // Annullering av seq 2 (DELETE) — neste INSERT får seq 2 på NY id (00020).
  decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'DELETE'), state);
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'INSERT'), state),
  ).toEqual([
    {kind: 'matchEvent', row: expect.objectContaining({sequence: 2})},
  ]);
});

test('UPDATE/DELETE gap-sjekkes aldri; korrigering med gjenbrukt seq gir matchEventUpdate', () => {
  decodeMatchBroadcast('match_event', matchEventEnvelope(5, 'INSERT'), state);
  // Korrigering av en gammel hendelse (seq 2, beholdt fra 00078):
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(2, 'UPDATE'), state),
  ).toEqual([
    {kind: 'matchEventUpdate', row: expect.objectContaining({sequence: 2})},
  ]);
  // Et fjernt DELETE (seq 9) er ikke gap — apply-laget fanger ukjent id.
  expect(
    decodeMatchBroadcast('match_event', matchEventEnvelope(9, 'DELETE'), state),
  ).toEqual([{kind: 'matchEventDelete', id: expect.stringContaining('999')}]);
  // …men vannmerket fulgte med: INSERT 10 er ikke gap.
  expect(
    decodeMatchBroadcast(
      'match_event',
      matchEventEnvelope(10, 'INSERT'),
      state,
    ),
  ).toEqual([
    {kind: 'matchEvent', row: expect.objectContaining({sequence: 10})},
  ]);
});

test('match_event: ikke-numerisk seq, ukjent op og ufullstendig rad → fallback', () => {
  expect(
    decodeMatchBroadcast(
      'match_event',
      envelope({seq: 'x', data: {op: 'INSERT'}}),
      state,
    ),
  ).toEqual([{kind: 'fallback'}]);
  expect(
    decodeMatchBroadcast(
      'match_event',
      matchEventEnvelope(1, 'TRUNCATE'),
      state,
    ),
  ).toEqual([{kind: 'fallback'}]);
  // minute kan være 0 (avspark) — sjekk mot undefined, ikke falsy (pgc-paritet).
  expect(
    decodeMatchBroadcast(
      'match_event',
      matchEventEnvelope(2, 'INSERT', {minute: 0}),
      state,
    ),
  ).toEqual([{kind: 'matchEvent', row: expect.objectContaining({minute: 0})}]);
  expect(
    decodeMatchBroadcast(
      'match_event',
      matchEventEnvelope(3, 'INSERT', {minute: undefined}),
      state,
    ),
  ).toEqual([{kind: 'fallback'}]);
});

// ---------------------------------------------------------------------------
// §4 Dekodetabellen — session, photo/engagement-fellen, reaction, comment
// ---------------------------------------------------------------------------
test('session: gyldig rad → session; manglende felter → fallback', () => {
  expect(
    decodeMatchBroadcast(
      'session',
      sessionEnvelope('2026-01-01T12:05:00+00:00'),
      state,
    ),
  ).toEqual([
    {
      kind: 'session',
      row: expect.objectContaining({home_score: 2, away_score: 1}),
    },
  ]);
  expect(
    decodeMatchBroadcast(
      'session',
      sessionEnvelope('2026-01-01T12:06:00+00:00', {home_score: undefined}),
      state,
    ),
  ).toEqual([{kind: 'fallback'}]);
});

test('session-stale-vernet: eldre updated_at droppes, lik/nyere appliseres', () => {
  decodeMatchBroadcast(
    'session',
    sessionEnvelope('2026-01-01T12:05:00+00:00'),
    state,
  );
  // Redelivery/omordning: eldre stilling skal aldri rulle tilbake.
  expect(
    decodeMatchBroadcast(
      'session',
      sessionEnvelope('2026-01-01T12:04:00+00:00'),
      state,
    ),
  ).toEqual([]);
  // Lik tid appliseres (>=-semantikk), nyere appliseres.
  expect(
    decodeMatchBroadcast(
      'session',
      sessionEnvelope('2026-01-01T12:05:00+00:00'),
      state,
    ),
  ).toHaveLength(1);
  expect(
    decodeMatchBroadcast(
      'session',
      sessionEnvelope('2026-01-01T12:07:00+00:00'),
      state,
    ),
  ).toHaveLength(1);
});

test('⚠️ paritetsfellen: photo med match_event_id emitter BÅDE photo og engagementPost', () => {
  const bare = envelope({data: {id: 'p1', type: 'bilde', op: 'INSERT'}});
  expect(decodeMatchBroadcast('photo', bare, state)).toEqual([{kind: 'photo'}]);

  const festet = envelope({
    data: {id: 'p2', type: 'bilde', match_event_id: 'm1', op: 'INSERT'},
  });
  expect(decodeMatchBroadcast('photo', festet, state)).toEqual([
    {kind: 'photo'},
    {kind: 'engagementPost'},
  ]);

  expect(
    decodeMatchBroadcast(
      'engagement',
      envelope({data: {id: 'p3', op: 'INSERT'}}),
      state,
    ),
  ).toEqual([{kind: 'engagementPost'}]);
});

test('reaction: INSERT/DELETE → ±1 med postId og userId; manglende feed_post_id → fallback', () => {
  const row = {id: 'r1', feed_post_id: 'p1', user_id: 'u1'};
  expect(
    decodeMatchBroadcast(
      'reaction',
      envelope({data: {...row, op: 'INSERT'}}),
      state,
    ),
  ).toEqual([{kind: 'reaction', postId: 'p1', userId: 'u1', delta: 1}]);
  expect(
    decodeMatchBroadcast(
      'reaction',
      envelope({data: {...row, op: 'DELETE'}}),
      state,
    ),
  ).toEqual([{kind: 'reaction', postId: 'p1', userId: 'u1', delta: -1}]);
  expect(
    decodeMatchBroadcast(
      'reaction',
      envelope({data: {id: 'r2', op: 'INSERT'}}),
      state,
    ),
  ).toEqual([{kind: 'fallback'}]);
  expect(
    decodeMatchBroadcast(
      'reaction',
      envelope({data: {...row, op: 'UPDATE'}}),
      state,
    ),
  ).toEqual([]);
});

test('comment: INSERT → +1, soft-delete (UPDATE m/ deleted_at) → −1, redigering og hard DELETE → ingenting', () => {
  const row = {id: 'c1', feed_post_id: 'p1'};
  expect(
    decodeMatchBroadcast(
      'comment',
      envelope({data: {...row, op: 'INSERT'}}),
      state,
    ),
  ).toEqual([{kind: 'commentDelta', postId: 'p1', delta: 1}]);
  expect(
    decodeMatchBroadcast(
      'comment',
      envelope({
        data: {...row, deleted_at: '2026-01-01T12:00:00+00:00', op: 'UPDATE'},
      }),
      state,
    ),
  ).toEqual([{kind: 'commentDelta', postId: 'p1', delta: -1}]);
  expect(
    decodeMatchBroadcast(
      'comment',
      envelope({data: {...row, op: 'UPDATE'}}),
      state,
    ),
  ).toEqual([]);
  expect(
    decodeMatchBroadcast(
      'comment',
      envelope({data: {...row, op: 'DELETE'}}),
      state,
    ),
  ).toEqual([]);
});

test('ukjent event-navn ignoreres (fremoverkompatibilitet)', () => {
  expect(
    decodeMatchBroadcast(
      'fremtidig_event',
      envelope({data: {op: 'INSERT'}}),
      state,
    ),
  ).toEqual([]);
});
