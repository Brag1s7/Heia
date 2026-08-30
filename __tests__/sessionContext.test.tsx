/**
 * @format
 *
 * BOOT-/RESUME-KONTEKSTEN (S2, skaleringsplan §1.4 + §1.5).
 *
 * Fem kontrakter fryses her, mot den EKTE api-mappingen og den EKTE
 * orkestratoren (kun supabase.rpc og signeringen er mocket):
 *
 *   1. MAPPINGEN: RPC-payloaden (00079-formen) går gjennom de SAMME
 *      mapperne som enkeltkallene — profil, membership-embedden,
 *      livekampen (LIVE_MATCH_COLUMNS-formen) og lagkassa.
 *   2. SEEDINGEN: ett kontekst-kall legger livekamp + lagkassa FERSKT i
 *      query-cachen og flaggene i runtimeConfig — og peek treffer.
 *   3. SINGLE-FLIGHT + maxAge: samtidige kall = ETT RPC-kall; et ferskt
 *      svar gjenbrukes innenfor maxAgeMs (boot-fan-in-en).
 *   4. TRYGG DEGRADERING: RPC-feil (inkl. base uten 00079) gir null —
 *      aldri throw, ingen seeding, flaggene står på defaults = dagens
 *      atferd. Søppel i runtime_flags sanitiseres per felt.
 *   5. GENERASJONSVERNET: abandon (utlogging) dreper svar i flukt — de
 *      seeder aldri neste brukers tomme cache.
 */

import {queryClient} from '../src/lib/queries/queryClient';
import {liveMatchKey} from '../src/lib/queries/liveMatch';
import {supportSummaryKey} from '../src/lib/queries/supportSummary';
import {
  getRuntimeConfig,
  resetRuntimeConfig,
  sanitizeRuntimeFlags,
  DEFAULT_RUNTIME_FLAGS,
} from '../src/lib/runtimeConfig';
import {getSessionContext} from '../src/lib/api/sessionContext';
import {
  refreshSessionContext,
  peekSessionContext,
  abandonSessionContext,
} from '../src/lib/queries/sessionContext';

const mockRpc = jest.fn();
jest.mock('../src/lib/supabase', () => ({
  supabase: {rpc: (...a: unknown[]) => mockRpc(...a)},
}));

const mockPrimeAvatars = jest.fn(() => Promise.resolve());
jest.mock('../src/lib/media/avatar', () => ({
  primeAvatars: (...a: unknown[]) => mockPrimeAvatars(...a),
}));

/** Payload nøyaktig slik 00079 bygger den (verify-00079 D1/D2 vokter SQL-siden). */
function rpcPayload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    profile: {
      id: 'user-1',
      display_name: 'Brage',
      avatar_url: 'user-1/avatar.jpg',
      avatar_color: '#123456',
      phone: null,
      locale: 'nb',
      onboarding_completed: true,
      onboarding_completed_at: null,
      household_id: null,
    },
    memberships: [
      {
        id: 'm1',
        user_id: 'user-1',
        team_space_id: 'ts-1',
        role: 'trener',
        status: 'active',
        joined_at: '2026-08-01T10:00:00+00:00',
        managed_child_id: null,
        managed_child: null,
        team_space: {
          id: 'ts-1',
          team_id: 't-1',
          display_name: 'Heia G12',
          color: '#112233',
          logo_url: null,
          invite_code: 'ABCDEFGH',
          is_activated: false,
          activated_at: null,
          team: {
            id: 't-1',
            name: 'G12',
            age_group: '2014',
            gender: 'mixed',
            level: null,
            club: {
              id: 'c-1',
              name: 'Verify IL',
              short_name: 'VIL',
              logo_url: null,
            },
            sport: {id: 's-1', slug: 'fotball', display_name: 'Fotball'},
          },
        },
      },
    ],
    team_space_id: 'ts-1',
    member_count: 12,
    unread_count: 3,
    live_match: {
      id: 'ev-1',
      type: 'kamp',
      title: 'Kamp mot Motstander',
      description: null,
      location: null,
      start_time: '2026-08-26T17:00:00+00:00',
      end_time: null,
      match_sessions: {
        id: 'ms-1',
        opponent: 'Motstander',
        home_score: 2,
        away_score: 1,
        is_home: true,
        status: 'live',
        reporter_id: null,
        started_at: '2026-08-26T17:05:00+00:00',
        played_seconds: 600,
        clock_started_at: null,
      },
    },
    support_summary: {
      supporters: 4,
      monthly_to_club_minor: 24000,
      total_to_club_minor: 96000,
      currency: 'nok',
      since: '2026-06-01T00:00:00+00:00',
    },
    runtime_flags: {
      realtime_transport: {match: 'pgc', feed: 'pgc', notif: 'pgc'},
      live_fallback_poll_s: 0,
      min_build: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  abandonSessionContext();
  queryClient.clear();
  resetRuntimeConfig();
});

