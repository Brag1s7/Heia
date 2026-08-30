/**
 * @format
 *
 * BOOTBUDSJETT-VAKTEN (S7b) — frø-boot skal ikke reversere S2-gevinsten.
 *
 * Frø-boot monterer hjemskjermen MENS kontekst-RPC-en er i flukt — og da
 * skal livekamp, badge og lagkassa hoppe på det pågående kallet i stedet
 * for å fyre duplikate enkeltkall. Mot den EKTE orkestratoren (inflight),
 * den EKTE api-mappingen og de EKTE query-modulene (kun supabase + de
 * enkeltkall-api-ene som IKKE skal fyre er mocket):
 *
 *   1. VAKTEN: kontekst-promiset holdes uløst, hookene monteres → NULL
 *      enkeltkall (getLiveMatch/getTeamSupportSummary/getUnreadCount), og
 *      flatene står i «venter» (isPending / badge skjult) — aldri falskt 0.
 *   2. SUKSESS: promiset løses → cache/badge oppdateres fra svaret,
 *      fortsatt null enkeltkall. Totalen for hele scenariet er ETT
 *      HTTP-kall (RPC-en) — innenfor det LÅSTE ≤7-budsjettet (§0.1-3):
 *      kontekst 1 + feed 1 + events 2 + signering ≤2 = ≤6 ved frø-boot.
 *   3. FEILSTI: promiset feiler → fallback-enkeltkallene starter ETTER
 *      forsøket (ingen deadlock, ingen permanent disabled query).
 */

import React, {useEffect} from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {QueryClientProvider} from '@tanstack/react-query';

const mockRpc = jest.fn();
jest.mock('../src/lib/supabase', () => {
  const channelObj: any = {
    on: jest.fn(() => channelObj),
    subscribe: jest.fn(() => channelObj),
  };
  return {
    supabase: {
      rpc: (...a: unknown[]) => mockRpc(...a),
      channel: jest.fn(() => channelObj),
      removeChannel: jest.fn(),
    },
  };
});

// Enkeltkallene som IKKE skal fyre mens konteksten er i flukt. Modulene
// mockes i sin helhet; getTeamEvents/mapLiveMatchRow-stubber trengs fordi
// andre moduler i importgrafen bruker dem.
const mockGetLiveMatch = jest.fn();
jest.mock('../src/lib/api/events', () => ({
  getLiveMatch: (...a: unknown[]) => mockGetLiveMatch(...a),
  getTeamEvents: jest.fn(() => Promise.resolve([])),
  mapLiveMatchRow: (row: any) => row,
}));

const mockGetTeamSupportSummary = jest.fn();
jest.mock('../src/lib/api/payments', () => ({
  getTeamSupportSummary: (...a: unknown[]) => mockGetTeamSupportSummary(...a),
}));

const mockGetUnreadCount = jest.fn();
jest.mock('../src/lib/api/notifications', () => ({
  getUnreadCount: (...a: unknown[]) => mockGetUnreadCount(...a),
  markAsRead: jest.fn(() => Promise.resolve()),
  markAllAsRead: jest.fn(() => Promise.resolve()),
}));

const mockGetTeamFeed = jest.fn(() => Promise.resolve([]));
jest.mock('../src/lib/api/feed', () => ({
  getTeamFeed: (...a: unknown[]) => mockGetTeamFeed(...a),
}));

jest.mock('../src/lib/media/avatar', () => ({
  primeAvatars: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/context/UserContext', () => ({
  useAuth: () => ({session: {user: {id: 'user-a'}}}),
}));

jest.mock('../src/context/TeamContext', () => ({
  useActiveTeam: () => ({activeTeamSpaceId: 'ts-1'}),
}));

import {queryClient} from '../src/lib/queries/queryClient';
import {
  refreshSessionContext,
  abandonSessionContext,
} from '../src/lib/queries/sessionContext';
import {useLiveMatch} from '../src/lib/queries/liveMatch';
import {useSupportSummary} from '../src/lib/queries/supportSummary';
import {
  NotificationsProvider,
  useNotifications,
} from '../src/context/NotificationsContext';

/** 00079-payload med dekket lag: ingen pågående kamp (ekte null), lagkassa
 *  og teller satt. Tomme memberships — TeamContext er ikke under test. */
function rpcPayload() {
  return {
    v: 1,
    profile: null,
    memberships: [],
    team_space_id: 'ts-1',
    member_count: 12,
    unread_count: 3,
    live_match: null,
    support_summary: {
      supporters: 4,
      monthly_to_club_minor: 24_000,
      total_to_club_minor: 120_000,
      currency: 'nok',
      since: null,
    },
    runtime_flags: {},
  };
}

