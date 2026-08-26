/**
 * @format
 *
 * FANEBYTTE-PORTEN (S1-a): `refreshLiveMatchIfStale` er 60 s-regelen for
 * kallstedet som ikke er en skjerm — tab-barens fokuslytter.
 *
 * Før S1 kalte lytteren ubetinget `invalidateQueries` på livekamp-nøkkelen,
 * og hvert fanebytte kostet et kall (`staleTime` TILLATER en refetch, den
 * stopper ingen invalidering). Denne fila fryser den nye kontrakten:
 *
 *   · 10 gjentak innen 60 s = 0 nye kall
 *   · første gjentak ETTER 60 s = nøyaktig ett
 *   · `useLiveMatchValue` har INGEN eget intervall — tid alene henter aldri
 *     (intervallet eies av MatchButtonContext, se liveMatchPoll.test.tsx)
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {QueryClientProvider} from '@tanstack/react-query';

const mockGetLiveMatch = jest.fn();
jest.mock('../src/lib/api/events', () => ({
  getLiveMatch: (...a: unknown[]) => mockGetLiveMatch(...a),
}));

// Modul-singletonen, ikke en fersk klient: `refreshLiveMatchIfStale` går
// mot den, og testen skal bevise produksjonskoblingen.
import {queryClient} from '../src/lib/queries/queryClient';
import {
  useLiveMatchValue,
  refreshLiveMatchIfStale,
} from '../src/lib/queries/liveMatch';

function Skjerm() {
  const {data} = useLiveMatchValue('ts-1');
  return <Text>{data ? 'live' : 'ingen'}</Text>;
}

// Ekte navigasjonsskjerm: `useLiveMatchValue` er fokus-gatet (useIsFocused)
// og trenger et skjermkontekst for å være «i fokus» i det hele tatt.
const Stack = createNativeStackNavigator();

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Skjerm" component={Skjerm} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  mockGetLiveMatch.mockClear();
});

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  queryClient.clear();
  jest.useRealTimers();
});

test('fanebytte-porten: 10 gjentak innen 60 s = 0 nye kall, etter 60 s = ett', async () => {
  jest.useFakeTimers();
  mockGetLiveMatch.mockResolvedValue(null);

  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Harness />));
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(1); // mount-hentingen

  // Ti raske «fanebytter» innenfor vinduet: fasit er fersk — null kall.
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      refreshLiveMatchIfStale('ts-1');
    }
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(1);

  // Tiden alene henter ALDRI: verdi-hooken har ikke noe intervall.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(61_000);
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(1);

  // …men neste fanebytte ETTER 60 s får hente — nøyaktig én gang.
  await act(async () => {
    refreshLiveMatchIfStale('ts-1');
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(2);

  // Og porten lukker seg igjen rett etterpå.
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      refreshLiveMatchIfStale('ts-1');
    }
  });
  expect(mockGetLiveMatch).toHaveBeenCalledTimes(2);
});

test('uten lagrom er porten en no-op — aldri et kall mot «ingen»-nøkkelen', async () => {
  jest.useFakeTimers();
  mockGetLiveMatch.mockResolvedValue(null);

  await act(async () => {
    refreshLiveMatchIfStale(null);
    refreshLiveMatchIfStale(undefined);
  });
  expect(mockGetLiveMatch).not.toHaveBeenCalled();
});
