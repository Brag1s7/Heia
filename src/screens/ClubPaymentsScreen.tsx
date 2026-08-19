import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {errorMessage} from '../shared/errorMessage';
import {BackBar, Button, Skeleton} from '../components';
import {
  AlertTriangle,
  Ban,
  Check,
  Mail,
  Megaphone,
  Pause,
  UserCheck,
  X,
} from '../components/icons';
import {
  getClubPaymentsOverview,
  approveTeamSupport,
  rejectTeamSupport,
  pauseTeamSupport,
  deactivateTeamSupport,
  issueManagerInvitation,
  type ClubPaymentsClub,
  type ClubPaymentRequest,
  type ClubPaymentTeam,
  type ClubPaymentInvitation,
} from '../lib/api';
import {WEB_INVITE_LANDING_LIVE} from '../shared/flags';

/**
 * «Klubbetalinger» (klubbdøren, 00047) — ÉN kanonisk flate for
 * betalingsansvarlig: hovedinngang på Profil, snarvei fra
 * Laginnstillinger. DB-gatet på club_payment_managers; RPC-ene er
 * vaktene, skjermen speiler. Betalingsansvarlig ser ALDRI pris —
 * godkjenning arver klubbens standardtilbud server-side.
 *
 * To handlinger med presist språk (LÅST — aldri «revoke» når
 * abonnementer består): «Pause nye støttespillere» og «Deaktiver
 * støtte for laget». Begge bekrefter med ANTALL berørte abonnementer
 * og logges (hvem/når/årsak).
 *
 * Autoritetsmodellen v2 (00062/00064):
 *  · Gruppen er den JURIDISKE ENHETEN, ikke klubbraden — én
 *    myndighetskrets per organisasjon, uansett hvor mange klubbrader
 *    som peker på samme orgnr.
 *  · Rolleadmin bor her (II.6): hvem som er ansvarlige, hvilke
 *    invitasjoner som er ute, og «Inviter ny betalingsansvarlig».
 *  · «Fullfør deaktiveringen» er veien tilbake fra en DELFEIL —
 *    Stripe-kallet nådde ikke alle abonnementene. Funksjonen er
 *    idempotent, så knappen er trygg å trykke.
 */

const STATE_META: Record<
  ClubPaymentTeam['state'],
  {label: string; bg: string; fg: string}
> = {
  collecting: {label: 'SAMLER INN', bg: colors.heiaSoft, fg: colors.heiaDeep},
  pending: {label: 'TIL GODKJENNING', bg: colors.sun, fg: colors.goldInk},
  paused: {label: 'PAUSET', bg: colors.surfaceMuted, fg: colors.textSecondary},
  deactivated: {
    label: 'DEAKTIVERT',
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
  },
  none: {label: 'IKKE AKTIV', bg: colors.surfaceMuted, fg: colors.textTertiary},
};

/** Loggen har ikoner, ikke emoji — samme ikonspråk som resten av appen. */
function LogIcon({action}: {action: string}) {
  const size = 15;
  switch (action) {
    case 'request':
      return <Megaphone size={size} color={colors.textTertiary} />;
    case 'approve':
      return <Check size={size} color={colors.heiaInk} />;
    case 'reject':
      return <X size={size} color={colors.error} />;
    case 'pause':
      return <Pause size={size} color={colors.textSecondary} />;
    case 'deactivate':
      return <Ban size={size} color={colors.error} />;
    default:
      return null;
  }
}

const ACTION_LABEL: Record<string, string> = {
  request: 'Ba om godkjenning',
  approve: 'Godkjent',
  reject: 'Avslått',
  pause: 'Pauset',
  deactivate: 'Deaktivert',
};