describe('api-mappingen (kontrakt 1)', () => {
  it('mapper hele payloaden gjennom de delte mapperne', async () => {
    mockRpc.mockResolvedValueOnce({data: rpcPayload(), error: null});
    const ctx = await getSessionContext('ts-1');

    expect(mockRpc).toHaveBeenCalledWith('get_session_context', {
      p_team_space_id: 'ts-1',
    });

    expect(ctx.profile).toMatchObject({
      id: 'user-1',
      displayName: 'Brage',
      avatarPath: 'user-1/avatar.jpg',
      avatarColor: '#123456',
    });

    expect(ctx.memberships).toHaveLength(1);
    expect(ctx.memberships[0]).toMatchObject({
      teamSpaceId: 'ts-1',
      role: 'trener',
      teamSpace: {displayName: 'Heia G12', inviteCode: 'ABCDEFGH'},
      team: {
        name: 'G12',
        club: {name: 'Verify IL'},
        sport: {slug: 'fotball'},
      },
    });

    expect(ctx.coveredTeamSpaceId).toBe('ts-1');
    expect(ctx.memberCount).toBe(12);
    expect(ctx.unreadCount).toBe(3);

    // Livekampen gjennom mapEventRow: oss/dem-normalisering og status.
    expect(ctx.liveMatch).toMatchObject({
      id: 'ev-1',
      teamSpaceId: 'ts-1',
      matchStatus: 'live',
      opponent: 'Motstander',
      score: {home: 2, away: 1},
    });

    expect(ctx.supportSummary).toEqual({
      supporters: 4,
      monthlyToClubMinor: 24000,
      totalToClubMinor: 96000,
      currency: 'nok',
      since: '2026-06-01T00:00:00+00:00',
    });

    expect(ctx.runtimeFlags).toEqual(DEFAULT_RUNTIME_FLAGS);
  });

  it('udekket lag: scopede felter null, memberships består', async () => {
    mockRpc.mockResolvedValueOnce({
      data: rpcPayload({
        team_space_id: null,
        member_count: null,
        unread_count: null,
        live_match: null,
        support_summary: null,
      }),
      error: null,
    });
    const ctx = await getSessionContext('ts-fremmed');

    expect(ctx.coveredTeamSpaceId).toBeNull();
    expect(ctx.memberCount).toBeNull();
    expect(ctx.unreadCount).toBeNull();
    expect(ctx.liveMatch).toBeNull();
    expect(ctx.supportSummary).toBeNull();
    expect(ctx.memberships).toHaveLength(1);
    expect(ctx.profile?.id).toBe('user-1');
  });
});

