import React, {useCallback, useEffect, useMemo} from 'react';
import {
  Alert,
  Animated,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type {BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  DefaultTheme,
  getFocusedRouteNameFromRoute,
  useNavigation,
  type NavigationProp,
  type RouteProp,
  type Theme,
} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import {colors, matchColors, typography, spacing, shadows} from '../theme';
import {
  useAuth,
  useActiveTeam,
  useOnboarding,
  useNotifications,
} from '../context';
import {useMatchButton} from '../context/MatchButtonContext';
import {matchButtonHasGlyph} from '../shared/matchButton';
import {matchButtonGeometry} from '../shared/matchButtonGeometry';
import {
  CAPSULE,
  TAB_BAR_GLASS_AB,
  tabBarHiddenFor,
  tabBarItemsWidth,
  tabBarTotalHeight,
  capsuleBottomGap,
} from '../shared/tabBarLayout';
import {
  BootScreen,
  MatchTabButton,
  NotificationBanner,
  DAYLIGHT_GROUND_AB,
  DAYLIGHT_GROUND_FALLBACK,
} from '../components';
import {Bell, Calendar, House, User} from '../components/icons';
// Direkte filstier, ikke `../components`: tabBar-testen mocker hele
// index-modulen med tre stubber, og glasset/blekket skal rendres ekte der.
import {TabBarGlass, type TabBarEnvironment} from '../components/TabBarGlass';
import {TabButton, TAB_PRESS, useTabPress} from '../components/TabButton';
import {OPAL} from '../components/OpalSurface';
import {
  navigationRef,
  flushPendingDeepLink,
  handleDeepLinkUrl,
} from './deepLink';
import {noteScreen} from '../lib/netMetrics';
import {refreshLiveMatchIfStale} from '../lib/queries/liveMatch';
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
import {ChangePasswordScreen} from '../screens/ChangePasswordScreen';
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
  KampStackParamList,
  InboxStackParamList,
  ProfilStackParamList,
} from '../shared/types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const OnboardingNav = createNativeStackNavigator<OnboardingStackParamList>();
const KalenderNav = createNativeStackNavigator<KalenderStackParamList>();
const KampNav = createNativeStackNavigator<KampStackParamList>();
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

/**
 * Skjermene som har dagslysgrunnen (Hjem, Kalender, Varsler): kortet bak
 * skjermen males i grunnens dominante mint, ellers blinker krem i kantene
 * under push/pop (samme grep som EventDetail gjør for kampens grunn).
 * Følger A/B-bryteren, så «av» er nøyaktig som før.
 */
const daylightGroundOptions: NativeStackNavigationOptions | undefined =
  DAYLIGHT_GROUND_AB
    ? {contentStyle: {backgroundColor: DAYLIGHT_GROUND_FALLBACK}}
    : undefined;

// ---------------------------------------------------------------------------
// «Ny hendelse»-modalen — registrert i alle tre stackene som har EventDetail,
// slik at «Ny kamp» på en turneringsside virker uansett hvilken fane
// turneringen ble åpnet fra.
// ---------------------------------------------------------------------------
const newEventOptions: NativeStackNavigationOptions = {
  // SKJEMA-ARKET (Brage 2026-09-03): «Ny hendelse» oppfører seg som
  // kommentararket. Ruta er GJENNOMSIKTIG (skjermen bak står synlig), uten
  // header og uten egen animasjon — `FormSheet` i skjermen eier glasset,
  // scrimmet, innglidningen, draget og utglidningen (så `goBack`).
  presentation: 'transparentModal',
  animation: 'none',
  headerShown: false,
  contentStyle: {backgroundColor: 'transparent'},
};

