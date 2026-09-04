import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Linking,
  Alert,
  AppState,
  Modal,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useNavigation,
  CommonActions,
  type NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius} from '../theme';
import {
  pickPrimaryMembership,
  uniqueTeamMemberships,
} from '../shared/activeMembership';
import {
  Avatar,
  AvatarColorPicker,
  ListRow,
  ListRowSkeleton,
  ProfileHeader,
  PROFILE_IDENTITY,
  DaylightGround,
  DAYLIGHT_GROUND_AB,
  TeamBadge,
  useBottomContentPadding,
} from '../components';
import {OpalSurface, OPAL} from '../components/OpalSurface';
import {OPAL_ROW_ICON_SLOT} from '../components/ListRow';
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  FileText,
  HandHeart,
  Info,
  Lock,
  LogOut,
  Phone,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from '../components/icons';
import {useAuth, useActiveTeam} from '../context';
import {TERMS_URL, PRIVACY_URL} from '../shared/links';
import {isTeamAdmin, ROLE_LABELS} from '../shared/roles';
import {
  isPushAvailable,
  getPushPermission,
  enablePush,
  type PushPermission,
} from '../lib/push';
import {
  updateProfile,
  getMySupportOverview,
  openSupportPortal,
  isOpsAdmin,
  isPaymentManager,
  leaveTeam,
  type MySupportItem,
} from '../lib/api';
import {errorMessage} from '../shared/errorMessage';
import {pickAvatarImage} from '../lib/media';
import {deleteAvatarFile, uploadAvatar} from '../lib/media/avatar';
import {confirmDeleteAccount, registerLocalCache} from '../lib/account';
import {useAppVersion} from '../lib/appVersion';
import {formatKr} from '../lib/money';
import type {ProfilStackParamList, RootTabParamList} from '../shared/types';

// Undertekst på «Varslinger»-raden per status.
const PUSH_SUBTITLE: Record<PushPermission, string> = {
  authorized: 'På — du får beskjed når laget scorer',
  denied: 'Av — trykk for å skru på i Innstillinger',
  undetermined: 'Trykk for å skru på',
  unavailable: 'Utilgjengelig på denne enheten',
};

type Nav = NativeStackNavigationProp<ProfilStackParamList, 'Profil'>;

// Mint-strek-etiketten — samme merkevaredetalj som SectionHeader, men uten
// dens innebygde padding (seksjonene her eier luften selv).
// `tone="stadium"`: etiketten står i dagslysgrunnens mørke topp (rett under
// headeren) — stadionblekk, som kalenderchromen. Kun «Dine lag» står
// deterministisk der; resten av etikettene følger reisen nedover.
function SectionLabel({title, tone}: {title: string; tone?: 'stadium'}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionDash} />
      <Text
        style={[
          styles.sectionTitle,
          tone === 'stadium' && styles.sectionTitleStadium,
        ]}>
        {title}
      </Text>
    </View>
  );
}

// Ikonet i en avrundet kvadrat (32 = OPAL_ROW_ICON_SLOT) med blekket som
// svak tint bak glyfen — samme hierarkiske gjengivelse som varselradene (én
// farge, to styrker), og samme akse for alle rader (P7: ingen tomme
// streng-slots). `ink` = innstilling/navigasjon i OPAL-blekk, `action` =
// inngang (Bli med, Opprett) i opalens aksentblekk på heiaSoft, `danger` =
// «Slett konto» i live-rødt.
type MenuTone = 'ink' | 'action' | 'danger';
const MENU_ICON_INK: Record<MenuTone, string> = {
  ink: OPAL.inkSecondary,
  action: OPAL.inkAccent,
  danger: colors.liveInk,
};
const MENU_ICON_TINT: Record<MenuTone, string> = {
  ink: 'rgba(8, 57, 46, 0.08)',
  action: colors.heiaSoft,
  danger: 'rgba(224, 74, 68, 0.12)',
};

/**
 * VALGT LAG — INGEN egen ring (Brage 2026-09-04, runde 2 av polishen:
 * «trenger ikke en tydelig separat ring. Checkmark + svak team/Heia-tint +
 * subtil edge er nok»). Neon i full styrke er reservert for HANDLING
 * (kampknappen, primærknappen, aktiv fane); et valgt lagkort er en TILSTAND,
 * og en farget ring rundt hele flaten leste CTA-aktig. Runde 1 dempet ringen
 * til 0,40 — runde 2 fjerner den.
 *
 * Tilstanden bæres nå av tre ting som alle bor I materialet: den svake
 * Heia-tinten i flaten, haken til høyre, og panelets egen kantfysikk.
 * Blir den for svak på telefonen, er det TINTEN som løftes — ikke en ny ring.
 */
function MenuIcon({
  children,
  tone = 'ink',
}: {
  children: ReactNode;
  tone?: MenuTone;
}) {
  return (
    <View
      style={[styles.menuIconSlot, {backgroundColor: MENU_ICON_TINT[tone]}]}>
      {children}
    </View>
  );
}

