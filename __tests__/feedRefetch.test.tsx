/**
 * @format
 *
 * REFETCH-REGRESJONSVAKTEN (fase A0, P9 lag 5).
 *
 * Egressen på 9,5 GB/uke oppsto ikke i én stor feil, men i små multiplikatorer:
 * ett kall ekstra per skjermåpning, én refetch ekstra per realtime-hendelse.
 * Denne testen fryser DAGENS målte tall, så en ny multiplikator ikke kan snike
 * seg inn ubemerket:
 *
 *   1. Én åpning av TeamHome = NØYAKTIG 2 RPC-kall (get_team_feed +
 *      get_team_support_summary), 2 tabell-spørringer (live kamp + hendelser,
 *      begge mot events) og 1 realtime-kanal. Tom feed gjør at hverken
 *      signering, auth.getUser eller reactions-oppslaget utløses.
 *   2. En BURST av DEFEKTE realtime-payloads (fallback-stien, P6s
 *      sikkerhetsnett) = ÉN debounced refetch, aldri én per hendelse — og en
 *      hendelse rett før exit gir INGEN refetch etter unmount.
 *   3. Med bilde i feeden (egen test): signering skjer som ÉN batch og
 *      reactions-oppslaget som ÉN runde — aldri per post/bilde.
 *   4. PAYLOAD-FØRST (B3, egen test): andres 👏/kommentarer = 0 kall (tellere
 *      patches i cachen), egne ekko ignoreres, nytt innlegg = KUN side 1,
 *      og reconnect = full resync.
 *
 * Endrer du datalastingen på TeamHome, SKAL denne testen brekke — oppdater
 * tallene bevisst, og skriv i commiten hvorfor budsjettet flyttet seg.
 * (Fase A/B skal flytte tallene NED; se docs/EGRESS-MEDIA-ARKITEKTUR-2026-08.md.)
 *
 * Supabase er mocket på modulnivå — testen måler hva skjermen BER om, ikke
 * hva nettet svarer. Bytes og bilder måles i serverloggene (P9 lag 3).
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// ---------------------------------------------------------------------------
// Supabase-mocken. Alle spørringsbyggere er kjedbare og thenable (tomt svar),
// og realtime-kanalen samler callbackene så testen kan fyre en burst selv.
// ---------------------------------------------------------------------------
jest.mock('../src/lib/supabase', () => {
  const realtimeHandlers: Array<(payload: unknown) => void> = [];
  // B3: payload-klassifiseringen ruter per TABELL — mocken må kunne fyre
  // målrettet (__fire) i tillegg til bredside (__burst). Status-callbackene
  // samles så __reconnect kan simulere frafall + rejoin (resync-stien).
  const handlersByTable: Record<string, Array<(payload: unknown) => void>> = {};
  const statusCallbacks: Array<(status: string) => void> = [];

  /** Kjedbar spørring som kan await-es: alle metoder → seg selv, tomt svar. */
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
        // Som ekte klient: join lykkes. Første SUBSCRIBED er IKKE resync.
        cb('SUBSCRIBED');
      }
      return channelObj;
    }),
  };

  // ETT delt objekt, ikke ett per from()-kall — ellers kan ikke testen telle
  // createSignedUrls på tvers og bevise at signeringen skjer som ÉN batch.
  // Svaret MÅ ekko-e pathene med gyldige URL-er: resolveren (fase A) cacher
  // dem, og med tomt svar ville hver MediaImage utløst sitt eget
  // signeringsforsøk — testen hadde da telt en feil som aldri skjer i drift.
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
    /** Fyrer alle registrerte realtime-callbacks n ganger — «n 👏 på rappen».
     *  Payloaden mangler felter med vilje: dette er nå FALLBACK-stien
     *  (P6s sikkerhetsnett — full debounced refetch, som før B3). */
    __burst: (n: number) => {
      for (let i = 0; i < n; i++) {
        for (const handler of [...realtimeHandlers]) {
          handler({eventType: 'INSERT'});
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
// Kontekstene: faste verdier — testen handler om datalasting, ikke om
// innlogging. Kun hookene TeamHome-treet faktisk bruker (TeamHeader og
// TeamBadge leser også useActiveTeam).
// ---------------------------------------------------------------------------
jest.mock('../src/context', () => ({
  useAuth: () => ({
    session: {user: {id: 'user-1'}},
    profile: {displayName: 'Testbruker'},
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
  useOnboarding: () => ({
    justCreatedTeamSpaceId: null,
    clearJustCreated: jest.fn(),
  }),
}));

import {QueryClientProvider} from '@tanstack/react-query';
import {TeamHomeScreen} from '../src/screens/TeamHomeScreen';
import {queryClient} from '../src/lib/queries/queryClient';

const Stack = createNativeStackNavigator();

/** TeamHome slik den står i Hjem-stacken — ekte navigasjon, mockede data.
 *  SAMME queryClient som appen (ikke en fersk per test): fokus-broen og
 *  mutasjons-invalideringene går mot modul-singletonen, og testen skal
 *  bevise produksjonskoblingen — derfor tømmes cachen mellom testene. */
function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="TeamHome" component={TeamHomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

// Fake timers skal aldri lekke mellom testene — heller ikke når en av dem
// feiler midtveis (da hadde neste test hengt på ekte async uten at noen
// flytter klokka). Query-cachen tømmes av samme grunn: en events-cache fra
// forrige test ville gjort neste tests kallbudsjett løgnaktig lavt.
afterEach(() => {
  jest.useRealTimers();
  queryClient.clear();
});

test('TeamHome: målt kallbudsjett ved åpning, og én burst = én refetch', async () => {
  jest.useFakeTimers();
  const {supabase, __burst} = jest.requireMock('../src/lib/supabase');
  const feedCalls = () =>
    supabase.rpc.mock.calls.filter((c: unknown[]) => c[0] === 'get_team_feed')
      .length;

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });

  // --- 1. Åpningsbudsjettet (målt 2026-08-07, dokumentert i Del IV) ---
  const rpcNames = supabase.rpc.mock.calls.map((c: unknown[]) => c[0]).sort();
  expect(rpcNames).toEqual(['get_team_feed', 'get_team_support_summary']);
  expect(supabase.from).toHaveBeenCalledTimes(2); // live kamp + hendelser
  expect(supabase.from).toHaveBeenCalledWith('events');
  expect(supabase.channel).toHaveBeenCalledTimes(1);
  // Tom feed → ingen signering og ingen reactions-runde. Skulle disse dukke
  // opp her, har noen lagt et kall utenfor «har vi bilder/poster»-vaktene.
  expect(supabase.storage.from).not.toHaveBeenCalled();
  expect(supabase.auth.getUser).not.toHaveBeenCalled();

  // --- 2. Realtime-burst: 5 hendelser på alle tre tabellene ---
  ReactTestRenderer.act(() => {
    __burst(5);
  });
  // Debouncen (400 ms) holder igjen: ingenting har skjedd ennå.
  expect(feedCalls()).toBe(1);

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(400);
  });
  // …og så NØYAKTIG én refetch — ikke én per hendelse.
  expect(feedCalls()).toBe(2);
  // S1-c: en feed-burst koster KUN feed. Før dro debouncen også heroene
  // (livekamp + lagkassa) — budsjettet var 4 rpc og 3 events-spørringer;
  // nå bor begge i query-cachen med egne invaliderings-/fokusstier.
  expect(supabase.rpc).toHaveBeenCalledTimes(3); // 2 ved åpning + 1 i refetchen
  // B2: hendelsene bor i query-cachen og refetches IKKE av en feed-burst
  // (åpningens to events-spørringer er alt). Går tallet opp igjen, har
  // noen dratt kalender- eller livekampdata inn i feed-refetchen på nytt.
  expect(supabase.from).toHaveBeenCalledTimes(2);

  // Ingen etterslep: mer tid skal ikke gi flere kall.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(feedCalls()).toBe(2);

  // --- 3. Opprydding: en hendelse RETT FØR exit skal ikke gi refetch etter
  // unmount (cleanupen må rydde både kanalen OG den ventende debounce-
  // timeren — mutasjonstest 2026-08-07 viste at unmount uten pending timer
  // ikke fanget den regresjonen) ---
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
  expect(feedCalls()).toBe(2);
});

test('TeamHome med bilde i feeden: signering er ÉN batch, reactions ÉN runde', async () => {
  // Multiplikatorene som skapte 9,5 GB/uke bodde nettopp i denne grenen —
  // per-bilde-signering og per-post-oppslag. Tom-feed-testen over når aldri
  // inn hit (vaktene `paths.length > 0` / `items.length > 0` i feed.ts), så
  // grenen fryses med sin egen fixture (mutasjonstest 2026-08-07).
  const {supabase, __storageApi} = jest.requireMock('../src/lib/supabase');
  jest.clearAllMocks(); // teller nullstilles, implementasjonene består
  supabase.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === 'get_team_feed'
        ? {
            data: [
              {
                id: 'post-1',
                type: 'bilde',
                author_id: 'user-2',
                author_name: 'Testforelder',
                created_at: '2026-08-07T12:00:00Z',
                content: 'Heia!',
                media: [{storage_path: 'ts-1/1722900000000-ab12cd34.jpg'}],
                reaction_counts: {},
                comment_count: 0,
              },
            ],
            error: null,
          }
        : {data: null, error: null},
    ),
  );

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });

  // Budsjettet for én post med ett bilde (målt 2026-08-07):
  // signering = ÉN batch for ALLE paths, aldri ett kall per bilde …
  expect(supabase.storage.from).toHaveBeenCalledTimes(1);
  expect(__storageApi.createSignedUrls).toHaveBeenCalledTimes(1);
  expect(__storageApi.createSignedUrls).toHaveBeenCalledWith(
    ['ts-1/1722900000000-ab12cd34.jpg'],
    expect.anything(),
  );
  // … og «har JEG reagert» = ÉN reactions-spørring for hele feeden, aldri
  // én per post — og INGEN auth-rundtur: id-en kommer fra context (fase A,
  // P5; getUser er fjernet fra hele kodebasen).
  expect(supabase.auth.getUser).not.toHaveBeenCalled();
  expect(supabase.from).toHaveBeenCalledTimes(3); // 2× events + 1× reactions
  expect(supabase.from).toHaveBeenCalledWith('reactions');

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});