function deferredRpc() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  mockRpc.mockReturnValue(promise);
  return {
    resolveWith: (data: unknown) => resolve({data, error: null}),
    fail: () => reject(new Error('Network request failed')),
  };
}

type Snapshot = {
  live: ReturnType<typeof useLiveMatch>;
  support: ReturnType<typeof useSupportSummary>;
  unreadCount: number;
};

function Probe({onRender}: {onRender: (s: Snapshot) => void}) {
  const live = useLiveMatch('ts-1', {appActive: true, inMatch: false});
  const support = useSupportSummary('ts-1');
  const {unreadCount} = useNotifications();
  useEffect(() => {
    onRender({live, support, unreadCount});
  });
  return null;
}

async function renderHome(): Promise<{
  latest: () => Snapshot;
  unmount: () => void;
}> {
  let current: Snapshot | undefined;
  let root: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    root = ReactTestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <Probe onRender={s => (current = s)} />
        </NotificationsProvider>
      </QueryClientProvider>,
    );
  });
  return {
    latest: () => current as Snapshot,
    unmount: () => root?.unmount(),
  };
}

async function waitFor(cond: () => boolean, timeoutMs = 3_000): Promise<void> {
  const started = Date.now();
  while (!cond()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('waitFor: vilkåret slo aldri til');
    }
    await act(async () => {
      await new Promise(res => setTimeout(res, 10));
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  abandonSessionContext();
  queryClient.clear();
  mockGetLiveMatch.mockResolvedValue(null);
  mockGetTeamSupportSummary.mockResolvedValue({supporters: 1});
  mockGetUnreadCount.mockResolvedValue(5);
});

afterEach(() => {
  abandonSessionContext();
  queryClient.clear();
});

test('frø-boot fyrer ingen enkeltkall mens konteksten er i flukt — og bruker svaret når det lander', async () => {
  const rpc = deferredRpc();
  // TeamContext har startet kontekst-kallet (frø-boot) …
  const contextPromise = refreshSessionContext('ts-1');
  expect(mockRpc).toHaveBeenCalledTimes(1);

  // … og hjemskjermen monterer mens det fortsatt er i flukt.
  const home = await renderHome();

  // VENTER, ikke falskt innhold: spørringene er pending (kampknappens
  // 1,5 s-tak i MatchButtonContext er urørt og gjelder som før), badgen
  // viser ingenting — og INGEN duplikate enkeltkall er sendt.
  expect(home.latest().live.isPending).toBe(true);
  expect(home.latest().support.isPending).toBe(true);
  expect(home.latest().unreadCount).toBe(0);
  expect(mockGetLiveMatch).not.toHaveBeenCalled();
  expect(mockGetTeamSupportSummary).not.toHaveBeenCalled();
  expect(mockGetUnreadCount).not.toHaveBeenCalled();

  // Konteksten lander: alle tre flatene fylles fra DET kallet.
  await act(async () => {
    rpc.resolveWith(rpcPayload());
    await contextPromise;
  });
  await waitFor(
    () =>
      home.latest().live.isSuccess &&
      home.latest().support.isSuccess &&
      home.latest().unreadCount === 3,
  );
  expect(home.latest().live.data).toBeNull(); // ekte «ingen pågående kamp»
  expect(home.latest().support.data).toEqual(
    expect.objectContaining({supporters: 4, monthlyToClubMinor: 24_000}),
  );

  // Budsjettet: fortsatt NULL enkeltkall, og RPC-en gikk én gang. Hele
  // frø-boot-scenariet = kontekst 1 (+ feed/events/signering fra
  // boot-trioen, uendret fra S2) — innenfor det låste ≤7.
  expect(mockGetLiveMatch).not.toHaveBeenCalled();
  expect(mockGetTeamSupportSummary).not.toHaveBeenCalled();
  expect(mockGetUnreadCount).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  home.unmount();
});

test('kontekstfeil: fallback-enkeltkallene starter ETTER forsøket, ingen deadlock', async () => {
  const rpc = deferredRpc();
  const contextPromise = refreshSessionContext('ts-1');
  const home = await renderHome();

  // I flukt: fortsatt ingen enkeltkall.
  expect(mockGetLiveMatch).not.toHaveBeenCalled();
  expect(mockGetUnreadCount).not.toHaveBeenCalled();

  // Kallet feiler (orkestratoren svarer null — den kaster aldri).
  await act(async () => {
    rpc.fail();
    await contextPromise;
  });

  // NÅ tar hver flate sitt vanlige enkeltkall — og alle lander.
  await waitFor(
    () =>
      home.latest().live.isSuccess &&
      home.latest().support.isSuccess &&
      home.latest().unreadCount === 5,
  );
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(1);
  expect(mockGetTeamSupportSummary).toHaveBeenCalledTimes(1);
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
  expect(home.latest().support.data).toEqual({supporters: 1});
  home.unmount();
});
