/**
 * @format
 *
 * RE-ACQUIRE-RACEN (S3b-2a): `supabase.channel(topic)` dedupliserer på
 * topic mot klientens interne liste og IGNORERER nye params, og
 * `removeChannel` er asynkron — kanalen forlater listen først når leave-
 * pushen kvitteres. Et acquire i det vinduet fikk før den FORLATENDE
 * kanalen tilbake: subscribe på en leaving-kanal, og `{private: true}`
 * som aldri ble satt. Denne testen fryser fiksen:
 *
 *   1. Acquire under pågående riving venter — ingen kanal bygges før
 *      rivingen er ferdig, og da bygges en FRISK kanal (aldri den revne).
 *   2. Nye params brukes faktisk på den friske kanalen.
 *   3. Slipp under venting → ingen kanal bygges i det hele tatt.
 *   4. 'error'-utfallet på leave (kanalen blir stående i bibliotekets
 *      liste) → registryet river en gang til.
 *   5. Multi-consumer-semantikken (delt kanal, siste slipp river) består.
 *
 * Mocken speiler bibliotekets faktiske mekanikk (verifisert i
 * RealtimeClient.js 2.100.1): dedupe på topic i `channel()`, fjerning fra
 * listen skjer FØR removeChannel-promiset løses ('ok'/'timeout'-stiene).
 */

jest.mock('../src/lib/supabase', () => {
  const channels: any[] = [];
  const removeQueue: Array<{ch: any; resolve: () => void; drop: boolean}> = [];
  const makeChannel = (topic: string, params: any) => {
    const ch: any = {
      topic,
      params,
      statusCallbacks: [] as Array<(s: string) => void>,
      on: jest.fn(() => ch),
      subscribe: jest.fn((cb?: (s: string) => void) => {
        if (cb) ch.statusCallbacks.push(cb);
        return ch;
      }),
    };
    return ch;
  };
  const supabase = {
    channel: jest.fn((topic: string, params?: any) => {
      const existing = channels.find(c => c.topic === topic);
      if (existing) return existing; // bibliotekets dedupe — ignorerer params
      const ch = makeChannel(topic, params);
      channels.push(ch);
      return ch;
    }),
    removeChannel: jest.fn(
      (ch: any) =>
        new Promise<string>(resolve => {
          removeQueue.push({
            ch,
            resolve: () => resolve('ok'),
            drop: true,
          });
        }),
    ),
    getChannels: jest.fn(() => [...channels]),
  };
  return {
    supabase,
    /** Fullfør neste riving. dropFromList=false = 'error'-utfallet. */
    __flushRemove: (dropFromList = true) => {
      const next = removeQueue.shift();
      if (!next) throw new Error('ingen riving i kø');
      if (dropFromList) {
        const i = channels.indexOf(next.ch);
        if (i >= 0) channels.splice(i, 1);
      }
      next.resolve();
    },
    __channels: channels,
    __pendingRemovals: removeQueue,
  };
});

import {
  acquireChannel,
  isChannelReady,
  isChannelJoinError,
} from '../src/lib/realtimeChannels';

const {supabase, __flushRemove, __channels, __pendingRemovals} =
  jest.requireMock('../src/lib/supabase');

// Mikrotask-kjedene i registryet (promise-then etter riving) må få løpe ut.
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

afterEach(async () => {
  // Tøm alle pågående rivinger så tilstand aldri lekker mellom tester.
  while (__pendingRemovals.length > 0) __flushRemove();
  await flush();
  // Registreringer som aldri slippes (bevisst i noen tester) etterlater
  // kanaler i mock-lista — nullstill den; hver test bruker eget topic.
  __channels.length = 0;
  jest.clearAllMocks();
});

