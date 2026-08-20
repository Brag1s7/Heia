/**
 * @format
 *
 * KALLBUDSJETT-VAKTEN FOR EVENT-DETALJEN (B2 event-detalj-skiven).
 *
 * Søsteren til feedRefetch.test.tsx — samme filosofi: frys DAGENS målte tall,
 * så en ny multiplikator ikke sniker seg inn ubemerket. Skjermen står i tre
 * stacks og refetchet før ved HVERT fokus; nå bor hendelsen og kampbildene i
 * query-cachen (P7-nøklene ['event', id] / ['matchPhotos', id]):
 *
 *   1. Én åpning av en TRENING = NØYAKTIG 1 RPC (get_event_with_rsvp).
 *      Ingen kampbilder, ingen medlemsliste (kamp-gatene), ingen kanal —
 *      og en GJENÅPNING innen staleTime koster INGENTING (selve
 *      kallbesparelsen i skiven).
 *   2. En FERDIG kamp med bilde = 3 RPC (event + bilder + medlemmer), ingen
 *      kanal, signering som ÉN batch med BEGGE variantene — og kampforløpet/
 *      railen viser THUMB-varianten, aldri display (egress-fiksen: display
 *      hører hjemme i galleriet).
 *   3. En LIVE kamp = 1 kanal; en burst av kamphendelser = ÉN debounced
 *      event-refetch og INGEN bilde-refetch (P6-splitten/F18) — og et faktisk
 *      bilde rører fotostien. En hendelse rett før exit gir ingen refetch
 *      etter unmount.
 *
 * Endrer du datalastingen på EventDetail, SKAL denne testen brekke — oppdater
 * tallene bevisst, og skriv i commiten hvorfor budsjettet flyttet seg.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// ---------------------------------------------------------------------------
// Supabase-mocken — samme oppskrift som feedRefetch.test.tsx, med én
// utvidelse: __burst tar en valgfri payload, så testen kan skille et
// kampbilde (feed_posts INSERT med type 'bilde') fra en kamphendelse.
// ---------------------------------------------------------------------------
jest.mock('../src/lib/supabase', () => {
  const realtimeHandlers: Array<(payload: unknown) => void> = [];
  // B3: klassifiseringen ruter per tabell (__fire), og __reconnect simulerer
  // frafall + rejoin for resync-stien — samme oppsett som feedRefetch.
  const handlersByTable: Record<string, Array<(payload: unknown) => void>> =
    {};
  const statusCallbacks: Array<(status: string) => void> = [];

  const makeQuery = () => {
    const result = {data: [], error: null};
    const q: any = {};
    for (const m of [
      'select',
      'eq',
      'is',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
      'update',
      'insert',
      'delete',
    ]) {
      q[m] = jest.fn(() => q);
    }
    q.single = jest.fn(() => Promise.resolve({data: null, error: null}));
    q.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
    return q;
  };

  const channelObj: any = {
    on: jest.fn((_type: string, filter: any, cb: (p: unknown) => void) => {
      realtimeHandlers.push(cb);
      const table = (filter?.table as string) ?? '*';
      (handlersByTable[table] = handlersByTable[table] ?? []).push(cb);
      return channelObj;
    }),
    subscribe: jest.fn((cb?: (status: string) => void) => {
      if (cb) {
        statusCallbacks.push(cb);
        cb('SUBSCRIBED');
      }
      return channelObj;
    }),
  };

  const storageApi = {
    createSignedUrls: jest.fn((paths: string[]) =>
      Promise.resolve({
        data: paths.map(p => ({
          path: p,
          signedUrl: `https://cdn.test/${p}?token=t`,
          error: null,
        })),
        error: null,
      }),
    ),
    remove: jest.fn(() => Promise.resolve({data: null, error: null})),
  };

  return {
    supabase: {
      rpc: jest.fn(() => Promise.resolve({data: null, error: null})),
      from: jest.fn(() => makeQuery()),
      channel: jest.fn(() => channelObj),
      removeChannel: jest.fn(),
      auth: {
        getUser: jest.fn(() =>
          Promise.resolve({data: {user: {id: 'user-1'}}, error: null}),
        ),
        getSession: jest.fn(() =>
          Promise.resolve({
            data: {session: {user: {id: 'user-1'}}},
            error: null,
          }),
        ),
      },
      storage: {
        from: jest.fn(() => storageApi),
      },
    },
    __storageApi: storageApi,
    /** Fyrer alle registrerte realtime-callbacks n ganger med gitt payload.
     *  Uten meningsfulle felter er dette FALLBACK-stien (P6-nettet). */
    __burst: (n: number, payload: unknown = {eventType: 'INSERT'}) => {
      for (let i = 0; i < n; i++) {
        for (const handler of [...realtimeHandlers]) {
          handler(payload);
        }
      }
    },
    /** Målrettet payload til én tabells handlere (B3 payload-først). */
    __fire: (table: string, payload: unknown, n = 1) => {
      for (let i = 0; i < n; i++) {
        for (const handler of [...(handlersByTable[table] ?? [])]) {
          handler(payload);
        }
      }
    },
    /** Frafall + rejoin på alle abonnement → resync-signalet (B3). */
    __reconnect: () => {
      for (const cb of [...statusCallbacks]) {
        cb('CHANNEL_ERROR');
        cb('SUBSCRIBED');
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Kontekstene: faste verdier — testen handler om datalasting. useNotifications
// er med fordi EventDetail demper match_live-banneret via watchEvent.
// ---------------------------------------------------------------------------
jest.mock('../src/context', () => ({
  useAuth: () => ({
    session: {user: {id: 'user-1'}},
    profile: {id: 'user-1', displayName: 'Testbruker'},
    loading: false,
  }),
  useActiveTeam: () => ({
    activeTeamSpaceId: 'ts-1',
    activeTeamSpace: {id: 'ts-1', displayName: 'Testlaget', color: '#0B5D3B'},
    activeTeam: {
      sport: {displayName: 'Fotball'},
      ageGroup: 'G14',
      club: {logoUrl: null},
    },
    activeRole: 'forelder',
    activeMemberCount: 5,
    userMemberships: [],
    loading: false,
    setActiveTeamSpace: jest.fn(),
    refreshMemberships: jest.fn(),
  }),
  useNotifications: () => ({
    watchEvent: () => () => {},
  }),
}));

import {QueryClientProvider} from '@tanstack/react-query';
import {EventDetailScreen} from '../src/screens/EventDetailScreen';
import {queryClient} from '../src/lib/queries/queryClient';

const Stack = createNativeStackNavigator();

/** EventDetail slik den står i Hjem-stacken — SAMME queryClient som appen
 *  (modul-singletonen), tømt per test, som i feedRefetch. */
function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            initialParams={{eventId: 'evt-1'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixturer: get_event_with_rsvp-payloaden slik RPC-en (00026/00057) leverer
// den — match_session i ENTALL, rsvp_summary og attendees ved siden av.
// ---------------------------------------------------------------------------
const treningRow = {
  id: 'evt-1',
  type: 'trening',
  title: 'Tirsdagstrening',
  description: null,
  location: 'Kunstgresset',
  start_time: '2026-08-20T17:00:00Z',
  end_time: '2026-08-20T18:30:00Z',
  match_session: null,
  rsvp_summary: {coming: 0, not_coming: 0, pending: 0},
  my_rsvp: null,
  attendees: {coming: [], not_coming: [], pending: []},
};

const kampRow = (status: 'ferdig' | 'live') => ({
  id: 'evt-1',
  type: 'kamp',
  title: 'Kamp mot Lyn',
  description: null,
  location: 'Hjemmebane',
  start_time: '2026-08-20T17:00:00Z',
  end_time: null,
  match_session: {
    id: 'ms-1',
    opponent: 'Lyn',
    home_score: 2,
    away_score: 1,
    is_home: true,
    status,
    reporter_id: 'user-2',
    started_at: '2026-08-20T17:00:00Z',
    match_events: [
      {
        id: 'me-1',
        type: 'mål',
        minute: 12,
        team_side: 'home',
        description: 'Thomas',
        reported_by: 'user-2',
      },
    ],
  },
  rsvp_summary: {coming: 0, not_coming: 0, pending: 0},
  my_rsvp: null,
  attendees: {coming: [], not_coming: [], pending: []},
});

// To bilder med hver sin rendersti: ett knyttet til målet 'me-1' (rendres
// GJENNOM MatchEventRow) og ett generelt (MatchTimelines frittstående
// foto-gren). Begge stiene skal vise thumb — med bare det generelle bildet
// ville en display-regresjon i MatchEventRow passert usett (review-funn).
const matchPhotoRows = [
  {
    post_id: 'p0',
    content: 'Der satt den!',
    created_at: '2026-08-20T17:12:30Z',
    author_id: 'user-2',
    author_name: 'Rita',
    author_avatar: null,
    match_event_id: 'me-1',
    storage_path: 'ts-1/ev.jpg',
    thumbnail_path: 'ts-1/ev_thumb.jpg',
  },
  {
    post_id: 'p1',
    content: 'Jubel!',
    created_at: '2026-08-20T17:30:00Z',
    author_id: 'user-2',
    author_name: 'Rita',
    author_avatar: null,
    match_event_id: null,
    storage_path: 'ts-1/orig.jpg',
    thumbnail_path: 'ts-1/orig_thumb.jpg',
  },
];

/** rpc-mock per test: navn → payload. Ukjente navn får tomt svar. */
function mockRpc(responses: Record<string, unknown>) {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  supabase.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name in responses
        ? {data: responses[name], error: null}
        : {data: null, error: null},
    ),
  );
}

/**
 * Flusher de AVHENGIGE bølgene: bildene/medlemmene starter først når
 * hendelsen har landet (enabled flipper), og TanStacks notifyManager
 * varsler observere via setTimeout — hver bølge trenger derfor sin egen
 * macrotask-runde. Tre runder dekker hendelse → varsle → avhengige →
 * varsle. `fakeTimers` må sies eksplisitt: med fake timers står klokka
 * stille til noen flytter den, og en vanlig await ville hengt evig.
 *
 * ⚠️ Flytter klokka 1 ms per runde, ALDRI 0: med frossen klokke er
 * `Date.now() - dataUpdatedAt` alltid 0, og vakten var BLIND for
 * dobbelhentinger som avhenger av at tid har gått (den adversarielle
 * reviewen beviste nettopp en slik med ekte timere — staleMs-flippen).
 */
async function flushWaves(fakeTimers = false) {
  for (let i = 0; i < 3; i++) {
    await ReactTestRenderer.act(async () => {
      const wait = new Promise<void>(resolve => setTimeout(resolve, 0));
      if (fakeTimers) {
        jest.advanceTimersByTime(1);
      }
      await wait;
    });
  }
}

function rpcCalls(name: string): number {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  return supabase.rpc.mock.calls.filter((c: unknown[]) => c[0] === name)
    .length;
}

afterEach(() => {
  jest.useRealTimers();
  queryClient.clear();
});

test('trening: 1 RPC ved åpning, gjenåpning innen staleTime koster ingenting', async () => {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  jest.clearAllMocks();
  mockRpc({get_event_with_rsvp: treningRow});

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  // Flush FØR gate-assertions — uten den kunne «0 kamp-kall» bestått
  // vakuøst fordi en avhengig query ikke hadde rukket å fyre ennå.
  await flushWaves();

  // --- 1. Åpningsbudsjettet: hendelsen og INGENTING annet ---
  const rpcNames = supabase.rpc.mock.calls.map((c: unknown[]) => c[0]);
  expect(rpcNames).toEqual(['get_event_with_rsvp']);
  // Kamp-gatene: en trening koster hverken bilder eller medlemsliste.
  expect(rpcCalls('get_match_photos')).toBe(0);
  expect(rpcCalls('get_team_members')).toBe(0);
  expect(supabase.channel).not.toHaveBeenCalled();
  expect(supabase.storage.from).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });

  // --- 2. Gjenåpning innen staleTime (60 s): cachen svarer, null kall.
  // Før B2 refetchet skjermen ved HVERT fokus — dette ER besparelsen. ---
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(1);

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});

