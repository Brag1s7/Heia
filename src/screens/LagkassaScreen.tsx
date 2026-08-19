import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  AppState,
  Linking,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {BackBar, Button, HeroSurface, Skeleton} from '../components';
import {useActiveTeam, useAuth} from '../context';
import {isTeamAdmin} from '../shared/roles';
import {profilEntry} from '../navigation/profilEntry';
import {
  getTeamSupportSummary,
  getSupportOffering,
  getMySupportSubscription,
  startSupportCheckout,
  type TeamSupportSummary,
  type SupportOffering,
  type MySupportSubscription,
} from '../lib/api';
import {formatKr} from '../lib/money';
import type {RootTabParamList} from '../shared/types';

// Siste kjente svar per (bruker, lag) — samme mønster som «Min støtte» på
// Profil: den som kommer tilbake ser tallene umiddelbart, og første besøk
// får full skeleton-dekning i stedet for kort som popper inn når svaret
// lander. Nøkkelen bærer bruker-id fordi iSupport er personlig.
type LagkassaData = {
  summary: TeamSupportSummary | null;
  offering: SupportOffering | null;
  mySub: MySupportSubscription | null;
};

function formatRenewal(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
  });
}
const lagkassaCache = new Map<string, LagkassaData>();

/** Sentinel: oppslaget feilet — ikke det samme som «ingen støtteavtale». */
const UNKNOWN_SUB = Symbol('unknown-subscription');

/**
 * Lagkassa (betalingssporet fase 5) — lagets støtteside for ALLE medlemmer,
 * og fra 2026-08-19 den ENESTE siden før Stripe.
 *
 * Den lå tidligere foran en egen «Støtt laget»-skjerm som gjentok pris,
 * fordeling, mottaker og knappetekst ordrett, slik at man leste det samme
 * to ganger og trykket samme knapp to ganger før noe skjedde. Mellomskjermen
 * er fjernet; knappen her går rett på Stripes hostede checkout, og retur fra
 * Safari lander på DENNE siden — der tallene allerede er kvitteringen.
 *
 * Hovedtallet er alltid det LAGET får (låst 2026-08-02) — aldri brutto.
 * Fordelingen kommuniseres offentlig og positivt («60 kr går direkte til
 * laget») — tallene er DATA fra offeringen, aldri hardkodet.
 */
