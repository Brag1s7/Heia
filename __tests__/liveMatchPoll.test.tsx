import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

/**
 * ⚠️ KNAPPEN MÅ OPPDATERE SEG UTEN VARSLER, UTEN FANEBYTTE OG UTEN AppState.
 *
 * `liveNonce` er det raske sporet, men varselradene er GATET på brukerens
 * egne innstillinger (`inbox_enabled`, 00023:104 / 00051:137). Slår noen av
 * kampvarsler, kommer det aldri en nonce. Og `staleTime` løser det ikke —
 * den TILLATER en refetch, den utløser ingen.
 *
 * Derfor et ekte intervall. Denne fila er beviset, med falske timere:
 *   · det fyrer etter 60 s uten noen annen hendelse
 *   · det er AV inne i kampen (der realtime leverer alt)
 *   · det er AV i bakgrunnen (ingen polling på en telefon i lomma)
 */

const mockGetLiveMatch = jest.fn();
jest.mock('../src/lib/api/events', () => ({
  getLiveMatch: (...a: unknown[]) => mockGetLiveMatch(...a),
}));

import {useLiveMatch, LIVE_MATCH_POLL_MS} from '../src/lib/queries/liveMatch';

function Prove({appActive, inMatch}: {appActive: boolean; inMatch: boolean}) {
  const {data} = useLiveMatch('t1', {appActive, inMatch});
  return <Text>{data ? 'live' : 'ingen'}</Text>;
}

let client: QueryClient;
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function render(props: {appActive: boolean; inMatch: boolean}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Prove {...props} />
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

/**
 * Skyv klokka og la de ventende løftene løse seg.
 *
 * ⚠️ `advanceTimersByTimeAsync`, ikke den synkrone varianten + ett
 * `Promise.resolve()`: react-querys refetch går gjennom flere mikrotasker,
 * og hvor mange varierer med last. Den asynkrone tømmer køen selv, så
 * testen ikke blir en tidsmåling forkledd som en påstand.
 */
async function spolFram(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockGetLiveMatch.mockResolvedValue(null);
  client = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
});

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  client.clear();
  jest.useRealTimers();
});

it('fyrer etter 60 s UTEN liveNonce, fanebytte eller AppState-hendelse', async () => {
  render({appActive: true, inMatch: false});
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(1); // første henting

  await spolFram(LIVE_MATCH_POLL_MS + 50);
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(2);

  await spolFram(LIVE_MATCH_POLL_MS + 50);
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(3);
});

it('er AV inne i kampen — der eier kampskjermens realtime oppdateringen', async () => {
  render({appActive: true, inMatch: true});
  await act(async () => {
    await Promise.resolve();
  });
  // Spørringen er ikke bare uten intervall: den er ikke i gang i det hele
  // tatt. Kallbudsjettet vokser ikke der trafikken er tettest.
  expect(mockGetLiveMatch).not.toHaveBeenCalled();

  await spolFram(LIVE_MATCH_POLL_MS * 5);
  expect(mockGetLiveMatch).not.toHaveBeenCalled();
});

it('er AV i bakgrunnen — ingen polling på en telefon i lomma', async () => {
  render({appActive: false, inMatch: false});
  await act(async () => {
    await Promise.resolve();
  });
  const etterForste = mockGetLiveMatch.mock.calls.length;

  await spolFram(LIVE_MATCH_POLL_MS * 5);
  // Ingen NYE kall utover den ene ved montering.
  expect(mockGetLiveMatch.mock.calls.length).toBe(etterForste);
});
