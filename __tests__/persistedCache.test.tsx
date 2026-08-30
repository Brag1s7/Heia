/**
 * @format
 *
 * SELEKTIV DISK-PERSISTERING (S7, skaleringsplan §2).
 *
 * Kontraktene som fryses her, mot den EKTE modulen og den EKTE query-
 * clienten (kun api/feed er mocket, for kaldstart-testene):
 *
 *   1. HVITLISTEN: feed/events/members/authors persisteres og rehydreres
 *      (med Date-feltene gjenopplivet) — liveMatch, notifications, unread,
 *      supportSummary og event-detaljer når ALDRI disken.
 *   2. SIDE 1: uendelig feed trimmes til én side før lagring, og kan
 *      pagineres normalt etter rehydrering (riktig cursor, ingen dubletter).
 *   3. EIERSKAP: bruker A sin fil kan aldri hydrere bruker B — verken via
 *      nøkkelen (scopet) eller en tuklet payload (userId-sjekken).
 *   4. RYDDING: clearPersistedQueryCache (utlogging) sletter alt og stopper
 *      skrivingen; prunePersistedTeams (lagfjerning) fjerner laget fra både
 *      minne og disk; feil buster/utløpt snapshot forkastes ved restore.
 *   5. KALDSTART-UX: online vises restaurert innhold FØR bakgrunnsrefetchen
 *      lander (og erstattes når den gjør det); offline vises innholdet selv
 *      om refetchen feiler — ingen tom skjerm.
 */

import React, {useEffect} from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from '../src/lib/queries/queryClient';
import {queryKeys} from '../src/lib/queries/keys';
import {teamEventsKey} from '../src/lib/queries/events';
import {useTeamFeed} from '../src/lib/queries/feed';
import {
  restorePersistedQueries,
  prunePersistedTeams,
  clearPersistedQueryCache,
  flushPersistedWrites,
  stopPersistenceForTests,
  readBootSeed,
  writeBootSeedProfile,
  writeBootSeedMemberships,
  flushBootSeedWrites,
  PERSIST_MAX_AGE_MS,
} from '../src/lib/queries/persistedCache';
import {FEED_PAGE_SIZE} from '../src/shared/feedPaging';
import type {FeedItem} from '../src/shared/types';

const mockGetTeamFeed = jest.fn();
jest.mock('../src/lib/api/feed', () => ({
  getTeamFeed: (...a: unknown[]) => mockGetTeamFeed(...a),
}));

const USER_A = 'user-a';
const USER_B = 'user-b';
const KEY_A = `heia:querycache:${USER_A}`;

function feedItem(id: string, createdAtIso: string): FeedItem {
  return {
    id,
    teamSpaceId: 'ts-1',
    type: 'melding',
    author: {id: 'u-author', name: 'Forfatter'},
    createdAt: new Date(createdAtIso),
    content: `innlegg ${id}`,
  };
}

/** Full side (20) med synkende created_at — cursoren blir sistes ISO. */
function fullFeedPage(startIndex: number): FeedItem[] {
  return Array.from({length: FEED_PAGE_SIZE}, (_, i) => {
    const n = startIndex + i;
    return feedItem(
      `post-${n}`,
      new Date(Date.UTC(2026, 7, 25, 12, 0, 0) - n * 60_000).toISOString(),
    );
  });
}

function seedAllowedQueries() {
  queryClient.setQueryData(queryKeys.feed('ts-1'), {
    pages: [
      [feedItem('p1', '2026-08-25T12:00:00.000Z')],
      [feedItem('p2', '2026-08-25T11:00:00.000Z')],
    ],
    pageParams: [null, '2026-08-25T12:00:00.000Z'],
  });
  queryClient.setQueryData(teamEventsKey('ts-1'), [
    {
      id: 'ev-1',
      teamSpaceId: 'ts-1',
      type: 'trening',
      title: 'Trening',
      startTime: new Date('2026-08-27T17:00:00.000Z'),
      endTime: new Date('2026-08-27T18:30:00.000Z'),
      rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'pending'},
    },
  ]);
  queryClient.setQueryData(queryKeys.members('ts-1'), [
    {
      id: 'u-1',
      name: 'Medlem',
      role: 'supporter',
      status: 'active',
      joinedAt: new Date('2026-08-01T10:00:00.000Z'),
      childNames: [],
    },
  ]);
  queryClient.setQueryData(queryKeys.authors('ts-1'), [
    {id: 'u-1', name: 'Medlem', role: 'supporter'},
  ]);
}

