import React, {useMemo} from 'react';
import {Animated, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useBottomContentPadding} from '../useBottomContentPadding';
import {useIsFocused} from '@react-navigation/native';
import {matchColors, spacing} from '../../theme';
import {MatchTimeline} from '../MatchTimeline';
import type {ReporterActionType} from '../ReporterActions';
import {ReporterBar} from '../ReporterBar';
import {useGoalMoment} from '../useGoalMoment';
import {ArenaSurface} from './ArenaSurface';
import {MatchArena} from './MatchArena';
import {MatchGround} from './MatchGround';
import {MatchPulse} from './MatchPulse';
import {MatchTopBar, useMatchTopBar} from './MatchTopBar';
import {ReporterDock, REPORTER_DOCK_HEIGHT} from './ReporterDock';
import {MatchToast} from './MatchToast';
import type {MatchPhoto} from '../../lib/api/feed';
import type {MatchEngagement} from '../../shared/matchEngagement';
import type {HeiaEventDetail, MatchEvent, User} from '../../shared/types';

/**
 * KAMPEN, LIVE — hele skjermen, fra statuslinje til tab-bar.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DEN BOR HER OG IKKE I `EventDetailScreen`
 *
 * Skjermen var 1490 linjer og betjente fire forskjellige ting (trening,
 * kommende kamp, live kamp, kamprapport) i ett stykke JSX. Kampen er den
 * eneste av dem som har sin egen VERDEN — egen grunn, eget blekk, egen
 * statuslinje — og å blande den inn i den lyse flaten gjorde hver endring på
 * kampen til en risiko for de tre andre.
 *
 * Det som IKKE flyttet: state, handlere, realtime, query-cachen og
 * modalene. De hører til skjermen og dens livssyklus (B2). Denne komponenten
 * er FLATEN, og tar alt den viser som props. Rutene og de tre stackene er
 * urørt.
 *
 * ---------------------------------------------------------------------------
 * INGEN HVITE FLEKKER PÅ GRØNT
 *
 * Alt som tegner seg selv lyst måtte få en kampvariant i samme slag:
 * `BackBar`, `ReporterBar`, `ReporterActions`, statuslinja, og
 * «Du følger kampen direkte», som var et hvitt kort midt i kampverdenen.
 * Hvite kort er admin-språket i Heia — de hører ikke hjemme her.
 */

interface LiveMatchProps {
  event: HeiaEventDetail;
  /** Vårt lags visningsnavn. */
  teamName: string;
  /** Lagets farge — verdenens og arenaens lys. */
  teamColor: string;
  /**
   * Kampminuttet NÅ, regnet ut ÉN gang av skjermen.
   *
   * ⚠️ Alt som viser kampminuttet arver denne. Ingen komponent under her
   * kaller `Date.now()`.
   */
  minute?: number;
  /**
   * Klokkeslettet NÅ, fra SAMME tick som `minute` (P2).
   *
   * ⚠️ TO TALL, TO AKSER, MED VILJE. `minute` er FAKTISK SPILT TID og er en
   * etikett; `nowMs` er klokketid og er en POSISJON. Etter 00073 hopper ikke
   * spilt tid over pausen, mens hendelsenes `created_at` gjør det — brukes
   * `minute` til å plassere noe på pulsen, havner det for langt til venstre.
   */
  nowMs?: number;
  reporter?: User;
  isAdmin: boolean;
  isReporter: boolean;
  /**
   * Kampens hendelser. Kommer som prop med STABIL REFERANSE fra skjermen
   * (`NO_MATCH_EVENTS`), ikke som `event.matchEvents ?? []`: en fersk tom
   * array per render ville gjort hver memo her inne verdiløs — og
   * minuttickeren re-rendrer skjermen hvert 30. sekund.
   */
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  authorFor: (userId: string) => User | undefined;
  /**
   * HEIA + kommentarer per øyeblikk (skive 4), som oppslag.
   *
   * Pulsen leser HEIA-summene HERFRA i stedet for å hente dem på nytt — det
   * er de samme tallene engasjementslinjene i forløpet viser, og to kilder
   * kunne vist ulikt antall heier på det samme målet i samme scroll.
   */
  engagement: {
    byMatchEvent: Map<string, MatchEngagement>;
    byPost: Map<string, MatchEngagement>;
  };
  /** HEIA + kommentarer per øyeblikk (skive 4) — se `MatchTimeline`. */
  renderEngagement?: (entry: {
    event?: MatchEvent;
    photo?: MatchPhoto;
  }) => React.ReactNode;
  onChangeReporter: () => void;
  onReporterAction: (type: ReporterActionType) => void;
  onPickPhoto: () => void;
  onPressPhoto: (photo: MatchPhoto) => void;
  /**
   * Reporterdokken er åpen (skive 10). Styres av RAPPORTER-knappen i
   * tab-baren; tilstanden bor i `EventDetailScreen` som alt annet her.
   */
  reporterDockOpen?: boolean;
  /** Dokken ble dratt ned. */
  onCloseReporterDock?: () => void;
  /**
   * Kvitteringen på reporterens EGEN handling — «Mål registrert» osv.
   * `null` = ingenting å vise. Se `MatchToast`.
   */
  toast?: string | null;
  onToastHidden?: () => void;
}