describe('orkestratoren (kontrakt 2+3)', () => {
  it('seeder livekamp + lagkassa ferskt og setter flaggene', async () => {
    mockRpc.mockResolvedValueOnce({data: rpcPayload(), error: null});
    const ctx = await refreshSessionContext('ts-1');

    expect(ctx?.coveredTeamSpaceId).toBe('ts-1');

    const live = queryClient.getQueryData<any>(liveMatchKey('ts-1'));
    expect(live?.id).toBe('ev-1');
    const support = queryClient.getQueryData<any>(supportSummaryKey('ts-1'));
    expect(support?.supporters).toBe(4);

    // Fersk dataUpdatedAt = staleTime-hooks refetcher ikke ved mount.
    const state = queryClient.getQueryState(liveMatchKey('ts-1'));
    expect(Date.now() - (state?.dataUpdatedAt ?? 0)).toBeLessThan(5_000);

    expect(getRuntimeConfig()).toEqual(DEFAULT_RUNTIME_FLAGS);
    expect(mockPrimeAvatars).toHaveBeenCalledWith(['user-1/avatar.jpg']);

    // Peek: minneoppslag for dekket lag, miss for andre.
    expect(peekSessionContext('ts-1')?.ctx).toBe(ctx);
    expect(peekSessionContext('ts-2')).toBeNull();
  });

  it('«ingen pågående kamp» seedes som null-DATA, ikke hull', async () => {
    mockRpc.mockResolvedValueOnce({
      data: rpcPayload({live_match: null}),
      error: null,
    });
    await refreshSessionContext('ts-1');
    const state = queryClient.getQueryState(liveMatchKey('ts-1'));
    expect(state).toBeDefined();
    expect(state?.data).toBeNull();
  });

  it('single-flight: samtidige kall deler ETT RPC-kall', async () => {
    let resolve!: (v: unknown) => void;
    mockRpc.mockReturnValueOnce(new Promise(r => (resolve = r)));

    const p1 = refreshSessionContext('ts-1');
    const p2 = refreshSessionContext('ts-1');
    const p3 = refreshSessionContext(); // foreground-lytter uten kandidat
    resolve({data: rpcPayload(), error: null});

    const [c1, c2, c3] = await Promise.all([p1, p2, p3]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(c1).toBe(c2);
    expect(c2).toBe(c3);
  });

  it('maxAgeMs: boot-fan-in gjenbruker ferskt svar, force henter nytt', async () => {
    mockRpc.mockResolvedValue({data: rpcPayload(), error: null});
    await refreshSessionContext('ts-1');
    expect(mockRpc).toHaveBeenCalledTimes(1);

    // UserContext-veien: ingen kandidat, godta ferskt svar.
    const shared = await refreshSessionContext(undefined, {maxAgeMs: 60_000});
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(shared?.profile?.id).toBe('user-1');

    // Ferskt svar for FEIL lag gjenbrukes ikke.
    await refreshSessionContext('ts-2', {maxAgeMs: 60_000});
    expect(mockRpc).toHaveBeenCalledTimes(2);

    // Foreground-veien: alltid ferskt.
    await refreshSessionContext('ts-1');
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });
});

describe('trygg degradering (kontrakt 4)', () => {
  it('RPC-feil (base uten 00079): null, ingen seeding, defaults består', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {code: '42883', message: 'function does not exist'},
    });
    const ctx = await refreshSessionContext('ts-1');

    expect(ctx).toBeNull();
    expect(queryClient.getQueryState(liveMatchKey('ts-1'))).toBeUndefined();
    expect(getRuntimeConfig()).toEqual(DEFAULT_RUNTIME_FLAGS);
    expect(peekSessionContext('ts-1')).toBeNull();
  });

  it('søppel i runtime_flags sanitiseres per felt', () => {
    expect(sanitizeRuntimeFlags(null)).toEqual(DEFAULT_RUNTIME_FLAGS);
    expect(sanitizeRuntimeFlags('kaos')).toEqual(DEFAULT_RUNTIME_FLAGS);
    expect(
      sanitizeRuntimeFlags({
        realtime_transport: {match: 'broadcast', feed: 'webrtc'},
        live_fallback_poll_s: -5,
        min_build: '12',
      }),
    ).toEqual({
      realtimeTransport: {match: 'broadcast', feed: 'pgc', notif: 'pgc'},
      liveFallbackPollS: 0,
      minBuild: 0,
    });
    expect(
      sanitizeRuntimeFlags({
        realtime_transport: {match: 'pgc', feed: 'pgc', notif: 'pgc'},
        live_fallback_poll_s: 120,
        min_build: 42,
      }),
    ).toEqual({
      realtimeTransport: {match: 'pgc', feed: 'pgc', notif: 'pgc'},
      liveFallbackPollS: 120,
      minBuild: 42,
    });
  });
});

describe('generasjonsvernet (kontrakt 5)', () => {
  it('abandon dreper svar i flukt: ingen seeding inn i neste brukers cache', async () => {
    let resolve!: (v: unknown) => void;
    mockRpc.mockReturnValueOnce(new Promise(r => (resolve = r)));

    const p = refreshSessionContext('ts-1');
    abandonSessionContext(); // utlogging mens kallet er i flukt
    resolve({data: rpcPayload(), error: null});

    expect(await p).toBeNull();
    expect(queryClient.getQueryState(liveMatchKey('ts-1'))).toBeUndefined();
    expect(peekSessionContext('ts-1')).toBeNull();
    expect(getRuntimeConfig()).toEqual(DEFAULT_RUNTIME_FLAGS);
  });
});