// ---------------------------------------------------------------------------
// Home stack (Hjem-tab med push-navigasjon)
// ---------------------------------------------------------------------------
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      {/* Skive 1A: dagslysgrunnen — se `daylightGroundOptions`. */}
      <HomeStack.Screen
        name="TeamHome"
        component={TeamHomeScreen}
        options={daylightGroundOptions}
      />
      <HomeStack.Screen name="EventDetail" component={EventDetailScreen} />
      <HomeStack.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={newEventOptions}
      />
      <HomeStack.Screen name="Lagkassa" component={LagkassaScreen} />
      <HomeStack.Screen name="Invite" component={InviteScreen} />
      <HomeStack.Screen name="Comments" component={CommentsScreen} />
      {/* ⚠️ SAMME KOMPONENT SOM I `KampStack`. «Sesongen»-snarveien i
          laghodet er en HJEM-inngang: du kom fra Hjem, og «tilbake» skal
          føre til Hjem. Flere ruter til én skjerm, ikke to sannheter. */}
      <HomeStack.Screen name="Season" component={SeasonScreen} />
    </HomeStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Kamp stack (skive 10.3) — SESONGEN ER ROTEN, KAMPEN LIGGER OVER
//
// ⚠️ Brages beslutning etter tredje telefonrunde: bunnlinja viste «Profil»
// som aktiv mens man sto inne i kampen, fordi kampen bodde i fanen man
// tilfeldigvis kom fra. Nå har kampen sitt eget sted, og fanen er valgt
// både visuelt og semantisk.
//
// `NewEvent` er med fordi BÅDE Sesongen («Ny kamp», «Ny turnering») og
// kampsiden («Rediger», «Ny kamp» på en turnering) navigerer dit.
// ---------------------------------------------------------------------------
function KampStackNavigator() {
  return (
    <KampNav.Navigator screenOptions={stackScreenOptions}>
      <KampNav.Screen name="Season" component={SeasonScreen} />
      <KampNav.Screen name="EventDetail" component={EventDetailScreen} />
      <KampNav.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={newEventOptions}
      />
      <KampNav.Screen name="Lagkassa" component={LagkassaScreen} />
    </KampNav.Navigator>
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
        options={daylightGroundOptions}
      />
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
      <InboxNav.Screen
        name="InboxList"
        component={InboxScreen}
        options={daylightGroundOptions}
      />
      <InboxNav.Screen name="EventDetail" component={EventDetailScreen} />
      <InboxNav.Screen name="Comments" component={CommentsScreen} />
      {/* Klubbdør-varslene åpnes HER, ikke i Profil-fanen: et varsel skal
          oppføre seg likt uansett hva det peker på — samme innskyving, og
          «Tilbake» tilbake til varsellista. Skjermene er også registrert i
          Profil-stacken, der de er de faste flatene sine. */}
      <InboxNav.Screen name="SupportSetup" component={SupportSetupScreen} />
      <InboxNav.Screen name="ClubPayments" component={ClubPaymentsScreen} />
      {/* Rollevarslene (00067) åpner lagoversikten her av samme grunn.
          `Invite` MÅ følge med: lagoversikten har en «Inviter til laget»-rad,
          og uten ruten i DENNE stacken er den raden en død knapp når skjermen
          nås fra et varsel. */}
      <InboxNav.Screen name="TeamMembers" component={TeamMembersScreen} />
      <InboxNav.Screen name="Invite" component={InviteScreen} />
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
      <ProfilNav.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
      />
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
      <OnboardingNav.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <OnboardingNav.Screen
        name="JoinTeamCode"
        component={JoinTeamCodeScreen}
      />
      <OnboardingNav.Screen name="CreateTeam" component={CreateTeamScreen} />
    </OnboardingNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Tab-ikoner — Lucide (stroke 2, som artifacten)
//
// `Kamp` står ikke her: midtplassen er ikke et ikon, den er en tilstand
// (`MatchTabButton`).
// ---------------------------------------------------------------------------
const tabIcons: Record<
  Exclude<keyof RootTabParamList, 'Kamp'>,
  React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>
> = {
  HjemStack: House,
  KalenderStack: Calendar,
  InboxStack: Bell,
  ProfilStack: User,
};

// ---------------------------------------------------------------------------
// Hoved-tabs
// ---------------------------------------------------------------------------
/**
 * ⚠️ EKSPORTERT FOR TEST. `__tests__/tabBar.test.tsx` monterer baren med
 * stubbede skjermer og beviser at de fire andre fanene står uendret i ALLE
 * kampknappens tilstander — påstanden skive 10 hviler på.
 */
/**
 * Fanens knapp med fysisk trykkrespons (Brage 2026-09-03) — se TabButton.
 * Modulnivå (ikke inline i render), så biblioteket ser samme type hver gang.
 */
const renderTabButton = (props: BottomTabBarButtonProps) => (
  <TabButton {...props} />
);
/** KAMP: egen, roligere kompresjon rundt kampknappens egen geometri. */
const renderMatchTabButton = (props: BottomTabBarButtonProps) => (
  <TabButton {...props} compress={TAB_PRESS.compressMatch} />
);

/**
 * Ikonets mintmarkør. Den AKTIVE markøren squasher svakt horisontalt på
 * trykk og fjærer tilbake — samme `press`-verdi som knappen (useTabPress),
 * så knapp og markør beveger seg i ett. Reduce Motion: ingen transform.
 */
function TabIconWrap({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const tabPress = useTabPress();
  const squash =
    focused && tabPress && !tabPress.reducedMotion
      ? {
          transform: [
            {
              scaleX: tabPress.press.interpolate({
                inputRange: [0, 1],
                outputRange: [1, TAB_PRESS.squashX],
              }),
            },
            {
              scaleY: tabPress.press.interpolate({
                inputRange: [0, 1],
                outputRange: [1, TAB_PRESS.squashY],
              }),
            },
          ],
        }
      : null;
  return (
    <Animated.View
      style={[styles.iconWrap, focused && styles.iconWrapOn, squash]}>
      {children}
    </Animated.View>
  );
}

export function MainTabs() {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const {activeTeamSpaceId} = useActiveTeam();
  const {unreadCount, refreshUnreadIfStale} = useNotifications();
  const {state: matchButton, press: pressMatch, inMatch} = useMatchButton();
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();

  /**
   * TAB-BAREN SOM FLYTENDE GLASSKAPSEL (Brage 2026-09-03, alternativ A).
   *
   * Baren er absolutt: skjerminnholdet og DaylightGround løper under den,
   * og skjermene reserverer plassen med `useBottomContentPadding` (som leser
   * biblioteket sin målte barhøyde — safe area telles én gang, inne i den).
   * Containeren er kapsel + løft + safe area høy med bunnpadding = safe
   * area + løft, så innholdsboksen fanene legges ut i ER kapselens 64 pt.
   *
   * TO MILJØER, ÉN GEOMETRI: `inMatch` (du står inne i en pågående kamp)
   * bytter tint til mørkt stadionglass og blekket til opalhvitt. Ingenting
   * annet endres — verken høyde, bredde, løft eller kampknappens tilstand.
   * Det er en tint, ikke en «stadionvariant av baren» (P4-poenget om
   * reflow står: stilobjektet er det samme i alle kampknappens tilstander).
   */
  const environment: TabBarEnvironment = inMatch ? 'match' : 'light';
  const tabBarStyle = useMemo(
    () =>
      TAB_BAR_GLASS_AB
        ? [
            styles.tabBarGlass,
            {
              height: tabBarTotalHeight(insets.bottom),
              paddingBottom: capsuleBottomGap(insets.bottom),
            },
          ]
        : styles.tabBar,
    [insets.bottom],
  );
  const renderTabBarBackground = useCallback(
    () =>
      TAB_BAR_GLASS_AB ? (
        <TabBarGlass
          environment={environment}
          containerHeight={tabBarTotalHeight(insets.bottom)}
        />
      ) : null,
    [environment, insets.bottom],
  );
  /**
   * Skjult på kommentarsiden (Brage): komponeringslinja skal ikke ligge over
   * en synlig glassbar. Per stack, fordi biblioteket leser `tabBarStyle` fra
   * den fokuserte FANENS options — `undefined` rutenavn = stacken har ikke
   * rendret ennå = roten = synlig.
   */
  const stackTabBarStyle = useCallback(
    (route: RouteProp<RootTabParamList>) =>
      tabBarHiddenFor(getFocusedRouteNameFromRoute(route))
        ? styles.tabBarHidden
        : tabBarStyle,
    [tabBarStyle],
  );
  const inactiveInk =
    environment === 'match'
      ? matchColors.dim
      : TAB_BAR_GLASS_AB
      ? OPAL.inkSecondary
      : colors.textTertiary;
  const activeInk =
    environment === 'match' ? matchColors.text : colors.textPrimary;

  // Et varsel-trykk ved kaldstart kommer mens onboarding/lasting står fremme,
  // og da finnes ikke HjemStack ennå. Fanene er første øyeblikk målet faktisk
  // kan åpnes — derfor et nytt forsøk her.
  useEffect(() => {
    flushPendingDeepLink();
  }, []);

  /**
   * KAMPKNAPPENS TRYKK (P4, skive 10).
   *
   * `from` er fanen brukeren STÅR I. Den kan leses trygt fordi `tabPress`
   * avbrytes med `preventDefault()` — fokus har ikke rukket å flytte seg.
   */
  /**
   * KAMPKNAPPENS TRYKK (skive 10.3).
   *
   * ⚠️ FANEN ER EKTE NÅ, men trykket er fortsatt avbrutt — fordi knappen
   * betyr fire forskjellige ting. Inne i kampen skal den IKKE navigere noe
   * sted; da er den en handling, og et fanebytte ville rykket deg vekk fra
   * kampen du står i.
   */
  const handleMatchPress = () => {
    if (matchButton.disabled) return;

    switch (matchButton.kind) {
      // Inne i kampen: skjermen eier handlingen (HEIA, eller dokken av/på).
      // Fanen er allerede valgt — ingen navigasjon.
      case 'heia':
      case 'heiet':
      case 'rapporter':
      case 'lukk':
        pressMatch();
        return;

      // Én livekamp, utenfor den: åpne den i Kamp-fanen, som er der kampen
      // bor. ⚠️ Registrerer ingen HEIA — a11y-labelen sier «Åpne kampen»,
      // og den skal være sann.
      case 'live':
      case 'pause':
        if (matchButton.openEventId) {
          navigation.navigate('Kamp', {
            screen: 'EventDetail',
            params: {eventId: matchButton.openEventId},
            initial: false,
          });
        }
        return;

      // Hvile: KAMP → Sesongen, som ER roten i fanen. Eksplisitt `screen`,
      // ikke bare et fanebytte: står en FERDIG kamp igjen på toppen av
      // stacken, skal knappen føre deg til sesongen — ikke tilbake til
      // gårsdagens kamp.
      case 'idle':
      case 'unknown':
        navigation.navigate('Kamp', {screen: 'Season'});
        return;

      // 'heia-tom' er `disabled` og fanget over.
      default:
        return;
    }
  };

  return (
    <>
      <Tab.Navigator
        // Fanebytte er en RESYNC-mulighet, ikke en hentegaranti: badgen og
        // live-kampen friskes opp KUN hvis forrige svar er > 60 s gammelt
        // (S1-a, samme regel som `useScreenFocusRefetch`). Live-stien er
        // fortsatt den SETTINGS-UAVHENGIGE kilden for en bruker som har
        // slått av kampvarsler (se `useLiveMatch`).
        //
        // ⚠️ Den gamle kommentaren her påsto at `staleTime` hindret en
        // kallstorm — det var feil: `staleTime` TILLATER en refetch, den
        // stopper ingen `invalidateQueries`, og HEAD-telleren har ingen
        // staleTime i det hele tatt. Hvert fanebytte kostet to kall.
        screenListeners={{
          focus: () => {
            refreshUnreadIfStale();
            refreshLiveMatchIfStale(activeTeamSpaceId);
          },
        }}
        screenOptions={({route}) => ({
          headerShown: false,
          // A v2: aktiv fane = mørk tekst + mint-pille bak ikonet.
          // (#02FFAB som tekstfarge på lyst brøt kontrastkravet.)
          // Glass: inaktivt blekk er OPAL.inkSecondary (kontrastporten over
          // blur), på kampsiden opalhvitt dim/text.
          tabBarActiveTintColor: activeInk,
          tabBarInactiveTintColor: inactiveInk,
          tabBarStyle,
          tabBarBackground: renderTabBarBackground,
          // Egen knapp: biblioteket gir kun onPress — pressIn/pressOut og
          // responsen bor i TabButton.
          tabBarButton: renderTabButton,
          tabBarLabelStyle: styles.tabLabel,
          // Standard-slotten er ~30 px bred og klipper alt bredere — pillen
          // trenger hele bredden sin, ellers kuttes glyfen til en strimmel.
          tabBarIconStyle: styles.tabIconSlot,
          tabBarIcon: ({color, focused}) => {
            // Midtplassen er ikke et ikon, den er en tilstand. Komponenten
            // leser den selv, så et mål i kampen ikke rendrer hele fanetreet.
            if (route.name === 'Kamp') {
              // Fanen er ekte, så `focused` er sann semantikk — knappen tegner
              // sin egen valgt-markering (mint ring), uten å bytte fyllfarge.
              return <MatchTabButton focused={focused} />;
            }
            const IconGlyph = tabIcons[route.name];
            return (
              <TabIconWrap focused={focused}>
                <IconGlyph
                  size={21}
                  color={focused ? colors.heiaDeep : color}
                  strokeWidth={focused ? 2.2 : 2}
                />
              </TabIconWrap>
            );
          },
        })}>
        <Tab.Screen
          name="HjemStack"
          component={HomeStackNavigator}
          options={({route}) => ({
            tabBarLabel: 'Hjem',
            tabBarStyle: stackTabBarStyle(route),
          })}
        />
        <Tab.Screen
          name="KalenderStack"
          component={KalenderStackNavigator}
          options={{tabBarLabel: 'Kalender'}}
        />
        <Tab.Screen
          name="Kamp"
          component={KampStackNavigator}
          options={{
            // «Sesongen» i hvile, «Kamp» ellers — prototypens sublabel sier
            // hvor du havner, ikke hva knappen heter.
            tabBarLabel: matchButton.tabLabel,
            // ⚠️ INGEN FALSK KAMP-MARKERING (kildebevarende tabmodell).
            // Et tidligere utkast ga etiketten aktivt blekk så snart man sto
            // i EN kamp — også når kampen var åpnet fra Kalender og Kalender
            // var den ekte valgte fanen. Da lyste to faner samtidig, og den
            // ene løy. Fanen er ekte nå: biblioteket fargelegger etiketten
            // når den FAKTISK er fokusert, og ikke ellers.
            tabBarLabelStyle: styles.tabLabel,
            // ⚠️ Midtplassens ikonslott er BREDERE enn de andres. Den globale
            // `tabIconSlot` er 64 pt, og en pille med «RAPPORTER» ble klippet
            // til «RAPPORT…» inni den. Dette er en per-rute-option: de fire
            // andre fanene har fortsatt sin egen 64 pt-slott, og elementene er
            // like brede som før.
            tabBarIconStyle: {
              width: matchButtonGeometry(
                windowWidth,
                1,
                matchButton.label,
                matchButton.shortLabel,
                matchButtonHasGlyph(matchButton.kind),
                // Samme kapselbredde som `MatchTabButton` måler mot.
                tabBarItemsWidth(windowWidth),
              ).maxWidth,
              height: 32,
            },
            // Hele setningen, ikke bare ordet. Uten den ville VoiceOver lest
            // «2–1» og ingenting om at det er en live kamp du kan åpne.
            tabBarAccessibilityLabel: matchButton.a11yLabel,
            tabBarButton: renderMatchTabButton,
          }}
          listeners={{
            tabPress: e => {
              e.preventDefault();
              handleMatchPress();
            },
          }}
        />
        <Tab.Screen
          name="InboxStack"
          component={InboxStackNavigator}
          options={({route}) => ({
            tabBarLabel: 'Varsler',
            tabBarStyle: stackTabBarStyle(route),
            // undefined = ingen badge. 99+ så tallet ikke sprenger prikken.
            tabBarBadge:
              unreadCount > 0
                ? unreadCount > 99
                  ? '99+'
                  : unreadCount
                : undefined,
            tabBarBadgeStyle: styles.tabBadge,
          })}
        />
        <Tab.Screen
          name="ProfilStack"
          component={ProfilStackNavigator}
          options={{tabBarLabel: 'Profil'}}
        />
      </Tab.Navigator>

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
  const {bootReady} = useMatchButton();
  const {userMemberships, loading: teamLoading} = useActiveTeam();
  const {pendingAction, lastError, setLastError} = useOnboarding();

  const hasTeam = userMemberships.length > 0;
  // §3d (FORLAT-LAG-DORMANT): brukere uten aktive lag er en varig,
  // førsteklasses tilstand — IKKE et onboarding-tilbakefall. Stempelet
  // settes server-side ved første join/create (00067-triggeren) og er
  // backfillet for alle med en medlemsrad. hasTeam vinner alltid
  // (defensivt: et manglende stempel skal aldri kaste et lagmedlem ut).
  const onboarded = profile?.onboardingCompletedAt != null;

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

  // WelcomeIntent viser lastError for en gjest. Rendres MainTabs eller den
  // lagløse Profil-roten i stedet, ville feilen forsvunnet i stillhet — så
  // vi sier fra her.
  useEffect(() => {
    if (lastError && (hasTeam || onboarded)) {
      Alert.alert('Noe gikk galt', lastError);
      setLastError(null);
    }
  }, [lastError, hasTeam, onboarded, setLastError]);

  // Vent på profil + memberships så vi ikke blinker innom feil skjerm.
  // ⚠️ KAMPKNAPPEN MÅ VÆRE PÅ PLASS FØR APPEN VISES (Brage 2026-08-21).
  // «viser knappen først kamp, deretter hopper den over til stillingen» —
  // og `KAMP` betyr «ingen kamp pågår». Å gjøre hoppet penere hjalp ikke;
  // det eneste som fjerner det er å ikke tegne baren før svaret er der.
  // `bootReady` har sitt eget tak, så en treg forbindelse aldri kan holde
  // appen igjen (se `MatchButtonContext`).
  if (
    loading ||
    (session && !profile) ||
    (session && teamLoading) ||
    (session && profile && !bootReady)
  ) {
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
      ) : session && profile && onboarded ? (
        // Den lagløse grenen (§3d): Profil-rotet stack — «Bli med i et
        // lag» og «Opprett et nytt lag» bor der, sammen med Min støtte,
        // Klubbetalinger og ops-flatene. Gjenbruker hele Profil-stacken:
        // lag-skjermene i den er bare nåbare med et aktivt lag.
        <ProfilStackNavigator />
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
  // Den solide baren (TAB_BAR_GLASS_AB = false). Urørt.
  tabBar: {
    backgroundColor: '#FCFDF8',
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingTop: spacing.sm,
  },
  // Glasskapselens CONTAINER: gjennomsiktig, absolutt, uten kant — selve
  // kapselen tegnes av `TabBarGlass` i `tabBarBackground`. Høyde og
  // bunnpadding settes per safe area i `MainTabs`. `paddingTop` sentrerer
  // ikon + etikett (biblioteket legger dem fra toppen) i de 64 punktene.
  tabBarGlass: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 4,
    paddingHorizontal: CAPSULE.inset,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
  },
  tabBarHidden: {
    display: 'none',
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
