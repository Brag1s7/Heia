import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  AppState,
  Linking,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {BackBar, Button, Skeleton} from '../components';
import {Check} from '../components/icons';
import {useActiveTeam} from '../context';
import {
  getSupportOffering,
  getMySupportSubscription,
  startSupportCheckout,
  type SupportOffering,
  type MySupportSubscription,
} from '../lib/api';

/**
 * «Støtt laget» (betalingssporet fase 4) — for ALLE lagmedlemmer.
 * Prisen er data fra lagets aktive offering (aldri hardkodet, aldri
 * split-tall — den er en ulåst kommersiell beslutning som bor server-side).
 * Betalingen skjer i EKSTERN Safari på Stripes hostede checkout
 * (Apple 3.2.2(iv), låst); status flyttes kun av webhookene, så skjermen
 * refetcher når appen våkner igjen (retur beviser ingenting).
 */

const benefits = [
  'Støtter utstyr, cuper og sosiale arrangementer',
  'Bidrar til en trygg og god lagsopplevelse',
  'Viser barna at noen heier — også utenfor banen',
  'Enkelt å starte, enkelt å avslutte',
];

function formatAmount(amountMinor: number): string {
  const kroner = Math.floor(amountMinor / 100);
  const ore = amountMinor % 100;
  return ore === 0 ? `${kroner} kr` : `${kroner},${String(ore).padStart(2, '0')} kr`;
}

function formatRenewal(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
  });
}

