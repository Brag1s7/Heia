import React, {
  useCallback,
  useEffect,
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
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useNavigation,
  CommonActions,
  type NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Avatar, ListRow, ListRowSkeleton, TeamBadge} from '../components';
import {
  Bell,
  Check,
  ChevronRight,
  HandHeart,
  Info,
  LogOut,
  Phone,
  Plus,
  Settings,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from '../components/icons';
import {useAuth, useActiveTeam} from '../context';
import {isTeamAdmin, ROLE_LABELS} from '../shared/roles';
import {
  isPushAvailable,
  getPushPermission,
  enablePush,
  type PushPermission,
} from '../lib/push';
import {
  deleteAccount,
  updateProfile,
  getMySupportOverview,
  openSupportPortal,
  type MySupportItem,
} from '../lib/api';
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
function SectionLabel({title}: {title: string}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionDash} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// Fast slot så alle rad-ikonene står på samme akse (P7: konsekvent
// ikonlogikk — ingen tomme streng-slots).
function MenuIcon({children}: {children: ReactNode}) {
  return <View style={styles.menuIconSlot}>{children}</View>;
}

// Chevron på rader som NAVIGERER — handlinger (logg ut, varsler) får ingen.
function RowChevron() {
  return <ChevronRight size={18} color={colors.textTertiary} />;
}

// Siste kjente «Min støtte»-svar — lever over remounts så seksjonen aldri
// popper inn for en supporter. Modul-state overlever utlogging, så cachen
// nulles eksplisitt i logg ut-handleren (RLS gir uansett kun egne rader,
// men en ny bruker skal aldri se forrige brukers avtaler et blunk).
let supportOverviewCache: MySupportItem[] | null = null;

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
  const {profile, signOut, refreshProfile} = useAuth();
  const {activeTeamSpaceId, userMemberships, setActiveTeamSpace} =
    useActiveTeam();
  const navigation = useNavigation<Nav>();

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

  // Cachen er modul-state og overlever utlogging — nulles her så en ny
  // bruker på samme enhet aldri ser forrige brukers avtaler et blunk.
  const handleSignOut = useCallback(() => {
    supportOverviewCache = null;
    signOut();
  }, [signOut]);

  // Kontosletting (Apple 5.1.1(v)). To bekreftelser — dette er den ene
  // handlingen i appen som ikke kan angres. Serversiden gjør alt
  // (Stripe-kansellering → anonymisering → auth-sletting); lokal
  // signOut etterpå tar appen til innloggingen.
  const [deletingAccount, setDeletingAccount] = useState(false);
  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    Alert.alert(
      'Slette kontoen din?',
      'Dette kan ikke angres. Du fjernes fra lagene dine, aktive ' +
        'støtteavtaler avsluttes, og profilen din anonymiseres. ' +
        'Innlegg du har delt med laget blir stående uten navnet ditt.',
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Slett kontoen',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Helt sikker?',
              'Kontoen og påloggingen din slettes for godt.',
              [
                {text: 'Avbryt', style: 'cancel'},
                {
                  text: 'Ja, slett kontoen min',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await deleteAccount();
                      supportOverviewCache = null;
                      await signOut();
                    } catch (e: any) {
                      setDeletingAccount(false);
                      Alert.alert(
                        'Kunne ikke slette kontoen',
                        e?.message ?? 'Prøv igjen om litt.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
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

  if (!profile) return null;

  const activeMembership = userMemberships.find(
    m => m.teamSpaceId === activeTeamSpaceId,
  );
  const roleName = activeMembership
    ? ROLE_LABELS[activeMembership.role]
    : 'Forelder';
  const isTrener = isTeamAdmin(activeMembership?.role);

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}>
      {/* Profil-toppen — på den varme bakgrunnstonen, ikke eget hvitt kort (P7) */}
      <View
        style={[
          styles.profileSection,
          {paddingTop: insets.top + spacing.lg},
        ]}>
        <Avatar name={profile.displayName} size="lg" />
        <Text style={styles.userName}>{profile.displayName}</Text>
        <View style={styles.roleRow}>
          <View
            style={[
              styles.roleBadge,
              isTrener ? styles.roleBadgeTrener : styles.roleBadgeForelder,
            ]}>
            <Text
              style={[
                styles.roleBadgeText,
                isTrener
                  ? styles.roleBadgeTrenerText
                  : styles.roleBadgeForelderText,
              ]}>
              {roleName}
            </Text>
          </View>
        </View>
      </View>

      {/* Dine lag */}
      {userMemberships.length > 0 && (
        <View style={styles.teamsSection}>
          <SectionLabel title="Dine lag" />
          {userMemberships.map(m => {
            const isActive = m.teamSpaceId === activeTeamSpaceId;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleTeamSwitch(m.teamSpaceId)}
                style={({pressed}) => [
                  styles.teamCard,
                  isActive && styles.teamCardActive,
                  pressed && styles.teamCardPressed,
                ]}>
                {/* Logoen når den finnes (lag → klubb), ellers initialer på
                    lagfargen — samme kjede som headeren (Brages P7-ønske). */}
                <TeamBadge
                  name={m.teamSpace.displayName}
                  logoUrl={m.teamSpace.logoUrl ?? m.team.club.logoUrl}
                  color={m.teamSpace.color}
                  size={36}
                  cornerRadius={radius.full}
                  fontSize={12}
                />
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>
                    {m.teamSpace.displayName}
                  </Text>
                  <Text style={styles.teamMeta}>
                    {m.team.ageGroup} · {ROLE_LABELS[m.role]}
                  </Text>
                </View>
                {/* heiaInk — mint er kun fyll på lys flate (A v2-regel). */}
                {isActive && (
                  <Check size={18} color={colors.heiaInk} strokeWidth={3} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Laget — radene som gjelder det aktive laget */}
      {activeMembership && (
        <View style={styles.menuBlock}>
          <SectionLabel title={activeMembership.teamSpace.displayName} />
          <View style={styles.menuCard}>
            <ListRow
              icon={
                <MenuIcon>
                  <Users size={20} color={colors.textSecondary} />
                </MenuIcon>
              }
              title="Lagoversikt"
              subtitle="Se hvem som er med i laget"
              right={<RowChevron />}
              onPress={() => navigation.navigate('TeamMembers')}
            />
            {isTrener && (
              <ListRow
                icon={
                  <MenuIcon>
                    <Settings size={20} color={colors.textSecondary} />
                  </MenuIcon>
                }
                title="Laginnstillinger"
                subtitle="Lagnavn, lagfarge og logo"
                right={<RowChevron />}
                onPress={() => navigation.navigate('TeamSettings')}
              />
            )}
            <ListRow
              icon={
                <MenuIcon>
                  <Share2 size={20} color={colors.textSecondary} />
                </MenuIcon>
              }
              title="Inviter til laget"
              subtitle="Del invitasjonskoden"
              right={<RowChevron />}
              onPress={() => navigation.navigate('Invite')}
              showBorder={false}
            />
          </View>
        </View>
      )}

      {/* Min støtte — egne støtteavtaler (fase 5). Klubbens onboarding og
          økonomi bor i Laginnstillinger, ALDRI her (låst 2026-08-02).
          Seksjonen står ALLTID her (Brages review-funn 2026-08-02) — flaten
          er stabil, og en fersk betaling har et hjem fra første blikk. */}
      <View style={styles.menuBlock}>
        <SectionLabel title="Min støtte" />
        <View style={styles.menuCard}>
          {mySupport === null ? (
            <ListRowSkeleton showBorder={false} />
          ) : mySupport.length === 0 ? (
            // Tom-raden peker inn i LAGKASSA, ikke rett på betalingssiden —
            // «hvorfor» før «betal» (fordelingen og hva støtten betyr bor
            // der). Uten aktivt lag er raden ren informasjon.
            <ListRow
              icon={
                <MenuIcon>
                  <HandHeart size={20} color={colors.textSecondary} />
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
                        ?.navigate('HjemStack', {screen: 'Lagkassa'})
                  : undefined
              }
              showBorder={false}
            />
          ) : (
            <>
              {mySupport.map((item, index) => (
                <ListRow
                  key={item.subscriptionId}
                  icon={
                    <MenuIcon>
                      <HandHeart size={20} color={colors.textSecondary} />
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
        </View>
      </View>

      {/* Innstillinger */}
      <View style={styles.menuBlock}>
        <SectionLabel title="Innstillinger" />
        <View style={styles.menuCard}>
          {Platform.OS === 'ios' && (
            <ListRow
              icon={
                <MenuIcon>
                  <Phone size={20} color={colors.textSecondary} />
                </MenuIcon>
              }
              title="Telefonnummer"
              subtitle={profile.phone ?? 'Legg til så trenerne når deg'}
              onPress={handlePhone}
            />
          )}
          <ListRow
            icon={
              <MenuIcon>
                <UserPlus size={20} color={colors.textSecondary} />
              </MenuIcon>
            }
            title="Bli med i et lag"
            subtitle="Har du fått en invitasjonskode?"
            right={<RowChevron />}
            onPress={() => navigation.navigate('JoinTeamCode')}
          />
          <ListRow
            icon={
              <MenuIcon>
                <Plus size={20} color={colors.textSecondary} />
              </MenuIcon>
            }
            title="Opprett et nytt lag"
            subtitle="Du blir trener for laget"
            right={<RowChevron />}
            onPress={() => navigation.navigate('CreateTeam')}
          />
          {isPushAvailable() && (
            <ListRow
              icon={
                <MenuIcon>
                  <Bell size={20} color={colors.textSecondary} />
                </MenuIcon>
              }
              title="Varslinger"
              subtitle={PUSH_SUBTITLE[pushPerm]}
              onPress={handleNotifications}
            />
          )}
          <ListRow
            icon={
              <MenuIcon>
                <LogOut size={20} color={colors.textSecondary} />
              </MenuIcon>
            }
            title="Logg ut"
            subtitle="Logg ut av Heia"
            onPress={handleSignOut}
          />
          <ListRow
            icon={
              <MenuIcon>
                <Trash2 size={20} color={colors.textSecondary} />
              </MenuIcon>
            }
            title="Slett konto"
            subtitle={
              deletingAccount
                ? 'Sletter kontoen din …'
                : 'Fjern kontoen og dataene dine for godt'
            }
            onPress={handleDeleteAccount}
          />
          <ListRow
            icon={
              <MenuIcon>
                <Info size={20} color={colors.textSecondary} />
              </MenuIcon>
            }
            title="Om Heia"
            subtitle="v0.1.0"
            showBorder={false}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Image
          source={require('../assets/images/logo-green.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerTagline}>Idrettsglede for alle</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileSection: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  userName: {
    ...typography.heading2,
    marginTop: spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  roleBadgeTrener: {
    backgroundColor: 'rgba(2, 255, 171, 0.15)',
  },
  // Hvit pill med subtil kant — background-tonen forsvant mot den nye
  // background-flaten bak.
  roleBadgeForelder: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  roleBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  roleBadgeTrenerText: {
    color: colors.heiaInk,
  },
  roleBadgeForelderText: {
    color: colors.textSecondary,
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
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  // Valgt skifter FLATE, ikke bare ramme (A v2-regelen fra RSVP-knappene).
  teamCardActive: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  teamCardPressed: {
    opacity: 0.7,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    ...typography.heading3,
  },
  teamMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  menuBlock: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  supportHint: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  menuIconSlot: {
    width: 28,
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.xs,
  },
  footerLogo: {
    width: 100,
    height: 100,
  },
  footerTagline: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