/** Full profil MED sensitive felter — skriveren skal nulle dem. */
function profileFixture() {
  return {
    id: USER_A,
    displayName: 'Brage',
    avatarPath: 'user-a/avatar.jpg',
    avatarColor: '#123456',
    phone: '+4712345678',
    locale: 'nb',
    onboardingCompleted: true,
    onboardingCompletedAt: '2026-08-01T10:00:00+00:00',
    householdId: 'h-1',
  };
}

function membershipFixture(teamSpaceId: string) {
  return {
    id: `m-${teamSpaceId}`,
    userId: USER_A,
    teamSpaceId,
    role: 'trener',
    status: 'active',
    joinedAt: '2026-08-01T10:00:00+00:00',
    managedChildId: null,
    managedChildName: null,
    teamSpace: {
      id: teamSpaceId,
      teamId: 't-1',
      displayName: 'Heia G12',
      color: '#112233',
      logoUrl: null,
      inviteCode: 'ABCDEFGH',
      isActivated: false,
      activatedAt: null,
    },
    team: {
      id: 't-1',
      name: 'G12',
      ageGroup: '2014',
      gender: 'mixed',
      level: null,
      club: {id: 'c-1', name: 'Verify IL', shortName: 'VIL', logoUrl: null},
      sport: {id: 's-1', slug: 'fotball', displayName: 'Fotball'},
    },
  } as any;
}

/** Simuler prosessdød + ny kaldstart: minnet dør, disken består. */
async function coldRestart(userId: string): Promise<void> {
  await flushPersistedWrites();
  stopPersistenceForTests();
  queryClient.clear();
  await restorePersistedQueries(userId);
}

async function readSnapshot(key: string = KEY_A): Promise<any> {
  const raw = await AsyncStorage.getItem(key);
  return raw == null ? null : JSON.parse(raw);
}

beforeEach(async () => {
  jest.clearAllMocks();
  stopPersistenceForTests();
  queryClient.clear();
  await AsyncStorage.clear();
});

afterEach(async () => {
  stopPersistenceForTests();
  queryClient.clear();
});

describe('hvitlisten', () => {
  test('tillatte queryer persisteres og rehydreres med Date-felter', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    await coldRestart(USER_A);

    const feed = queryClient.getQueryData<any>(queryKeys.feed('ts-1'));
    expect(feed).toBeDefined();
    expect(feed.pages[0][0].content).toBe('innlegg p1');
    expect(feed.pages[0][0].createdAt).toBeInstanceOf(Date);
    expect(feed.pages[0][0].createdAt.toISOString()).toBe(
      '2026-08-25T12:00:00.000Z',
    );

    const events = queryClient.getQueryData<any>(teamEventsKey('ts-1'));
    expect(events).toHaveLength(1);
    expect(events[0].startTime).toBeInstanceOf(Date);
    expect(events[0].endTime).toBeInstanceOf(Date);
    expect(events[0].meetingTime).toBeUndefined();

    const members = queryClient.getQueryData<any>(queryKeys.members('ts-1'));
    expect(members[0].joinedAt).toBeInstanceOf(Date);
    expect(
      queryClient.getQueryData<any>(queryKeys.authors('ts-1')),
    ).toHaveLength(1);
  });

  test('forbudte queryer persisteres aldri', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    // Forbudt: sanntid, varsler, betaling, detaljer — samme lag, samme økt.
    queryClient.setQueryData(queryKeys.liveMatch('ts-1'), {id: 'match-1'});
    queryClient.setQueryData(queryKeys.supportSummary('ts-1'), {sum: 1200});
    queryClient.setQueryData(queryKeys.notifications('ts-1'), [{id: 'n1'}]);
    queryClient.setQueryData(queryKeys.unreadCount('ts-1'), 7);
    queryClient.setQueryData(queryKeys.event('ev-1'), {id: 'ev-1'});
    queryClient.setQueryData(queryKeys.matchEngagement('ev-1'), {heia: 3});
    await flushPersistedWrites();

    const snapshot = await readSnapshot();
    const domains = snapshot.state.queries.map((q: any) => q.queryKey[0]);
    expect(domains.sort()).toEqual(['authors', 'events', 'feed', 'members']);
  });

  test('bare feed side 1 lagres', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    await flushPersistedWrites();

    const snapshot = await readSnapshot();
    const feedEntry = snapshot.state.queries.find(
      (q: any) => q.queryKey[0] === 'feed',
    );
    expect(feedEntry.state.data.pages).toHaveLength(1);
    expect(feedEntry.state.data.pageParams).toEqual([null]);
    expect(feedEntry.state.data.pages[0][0].id).toBe('p1');
    // Minnet er urørt av trimmingen — begge sidene lever videre i økta.
    const live = queryClient.getQueryData<any>(queryKeys.feed('ts-1'));
    expect(live.pages).toHaveLength(2);
  });
});

