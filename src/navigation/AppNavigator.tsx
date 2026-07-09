import React, {useState} from 'react';
import {Pressable, Text, StyleSheet, View, ActivityIndicator} from 'react-native';
import {
  NavigationContainer,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors, typography, spacing} from '../theme';
import {useAuth, useActiveTeam, useOnboarding} from '../context';
import {CreateSheet} from '../components';
import {isTeamAdmin} from '../shared/roles';
import {TeamHomeScreen} from '../screens/TeamHomeScreen';
import {EventDetailScreen} from '../screens/EventDetailScreen';
import {NewEventScreen} from '../screens/NewEventScreen';
import {InviteScreen} from '../screens/InviteScreen';
import {SupportScreen} from '../screens/SupportScreen';
import {CommentsScreen} from '../screens/CommentsScreen';
import {WelcomeIntentScreen} from '../screens/WelcomeIntentScreen';
import {AuthScreen} from '../screens/AuthScreen';
import {JoinTeamCodeScreen} from '../screens/JoinTeamCodeScreen';
import {CreateTeamScreen} from '../screens/CreateTeamScreen';
import {KalenderScreen} from '../screens/KalenderScreen';
import {ProfilScreen} from '../screens/ProfilScreen';
import {InboxScreen} from '../screens/InboxScreen';
import type {
  RootTabParamList,
  HomeStackParamList,
  OnboardingStackParamList,
  KalenderStackParamList,
  ProfilStackParamList,
} from '../shared/types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const OnboardingNav =
  createNativeStackNavigator<OnboardingStackParamList>();
const KalenderNav = createNativeStackNavigator<KalenderStackParamList>();
const ProfilNav = createNativeStackNavigator<ProfilStackParamList>();

// ---------------------------------------------------------------------------
// Felles stack-innstillinger
// ---------------------------------------------------------------------------
const stackScreenOptions = {
  headerStyle: {backgroundColor: colors.surface},
  headerTintColor: colors.textPrimary,
  headerTitleStyle: typography.heading3,
  headerShadowVisible: false,
  headerBackTitle: 'Tilbake',
};

// ---------------------------------------------------------------------------
// Home stack (Hjem-tab med push-navigasjon)
// ---------------------------------------------------------------------------
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen
        name="TeamHome"
        component={TeamHomeScreen}
        options={{headerShown: false}}
      />
      <HomeStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{title: 'Hendelse'}}
      />
      <HomeStack.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={({navigation}) => ({
          title: 'Ny hendelse',
          presentation: 'modal',
          // Modaler har ingen tilbake-knapp — brukeren trenger en vei ut.
          headerLeft: () => (
            <Pressable onPress={navigation.goBack} hitSlop={8}>
              <Text style={styles.headerAction}>Avbryt</Text>
            </Pressable>
          ),
        })}
      />
      <HomeStack.Screen
        name="Support"
        component={SupportScreen}
        options={{title: 'Støtt laget'}}
      />
      <HomeStack.Screen
        name="Invite"
        component={InviteScreen}
        options={{title: 'Inviter'}}
      />
      <HomeStack.Screen
        name="Comments"
        component={CommentsScreen}
        options={{title: 'Kommentarer'}}
      />
    </HomeStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Kalender stack (Kalender-tab med push til EventDetail)
