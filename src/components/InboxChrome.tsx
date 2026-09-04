import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {colors, typography, spacing, radius} from '../theme';

/**
 * Frostpillen på dagslysgrunnens mørke topp — SAMME materiale som ukeradens
 * plater i kalenderchromen (DayCell `STADIUM_CELL`: stadionblekk 0,08 +
 * hårlinje 0,16, trykket 0,16). Platene vant blant fem riggede varianter
 * (Brage 2026-09-03: «definisjon, rytme og avgrensning uten å bli bokser»),
 * så en handling i samme sone får samme plate. Kopiert, ikke importert —
 * `__tests__/inboxChrome.test.tsx` vokter likheten.
 */
export const STADIUM_PILL = {
  plate: 'rgba(234, 255, 246, 0.08)',
  plateEdge: 'rgba(234, 255, 246, 0.16)',
  platePressed: 'rgba(234, 255, 246, 0.16)',
  text: colors.stadiumText,
} as const;

/** Pillen er 32 pt + 8 pt luft over og under. Chromen er ALDRI lavere enn
 *  dette — heller ikke når pillen er borte (se `bar`). */
export const INBOX_CHROME_HEIGHT = 32 + 2 * spacing.sm;

interface InboxChromeProps {
  /** Det som ER sant nå — «3 nye fra Stange G10», «Du er oppdatert»,
   *  «Alt som skjer i Stange G10». Chromens tittel; fanen heter Varsler. */
  status: string;
  /** «Merk alle som lest». Utelatt (ingen uleste) = ingen pille. */
  onMarkAll?: () => void;
}

/**
 * Varsler-chromen: liten, FAST, under laghodet, utenfor lista (Brage
 * 2026-09-04 — samme grep som kalenderchromen). Ingen stor «Varsler»-tittel
 * som ruller bort: fanen heter Varsler, statuslinja er chromens tittel.
 *
 * Chromen er innhold på lerretet: ingen flate, ingen kant. Den står i
 * reisens mørke topp, så alt blekk i den er stadionblekk — den gamle
 * `heiaInk`-handlingen (#087A5A) sto der med 2,2:1.
 *
 * Høyden endrer seg ALDRI: pillen kommer og går med uleste, men raden holder
 * `minHeight`, så lista under aldri hopper når du merker alt som lest.
 */
export function InboxChrome({status, onMarkAll}: InboxChromeProps) {
  return (
    <View style={styles.bar}>
      <Text
        style={styles.status}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
        accessibilityRole="header">
        {status}
      </Text>

      {onMarkAll && (
        <Pressable
          onPress={onMarkAll}
          // Trykkflaten, ikke høyden: 48 pt uten å røre layouten.
          hitSlop={{top: 8, bottom: 8, left: 6, right: 6}}
          accessibilityRole="button"
          accessibilityLabel="Merk alle varsler som lest"
          style={({pressed}) => [styles.pill, pressed && styles.pillPressed]}>
          <Text style={styles.pillText} maxFontSizeMultiplier={1.4}>
            Merk alle som lest
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: INBOX_CHROME_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // Samme størrelse som kalenderchromens månedstittel (18 pt), men i
  // systemfonten: dette er en setning, ikke et tall.
  status: {
    flex: 1,
    ...typography.heading3,
    color: colors.stadiumText,
  },
  pill: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: STADIUM_PILL.plateEdge,
    backgroundColor: STADIUM_PILL.plate,
  },
  pillPressed: {
    backgroundColor: STADIUM_PILL.platePressed,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: STADIUM_PILL.text,
  },
});
