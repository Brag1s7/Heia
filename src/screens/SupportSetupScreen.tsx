import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
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
  submitClubClaimDirect,
  startStripeOnboarding,
  requestTeamSupportApproval,
  type ClaimNominee,
  type SupportActivationStatus,
} from '../lib/api';
import {lookupBrregEnhet} from '../lib/brreg';
import {WEB_INVITE_LANDING_LIVE} from '../shared/flags';
import type {ProfilStackParamList} from '../shared/types';

/**
 * Aktivering av «Støtt laget» (betalingssporet fase 3) — kun lagadmin,
 * via Laginnstillinger. Flyten: søknad (claim) → manuell Heia-review →
 * Stripe-onboarding via kortlevd lenke → aktiv. All status kommer fra
 * get_support_activation_status; webhookene (fase 2) flytter den.
 *
 * Autoritetsmodellen v2 (LÅST 2026-08-18, docs/AUTORITET-KLUBBBETALINGER-
 * 2026-08.md) endrer tre ting her:
 *  1. NOMINASJON — «Hvem skal være betalingsansvarlig?» stilles i skjemaet.
 *     «En annen i klubben» ender i en invitasjon som bare kan aksepteres på
 *     nettsiden, og er derfor featureflagget til web-landingen er live
 *     (`WEB_INVITE_LANDING_LIVE`) — ingen død brukerreise.
 *  2. KYC-GATEN — Account Link genereres kun av AKTIV betalingsansvarlig
 *     (`canOnboard`). Share-arket er FJERNET: lenken skal aldri distribueres
 *     via e-post/melding (Stripes føringer, II.8).
 *  3. `awaiting_manager` — verifisert klubb uten aktiv betalingsansvarlig.
 *     Treneren skal se HVA som mangler og hvem det venter på, ikke en CTA
 *     serveren uansett ville avvist.
 */