export function LiveMatch({
  event,
  matchEvents,
  teamName,
  teamColor,
  minute,
  nowMs,
  reporter,
  isAdmin,
  isReporter,
  photos,
  authorFor,
  engagement,
  renderEngagement,
  onChangeReporter,
  onReporterAction,
  onPickPhoto,
  onPressPhoto,
  reporterDockOpen = false,
  onCloseReporterDock,
  toast = null,
  onToastHidden,
}: LiveMatchProps) {
  // Kapselen ligger over kampforløpet: barhøyde + pust, safe area telles
  // én gang (inne i barhøyden). Se `useBottomContentPadding`.
  const bottomPad = useBottomContentPadding(spacing['3xl']);
  const isFocused = useIsFocused();

  const paused = event.matchStatus === 'halfTime';
  const home = event.score?.home ?? 0;
  const away = event.score?.away ?? 0;

  // Toppflaten som blir stillingen når arenaen ruller ut av bildet. All
  // mekanikk ligger i `useMatchTopBar` — se den for hvorfor båndet MÅLES og
  // hvorfor terskelen bor i en ref.
  const topBar = useMatchTopBar();

  // Omgangen leses av forløpet, ikke av klokka. Det er den ENESTE kilden vi
  // har i dag som er sann: `andre_omgang` skrives av reporteren, mens et
  // minutt-tall ikke sier noe om hvilken omgang det tilhører før kampuret
  // blir serverautoritativt (P2, skive 7).
  const secondHalf = useMemo(
    () => matchEvents.some(e => e.type === 'andre_omgang'),
    [matchEvents],
  );

  // ÉN kilde til måløyeblikket: spretten på tallet og floden over verdenen
  // fyrer fra samme endring. To `useGoalMoment` ville gitt to animasjoner
  // som drifter fra hverandre.
  const {scoreScale, celebrate} = useGoalMoment(home, away);

  /**
   * ⚠️ KONSTANT. DETTE VAR ÅRSAKEN TIL AT DOKKEN «KOM HAKKETE OPP» OG
   * «HOPPET STYGT NED» (Brage 2026-08-21, tredje telefonrunde).
   *
   * Padding-en var `… + (reporterDockOpen ? DOCK_HEIGHT : 0)` i et INLINE
   * objekt. Da endret innholdshøyden seg i NØYAKTIG det øyeblikket dokken
   * animerte: `ScrollView` måtte måle og legge ut hele kampforløpet på nytt
   * mens en animasjon kjørte på samme skjerm. En layout-pass som slåss med
   * en animasjon blir hakk — hver gang, uansett hvor pen easing-en er.
   *
   * Plassen RESERVERES derfor permanent for reporteren. Hun har dokken
   * tilgjengelig hele kampen; at forløpet har litt ekstra luft i bunnen når
   * den er lukket, koster ingenting. Tilskuere får den ikke i det hele tatt.
   *
   * At objektet i tillegg er memoisert er den andre halvparten: et nytt
   * objekt per render ville gitt `ScrollView` en ny `contentContainerStyle`
   * ved hvert minutt-tick.
   */
  const scrollPad = useMemo(
    () => ({
      paddingBottom: bottomPad + (isReporter ? REPORTER_DOCK_HEIGHT : 0),
    }),
    [bottomPad, isReporter],
  );

  return (
    <MatchGround
      teamColor={teamColor}
      phase={paused ? 'paused' : 'live'}
      celebrate={celebrate}>
      {/* Fokusvakt som i ProfileHeader: uten den ville kampen styrt
          statuslinja videre på skjermer som pushes oppå den. */}
      {isFocused && <StatusBar barStyle="light-content" />}

      {/* TOPPFLATEN. Navlinja og stillingen er SAMME rad — se `MatchTopBar`
          for hvorfor runde 1s `stickyHeaderIndices` ikke kunne bli myk. */}
      <MatchTopBar
        progress={topBar.progress}
        shown={topBar.shown}
        homeTeam={teamName}
        awayTeam={event.opponent ?? ''}
        homeScore={home}
        awayScore={away}
        phase={paused ? 'paused' : 'live'}
        minute={minute}
      />

      <Animated.ScrollView
        contentContainerStyle={scrollPad}
        onScroll={topBar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        {/* ⚠️ ARENAEN MÅLER SEG SELV. Krysstoningens bånd legges der
            stillingen forlater toppen, og den høyden er ikke den samme i en
            live kamp som i en rapport — eller med stor tekst. */}
        <View onLayout={topBar.onArenaLayout}>
          <ArenaSurface teamColor={teamColor} style={styles.arena}>
            <MatchArena
              homeTeam={teamName}
              awayTeam={event.opponent ?? ''}
              homeScore={home}
              awayScore={away}
              teamColor={teamColor}
              phase={paused ? 'paused' : 'live'}
              minute={minute}
              secondHalf={secondHalf}
              location={event.location}
              reporterName={reporter?.name}
              scoreScale={scoreScale}
            />
          </ArenaSurface>
        </View>

        <View style={styles.reporterRow}>
          <ReporterBar
            variant="match"
            reporter={reporter}
            isAdmin={isAdmin}
            isMe={isReporter}
            onChangeReporter={onChangeReporter}
          />
        </View>

        {/* ⚠️ REPORTERPANELET LIGGER IKKE LENGER HER (skive 10).
            Det var en fast blokk midt på siden, altså et sted man måtte
            scrolle for å nå kampens mest tidskritiske handling. Verktøyet bor
            nå i `ReporterDock`, som RAPPORTER-knappen i tab-baren åpner —
            der tommelen allerede er.

            Og det står INGENTING her i stedet. Prototypen har ingen
            hintetekst til reporteren; den sentrale knappen forklarer seg
            selv. Å skrive «bruk knappen nederst» ville vært å finne opp
            produktspråk, som er nettopp det autoritetsregelen forbyr.

            Publikums linje står uendret — den forklarer hvorfor det ikke
            finnes en oppdater-knapp, og den er en godkjent beslutning fra
            skive 2 (den erstattet et hvitt «du følger kampen»-kort). */}
        {!isReporter && (
          <Text style={styles.following} maxFontSizeMultiplier={1.5}>
            Stillingen og kampforløpet oppdaterer seg av seg selv.
          </Text>
        )}

        {/* KAMPENS PULS — det tredje rommet, rett over forløpet. Den ligger
            her og ikke rett under arenaen fordi den er PORTEN inn i kampens
            historie: gullprikken i forløpets eyebrow markerer nettopp det
            skiftet, og krittstreken nederst i pulsen leder blikket dit. */}
        <MatchPulse
          matchEvents={matchEvents}
          photos={photos}
          startedAt={event.startedAt}
          engagement={engagement}
          phase={paused ? 'paused' : 'live'}
          minute={minute}
          nowMs={nowMs}
          authorFor={authorFor}
        />

        {/* Kampforløpet — bildene ligger i forløpet, ikke i en egen seksjon.
            Under kampen skal ingenting konkurrere med stillingen.
            `ground` tegner det fjerde rommet; den lokale mørke flaten fra
            skive 1 er borte. */}
        <MatchTimeline
          ground
          matchEvents={matchEvents}
          photos={photos}
          startedAt={event.startedAt}
          newestFirst
          nowMinute={minute}
          authorFor={authorFor}
          renderEngagement={renderEngagement}
          onPressPhoto={onPressPhoto}
        />
      </Animated.ScrollView>

      {/* Reporterens verktøy, over grunnen og rett under tab-baren.
          Rendres kun for reporteren — en tilskuer skal ikke ha den i treet
          i det hele tatt. */}
      {isReporter && (
        <ReporterDock
          open={reporterDockOpen}
          onAction={onReporterAction}
          isPaused={paused}
          onPhoto={onPickPhoto}
          onClose={onCloseReporterDock ?? noop}
        />
      )}

      {/* Kvitteringen ligger OVER dokken: den kommer i det dokken glir ned,
          og skal ikke ligge bak den i det halve sekundet de overlapper. */}
      <MatchToast message={toast} onHidden={onToastHidden ?? noop} />
    </MatchGround>
  );
}

/** Stabil identitet: en fersk pilfunksjon per render ville revet memoene. */
const noop = () => {};

const styles = StyleSheet.create({
  // Arenaen er et platå i verdenen, ikke et kort i en liste: den ligger tett
  // på kantene og har luft bare der underkanten buer.
  arena: {
    marginHorizontal: 10,
    paddingTop: 14,
    paddingHorizontal: spacing.xl,
    paddingBottom: 34,
  },
  reporterRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  tools: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  following: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: matchColors.dim,
  },
});
