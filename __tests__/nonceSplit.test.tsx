/**
 * @format
 *
 * NONCE-SPLITTEN OG VARSELKANALENS LIVSSYKLUS (S1-d + S1-f + S1-a).
 *
 * Tre kontrakter i NotificationsContext fryses her:
 *
 *   1. S1-d: `matchNonce` bumper KUN på kampvarsler (`match_live`) —
 *      alle andre kategorier driver bare `inboxNonce`. Før delte de ett
 *      tall, og ETHVERT varsel invaliderte livekamp-spørringen.
 *   2. S1-f: WS-kanalen er BRUKER-scopet og overlever et lagbytte —
 *      lagbyttet trigger fortsatt en unread-refresh, men river aldri
 *      kanalen.
 *   3. S1-a: `refreshUnreadIfStale` er 60 s-porten for tab-barens
 *      fokuslytter — ti raske fanebytter koster null HEAD-kall.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/supabase', () => {
  let handlers: Array<(p: unknown) => void> = [];
  let statusCallbacks: Array<(s: string) => void> = [];
  const channelObj: any = {
    on: jest.fn((_t: string, _f: unknown, cb: (p: unknown) => void) => {
      handlers.push(cb);
      return channelObj;
    }),
    subscribe: jest.fn((cb?: (s: string) => void) => {
      if (cb) {
        statusCallbacks.push(cb);
        cb('SUBSCRIBED');
      }
      return channelObj;
    }),
  };
  return {
    supabase: {
      channel: jest.fn(() => channelObj),
      removeChannel: jest.fn(),
    },
    __fireInsert: (row: unknown) => {
      for (const h of [...handlers]) {
        h({eventType: 'INSERT', new: row});
      }
    },
    __reconnect: () => {
      for (const cb of [...statusCallbacks]) {
        cb('CHANNEL_ERROR');
        cb('SUBSCRIBED');
      }
    },
    // Handler-registrene er modul-globale i mocken — tøm dem mellom
    // testene, ellers fyrer en test inn i forrige tests (unmountede)
    // provider.
    __resetChannelMock: () => {
      handlers = [];
      statusCallbacks = [];
    },
  };
});

const mockGetUnreadCount = jest.fn();
jest.mock('../src/lib/api/notifications', () => ({
  getUnreadCount: (...a: unknown[]) => mockGetUnreadCount(...a),
  markAsRead: jest.fn(() => Promise.resolve()),
  markAllAsRead: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/context/UserContext', () => ({
  useAuth: () => ({session: {user: {id: 'user-1'}}}),
}));

// Lagbyttet i test 2 styres herfra — en let, ikke en konstant.
let mockTeamId: string | null = 'ts-1';
jest.mock('../src/context/TeamContext', () => ({
  useActiveTeam: () => ({activeTeamSpaceId: mockTeamId}),
}));

import {
  NotificationsProvider,
  useNotifications,
} from '../src/context/NotificationsContext';

let ctx: ReturnType<typeof useNotifications>;
function Probe() {
  ctx = useNotifications();
  return null;
}

function Harness() {
  return (
    <NotificationsProvider>
      <Probe />
    </NotificationsProvider>
  );
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.requireMock('../src/lib/supabase').__resetChannelMock();
  mockTeamId = 'ts-1';
  mockGetUnreadCount.mockResolvedValue(2);
});

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  jest.useRealTimers();
});

async function mount() {
  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Harness />));
  });
}

test('nonce-splitten: match_live bumper begge, andre kategorier kun inbox', async () => {
  const {__fireInsert, __reconnect} = jest.requireMock('../src/lib/supabase');
  await mount();
  expect(ctx.matchNonce).toBe(0);
  expect(ctx.inboxNonce).toBe(0);

  // Kampvarsel: BEGGE — inboxen skal vise raden, kampknappen hente fasit.
  await act(async () => {
    __fireInsert({
      id: 'n1',
      category: 'match_live',
      team_space_id: 'ts-1',
      title: 'Mål!',
      body: '2–1',
    });
  });
  expect(ctx.matchNonce).toBe(1);
  expect(ctx.inboxNonce).toBe(1);

  // Alle andre kategorier: KUN inbox. En 👏/kommentar/RSVP skal aldri
  // invalidere livekamp-spørringen igjen (det var hele S1-d).
  for (const category of ['new_comment', 'new_post', 'rsvp_update']) {
    await act(async () => {
      __fireInsert({
        id: `n-${category}`,
        category,
        team_space_id: 'ts-1',
        title: 'Varsel',
        body: '',
      });
    });
  }
  expect(ctx.matchNonce).toBe(1);
  expect(ctx.inboxNonce).toBe(4);

  // Reconnect: vi vet ikke hvilke kategorier som gikk tapt → begge bumper.
  await act(async () => {
    __reconnect();
  });
  expect(ctx.matchNonce).toBe(2);
  expect(ctx.inboxNonce).toBe(5);
});

test('S1-f: kanalen overlever lagbytte — men unread-refreshen skjer fortsatt', async () => {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  await mount();
  expect(supabase.channel).toHaveBeenCalledTimes(1);
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
  expect(mockGetUnreadCount).toHaveBeenLastCalledWith('ts-1');

  // Lagbytte: provideren re-rendres med nytt aktivt lag.
  mockTeamId = 'ts-2';
  await act(async () => {
    mounted[0].update(<Harness />);
  });

  // Kanalen er bruker-scopet og står — før S1-f ble den revet og
  // gjenoppbygget her, med rejoin-vindu og resync-støy som pris.
  expect(supabase.channel).toHaveBeenCalledTimes(1);
  expect(supabase.removeChannel).not.toHaveBeenCalled();
  // …men badgen henter det NYE lagets teller.
  expect(mockGetUnreadCount).toHaveBeenLastCalledWith('ts-2');
});

test('S1-a: refreshUnreadIfStale — ti fanebytter innen 60 s = 0 kall, etterpå ett', async () => {
  await mount();
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(1); // mount-hentingen

  await act(async () => {
    for (let i = 0; i < 10; i++) {
      ctx.refreshUnreadIfStale();
    }
  });
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(61_000);
  });
  await act(async () => {
    ctx.refreshUnreadIfStale();
  });
  expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
});