/** Kontaktkanalen når en nominasjon har gått i stå (II.6). */
const CONTACT = 'hello@heiaapp.no';
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
  // Nominasjonen (v2). Default er «Jeg» — og det ENESTE valget til
  // web-landingen finnes, se WEB_INVITE_LANDING_LIVE.
  const [nomineeIsSelf, setNomineeIsSelf] = useState(true);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeEmail, setNomineeEmail] = useState('');
  const [nomineePhone, setNomineePhone] = useState('');
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

  // Nominasjonen som DB-en/Edge-funksjonen forstår. «En annen» kan bare
  // oppstå når flagget er på — vaktene i submit_club_claim krever navn +
  // e-post, og skjemaet slipper deg ikke til uten.
  const buildNominee = useCallback((): ClaimNominee => {
    if (nomineeIsSelf || !WEB_INVITE_LANDING_LIVE) return {isSelf: true};
    return {
      isSelf: false,
      name: nomineeName.trim(),
      email: nomineeEmail.trim(),
      phone: nomineePhone.trim() || undefined,
    };
  }, [nomineeIsSelf, nomineeName, nomineeEmail, nomineePhone]);

  // Selve innsendingen. Prod-veien går ALLTID gjennom Edge-funksjonen
  // `submit-club-claim` (server-side Brønnøysund-håndhevelse, II.10);
  // `direct` er dev-bygg-veien for testdata som ikke finnes i registeret.
  const doSubmit = useCallback(
    async (clubId: string, submitLegalName: string, direct = false) => {
      const input = {
        clubId,
        orgNumber,
        legalName: submitLegalName,
        role,
        contactEmail: email,
        contactPhone: phone.trim() || undefined,
        nominee: buildNominee(),
      };
      try {
        await (direct ? submitClubClaimDirect(input) : submitClubClaim(input));
        setShowForm(false);
        await load();
      } catch (e: any) {
        Alert.alert('Kunne ikke sende søknaden', e?.message ?? 'Prøv igjen om litt.');
      } finally {
        setSubmitting(false);
      }
    },
    [orgNumber, role, email, phone, buildNominee, load],
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
          // Direkte på RPC-en: Edge-funksjonen ville avvist et orgnr som
          // ikke finnes i registeret — det er hele poenget med den.
          onPress: () => doSubmit(clubId, legalName, true),
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
  const nomineeOk =
    nomineeIsSelf ||
    !WEB_INVITE_LANDING_LIVE ||
    (nomineeName.trim().length > 0 && nomineeEmail.includes('@'));
  const canSubmit =
    orgNumber.replace(/\D/g, '').length === 9 &&
    legalName.trim().length > 0 &&
    role.trim().length > 0 &&
    email.includes('@') &&
    nomineeOk;

  // ------------------------------------------------------------------
  // Avledet tekst for autoritetsmodellens ventetilstander (v2).
  // ------------------------------------------------------------------
  const pending = status?.managerPending ?? null;
  const pendingName = pending?.invitedName ?? null;

  // `awaiting_manager`: klubben er godkjent, men ingen har rollen. Hva som
  // står i veien avhenger av siste invitasjon — og alle blindveier ender i
  // en kontaktvei, aldri i en knapp som ikke gjør noe.
  const awaitingManagerBody = (() => {
    const who = pendingName ?? 'den som ble nominert';
    switch (pending?.status) {
      case 'invited':
        return `${who} er invitert til å være betalingsansvarlig for klubben. Støtten åpner når invitasjonen er akseptert — vi purrer automatisk.`;
      case 'in_review':
        return `${who} har takket ja, og Heia bekrefter identiteten før rollen aktiveres. Det pleier å gå raskt.`;
      case 'declined':
        return `${who} takket nei til å være betalingsansvarlig. Skriv til ${CONTACT}, så setter vi opp en ny nominasjon.`;
      case 'expired':
        return `Invitasjonen til ${who} gikk ut på tid. Skriv til ${CONTACT}, så sender vi en ny.`;
      case 'revoked':
        return `Invitasjonen til ${who} ble trukket tilbake. Skriv til ${CONTACT}, så setter vi opp en ny nominasjon.`;
      default:
        return `Klubben er godkjent, men ingen står registrert som betalingsansvarlig ennå. Heia er varslet og ordner det — haster det, skriv til ${CONTACT}.`;
    }
  })();

  // Brukes der KYC-CTA-en er borte fordi du ikke er betalingsansvarlig.
  // NB: payloaden bærer navnet kun i `awaiting_manager` (manager_pending) —
  // i de øvrige tilstandene finnes en aktiv ansvarlig, men navnet hens er
  // ikke med i get_support_activation_status. Teksten er derfor presis uten
  // å påstå et navn vi ikke har.
  const waitingForManagerLine = pendingName
    ? `Vi venter på at ${pendingName} fullfører registreringen hos Stripe.`
    : 'Vi venter på at klubbens betalingsansvarlige fullfører registreringen hos Stripe.';

  // Klubbdøren (port 3) — samme kort i `active` og `awaiting_manager`.
  // `managerless` = ingen aktiv betalingsansvarlig: forespørselen forsvinner
  // ikke, den går til Heia som fallback-mottaker (II.9), og det SIER kortet.
  const renderDoorCard = (managerless: boolean) => {
    const doorState = status?.team?.supportState ?? 'none';
    const approval = status?.team?.approval ?? null;

    if (doorState === 'collecting') {
      return (
        <View style={styles.card}>
          <Text style={styles.pillActive}>SAMLER INN</Text>
          <Text style={styles.cardTitle}>Laget samler inn støtte</Text>
          <Text style={styles.body}>
            «Støtt laget» er åpen for alle i laget — foreldre og supportere
            finner den på Hjem og i lagkassa.
          </Text>
        </View>
      );
    }

    if (doorState === 'pending') {
      return (
        <View style={styles.card}>
          <Text style={styles.pillPending}>TIL GODKJENNING</Text>
          <Text style={styles.cardTitle}>Venter på klubbens godkjenning</Text>
          <Text style={styles.body}>
            {managerless
              ? `Forespørselen er registrert, og Heia er varslet fordi klubben ikke har en betalingsansvarlig ennå. Du får varsel her når laget er godkjent.`
              : 'Klubbens betalingsansvarlige har fått beskjed og godkjenner laget med ett trykk — du får varsel når det er gjort.'}
          </Text>
        </View>
      );
    }

    const again =
      approval?.status === 'rejected' ||
      doorState === 'paused' ||
      doorState === 'deactivated';

    return (
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
        {managerless && (
          <Text style={styles.hint}>
            Klubben mangler en betalingsansvarlig akkurat nå. Forespørselen
            din går til Heia, som følger den opp.
          </Text>
        )}
        <Button
          title={again ? 'Be om godkjenning på nytt' : 'Be om godkjenning'}
          onPress={handleRequestApproval}
          loading={requesting}
          style={styles.cardButton}
        />
      </View>
    );
  };

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

      // Verifisert klubb UTEN aktiv betalingsansvarlig (v2). Ingen KYC-CTA
      // her — den ville uansett blitt avvist av gaten i stripe-onboarding.
      case 'awaiting_manager':
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.pillApproved}>GODKJENT</Text>
              <Text style={styles.cardTitle}>
                Venter på klubbens betalingsansvarlige
              </Text>
              <Text style={styles.body}>{awaitingManagerBody}</Text>
              <View style={styles.factBox}>
                <FactRow
                  label="Organisasjonsnummer"
                  value={status.entity?.orgNumber ?? '—'}
                />
                <FactRow
                  label="Mottaker"
                  value={status.entity?.legalName ?? '—'}
                />
              </View>
              <Text style={styles.hint}>
                Stemmer ikke dette? Skriv til {CONTACT}.
              </Text>
            </View>
            {renderDoorCard(true)}
          </>
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
            {status.canOnboard ? (
              <>
                <Text style={styles.body}>
                  {status.state === 'restricted'
                    ? 'Registreringen hos Stripe er ikke helt i mål — fortsett der du slapp, så sier Stripe hva som mangler.'
                    : 'Siste steg: du registrerer klubben hos Stripe, som håndterer utbetalingene. Du trenger klubbens organisasjonsopplysninger og kontonummer.'}
                </Text>
                <Button
                  title="Fortsett hos Stripe"
                  onPress={handleOpenStripe}
                  loading={linkLoading}
                  style={styles.cardButton}
                />
                <Text style={styles.hint}>
                  Lenken er personlig og varer bare en kort stund — den kan
                  ikke deles videre.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  {waitingForManagerLine} Du får varsel her når klubben er klar
                  for støtte.
                </Text>
                <Text style={styles.hint}>
                  Registreringen hos Stripe kan bare gjøres av klubbens
                  betalingsansvarlige — lenken er personlig og deles aldri.
                  Står det stille, skriv til {CONTACT}.
                </Text>
              </>
            )}
          </View>
        );

      case 'active': {
        // Klubben (port 1+2) er åpen — resten avgjøres av klubbdøren
        // (port 3, 00047): lagets egen godkjenning fra betalingsansvarlig.
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
              {status.account?.actionNeeded &&
                (status.canOnboard ? (
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
                ) : (
                  <Text style={styles.body}>
                    Stripe ber om litt mer informasjon fra klubben.{' '}
                    {waitingForManagerLine}
                  </Text>
                ))}
            </View>

            {renderDoorCard(false)}

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

          {/* Nominasjonen (v2, II.2). «En annen» er featureflagget til
              web-landingen er live — se WEB_INVITE_LANDING_LIVE. Med flagget
              AV er «Jeg» eneste vei, og da er hele valget skjult: ett valg
              er ikke et valg, det er støy. */}
          {WEB_INVITE_LANDING_LIVE && (
            <>
              <Text style={styles.fieldLabel}>
                Hvem skal være betalingsansvarlig?
              </Text>
              <Text style={styles.hint}>
                Den betalingsansvarlige registrerer klubben hos Stripe og
                godkjenner hvilke lag som samler inn støtte. Det er ofte
                kasserer eller styreleder.
              </Text>
              <View style={styles.choiceRow}>
                <ChoiceCard
                  title="Jeg"
                  subtitle="Jeg gjør det selv"
                  selected={nomineeIsSelf}
                  onPress={() => setNomineeIsSelf(true)}
                />
                <ChoiceCard
                  title="En annen i klubben"
                  subtitle="Vi inviterer hen"
                  selected={!nomineeIsSelf}
                  onPress={() => setNomineeIsSelf(false)}
                />
              </View>

              {!nomineeIsSelf && (
                <>
                  <Text style={styles.fieldLabel}>Navn</Text>
                  <TextInput
                    style={styles.input}
                    value={nomineeName}
                    onChangeText={setNomineeName}
                    autoCapitalize="words"
                    placeholder="Fullt navn, slik det står i registeret"
                    placeholderTextColor={colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>E-post</Text>
                  <TextInput
                    style={styles.input}
                    value={nomineeEmail}
                    onChangeText={setNomineeEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Invitasjonen sendes hit"
                    placeholderTextColor={colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Telefon (valgfritt)</Text>
                  <TextInput
                    style={styles.input}
                    value={nomineePhone}
                    onChangeText={setNomineePhone}
                    keyboardType="phone-pad"
                    placeholder="Hvis Heia trenger å ringe"
                    placeholderTextColor={colors.textTertiary}
                  />

                  <Text style={styles.hint}>
                    Heia verifiserer personen før invitasjonen sendes. Den
                    kan bare aksepteres av en innlogget Heia-konto med samme
                    e-postadresse.
                  </Text>
                </>
              )}
            </>
          )}

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

/** Nominasjonsvalget — to like store kort, «valgt»-språket fra chipsene. */
function ChoiceCard({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      style={({pressed}) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed && styles.choicePressed,
      ]}>
      <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>
        {title}
      </Text>
      <Text style={styles.choiceSubtitle}>{subtitle}</Text>
    </Pressable>
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
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 2,
  },
  choiceCardSelected: {
    backgroundColor: colors.heiaSoft,
    borderColor: colors.heia,
  },
  choicePressed: {
    opacity: 0.7,
  },
  choiceTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceTitleSelected: {
    color: colors.heiaInk,
  },
  choiceSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cardButton: {
    alignSelf: 'flex-start',
  },
  infoRequestBox: {
    backgroundColor: colors.sun,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoRequestTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.goldInk,
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
