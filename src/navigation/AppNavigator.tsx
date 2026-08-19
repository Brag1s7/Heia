import React, {useEffect, useState} from 'react';
import {Alert, Linking, Pressable, Text, StyleSheet, View} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigation,
  type NavigationProp,
  type Theme,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import {colors, typography, spacing, shadows} from '../theme';
import {
  useAuth,
  useActiveTeam,
  useOnboarding,
  useNotifications,
  useCalendarFocus,
} from '../context';
import {BootScreen, CreateSheet, NotificationBanner} from '../components';
import {Bell, Calendar, House, Plus, User} from '../components/icons';
import {
  navigationRef,
  flushPendingDeepLink,
  handleDeepLinkUrl,
} from './deepLink';
import {isTeamAdmin} from '../shared/roles';
import {noteScreen} from '../lib/netMetrics';
import {TeamHomeScreen} from '../screens/TeamHomeScreen';
import {EventDetailScreen} from '../screens/EventDetailScreen';
import {NewEventScreen} from '../screens/NewEventScreen';
import {InviteScreen} from '../screens/InviteScreen';
import {LagkassaScreen} from '../screens/LagkassaScreen';
import {CommentsScreen} from '../screens/CommentsScreen';
import {WelcomeIntentScreen} from '../screens/WelcomeIntentScreen';
import {AuthScreen} from '../screens/AuthScreen';
import {VerifyEmailScreen} from '../screens/VerifyEmailScreen';
import {JoinTeamCodeScreen} from '../screens/JoinTeamCodeScreen';
import {CreateTeamScreen} from '../screens/CreateTeamScreen';
import {KalenderScreen} from '../screens/KalenderScreen';
import {ProfilScreen} from '../screens/ProfilScreen';
import {TeamMembersScreen} from '../screens/TeamMembersScreen';
import {TeamSettingsScreen} from '../screens/TeamSettingsScreen';
import {SupportSetupScreen} from '../screens/SupportSetupScreen';
import {OpsClaimsScreen} from '../screens/OpsClaimsScreen';
import {OpsEntitiesScreen} from '../screens/OpsEntitiesScreen';
import {OpsClaimDetailScreen} from '../screens/OpsClaimDetailScreen';
import {ClubPaymentsScreen} from '../screens/ClubPaymentsScreen';
import {InboxScreen} from '../screens/InboxScreen';
import {SeasonScreen} from '../screens/SeasonScreen';
import type {
  RootTabParamList,
  HomeStackParamList,
  OnboardingStackParamList,
  KalenderStackParamList,
  InboxStackParamList,
  ProfilStackParamList,
} from '../shared/types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const OnboardingNav =
  createNativeStackNavigator<OnboardingStackParamList>();
const KalenderNav = createNativeStackNavigator<KalenderStackParamList>();
const InboxNav = createNativeStackNavigator<InboxStackParamList>();
const ProfilNav = createNativeStackNavigator<ProfilStackParamList>();

// ---------------------------------------------------------------------------
// Navigasjonstema — React Navigations DefaultTheme er hvit, og det er den
// flaten som blottlegges i kantene når iOS-overgangen fjærer forbi målet.
// Container-bakgrunnen må derfor være appens egen bunnfarge.
// ---------------------------------------------------------------------------
const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    primary: colors.heiaInk,
    border: colors.borderSubtle,
  },
};

// ---------------------------------------------------------------------------
// Felles stack-innstillinger
//
// iOS 26 animerer UINavigationBar som en egen plate i eget tempo under
// push/pop — toppen «henger løs» fra siden uansett farge, og systemovergangen
// maskerer i tillegg hjørnene og blottlegger det hvite vinduet bak stacken
// (synlig som hvite hjørneblink mot mørke flater; ingen JS-flate når dit).
// Derfor: ingen native header på push-skjermer — de tegner sin egen
// tilbakelinje (BackBar) som glir med innholdet — og react-native-screens sin
// klassiske slide (`simple_push`) i stedet for systemovergangen, også for
// swipe-tilbake (animationMatchesGesture). Header-stilene under gjelder
// modaler (Ny hendelse), som beholder native header: vertikal presentasjon
// har ingen delt topp-animasjon.
// ---------------------------------------------------------------------------
const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'simple_push',
  animationMatchesGesture: true,
  headerStyle: {backgroundColor: colors.background},
  headerTintColor: colors.textPrimary,
  headerTitleStyle: typography.heading3,
  headerShadowVisible: false,
  headerBackTitle: 'Tilbake',
  // Kortet bak hver skjerm er hvitt til JS-innholdet har malt seg — det er
  // dét som blinker i kantene under push/pop. Mal det i appens bunnfarge.
  contentStyle: {backgroundColor: colors.background},
};