test('ferdig kamp: 3 RPC, signering én batch med begge varianter, forløpet viser thumb', async () => {
  const {supabase, __storageApi} = jest.requireMock('../src/lib/supabase');
  jest.clearAllMocks();
  mockRpc({
    get_event_with_rsvp: kampRow('ferdig'),
    get_match_photos: matchPhotoRows,
    get_team_members: [
      {
        user_id: 'user-2',
        display_name: 'Rita',
        avatar_url: null,
        role: 'forelder',
        status: 'active',
        joined_at: null,
        child_name: null,
        phone: null,
      },
    ],
  });

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flushWaves();

  // --- Budsjettet: hendelsen + bildene + FORFATTERNE, én gang hver ---
  //
  // Fortsatt tre kall, men det tredje er byttet fra `get_team_members` til
  // `get_team_authors` (kampskjermens designskive):
  //
  //  · Rosteret brukes kun av ReporterBar/ReporterSheet, og begge er gatet på
  //    live/kommende kamp. En FERDIG kamp har aldri brukt det til noe.
  //  · Forfatterne trengs derimot: kampforløpet viser navn og avatar på
  //    reporterens oppdateringer, og `get_team_members` filtrerer bort
  //    utmeldte. Slo reporteren seg av laget, ble hele hennes stemme anonym i
  //    en frossen kamprapport — samme hull som 00067 §2 lukket for
  //    kommentarfeltet. `get_team_authors` har ingen statusfilter.
  //
  // ⚠️ BUDSJETTET ER FIRE FRA SKIVE 4, og det fjerde kallet er navngitt her
  // med vilje: `get_match_feed` (00071) er den KANONISKE KOBLINGEN mellom et
  // øyeblikk og feed-posten HEIA og kommentarer henger på. Den kunne ikke
  // presses inn i `get_event_with_rsvp` — den RPC-en deles av alle
  // hendelsestyper, og en trening skal ikke betale for kampens engasjement.
  //
  // Lista er uttømmende, ikke en nedre grense: dukker `get_team_members` opp
  // igjen, er rosteret sluppet inn på en flate som ikke bruker det, og da
  // skal denne testen falle.
  const rpcNames = supabase.rpc.mock.calls.map((c: unknown[]) => c[0]).sort();
  expect(rpcNames).toEqual([
    'get_event_with_rsvp',
    'get_match_feed',
    'get_match_photos',
    'get_team_authors',
  ]);
  // Ferdig kamp = ingen realtime-kanal.
  expect(supabase.channel).not.toHaveBeenCalled();

  // --- Signering: ÉN batch med BEGGE variantene (00061 gir thumbnail_path;
  // forløpet/railen leser thumb, galleriet display) ---
  expect(__storageApi.createSignedUrls).toHaveBeenCalledTimes(1);
  expect(__storageApi.createSignedUrls).toHaveBeenCalledWith(
    ['ts-1/ev.jpg', 'ts-1/ev_thumb.jpg', 'ts-1/orig.jpg', 'ts-1/orig_thumb.jpg'],
    expect.anything(),
  );

  // --- Egress-fiksen: alt som RENDRES på kampsiden er thumb-varianten.
  // Display-URL-en hører hjemme i galleriet (modal, montert ved åpning). ---
  const imageUris = renderer!.root
    .findAll(
      node =>
        typeof node.type === 'string' &&
        !!(node.props as any)?.source?.uri,
    )
    .map(node => (node.props as any).source.uri as string);
  // Begge renderstiene: MatchEventRow (hendelsesknyttet) OG timelinens
  // frittstående gren viser thumb — display finnes ikke i treet.
  expect(imageUris.some(u => u.includes('ev_thumb.jpg'))).toBe(true);
  expect(imageUris.some(u => u.includes('orig_thumb.jpg'))).toBe(true);
  expect(imageUris.some(u => u.includes('/ev.jpg?'))).toBe(false);
  expect(imageUris.some(u => u.includes('/orig.jpg?'))).toBe(false);

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});

