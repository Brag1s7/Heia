import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {matchColors, spacing} from '../../theme';
import {Avatar} from '../Avatar';
import type {EventAttendee} from '../../shared/types';

/**
 * HVEM SOM VAR MED — påmeldingen etter at kampen er spilt.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR DEN IKKE ER EN LISTE
 *
 * På en kommende kamp er påmeldingen en HANDLING: hvem mangler svar, hvem må
 * purres. Da er radene riktige. På en spilt kamp er den et FAKTUM — hvem som
 * var der — og en radtabell med hvite linjer midt i kampverdenen er akkurat
 * det admin-språket den frosne retningen holder ute. Fasitens eget uttrykk for
 * en gruppe mennesker på arenaen er ansikter på rad (`.a-crowd`), og det er
 * det denne stripa er.
 *
 * Prisen, bevisst tatt: «Meldt av <forelder>» på et barn vises ikke her. Det
 * er en administrativ opplysning som hører til FØR kampen, og der står den
 * fortsatt (kommende kamp beholder listen sin).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ RINGEN RUNDT ANSIKTENE ER GJENNOMSIKTIG, IKKE GRUNNFARGEN.
 *
 * Overlappende ansikter trenger en kant for å skille seg fra hverandre, og
 * prototypen løser det med `border: 2px solid var(--arena-b)` — altså flaten
 * malt tilbake. Det er nøyaktig fella fra skive 2.2: en flat farge som var
 * riktig så lenge den lå på sin egen flate, og som ble en plate i FEIL farge
 * da grunnen tok over. Her er ringen et scrim (mørk med alfa), så den demper
 * det som ligger under uansett hvilken tone stripa havner på.
 */

/** Så mange ansikter før resten blir «+N». */
const FACES = 5;

interface MatchAttendanceProps {
  attendees: EventAttendee[];
}

export function MatchAttendance({attendees}: MatchAttendanceProps) {
  if (attendees.length === 0) return null;

  const names = attendees.map(a => a.childName ?? a.name);
  const shown = attendees.slice(0, FACES);
  const rest = attendees.length - shown.length;

  return (
    // ÉN GRUPPE = ETT STOPP. Uten dette blir hver avatar og hvert navn sitt
    // eget stopp, og en VoiceOver-bruker må sveipe gjennom hele stallen for å
    // komme videre i rapporten.
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Påmeldt, ${attendees.length}. ${names.join(', ')}.`}>
      <Text
        style={styles.eyebrow}
        importantForAccessibility="no"
        accessibilityElementsHidden
        maxFontSizeMultiplier={1.6}>
        {`Påmeldt · ${attendees.length}`}
      </Text>

      <View
        style={styles.faces}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {shown.map((attendee, index) => (
          <View
            key={`${attendee.id}-${attendee.childName ?? 'selv'}`}
            style={[styles.face, index > 0 && styles.faceStacked]}>
            <Avatar name={attendee.childName ?? attendee.name} size="sm" />
          </View>
        ))}
        {rest > 0 && (
          <View style={[styles.face, styles.faceStacked, styles.more]}>
            <Text style={styles.moreText} maxFontSizeMultiplier={1.3}>
              {`+${rest}`}
            </Text>
          </View>
        )}
      </View>

      {/* Navnene i sin helhet, ikke klippet: rapporten er det eneste stedet
          de står etter kampen, og en avkortet liste ville gjort noen usynlige
          uten at det finnes en «vis alle» å trykke på. */}
      <Text
        style={styles.names}
        importantForAccessibility="no"
        accessibilityElementsHidden
        maxFontSizeMultiplier={1.6}>
        {names.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderRadius: 18,
    borderWidth: 2,
    // Scrim, ikke grunnfarge — se filhodet.
    borderColor: 'rgba(8, 27, 19, 0.55)',
  },
  faceStacked: {
    marginLeft: -9,
  },
  more: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 255, 246, 0.16)',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '800',
    color: matchColors.text,
  },
  names: {
    fontSize: 13,
    lineHeight: 20,
    color: matchColors.dim,
  },
});
