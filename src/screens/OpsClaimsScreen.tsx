import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, Skeleton} from '../components';
import {listOpsClaims, type OpsClaim} from '../lib/api';
import type {ProfilStackParamList} from '../shared/types';

type Nav = NativeStackNavigationProp<ProfilStackParamList, 'OpsClaims'>;

/**
 * «Heia Ops» — intern liste over klubbsøknader (00046). DB-gatet på
 * ops_admins: RPC-en returnerer NULL for alle andre, og da viser skjermen
 * bare en rolig tom tilstand. Handlingene bor i detaljskjermen.
 */

const STATUS_META: Record<
  OpsClaim['status'],
  {label: string; bg: string; fg: string}
> = {
  submitted: {label: 'NY', bg: colors.heiaSoft, fg: colors.heiaDeep},
  in_review: {label: 'VENTER SVAR', bg: '#FFF4D6', fg: '#8A6D1A'},
  approved: {label: 'GODKJENT', bg: colors.heiaSoft, fg: colors.heiaDeep},
  rejected: {label: 'AVSLÅTT', bg: '#FDE8E8', fg: '#A13030'},
  expired: {label: 'UTLØPT', bg: colors.surfaceMuted, fg: colors.textTertiary},
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', {day: 'numeric', month: 'short'});
}

export function OpsClaimsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [claims, setClaims] = useState<OpsClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setClaims(await listOpsClaims());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const open = claims?.filter(
    (c) => c.status === 'submitted' || c.status === 'in_review',
  );
  const done = claims?.filter(
    (c) => c.status !== 'submitted' && c.status !== 'in_review',
  );

  const renderClaim = (claim: OpsClaim) => {
    const meta = STATUS_META[claim.status];
    return (
      <Pressable
        key={claim.id}
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
        onPress={() =>
          navigation.navigate('OpsClaimDetail', {claimId: claim.id})
        }>
        <View style={styles.cardTop}>
          <Text style={[styles.pill, {backgroundColor: meta.bg, color: meta.fg}]}>
            {meta.label}
          </Text>
          <Text style={styles.date}>{formatDate(claim.createdAt)}</Text>
        </View>
        <Text style={styles.clubName}>{claim.legalName}</Text>
        <Text style={styles.meta}>
          Orgnr {claim.orgNumber} · {claim.claimant?.displayName ?? 'Ukjent'} (
          {claim.claimedRole})
        </Text>
        {claim.brreg?.notFound && (
          <Text style={styles.warn}>❌ Orgnr finnes ikke i registeret</Text>
        )}
        {claim.brreg?.checks?.sokerIRegisteret && (
          <Text style={styles.good}>✓ Søkeren står i Brønnøysund-rollene</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <BackBar />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Heia Ops</Text>
        <Text style={styles.subtitle}>Klubbsøknader</Text>

        {loading ? (
          <View style={styles.card}>
            <Skeleton width={120} height={12} />
            <Skeleton height={16} />
            <Skeleton width="60%" height={12} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.meta}>
              Fikk ikke hentet søknadene — dra ned for å prøve igjen.
            </Text>
          </View>
        ) : claims === null || claims.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.meta}>Ingen søknader ennå.</Text>
          </View>
        ) : (
          <>
            {open && open.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>TIL BEHANDLING</Text>
                {open.map(renderClaim)}
              </>
            )}
            {done && done.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>HISTORIKK</Text>
                {done.map(renderClaim)}
              </>
            )}
          </>
        )}
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.heading1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  clubName: {
    ...typography.heading3,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  warn: {
    ...typography.bodySmall,
    color: '#A13030',
    fontWeight: '600',
  },
  good: {
    ...typography.bodySmall,
    color: colors.heiaDeep,
    fontWeight: '600',
  },
});