// ---------------------------------------------------------------------------
function KalenderStackNavigator() {
  return (
    <KalenderNav.Navigator screenOptions={stackScreenOptions}>
      <KalenderNav.Screen
        name="KalenderList"
        component={KalenderScreen}
        options={{headerShown: false}}
      />
      <KalenderNav.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{title: 'Hendelse'}}
      />
    </KalenderNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Profil stack
// ---------------------------------------------------------------------------
function ProfilStackNavigator() {
  return (
    <ProfilNav.Navigator screenOptions={stackScreenOptions}>
      <ProfilNav.Screen
        name="Profil"
        component={ProfilScreen}
        options={{headerShown: false}}
      />
      <ProfilNav.Screen
        name="Invite"
        component={InviteScreen}
        options={{title: 'Inviter'}}
      />
    </ProfilNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Onboarding stack (velkommen + auth + team join)
// ---------------------------------------------------------------------------
function OnboardingStackNavigator() {
  return (
    <OnboardingNav.Navigator
      initialRouteName="WelcomeIntent"
      screenOptions={{headerShown: false}}>
      <OnboardingNav.Screen
        name="WelcomeIntent"
        component={WelcomeIntentScreen}
      />
      <OnboardingNav.Screen name="Auth" component={AuthScreen} />
      <OnboardingNav.Screen
        name="JoinTeamCode"
        component={JoinTeamCodeScreen}
      />
      <OnboardingNav.Screen name="CreateTeam" component={CreateTeamScreen} />
    </OnboardingNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Opprett-tab. Rendres aldri: tabPress avbrytes og åpner CreateSheet i stedet.
// Bottom-tabs krever likevel en komponent for skjermen.
// ---------------------------------------------------------------------------
function OpprettScreen() {
  return <View style={styles.placeholder} />;
}

// ---------------------------------------------------------------------------
// Tab-ikon (enkel tekst-basert — byttes til ikon-bibliotek senere)
// ---------------------------------------------------------------------------
const tabIcons: Record<keyof RootTabParamList, string> = {
  HjemStack: '⌂',
  KalenderStack: '▦',
  Opprett: '+',
  Inbox: '✉',
  ProfilStack: '●',
};

// ---------------------------------------------------------------------------
// Hoved-tabs
// ---------------------------------------------------------------------------
function MainTabs() {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const {activeRole} = useActiveTeam();
  const [sheetVisible, setSheetVisible] = useState(false);

  const closeSheet = () => setSheetVisible(false);

  const handleShare = () => {
    closeSheet();
    // Ny nonce hver gang, ellers fokuserer ikke compose-boksen på nytt.
    navigation.navigate('HjemStack', {
      screen: 'TeamHome',
      params: {composeNonce: Date.now()},
    });
  };

  const handleNewEvent = () => {
    closeSheet();
    navigation.navigate('HjemStack', {screen: 'NewEvent'});
  };

  return (
    <>
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.heia,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({color}) => {
          const icon = tabIcons[route.name];
          if (route.name === 'Opprett') {
            return (
              <View style={styles.createButton}>
                <Text style={styles.createIcon}>{icon}</Text>
              </View>
            );
          }
          return <Text style={[styles.tabIcon, {color}]}>{icon}</Text>;
        },
      })}>
      <Tab.Screen
        name="HjemStack"
        component={HomeStackNavigator}
        options={{tabBarLabel: 'Hjem'}}
      />
      <Tab.Screen
        name="KalenderStack"
        component={KalenderStackNavigator}
        options={{tabBarLabel: 'Kalender'}}
      />
      <Tab.Screen
        name="Opprett"
        component={OpprettScreen}
        options={{tabBarLabel: ''}}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            setSheetVisible(true);
          },
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
      />
      <Tab.Screen
        name="ProfilStack"
        component={ProfilStackNavigator}
        options={{tabBarLabel: 'Profil'}}
      />
    </Tab.Navigator>

    <CreateSheet
      visible={sheetVisible}
      canCreateEvent={isTeamAdmin(activeRole)}
      onClose={closeSheet}
      onShare={handleShare}
      onNewEvent={handleNewEvent}
    />
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading screen mens session sjekkes
// ---------------------------------------------------------------------------
function LoadingScreen({message}: {message?: string}) {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={colors.heia} />
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rot-navigator — betinget onboarding vs. hoved-app
// ---------------------------------------------------------------------------
export function AppNavigator() {
  const {session, profile, loading} = useAuth();
  const {userMemberships, loading: teamLoading} = useActiveTeam();
  const {pendingAction} = useOnboarding();

  const hasTeam = userMemberships.length > 0;

  // Vent på profil + memberships så vi ikke blinker innom feil skjerm.
  if (loading || (session && !profile) || (session && teamLoading)) {
    return <LoadingScreen />;
  }

  // Innlogget med en pending intent (auth-before-commit): fullfør join/create.
  if (session && profile && !hasTeam && pendingAction) {
    return <LoadingScreen message="Setter opp laget…" />;
  }

  return (
    <NavigationContainer>
      {session && profile && hasTeam ? (
        <MainTabs />
      ) : (
        <OnboardingStackNavigator key={session ? 'authed' : 'guest'} />
      )}
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Stiler
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingTop: spacing.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabIcon: {
    fontSize: 22,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  createIcon: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAction: {
    ...typography.body,
    color: colors.heiaInk,
    fontWeight: '600',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