// Chevron på rader som NAVIGERER — handlinger (logg ut, varsler) får ingen.
function RowChevron() {
  return <ChevronRight size={16} color={OPAL.inkTertiary} strokeWidth={2} />;
}

// MENYGRUPPENE OG LAGKORTENE (Brage 2026-09-04) deler materiale: OpalSurface
// — den matte, frostede perlen (0,92 i tekstsonen, 0,87 mot kantene),
// kantlys øverst til venstre, blekk-motkant nederst til høyre, grønn skygge.
// Rolig, strukturert og lesbart der Varsler er levende arkglass: samme
// Heia-familie, annen karakter. Radene inni er `ListRow material="opal"`.
function MenuGroup({children}: {children: ReactNode}) {
  return <OpalSurface variant="panel">{children}</OpalSurface>;
}

// Siste kjente «Min støtte»-svar — lever over remounts så seksjonen aldri
// popper inn for en supporter. Modul-state overlever utlogging, så cachen
// er registrert hos clearLocalCaches (kalles fra selve signOut i
// UserContext): RLS gir uansett kun egne rader, men en ny bruker skal
// aldri se forrige brukers avtaler et blunk.
let supportOverviewCache: MySupportItem[] | null = null;
registerLocalCache(() => {
  supportOverviewCache = null;
});

// Statuslinjen på «Min støtte»-raden — rolig informasjon, aldri alarm.
function supportStatusLine(item: MySupportItem): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('nb-NO', {day: 'numeric', month: 'long'});
  if (item.cancelAt) return `Avsluttes ${fmt(item.cancelAt)}`;
  if (item.status === 'past_due') {
    return 'Betalingen feilet — Stripe prøver igjen';
  }
  return item.currentPeriodEnd
    ? `Aktiv · fornyes ${fmt(item.currentPeriodEnd)}`
    : 'Aktiv';
}

