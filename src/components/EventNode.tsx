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
  /** Mint-glød rundt sirkelen — feiringen, rasjonert. */
  glow?: string;
  /** Kantfarge. Gjør en transparent flate til en definert node. */
  border?: string;
}

const SKIN: Record<NodeKind, NodeSkin> = {
  // ⚠️ INGEN PERMANENT GULLPRIKK PÅ MÅLNODEN (Brage, telefontest 2026-08-20).
  // Prototypen har en gulldetalj oppe til høyre. På telefon med ekte data
  // leste den som et stående BADGE — «noe er merket her» — i stedet for som
  // feiring. Gulldetaljen hører hjemme i MÅLTENNINGEN: et kort blink når
  // målet skjer, som forsvinner. Til den animasjonen finnes (skive 5/6) er
  // den fjernet helt, ikke stående statisk.
  goalUs: {
    bg: colors.heiaTint,
    ink: colors.heiaInk,
    glow: 'rgba(2, 255, 171, 0.45)',
  },
  goalThem: {bg: matchColors.opponentNode, ink: matchColors.opponentInk},
  // Reporterens stemme er GULL, men dempet: en heldekkende gullskive
  // konkurrerte med målet om blikket, og det er målet som skal vinne.
  // Transparent flate + gullkant + gullikon holder semantikken uten volumet.
  update: {
    bg: 'rgba(255, 197, 61, 0.16)',
    ink: colors.gold,
    border: 'rgba(255, 197, 61, 0.55)',
  },
  photo: {bg: 'rgba(234, 255, 246, 0.92)', ink: colors.heiaDeep},
  kick: {bg: 'rgba(234, 255, 246, 0.15)', ink: matchColors.text},
  pause: {bg: 'rgba(255, 197, 61, 0.2)', ink: colors.gold},
  end: {
    bg: 'rgba(234, 255, 246, 0.14)',
    ink: matchColors.text,
    border: matchColors.chalkStrong,
  },
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
      // ⚠️ `pointerEvents="none"` SKJULER IKKE FOR SKJERMLESER. Noden er
      // atmosfære og betydning på én gang: den sier HVA som skjedde, men den
      // sier det med form og farge. Betydningen ligger i radens samlede
      // label — her skal VoiceOver ikke stoppe.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
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
        skin.border ? styles.bordered : null,
        skin.border ? {borderColor: skin.border} : null,
        // Glød er rasjonert i Heia. Målet for oss er ett av de reserverte
        // stedene — og etter telefontesten er det det ENESTE i nodene.
        skin.glow ? styles.glow : null,
        skin.glow ? {shadowColor: skin.glow} : null,
      ]}>
      {glyphFor(kind, grid.iconSize, skin.ink)}
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
  bordered: {
    borderWidth: 1,
  },
});
