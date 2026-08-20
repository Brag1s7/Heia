import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {colors, fonts, matchColors, radius, spacing} from '../../theme';
import {LiveBadge} from '../LiveBadge';
import {TeamBadge} from '../TeamBadge';
import {matchScoreA11yLabel} from '../../shared/matchCopy';

/**
 * ARENAEN — kampens hode på sin egen flate.
 *
 * Innholdet er TYPE PÅ FLATEN, ikke chips og kort: status og klokke øverst,
 * lagene og stillingen i midten, «hvor · hvem · når» som én linje under. Den
 * frosne retningen er at rommene skilles av tone og lys — arenaen har derfor
 * ingen bokser inni seg heller.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ KLOKKA KOMMER ALLTID SOM PROP.
 *
 * «Alt som viser kampminuttet må oppdateres fra samme kilde i samme tick.»
 * Prototypens ene ekte bug var at hodet viste 40′ mens pulsen sto på 37′,
 * fordi tickeren bare oppdaterte den ene. Ingenting her inne kaller
 * `Date.now()` eller `setInterval`.
 *
 * ⚠️ MINUTTET VISES IKKE I PAUSE. Klokka i appen teller fortsatt under pause
 * (serveren regner `now() - started_at`, se P2), så et tall der ville vært
 * feil. «Etter 1. omgang» er sant uansett. Når kampuret blir
 * serverautoritativt (skive 7) kan tallet komme tilbake.
 */

interface MatchArenaProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  /** Lagets farge — arenaens lys, klemt av `arenaLightCap` i flaten. */
  teamColor: string;
  paused: boolean;
  /** Kampminuttet NÅ. Prop, aldri egen utregning. */
  minute?: number;
  /** Er andre omgang i gang? Utledes av kampforløpet hos kalleren. */
  secondHalf?: boolean;
  location?: string;
  /** Reporterens navn — «Jarle rapporterer». */
  reporterName?: string;
  /** Målspretten fra `useGoalMoment`. Eies av kalleren, delt med floden. */
  scoreScale?: Animated.Value;
}

