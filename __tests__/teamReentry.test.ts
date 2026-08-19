/**
 * Portene i «forlat lag»-modellen (§3a/b i FORLAT-LAG-DORMANT-2026-08,
 * FROSSET) — ren logikk, testet uten DB. Serveren (join_team_space v4,
 * 00067) håndhever de samme reglene; disse testene fryser appens
 * speiling av dem: siste episode avgjør, id som tiebreak, barne-rader
 * gir aldri gjenåpningsmyndighet, og legacy-rader (leftReason null)
 * behandles som fjernet.
 */
import {
  assessReentry,
  latestEpisode,
  type MembershipHistoryRow,
} from '../src/shared/teamReentry';

function row(
  overrides: Partial<MembershipHistoryRow> & {id: string},
): MembershipHistoryRow {
  return {
    status: 'removed',
    role: 'forelder',
    managedChildId: null,
    joinedAt: null,
    leftReason: null,
    ...overrides,
  };
}

describe('latestEpisode — §3b-ordningen (joinedAt DESC NULLS LAST, id tiebreak)', () => {
  test('tom liste → null', () => {
    expect(latestEpisode([])).toBeNull();
  });

  test('høyeste joinedAt vinner', () => {
    const a = row({id: 'a', joinedAt: '2026-01-01T00:00:00Z'});
    const b = row({id: 'b', joinedAt: '2026-06-01T00:00:00Z'});
    expect(latestEpisode([a, b])?.id).toBe('b');
    expect(latestEpisode([b, a])?.id).toBe('b');
  });

  test('rad MED joinedAt slår rad uten (NULLS LAST)', () => {
    const utenTid = row({id: 'z'});
    const medTid = row({id: 'a', joinedAt: '2026-01-01T00:00:00Z'});
    expect(latestEpisode([utenTid, medTid])?.id).toBe('a');
    expect(latestEpisode([medTid, utenTid])?.id).toBe('a');
  });

  test('samme joinedAt → id som tiebreak (familie innmeldt i samme sekund)', () => {
    const t = '2026-05-01T00:00:00Z';
    const a = row({id: 'aaa', joinedAt: t});
    const b = row({id: 'bbb', joinedAt: t});
    expect(latestEpisode([a, b])?.id).toBe('bbb');
    expect(latestEpisode([b, a])?.id).toBe('bbb');
  });
});

describe('assessReentry — §3b: siste episode avgjør', () => {
  test('ingen historikk = ukjent kodebruker: ingen porter, ingen myndighet', () => {
    const r = assessReentry([]);
    expect(r).toEqual({
      resident: false,
      blockedRemoved: false,
      leftVoluntarily: false,
      reopenRole: null,
    });
  });

  test('levende rad → resident, aldri blokkert', () => {
    const r = assessReentry([
      row({id: 'a', status: 'active', joinedAt: '2026-01-01T00:00:00Z'}),
    ]);
    expect(r.resident).toBe(true);
    expect(r.blockedRemoved).toBe(false);
    expect(r.reopenRole).toBeNull();
  });

  test('fjernet sist → blokkert', () => {
    const r = assessReentry([
      row({
        id: 'a',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'removed',
      }),
    ]);
    expect(r.blockedRemoved).toBe(true);
    expect(r.leftVoluntarily).toBe(false);
  });

  test('legacy-rad (leftReason null) behandles som fjernet — §3c-backfillen', () => {
    const r = assessReentry([
      row({id: 'a', joinedAt: '2026-01-01T00:00:00Z', leftReason: null}),
    ]);
    expect(r.blockedRemoved).toBe(true);
  });

  test('frivillig utmeldt sist → inn (også i låst lag)', () => {
    const r = assessReentry([
      row({id: 'a', joinedAt: '2026-01-01T00:00:00Z', leftReason: 'left'}),
    ]);
    expect(r.leftVoluntarily).toBe(true);
    expect(r.blockedRemoved).toBe(false);
  });

  test('eldre frivillig utmelding gir ALDRI adgang etter senere fjerning', () => {
    const r = assessReentry([
      row({id: 'a', joinedAt: '2026-01-01T00:00:00Z', leftReason: 'left'}),
      row({
        id: 'b',
        joinedAt: '2026-06-01T00:00:00Z',
        leftReason: 'removed',
      }),
    ]);
    expect(r.blockedRemoved).toBe(true);
    expect(r.leftVoluntarily).toBe(false);
    expect(r.reopenRole).toBeNull();
  });
});

describe('assessReentry — §3f-2: gjenåpningsmyndighet', () => {
  test('tidligere trener som meldte seg ut selv → reopenRole', () => {
    const r = assessReentry([
      row({
        id: 'a',
        role: 'trener',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
    ]);
    expect(r.reopenRole).toBe('trener');
  });

  test('tidligere forelder som meldte seg ut → inn, men ingen myndighet', () => {
    const r = assessReentry([
      row({
        id: 'a',
        role: 'forelder',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
    ]);
    expect(r.leftVoluntarily).toBe(true);
    expect(r.reopenRole).toBeNull();
  });

  test('barne-rader gir aldri gjenåpningsmyndighet — kun den PERSONLIGE raden teller', () => {
    // Forelderen har KUN barne-rader (rolle forelder via CHECK-constrainten),
    // og en gammel personlig trenerrad finnes ikke.
    const r = assessReentry([
      row({
        id: 'a',
        role: 'forelder',
        managedChildId: 'barn-1',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
    ]);
    expect(r.leftVoluntarily).toBe(true);
    expect(r.reopenRole).toBeNull();
  });

  test('trener-som-også-er-forelder: nyeste PERSONLIGE rad bærer myndigheten selv når en barne-rad er nyest', () => {
    const r = assessReentry([
      row({
        id: 'a',
        role: 'trener',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
      row({
        id: 'b',
        role: 'forelder',
        managedChildId: 'barn-1',
        joinedAt: '2026-02-01T00:00:00Z',
        leftReason: 'left',
      }),
    ]);
    expect(r.reopenRole).toBe('trener');
  });

  test('personlig rad som ble FJERNET gir ingen myndighet, selv med gammel left-episode', () => {
    const r = assessReentry([
      row({
        id: 'a',
        role: 'trener',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
      row({
        id: 'b',
        role: 'trener',
        joinedAt: '2026-06-01T00:00:00Z',
        leftReason: 'removed',
      }),
    ]);
    expect(r.blockedRemoved).toBe(true);
    expect(r.reopenRole).toBeNull();
  });

  test('resident har aldri reopenRole — gjenåpning er for dem som er UTE', () => {
    const r = assessReentry([
      row({
        id: 'a',
        role: 'trener',
        joinedAt: '2026-01-01T00:00:00Z',
        leftReason: 'left',
      }),
      row({
        id: 'b',
        role: 'supporter',
        status: 'active',
        joinedAt: '2026-06-01T00:00:00Z',
      }),
    ]);
    expect(r.resident).toBe(true);
    expect(r.reopenRole).toBeNull();
  });
});
