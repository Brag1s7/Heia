import React, {useEffect} from 'react';
import {AppState, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {supabase} from '../lib/supabase';
import {AppNavigator} from '../navigation/AppNavigator';
import {
  AuthProvider,
  TeamProvider,
  OnboardingProvider,
  NotificationsProvider,
  CalendarFocusProvider,
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
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TeamProvider>
          <OnboardingProvider>
            <NotificationsProvider>
              {/* Kalender skriver hvilken dato brukeren står på hit, og «+»
                  i hovednavigasjonen leser den når valgarket åpnes. */}
              <CalendarFocusProvider>
                <StatusBar barStyle="dark-content" />
                <PushGate />
                <AppNavigator />
              </CalendarFocusProvider>
            </NotificationsProvider>
          </OnboardingProvider>
        </TeamProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
