import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from '../navigation/AppNavigator';
import {AuthProvider, TeamProvider, OnboardingProvider} from '../context';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TeamProvider>
          <OnboardingProvider>
            <StatusBar barStyle="dark-content" />
            <AppNavigator />
          </OnboardingProvider>
        </TeamProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
