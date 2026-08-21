import React, {useEffect} from 'react';
import {AppState, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClientProvider, focusManager} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {queryClient} from '../lib/queries/queryClient';
import {AppNavigator} from '../navigation/AppNavigator';
import {
  AuthProvider,
  TeamProvider,
  OnboardingProvider,
  NotificationsProvider,
  CalendarFocusProvider,
  MatchButtonProvider,
} from '../context';
import {PushGate} from '../components/PushGate';

function App() {
  // Token-refresh kun mens appen er i forgrunnen (P5/offisielt RN-mønster):
  // supabase-js ser ikke selv at appen mister forgrunnen, så uten stopp
  // fortsetter refresh-timeren å vekke appen i bakgrunnen — og uten start
  // ved retur kommer brukeren tilbake til et utløpt token og en stille 401.
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
      // RN har ingen window-focus — TanStack må få forgrunnen herfra.
      // Samme lytter som token-refresh: «aktiv app» er ett begrep (P5/P7).
      focusManager.setFocused(state === 'active');
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {/* Over AuthProvider: NotificationsContext og TeamContext skal selv
          over på useQuery i B2/B3 og må se klienten. */}
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TeamProvider>
            <OnboardingProvider>
              <NotificationsProvider>
                {/* ⚠️ UNDER NotificationsProvider med vilje: kampknappen
                    bruker `liveNonce` som sitt raske spor (men hviler ikke
                    på det — varselrader er gatet på brukerens innstillinger,
                    se `useLiveMatch`). Over navigatoren, fordi baren er
                    alltid montert. */}
                <MatchButtonProvider>
                  {/* Kalender skriver hvilken dato brukeren står på hit.
                      ⚠️ Leseren forsvant i skive 10 da «+» ble kampknappen;
                      konteksten står til `CreateSheet` ryddes bort. */}
                  <CalendarFocusProvider>
                    <StatusBar barStyle="dark-content" />
                    <PushGate />
                    <AppNavigator />
                  </CalendarFocusProvider>
                </MatchButtonProvider>
              </NotificationsProvider>
            </OnboardingProvider>
          </TeamProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;