test('payload-først (B3): 👏/kommentar = 0 kall, post-patch, side 1 ved nytt innlegg, resync ved reconnect', async () => {
  jest.useFakeTimers();
  const {supabase, __fire, __reconnect} = jest.requireMock(
    '../src/lib/supabase',
  );
  jest.clearAllMocks();
  supabase.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === 'get_team_feed'
        ? {
            data: [
              {
                id: 'post-1',
                type: 'melding',
                author_id: 'user-2',
                author_name: 'Testforelder',
                created_at: '2026-08-18T12:00:00Z',
                content: 'Heia!',
                media: [],
                reaction_counts: {},
                comment_count: 0,
              },
            ],
            error: null,
          }
        : {data: null, error: null},
    ),
  );
  const feedCalls = () =>
    supabase.rpc.mock.calls.filter((c: unknown[]) => c[0] === 'get_team_feed')
      .length;
  const heroCalls = () =>
    supabase.rpc.mock.calls.filter(
      (c: unknown[]) => c[0] === 'get_team_support_summary',
    ).length;
  const cachedPost = () => {
    const data = queryClient.getQueryData<{pages: any[][]}>(['feed', 'ts-1']);
    return data?.pages.flat().find(p => p.id === 'post-1');
  };

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  expect(feedCalls()).toBe(1);
  const heroesAfterOpen = heroCalls();

  // --- Andres 👏: teller patches i cachen — INGEN refetch, INGEN heroer ---
  await ReactTestRenderer.act(async () => {
    __fire(
      'reactions',
      {
        eventType: 'INSERT',
        new: {feed_post_id: 'post-1', user_id: 'user-2', emoji: '👏'},
      },
      3,
    );
    jest.advanceTimersByTime(1000);
  });
  expect(feedCalls()).toBe(1);
  expect(heroCalls()).toBe(heroesAfterOpen);
  expect(cachedPost()?.heiaCount).toBe(3);

  // --- Eget ekko (user-1) og fremmed emoji: ignoreres helt ---
  await ReactTestRenderer.act(async () => {
    __fire('reactions', {
      eventType: 'INSERT',
      new: {feed_post_id: 'post-1', user_id: 'user-1', emoji: '👏'},
    });
    __fire('reactions', {
      eventType: 'INSERT',
      new: {feed_post_id: 'post-1', user_id: 'user-2', emoji: '🎉'},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()?.heiaCount).toBe(3);
  expect(feedCalls()).toBe(1);

  // --- DELETE (angret 👏, full old-rad takket være 00059) → −1 ---
  await ReactTestRenderer.act(async () => {
    __fire('reactions', {
      eventType: 'DELETE',
      old: {feed_post_id: 'post-1', user_id: 'user-2', emoji: '👏'},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()?.heiaCount).toBe(2);

  // --- Kommentar inn og soft-slettet ut: teller opp og ned, 0 kall ---
  await ReactTestRenderer.act(async () => {
    __fire('comments', {
      eventType: 'INSERT',
      new: {id: 'c1', feed_post_id: 'post-1'},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()?.commentCount).toBe(1);
  await ReactTestRenderer.act(async () => {
    __fire('comments', {
      eventType: 'UPDATE',
      new: {
        id: 'c1',
        feed_post_id: 'post-1',
        deleted_at: '2026-08-18T13:00:00Z',
      },
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()?.commentCount).toBe(0);
  expect(feedCalls()).toBe(1);

  // --- feed_posts UPDATE: redigering patches i cachen (pin uendret) … ---
  await ReactTestRenderer.act(async () => {
    __fire('feed_posts', {
      eventType: 'UPDATE',
      new: {id: 'post-1', content: 'Redigert', is_pinned: false},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()?.content).toBe('Redigert');
  expect(feedCalls()).toBe(1);

  // --- … og soft-delete fjerner posten uten kall ---
  await ReactTestRenderer.act(async () => {
    __fire('feed_posts', {
      eventType: 'UPDATE',
      new: {id: 'post-1', deleted_at: '2026-08-18T13:30:00Z'},
    });
    jest.advanceTimersByTime(1000);
  });
  expect(cachedPost()).toBeUndefined();
  expect(feedCalls()).toBe(1);

  // --- Nytt innlegg: debounced henting av KUN side 1 — INGEN heroer.
  // ⚠️ SELVE S1-c-PÅSTANDEN: en feed-burst drar aldri hero-kall lenger.
  // Livekampen holdes fersk av sin egen nøkkel (matchNonce + intervallet i
  // MatchButtonContext), lagkassa av 60 s-fokusregelen. ---
  await ReactTestRenderer.act(async () => {
    __fire('feed_posts', {
      eventType: 'INSERT',
      new: {id: 'post-2', team_space_id: 'ts-1'},
    });
  });
  expect(feedCalls()).toBe(1); // debouncen holder igjen
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(feedCalls()).toBe(2);
  expect(heroCalls()).toBe(heroesAfterOpen);

  // --- Reconnect: kanalen har vært nede → full resync. Hero-nøklene
  // invalideres OGSÅ (de kan ha driftet i frafallet) — dette er den ENESTE
  // realtime-stien som fortsatt koster et lagkassa-kall. ---
  await ReactTestRenderer.act(async () => {
    __reconnect();
    jest.advanceTimersByTime(1000);
  });
  expect(feedCalls()).toBe(3);
  expect(heroCalls()).toBe(heroesAfterOpen + 1);

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});

// ---------------------------------------------------------------------------
// «DEL MED LAGET» ER EN PERMANENT INNGANG (P4, skive 10)
//
// ⚠️ Da den generiske «+» ble kampknappen, ble komponisten her den ENESTE
// veien til å skrive noe til laget. Den ligger i `ListHeaderComponent`, som
// tegnes OVER `ListEmptyComponent` — altså finnes den både når feeden er full
// og når den er tom, for alle roller.
//
// Testene under er vakten mot at noen senere flytter den inn i en tilstand
// (f.eks. «vis komponisten bare når feeden er tom»). Skjer det, mister laget
// muligheten til å publisere i det hele tatt.
// ---------------------------------------------------------------------------

function komponistFelt(renderer: ReturnType<typeof ReactTestRenderer.create>) {
  return renderer.root.findAll(
    n => n.props?.accessibilityLabel === 'Del med laget',
    {deep: true},
  );
}

test('komponisten finnes på en TOM feed — og bærer handlingens navn', async () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });

  const felt = komponistFelt(renderer!);
  expect(felt.length).toBeGreaterThan(0);
  // Placeholder er invitasjonen; a11y-labelen er navnet på handlingen — det
  // samme ordet valgarket brukte før det ble erstattet.
  expect(felt[0].props.placeholder).toBe('Del noe med laget …');

  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('komponisten finnes også når feeden HAR innhold', async () => {
  const {supabase} = jest.requireMock('../src/lib/supabase');
  supabase.rpc.mockImplementation((name: string) =>
    Promise.resolve({
      data:
        name === 'get_team_feed'
          ? [
              {
                id: 'p1',
                team_space_id: 'ts-1',
                author_id: 'u2',
                author_name: 'Ola Nordmann',
                content: 'God trening i dag!',
                post_type: 'tekst',
                created_at: new Date().toISOString(),
                heia_count: 0,
                comment_count: 0,
                i_reacted: false,
              },
            ]
          : [],
      error: null,
    }),
  );

  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });

  // ⚠️ SELVE PÅSTANDEN i skive 10: den skal finnes når kalenderen — og
  // feeden — er full, ikke bare i tomtilstanden.
  expect(komponistFelt(renderer!).length).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
  supabase.rpc.mockReset();
});
