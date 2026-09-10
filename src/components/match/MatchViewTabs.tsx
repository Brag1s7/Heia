import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radius} from '../../theme';
import {LiquidGlassSurface} from '../LiquidGlassSurface';

/**
 * VISNINGSFANENE — Referat · Hendelser · Bilder · Info.
 *
 * En segmentert kontroll (HIG: bytte mellom visninger av SAMME innhold),
 * ikke en ny navigasjon. Flaten er appens lyse `bar`-frost — samme materiale
 * som tab-kapselen — og valgt segment er mint med Heia-blekk. Den står fast
 * under den kompakte scorelinja når toppen ruller ut (`MatchChrome`), så man
 * kan bytte visning mens man leser.
 *
 * Samme post har samme identitet, reaksjoner og tråd i alle visningene —
 * fanene FILTRERER, de lager aldri parallelle innlegg.
 */

export type MatchViewKey = 'referat' | 'hendelser' | 'bilder' | 'info';

export const MATCH_VIEWS: ReadonlyArray<{key: MatchViewKey; label: string}> = [
  {key: 'referat', label: 'Referat'},
  {key: 'hendelser', label: 'Hendelser'},
  {key: 'bilder', label: 'Bilder'},
  {key: 'info', label: 'Info'},
];

/** Kontrollens høyde — chromen regner med den. */
export const MATCH_VIEW_TABS_H = 48;

interface MatchViewTabsProps {
  value: MatchViewKey;
  onChange: (next: MatchViewKey) => void;
}

export function MatchViewTabs({value, onChange}: MatchViewTabsProps) {
  return (
    <LiquidGlassSurface
      variant="bar"
      cornerRadius={MATCH_VIEW_TABS_H / 2}
      style={styles.surface}>
      <View style={styles.row} accessibilityRole="tablist">
        {MATCH_VIEWS.map(v => {
          const on = v.key === value;
          return (
            <Pressable
              key={v.key}
              onPress={() => onChange(v.key)}
              accessibilityRole="tab"
              accessibilityState={{selected: on}}
              accessibilityLabel={v.label}
              hitSlop={{top: 4, bottom: 4}}
              style={({pressed}) => [
                styles.segment,
                on && styles.segmentOn,
                pressed && !on && styles.segmentPressed,
              ]}>
              <Text
                style={[styles.label, on && styles.labelOn]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}>
                {v.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: MATCH_VIEW_TABS_H,
    padding: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  segmentOn: {
    backgroundColor: colors.heia,
  },
  segmentPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelOn: {
    fontWeight: '800',
    color: colors.heiaDeep,
  },
});