// ---------------------------------------------------------------------------
// «Ny hendelse»-modalen — registrert i alle tre stackene som har EventDetail,
// slik at «Ny kamp» på en turneringsside virker uansett hvilken fane
// turneringen ble åpnet fra.
// ---------------------------------------------------------------------------
const newEventOptions = ({
  navigation,
  route,
}: any): NativeStackNavigationOptions => ({
  // Samme modal, to jobber (2026-08-07). Tittelen er det eneste stedet
  // brukeren ser forskjellen før feltene er fylt ut.
  title: route?.params?.eventId ? 'Rediger' : 'Ny hendelse',
  presentation: 'modal',
  // Modalen beholder native header og vertikal systemanimasjon —
  // `simple_push` fra fellesinnstillingene ville gjort den horisontal.
  headerShown: true,
  animation: 'default',
  // Modaler har ingen tilbake-knapp — brukeren trenger en vei ut.
  headerLeft: () => (
    <Pressable onPress={navigation.goBack} hitSlop={8}>
      <Text style={styles.headerAction}>Avbryt</Text>
    </Pressable>
  ),
});

// ---------------------------------------------------------------------------
// Home stack (Hjem-tab med push-navigasjon)
// ---------------------------------------------------------------------------
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="TeamHome" component={TeamHomeScreen} />
      <HomeStack.Screen name="EventDetail" component={EventDetailScreen} />
      <HomeStack.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={newEventOptions}
      />
      <HomeStack.Screen name="Lagkassa" component={LagkassaScreen} />
      <HomeStack.Screen name="Invite" component={InviteScreen} />
      <HomeStack.Screen name="Comments" component={CommentsScreen} />
      <HomeStack.Screen name="Season" component={SeasonScreen} />
    </HomeStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Kalender stack (Kalender-tab med push til EventDetail)
