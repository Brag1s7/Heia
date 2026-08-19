import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {errorMessage} from '../shared/errorMessage';
import {BackBar, Button, Skeleton} from '../components';
import {
  getOpsClaim,
  opsApproveClaim,
  opsRejectClaim,
  opsRequestClaimInfo,
  type OpsClaim,
} from '../lib/api';
import {WEB_INVITE_LANDING_LIVE} from '../shared/flags';
import type {ProfilStackParamList} from '../shared/types';

type Route = RouteProp<ProfilStackParamList, 'OpsClaimDetail'>;

/**
 * «Heia Ops» — én klubbsøknad med beslutningsgrunnlaget og handlingene
 * (00046). Sikkerheten bor i databasen: alle tre handlingene er
 * audit-loggede RPC-er gatet på ops_admins, og godkjenning KREVER tekst
 * om hvordan autorisasjonen ble verifisert. Stripe tar KYC — dette er
 * Heias autorisasjonskontroll.
 *
 * Autoritetsmodellen v2 (00062): det er den NOMINERTE som skal verifiseres,
 * ikke nødvendigvis søkeren — og godkjenningen TILDELER myndighet (rolle
 * ved selvnominasjon, invitasjon ved nominasjon av en annen). Begge deler
 * står nå i flaten: nominasjonen i beslutningsgrunnlaget, og utfallet i
 * bekreftelsen etter godkjenning.
 */

/** Hva godkjenningen faktisk gjorde med myndigheten (00062 §7). */
function describeApproval(result: unknown): string {
  const r = result as {
    grantedManager?: boolean;
    invitationId?: string | null;
    entityReused?: boolean;
    accountStatus?: string | null;
  } | null;

  const lines: string[] = [];
  if (r?.grantedManager) {
    lines.push(
      'Søkeren er nå AKTIV betalingsansvarlig for den juridiske enheten, og kan starte registreringen hos Stripe.',
    );
  } else if (r?.invitationId) {
    lines.push(
      'Det er opprettet en invitasjon til den nominerte. Ingen har myndighet før invitasjonen er akseptert.',
    );
    if (!WEB_INVITE_LANDING_LIVE) {
      lines.push(
        'E-posten går IKKE ut ennå (web-landingen mangler) — invitasjonen står som «ikke sendt» under Klubber og roller.',
      );
    }
  } else {
    lines.push('Ingen fikk betalingsmyndighet av denne godkjenningen.');
  }
  if (r?.entityReused) {
    lines.push('Den juridiske enheten fantes fra før og ble gjenbrukt.');
  }
  lines.push('Klubben arvet Heias standardvilkår (79/60).');
  return lines.join('\n\n');
}

function FactRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function OpsClaimDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const {claimId} = route.params;

  const [claim, setClaim] = useState<OpsClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      setClaim(await getOpsClaim(claimId));
    } catch {
      // beholder forrige tilstand; skjermen viser feilkortet under
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runAction = useCallback(
    async (
      label: string,
      action: (id: string, text: string) => Promise<unknown>,
    ) => {
      const text = note.trim();
      if (!text) {
        Alert.alert(
          'Tekst kreves',
          label === 'Godkjenn'
            ? 'Beskriv hvordan du verifiserte at søkeren har fullmakt (registerrolle, telefon til klubbens registrerte kontakt, e-post …). Dette lagres i loggen.'
            : 'Skriv en melding — søkeren ser den i appen.',
        );
        return;
      }
      Alert.alert(`${label}?`, `«${text}»`, [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: label,
          style: label === 'Avslå' ? 'destructive' : 'default',
          onPress: async () => {
            setActing(true);
            try {
              const result = await action(claimId, text);
              setNote('');
              await load();
              // TILDELINGSUTFALLET (00062 §7): ops skal se hva
              // godkjenningen faktisk gjorde med myndigheten — rollen er
              // aldri en bieffekt man må gjette seg til.
              if (label === 'Godkjenn') {
                Alert.alert('Godkjent', describeApproval(result));
              }
            } catch (e) {
              Alert.alert(
                'Handlingen feilet',
                errorMessage(e),
              );
            } finally {
              setActing(false);
            }
          },
        },
      ]);
    },
    [claimId, note, load],
  );

  const isOpen =
    claim?.status === 'submitted' || claim?.status === 'in_review';
  const brreg = claim?.brreg;
  // Nominasjonen ligger i brreg-snapshotet (claim-notify skriver den ved
  // innsending). Eldre søknader mangler feltet — da ER det selvnominasjon,
  // for modellen fantes ikke da.
  const nomineeIsSelf = brreg?.checks?.nomineeIsSelf !== false;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + spacing['3xl']},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Klubbsøknad</Text>

        {loading && !claim ? (
          <View style={styles.card}>
            <Skeleton width={140} height={12} />
            <Skeleton height={16} />
            <Skeleton width="70%" height={12} />
          </View>
        ) : !claim ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              Fant ikke søknaden — den kan være utenfor din tilgang.
            </Text>
          </View>
        ) : (
          <>
            {/* Søknaden */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{claim.legalName}</Text>
              <FactRow label="Status" value={claim.status} />
              <FactRow label="Orgnr" value={claim.orgNumber} />
              <FactRow label="Klubb i Heia" value={claim.club?.name ?? '—'} />
              <FactRow
                label="Søker"
                value={`${claim.claimant?.displayName ?? 'Ukjent'} (${claim.claimedRole})`}
              />
              <FactRow label="E-post" value={claim.contactEmail ?? '—'} />
              {claim.contactPhone && (
                <FactRow label="Telefon" value={claim.contactPhone} />
              )}
              <FactRow
                label="Betalingsansvarlig"
                value={
                  nomineeIsSelf
                    ? `Søkeren selv (${claim.claimant?.displayName ?? 'ukjent'})`
                    : 'En annen i klubben — se e-posten'
                }
              />
              {!nomineeIsSelf && (
                <Text style={styles.hint}>
                  Søkeren har nominert en ANNEN person. Navn og e-post står i
                  klubbsøknad-e-posten fra Heia (claim-notify) — det er den
                  personen som skal verifiseres, og godkjenning oppretter en
                  invitasjon til hen, ikke en rolle til søkeren.
                </Text>
              )}
              {/* BESLUTNINGSSTØTTE, ikke statusvisning — begge sier noe om hva
                  en godkjenning VIL gjøre («gjenbruker den»), og hører derfor
                  bare hjemme mens søknaden er åpen. Etter godkjenning
                  beskriver de koblingen godkjenningen nettopp lagde, og et
                  rødt varsel på en ferdigbehandlet søknad leses som at noe
                  gikk galt (A3-dogfood 2026-08-19). Utfallet står i loggen. */}
              {isOpen && claim.clubAlreadyLinked && (
                <Text style={styles.warn}>
                  ⚠️ Klubben har allerede en aktiv kobling
                </Text>
              )}
              {isOpen && claim.existingEntity && (
                <Text style={styles.hint}>
                  Enheten finnes fra før ({claim.existingEntity.legalName}) —
                  godkjenning gjenbruker den.
                </Text>
              )}
            </View>

            {/* Brønnøysund-beviset */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Brønnøysund</Text>
              {!brreg ? (
                <Text style={styles.body}>
                  Ingen registerdata hentet for denne søknaden.
                </Text>
              ) : brreg.notFound ? (
                <Text style={styles.warn}>
                  ❌ Organisasjonsnummeret finnes ikke i Enhetsregisteret.
                </Text>
              ) : brreg.unreachable ? (
                <Text style={styles.body}>
                  ⚠️ Fikk ikke kontakt med registeret da søknaden kom — sjekk
                  manuelt på virksomhet.brreg.no.
                </Text>
              ) : brreg.enhet ? (
                <>
                  <FactRow label="Registrert navn" value={brreg.enhet.navn} />
                  <FactRow
                    label="Orgform"
                    value={`${brreg.enhet.orgformKode} — ${brreg.enhet.orgformTekst}`}
                  />
                  {(brreg.enhet.slettedato ||
                    brreg.enhet.konkurs ||
                    brreg.enhet.underAvvikling) && (
                    <Text style={styles.warn}>
                      ❌ {brreg.enhet.slettedato ? 'SLETTET ' : ''}
                      {brreg.enhet.konkurs ? 'KONKURS ' : ''}
                      {brreg.enhet.underAvvikling ? 'UNDER AVVIKLING' : ''}
                    </Text>
                  )}
                  {brreg.checks && !brreg.checks.nomineeIsSelf && (
                    <Text
                      style={
                        brreg.checks.nominertIRegisteret
                          ? styles.good
                          : styles.hint
                      }>
                      {brreg.checks.nominertIRegisteret
                        ? '◆ Den NOMINERTE står i registerets roller — sterkt bevis på fullmakt'
                        : '◆ Den nominerte står ikke i registerets roller (beviser ingenting — kasserer kan ha reell fullmakt; verifiser via klubbens registrerte kanal)'}
                    </Text>
                  )}
                  {brreg.checks && (
                    <Text
                      style={
                        brreg.checks.sokerIRegisteret
                          ? styles.good
                          : styles.hint
                      }>
                      {brreg.checks.sokerIRegisteret
                        ? '★ Søkeren står i registerets roller — sterkt bevis på fullmakt'
                        : '★ Søkeren står ikke i registerets roller (beviser ingenting — verifiser via klubbens registrerte kanal)'}
                    </Text>
                  )}
                  {brreg.roller.length > 0 && (
                    <View style={styles.factBox}>
                      {brreg.roller.map((r, i) => (
                        <Text
                          key={i}
                          style={
                            r.matchSoker || r.matchNominert
                              ? styles.good
                              : styles.rolle
                          }>
                          {r.matchSoker && r.matchNominert
                            ? '★◆'
                            : r.matchSoker
                              ? '★'
                              : r.matchNominert
                                ? '◆'
                                : '·'}{' '}
                          {r.rolle}: {r.navn}
                        </Text>
                      ))}
                      <Text style={styles.hint}>★ = søker · ◆ = nominert</Text>
                    </View>
                  )}
                  {(brreg.enhet.epostadresse || brreg.enhet.telefon) && (
                    <Text style={styles.hint}>
                      Registrert kontakt (verifiseringskanal):{' '}
                      {[brreg.enhet.epostadresse, brreg.enhet.telefon]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  )}
                </>
              ) : null}
            </View>

            {/* Historikk */}
            {(claim.audit.length > 0 || claim.infoRequestNote) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Logg</Text>
                {claim.audit.map((a, i) => (
                  <Text key={i} style={styles.body}>
                    {a.action === 'approve'
                      ? '✅ Godkjent'
                      : a.action === 'reject'
                        ? '❌ Avslått'
                        : '💬 Ba om mer info'}{' '}
                    av {a.actor ?? 'ukjent'}: «{a.note}»
                  </Text>
                ))}
              </View>
            )}

            {/* Handlingene */}
            {isOpen && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Behandle</Text>
                <Text style={styles.hint}>
                  Godkjenning krever at du skriver HVORDAN autorisasjonen ble
                  verifisert. Ved avslag eller info-forespørsel ser søkeren
                  teksten i appen. Alt logges.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="F.eks. «Ringte styreleder på registerets nummer — bekreftet fullmakt»"
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  editable={!acting}
                />
                <Button
                  title="Godkjenn"
                  onPress={() => runAction('Godkjenn', opsApproveClaim)}
                  loading={acting}
                />
                <Button
                  title="Be om mer informasjon"
                  variant="secondary"
                  onPress={() =>
                    runAction('Be om mer informasjon', opsRequestClaimInfo)
                  }
                  disabled={acting}
                />
                <Button
                  title="Avslå"
                  variant="ghost"
                  onPress={() => runAction('Avslå', opsRejectClaim)}
                  disabled={acting}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardTitle: {
    ...typography.heading3,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  factBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rolle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  good: {
    ...typography.bodySmall,
    color: colors.heiaDeep,
    fontWeight: '600',
  },
  warn: {
    ...typography.bodySmall,
    color: '#A13030',
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  input: {
    ...typography.bodySmall,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    color: colors.textPrimary,
  },
});