export function SupportScreen() {
  const insets = useSafeAreaInsets();
  const {activeTeamSpaceId, activeTeamSpace} = useActiveTeam();

  const [offering, setOffering] = useState<SupportOffering | null>(null);
  const [mySub, setMySub] = useState<MySupportSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const teamName = activeTeamSpace?.displayName ?? 'laget';

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      const [off, sub] = await Promise.all([
        getSupportOffering(activeTeamSpaceId),
        getMySupportSubscription(activeTeamSpaceId),
      ]);
      setOffering(off);
      setMySub(sub);
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

  // Tilbake fra Safari (Stripe Checkout) → fersk status; webhooken rekker
  // som regel å flytte abonnementet til active før brukeren er tilbake.
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

  // Checkout-URL-en er kortlevd — hentes alltid fersk i klikkøyeblikket.
  const handleSupport = useCallback(async () => {
    if (!activeTeamSpaceId || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const {url} = await startSupportCheckout(activeTeamSpaceId);
      Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Kunne ikke starte betalingen', e?.message ?? 'Prøv igjen om litt.');
      // «Du støtter allerede»-svaret betyr at statusen vår er utdatert.
      loadRef.current();
    } finally {
      setCheckoutLoading(false);
    }
  }, [activeTeamSpaceId, checkoutLoading]);

  const priceLabel =
    offering?.available ? `${formatAmount(offering.amountMinor)}/mnd` : '';

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.section}>
          <View style={styles.skeletonCard}>
            <Skeleton width={160} height={14} />
            <Skeleton height={14} />
            <Skeleton width="70%" height={14} />
          </View>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.section}>
          <Text style={styles.stateTitle}>Fikk ikke hentet statusen</Text>
          <Text style={styles.stateBody}>Sjekk nettet og prøv igjen.</Text>
          <Button title="Prøv igjen" variant="secondary" onPress={load} />
        </View>
      );
    }

    // Du støtter alt laget — takke-tilstanden eier skjermen.
    if (mySub?.status === 'active' || mySub?.status === 'past_due') {
      return (
        <View style={styles.section}>
          <View style={styles.activeCard}>
            <Text style={styles.activePill}>DU STØTTER LAGET</Text>
            <Text style={styles.activeTitle}>Tusen takk! 💚</Text>
            <Text style={styles.stateBody}>
              Du gir {teamName} et fast bidrag
              {offering?.available ? ` på ${priceLabel}` : ''}. Det betyr mer
              enn du tror — både på og utenfor banen.
            </Text>
            {mySub.status === 'past_due' ? (
              <Text style={styles.pastDueText}>
                Siste betaling gikk ikke gjennom. Stripe prøver igjen
                automatisk — sjekk gjerne kortet ditt.
              </Text>
            ) : mySub.currentPeriodEnd ? (
              <Text style={styles.renewalText}>
                Fornyes {formatRenewal(mySub.currentPeriodEnd)}
              </Text>
            ) : null}
            <Text style={styles.hint}>
              Endring og avslutning av støtten kommer i neste oppdatering av
              Heia.
            </Text>
          </View>
        </View>
      );
    }

    // Klubben er ikke koblet til utbetaling (eller mangler pris) ennå.
    if (!offering || !offering.available) {
      return (
        <View style={styles.section}>
          <Text style={styles.stateTitle}>Ikke helt klart ennå</Text>
          <Text style={styles.stateBody}>
            Klubben er ikke koblet til utbetaling ennå, så støtten kan ikke
            starte riktig enda. Trenere og lagledere kan sette det i gang fra
            Laginnstillinger → «Støtte fra supportere».
          </Text>
        </View>
      );
    }

    // Vanlig tegneflate (også «fullfør betalingen» for en påbegynt tegning).
    const pending =
      mySub?.status === 'checkout_pending' || mySub?.status === 'incomplete';

    return (
      <>
        {/* Fordeler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hvorfor støtte?</Text>
          {benefits.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Check size={17} color={colors.heiaInk} strokeWidth={2.4} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Prisen — ett månedlig beløp, rett fra offeringen */}
        <View style={styles.section}>
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Månedlig støtte</Text>
            <Text style={styles.priceValue}>{formatAmount(offering.amountMinor)}</Text>
            <Text style={styles.pricePeriod}>per måned</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          {pending && (
            <Text style={styles.pendingNote}>
              Har du nettopp betalt? Da oppdaterer statusen seg her om et lite
              øyeblikk.
            </Text>
          )}
          <Button
            title={
              pending
                ? 'Fullfør betalingen'
                : `Støtt laget · ${priceLabel}`
            }
            variant="primary"
            size="lg"
            onPress={handleSupport}
            loading={checkoutLoading}
            style={styles.ctaButton}
          />
          <Text style={styles.trustLine}>
            Avslutt når som helst. Ingen binding.
          </Text>
          <Text style={styles.recipientLine}>
            Betales trygt hos Stripe i Safari · utbetales til{' '}
            {offering.recipientLegalName}
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <BackBar title="Støtt laget" />
      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.heia}
          />
        }
      >
        {/* Illustrasjon */}
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Image
              source={require('../assets/images/logo-icon.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heading}>Støtt {teamName}</Text>
          <Text style={styles.subheading}>
            Mesteparten av ditt bidrag går direkte til laget
          </Text>
        </View>

        {renderContent()}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stiler
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.heiaSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoIcon: {
    width: 52,
    height: 52,
  },
  heading: {
    ...typography.heading1,
    textAlign: 'center',
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.lg,
  },
  skeletonCard: {
    gap: spacing.md,
  },

  // Tilstandstekster (feil / ikke aktivert)
  stateTitle: {
    ...typography.heading3,
    marginBottom: spacing.sm,
  },
  stateBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Fordeler
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  benefitText: {
    ...typography.body,
    flex: 1,
  },

  // Pris — mint tegneflate, prisen som display-tall (A v2)
  priceCard: {
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.heia,
    padding: spacing.xl,
    alignItems: 'center',
  },
  priceLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: 34,
    letterSpacing: -0.5,
    fontFamily: fonts.display,
    color: colors.heiaDeep,
  },
  pricePeriod: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Aktiv støtte
  activeCard: {
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  activePill: {
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
  activeTitle: {
    ...typography.heading2,
  },
  renewalText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
  pastDueText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  // CTA
  ctaSection: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaButton: {
    width: '100%',
  },
  pendingNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  trustLine: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  recipientLine: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