describe('eierskap og rydding', () => {
  test('bruker A sin cache kan aldri vises for bruker B', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    await flushPersistedWrites();
    stopPersistenceForTests();
    queryClient.clear();

    // B restaurerer: nøkkelen er scopet, A sin fil treffes ikke.
    await restorePersistedQueries(USER_B);
    expect(queryClient.getQueryData(queryKeys.feed('ts-1'))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.members('ts-1'))).toBeUndefined();
    stopPersistenceForTests();

    // Tukling: A-payload lagt under B sin nøkkel — userId-sjekken forkaster.
    const snapshotA = await readSnapshot(KEY_A);
    await AsyncStorage.setItem(
      `heia:querycache:${USER_B}`,
      JSON.stringify(snapshotA),
    );
    await restorePersistedQueries(USER_B);
    expect(queryClient.getQueryData(queryKeys.feed('ts-1'))).toBeUndefined();
    expect(await AsyncStorage.getItem(`heia:querycache:${USER_B}`)).toBeNull();
  });

  test('logout/cache-clear fjerner begge lagrene og stopper skriving', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    await flushPersistedWrites();
    // S7b: bootfrøet skal ryddes i SAMME sleng som query-snapshotet.
    writeBootSeedProfile(USER_A, profileFixture());
    writeBootSeedMemberships(USER_A, [membershipFixture('ts-1')]);
    await flushBootSeedWrites();
    expect(await readSnapshot()).not.toBeNull();
    expect(await readBootSeed(USER_A)).not.toBeNull();

    await clearPersistedQueryCache();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter(k => k.startsWith('heia:querycache:'))).toHaveLength(0);
    expect(keys.filter(k => k.startsWith('heia:bootseed:'))).toHaveLength(0);
    expect(await readBootSeed(USER_A)).toBeNull();

    // Skriving etter utlogging: nye cache-hendelser når aldri disken.
    seedAllowedQueries();
    await flushPersistedWrites();
    expect(await readSnapshot()).toBeNull();
  });

  test('lagfjerning purger aktuelt lag fra minne og disk', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    queryClient.setQueryData(queryKeys.feed('ts-2'), {
      pages: [[feedItem('other', '2026-08-25T10:00:00.000Z')]],
      pageParams: [null],
    });
    queryClient.setQueryData(queryKeys.members('ts-2'), [{id: 'u-2'}]);
    await flushPersistedWrites();

    prunePersistedTeams(['ts-1']);
    expect(queryClient.getQueryData(queryKeys.feed('ts-2'))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.members('ts-2'))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.feed('ts-1'))).toBeDefined();

    await flushPersistedWrites();
    const snapshot = await readSnapshot();
    const teamIds = snapshot.state.queries.map((q: any) => q.queryKey[1]);
    expect(teamIds).not.toContain('ts-2');
    expect(teamIds).toContain('ts-1');
  });

  test('feil buster eller utløpt cache forkastes ved restore', async () => {
    await restorePersistedQueries(USER_A);
    seedAllowedQueries();
    await flushPersistedWrites();

    // Feil schemaversjon.
    const busted = await readSnapshot();
    busted.v = 0;
    await AsyncStorage.setItem(KEY_A, JSON.stringify(busted));
    await coldRestart(USER_A);
    expect(queryClient.getQueryData(queryKeys.feed('ts-1'))).toBeUndefined();
    expect(await AsyncStorage.getItem(KEY_A)).toBeNull();

    // Gyldig form, men eldre enn maxAge (24 t).
    stopPersistenceForTests();
    const expired = busted;
    expired.v = 1;
    expired.savedAt = Date.now() - PERSIST_MAX_AGE_MS - 60_000;
    await AsyncStorage.setItem(KEY_A, JSON.stringify(expired));
    await restorePersistedQueries(USER_A);
    expect(queryClient.getQueryData(queryKeys.feed('ts-1'))).toBeUndefined();
    expect(await AsyncStorage.getItem(KEY_A)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Kaldstart-UX: den EKTE useTeamFeed mot rehydrert cache og mocket api-lag.
// ---------------------------------------------------------------------------

type FeedHook = ReturnType<typeof useTeamFeed>;

function Probe({onRender}: {onRender: (q: FeedHook) => void}) {
  const q = useTeamFeed('ts-1', USER_A);
  useEffect(() => {
    onRender(q);
  });
  return null;
}

/** Persister en FULL side 1 og eldre `dataUpdatedAt`/`savedAt` (2 t gamle,
 *  som et ekte gjentatt kaldstart-scenario) — restaurert data er da stale
 *  og mount-refetchen fyrer, nøyaktig som kravet sier. */
async function persistStaleFullPage(): Promise<void> {
  await restorePersistedQueries(USER_A);
  queryClient.setQueryData(queryKeys.feed('ts-1'), {
    pages: [fullFeedPage(0)],
    pageParams: [null],
  });
  await flushPersistedWrites();
  const snapshot = await readSnapshot();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  snapshot.savedAt = twoHoursAgo;
  for (const q of snapshot.state.queries) {
    q.state.dataUpdatedAt = twoHoursAgo;
  }
  await AsyncStorage.setItem(KEY_A, JSON.stringify(snapshot));
  stopPersistenceForTests();
  queryClient.clear();
}

/** Deterministisk venting: retryer/notifyManager hopper over et varierende
 *  antall micro-/macrotasks, så enkelt-ticks er flaky — poll til vilkåret
 *  holder (med kort tak, testene her resolver mockene umiddelbart). */
async function waitFor(cond: () => boolean, timeoutMs = 3_000): Promise<void> {
  const started = Date.now();
  while (!cond()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('waitFor: vilkåret slo aldri til');
    }
    await ReactTestRenderer.act(async () => {
      await new Promise(res => setTimeout(res, 10));
    });
  }
}

async function renderProbe(): Promise<{
  latest: () => FeedHook;
  unmount: () => void;
}> {
  let current: FeedHook | undefined;
  let root: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <Probe onRender={q => (current = q)} />
      </QueryClientProvider>,
    );
  });
  return {
    latest: () => current as FeedHook,
    unmount: () => root?.unmount(),
  };
}