test('siste slipp → umiddelbart re-acquire venter og får FRISK kanal med nye params', async () => {
  const releaseA = acquireChannel(
    'match:s1',
    () => {},
    () => {},
  );
  const chA = __channels[0];
  expect(chA.params).toBeUndefined();

  releaseA(); // riving startet, men IKKE fullført — chA står i lista
  expect(__channels).toContain(chA);

  const got: unknown[] = [];
  acquireChannel(
    'match:s1',
    (channel, emit) => {
      channel.on('broadcast', {event: 'x'}, () => emit('hei'));
    },
    p => got.push(p),
    {config: {private: true}},
  );

  // Racevinduet: ingen ny kanal ennå — dedupen ville gitt chA tilbake.
  expect(supabase.channel).toHaveBeenCalledTimes(1);

  __flushRemove(); // leave kvittert: chA ute av lista, promiset løses
  await flush();

  // Frisk kanal — aldri den revne — og med params denne gangen.
  expect(supabase.channel).toHaveBeenCalledTimes(2);
  const chB = __channels[0];
  expect(chB).not.toBe(chA);
  expect(chB.params).toEqual({config: {private: true}});
  expect(chB.subscribe).toHaveBeenCalledTimes(1);
  expect(chA.subscribe).toHaveBeenCalledTimes(1); // aldri re-abonnert

  // Lytteren registrert under ventingen får payloads fra den friske kanalen.
  const handler = chB.on.mock.calls[0][2];
  handler({payload: {}});
  expect(got).toEqual(['hei']);
});

test('slipp under venting → ingen kanal bygges', async () => {
  const releaseA = acquireChannel(
    'match:s2',
    () => {},
    () => {},
  );
  releaseA();

  const releaseB = acquireChannel(
    'match:s2',
    () => {},
    () => {},
  );
  releaseB(); // slapp FØR rivingen av A var ferdig

  __flushRemove();
  await flush();

  // Kun A sin kanal ble noen gang bygget; B ventet og ble avlyst.
  expect(supabase.channel).toHaveBeenCalledTimes(1);
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  expect(__channels).toHaveLength(0);
});

test("'error'-utfallet på leave: kanalen blir stående i lista → registryet river igjen", async () => {
  const release = acquireChannel(
    'match:s3',
    () => {},
    () => {},
  );
  const ch = __channels[0];
  release();

  __flushRemove(false); // 'error': promiset løses, men kanalen står igjen
  await flush();

  // Etterkontrollen (getChannels) fant zombien og rev en gang til.
  expect(supabase.removeChannel).toHaveBeenCalledTimes(2);
  expect(supabase.removeChannel).toHaveBeenLastCalledWith(ch);
  __flushRemove(); // andre riving lykkes
  await flush();
  expect(__channels).toHaveLength(0);
});

test('multi-consumer består: delt kanal, siste slipp river, generasjonsvern', async () => {
  const got1: unknown[] = [];
  const got2: unknown[] = [];
  const release1 = acquireChannel(
    't-1',
    () => {},
    p => got1.push(p),
  );
  const release2 = acquireChannel(
    't-1',
    () => {},
    p => got2.push(p),
  );
  expect(supabase.channel).toHaveBeenCalledTimes(1);

  release1();
  expect(supabase.removeChannel).not.toHaveBeenCalled();
  release2();
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  __flushRemove();
  await flush();

  // Ny generasjon på samme topic: et NYTT (dobbelt) slipp fra den gamle
  // generasjonen skal aldri kunne rive den nye kanalen.
  acquireChannel(
    't-1',
    () => {},
    () => {},
  );
  release1();
  release2();
  expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
});

test('sentinelene: ren førstejoin gir READY, pre-join CHANNEL_ERROR gir JOIN_ERROR, rejoin gir resync uten READY', async () => {
  const got: unknown[] = [];
  acquireChannel(
    't-2',
    () => {},
    p => got.push(p),
  );
  const ch = __channels.find((c: any) => c.topic === 't-2');
  const status = ch.statusCallbacks[0];

  status('CHANNEL_ERROR'); // join-fasen
  expect(got.filter(isChannelJoinError)).toHaveLength(1);

  status('SUBSCRIBED'); // join etter frafall → resync, IKKE ready
  expect(got.filter(isChannelReady)).toHaveLength(0);

  status('CHANNEL_ERROR'); // ETTER første join: frafall, ikke join-feil
  expect(got.filter(isChannelJoinError)).toHaveLength(1);
});

test('sentinelene: helt ren førstejoin gir KUN READY', async () => {
  const got: unknown[] = [];
  acquireChannel(
    't-3',
    () => {},
    p => got.push(p),
  );
  const status = __channels.find((c: any) => c.topic === 't-3')
    .statusCallbacks[0];

  status('SUBSCRIBED');
  expect(got).toHaveLength(1);
  expect(isChannelReady(got[0])).toBe(true);
});
