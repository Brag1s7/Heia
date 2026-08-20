import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, matchColors, spacing, typography} from '../../theme';
import {MessageCircle} from '../icons';
import type {MatchEngagement} from '../../shared/matchEngagement';

/**
 * ENGASJEMENTET PÅ ETT ØYEBLIKK — HEIA og kommentarer.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ DETTE ER DEN SAMME HANDLINGEN SOM I FEEDEN. IKKE EN NY.
 *
 * Skive 4 tegnet først en egen hånd-SVG (`HeiaHand`), lånt fra prototypens
 * CSS, med den begrunnelsen at en emoji ikke kan farges mint. Begrunnelsen
 * var feil: i feeden skifter 👏-glyfen ALDRI farge — det er TEKSTEN og
 * flaten rundt som bærer på/av. Da var det aldri noe å løse, bare et nytt
 * ikon å vedlikeholde.
 *
 * Herfra arves alt fra `FeedCard`/`CommentsScreen`, som er de kanoniske
 * flatene for denne handlingen:
 *
 *   · symbolet     👏 og `MessageCircle` (14 pt), ikke en egen glyf
 *   · stemmen      `typography.action` — delt token, ikke rå tall
 *   · språket      «Heia» → «1 heier» → «2 heier», og «Kommenter» → «3»
 *   · trykket      `opacity: 0.7`
 *
 * ---------------------------------------------------------------------------
 * DET ENE SOM MÅ OVERSETTES: PÅ/AV-TILSTANDEN.
 *
 * Feeden viser «på» som en FLATE — `heiaTint`-pill med `heiaInk`-blekk. I
 * kampen finnes ingen flater; den frosne retningen sier at skillet kommer av
 * lys og luft, aldri av rammer. Tilstanden flytter derfor til blekket:
 * dempet i hvile, `colors.heia` når du har heiet. Det er den samme
 * semantikken (mint = HEIA) uttrykt i det språket kampen har.
 *
 * Glyfen står stille i begge verdener. Det er nøyaktig som i feeden.
 */

interface MatchEngagementRowProps {
  /**
   * Posten øyeblikket henger på. `undefined` i det korte vinduet mellom at et
   * ferskt mål dukker opp i forløpet og at den kanoniske posten er lest inn
   * (realtime `engagementPost` → refetch, typisk et par hundre millisekunder).
   * Da tegnes linja med hviletekstene, men knappene er ekte disabled — et
   * trykk som stille ikke gjør noe er verre enn en knapp som sier at den
   * ikke er klar.
   */
  engagement?: MatchEngagement;
  /** P1: mål imot får kommentarer, aldri HEIA. */
  canHeia: boolean;
  heiaLabel: string;
  commentLabel: string;
  /** Griddets tekstklemme — engasjementet skal skalere som resten av raden. */
  fontCap: number;
  onHeia: (postId: string, currentlyReacted: boolean) => void;
  onComment: (postId: string) => void;
}

export function MatchEngagementRow({
  engagement,
  canHeia,
  heiaLabel,
  commentLabel,
  fontCap,
  onHeia,
  onComment,
}: MatchEngagementRowProps) {
  const ready = engagement !== undefined;
  const mine = engagement?.iReacted ?? false;
  const heiaCount = engagement?.heiaCount ?? 0;
  const commentCount = engagement?.commentCount ?? 0;

  return (
    <View style={styles.row}>
      {/* ⚠️ P1: HEIA-KNAPPEN RENDRES IKKE PÅ MÅL IMOT — den er ikke
          disabled. En avslått knapp ville sagt «du kan heie hvis du får
          lov», og det er ikke beslutningen: det finnes ingen HEIA der.
          Kommentarlinja står naken igjen alene. */}
      {canHeia && (
        <Pressable
          disabled={!ready}
          onPress={() => engagement && onHeia(engagement.postId, mine)}
          hitSlop={{top: 6, bottom: 6}}
          accessibilityRole="button"
          accessibilityLabel={heiaLabel}
          // Tilstanden leses av skjermleseren, ikke av labelen — ellers sier
          // raden «heiet» to ganger på ulikt vis.
          accessibilityState={{selected: mine, disabled: !ready}}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}>
          <Text
            style={[styles.text, mine && styles.textOn]}
            maxFontSizeMultiplier={fontCap}>
            👏 {heiaCount > 0 ? `${heiaCount} heier` : 'Heia'}
          </Text>
        </Pressable>
      )}

      <Pressable
        disabled={!ready}
        onPress={() => engagement && onComment(engagement.postId)}
        hitSlop={{top: 6, bottom: 6}}
        accessibilityRole="button"
        accessibilityLabel={commentLabel}
        accessibilityState={{disabled: !ready}}
        style={({pressed}) => [styles.button, pressed && styles.pressed]}>
        <MessageCircle size={14} color={matchColors.dim} />
        <Text style={styles.text} maxFontSizeMultiplier={fontCap}>
          {commentCount > 0 ? `${commentCount}` : 'Kommenter'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // ⚠️ EKTE AVSTAND, IKKE BARE LUFT. Knappene er naboer og bærer selv
    // 44 pt bredde; med raus `hitSlop` til sidene ville treffområdene
    // OVERLAPPET, og da avgjør view-rekkefølgen hvem som fikk trykket.
    // Derfor er `hitSlop` bare topp/bunn, og dette er ekte layout.
    gap: spacing.lg,
    // Feeden bruker `spacing.lg` over reaksjonsraden. Her bærer den 44 pt
    // høye knappen mesteparten av den luften selv (innholdet sentreres),
    // så resten er `xs`.
    marginTop: spacing.xs,
  },
  button: {
    // ⚠️ 44 pt ER LAYOUT, IKKE `hitSlop` — se kommentaren på `row`.
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    // Samme innvendige avstand mellom glyf og tall som feedens pill.
    gap: 5,
  },
  // Ingen `backgroundColor`, `borderWidth` eller `borderRadius` noe sted i
  // denne fila. Det er ikke en forglemmelse — det er regelen, og den er
  // voktet som test.
  pressed: {
    // Samme trykkrespons som feedens pill (`reactPillPressed`).
    opacity: 0.7,
  },
  text: {
    ...typography.action,
    color: matchColors.dim,
  },
  // Feeden viser «på» som flate (heiaTint + heiaInk). Kampen har ingen
  // flater, så tilstanden bor i blekket — samme semantikk, kampens språk.
  textOn: {
    color: colors.heia,
  },
});