describe('kaldstart-UX', () => {
  test('online: restaurert innhold vises før bakgrunnsrefetchen fullfører', async () => {
    await persistStaleFullPage();
    let resolveFetch!: (page: FeedItem[]) => void;
    mockGetTeamFeed.mockImplementation(
      () => new Promise<FeedItem[]>(res => (resolveFetch = res)),
    );

    await restorePersistedQueries(USER_A);
    const probe = await renderProbe();

    // Skjermen har innhold MED EN GANG — refetchen står fortsatt og venter.
    const initial = probe.latest();
    expect(initial.isSuccess).toBe(true);
    expect(initial.data).toHaveLength(FEED_PAGE_SIZE);
    expect(initial.data?.[0].id).toBe('post-0');
    expect(initial.isFetching).toBe(true);
    expect(mockGetTeamFeed).toHaveBeenCalled();

    // Refetchen lander stille — ferskt innhold erstatter det restaurerte.
    const freshPage = [
      feedItem('fresh-post', '2026-08-26T09:00:00.000Z'),
      ...fullFeedPage(0).slice(0, FEED_PAGE_SIZE - 1),
    ];
    await ReactTestRenderer.act(async () => {
      resolveFetch(freshPage);
    });
    await waitFor(() => !probe.latest().isFetching);
    expect(probe.latest().isFetching).toBe(false);
    expect(probe.latest().data?.[0].id).toBe('fresh-post');
    probe.unmount();
  });

  test('offline: restaurert innhold vises selv om refetchen feiler', async () => {
    await persistStaleFullPage();
    mockGetTeamFeed.mockRejectedValue(new Error('Network request failed'));

    await restorePersistedQueries(USER_A);
    const probe = await renderProbe();

    expect(probe.latest().isSuccess).toBe(true);
    expect(probe.latest().data).toHaveLength(FEED_PAGE_SIZE);

    // La refetch + retry (retry: 1) feile helt ut. v5 setter status 'error'
    // ved feilet REFETCH også når data finnes — men skjermens skeleton-
    // vilkår er `isPending` (TeamHomeScreen:778), og dataen består. Det er
    // kontrakten som fjerner fullskjerm-skeletonen i flymodus.
    await ReactTestRenderer.act(async () => {
      await new Promise(res => setTimeout(res, 1_100));
    });
    const settled = probe.latest();
    expect(settled.isPending).toBe(false);
    expect(settled.data).toHaveLength(FEED_PAGE_SIZE);
    expect(settled.data?.[0].id).toBe('post-0');
    probe.unmount();
  }, 10_000);

  test('normal paginering fungerer etter rehydrering', async () => {
    await persistStaleFullPage();
    const page1 = fullFeedPage(0);
    const page2 = fullFeedPage(FEED_PAGE_SIZE);
    const expectedCursor = page1[page1.length - 1].createdAt.toISOString();
    mockGetTeamFeed.mockImplementation(
      (_ts: string, _uid: string, _lim: number, cursor?: string) =>
        Promise.resolve(cursor ? page2 : page1),
    );

    await restorePersistedQueries(USER_A);
    const probe = await renderProbe();
    // Mount-refetchen av side 1 SKAL løpe helt ferdig før pagineringen —
    // ellers kan dens svar (kun side 1) lande sist og kaste side 2.
    await waitFor(() => !probe.latest().isFetching);
    expect(probe.latest().hasNextPage).toBe(true);

    await ReactTestRenderer.act(async () => {
      await probe.latest().fetchNextPage();
    });
    // fetchStatus og data varsles i separate batcher — vent på selve dataen.
    await waitFor(
      () => (probe.latest().data?.length ?? 0) === 2 * FEED_PAGE_SIZE,
    );
    const afterPaging = probe.latest();
    // Side 2 hentet med cursoren fra restaurert/refetchet side 1 …
    expect(mockGetTeamFeed).toHaveBeenCalledWith(
      'ts-1',
      USER_A,
      FEED_PAGE_SIZE,
      expectedCursor,
    );
    // … og den flate lista er dublettfri med begge sidene.
    expect(afterPaging.data).toHaveLength(2 * FEED_PAGE_SIZE);
    expect(new Set(afterPaging.data?.map(i => i.id)).size).toBe(
      2 * FEED_PAGE_SIZE,
    );
    probe.unmount();
  });
});