export function LagkassaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {activeTeamSpaceId, activeTeamSpace, activeRole} = useActiveTeam();
  const {profile} = useAuth();

  const cacheKey = `${profile?.id ?? 'anon'}:${activeTeamSpaceId ?? ''}`;
  const cached = lagkassaCache.get(cacheKey);
  const [summary, setSummary] = useState<TeamSupportSummary | null>(
    cached?.summary ?? null,
  );
  const [offering, setOffering] = useState<SupportOffering | null>(
    cached?.offering ?? null,
  );
  const [mySub, setMySub] = useState<MySupportSubscription | null>(
    cached?.mySub ?? null,
  );
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const mySubRef = useRef(mySub);
  mySubRef.current = mySub;

  const teamName = activeTeamSpace?.displayName ?? 'laget';

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      const [sum, off, sub] = await Promise.all([
        getTeamSupportSummary(activeTeamSpaceId),
        getSupportOffering(activeTeamSpaceId),
        // FEILET oppslag er ikke det samme som «støtter ikke laget». Slo det
        // feil, beholder vi forrige kjente svar — ellers forsvinner
        // kvitteringen til en som faktisk betaler, og skjermen påstår det
        // motsatte av sannheten.
        getMySupportSubscription(activeTeamSpaceId).catch(() => UNKNOWN_SUB),
      ]);
      const nextSub = sub === UNKNOWN_SUB ? mySubRef.current : sub;
      lagkassaCache.set(cacheKey, {
        summary: sum,
        offering: off,
        mySub: nextSub,
      });
      setSummary(sum);
      setOffering(off);
      setMySub(nextSub);
    } catch {
      // Pull-to-refresh er retry-veien; skjermen viser skeleton/nuller.
    } finally {
      setLoading(false);
    }
  }, [activeTeamSpaceId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Betalingen skjer i EKSTERN Safari, og status flyttes kun av webhookene —
  // retur beviser ingenting. Derfor hentes alt på nytt når appen våkner.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') loadRef.current();
    });
    return () => sub.remove();
  }, []);

  // Checkout-URL-en er kortlevd — hentes alltid fersk i klikkøyeblikket.
  const handleSupport = useCallback(async () => {
    if (!activeTeamSpaceId || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const {url} = await startSupportCheckout(activeTeamSpaceId);
      Linking.openURL(url);
    } catch (e: any) {
      Alert.alert(
        'Kunne ikke starte betalingen',
        e?.message ?? 'Prøv igjen om litt.',
      );
      // «Du støtter allerede»-svaret betyr at statusen vår er utdatert.
      loadRef.current();
    } finally {
      setCheckoutLoading(false);
    }
  }, [activeTeamSpaceId, checkoutLoading]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const available = offering?.available === true;
  const iSupport = mySub?.status === 'active' || mySub?.status === 'past_due';
  // En påbegynt tegning som ikke er bokført ennå — knappen sier «fullfør».
  const pending =
    mySub?.status === 'checkout_pending' || mySub?.status === 'incomplete';
  const monthly = summary?.monthlyToClubMinor ?? 0;
  const supporters = summary?.supporters ?? 0;
  const total = summary?.totalToClubMinor ?? 0;

  const sinceLabel = summary?.since
    ? new Date(summary.since).toLocaleDateString('nb-NO', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  // «Mer enn 3 av 4 kroner»-linjen vises kun når dataene faktisk sier det —
  // copy skal aldri kunne lyve om fordelingen.
  const shareLine =
    available && offering.clubAmountMinor / offering.amountMinor >= 0.75
      ? 'Mer enn 3 av 4 kroner går tilbake til laget.'
      : null;

  return (
    <View style={styles.screen}>
      <BackBar title="Lagkassa" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.heia}
          />
        }
        showsVerticalScrollIndicator={false}>
        {/* Hero — lagets tall, på hero-flaten */}
        <HeroSurface style={styles.heroCard}>
          <Text style={styles.heroPill}>💚 LAGKASSA</Text>
          {loading ? (
            <View style={styles.heroSkeleton}>
              <Skeleton width={180} height={34} />
              <Skeleton width={140} height={14} />
            </View>
          ) : supporters > 0 ? (
            <>
              <Text style={styles.heroAmount}>{formatKr(monthly)}</Text>
              <Text style={styles.heroCaption}>til laget hver måned</Text>
              <Text style={styles.heroSupporters}>
                {supporters === 1
                  ? `1 støttespiller heier på ${teamName}`
                  : `${supporters} støttespillere heier på ${teamName}`}
              </Text>
              {total > 0 && (
                <Text style={styles.heroTotal}>
                  {formatKr(total)} samlet inn til laget
                  {sinceLabel ? ` siden ${sinceLabel}` : ''}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.heroEmptyTitle}>
                Bli lagets første støttespiller
              </Text>
              <Text style={styles.heroSupporters}>
                Hver krone gjør lagfølelsen større — for {teamName} og alle
                rundt.
              </Text>
            </>
          )}
        </HeroSurface>

        {/* Fordelingen — offentlig og positiv, rett fra offeringen.
            Under lasting: skeleton med kortets form, så flaten står stabilt
            fra første frame i stedet for å poppe inn når svaret lander. */}
        {loading ? (
          <View style={styles.splitCard}>
            <Skeleton width="88%" height={16} />
            <Skeleton width="60%" height={12} />
            <Skeleton width="92%" height={12} style={styles.splitSkeletonHint} />
          </View>
        ) : available ? (
          <View style={styles.splitCard}>
            <Text style={styles.splitHeadline}>
              {formatKr(offering.amountMinor)} i måneden —{' '}
              {formatKr(offering.clubAmountMinor)} går direkte til laget
            </Text>
            {shareLine && <Text style={styles.splitLine}>{shareLine}</Text>}
            <Text style={styles.splitHint}>
              De resterende{' '}
              {formatKr(offering.amountMinor - offering.clubAmountMinor)}{' '}
              dekker Heia, betalingsbehandling og drift. Utbetales til{' '}
              {offering.recipientLegalName}.
            </Text>
          </View>
        ) : null}

        {/* Hva pengene går til */}
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>Hva støtten betyr</Text>
          <Text style={styles.whyText}>
            Utstyr som holder. Cuper laget faktisk kan dra på. Sosiale
            kvelder som bygger lagfølelse. Og barna som ser at noen heier —
            også utenfor banen.
          </Text>
        </View>

        {/* CTA — skeleton i knappens form under lasting, så bunnen av siden
            ikke hopper når tegneflaten (eller supporter-tilstanden) kommer. */}
        <View style={styles.ctaSection}>
          {loading ? (
            <>
              <Skeleton height={56} style={styles.ctaSkeleton} />
              <Skeleton width={180} height={12} />
            </>
          ) : iSupport ? (
            <>
              <Text style={styles.iSupportText}>Du er en av dem 💚</Text>
              {/* Rekkefølgen er ikke tilfeldig: en OPPSAGT avtale fornyes
                  ikke, den avsluttes — og det er sant også når statusen
                  fortsatt er 'active' ut perioden. Sier vi «Fornyes» der,
                  lover vi noe som ikke skjer. Samme regel som «Min støtte»
                  på Profil har hatt hele tiden. */}
              {mySub?.cancelAt ? (
                <Text style={styles.renewalText}>
                  Avsluttes {formatRenewal(mySub.cancelAt)}
                </Text>
              ) : mySub?.status === 'past_due' ? (
                <Text style={styles.pastDueText}>
                  Siste betaling gikk ikke gjennom. Stripe prøver igjen
                  automatisk — sjekk gjerne kortet ditt.
                </Text>
              ) : mySub?.currentPeriodEnd ? (
                <Text style={styles.renewalText}>
                  Fornyes {formatRenewal(mySub.currentPeriodEnd)}
                </Text>
              ) : null}
              <Text style={styles.ctaHint}>
                Betalingsmåte, kvitteringer og oppsigelse finner du under «Min
                støtte» på Profil.
              </Text>
            </>
          ) : available ? (
            <>
              {pending && (
                <Text style={styles.ctaHint}>
                  Har du nettopp betalt? Da oppdaterer statusen seg her om et
                  lite øyeblikk.
                </Text>
              )}
              <Button
                title={
                  pending
                    ? 'Fullfør betalingen'
                    : `Støtt laget · ${formatKr(offering.amountMinor)}/mnd`
                }
                variant="primary"
                size="lg"
                onPress={handleSupport}
                loading={checkoutLoading}
                style={styles.ctaButton}
              />
              <Text style={styles.ctaHint}>
                Avslutt når som helst. Ingen binding.
              </Text>
              {/* Siste linje før appen forlates — hvem som tar betalingen og
                  hvem pengene havner hos. Den fulgte med fra mellomskjermen
                  som ble fjernet; den hører hjemme rett over utgangen. */}
              <Text style={styles.ctaHint}>
                Betales trygt hos Stripe i Safari · utbetales til{' '}
                {offering.recipientLegalName}.
              </Text>
            </>
          ) : (
            <>
              {/* To ULIKE situasjoner, ikke én. `not_activated` = klubben er
                  ikke koblet til utbetaling ennå. `no_offering` = laget har
                  ingen aktiv pris — som også er tilstanden etter PAUSE og
                  DEAKTIVERING, og da er «ikke satt opp ennå» direkte feil:
                  laget ER satt opp, det tar bare ikke imot nye nå.
                  (Payloaden skiller ikke pauset fra aldri-priset — det
                  krever en ny `reason` fra 00039. Teksten under er sann i
                  begge tilfeller.) */}
              <Text style={styles.ctaHint}>
                {offering?.available === false &&
                offering.reason === 'no_offering'
                  ? isTeamAdmin(activeRole)
                    ? 'Laget tar ikke imot nye støttespillere akkurat nå. ' +
                      'Du finner status og kan be om godkjenning på nytt ' +
                      'under «Støtte fra supportere».'
                    : 'Laget tar ikke imot nye støttespillere akkurat nå. ' +
                      'Trenere og lagledere finner status i Laginnstillinger.'
                  : isTeamAdmin(activeRole)
                    ? 'Støtten for laget er ikke åpnet ennå. Sjekk statusen ' +
                      'og be om klubbens godkjenning under «Støtte fra ' +
                      'supportere».'
                    : 'Støtten for dette laget er ikke satt opp ennå. ' +
                      'Trenere og lagledere finner status i Laginnstillinger.'}
              </Text>
              {/* Fulgte med fra mellomskjermen som ble fjernet — lagadmin
                  skal ikke måtte lete etter veien videre. */}
              {isTeamAdmin(activeRole) && (
                <Button
                  title="Åpne «Støtte fra supportere»"
                  variant="secondary"
                  onPress={() =>
                    navigation
                      .getParent<NavigationProp<RootTabParamList>>()
                      ?.navigate('ProfilStack', profilEntry('SupportSetup'))
                  }
                  style={styles.ctaButton}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  heroCard: {
    padding: spacing.xl,
    gap: spacing.xs,
  },
  heroPill: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heiaDeep,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  heroSkeleton: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  // Hovedtallet: det laget FÅR — display-tall (A v2).
  heroAmount: {
    fontSize: 40,
    letterSpacing: -0.6,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  heroCaption: {
    ...typography.body,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
  heroSupporters: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  heroTotal: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  heroEmptyTitle: {
    ...typography.heading2,
    color: colors.heiaDeep,
  },

  splitCard: {
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  splitHeadline: {
    ...typography.body,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
  splitLine: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  splitHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  splitSkeletonHint: {
    marginTop: spacing.xs,
  },
  ctaSkeleton: {
    width: '100%',
    borderRadius: radius.lg,
  },

  whyCard: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  whyTitle: {
    ...typography.heading3,
  },
  whyText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  ctaSection: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  ctaButton: {
    width: '100%',
  },
  ctaHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  renewalText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.heiaInk,
    textAlign: 'center',
  },
  pastDueText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  iSupportText: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
});