test('live kamp: én kanal; DEFEKT payload-burst (fallback-nettet) = én event-refetch og INGEN bilde-refetch', async () => {
  // __burst sender payloads uten felter → alle handlerne velger 'fallback'
  // (P6s sikkerhetsnett). At nettet debouncer til ÉN refetch og aldri rører
  // fotostien er nøyaktig det denne testen alltid har bevist — payload-
  // GRØNNSTIEN har fått sin egen test under.
  jest.useFakeTimers();
  const {supabase, __burst} = jest.requireMock('../src/lib/supabase');
  jest.clearAllMocks();
  mockRpc({
    get_event_with_rsvp: kampRow('live'),
    get_match_photos: [],
    get_team_members: [],
  });

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  // Flush de avhengige bølgene FØR budsjettet leses — ellers telles en
  // etternølende fetch feilaktig som burst-støy.
  await flushWaves(true);

  expect(rpcCalls('get_event_with_rsvp')).toBe(1);
  expect(rpcCalls('get_match_photos')).toBe(1);
  expect(supabase.channel).toHaveBeenCalledTimes(1);

  // --- Kamp-burst (ett mål = tre meldinger i én transaksjon, ganger fem):
  // debouncen samler alt til ÉN event-refetch, og fotostien står urørt
  // (P6-splitten — F18-regresjonen var nettopp bilder re-lastet per mål). ---
  ReactTestRenderer.act(() => {
    __burst(5);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(1); // debouncen holder igjen
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(2);
  expect(rpcCalls('get_match_photos')).toBe(1);

  // Ingen etterslep.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(2);

  // --- Et faktisk BILDE (feed_posts INSERT, type 'bilde') rører fotostien —
  // og kamp-handlerne som fyrte i samme burst debounces fortsatt til én. ---
  ReactTestRenderer.act(() => {
    __burst(1, {new: {type: 'bilde'}});
  });
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(rpcCalls('get_match_photos')).toBe(2);
  expect(rpcCalls('get_event_with_rsvp')).toBe(3);

  // --- Opprydding: hendelse rett før exit → ingen refetch etter unmount
  // (kanalen OG den ventende debounce-timeren må ryddes; blur-stien
  // markerer kun stale — refetchType 'none' henter aldri). ---
  ReactTestRenderer.act(() => {
    __burst(1);
  });
  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(3);
  expect(rpcCalls('get_match_photos')).toBe(2);
});

test('live kamp payload-først (B3): mål = cache-patch og NULL refetch; reconnect = full resync', async () => {
  jest.useFakeTimers();
  const {supabase, __fire, __reconnect} = jest.requireMock(
    '../src/lib/supabase',
  );
  jest.clearAllMocks();
  mockRpc({
    get_event_with_rsvp: kampRow('live'),
    get_match_photos: [],
    get_team_members: [],
  });

  const cachedDetail = () =>
    queryClient.getQueryData<any>(['event', 'evt-1']);

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flushWaves(true);
  expect(rpcCalls('get_event_with_rsvp')).toBe(1);
  expect(supabase.channel).toHaveBeenCalledTimes(1);

  // --- Et mål hos en TILSKUER = to payloads i én transaksjon: raden
  // appenderes i forløpet og stillingen patches fra sesjonsraden — og
  // INGEN av dem koster et kall (P6: «append/scoreboard fra payload»). ---
  await ReactTestRenderer.act(async () => {
    __fire('match_events', {
      eventType: 'INSERT',
      new: {
        id: 'me-2',
        match_session_id: 'ms-1',
        type: 'mål',
        minute: 31,
        team_side: 'home',
        description: null,
        player_name: 'Nora',
        sequence: 2,
      },
    });
    __fire('match_sessions', {
      eventType: 'UPDATE',
      new: {
        id: 'ms-1',
        opponent: 'Lyn',
        home_score: 3,
        away_score: 1,
        is_home: true,
        status: 'live',
        reporter_id: 'user-2',
        started_at: '2026-08-20T17:00:00Z',
      },
    });
    jest.advanceTimersByTime(1000);
  });
  expect(rpcCalls('get_event_with_rsvp')).toBe(1); // fortsatt bare åpningen
  expect(rpcCalls('get_match_photos')).toBe(1);
  const detail = cachedDetail();
  expect(detail?.matchEvents?.map((e: any) => e.id)).toEqual(['me-1', 'me-2']);
  expect(detail?.matchEvents?.[1]?.minute).toBe(31);
  expect(detail?.score).toEqual({home: 3, away: 1});

  // --- Duplikat-ekko (reporterens refetch + realtime om hverandre):
  // samme id appenderes ALDRI dobbelt. ---
  await ReactTestRenderer.act(async () => {
    __fire('match_events', {
      eventType: 'INSERT',
      new: {id: 'me-2', match_session_id: 'ms-1', type: 'mål', minute: 31},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedDetail()?.matchEvents).toHaveLength(2);
  expect(rpcCalls('get_event_with_rsvp')).toBe(1);

  // --- Reconnect: kanalen har vært nede → BEGGE stiene resyncer straks
  // (P6-reconnect-raden — dette er lukkingen av hullet fra kartleggingen:
  // uten status-callbacks var tapte hendelser usynlige til neste fokus). ---
  await ReactTestRenderer.act(async () => {
    __reconnect();
  });
  await flushWaves(true);
  expect(rpcCalls('get_event_with_rsvp')).toBe(2);
  expect(rpcCalls('get_match_photos')).toBe(2);

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});