// ---------------------------------------------------------------------------
// Bootfrøet (S7b) — formatet og vaktene, mot den EKTE modulen.
// (Kappløpet frø/nett i kontekstene fryses i bootSeed(.Profile).test.tsx.)
// ---------------------------------------------------------------------------

describe('bootfrøet', () => {
  const SEED_KEY_A = `heia:bootseed:${USER_A}`;

  test('rundtur: begge halvdelene skrives, sensitive felter nulles', async () => {
    writeBootSeedProfile(USER_A, profileFixture());
    writeBootSeedMemberships(USER_A, [membershipFixture('ts-1')]);
    await flushBootSeedWrites();

    const seed = await readBootSeed(USER_A);
    expect(seed?.profile?.displayName).toBe('Brage');
    expect(seed?.profile?.onboardingCompletedAt).toBe(
      '2026-08-01T10:00:00+00:00',
    );
    // Minimering: telefon og husholdning når aldri disken.
    expect(seed?.profile?.phone).toBeNull();
    expect(seed?.profile?.householdId).toBeNull();
    expect(seed?.memberships).toHaveLength(1);
    expect(seed?.memberships?.[0].teamSpaceId).toBe('ts-1');
    expect(seed?.memberships?.[0].teamSpace.displayName).toBe('Heia G12');
    // Forbudte felt SERIALISERES aldri — sjekket mot selve diskbytene, ikke
    // bare det reviverte objektet: invitasjonskoden, telefonnummeret og
    // husholdnings-id-en fra fixturene finnes ikke i filen.
    const rawSeed = (await AsyncStorage.getItem(SEED_KEY_A)) as string;
    expect(rawSeed).not.toContain('ABCDEFGH');
    expect(rawSeed).not.toContain('+4712345678');
    expect(rawSeed).not.toContain('h-1');
    expect(seed?.memberships?.[0].teamSpace.inviteCode).toBe('');
    expect(seed?.memberships?.[0].teamSpace.activatedAt).toBeNull();

    // Halvdelene skrives fra hver sin kontekst — en profiloppdatering
    // alene skal ikke slette medlemsdelen (merge, ikke overskriving).
    writeBootSeedProfile(USER_A, {...profileFixture(), displayName: 'Ny'});
    await flushBootSeedWrites();
    const merged = await readBootSeed(USER_A);
    expect(merged?.profile?.displayName).toBe('Ny');
    expect(merged?.memberships).toHaveLength(1);
  });

  test('feil bruker, utløpt frø og feil buster forkastes', async () => {
    writeBootSeedProfile(USER_A, profileFixture());
    await flushBootSeedWrites();

    // Feil bruker: B leser aldri A sitt frø (scopet nøkkel) …
    expect(await readBootSeed(USER_B)).toBeNull();
    // … og et TUKLET frø (A-payload under B-nøkkel) forkastes og slettes.
    const raw = await AsyncStorage.getItem(SEED_KEY_A);
    await AsyncStorage.setItem(`heia:bootseed:${USER_B}`, raw as string);
    expect(await readBootSeed(USER_B)).toBeNull();
    expect(await AsyncStorage.getItem(`heia:bootseed:${USER_B}`)).toBeNull();

    // Utløpt (> 24 t): forkastes og slettes.
    const payload = JSON.parse(raw as string);
    payload.savedAt = Date.now() - PERSIST_MAX_AGE_MS - 60_000;
    await AsyncStorage.setItem(SEED_KEY_A, JSON.stringify(payload));
    expect(await readBootSeed(USER_A)).toBeNull();
    expect(await AsyncStorage.getItem(SEED_KEY_A)).toBeNull();

    // Feil buster: forkastes og slettes.
    payload.savedAt = Date.now();
    payload.v = 0;
    await AsyncStorage.setItem(SEED_KEY_A, JSON.stringify(payload));
    expect(await readBootSeed(USER_A)).toBeNull();
    expect(await AsyncStorage.getItem(SEED_KEY_A)).toBeNull();

    // Korrupt fil: samme skjebne.
    await AsyncStorage.setItem(SEED_KEY_A, '{ikke json');
    expect(await readBootSeed(USER_A)).toBeNull();
    expect(await AsyncStorage.getItem(SEED_KEY_A)).toBeNull();
  });
});
