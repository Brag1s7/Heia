import React, {useMemo} from 'react';
import {ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {matchColors, spacing} from '../../theme';
import {BackBar} from '../BackBar';
import {MatchTimeline} from '../MatchTimeline';
import {ReporterActions, type ReporterActionType} from '../ReporterActions';
import {ReporterBar} from '../ReporterBar';
import {useGoalMoment} from '../useGoalMoment';
import {ArenaSurface} from './ArenaSurface';
import {MatchArena} from './MatchArena';
import {MatchGround} from './MatchGround';
import type {MatchPhoto} from '../../lib/api/feed';
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
  /** HEIA + kommentarer per øyeblikk (skive 4) — se `MatchTimeline`. */
  renderEngagement?: (entry: {
    event?: MatchEvent;
    photo?: MatchPhoto;
  }) => React.ReactNode;
  onChangeReporter: () => void;
  onReporterAction: (type: ReporterActionType) => void;
  onPickPhoto: () => void;
  onPressPhoto: (photo: MatchPhoto) => void;
}

export function LiveMatch({
  event,
  matchEvents,
  teamName,
  teamColor,
  minute,
  reporter,
  isAdmin,
  isReporter,
  photos,
  authorFor,
  renderEngagement,
  onChangeReporter,
  onReporterAction,
  onPickPhoto,
  onPressPhoto,
}: LiveMatchProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const paused = event.matchStatus === 'halfTime';
  const home = event.score?.home ?? 0;
  const away = event.score?.away ?? 0;

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

  return (
    <MatchGround
      teamColor={teamColor}
      phase={paused ? 'paused' : 'live'}
      celebrate={celebrate}>
      {/* Fokusvakt som i ProfileHeader: uten den ville kampen styrt
          statuslinja videre på skjermer som pushes oppå den. */}
      {isFocused && <StatusBar barStyle="light-content" />}

      <BackBar title="Kampen" variant="match" />

      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
        showsVerticalScrollIndicator={false}>
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

        <View style={styles.reporterRow}>
          <ReporterBar
            variant="match"
            reporter={reporter}
            isAdmin={isAdmin}
            isMe={isReporter}
            onChangeReporter={onChangeReporter}
          />
        </View>

        {isReporter ? (
          <View style={styles.tools}>
            <ReporterActions
              variant="match"
              onAction={onReporterAction}
              isPaused={paused}
              onPhoto={onPickPhoto}
            />
          </View>
        ) : (
          // ⚠️ VAR ET HVITT KORT. «Du følger kampen direkte» sto som en
          // administrativ boks midt i kampen. Beskjeden er verdt å beholde —
          // den forklarer hvorfor det ikke finnes en oppdater-knapp — men
          // den er en fotnote, ikke et kort. Én dempet linje på grunnen.
          <Text style={styles.following} maxFontSizeMultiplier={1.5}>
            Stillingen og kampforløpet oppdaterer seg av seg selv.
          </Text>
        )}

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
      </ScrollView>
    </MatchGround>
  );
}

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
