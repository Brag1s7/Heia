import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
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
