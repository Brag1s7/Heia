import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {BackBar, Button, Skeleton} from '../components';
import {
  getClubPaymentsOverview,
  approveTeamSupport,
  rejectTeamSupport,
  pauseTeamSupport,
  deactivateTeamSupport,
  type ClubPaymentsClub,
  type ClubPaymentRequest,
  type ClubPaymentTeam,
} from '../lib/api';

/**
 * «Klubbbetalinger» (klubbdøren, 00047) — ÉN kanonisk flate for
 * betalingsansvarlig: hovedinngang på Profil, snarvei fra
 * Laginnstillinger. DB-gatet på club_payment_managers; RPC-ene er
 * vaktene, skjermen speiler. Betalingsansvarlig ser ALDRI pris —
 * godkjenning arver klubbens standardtilbud server-side.
 *
 * To handlinger med presist språk (LÅST — aldri «revoke» når
 * abonnementer består): «Pause nye støttespillere» og «Deaktiver
 * støtte for laget». Begge bekrefter med ANTALL berørte abonnementer
 * og logges (hvem/når/årsak).
 */

const STATE_META: Record<
  ClubPaymentTeam['state'],
  {label: string; bg: string; fg: string}
> = {
  collecting: {label: 'SAMLER INN', bg: colors.heiaSoft, fg: colors.heiaDeep},
  pending: {label: 'TIL GODKJENNING', bg: '#FFF4D6', fg: '#8A6D1A'},
  paused: {label: 'PAUSET', bg: colors.surfaceMuted, fg: colors.textSecondary},
  deactivated: {
    label: 'DEAKTIVERT',
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
  },
  none: {label: 'IKKE AKTIV', bg: colors.surfaceMuted, fg: colors.textTertiary},
};

const ACTION_LABEL: Record<string, string> = {
  request: '📩 Ba om godkjenning',
  approve: '✅ Godkjent',
  reject: '❌ Avslått',
  pause: '⏸ Pauset',
  deactivate: '🚫 Deaktivert',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
  });
}

function supporterLine(n: number): string {
  if (n === 0) return 'Ingen aktive støttespillere';
  return n === 1 ? '1 aktiv støttespiller' : `${n} aktive støttespillere`;
}

