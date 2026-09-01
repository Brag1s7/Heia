/**
 * @format
 *
 * RESYNC-KONTRAKTEN (B3): payload-først er trygt BARE fordi reconnect
 * resyncer — kanalen kan ha mistet hendelser mens den var nede, og en cache
 * som patches fra payloads ville blitt stående feil for alltid. Denne testen
 * fryser semantikken:
 *
 *   1. Første SUBSCRIBED er IKKE resync (åpningshentingen pågår alt — en
 *      resync der er dobbelhenting, jf. staleMs-flip-funnet i B2).
 *   2. SUBSCRIBED etter frafall (CHANNEL_ERROR/TIMED_OUT/CLOSED) ELLER etter
 *      et tidligere SUBSCRIBED (socket-rejoin uten feilstatus) ER resync.
 *   3. Registryet deler ut CHANNEL_RESYNC til ALLE lyttere på topicet.
 */

jest.mock('../src/lib/supabase', () => {
  const statusCallbacks: Array<(status: string) => void> = [];
  const channelObj: any = {
    on: jest.fn(() => channelObj),
    subscribe: jest.fn((cb?: (status: string) => void) => {
      if (cb) statusCallbacks.push(cb);
      return channelObj;
    }),
  };
  return {
    supabase: {
      channel: jest.fn(() => channelObj),
      removeChannel: jest.fn(),
    },
    __status: (status: string) => {
      for (const cb of [...statusCallbacks]) cb(status);
    },
  };
});

import {
  acquireChannel,
  createResyncStatusHandler,
  isChannelReady,
  isChannelResync,
} from '../src/lib/realtimeChannels';

describe('createResyncStatusHandler', () => {
  test('første SUBSCRIBED er ikke resync; rejoin og feil→join er det', () => {
    const onResync = jest.fn();
    const handler = createResyncStatusHandler(onResync);

    handler('SUBSCRIBED');
    expect(onResync).not.toHaveBeenCalled();

    // Socket-rejoin: nytt SUBSCRIBED uten feilstatus imellom.
    handler('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(1);

    handler('CHANNEL_ERROR');
    handler('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  test('frafall FØR første join gir resync når join først lykkes', () => {
    // Subscribe feilet først (nett nede ved åpning): hendelser fra vinduet
    // mellom fetch og join kan være tapt — joinen skal resynce.
    const onResync = jest.fn();
    const handler = createResyncStatusHandler(onResync);

    handler('TIMED_OUT');
    handler('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(1);

    // …og deretter vanlig drift: neste rejoin resyncer igjen.
    handler('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  test('feilstatuser alene utløser ingenting', () => {
    const onResync = jest.fn();
    const handler = createResyncStatusHandler(onResync);
    handler('CHANNEL_ERROR');
    handler('TIMED_OUT');
    handler('CLOSED');
    expect(onResync).not.toHaveBeenCalled();
  });
});

describe('acquireChannel + resync', () => {
  test('reconnect deler CHANNEL_RESYNC til alle lyttere; slipp rydder', () => {
    const {supabase, __status} = jest.requireMock('../src/lib/supabase');
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
    expect(supabase.channel).toHaveBeenCalledTimes(1); // duplikatvernet

    // Første join er aldri RESYNC — fra S3b-2 deles CHANNEL_READY ut i
    // stedet (broadcast-stiens fallback-emit; pgc-lyttere ignorerer den).
    __status('SUBSCRIBED');
    expect(got1.filter(isChannelResync)).toHaveLength(0);
    expect(got1.filter(isChannelReady)).toHaveLength(1);

    __status('CHANNEL_ERROR');
    __status('SUBSCRIBED'); // rejoin — resync til BEGGE, aldri ny READY
    expect(got1.filter(isChannelResync)).toHaveLength(1);
    expect(got2.filter(isChannelResync)).toHaveLength(1);
    expect(got1.filter(isChannelReady)).toHaveLength(1);

    release1();
    __status('SUBSCRIBED'); // ny rejoin — kun gjenværende lytter
    expect(got1.filter(isChannelResync)).toHaveLength(1);
    expect(got2.filter(isChannelResync)).toHaveLength(2);

    release2();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });
});
