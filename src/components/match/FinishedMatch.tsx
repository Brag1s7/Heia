import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {matchColors, radius, spacing} from '../../theme';
import {BackBar} from '../BackBar';
import {MatchPhotoRail} from '../MatchPhotoRail';
import {MatchTimeline} from '../MatchTimeline';
import {ArenaSurface} from './ArenaSurface';
import {MatchArena} from './MatchArena';
import {MatchAttendance} from './MatchAttendance';
import {MatchGround} from './MatchGround';
import {MONTHS_SHORT} from '../../shared/calendar';
import type {MatchPhoto} from '../../lib/api/feed';
import type {HeiaEventDetail, MatchEvent, User} from '../../shared/types';

/**
 * KAMPRAPPORTEN — den spilte kampen, på nøyaktig samme grunn som den live.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR EN EGEN KOMPONENT OG IKKE `MatchGround` RUNDT RETUREN
 *
 * `showReport`-grenen i `EventDetailScreen` deles med trening, sosialt,
 * kommende kamp, turnering og AVLYST kamp. Legger man verdenen rundt hele
 * returen, blir en treningsøkt grønn. Samme mønster som skive 2 valgte for
 * `LiveMatch`: kampen er sin egen flate, resten av grenen står urørt på krem.
 *
 * ---------------------------------------------------------------------------
 * DET SOM SKILLER RAPPORTEN FRA KAMPEN
 *
 * Nesten ingenting, og det er poenget: kampen du fulgte er kampen du kommer
 * tilbake til. Verdenen er den samme, bare roligere (`phase="finished"`
 * demper lagene i grunnen, ikke slukker dem — en slukket verden ville gjort
 * rapporten til en arkivside).
 *
 *   · arenaen bytter LIVE mot SLUTT, klokka mot datoen, og får SEIER-pillen
 *   · forløpet leses FORFRA («Kampens historie»), ikke nyeste først
 *   · bildestripa vises — under kampen ville den konkurrert med stillingen,
 *     etterpå er bildene det man kom tilbake for
 *   · reporterverktøyet er borte; det finnes ingen kamp å rapportere i
 *
 * ⚠️ INGEN MÅLFLOD, INGEN `useGoalMoment`. Stillingen er ferdig, og en
 * feiring som fyrer hver gang rapporten åpnes ville vært en påstand om at
 * noe skjer nå. SEIER-pillen er rapportens eneste øyeblikk — og den
 * respekterer Reduce Motion.
 */

/** «20. aug · 18:00» — datoen der klokka sto. Kort nok til klokkeslotten. */
function kickoffLabel(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
  return `${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]} · ${time}`;
}

interface FinishedMatchProps {
  event: HeiaEventDetail;
  /** Vårt lags visningsnavn. */
  teamName: string;
  /** Lagets farge — verdenens og arenaens lys. */
  teamColor: string;
  /**
   * Kampens hendelser, med STABIL REFERANSE fra skjermen (`NO_MATCH_EVENTS`).
   * En fersk tom array per render ville gjort flettememoen i `MatchTimeline`
   * verdiløs.
   */
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  reporter?: User;
  isAdmin: boolean;
  authorFor: (userId: string) => User | undefined;
  onPressPhoto: (photo: MatchPhoto) => void;
  onEdit: () => void;
}

export function FinishedMatch({
  event,
  teamName,
  teamColor,
  matchEvents,
  photos,
  reporter,
  isAdmin,
  authorFor,
  onPressPhoto,
  onEdit,
}: FinishedMatchProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const home = event.score?.home ?? 0;
  const away = event.score?.away ?? 0;

  // Standardtittelen («Kamp mot Ridabu») sier ikke mer enn arenaen rett over
  // — samme regel kampdag-flaten alt bruker. Kun en egen tittel tar plassen.
  const ownTitle =
    event.title && event.title !== `Kamp mot ${event.opponent}`
      ? event.title
      : undefined;

  return (
    <MatchGround teamColor={teamColor} phase="finished">
      {/* Fokusvakt som i ProfileHeader: uten den ville rapporten styrt
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
            phase="finished"
            dateLabel={kickoffLabel(event.startTime)}
            location={event.location}
            reporterName={reporter?.name}
          />
        </ArenaSurface>

        {(ownTitle || event.description) && (
          <View style={styles.intro}>
            {ownTitle && (
              <Text
                style={styles.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={1.6}>
                {ownTitle}
              </Text>
            )}
            {event.description && (
              <Text style={styles.description} maxFontSizeMultiplier={1.6}>
                {event.description}
              </Text>
            )}
          </View>
        )}

        {/* Kompakt inngang til bildene. De blir uansett stående i forløpet —
            dette er snarveien tilbake til dem. */}
        <MatchPhotoRail
          variant="match"
          photos={photos}
          onPressPhoto={onPressPhoto}
        />

        {(matchEvents.length > 0 || photos.length > 0) && (
          // Ingen `newestFirst`: rapporten leses forfra, fra avspark til
          // slutt. Markøren snur seg selv til «SLUTT» av samme grunn.
          <MatchTimeline
            ground
            matchEvents={matchEvents}
            photos={photos}
            startedAt={event.startedAt}
            authorFor={authorFor}
            onPressPhoto={onPressPhoto}
          />
        )}

        <MatchAttendance attendees={event.attendees.coming} />

        {/* Trenerens rettelse. Den MÅ følge med ned hit: kampsiden er eneste
            inngang til å rette en spilt kamp, så blir knappen igjen på den
            lyse flaten, finnes det ingen vei til den i det hele tatt.
            Krittkant, aldri hvit — samme språk som reporterknappene. */}
        {isAdmin && (
          <View style={styles.admin}>
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Rediger kampen"
              style={({pressed}) => [styles.edit, pressed && styles.pressed]}>
              <Text style={styles.editLabel} maxFontSizeMultiplier={1.4}>
                Rediger
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </MatchGround>
  );
}

const styles = StyleSheet.create({
  // Samme platå-mål som live-kampen: tett på kantene, luft bare der
  // underkanten buer. To ulike arenaer ville lest som to ulike kamper.
  arena: {
    marginHorizontal: 10,
    paddingTop: 14,
    paddingHorizontal: spacing.xl,
    paddingBottom: 34,
  },
  intro: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    color: matchColors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: matchColors.dim,
  },
  admin: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  edit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: matchColors.chalk,
  },
  editLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: matchColors.text,
  },
  pressed: {
    backgroundColor: 'rgba(234, 255, 246, 0.12)',
    borderColor: matchColors.chalkStrong,
  },
});