export function ClubPaymentsScreen() {
  const insets = useSafeAreaInsets();

  const [clubs, setClubs] = useState<ClubPaymentsClub[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      setClubs(await getClubPaymentsOverview());
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

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActing(true);
      try {
        await fn();
        await load();
      } catch (e) {
        Alert.alert(
          'Handlingen feilet',
          e instanceof Error ? e.message : 'Prøv igjen om litt.',
        );
      } finally {
        setActing(false);
      }
    },
    [load],
  );

  // Ett trykk «Godkjenn» — bekreftelsen sier hva som skjer, aldri pris
  // (laget arver klubbens standardtilbud server-side).
  const handleApprove = useCallback(
    (req: ClubPaymentRequest) => {
      Alert.alert(
        `Godkjenne «${req.teamName}»?`,
        'Laget arver klubbens standardtilbud og kan begynne å samle inn ' +
          'støtte med en gang.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {text: 'Godkjenn', onPress: () => run(() => approveTeamSupport(req.id))},
        ],
      );
    },
    [run],
  );

  // Avslag krever begrunnelse — treneren ser den i appen.
  const handleReject = useCallback(
    (req: ClubPaymentRequest) => {
      Alert.prompt(
        `Avslå «${req.teamName}»?`,
        'Skriv en begrunnelse — treneren som spurte ser den i appen.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Avslå',
            style: 'destructive',
            onPress: (text?: string) => {
              const note = (text ?? '').trim();
              if (!note) {
                Alert.alert(
                  'Begrunnelse kreves',
                  'Avslag uten forklaring skaper bare spørsmål — skriv én setning.',
                );
                return;
              }
              run(() => rejectTeamSupport(req.id, note));
            },
          },
        ],
        'plain-text',
      );
    },
    [run],
  );

  const handlePause = useCallback(
    (team: ClubPaymentTeam) => {
      Alert.prompt(
        'Pause nye støttespillere?',
        `«${team.teamName}»: nye støttespillere stoppes. ` +
          `${supporterLine(team.liveSubscriptions)} fortsetter som før.\n\n` +
          'Årsak (valgfritt) — logges:',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Pause',
            onPress: (text?: string) =>
              run(() => pauseTeamSupport(team.teamSpaceId, text?.trim() || undefined)),
          },
        ],
        'plain-text',
      );
    },
    [run],
  );

  const handleDeactivate = useCallback(
    (team: ClubPaymentTeam) => {
      Alert.prompt(
        'Deaktivere støtte for laget?',
        `«${team.teamName}»: nye støttespillere stoppes, og ` +
          `${supporterLine(team.liveSubscriptions).toLowerCase()} avsluttes ` +
          'ved betalt periodes slutt. Ingen refusjon av betalt periode.\n\n' +
          'Årsak (valgfritt) — logges:',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Deaktiver',
            style: 'destructive',
            onPress: (text?: string) =>
              run(() =>
                deactivateTeamSupport(team.teamSpaceId, text?.trim() || undefined),
              ),
          },
        ],
        'plain-text',
      );
    },
    [run],
  );

  const renderClub = (club: ClubPaymentsClub) => {
    const accountReady = !!club.account?.chargesEnabled;
    return (
      <View key={club.club.id}>
        <Text style={styles.clubName}>{club.club.name}</Text>
        {club.entity && (
          <Text style={styles.clubMeta}>
            {club.entity.legalName} · orgnr {club.entity.orgNumber}
          </Text>
        )}
        {!accountReady && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              Klubbens Stripe-konto er ikke aktiv ennå — betalinger åpner når
              registreringen hos Stripe er fullført. Du kan likevel behandle
              forespørsler.
            </Text>
          </View>
        )}

        {/* Forespørsler — kun eksisterende data, aldri pris. */}
        {club.requests.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>TIL GODKJENNING</Text>
            {club.requests.map((req) => (
              <View key={req.id} style={styles.card}>
                <Text style={styles.cardTitle}>{req.teamName}</Text>
                <Text style={styles.meta}>
                  {[req.ageGroup, req.gender === 'female' ? 'jenter' : req.gender === 'male' ? 'gutter' : null]
                    .filter(Boolean)
                    .join(' · ') || 'Lag i klubben'}
                  {' · '}
                  {req.memberCount} medlemmer
                </Text>
                <Text style={styles.meta}>
                  {req.requestedBy} spurte {formatDate(req.requestedAt)}
                </Text>
                <Button
                  title="Godkjenn"
                  onPress={() => handleApprove(req)}
                  loading={acting}
                  style={styles.cardButton}
                />
                <Button
                  title="Avslå"
                  variant="ghost"
                  onPress={() => handleReject(req)}
                  disabled={acting}
                />
              </View>
            ))}
          </>
        )}

        {/* Lagene i klubben med dør-tilstand + handlinger. */}
        <Text style={styles.sectionLabel}>LAGENE</Text>
        {club.teams.map((team) => {
          const meta = STATE_META[team.state];
          const canPause = team.state === 'collecting';
          const canDeactivate =
            (team.state === 'collecting' || team.state === 'paused') &&
            team.liveSubscriptions > 0;
          return (
            <View key={team.teamSpaceId} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{team.teamName}</Text>
                <Text
                  style={[styles.pill, {backgroundColor: meta.bg, color: meta.fg}]}>
                  {meta.label}
                </Text>
              </View>
              {(team.state === 'collecting' ||
                team.state === 'paused' ||
                team.state === 'deactivated') && (
                <Text style={styles.meta}>
                  {supporterLine(team.liveSubscriptions)}
                  {team.state === 'paused' ? ' · nye er stoppet' : ''}
                  {team.state === 'deactivated'
                    ? ' · avsluttes ved periodeslutt'
                    : ''}
                </Text>
              )}
              {(team.state === 'paused' || team.state === 'deactivated') && (
                <Text style={styles.hint}>
                  Laget kan be om godkjenning på nytt fra Laginnstillinger.
                </Text>
              )}
              {(canPause || canDeactivate) && (
                <View style={styles.actionRow}>
                  {canPause && (
                    <Button
                      title="Pause nye støttespillere"
                      variant="secondary"
                      onPress={() => handlePause(team)}
                      disabled={acting}
                    />
                  )}
                  {canDeactivate && (
                    <Button
                      title="Deaktiver støtte"
                      variant="ghost"
                      onPress={() => handleDeactivate(team)}
                      disabled={acting}
                    />
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Loggen — hvem/når/årsak (låst beslutning). */}
        {club.log.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>LOGG</Text>
            <View style={styles.card}>
              {club.log.map((entry, i) => (
                <Text key={i} style={styles.logLine}>
                  {ACTION_LABEL[entry.action] ?? entry.action} ·{' '}
                  {entry.teamName} · {entry.actor} ·{' '}
                  {formatDate(entry.createdAt)}
                  {entry.note ? ` — «${entry.note}»` : ''}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Klubbbetalinger</Text>
        <Text style={styles.subtitle}>
          Du bestemmer hvilke lag i klubben som samler inn støtte
        </Text>

        {loading ? (
          <View style={styles.card}>
            <Skeleton width={120} height={12} />
            <Skeleton height={16} />
            <Skeleton width="60%" height={12} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.meta}>
              Fikk ikke hentet oversikten — dra ned for å prøve igjen.
            </Text>
          </View>
        ) : clubs === null || clubs.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.meta}>
              Du er ikke betalingsansvarlig for noen klubb.
            </Text>
          </View>
        ) : (
          clubs.map(renderClub)
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
    marginBottom: spacing.lg,
  },
  clubName: {
    ...typography.heading2,
    marginTop: spacing.lg,
  },
  clubMeta: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.heading3,
    flexShrink: 1,
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
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cardButton: {
    marginTop: spacing.sm,
  },
  actionRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  warnCard: {
    backgroundColor: '#FFF4D6',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: {
    ...typography.bodySmall,
    color: '#8A6D1A',
  },
  logLine: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