/** Motstandermerket: initialer på skifer. Aldri lagfarge, aldri coral. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

export function MatchArena({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  teamColor,
  paused,
  minute,
  secondHalf,
  location,
  reporterName,
  scoreScale,
}: MatchArenaProps) {
  const {width, fontScale} = useWindowDimensions();

  // ⚠️ DYNAMIC TYPE XXL PÅ DET STORE TALLET (handoffens punkt 7).
  // Fasitens 78 px score i tre kolonner sprenger på 430 pt med stor tekst.
  // To grep, i denne rekkefølgen: tallet krymper med skjermbredden, og over
  // en terskel forlater det midtkolonnen og legger seg på egen linje over
  // lagene. Da får begge lagnavn hele bredden i stedet for å bli klippet.
  const crest = width < 360 ? 52 : width < 390 ? 58 : 64;
  const scoreFont = width < 360 ? 46 : width < 390 ? 54 : 62;
  const stacked = fontScale >= 1.35 || width < 340;

  const clock = paused
    ? `Etter ${secondHalf ? '2.' : '1.'} omgang`
    : `${secondHalf ? '2.' : '1.'} omgang · ${minute ?? 0}′`;
  const clockLabel = paused
    ? `Pause etter ${secondHalf ? 'andre' : 'første'} omgang`
    : `${secondHalf ? 'Andre' : 'Første'} omgang, ${
        minute ?? 0
      } minutter spilt`;

  const score = (
    <Animated.Text
      style={[
        styles.score,
        {fontSize: scoreFont},
        !paused && styles.scoreGlow,
        scoreScale ? {transform: [{scale: scoreScale}]} : null,
      ]}
      maxFontSizeMultiplier={1.25}
      numberOfLines={1}
      adjustsFontSizeToFit>
      {homeScore}–{awayScore}
    </Animated.Text>
  );

  const usColumn = (
    <View style={styles.col}>
      <TeamBadge
        size={crest}
        cornerRadius={radius.xl}
        fontSize={crest * 0.3}
        logoPlate
        name={homeTeam}
        style={styles.usPlate}
      />
      <Text
        style={styles.teamName}
        maxFontSizeMultiplier={1.4}
        numberOfLines={2}>
        {homeTeam}
      </Text>
      {/* Lagets strek — lokalt lys rundt identiteten, aldri under tekst. */}
      <View style={[styles.rule, {backgroundColor: teamColor}]} />
    </View>
  );

  const themColumn = (
    <View style={styles.col}>
      <View style={[styles.themPlate, {width: crest - 4, height: crest - 4}]}>
        <Text style={styles.themInitials} maxFontSizeMultiplier={1.2}>
          {initials(awayTeam)}
        </Text>
      </View>
      <Text
        style={styles.teamName}
        maxFontSizeMultiplier={1.4}
        numberOfLines={2}>
        {awayTeam}
      </Text>
      <View style={[styles.rule, styles.ruleThem]} />
    </View>
  );

  const meta = [
    location,
    reporterName ? `${reporterName.split(' ')[0]} rapporterer` : null,
  ].filter(Boolean) as string[];

  return (
    <View>
      <View style={styles.top}>
        <LiveBadge paused={paused} />
        <Text
          style={styles.clock}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={clockLabel}>
          {clock}
        </Text>
      </View>

      {/* ÉN HENDELSE = ÉTT STOPP gjelder også her: stillingen leses som en
          setning, ikke som «Ham-Kam», «2», «–», «1», «Ridabu». */}
      <View
        accessible
        accessibilityLabel={matchScoreA11yLabel({
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
        })}
        style={stacked ? styles.teamsStacked : styles.teams}>
        {stacked ? (
          <>
            <View style={styles.scoreStacked}>{score}</View>
            <View style={styles.teamsRowStacked}>
              {usColumn}
              {themColumn}
            </View>
          </>
        ) : (
          <>
            {usColumn}
            {score}
            {themColumn}
          </>
        )}
      </View>

      {meta.length > 0 && (
        <View
          style={styles.meta}
          accessible
          accessibilityLabel={meta.join('. ')}>
          {meta.map((part, i) => (
            <React.Fragment key={part}>
              {i > 0 && <Text style={styles.metaSep}>·</Text>}
              <Text style={styles.metaText} maxFontSizeMultiplier={1.5}>
                {part}
              </Text>
            </React.Fragment>
          ))}
          {!paused && (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaNow} maxFontSizeMultiplier={1.5}>
                nå
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 26,
  },
  clock: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: matchColors.text,
    opacity: 0.9,
    flexShrink: 1,
    textAlign: 'right',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  teamsStacked: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  scoreStacked: {
    alignItems: 'center',
  },
  teamsRowStacked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  usPlate: {
    // Hvit plate bak logoen mot den mørke flaten — samme regel som
    // ScoreBoard, bare større.
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  themPlate: {
    borderRadius: radius.xl,
    backgroundColor: matchColors.opponent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  themInitials: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: 'rgba(255, 255, 255, 0.94)',
  },
  teamName: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
    color: matchColors.text,
  },
  rule: {
    width: 30,
    height: 3.5,
    borderRadius: 2,
  },
  ruleThem: {
    backgroundColor: matchColors.opponent,
  },
  score: {
    fontFamily: fonts.display,
    color: colors.heia,
    letterSpacing: -3,
    paddingTop: 2,
    includeFontPadding: false,
  },
  scoreGlow: {
    textShadowColor: 'rgba(2, 255, 171, 0.5)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 26,
  },
  meta: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  metaText: {
    fontSize: 12.5,
    color: matchColors.dim,
  },
  metaSep: {
    fontSize: 12.5,
    color: matchColors.dim,
    opacity: 0.4,
  },
  metaNow: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.heia,
  },
});
