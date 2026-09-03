import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {colors, typography, spacing, radius, shadows} from '../theme';
import {errorMessage} from '../shared/errorMessage';
import {BackBar, Button, Skeleton, useBottomContentPadding} from '../components';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Building2,
  Mail,
  UserCheck,
  UserPlus,
} from '../components/icons';
import {
  opsListPaymentEntities,
  opsIssueManagerInvitation,
  opsRevokeManagerInvitation,
  opsConfirmInvitationReview,
  opsRejectInvitationReview,
  opsSuspendManager,
  opsReactivateManager,
  opsRemoveManager,
  opsMoveTeamToClub,
  opsListTeamsForClubs,
  type OpsPaymentEntity,
  type OpsEntityInvitation,
  type OpsClubTeam,
} from '../lib/api';

/**
 * «Klubber og roller» — Heia Ops sin flate for autoritetsmodellen v2
 * (docs/AUTORITET-KLUBBBETALINGER-2026-08.md, II.6). Dette er flaten som
 * gjør SQL-editoren til NØDFALLBACK: utsted/trekk invitasjon, avgjør
 * avvikskontrollen, suspender/reaktiver/fjern betalingsansvarlige og flytt
 * lag under feil klubbrad.
 *
 * Sikkerheten bor i databasen — hver handling er en SECURITY DEFINER-RPC
 * gatet på `is_ops_admin()`, hver skriving KREVER en begrunnelse (RPC-en
 * avviser tom tekst), og alt havner i den append-only loggen
 * `payment_authority_events`. Skjermen er et speil, aldri en vakt:
 *  · siste-aktive-vernet ligger i `ops_remove_manager` (suspensjon er lov),
 *  · rollen ved AVVIK aktiveres kun via `ops_confirm_invitation_review`,
 *  · listen er NULL for alle som ikke er ops (probe-vernet).
 */

type ActionRunner = (note: string) => Promise<unknown>;

interface PromptState {
  title: string;
  message: string;
  placeholder: string;
  confirm: string;
  destructive?: boolean;
  run: ActionRunner;
}

const INVITATION_LABEL: Record<OpsEntityInvitation['status'], string> = {
  pending: 'Venter på svar',
  awaiting_review: 'AVVIKSKONTROLL',
  accepted: 'Akseptert',
  declined: 'Takket nei',
  revoked: 'Trukket tilbake',
  expired: 'Utløpt',
};

const SOURCE_LABEL: Record<OpsEntityInvitation['source'], string> = {
  claim: 'fra søknad',
  ops: 'fra Heia Ops',
  manager: 'fra betalingsansvarlig',
};

