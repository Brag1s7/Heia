import React, {useState} from 'react';
import {View, Text, ScrollView, Pressable, StyleSheet, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {Button} from '../components';
import {useActiveTeam} from '../context';

type Plan = 'monthly' | 'yearly';

const plans = {
  monthly: {price: 49, label: 'Månedlig', period: '/mnd'},
  yearly: {price: 399, label: 'Årlig', period: '/år', savings: 'Spar 33%'},
} as const;

const benefits = [
  'Støtter utstyr, cuper og sosiale arrangementer',
  'Bidrar til en trygg og god lagsopplevelse',
  'Viser barna at noen heier — også utenfor banen',
  'Enkelt å starte, enkelt å avslutte',
];

export function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);
  const {activeTeamSpace} = useActiveTeam();

  const teamName = activeTeamSpace?.displayName ?? 'Laget';

  const handleStart = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const plan = plans[selectedPlan];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
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

      {/* Fordeling */}
      <View style={styles.section}>
        <View style={styles.splitBar}>
          <View style={styles.splitTeam}>
            <Text style={styles.splitTeamText}>80% til laget</Text>
          </View>
          <View style={styles.splitHeia}>
            <Text style={styles.splitHeiaText}>20%</Text>
          </View>
        </View>
        <Text style={styles.splitCaption}>
          {teamName} mottar størstedelen av bidraget ditt. Resten dekker drift av
          Heia-plattformen.
        </Text>
      </View>

      {/* Fordeler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hvorfor støtte?</Text>
        {benefits.map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </View>

      {/* Plan-valg */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Velg plan</Text>
        <View style={styles.planRow}>
          <PlanCard
            label={plans.monthly.label}
            price={`${plans.monthly.price} kr`}
            period={plans.monthly.period}
            selected={selectedPlan === 'monthly'}
            onPress={() => setSelectedPlan('monthly')}
          />
          <PlanCard
            label={plans.yearly.label}
            price={`${plans.yearly.price} kr`}
            period={plans.yearly.period}
            badge={plans.yearly.savings}
            selected={selectedPlan === 'yearly'}
            onPress={() => setSelectedPlan('yearly')}
          />
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <Button
          title={`Start støtte · ${plan.price} kr${plan.period}`}
          variant="primary"
          size="lg"
          onPress={handleStart}
          loading={loading}
          style={styles.ctaButton}
        />
        <Text style={styles.trustLine}>
          Avslutt når som helst. Ingen binding.
        </Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Plan-kort
// ---------------------------------------------------------------------------
function PlanCard({
  label,
  price,
  period,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
      ]}
    >
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>
        {label}
      </Text>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>
        {price}
      </Text>
      <Text style={styles.planPeriod}>{period}</Text>
    </Pressable>
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

  // Fordelings-bar
  splitBar: {
    flexDirection: 'row',
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  splitTeam: {
    flex: 80,
    backgroundColor: colors.heia,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A v2-regel: mintfyll bærer heiaDeep-tekst.
  splitTeamText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.heiaDeep,
  },
  splitHeia: {
    flex: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitHeiaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  splitCaption: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  // Fordeler
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  // heiaInk — mint er kun fyll på lys flate (A v2-regel).
  checkmark: {
    ...typography.body,
    color: colors.heiaInk,
    fontWeight: '700',
    lineHeight: 24,
  },
  benefitText: {
    ...typography.body,
    flex: 1,
  },

  // Plan-kort
  planRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  planCardSelected: {
    borderColor: colors.heia,
    backgroundColor: colors.heiaSoft,
  },
  badge: {
    backgroundColor: colors.heia,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.caption,
    color: colors.heiaDeep,
    fontWeight: '700',
  },
  planLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  planLabelSelected: {
    color: colors.textPrimary,
  },
  planPrice: {
    ...typography.heading2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  planPriceSelected: {
    color: colors.textPrimary,
  },
  planPeriod: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
  trustLine: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
