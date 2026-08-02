import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {BackBar, Button, HeroSurface, Skeleton} from '../components';
import {useActiveTeam, useAuth} from '../context';
import {
  getTeamSupportSummary,
  getSupportOffering,
  getMySupportSubscription,
  type TeamSupportSummary,
  type SupportOffering,
} from '../lib/api';
import {formatKr} from '../lib/money';
import type {HomeStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Lagkassa'>;

// Siste kjente svar per (bruker, lag) — samme mønster som «Min støtte» på
// Profil: den som kommer tilbake ser tallene umiddelbart, og første besøk
// får full skeleton-dekning i stedet for kort som popper inn når svaret
// lander. Nøkkelen bærer bruker-id fordi iSupport er personlig.
type LagkassaData = {
  summary: TeamSupportSummary | null;
  offering: SupportOffering | null;
  iSupport: boolean;
};
const lagkassaCache = new Map<string, LagkassaData>();

/**
 * Lagkassa (betalingssporet fase 5) — lagets støtteside for ALLE medlemmer.
 * Hovedtallet er alltid det LAGET får (låst 2026-08-02) — aldri brutto.
 * Fordelingen kommuniseres offentlig og positivt («60 kr går direkte til
 * laget») — tallene er DATA fra offeringen, aldri hardkodet.
 */
export function LagkassaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {activeTeamSpaceId, activeTeamSpace} = useActiveTeam();
  const {profile} = useAuth();

  const cacheKey = `${profile?.id ?? 'anon'}:${activeTeamSpaceId ?? ''}`;
  const cached = lagkassaCache.get(cacheKey);
  const [summary, setSummary] = useState<TeamSupportSummary | null>(
    cached?.summary ?? null,
  );
  const [offering, setOffering] = useState<SupportOffering | null>(
    cached?.offering ?? null,
  );
  const [iSupport, setISupport] = useState(cached?.iSupport ?? false);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const teamName = activeTeamSpace?.displayName ?? 'laget';

  const load = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    try {
      const [sum, off, mySub] = await Promise.all([
        getTeamSupportSummary(activeTeamSpaceId),
        getSupportOffering(activeTeamSpaceId),
        getMySupportSubscription(activeTeamSpaceId).catch(() => null),
      ]);
      const supports =
        mySub?.status === 'active' || mySub?.status === 'past_due';
      lagkassaCache.set(cacheKey, {
        summary: sum,
        offering: off,
        iSupport: supports,
      });
      setSummary(sum);
      setOffering(off);
      setISupport(supports);
    } catch {
      // Pull-to-refresh er retry-veien; skjermen viser skeleton/nuller.
    } finally {
      setLoading(false);
    }
  }, [activeTeamSpaceId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const available = offering?.available === true;
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
              <Text style={styles.ctaHint}>
                Din støtte administreres under «Min støtte» på Profil.
              </Text>
            </>
          ) : available ? (
            <>
              <Button
                title={`Støtt laget · ${formatKr(offering.amountMinor)}/mnd`}
                variant="primary"
                size="lg"
                onPress={() => navigation.navigate('Support')}
                style={styles.ctaButton}
              />
              <Text style={styles.ctaHint}>
                Avslutt når som helst. Ingen binding.
              </Text>
            </>
          ) : (
            <Text style={styles.ctaHint}>
              Støtten for dette laget er ikke satt opp ennå. Trenere og
              lagledere finner status i Laginnstillinger.
            </Text>
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
  iSupportText: {
    ...typography.heading3,
    color: colors.heiaDeep,
  },
});
