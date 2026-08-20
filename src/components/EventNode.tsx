import React from 'react';
import {View, StyleSheet} from 'react-native';
import {colors, matchColors} from '../theme';
import type {MatchGrid} from '../shared/matchGridGeometry';
import {
  ArrowLeftRight,
  Ball,
  BookingCard,
  Camera,
  Flag,
  MessageCircle,
  PauseSolid,
  PlaySolid,
} from './icons';
import type {MatchEventType} from '../shared/types';

/**
 * ÉN NODE PÅ KRITTLINJA — «hva som skjedde».
 *
 * Delt av `MatchEventRow` og bilderaden i `MatchTimeline`. Før lå den samme
 * 32pt-sirkelen i to pikselidentiske kopier i de to filene; det er grunnen
 * til at denne finnes.
 *
 * ---------------------------------------------------------------------------
 * SEMANTIKKEN ER LÅST — flatene kan bytte, språket ikke:
 *
 *   · Ballen betyr MÅL og ingenting annet.
 *   · Kun mål for OSS feires (mint + gulldetalj + glød).
 *   · Mål imot er informasjon — skifer, dempet. Ingen feiring, ingen HEIA,
 *     og ALDRI coral: coral betyr LIVE og ingenting annet.
 *   · Noden sier HVA. Avataren ved siden av sier HVEM.
 *
 * Ikonene er appens egne (Lucide + `Ball`/`BookingCard`). Ingen emoji, ingen
 * ny familie — alle åtte finnes allerede i `icons.tsx`.
 */

export type NodeKind =
  | 'goalUs'
  | 'goalThem'
  | 'update'
  | 'photo'
  | 'kick'
  | 'pause'
  | 'end'
  | 'swap'
  | 'card';

/**
 * Oversetter en serverhendelse til nodetype. Bevisst uttømmende switch uten
 * `default`: en ny `MatchEventType` skal gi typefeil her, ikke en stille
 * nøytral node.
 */
export function nodeKindFor(
  type: MatchEventType,
  teamSide?: 'home' | 'away',
): NodeKind {
  switch (type) {
    case 'mål':
      // teamSide mangler (skal ikke skje etter 00020) → dempet som mål imot.
      // Bedre å underfeire eget mål enn å feire motstanderens.
      return teamSide === 'home' ? 'goalUs' : 'goalThem';
    case 'avspark':
    case 'andre_omgang':
      return 'kick';
    case 'pause':
      return 'pause';
    case 'slutt':
      return 'end';
    case 'bytte':
      return 'swap';
    case 'kort':
      return 'card';
    case 'melding':
      return 'update';
  }
}

interface NodeSkin {
  bg: string;
  ink: string;
  /** Liten gulldetalj oppe til høyre — kun mål for oss. */
  goldDot?: boolean;
  /** Mint-glød rundt sirkelen — feiringen, rasjonert. */
  glow?: string;
  /** Ring i stedet for fylt flate — kampen lukkes, den feires ikke. */
  ring?: boolean;
}

const SKIN: Record<NodeKind, NodeSkin> = {
  goalUs: {
    bg: colors.heiaTint,
    ink: colors.heiaInk,
    goldDot: true,
    glow: 'rgba(2, 255, 171, 0.45)',
  },
  goalThem: {bg: matchColors.opponentNode, ink: matchColors.opponentInk},
  update: {bg: colors.gold, ink: colors.goldInk, glow: 'rgba(255, 197, 61, 0.4)'},
  photo: {bg: 'rgba(234, 255, 246, 0.92)', ink: colors.heiaDeep},
  kick: {bg: 'rgba(234, 255, 246, 0.15)', ink: matchColors.text},
  pause: {bg: 'rgba(255, 197, 61, 0.2)', ink: colors.gold},
  end: {bg: 'rgba(234, 255, 246, 0.14)', ink: matchColors.text, ring: true},
  card: {bg: 'rgba(255, 197, 61, 0.16)', ink: colors.gold},
  swap: {bg: 'rgba(234, 255, 246, 0.15)', ink: matchColors.text},
};

function glyphFor(kind: NodeKind, size: number, color: string) {
  switch (kind) {
    case 'goalUs':
    case 'goalThem':
      return <Ball size={size + 1} color={color} strokeWidth={1.9} />;
    case 'update':
      return <MessageCircle size={size} color={color} strokeWidth={2} />;
    case 'photo':
      return <Camera size={size} color={color} strokeWidth={1.9} />;
    case 'kick':
      // Fylt, ikke outline — se PlaySolid/PauseSolid i icons.tsx.
      return <PlaySolid size={size} color={color} />;
    case 'pause':
      return <PauseSolid size={size} color={color} />;
    case 'end':
      return <Flag size={size} color={color} strokeWidth={1.9} />;
    case 'swap':
      return <ArrowLeftRight size={size} color={color} strokeWidth={2} />;
    case 'card':
      // BookingCard tegner sin egen gule/mørke geometri — ingen color-prop.
      return <BookingCard size={size + 1} />;
  }
}

interface EventNodeProps {
  kind: NodeKind;
  grid: MatchGrid;
  /**
   * Loddrett plassering, målt fra radens topp. Noden posisjoneres ABSOLUTT
   * i raden, aldri i en flex-kolonne — det er det som holder den på
   * krittlinja uansett hvor høyt innholdet er.
   */
  top?: number;
}

export function EventNode({kind, grid, top = 0}: EventNodeProps) {
  const skin = SKIN[kind];
  const r = grid.nodeSize / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.node,
        {
          left: grid.railLeft,
          top,
          width: grid.nodeSize,
          height: grid.nodeSize,
          borderRadius: r,
          backgroundColor: skin.bg,
        },
        skin.ring && styles.ring,
        // Glød er rasjonert i Heia. Målet for oss og reporterens stemme er
        // to av de reserverte stedene.
        skin.glow ? styles.glow : null,
        skin.glow ? {shadowColor: skin.glow} : null,
      ]}>
      {glyphFor(kind, grid.iconSize, skin.ink)}
      {skin.goldDot && (
        <View
          style={[
            styles.goldDot,
            // Kanten som løfter prikken av mint-sirkelen er GRUNNEN, ikke
            // hvit. På den mørke flaten ville hvit lest som et hull.
            {borderColor: matchColors.timeline},
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // Noden maler OVER krittlinja. Rekkefølgen i JSX gjør jobben på iOS,
    // men Android trenger et eksplisitt løft — negativ zIndex er upålitelig
    // der, så alt som skal ligge bak får 0 og noden får 2.
    zIndex: 2,
  },
  glow: {
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  ring: {
    borderWidth: 1,
    borderColor: matchColors.chalkStrong,
  },
  goldDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.gold,
    borderWidth: 2,
  },
});
