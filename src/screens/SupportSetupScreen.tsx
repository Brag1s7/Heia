import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, Button, Skeleton} from '../components';
import {useActiveTeam, useAuth} from '../context';
import {
  getSupportActivationStatus,
  submitClubClaim,
  startStripeOnboarding,
  requestTeamSupportApproval,
  type SupportActivationStatus,
} from '../lib/api';
import {lookupBrregEnhet} from '../lib/brreg';
import type {ProfilStackParamList} from '../shared/types';

/**
 * Aktivering av «Støtt laget» (betalingssporet fase 3) — kun lagadmin,
 * via Laginnstillinger. Flyten: søknad (claim) → manuell Heia-review →
 * Stripe-onboarding via kortlevd lenke → aktiv. All status kommer fra
 * get_support_activation_status; webhookene (fase 2) flytter den.
 */
export function SupportSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfilStackParamList>>();
  const {activeTeamSpaceId, activeTeam} = useActiveTeam();
  const {session} = useAuth();

  const [status, setStatus] = useState<SupportActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Skjemaet (state 'none' / ny søknad etter avslag)
  const [showForm, setShowForm] = useState(false);
  const [orgNumber, setOrgNumber] = useState('');
  const [legalName, setLegalName] = useState(activeTeam?.club?.name ?? '');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      const s = await getSupportActivationStatus(activeTeamSpaceId);
      setStatus(s);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTeamSpaceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tilbake fra Safari (Stripe-onboarding) → hent fersk status; webhooken
  // rekker som regel å flytte den før brukeren er tilbake i appen.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') loadRef.current();
    });
    return () => sub.remove();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Selve innsendingen — registerets navn er autoritativt når vi har det.
  const doSubmit = useCallback(
    async (clubId: string, submitLegalName: string) => {
      try {
        await submitClubClaim({
          clubId,
          orgNumber,
          legalName: submitLegalName,
          role,
          contactEmail: email,
          contactPhone: phone.trim() || undefined,
        });
        setShowForm(false);
        await load();
      } catch (e: any) {
        Alert.alert('Kunne ikke sende søknaden', e?.message ?? 'Prøv igjen om litt.');
      } finally {
        setSubmitting(false);
      }
    },
    [orgNumber, role, email, phone, load],
  );

  // Produksjonsvalidering mot Brønnøysund FØR innsending (Brages beslutning
  // 2026-08-03): et orgnr som ikke finnes skal aldri bli en ops-sak.
  // Registeret er autoritativt for navnet. Nettverksfeil blokkerer ALDRI
  // (fail-open — den manuelle reviewen med claim-notify-bevisene fanger
  // det). Testdata: i dev-bygg finnes en eksplisitt «send likevel»-vei.
  const handleSubmit = useCallback(async () => {
    const clubId = status?.club?.id;
    if (!clubId || submitting) return;
    setSubmitting(true);

    const lookup = await lookupBrregEnhet(orgNumber);

    if (lookup.status === 'not_found') {
      const buttons: any[] = [{text: 'OK', style: 'cancel'}];
      if (__DEV__) {
        buttons.push({
          text: 'Send likevel (testdata)',
          style: 'destructive',
          onPress: () => doSubmit(clubId, legalName),
        });
      }
      Alert.alert(
        'Fant ikke organisasjonsnummeret',
        `${orgNumber.replace(/[^0-9]/g, '')} finnes ikke i Brønnøysund­registrene. Sjekk sifrene — nummeret står på klubbens side på brreg.no.`,
        buttons,
      );
      setSubmitting(false);
      return;
    }

    if (lookup.status === 'found' && lookup.inactive) {
      Alert.alert(
        'Organisasjonen er ikke aktiv',
        `${lookup.navn} er ${lookup.inactiveReason} i Brønnøysund­registrene og kan ikke motta støtte.`,
      );
      setSubmitting(false);
      return;
    }

    if (lookup.status === 'found' && lookup.navn) {
      // Registeret vinner: søknaden sendes med det juridiske navnet derfra,
      // og brukeren ser det i bekreftelsen («til vurdering»-kortet).
      setLegalName(lookup.navn);
      await doSubmit(clubId, lookup.navn);
      return;
    }

    // unreachable → fail-open med det brukeren skrev.
    await doSubmit(clubId, legalName);
  }, [status?.club?.id, submitting, orgNumber, legalName, doSubmit]);

  // Lenken er kortlevd (fase 0-funn #6) — hent alltid en fersk, i
  // klikkøyeblikket, både for åpning og deling.
  const fetchOnboardingUrl = useCallback(async (): Promise<string | null> => {
    if (!activeTeamSpaceId || linkLoading) return null;
    setLinkLoading(true);
    try {
      const {url} = await startStripeOnboarding(activeTeamSpaceId);
      return url;
    } catch (e: any) {
      Alert.alert('Kunne ikke hente lenken', e?.message ?? 'Prøv igjen om litt.');
      return null;
    } finally {
      setLinkLoading(false);
    }
  }, [activeTeamSpaceId, linkLoading]);

  const handleOpenStripe = useCallback(async () => {
    const url = await fetchOnboardingUrl();
    if (url) Linking.openURL(url);
  }, [fetchOnboardingUrl]);

  const handleShareLink = useCallback(async () => {
    const url = await fetchOnboardingUrl();
    if (!url) return;
    await Share.share({
      message:
        'Her er lenken for å registrere klubben hos Stripe, slik at ' +
        'supporterstøtten i Heia kan utbetales til klubben. Lenken varer ' +
        `bare en kort stund — åpne den med en gang: ${url}`,
    });
  }, [fetchOnboardingUrl]);

  // Klubbdøren (00047): «Be om godkjenning» — null friksjon, ingenting å
  // fylle ut. Betalingsansvarlig i klubben får varsel og godkjenner med
  // ett trykk; laget arver klubbens standardtilbud automatisk.
  const handleRequestApproval = useCallback(async () => {
    if (!activeTeamSpaceId || requesting) return;
    setRequesting(true);
    try {
      await requestTeamSupportApproval(activeTeamSpaceId);
      await load();
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke sende forespørselen',
        e?.message ?? 'Prøv igjen om litt.',
      );
    } finally {
      setRequesting(false);
    }
  }, [activeTeamSpaceId, requesting, load]);

  const clubName = status?.club?.name ?? activeTeam?.club?.name ?? 'klubben';
  const canSubmit =
    orgNumber.replace(/\D/g, '').length === 9 &&
    legalName.trim().length > 0 &&
    role.trim().length > 0 &&
    email.includes('@');

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.card}>
          <Skeleton width={140} height={12} />
          <Skeleton height={14} />
          <Skeleton width="70%" height={14} />
        </View>
      );
    }

    if (loadError || !status) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fikk ikke hentet statusen</Text>
          <Text style={styles.body}>Sjekk nettet og prøv igjen.</Text>
          <Button title="Prøv igjen" variant="secondary" onPress={load} style={styles.cardButton} />
        </View>
      );
    }

    switch (status.state) {
      case 'claim_submitted':
      case 'claim_in_review':
        return (
          <View style={styles.card}>
            <Text style={styles.pillPending}>TIL VURDERING</Text>
            <Text style={styles.cardTitle}>Søknaden er sendt</Text>
            <Text style={styles.body}>
              Heia sjekker opplysningene mot Brønnøysundregistrene før{' '}
              {clubName} kobles til utbetaling. Du hører fra oss — som regel
              innen et par dager.
            </Text>
            {status.claim?.infoRequestNote && (
              <View style={styles.infoRequestBox}>
                <Text style={styles.infoRequestTitle}>
                  Heia trenger mer informasjon
                </Text>
                <Text style={styles.body}>{status.claim.infoRequestNote}</Text>
                <Text style={styles.hint}>
                  Svar til hello@heiaapp.no, så fortsetter behandlingen.
                </Text>
              </View>
            )}
            <View style={styles.factBox}>
              <FactRow label="Organisasjonsnummer" value={status.claim?.orgNumber ?? '—'} />
              <FactRow label="Juridisk navn" value={status.claim?.legalName ?? '—'} />
            </View>
          </View>
        );

      case 'claim_rejected':
        if (showForm) break; // ny søknad → skjemaet under
        return (
          <View style={styles.card}>
            <Text style={styles.pillRejected}>IKKE GODKJENT</Text>
            <Text style={styles.cardTitle}>Søknaden ble ikke godkjent</Text>
            {status.claim?.reviewNote ? (
              <Text style={styles.body}>{status.claim.reviewNote}</Text>
            ) : (
              <Text style={styles.body}>
                Ta kontakt med Heia hvis du mener dette er feil.
              </Text>
            )}
            <Button
              title="Send ny søknad"
              variant="secondary"
              onPress={() => setShowForm(true)}
              style={styles.cardButton}
            />
          </View>
        );

      case 'pending_onboarding':
      case 'onboarding_started':
      case 'restricted':
        return (
          <View style={styles.card}>
            <Text style={styles.pillApproved}>GODKJENT</Text>
            <Text style={styles.cardTitle}>
              {status.state === 'restricted'
                ? 'Stripe trenger mer informasjon'
                : `${status.entity?.legalName ?? clubName} er godkjent`}
            </Text>
            <Text style={styles.body}>
              {status.state === 'restricted'
                ? 'Registreringen hos Stripe er ikke helt i mål — fortsett der du slapp, så sier Stripe hva som mangler.'
                : 'Siste steg: klubben registrerer seg hos Stripe, som håndterer utbetalingene. Den som fullfører bør ha fullmakt til å representere klubben — gjerne kasserer eller styreleder. Du kan også dele lenken med dem.'}
            </Text>
            <Button
              title="Fortsett hos Stripe"
              onPress={handleOpenStripe}
              loading={linkLoading}
              style={styles.cardButton}
            />
            <Button
              title="Del lenken med klubben"
              variant="ghost"
              onPress={handleShareLink}
              disabled={linkLoading}
            />
            <Text style={styles.hint}>
              Lenken varer bare en kort stund — den som får den bør åpne den
              med en gang.
            </Text>
          </View>
        );

      case 'active': {
        // Klubben (port 1+2) er åpen — resten avgjøres av klubbdøren
        // (port 3, 00047): lagets egen godkjenning fra betalingsansvarlig.
        const doorState = status.team?.supportState ?? 'none';
        const approval = status.team?.approval ?? null;
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.pillActive}>AKTIV</Text>
              <Text style={styles.cardTitle}>Klubben er klar for støtte</Text>
              <Text style={styles.body}>
                {status.entity?.legalName ?? clubName} er koblet til
                utbetaling.
              </Text>
              <View style={styles.factBox}>
                <FactRow label="Organisasjonsnummer" value={status.entity?.orgNumber ?? '—'} />
                <FactRow label="Mottaker" value={status.entity?.legalName ?? '—'} />
              </View>
              {status.account?.actionNeeded && (
                <>
                  <Text style={styles.body}>
                    Stripe ber om litt mer informasjon fra klubben.
                  </Text>
                  <Button
                    title="Åpne hos Stripe"
                    variant="secondary"
                    onPress={handleOpenStripe}
                    loading={linkLoading}
                    style={styles.cardButton}
                  />
                </>
              )}
            </View>

            {doorState === 'collecting' ? (
              <View style={styles.card}>
                <Text style={styles.pillActive}>SAMLER INN</Text>
                <Text style={styles.cardTitle}>Laget samler inn støtte</Text>
                <Text style={styles.body}>
                  «Støtt laget» er åpen for alle i laget — foreldre og
                  supportere finner den på Hjem og i lagkassa.
                </Text>
              </View>
            ) : doorState === 'pending' ? (
              <View style={styles.card}>
                <Text style={styles.pillPending}>TIL GODKJENNING</Text>
                <Text style={styles.cardTitle}>
                  Venter på klubbens godkjenning
                </Text>
                <Text style={styles.body}>
                  Klubbens betalingsansvarlige har fått beskjed og godkjenner
                  laget med ett trykk — du får varsel når det er gjort.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {doorState === 'paused'
                    ? 'Støtten er satt på pause'
                    : doorState === 'deactivated'
                      ? 'Støtten er deaktivert'
                      : 'Siste steg: klubbens godkjenning'}
                </Text>
                {approval?.status === 'rejected' && approval.note ? (
                  <View style={styles.infoRequestBox}>
                    <Text style={styles.infoRequestTitle}>
                      Forrige forespørsel ble ikke godkjent
                    </Text>
                    <Text style={styles.body}>{approval.note}</Text>
                  </View>
                ) : null}
                <Text style={styles.body}>
                  {doorState === 'paused' || doorState === 'deactivated'
                    ? 'Klubbens betalingsansvarlige har stoppet nye ' +
                      'støttespillere for laget. Vil dere åpne igjen, ber ' +
                      'du om godkjenning på nytt.'
                    : 'Klubben bestemmer hvilke lag som samler inn støtte. ' +
                      'Be om godkjenning — betalingsansvarlig får varsel og ' +
                      'godkjenner med ett trykk. Ingenting mer å fylle ut.'}
                </Text>
                <Button
                  title={
                    approval?.status === 'rejected' ||
                    doorState === 'paused' ||
                    doorState === 'deactivated'
                      ? 'Be om godkjenning på nytt'
                      : 'Be om godkjenning'
                  }
                  onPress={handleRequestApproval}
                  loading={requesting}
                  style={styles.cardButton}
                />
              </View>
            )}

            {status.isPaymentManager && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Du er betalingsansvarlig</Text>
                <Text style={styles.body}>
                  Godkjenn og administrer lagenes støtte i Klubbbetalinger.
                </Text>
                <Button
                  title="Åpne Klubbbetalinger"
                  variant="secondary"
                  onPress={() => navigation.navigate('ClubPayments')}
                  style={styles.cardButton}
                />
              </View>
            )}
          </>
        );
      }

      case 'disabled':
        return (
          <View style={styles.card}>
            <Text style={styles.pillRejected}>SPERRET</Text>
            <Text style={styles.cardTitle}>Kontoen er sperret hos Stripe</Text>
            <Text style={styles.body}>
              Ta kontakt med Heia, så hjelper vi klubben videre.
            </Text>
          </View>
        );

      case 'no_club':
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Laget mangler klubb</Text>
            <Text style={styles.body}>
              Støtte aktiveres for klubben laget hører til.
            </Text>
          </View>
        );

      default:
        break; // 'none' → intro + skjema under
    }

    // state 'none' (eller «Send ny søknad» etter avslag): intro + skjema.
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Slik virker det</Text>
          <Text style={styles.body}>
            Med «Støtt laget» kan foreldre og supportere gi et fast månedlig
            bidrag. Pengene utbetales til {clubName} — derfor må klubben
            godkjennes og kobles til utbetaling først. Heia sjekker
            opplysningene manuelt mot Brønnøysundregistrene.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Søknad for {clubName}</Text>

          <Text style={styles.fieldLabel}>Organisasjonsnummer</Text>
          <TextInput
            style={styles.input}
            value={orgNumber}
            onChangeText={setOrgNumber}
            keyboardType="number-pad"
            maxLength={11}
            placeholder="9 siffer"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Klubbens juridiske navn</Text>
          <TextInput
            style={styles.input}
            value={legalName}
            onChangeText={setLegalName}
            autoCapitalize="words"
            placeholder="Slik det står i Brønnøysundregistrene"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Din rolle i klubben</Text>
          <TextInput
            style={styles.input}
            value={role}
            onChangeText={setRole}
            placeholder="F.eks. trener, kasserer, styreleder"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>E-post</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Så vi kan kontakte deg om søknaden"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Telefon (valgfritt)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Hvis du heller vil ringes"
            placeholderTextColor={colors.textTertiary}
          />

          <Button
            title="Send søknad"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            style={styles.submitButton}
          />
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar title="Støtte fra supportere" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.heia}
          />
        }
        showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FactRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  cardTitle: {
    ...typography.heading3,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: -spacing.xs,
  },
  input: {
    ...typography.input,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  cardButton: {
    alignSelf: 'flex-start',
  },
  infoRequestBox: {
    backgroundColor: '#FFF4D6',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoRequestTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#8A6D1A',
  },
  factBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  factLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  factValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  // Statuspiller — samme tone-språk som resten av appen (soft + ink).
  pillPending: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pillApproved: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heiaDeep,
    backgroundColor: colors.heiaSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pillActive: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heiaDeep,
    backgroundColor: colors.heia,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pillRejected: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