/** Hendelsesnavnene i payment_authority_events, på norsk. */
const EVENT_LABEL: Record<string, string> = {
  granted: 'Rolle gitt',
  accepted: 'Invitasjon akseptert',
  suspended: 'Satt på pause',
  reactivated: 'Reaktivert',
  removed: 'Fjernet',
  invite_issued: 'Invitasjon utstedt',
  invite_reminder: 'Påminnelse sendt',
  invite_revoked: 'Invitasjon trukket',
  invite_declined: 'Invitasjon avslått',
  invite_expired: 'Invitasjon utløpt',
  invite_redeemed_review: 'Innløst med avvik',
  review_confirmed: 'Avvik bekreftet',
  review_rejected: 'Avvik avvist',
  invite_attempt_invalid: 'Ugyldig forsøk',
  team_moved: 'Lag flyttet',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function OpsEntitiesScreen() {
  const bottomPad = useBottomContentPadding();

  const [entities, setEntities] = useState<OpsPaymentEntity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState(false);

  // Begrunnelsen er PÅKREVD i alle skrivende RPC-er — derfor én felles
  // prompt i stedet for Alert.prompt (som bare finnes på iOS).
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [note, setNote] = useState('');

  // Invitasjonsskjemaet per enhet.
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  // Arket glir opp når prompten åpnes. `useNativeDriver` — transformen
  // kjører på UI-tråden, så bevegelsen står selv om JS jobber.
  const sheetRise = useRef(new Animated.Value(0)).current;
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');

  // Lagene under duplikat-klubbrader (lastes på forespørsel per enhet).
  const [teamsFor, setTeamsFor] = useState<Record<string, OpsClubTeam[]>>({});

  const load = useCallback(async () => {
    try {
      setEntities(await opsListPaymentEntities());
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

  const closePrompt = useCallback(() => {
    setPrompt(null);
    setNote('');
  }, []);

  const ask = useCallback((state: PromptState) => {
    setNote('');
    setPrompt(state);
  }, []);

  // Åpning animeres; lukking gjør det IKKE — Modal-en river innholdet i det
  // `visible` blir false, så en utgangsanimasjon ville aldri rukket å vises.
  // Verdien nullstilles derfor med én gang, klar til neste åpning.
  useEffect(() => {
    if (prompt === null) {
      sheetRise.setValue(0);
      return;
    }
    Animated.timing(sheetRise, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [prompt, sheetRise]);

  const confirmPrompt = useCallback(async () => {
    if (!prompt) return;
    const text = note.trim();
    if (!text) {
      Alert.alert(
        'Begrunnelse kreves',
        'Alle rolleendringer logges permanent — skriv hva du gjorde og hvorfor.',
      );
      return;
    }
    setActing(true);
    try {
      await prompt.run(text);
      closePrompt();
      await load();
    } catch (e) {
      Alert.alert(
        'Handlingen feilet',
        errorMessage(e),
      );
    } finally {
      setActing(false);
    }
  }, [prompt, note, closePrompt, load]);

  // ------------------------------------------------------------------
  // Handlingene
  // ------------------------------------------------------------------
  const confirmReview = useCallback(
    (inv: OpsEntityInvitation) =>
      ask({
        title: 'Bekreft identiteten',
        message: `${inv.acceptedByName ?? 'Innløseren'} får AKTIV rolle som betalingsansvarlig. Beskriv hvordan du bekreftet at det er riktig person.`,
        placeholder: 'F.eks. «Ringte kasserer på registerets nummer — bekreftet ny e-post»',
        confirm: 'Bekreft',
        run: (n) => opsConfirmInvitationReview(inv.id, n),
      }),
    [ask],
  );

  const rejectReview = useCallback(
    (inv: OpsEntityInvitation) =>
      ask({
        title: 'Avvis innløsningen',
        message:
          'Invitasjonen trekkes, ingen rolle gis, og innløseren får beskjed i appen. Begrunnelsen logges.',
        placeholder: 'F.eks. «Fikk ikke bekreftet identiteten»',
        confirm: 'Avvis',
        destructive: true,
        run: (n) => opsRejectInvitationReview(inv.id, n),
      }),
    [ask],
  );

  const revokeInvitation = useCallback(
    (inv: OpsEntityInvitation) =>
      ask({
        title: 'Trekk tilbake invitasjonen',
        message: `Invitasjonen til ${inv.invitedName} kan ikke lenger innløses. En ny invitasjon er en ny rad med nytt token.`,
        placeholder: 'Hvorfor trekkes den?',
        confirm: 'Trekk tilbake',
        destructive: true,
        run: (n) => opsRevokeManagerInvitation(inv.id, n),
      }),
    [ask],
  );

  const suspend = useCallback(
    (entityId: string, userId: string, name: string, managerless: boolean) =>
      ask({
        title: `Sett ${name} på pause`,
        message: managerless
          ? 'Dette er den SISTE aktive betalingsansvarlige — enheten blir stående uten myndighet, og ops varsles. Det er lov (sikkerhet trumfer), men gjør det med åpne øyne.'
          : 'Personen mister tilgangen til klubbens betalinger til rollen reaktiveres.',
        placeholder: 'Hvorfor settes rollen på pause?',
        confirm: 'Sett på pause',
        destructive: true,
        run: (n) => opsSuspendManager(entityId, userId, n),
      }),
    [ask],
  );

  const reactivate = useCallback(
    (entityId: string, userId: string, name: string) =>
      ask({
        title: `Reaktiver ${name}`,
        message: 'Personen får tilbake full tilgang til klubbens betalinger.',
        placeholder: 'Hvorfor reaktiveres rollen?',
        confirm: 'Reaktiver',
        run: (n) => opsReactivateManager(entityId, userId, n),
      }),
    [ask],
  );

  const remove = useCallback(
    (entityId: string, userId: string, name: string) =>
      ask({
        title: `Fjern ${name}`,
        message:
          'Rollen slettes. Er dette den siste aktive, avviser databasen fjerningen — sett på pause eller få en erstatter på plass først.',
        placeholder: 'Hvorfor fjernes rollen?',
        confirm: 'Fjern',
        destructive: true,
        run: (n) => opsRemoveManager(entityId, userId, n),
      }),
    [ask],
  );

  const openInvite = useCallback((entityId: string) => {
    setInviteFor(entityId);
    setInviteName('');
    setInviteEmail('');
    setInviteNote('');
  }, []);

  const submitInvite = useCallback(
    async (entityId: string) => {
      const name = inviteName.trim();
      const email = inviteEmail.trim();
      const why = inviteNote.trim();
      if (!name || !email.includes('@') || !why) {
        Alert.alert(
          'Mangler noe',
          'Navn, gyldig e-post og en beskrivelse av hvordan fullmakten ble verifisert er påkrevd — det siste logges.',
        );
        return;
      }
      setActing(true);
      try {
        await opsIssueManagerInvitation({entityId, name, email, note: why});
        setInviteFor(null);
        await load();
      } catch (e) {
        Alert.alert(
          'Invitasjonen ble ikke opprettet',
          errorMessage(e),
        );
      } finally {
        setActing(false);
      }
    },
    [inviteName, inviteEmail, inviteNote, load],
  );

  const loadTeams = useCallback(
    async (entity: OpsPaymentEntity) => {
      try {
        const rows = await opsListTeamsForClubs(entity.clubs.map((c) => c.id));
        setTeamsFor((prev) => ({...prev, [entity.entity.id]: rows}));
      } catch (e) {
        Alert.alert(
          'Fikk ikke hentet lagene',
          errorMessage(e),
        );
      }
    },
    [],
  );

  const moveTeam = useCallback(
    (team: OpsClubTeam, entity: OpsPaymentEntity) => {
      const targets = entity.clubs.filter((c) => c.id !== team.clubId);
      if (targets.length === 0) return;
      const pick = (clubId: string, clubName: string) =>
        ask({
          title: `Flytt «${team.name}»`,
          message: `Laget flyttes til klubbraden «${clubName}». Flyttingen logges i hendelsesloggen.`,
          placeholder: 'Hvorfor flyttes laget?',
          confirm: 'Flytt',
          run: (n) =>
            opsMoveTeamToClub({
              teamId: team.teamId,
              targetClubId: clubId,
              note: n,
            }),
        });

      if (targets.length === 1) {
        pick(targets[0].id, targets[0].name);
        return;
      }
      Alert.alert(
        `Flytt «${team.name}» til`,
        'Velg klubbraden laget skal ligge under.',
        [
          ...targets.map((t) => ({
            text: t.name,
            onPress: () => pick(t.id, t.name),
          })),
          {text: 'Avbryt', style: 'cancel' as const},
        ],
      );
    },
    [ask],
  );

  // Avvikskøen på tvers av alle enheter — det ops faktisk må ta stilling til.
  const reviewQueue = useMemo(
    () =>
      (entities ?? []).flatMap((e) =>
        e.invitations
          .filter((i) => i.status === 'awaiting_review')
          .map((i) => ({entity: e, inv: i})),
      ),
    [entities],
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const renderEntity = (e: OpsPaymentEntity) => {
    const id = e.entity.id;
    const activeManagers = e.managers.filter((m) => m.status === 'active');
    const teams = teamsFor[id];
    const duplicateRows = e.clubs.length > 1;

    return (
      <View key={id}>
        <View style={styles.entityHead}>
          <Building2 size={18} color={colors.textSecondary} />
          <Text style={styles.entityName}>{e.entity.legalName}</Text>
        </View>
        <Text style={styles.meta}>
          orgnr {e.entity.orgNumber} · {e.entity.verificationStatus}
          {e.account
            ? ` · konto ${e.account.status}${e.account.chargesEnabled ? ' (åpen)' : ''}`
            : ' · ingen konto'}
        </Text>
        <Text style={styles.meta}>
          {e.clubs.length === 0
            ? 'Ingen aktive klubbrader'
            : `Klubbrader: ${e.clubs.map((c) => c.name).join(' · ')}`}
        </Text>
        {duplicateRows && (
          <Text style={styles.warnLine}>
            Flere klubbrader på samme orgnr — én myndighetskrets, men lagene
            kan ligge feil. Flytt dem til den kanoniske raden.
          </Text>
        )}

        {activeManagers.length === 0 && (
          <View style={styles.warnBox}>
            <View style={styles.rowCenter}>
              <AlertTriangle size={15} color={colors.goldInk} />
              <Text style={styles.warnBoxTitle}>Ingen aktiv betalingsansvarlig</Text>
            </View>
            <Text style={styles.warnText}>
              Enheten kan ikke starte Stripe-onboarding eller godkjenne lag.
              Utsted en invitasjon, eller reaktiver en som står på pause.
            </Text>
          </View>
        )}

        {/* Managere */}
        <Text style={styles.sectionLabel}>BETALINGSANSVARLIGE</Text>
        <View style={styles.card}>
          {e.managers.length === 0 ? (
            <Text style={styles.meta}>Ingen registrert.</Text>
          ) : (
            e.managers.map((m) => (
              <View key={m.userId} style={styles.personBlock}>
                <View style={styles.rowCenter}>
                  {m.status === 'active' ? (
                    <UserCheck size={16} color={colors.heiaInk} />
                  ) : (
                    <Ban size={16} color={colors.textTertiary} />
                  )}
                  <Text style={styles.personName}>{m.name}</Text>
                  {m.status === 'suspended' && (
                    <Text style={styles.tag}>PÅ PAUSE</Text>
                  )}
                </View>
                <Text style={styles.hint}>
                  {m.source ?? 'ukjent kilde'} · siden {formatDate(m.createdAt)}
                </Text>
                <View style={styles.actionRow}>
                  {m.status === 'active' ? (
                    <Button
                      title="Sett på pause"
                      variant="secondary"
                      onPress={() =>
                        suspend(id, m.userId, m.name, activeManagers.length === 1)
                      }
                      disabled={acting}
                    />
                  ) : (
                    <Button
                      title="Reaktiver"
                      variant="secondary"
                      onPress={() => reactivate(id, m.userId, m.name)}
                      disabled={acting}
                    />
                  )}
                  <Button
                    title="Fjern"
                    variant="ghost"
                    onPress={() => remove(id, m.userId, m.name)}
                    disabled={acting}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Invitasjoner */}
        <Text style={styles.sectionLabel}>INVITASJONER</Text>
        <View style={styles.card}>
          {e.invitations.length === 0 ? (
            <Text style={styles.meta}>Ingen invitasjoner.</Text>
          ) : (
            e.invitations.map((inv) => (
              <View key={inv.id} style={styles.personBlock}>
                <View style={styles.rowCenter}>
                  <Mail size={16} color={colors.textTertiary} />
                  <Text style={styles.personName}>{inv.invitedName}</Text>
                  <Text
                    style={
                      inv.status === 'awaiting_review'
                        ? styles.tagAlert
                        : styles.tag
                    }>
                    {INVITATION_LABEL[inv.status]}
                  </Text>
                </View>
                <Text style={styles.hint}>
                  {inv.invitedEmail} · {SOURCE_LABEL[inv.source]}
                </Text>
                <Text style={styles.hint}>
                  Opprettet {formatDate(inv.createdAt)} · utløper{' '}
                  {formatDate(inv.expiresAt)} ·{' '}
                  {inv.sentAt
                    ? `sendt ${formatDate(inv.sentAt)}`
                    : 'IKKE SENDT (venter på web-landingen)'}
                  {inv.remindedAt ? ` · purret ${formatDate(inv.remindedAt)}` : ''}
                </Text>
                {inv.mismatch && (
                  <View style={styles.mismatchBox}>
                    <Text style={styles.mismatchTitle}>Avvik ved innløsning</Text>
                    <Text style={styles.mismatchLine}>
                      Invitert: {inv.mismatch.invitedName ?? '—'} &lt;
                      {inv.mismatch.invitedEmail ?? '—'}&gt;
                    </Text>
                    <Text style={styles.mismatchLine}>
                      Kontoen: {inv.mismatch.profileName ?? '—'} &lt;
                      {inv.mismatch.accountEmail ?? '—'}&gt;
                    </Text>
                    <Text style={styles.mismatchLine}>
                      Navnematch: {inv.mismatch.nameMatch ? 'ja' : 'nei'} —
                      beslutningsstøtte, aldri alene-grunnlag (profilnavn er
                      spoofbart).
                    </Text>
                  </View>
                )}
                {inv.note && <Text style={styles.hint}>Notat: «{inv.note}»</Text>}
                {inv.status === 'awaiting_review' && (
                  <View style={styles.actionRow}>
                    <Button
                      title="Bekreft identiteten"
                      onPress={() => confirmReview(inv)}
                      disabled={acting}
                    />
                    <Button
                      title="Avvis"
                      variant="ghost"
                      onPress={() => rejectReview(inv)}
                      disabled={acting}
                    />
                  </View>
                )}
                {inv.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Button
                      title="Trekk tilbake"
                      variant="ghost"
                      onPress={() => revokeInvitation(inv)}
                      disabled={acting}
                    />
                  </View>
                )}
              </View>
            ))
          )}

          {inviteFor === id ? (
            <View style={styles.form}>
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
                placeholder="Må matche kontoens e-post nøyaktig"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Hvordan ble fullmakten verifisert?</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={inviteNote}
                onChangeText={setInviteNote}
                multiline
                placeholder="F.eks. «Ringte styreleder på registerets nummer»"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.hint}>
                E-posten sendes kun når WEB_INVITE_BASE_URL er satt. Til da
                står invitasjonen som «IKKE SENDT» her — den er ikke tapt.
              </Text>
              <View style={styles.actionRow}>
                <Button
                  title="Utsted invitasjon"
                  onPress={() => submitInvite(id)}
                  loading={acting}
                />
                <Button
                  title="Avbryt"
                  variant="ghost"
                  onPress={() => setInviteFor(null)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Button
                title="Utsted invitasjon"
                variant="secondary"
                onPress={() => openInvite(id)}
                disabled={acting}
              />
            </View>
          )}
        </View>

        {/* Lagflytting — hovedverktøyet ved duplikatrader (II.7). */}
        {duplicateRows && (
          <>
            <Text style={styles.sectionLabel}>LAG UNDER KLUBBRADENE</Text>
            <View style={styles.card}>
              {teams === undefined ? (
                <View style={styles.actionRow}>
                  <Button
                    title="Vis lagene"
                    variant="secondary"
                    onPress={() => loadTeams(e)}
                    disabled={acting}
                  />
                </View>
              ) : teams.length === 0 ? (
                <Text style={styles.meta}>Ingen lag under disse radene.</Text>
              ) : (
                teams.map((t) => {
                  const club = e.clubs.find((c) => c.id === t.clubId);
                  return (
                    <View key={t.teamId} style={styles.personBlock}>
                      <View style={styles.rowCenter}>
                        <ArrowLeftRight size={16} color={colors.textTertiary} />
                        <Text style={styles.personName}>
                          {t.name}
                          {t.ageGroup ? ` · ${t.ageGroup}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.hint}>
                        Ligger under «{club?.name ?? 'ukjent klubbrad'}»
                      </Text>
                      <View style={styles.actionRow}>
                        <Button
                          title="Flytt"
                          variant="secondary"
                          onPress={() => moveTeam(t, e)}
                          disabled={acting}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Hendelsesloggen (append-only) */}
        {e.events.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HENDELSER</Text>
            <View style={styles.card}>
              {e.events.map((ev, i) => (
                <Text key={i} style={styles.logLine}>
                  {EVENT_LABEL[ev.event] ?? ev.event}
                  {ev.subject ? ` · ${ev.subject}` : ''}
                  {ev.actor ? ` · av ${ev.actor}` : ''} ·{' '}
                  {formatDate(ev.createdAt)}
                  {ev.note ? ` — «${ev.note}»` : ''}
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
          {paddingBottom: bottomPad},
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
        <Text style={styles.title}>Klubber og roller</Text>
        <Text style={styles.subtitle}>
          Betalingsmyndighet per juridisk enhet — alt logges permanent
        </Text>

        {loading ? (
          <View style={styles.card}>
            <Skeleton width={140} height={12} />
            <Skeleton height={16} />
            <Skeleton width="70%" height={12} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.meta}>
              Fikk ikke hentet oversikten — dra ned for å prøve igjen.
            </Text>
          </View>
        ) : entities === null ? (
          <View style={styles.card}>
            <Text style={styles.meta}>Denne flaten er kun for Heia Ops.</Text>
          </View>
        ) : entities.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.meta}>Ingen juridiske enheter ennå.</Text>
          </View>
        ) : (
          <>
            {reviewQueue.length > 0 && (
              <>
                <Text style={styles.queueLabel}>
                  AVVIKSKONTROLL ({reviewQueue.length})
                </Text>
                {reviewQueue.map(({entity, inv}) => (
                  <View key={inv.id} style={styles.queueCard}>
                    <View style={styles.rowCenter}>
                      <UserPlus size={16} color={colors.goldInk} />
                      <Text style={styles.queueTitle}>
                        {inv.acceptedByName ?? 'Ukjent konto'} vil bli
                        betalingsansvarlig
                      </Text>
                    </View>
                    <Text style={styles.warnText}>
                      {entity.entity.legalName} · invitert som{' '}
                      {inv.invitedName} &lt;{inv.invitedEmail}&gt;
                    </Text>
                    {inv.mismatch && (
                      <Text style={styles.warnText}>
                        Kontoens e-post: {inv.mismatch.accountEmail ?? '—'} ·
                        navnematch: {inv.mismatch.nameMatch ? 'ja' : 'nei'}
                      </Text>
                    )}
                    <Text style={styles.warnText}>
                      Rollen er IKKE aktiv. Den aktiveres først når du
                      bekrefter her.
                    </Text>
                    <View style={styles.actionRow}>
                      <Button
                        title="Bekreft identiteten"
                        onPress={() => confirmReview(inv)}
                        disabled={acting}
                      />
                      <Button
                        title="Avvis"
                        variant="ghost"
                        onPress={() => rejectReview(inv)}
                        disabled={acting}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
            {entities.map(renderEntity)}
          </>
        )}
      </ScrollView>

      {/* Begrunnelsen — samme mønster for alle skrivende handlinger. */}
      <Modal
        visible={prompt !== null}
        transparent
        animationType="fade"
        onRequestClose={closePrompt}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePrompt} />
          {/* Arket er formet som et ark — avrundet topp, klistret til bunnen
              — men Modal-ens `fade` stemplet det midt på skjermen uten at det
              kom noen steder fra. Formen sa «ark», bevegelsen sa «varsel».
              Nå fader bakteppet mens selve arket GLIR opp. */}
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [
                  {
                    translateY: sheetRise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Text style={styles.sheetTitle}>{prompt?.title}</Text>
            <Text style={styles.meta}>{prompt?.message}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={note}
              onChangeText={setNote}
              multiline
              autoFocus
              placeholder={prompt?.placeholder}
              placeholderTextColor={colors.textTertiary}
              editable={!acting}
            />
            <Text style={styles.hint}>
              Teksten lagres permanent i hendelsesloggen.
            </Text>
            <Button
              title={prompt?.confirm ?? 'Bekreft'}
              onPress={confirmPrompt}
              loading={acting}
            />
            <Button title="Avbryt" variant="ghost" onPress={closePrompt} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
  entityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  entityName: {
    ...typography.heading2,
    flexShrink: 1,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  queueLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.goldInk,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  queueCard: {
    backgroundColor: colors.sun,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  queueTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.goldInk,
    flexShrink: 1,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personBlock: {
    gap: 2,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  personName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  tag: {
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
  tagAlert: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.goldInk,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
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
  warnLine: {
    ...typography.caption,
    color: colors.goldInk,
    marginTop: spacing.xs,
  },
  warnBox: {
    backgroundColor: colors.sun,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sunBorder,
    padding: spacing.md,
    marginTop: spacing.md,
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
  mismatchBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    marginTop: spacing.xs,
  },
  mismatchTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mismatchLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actionRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  form: {
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
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  logLine: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 36, 27, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.heading3,
  },
});