// ---------------------------------------------------------------------------
function KalenderStackNavigator() {
  return (
    <KalenderNav.Navigator screenOptions={stackScreenOptions}>
      <KalenderNav.Screen name="KalenderList" component={KalenderScreen} />
      <KalenderNav.Screen name="EventDetail" component={EventDetailScreen} />
      <KalenderNav.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={newEventOptions}
      />
    </KalenderNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Inbox stack (Varsler-tab — et varsel kan åpne hendelsen eller kommentartråden
// uten å kaste brukeren over i Hjem-fanen)
// ---------------------------------------------------------------------------
function InboxStackNavigator() {
  return (
    <InboxNav.Navigator screenOptions={stackScreenOptions}>
      <InboxNav.Screen name="InboxList" component={InboxScreen} />
      <InboxNav.Screen name="EventDetail" component={EventDetailScreen} />
      <InboxNav.Screen name="Comments" component={CommentsScreen} />
      {/* Klubbdør-varslene åpnes HER, ikke i Profil-fanen: et varsel skal
          oppføre seg likt uansett hva det peker på — samme innskyving, og
          «Tilbake» tilbake til varsellista. Skjermene er også registrert i
          Profil-stacken, der de er de faste flatene sine. */}
      <InboxNav.Screen name="SupportSetup" component={SupportSetupScreen} />
      <InboxNav.Screen name="ClubPayments" component={ClubPaymentsScreen} />
      <InboxNav.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={newEventOptions}
      />
    </InboxNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Profil stack
// ---------------------------------------------------------------------------
function ProfilStackNavigator() {
  return (
    <ProfilNav.Navigator screenOptions={stackScreenOptions}>
      <ProfilNav.Screen name="Profil" component={ProfilScreen} />
      <ProfilNav.Screen name="TeamMembers" component={TeamMembersScreen} />
      <ProfilNav.Screen name="TeamSettings" component={TeamSettingsScreen} />
      <ProfilNav.Screen name="SupportSetup" component={SupportSetupScreen} />
      <ProfilNav.Screen name="OpsClaims" component={OpsClaimsScreen} />
      <ProfilNav.Screen
        name="OpsClaimDetail"
        component={OpsClaimDetailScreen}
      />
      <ProfilNav.Screen name="OpsEntities" component={OpsEntitiesScreen} />
      <ProfilNav.Screen name="ClubPayments" component={ClubPaymentsScreen} />
      <ProfilNav.Screen name="Invite" component={InviteScreen} />
      <ProfilNav.Screen name="JoinTeamCode" component={JoinTeamCodeScreen} />
      <ProfilNav.Screen name="CreateTeam" component={CreateTeamScreen} />
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
      screenOptions={stackScreenOptions}>
      <OnboardingNav.Screen
        name="WelcomeIntent"
        component={WelcomeIntentScreen}
        // Mørk stadionflate: kortet bak må matche, ellers lyser den lyse
        // standardbakgrunnen i kantene rundt den mørke skjermen under
        // overgangen.
        options={{contentStyle: {backgroundColor: colors.stadium}}}
      />
      <OnboardingNav.Screen name="Auth" component={AuthScreen} />
      <OnboardingNav.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
      />
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
// Tab-ikoner — Lucide (stroke 2, som artifacten)
// ---------------------------------------------------------------------------
const tabIcons: Record<
  keyof RootTabParamList,
  React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>
> = {
  HjemStack: House,
  KalenderStack: Calendar,
  Opprett: Plus,
  InboxStack: Bell,
  ProfilStack: User,
};

// ---------------------------------------------------------------------------
// Hoved-tabs
// ---------------------------------------------------------------------------
function MainTabs() {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const {activeRole} = useActiveTeam();
  const {unreadCount, refreshUnread} = useNotifications();
  const calendarFocus = useCalendarFocus();
  // Datoen leses ÉN gang, i det arket åpnes. Den ligger i en ref hos Kalender
  // nettopp for at scrolling der ikke skal rendre hele fanetreet på nytt.
  const [sheet, setSheet] = useState<{visible: boolean; day: string | null}>({
    visible: false,
    day: null,
  });

  // Et varsel-trykk ved kaldstart kommer mens onboarding/lasting står fremme,
  // og da finnes ikke HjemStack ennå. Fanene er første øyeblikk målet faktisk
  // kan åpnes — derfor et nytt forsøk her.
  useEffect(() => {
    flushPendingDeepLink();
  }, []);

  const closeSheet = () => setSheet(prev => ({...prev, visible: false}));

  const handleShare = () => {
    closeSheet();
    // Ny nonce hver gang, ellers fokuserer ikke compose-boksen på nytt.
    navigation.navigate('HjemStack', {
      screen: 'TeamHome',
      params: {composeNonce: Date.now()},
    });
  };

  const handleNewEvent = () => {
    const day = sheet.day;
    closeSheet();
    // Kommer man fra Kalender, åpnes skjemaet I Kalender-stacken med datoen
    // man ser på — «Avbryt» skal legge deg tilbake der du var, ikke i Hjem.
    if (day !== null) {
      navigation.navigate('KalenderStack', {
        screen: 'NewEvent',
        params: {presetDate: day},
        initial: false,
      });
      return;
    }
    navigation.navigate('HjemStack', {screen: 'NewEvent', initial: false});
  };

  return (
    <>
    <Tab.Navigator
      // `notifications` er ikke i realtime-publiseringen, så badgen hentes på
      // nytt hver gang man bytter fane (én HEAD-spørring med count).
      screenListeners={{focus: () => refreshUnread()}}
      screenOptions={({route}) => ({
        headerShown: false,
        // A v2: aktiv fane = mørk tekst + mint-pille bak ikonet.
        // (#02FFAB som tekstfarge på lyst brøt kontrastkravet.)
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        // Standard-slotten er ~30 px bred og klipper alt bredere — pillen
        // trenger hele bredden sin, ellers kuttes glyfen til en strimmel.
        tabBarIconStyle: styles.tabIconSlot,
        tabBarIcon: ({color, focused}) => {
          const IconGlyph = tabIcons[route.name];
          if (route.name === 'Opprett') {
            return (
              <View style={styles.createButton}>
                <Plus size={24} color={colors.heiaDeep} strokeWidth={2.4} />
              </View>
            );
          }
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
              <IconGlyph
                size={21}
                color={focused ? colors.heiaDeep : color}
                strokeWidth={focused ? 2.2 : 2}
              />
            </View>
          );
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
            setSheet({visible: true, day: calendarFocus.read()});
          },
        }}
      />
      <Tab.Screen
        name="InboxStack"
        component={InboxStackNavigator}
        options={{
          tabBarLabel: 'Varsler',
          // undefined = ingen badge. 99+ så tallet ikke sprenger prikken.
          tabBarBadge:
            unreadCount > 0
              ? unreadCount > 99
                ? '99+'
                : unreadCount
              : undefined,
          tabBarBadgeStyle: styles.tabBadge,
        }}
      />
      <Tab.Screen
        name="ProfilStack"
        component={ProfilStackNavigator}
        options={{tabBarLabel: 'Profil'}}
      />
    </Tab.Navigator>

    <CreateSheet
      visible={sheet.visible}
      canCreateEvent={isTeamAdmin(activeRole)}
      calendarDay={sheet.day}
      onClose={closeSheet}
      onShare={handleShare}
      onNewEvent={handleNewEvent}
    />

    {/* Over fanene, så varselet følger deg gjennom hele appen. */}
    <NotificationBanner />
    </>
  );
}

// Oppstartsflaten bor i `BootScreen` — stadionflate + lockup, samme bilde som
// launch screen og WelcomeIntent (se komponenten for hvorfor).

// ---------------------------------------------------------------------------
// Rot-navigator — betinget onboarding vs. hoved-app
// ---------------------------------------------------------------------------
export function AppNavigator() {
  const {session, profile, loading} = useAuth();
  const {userMemberships, loading: teamLoading} = useActiveTeam();
  const {pendingAction, lastError, setLastError} = useOnboarding();

  const hasTeam = userMemberships.length > 0;

  // heia://-lenker (JS-Linking-restansen fra native-runden): kaldstart-URL-en
  // hentes én gang, og lytteren dekker trykk mens appen kjører. Målet
  // parkeres i deepLink-laget til navigatoren faktisk kan åpne det.
  useEffect(() => {
    Linking.getInitialURL().then(handleDeepLinkUrl);
    const sub = Linking.addEventListener('url', ({url}) =>
      handleDeepLinkUrl(url),
    );
    return () => sub.remove();
  }, []);

  // WelcomeIntent viser lastError for en gjest. Har brukeren alt et lag rendres
  // MainTabs, og feilen ville forsvunnet i stillhet — så vi sier fra her.
  useEffect(() => {
    if (lastError && hasTeam) {
      Alert.alert('Noe gikk galt', lastError);
      setLastError(null);
    }
  }, [lastError, hasTeam, setLastError]);

  // Vent på profil + memberships så vi ikke blinker innom feil skjerm.
  if (loading || (session && !profile) || (session && teamLoading)) {
    return <BootScreen />;
  }

  // Innlogget med en pending intent (auth-before-commit): fullfør join/create.
  // Gjelder også når brukeren alt har et lag og blir med i sitt neste.
  if (session && profile && pendingAction) {
    return <BootScreen message="Setter opp laget…" />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        // A0-skjermattribusjon (P9): netMetrics stempler hvert Supabase-kall
        // med fokusert rute. Før dette punktet attribueres alt til
        // «(oppstart)» — boot-kallene er et eget, interessant tall.
        noteScreen(navigationRef.getCurrentRoute()?.name);
        flushPendingDeepLink();
      }}
      onStateChange={() => noteScreen(navigationRef.getCurrentRoute()?.name)}>
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
    backgroundColor: '#FCFDF8',
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingTop: spacing.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabIconSlot: {
    width: 64,
    height: 32,
  },
  iconWrap: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: colors.heia,
  },
  tabBadge: {
    backgroundColor: colors.live,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Squircle med mint-glød — +-knappen er appens hovedhandling
  createButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    ...shadows.glow,
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
});