const INVITATION_LABEL: Record<ClubPaymentInvitation['status'], string> = {
  pending: 'Invitert — venter på svar',
  awaiting_review: 'Akseptert — Heia bekrefter identiteten',
  accepted: 'Akseptert',
  declined: 'Takket nei',
  revoked: 'Trukket tilbake',
  expired: 'Utløpt',
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

  // Invitasjonsskjemaet — inline, ikke Alert.prompt (den finnes kun på iOS,
  // og to felter i én prompt er uansett ikke en flate man skriver i).
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

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
          errorMessage(e),
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

  // DELFEIL-FIKSEN (gamle K2): et deaktivert lag med levende abonnementer
  // uten cancel_at betyr at noen Stripe-kall ikke gikk igjennom. Samme
  // idempotente funksjon kjøres på nytt — den tar kun de som mangler.
  const handleFinishDeactivation = useCallback(
    (team: ClubPaymentTeam) => {
      const n = team.unresolvedCancellations;
      Alert.alert(
        'Fullføre deaktiveringen?',
        `${n === 1 ? '1 støtteavtale' : `${n} støtteavtaler`} i «${team.teamName}» ` +
          'ble ikke satt til å avsluttes forrige gang — trolig en midlertidig ' +
          'feil mot betalingsleverandøren. Vi prøver på nytt; de som alt er ' +
          'i orden røres ikke.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Fullfør',
            onPress: () =>
              run(() =>
                deactivateTeamSupport(
                  team.teamSpaceId,
                  'Fullførte deaktivering etter delfeil',
                ),
              ),
          },
        ],
      );
    },
    [run],
  );

  const openInvite = useCallback((entityId: string) => {
    setInviteFor(entityId);
    setInviteName('');
    setInviteEmail('');
  }, []);

  const closeInvite = useCallback(() => setInviteFor(null), []);

  const handleInvite = useCallback(
    (entityId: string, legalName: string) => {
      const name = inviteName.trim();
      const email = inviteEmail.trim();
      if (!name || !email.includes('@')) {
        Alert.alert(
          'Navn og e-post kreves',
          'Invitasjonen kan bare aksepteres av en Heia-konto med nøyaktig ' +
            'denne e-postadressen — skriv den riktig.',
        );
        return;
      }
      Alert.alert(
        'Invitere ny betalingsansvarlig?',
        `${name} <${email}> får full tilgang til klubbens betalinger i ` +
          `${legalName} når invitasjonen er akseptert. Du og de andre ` +
          'ansvarlige får beskjed. Invitasjonen logges.',
        [
          {text: 'Avbryt', style: 'cancel'},
          {
            text: 'Inviter',
            onPress: () =>
              run(async () => {
                const res = await issueManagerInvitation({
                  entityId,
                  name,
                  email,
                });
                if (res.outcome === 'suspended') {
                  // 00064-kontrakten: utfallet KOMMER SOM DATA, slik at
                  // hendelsen og sikkerhetsvarselet overlever i basen.
                  Alert.alert(
                    'Invitasjonen ble ikke sendt',
                    'Tilgangen din som betalingsansvarlig er midlertidig ' +
                      'satt på pause, så du kan ikke invitere andre. Heia ' +
                      'er varslet — ta kontakt på hello@heiaapp.no.',
                  );
                  return;
                }
                closeInvite();
              }),
          },
        ],
      );
    },
    [inviteName, inviteEmail, run, closeInvite],
  );

  const renderEntity = (club: ClubPaymentsClub) => {
    const accountReady = !!club.account?.chargesEnabled;
    const entityId = club.entity?.id ?? null;
    const legalName =
      club.entity?.legalName ?? club.club?.name ?? 'Klubben';
    // Flere aktive klubbrader på samme orgnr = én myndighetskrets, men
    // lagene ligger spredt. Da SKAL det stå hvilke rader som inngår.
    const extraClubs = club.clubs.length > 1 ? club.clubs : [];

    return (
      <View key={club.entity?.id ?? club.club?.id ?? legalName}>
        <Text style={styles.clubName}>{legalName}</Text>
        {club.entity && (
          <Text style={styles.clubMeta}>orgnr {club.entity.orgNumber}</Text>
        )}
        {extraClubs.length > 0 && (
          <Text style={styles.clubMeta}>
            Klubbsider i Heia: {extraClubs.map((c) => c.name).join(' · ')}
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
                  {req.memberCount}{' '}
                  {req.memberCount === 1 ? 'medlem' : 'medlemmer'}
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
          const unresolved = team.unresolvedCancellations > 0;
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
              {/* Dormant-markeringen (§3e/§3f-4): innsyn, aldri myndighet.
                  Rolig informasjon — ingenting slettes, avtaler består. */}
              {team.dormantAt != null && (
                <Text style={styles.hint}>
                  Laget står uten aktive medlemmer. Innhold og avtaler består —
                  Heia er varslet, og spørsmål tas på hello@heiaapp.no.
                </Text>
              )}
              {unresolved && (
                <View style={styles.warnBox}>
                  <View style={styles.warnRow}>
                    <AlertTriangle size={15} color={colors.goldInk} />
                    <Text style={styles.warnBoxTitle}>
                      Deaktiveringen ble ikke fullført
                    </Text>
                  </View>
                  <Text style={styles.warnText}>
                    {team.unresolvedCancellations === 1
                      ? '1 støtteavtale er fortsatt løpende'
                      : `${team.unresolvedCancellations} støtteavtaler er fortsatt løpende`}{' '}
                    og trekkes videre. Trykk under, så prøver vi på nytt.
                  </Text>
                  <Button
                    title="Fullfør deaktiveringen"
                    variant="secondary"
                    onPress={() => handleFinishDeactivation(team)}
                    disabled={acting}
                    style={styles.cardButton}
                  />
                </View>
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

        {/* Rolleadmin (II.6) — produksjonsflyt, aldri SQL-runbook. */}
        <Text style={styles.sectionLabel}>BETALINGSANSVARLIGE</Text>
        <View style={styles.card}>
          {club.managers.map((m) => (
            <View key={m.userId} style={styles.personRow}>
              {m.status === 'active' ? (
                <UserCheck size={16} color={colors.heiaInk} />
              ) : (
                <Ban size={16} color={colors.textTertiary} />
              )}
              <Text style={styles.personName}>
                {m.name}
                {m.isMe ? ' (deg)' : ''}
              </Text>
              {m.status === 'suspended' && (
                <Text style={styles.personTag}>PÅ PAUSE</Text>
              )}
            </View>
          ))}

          {club.invitations.length > 0 && (
            <View style={styles.inviteList}>
              {club.invitations.map((inv) => (
                <View key={inv.id} style={styles.personRow}>
                  <Mail size={16} color={colors.textTertiary} />
                  <View style={styles.personTextWrap}>
                    <Text style={styles.personName}>{inv.invitedName}</Text>
                    <Text style={styles.hint}>
                      {INVITATION_LABEL[inv.status]}
                      {inv.status === 'pending' && !inv.sentAt
                        ? ' · e-posten sendes når Heias nettside er klar'
                        : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.hint}>
            Betalingsansvarlige godkjenner lag og administrerer klubbens
            betalinger. Alle endringer logges.
          </Text>

          {/* «Inviter ny» henger på web-landingen: en invitasjon kan bare
              aksepteres der, og e-posten sendes ikke før den finnes. Til da
              er dette en blindvei — derfor flagget (se shared/flags.ts).
              Trenger klubben en ny ansvarlig NÅ, gjør Heia det i ops-flaten. */}
          {WEB_INVITE_LANDING_LIVE && entityId ? (
            inviteFor === entityId ? (
              <View style={styles.inviteForm}>
                <Text style={styles.fieldLabel}>Navn</Text>
                <TextInput
                  style={styles.input}
                  value={inviteName}
                  onChangeText={setInviteName}
                  autoCapitalize="words"
                  placeholder="Fullt navn"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.fieldLabel}>E-post</Text>
                <TextInput
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Invitasjonen sendes hit"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.hint}>
                  Invitasjonen kan bare aksepteres av en innlogget Heia-konto
                  med nøyaktig denne adressen. Avvik går til kontroll hos Heia
                  før tilgangen gis.
                </Text>
                <Button
                  title="Send invitasjon"
                  onPress={() => handleInvite(entityId, legalName)}
                  loading={acting}
                  style={styles.cardButton}
                />
                <Button title="Avbryt" variant="ghost" onPress={closeInvite} />
              </View>
            ) : (
              <Button
                title="Inviter ny betalingsansvarlig"
                variant="secondary"
                onPress={() => openInvite(entityId)}
                disabled={acting}
                style={styles.cardButton}
              />
            )
          ) : (
            <Text style={styles.hint}>
              Trenger klubben flere betalingsansvarlige? Skriv til
              hello@heiaapp.no, så setter vi det opp.
            </Text>
          )}
        </View>

        {/* Loggen — hvem/når/årsak (låst beslutning). */}
        {club.log.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>LOGG</Text>
            <View style={styles.card}>
              {club.log.map((entry, i) => (
                <View key={i} style={styles.logRow}>
                  <View style={styles.logIcon}>
                    <LogIcon action={entry.action} />
                  </View>
                  <Text style={styles.logLine}>
                    {ACTION_LABEL[entry.action] ?? entry.action} ·{' '}
                    {entry.teamName} · {entry.actor} ·{' '}
                    {formatDate(entry.createdAt)}
                    {entry.note ? ` — «${entry.note}»` : ''}
                  </Text>
                </View>
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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.heia}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Klubbetalinger</Text>
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
          clubs.map(renderEntity)
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
    alignSelf: 'flex-start',
  },
  actionRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  // Solskinnsflate fra tokens — erstatter hardkodet #FFF4D6/#8A6D1A.
  warnCard: {
    backgroundColor: colors.sun,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnBox: {
    backgroundColor: colors.sun,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  warnBoxTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.goldInk,
  },
  warnText: {
    ...typography.bodySmall,
    color: colors.goldInk,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  personTextWrap: {
    flexShrink: 1,
  },
  personName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  personTag: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  inviteList: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
  },
  inviteForm: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  input: {
    ...typography.bodySmall,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  logIcon: {
    width: 16,
    alignItems: 'center',
    paddingTop: 2,
  },
  logLine: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
