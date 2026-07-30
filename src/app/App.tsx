import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from '../navigation/AppNavigator';
import {
  AuthProvider,
  TeamProvider,
  OnboardingProvider,
  NotificationsProvider,
} from '../context';
import {PushGate} from '../components/PushGate';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TeamProvider>
          <OnboardingProvider>
            <NotificationsProvider>
              <StatusBar barStyle="dark-content" />
              <PushGate />
              <AppNavigator />
            </NotificationsProvider>
          </OnboardingProvider>
        </TeamProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
