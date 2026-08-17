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
 *   2. En BURST av realtime-hendelser (👏 fra mange foreldre samtidig) = ÉN
 *      debounced refetch, aldri én per hendelse — og en hendelse rett før
 *      exit gir INGEN refetch etter unmount.
 *   3. Med bilde i feeden (egen test): signering skjer som ÉN batch og
 *      reactions-oppslaget som ÉN runde — aldri per post/bilde.
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
    on: jest.fn((_type: string, _filter: unknown, cb: (p: unknown) => void) => {
      realtimeHandlers.push(cb);
      return channelObj;
    }),
    subscribe: jest.fn(() => channelObj),
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
    /** Fyrer alle registrerte realtime-callbacks n ganger — «n 👏 på rappen». */
    __burst: (n: number) => {
      for (let i = 0; i < n; i++) {
        for (const handler of [...realtimeHandlers]) {
          handler({eventType: 'INSERT'});
        }
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

import {TeamHomeScreen} from '../src/screens/TeamHomeScreen';

const Stack = createNativeStackNavigator();

/** TeamHome slik den står i Hjem-stacken — ekte navigasjon, mockede data. */
function Harness() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="TeamHome" component={TeamHomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Fake timers skal aldri lekke mellom testene — heller ikke når en av dem
// feiler midtveis (da hadde neste test hengt på ekte async uten at noen
// flytter klokka).
afterEach(() => {
  jest.useRealTimers();
});

test('TeamHome: målt kallbudsjett ved åpning, og én burst = én refetch', async () => {
  jest.useFakeTimers();
  const {supabase, __burst} = jest.requireMock('../src/lib/supabase');
  const feedCalls = () =>
    supabase.rpc.mock.calls.filter(
      (c: unknown[]) => c[0] === 'get_team_feed',
    ).length;

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
  expect(supabase.rpc).toHaveBeenCalledTimes(4); // 2 ved åpning + 2 i refetchen
  expect(supabase.from).toHaveBeenCalledTimes(4);

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