export function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomContentPadding();
  const {session, profile, signOut, refreshProfile} = useAuth();
  const {
    activeTeamSpaceId,
    userMemberships,
    setActiveTeamSpace,
    refreshMemberships,
  } = useActiveTeam();
  const navigation = useNavigation<Nav>();

  // Versjonen LESES fra bundelen (se lib/appVersion) — den skal aldri igjen
  // kunne stå og lyve i TestFlight. `null` = ukjent, og da vises ingen rad.
  const appVersion = useAppVersion();

  // Varsel-status. Oppdateres når skjermen mountes og hver gang appen kommer i
  // forgrunn igjen (bytter du i iOS-Innstillinger og kommer tilbake, stemmer den).
  const [pushPerm, setPushPerm] = useState<PushPermission>('unavailable');
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getPushPermission().then(p => mounted && setPushPerm(p));
    };
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // «Heia Ops» (00046) — intern klubbsøknad-flate. Raden vises kun for
  // brukere i ops_admins (DB-sannheten; RPC-ene er vaktene, raden er speil).
  const [isOps, setIsOps] = useState(false);
  useEffect(() => {
    let mounted = true;
    isOpsAdmin().then(v => mounted && setIsOps(v));
    return () => {
      mounted = false;
    };
  }, []);

  // «Klubbetalinger» (klubbdøren, 00047) — hovedinngangen for
  // betalingsansvarlig bor på PROFIL (låst). Samme speil-mønster som ops.
  const [isManager, setIsManager] = useState(false);
  useEffect(() => {
    let mounted = true;
    isPaymentManager().then(v => mounted && setIsManager(v));
    return () => {
      mounted = false;
    };
  }, []);

  // «Min støtte» (betalingsspor fase 5) — brukerens egne støtteavtaler som
  // LISTE (flere lag senere). Refetches når appen våkner igjen: endringer
  // gjort i Customer Portal (Safari) skal synes når man er tilbake.
  // Seksjonen står ALLTID på siden (Brages review-funn): null = aldri
  // lastet (skeleton), [] = ingen avtaler (rolig tom-rad). Cachen gjør at
  // en supporter ser avtalen sin umiddelbart ved remount, uten pop-in.
  const [mySupport, setMySupport] = useState<MySupportItem[] | null>(
    supportOverviewCache,
  );
  const [portalLoading, setPortalLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getMySupportOverview()
        .then(items => {
          supportOverviewCache = items;
          if (mounted) setMySupport(items);
        })
        .catch(() => {});
    };
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Portalen ER selvbetjeningen (betalingsmåte, kvitteringer, oppsigelse) —
  // kortlevd lenke hentes i klikkøyeblikket og åpnes i Safari.
  const handleManageSupport = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const {url} = await openSupportPortal();
      Linking.openURL(url);
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke åpne administrasjonen',
        e?.message ?? 'Prøv igjen om litt.',
      );
    } finally {
      setPortalLoading(false);
    }
  }, [portalLoading]);

  // All lokal rydding (modul-cacher, medie-URL-er) bor i selve signOut
  // (UserContext → clearLocalCaches) — begge utloggingsinngangene får den.
  const handleSignOut = useCallback(() => {
    signOut();
  }, [signOut]);

  // Kontosletting (Apple 5.1.1(v)). To bekreftelser — dette er den ene
  // handlingen i appen som ikke kan angres. Serversiden gjør alt
  // (Stripe-kansellering → anonymisering → auth-sletting); lokal
  // signOut etterpå tar appen til innloggingen.
  const [deletingAccount, setDeletingAccount] = useState(false);
  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    // Delt flyt med velkomstskjermen (lagløs bruker) — src/lib/account.ts.
    confirmDeleteAccount({
      setDeleting: setDeletingAccount,
      signOut,
    });
  }, [deletingAccount, signOut]);

  const handleNotifications = useCallback(async () => {
    if (pushPerm === 'undetermined') {
      // Første gang: dette viser systemdialogen.
      const next = await enablePush();
      setPushPerm(next);
      if (next === 'denied') {
        Alert.alert(
          'Varsler er avslått',
          'Du kan skru dem på igjen under Innstillinger → Heia → Varsler.',
          [
            {text: 'Ikke nå', style: 'cancel'},
            {text: 'Åpne Innstillinger', onPress: () => Linking.openSettings()},
          ],
        );
      }
    } else {
      // Alt bestemt (på eller av) → iOS lar oss ikke spørre igjen, så vi sender
      // brukeren til Innstillinger der de kan endre valget.
      Linking.openSettings();
    }
  }, [pushPerm]);

  // Profilbilde (00068). Inngangen er avataren i headeren.
  //
  // REKKEFØLGEN ER BEVISST: last opp FØRST, skriv profilen ETTERPÅ, slett
  // den gamle fila TIL SLUTT. Feiler opplastingen, står den gamle avataren
  // urørt; feiler DB-skrivingen, ligger det igjen en ubrukt fil (samme
  // aksepterte hull som feed-bilder og logoer) — men brukeren mister aldri
  // bildet sitt til en halvveis operasjon.
  //
  // GUARDEN ER EN REF, ikke state: `handleAvatar` er memoisert, så en
  // state-verdi ville vært lest fra en gammel closure og aldri stoppet noe.
  // State-en ved siden av finnes kun for å DEMPE avataren mens det står på —
  // uten den er et tregt opplastingskall en knapp som ikke gjør noe.
  const savingAvatar = useRef(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const setSaving = useCallback((value: boolean) => {
    savingAvatar.current = value;
    setAvatarBusy(value);
  }, []);

  const applyAvatar = useCallback(
    async (next: string | null, previous: string | null) => {
      setSaving(true);
      try {
        await updateProfile({avatarPath: next});
        await refreshProfile();
        // Først her er den gamle fila garantert uten referanse.
        if (previous && previous !== next) {
          await deleteAvatarFile(previous);
        }
      } catch (e) {
        Alert.alert('Kunne ikke lagre profilbildet', errorMessage(e));
      } finally {
        setSaving(false);
      }
    },
    [refreshProfile, setSaving],
  );

  // Fargevelgeren (00070). Egen sheet fordi swatchene ikke får plass i en
  // Alert — men den ÅPNES fra samme ark som bildevalget, så «gjør avataren
  // min» blir én inngang og ikke to konkurrerende.
  const [colorSheetOpen, setColorSheetOpen] = useState(false);

  const handlePickColor = useCallback(
    async (color: string | null) => {
      setColorSheetOpen(false);
      try {
        await updateProfile({avatarColor: color});
        await refreshProfile();
      } catch (e) {
        Alert.alert('Kunne ikke lagre fargen', errorMessage(e));
      }
    },
    [refreshProfile],
  );

  const handleAvatar = useCallback(() => {
    if (savingAvatar.current) return;
    const current = profile?.avatarPath ?? null;
    const userId = session?.user?.id;
    if (!userId) return;

    const choose = async () => {
      const image = await pickAvatarImage();
      if (!image) return;
      setSaving(true);
      let path: string;
      try {
        path = await uploadAvatar(userId, image);
      } catch (e) {
        setSaving(false);
        Alert.alert('Kunne ikke laste opp bildet', errorMessage(e));
        return;
      }
      // applyAvatar setter den selv med én gang — ingen mellomtilstand der
      // avataren lyser opp igjen midt i operasjonen.
      await applyAvatar(path, current);
    };

    Alert.alert(
      'Profilbilde',
      'Bildet vises i feeden, i kommentarer og i lagoversikten. ' +
        'Bare de du deler lag med kan se det.',
      [
        {text: current ? 'Bytt bilde' : 'Velg bilde', onPress: choose},
        // Står ALLTID, også med bilde: fargen er fallbacken som gjelder
        // den dagen bildet fjernes — og for dem som bevisst aldri legger
        // inn et bilde, er den hele personaliseringen.
        {text: 'Velg farge', onPress: () => setColorSheetOpen(true)},
        ...(current
          ? [
              {
                text: 'Fjern bildet',
                style: 'destructive' as const,
                onPress: () => applyAvatar(null, current),
              },
            ]
          : []),
        {text: 'Avbryt', style: 'cancel' as const},
      ],
      {cancelable: true},
    );
  }, [applyAvatar, profile?.avatarPath, session?.user?.id, setSaving]);

  // Nummeret er hele grunnen til at lagoversikten kan brukes til å nå noen —
  // uten et sted å skrive det inn står telefonkolonnen tom for alle.
  // Alert.prompt finnes bare på iOS; Android får en egen flate den dagen.
  const handlePhone = useCallback(() => {
    Alert.prompt(
      'Telefonnummer',
      'Trenere og lagledere kan nå deg. Resten av laget ser det ikke.',
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Lagre',
          onPress: async (value?: string) => {
            const trimmed = (value ?? '').trim();
            try {
              await updateProfile({phone: trimmed.length > 0 ? trimmed : null});
              await refreshProfile();
            } catch {
              Alert.alert('Kunne ikke lagre', 'Prøv igjen om litt.');
            }
          },
        },
      ],
      'plain-text',
      profile?.phone ?? '',
      'phone-pad',
    );
  }, [profile?.phone, refreshProfile]);

  // «Forlat laget» — dormant-modellen (00067, FROSSET i
  // docs/FORLAT-LAG-DORMANT-2026-08.md): rører KUN medlemskapet.
  // Bekreftelsen navngir alle berørte (barna følger forelderen), sier at
  // innholdet består, og — når du har en levende støtteavtale på laget —
  // at støtten fortsetter uavhengig, med «Administrer støtte» som egen vei.
  const [leavingTeam, setLeavingTeam] = useState(false);
  const handleLeaveTeam = useCallback(() => {
    if (!activeTeamSpaceId || leavingTeam) return;
    const membership = pickPrimaryMembership(
      userMemberships,
      activeTeamSpaceId,
    );
    const teamName = membership?.teamSpace.displayName ?? 'laget';

    const childNames = userMemberships
      .filter(m => m.teamSpaceId === activeTeamSpaceId && m.managedChildId)
      .map(m => m.managedChildName)
      .filter((n): n is string => !!n);
    const who =
      childNames.length === 0
        ? 'Utmeldingen gjelder deg.'
        : childNames.length === 1
        ? `Utmeldingen gjelder deg og ${childNames[0]}.`
        : `Utmeldingen gjelder deg og barna dine (${childNames
            .slice(0, -1)
            .join(', ')} og ${childNames[childNames.length - 1]}).`;

    // Levende avtale på DETTE laget: utmeldingen rører den aldri
    // (medlemskap og støtte er separate relasjoner — modell B), men det
    // skal sies i klartekst, ikke oppdages på kontoutskriften.
    const liveSupport = (mySupport ?? []).some(
      s =>
        s.teamSpaceId === activeTeamSpaceId &&
        (s.status === 'active' || s.status === 'past_due') &&
        !s.cancelAt,
    );

    const message =
      `${who} Innlegg, bilder og kommentarer dere har delt blir stående.` +
      (liveSupport
        ? '\n\nStøtten din til laget fortsetter som før — den er uavhengig av medlemskapet, og du administrerer den under «Min støtte».'
        : '');

    const doLeave = async () => {
      setLeavingTeam(true);
      try {
        const result = await leaveTeam(activeTeamSpaceId);
        if (result.outcome === 'last_admin') {
          // Siste-admin-vakten (§2): rollen må overdras først.
          // Blokkeringsdialogen deep-linker til rollemenyen.
          Alert.alert(
            'Laget trenger en trener',
            'Du er den siste treneren eller laglederen, og laget har fortsatt aktive medlemmer. Gi en annen voksen rollen i lagoversikten først — så kan du melde deg ut.',
            [
              {text: 'Ikke nå', style: 'cancel'},
              {
                text: 'Åpne lagoversikten',
                onPress: () => navigation.navigate('TeamMembers'),
              },
            ],
          );
          return;
        }
        // 'left' (og 'not_member' etter et dobbelttrykk): fersk liste. Var
        // dette siste laget, bytter AppNavigator til den lagløse Profil-
        // roten; ellers velger TeamContext neste lag og purger mediecachen.
        await refreshMemberships();
      } catch (e) {
        Alert.alert('Kunne ikke melde deg ut', errorMessage(e));
      } finally {
        setLeavingTeam(false);
      }
    };

    Alert.alert(`Forlate ${teamName}?`, message, [
      {text: 'Avbryt', style: 'cancel'},
      ...(liveSupport
        ? [{text: 'Administrer støtte', onPress: handleManageSupport}]
        : []),
      {text: 'Forlat laget', style: 'destructive', onPress: doLeave},
    ]);
  }, [
    activeTeamSpaceId,
    leavingTeam,
    userMemberships,
    mySupport,
    refreshMemberships,
    handleManageSupport,
    navigation,
  ]);

  if (!profile) return null;

  // Primærraden, ikke «første rad»: en trener som også er forelder har
  // flere rader i laget, og rollebadgen skal aldri avhenge av radrekkefølge.
  const activeMembership = pickPrimaryMembership(
    userMemberships,
    activeTeamSpaceId,
  );
  // Lagløs (§3d) = ingen rolle å vise — badgen utelates, aldri gjettes.
  const roleName = activeMembership
    ? ROLE_LABELS[activeMembership.role]
    : undefined;
  const isTrener = isTeamAdmin(activeMembership?.role);
  // «Konto»-radene — utledet her fordi blokka rundt dem må kjenne dem også.
  const showPhoneRow = Platform.OS === 'ios';
  const showPushRow = isPushAvailable();

  function handleTeamSwitch(teamSpaceId: string) {
    if (teamSpaceId === activeTeamSpaceId) return;
    setActiveTeamSpace(teamSpaceId);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'HjemStack'}],
      }),
    );
  }

  return (
    <View style={styles.screen}>
      {/* MASTHEAD (Brage 2026-09-04): SAMME lerret som Hjem/Kalender/Varsler
          bak HELE skjermen — reisen, buene og ett identitetsfelt — og
          headeren er gjennomsiktig innhold oppå. Feltet er Heias
          mørkegrønne, ikke lagfargen: Profil er ikke lag-scopet (se
          PROFILE_IDENTITY). Av med DAYLIGHT_GROUND_AB = false. */}
      {DAYLIGHT_GROUND_AB && (
        <DaylightGround masthead identity={PROFILE_IDENTITY} />
      )}
      {/* Profilheaderen er SØSKEN over scrollen, ikke inni den — samme
          plassering som TeamHeader på Hjem/Kalender/Varsler, så fanebytte
          ikke flytter toppflaten. Den eier safe area; scrollen under starter
          rett på innholdet. */}
      <ProfileHeader
        name={profile.displayName}
        email={session?.user?.email}
        avatarPath={profile.avatarPath}
        avatarColor={profile.avatarColor}
        onPressAvatar={handleAvatar}
        avatarBusy={avatarBusy}
        role={roleName}
      />
      {/* KROPPEN: scrollflaten er gjennomsiktig over lerretet. */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingBottom: bottomPad,
        }}>
        {/* Dine lag — lagkortene OG de to lag-handlingene. Handlingene lå
            begravd i «Innstillinger», mellom telefonnummeret og «Logg ut»
            (B6): de handler om lag, så de hører hjemme her.

            Seksjonen står ALLTID, guarden gjelder kun kortene. I dag er Profil
            uansett bare nåbar med minst ett lag (`hasTeam`-porten i
            AppNavigator), men handlingene er nettopp veien INN i et lag — de
            skal ikke kunne forsvinne den dagen porten endres. */}
        <View style={styles.teamsSection}>
          <SectionLabel title="Dine lag" tone="stadium" />
          {/* Ett kort per LAG: en forelder med to barn har to medlems-
              rader i samme lag og så det samme kortet to ganger. Primær-
              raden representerer laget, så rollebadgen på kortet stemmer. */}
          {uniqueTeamMemberships(userMemberships).map(m => {
            const isActive = m.teamSpaceId === activeTeamSpaceId;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleTeamSwitch(m.teamSpaceId)}
                accessibilityRole="button"
                accessibilityState={{selected: isActive}}>
                {({pressed}) => (
                  /* Lagkortet på opalpanelet: stramt (8 pt luft, 40-merke),
                     valgt = heiaSoft-tint + hake (ingen ring), trykk =
                     opalens egen respons. */
                  <OpalSurface
                    variant="panel"
                    style={[styles.teamCard, isActive && styles.teamCardActive]}
                    pressed={pressed}>
                    {/* Logoen når den finnes (lag → klubb), ellers initialer
                        på lagfargen — samme kjede som headeren (P7). */}
                    <TeamBadge
                      name={m.teamSpace.displayName}
                      logoUrl={m.teamSpace.logoUrl ?? m.team.club.logoUrl}
                      color={m.teamSpace.color}
                      size={40}
                      cornerRadius={radius.full}
                      fontSize={13}
                    />
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {m.teamSpace.displayName}
                      </Text>
                      <Text style={styles.teamMeta} numberOfLines={1}>
                        {m.team.ageGroup} · {ROLE_LABELS[m.role]}
                      </Text>
                    </View>
                    {/* heiaInk — mint er kun fyll på lys flate (A v2). */}
                    {isActive && (
                      <Check size={18} color={colors.heiaInk} strokeWidth={3} />
                    )}
                  </OpalSurface>
                )}
              </Pressable>
            );
          })}
          <MenuGroup>
            <ListRow
              material="opal"
              tone="action"
              icon={
                <MenuIcon tone="action">
                  <UserPlus size={18} color={MENU_ICON_INK.action} />
                </MenuIcon>
              }
              title="Bli med i et lag"
              subtitle="Har du fått en invitasjonskode?"
              right={<RowChevron />}
              onPress={() => navigation.navigate('JoinTeamCode')}
            />
            <ListRow
              material="opal"
              tone="action"
              icon={
                <MenuIcon tone="action">
                  <Plus size={18} color={MENU_ICON_INK.action} />
                </MenuIcon>
              }
              title="Opprett et nytt lag"
              subtitle="Du blir trener for laget"
              right={<RowChevron />}
              onPress={() => navigation.navigate('CreateTeam')}
              showBorder={false}
            />
          </MenuGroup>
        </View>

        {/* Laget — radene som gjelder det aktive laget */}
        {activeMembership && (
          <View style={styles.menuBlock}>
            <SectionLabel title={activeMembership.teamSpace.displayName} />
            <MenuGroup>
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Users size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Lagoversikt"
                subtitle="Se hvem som er med i laget"
                right={<RowChevron />}
                onPress={() => navigation.navigate('TeamMembers')}
              />
              {isTrener && (
                <ListRow
                  material="opal"
                  icon={
                    <MenuIcon>
                      <Settings size={18} color={MENU_ICON_INK.ink} />
                    </MenuIcon>
                  }
                  title="Laginnstillinger"
                  subtitle="Lagnavn, lagfarge og logo"
                  right={<RowChevron />}
                  onPress={() => navigation.navigate('TeamSettings')}
                />
              )}
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Share2 size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Inviter til laget"
                subtitle="Del invitasjonskoden"
                right={<RowChevron />}
                onPress={() => navigation.navigate('Invite')}
              />
              {/* «Forlat laget» (00067) — nederst i lagblokka: en handling
                  som tar deg UT skal ikke stå mellom veiene inn. */}
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <UserMinus size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Forlat laget"
                subtitle={
                  leavingTeam
                    ? 'Melder deg ut …'
                    : 'Innholdet ditt blir stående'
                }
                onPress={handleLeaveTeam}
                showBorder={false}
              />
            </MenuGroup>
          </View>
        )}

        {/* Min støtte — egne støtteavtaler (fase 5). Klubbens onboarding og
            økonomi bor i Laginnstillinger, ALDRI her (låst 2026-08-02).
            Seksjonen står ALLTID her (Brages review-funn 2026-08-02) — flaten
            er stabil, og en fersk betaling har et hjem fra første blikk. */}
        <View style={styles.menuBlock}>
          <SectionLabel title="Min støtte" />
          <MenuGroup>
            {mySupport === null ? (
              <ListRowSkeleton showBorder={false} />
            ) : mySupport.length === 0 ? (
              // Tom-raden peker inn i LAGKASSA, ikke rett på betalingssiden —
              // «hvorfor» før «betal» (fordelingen og hva støtten betyr bor
              // der). Uten aktivt lag er raden ren informasjon.
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <HandHeart size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Du støtter ingen lag ennå"
                subtitle={
                  activeMembership
                    ? 'Se lagkassa og hva støtten betyr for laget'
                    : 'Avtalene dine samles her når du støtter et lag'
                }
                right={activeMembership ? <RowChevron /> : undefined}
                onPress={
                  activeMembership
                    ? () =>
                        navigation
                          .getParent<NavigationProp<RootTabParamList>>()
                          ?.navigate('HjemStack', {
                            screen: 'Lagkassa',
                            initial: false,
                          })
                    : undefined
                }
                showBorder={false}
              />
            ) : (
              <>
                {mySupport.map((item, index) => (
                  <ListRow
                    material="opal"
                    key={item.subscriptionId}
                    icon={
                      <MenuIcon>
                        <HandHeart size={18} color={MENU_ICON_INK.ink} />
                      </MenuIcon>
                    }
                    title={item.teamName}
                    subtitle={`${formatKr(item.amountMinor)}/mnd · ${formatKr(
                      item.clubAmountMinor,
                    )} går til laget\n${supportStatusLine(item)}`}
                    right={<RowChevron />}
                    onPress={handleManageSupport}
                    showBorder={index < mySupport.length - 1}
                  />
                ))}
                <Text style={styles.supportHint}>
                  Betalingsmåte, kvitteringer og oppsigelse håndteres trygt hos
                  Stripe — lenken åpnes i Safari.
                </Text>
              </>
            )}
          </MenuGroup>
        </View>

        {/* Klubbetalinger (klubbdøren, 00047) — hovedinngangen for
            betalingsansvarlig (låst: bor på Profil). Raden er et speil av
            DB-vakten club_payment_managers. */}
        {isManager && (
          <View style={styles.menuBlock}>
            <SectionLabel title="Klubben" />
            <MenuGroup>
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Wallet size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Klubbetalinger"
                subtitle="Godkjenn og administrer lagenes støtte"
                right={<RowChevron />}
                onPress={() => navigation.navigate('ClubPayments')}
                showBorder={false}
              />
            </MenuGroup>
          </View>
        )}

        {/* Heia Ops — kun for ops_admins (Brage). Raden er et speil av
            DB-vakten; alle handlinger er audit-loggede RPC-er. */}
        {isOps && (
          <View style={styles.menuBlock}>
            <SectionLabel title="Heia internt" />
            <MenuGroup>
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <ShieldCheck size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Heia Ops"
                subtitle="Klubbsøknader til behandling"
                right={<RowChevron />}
                onPress={() => navigation.navigate('OpsClaims')}
              />
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Building2 size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Klubber og roller"
                subtitle="Betalingsansvarlige, invitasjoner og avvikskontroll"
                right={<RowChevron />}
                onPress={() => navigation.navigate('OpsEntities')}
                showBorder={false}
              />
            </MenuGroup>
          </View>
        )}

        {/* Konto. «Innstillinger» var ÉN skuff med fire ulike ting:
            kontodetaljer, lag-handlinger, farlige handlinger og juss. Nå tre
            blokker med hver sin jobb, i den rekkefølgen Brage låste: det du
            faktisk endrer først, det du sjelden leser i midten, og det du
            ikke kan angre aller nederst.

            Blokka trenger ikke lenger en vakt mot å bli tom: telefon- og
            varselradene er iOS-betingede (Alert.prompt finnes ikke på
            Android, isPushAvailable() krever iOS + pod), men «Passord og
            sikkerhet» er det ikke. */}
        <View style={styles.menuBlock}>
          <SectionLabel title="Konto" />
          <MenuGroup>
            {showPhoneRow && (
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Phone size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Telefonnummer"
                subtitle={profile.phone ?? 'Legg til så trenerne når deg'}
                onPress={handlePhone}
              />
            )}
            {/* Server-håndhevet passordbytte: GoTrue krever og validerer
                current_password i SAMME forespørsel («Require current
                password when updating» er på). Skjermen er en flate, ikke
                en vakt — se ChangePasswordScreen. */}
            <ListRow
              material="opal"
              icon={
                <MenuIcon>
                  <Lock size={18} color={MENU_ICON_INK.ink} />
                </MenuIcon>
              }
              title="Passord og sikkerhet"
              subtitle="Endre passord"
              right={<RowChevron />}
              onPress={() => navigation.navigate('ChangePassword')}
              showBorder={showPushRow}
            />
            {showPushRow && (
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Bell size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title="Varslinger"
                subtitle={PUSH_SUBTITLE[pushPerm]}
                onPress={handleNotifications}
                showBorder={false}
              />
            )}
          </MenuGroup>
        </View>

        {/* Om Heia — juss og versjon. Sjelden lest, men versjonsraden er den
            ENE en testbruker leter etter når hun skal melde en feil. */}
        <View style={styles.menuBlock}>
          <SectionLabel title="Om Heia" />
          <MenuGroup>
            <ListRow
              material="opal"
              icon={
                <MenuIcon>
                  <FileText size={18} color={MENU_ICON_INK.ink} />
                </MenuIcon>
              }
              title="Vilkår for bruk"
              onPress={() => Linking.openURL(TERMS_URL)}
              right={<RowChevron />}
            />
            <ListRow
              material="opal"
              icon={
                <MenuIcon>
                  <ShieldCheck size={18} color={MENU_ICON_INK.ink} />
                </MenuIcon>
              }
              title="Personvern"
              onPress={() => Linking.openURL(PRIVACY_URL)}
              right={<RowChevron />}
              showBorder={appVersion !== null}
            />
            {/* Ingen rad uten et tall vi faktisk har lest fra bundelen —
                hardkodet «v0.1.0» er nettopp feilen denne raden retter. */}
            {appVersion !== null && (
              <ListRow
                material="opal"
                icon={
                  <MenuIcon>
                    <Info size={18} color={MENU_ICON_INK.ink} />
                  </MenuIcon>
                }
                title={appVersion}
                showBorder={false}
              />
            )}
          </MenuGroup>
        </View>

        {/* Avslutningsblokken — uten overskrift med vilje. De to handlingene
            som tar deg UT av appen står for seg selv, og «Slett konto» er
            siste rad på hele siden: den ene handlingen som ikke kan angres
            skal ikke ha noe under seg å bomme på. */}
        <View style={styles.menuBlock}>
          <MenuGroup>
            <ListRow
              material="opal"
              icon={
                <MenuIcon>
                  <LogOut size={18} color={MENU_ICON_INK.ink} />
                </MenuIcon>
              }
              title="Logg ut"
              subtitle="Logg ut av Heia"
              onPress={handleSignOut}
            />
            <ListRow
              material="opal"
              icon={
                <MenuIcon tone="danger">
                  <Trash2 size={18} color={MENU_ICON_INK.danger} />
                </MenuIcon>
              }
              title="Slett konto"
              subtitle={
                deletingAccount
                  ? 'Sletter kontoen din …'
                  : 'Fjern kontoen og dataene dine for godt'
              }
              onPress={handleDeleteAccount}
              showBorder={false}
            />
          </MenuGroup>
        </View>

        {/* Footer — avbindingen beholdes, men kompakt. Den sto med 40 px luft
            over OG under en 100×100 logo, altså ~250 px nesten tomt under
            «Slett konto». */}
        <View style={styles.footer}>
          <Image
            source={require('../assets/images/logo-green-wordmark.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerTagline}>Idrettsglede for alle</Text>
        </View>
      </ScrollView>

      {/* Fargevelgeren. Forhåndsvisningen er selve forklaringen: uten den
          måtte arket brukt en setning på å si hva fargen er til, og med
          bilde ville valget virket meningsløst. Her SER du at det er
          initialene som farges. */}
      <Modal
        visible={colorSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setColorSheetOpen(false)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setColorSheetOpen(false)}
        />
        <View
          style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Farge på avataren</Text>

          <View style={styles.colorPreview}>
            <Avatar
              name={profile.displayName}
              color={profile.avatarColor}
              size="lg"
            />
            <Text style={styles.sheetHint}>
              {profile.avatarPath
                ? 'Vises når du ikke har profilbilde.'
                : 'Vises bak initialene dine i feeden, i kommentarer og i lagoversikten.'}
            </Text>
          </View>

          <AvatarColorPicker
            value={profile.avatarColor}
            onChange={handlePickColor}
          />

          {!!profile.avatarColor && (
            <Pressable
              onPress={() => handlePickColor(null)}
              style={({pressed}) => [
                styles.sheetReset,
                pressed && styles.sheetResetPressed,
              ]}>
              <Text style={styles.sheetResetText}>Tilbakestill farge</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fargevelger-arket — samme form som ReporterSheet, så de to leses som
  // samme mekanisme.
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  colorPreview: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  sheetHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetReset: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetResetPressed: {
    opacity: 0.6,
  },
  sheetResetText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Kroppen under headeren — gjennomsiktig, grunnen ligger bak. */
  body: {
    flex: 1,
  },
  teamsSection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionDash: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.heia,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  // Stadionblekk 0,8 — som ukedagene i kalenderchromen (≥ 4,5:1 på
  // #143126 → #0B412E, der etiketten står).
  sectionTitleStadium: {
    color: 'rgba(234, 255, 246, 0.8)',
  },
  // Lagkortet: flate, kant, radius og skygge eies av OpalSurface — bare
  // luften bor her. Mindre «pølse»: 40-merke, 16 pt navn, og 8 pt luft over
  // og under (Brage 2026-09-04, polish: −8 pt total høyde, 66 → 58, uten at
  // noe annet i raden flyttes). Merket på 40 er fortsatt det høyeste
  // elementet, så raden er 58 pt — godt over HIGs 44 pt trykkmål, og en
  // forelder med mange lag ser flere av dem uten å bla.
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    gap: spacing.md,
  },
  // Valgt skifter FLATE, ikke ramme (A v2-regelen fra RSVP-knappene): kun
  // tinten. Kanten forblir panelets egen (gjennomsiktig 1 pt — opalen tegner
  // kantlyset selv), og haken står til høyre.
  teamCardActive: {
    backgroundColor: colors.heiaSoft,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  teamMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: OPAL.inkSecondary,
  },
  menuBlock: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  supportHint: {
    ...typography.caption,
    color: OPAL.inkTertiary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  menuIconSlot: {
    width: OPAL_ROW_ICON_SLOT,
    height: OPAL_ROW_ICON_SLOT,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Avbindingen beholdes, men kompakt: sto med 40 px luft over OG under en
  // 100×100 logo — ~250 px nesten tomt under «Slett konto».
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  // `logo-green-wordmark.png` — BESKÅRET, og det er hele poenget.
  //
  // ⚠️ `logo-green.png` er 1080×1080 med ordmerket på 715×370 i midten:
  // 34 % av høyden er merke, resten er tom luft bakt inn i rasteret. Siden
  // `contain` skalerer HELE kvadratet, tvinger den en stor boks rundt et
  // lite merke — på en 80-boks ble ordmerket rendret 27 pt høyt, på 44 var
  // det uleselig. «Større OG mer kompakt» er umulig med det assetet.
  // Samme felle er dokumentert i WelcomeIntentScreen.
  //
  // Den beskårne varianten (@1x/@2x/@3x, samme konvensjon som
  // `logo-wordmark.png`) er ren merkeflate: 66 pt boks = 66 pt ordmerke,
  // altså 2,4× større enn før i en LAVERE footer. `logo-wordmark.png` kunne
  // ikke brukes — den er hvit/mint for stadionflaten og forsvinner her.
  footerLogo: {
    width: 128,
    height: 66,
  },
  footerTagline: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
