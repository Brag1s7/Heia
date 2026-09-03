import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {LiquidGlassSurface} from './LiquidGlassSurface';
import {CAPSULE} from '../shared/tabBarLayout';

/**
 * TAB-BARENS KAPSEL — den flytende glassflaten bak fanene (Brage
 * 2026-09-03, godkjent: alternativ A).
 *
 * Rendres av bottom-tabs som `tabBarBackground`, altså i et absoluteFill-
 * lag bak faneelementene (pointerEvents none). Barcontaineren er
 * kapsel + løft + safe area høy med bunnpadding = safe area + løft, så
 * innholdsboksen fanene legges ut i er NØYAKTIG kapselens 64 pt — kapselen
 * forankres derfor i toppen av containeren, ikke i bunnen.
 *
 * TO MILJØER, ÉN GEOMETRI:
 *   light   lys perle-Liquid Glass (Hjem, Kalender, Sesongen, Varsler, Profil)
 *   match   mørkt stadionglass på selve kampsiden (designregelen: mørkt
 *           glass = kamp). Kun tinten skiller dem — samme kapsel, samme
 *           skygge, samme fanegeometri.
 *
 * Skyggen ligger på ytterboksen uten overflow: hidden (Android klipper
 * ellers). Den er `shadows.elevated` med opasiteten forsiktig opp
 * 0,10 → 0,12 (Brages sluttrunde) — lokalt her, tokenet har andre
 * konsumenter. Glasset er `fill`: det måler ikke seg selv etter barn — det har
 * ingen. Fallback (Android / Reduce Transparency / iOS < 26) er én solid
 * flate per miljø, tegnet av `LiquidGlassSurface` selv.
 */
export type TabBarEnvironment = 'light' | 'match';

/**
 * DIFFUSJONSFELTET (Brage 2026-09-03, referansen tab-bar-ambient-blur.png):
 * et mykt, maskert felt UTENFOR og BAK kapselen — hele skjermbredden, fra
 * kapselens overkant ned til skjermbunnen (safe area inkl.) — som forankrer
 * kapselen til skjermens nederste område. Lagrekkefølge: feed → dette
 * feltet → glasskapselen → fanene. pointerEvents none — rører aldri trykk
 * eller scroll.
 *
 * ⚠️ INGEN SYNLIG KANT (Brage 2026-09-03, runde 4 og 5): uklarheten skal
 * ligge UNDER og MELLOM, og alt over kapselen skal oppleves klart — men
 * det skal være UMULIG å peke på hvor feltet begynner. Runde 4 (hard kant
 * på overkanten + klippeboks rundt hazen) ga en synlig rektangelkant og
 * ble avvist. Derfor: masken begynner 40 pt over kapselen på 0, er nesten
 * usynlig ved kapseltoppen (0,04), bygger seg først i kapselens nedre
 * halvdel og er sterkest mellom kapselen og skjermbunnen. Ingen klipping —
 * hazen (boxShadow) tones ut av seg selv.
 *
 * ⚠️ DETTE ER JS-FALLBACKEN (ingen ekte blur): en vertikal frost-gradient
 * i perle (lyst) / arenatone (kamp). Innholdet under blir dempet og
 * mykere, men IKKE optisk uskarpt. Ekte maskert backdrop-blur krever en
 * native UIVisualEffectView med CAGradientLayer-maske (ny HeiaFrostField-
 * view via samme interop-mønster som HeiaLiquidGlassView → .h/.m/pbxproj +
 * Cmd+R). Brage skal si ja før den bygges; denne gradienten blir uansett
 * Reduce Transparency-/Android-fallbacken. Alfaen holdes lav: aldri en
 * hvit, grå eller opak stripe — grunnens farger og former skal synes.
 */
export const DIFFUSION = {
  /** Hvor langt OVER kapseltoppen masken begynner (på 0, helt transparent). */
  bleedAbove: 40,
  light: {
    color: '#F0F6F3',
    /** [40 pt over, kapseltopp, kapselmidt, kapselbunn, skjermbunn] */
    stops: [0, 0.04, 0.12, 0.3, 0.42],
  },
  match: {
    color: '#143024',
    stops: [0, 0.06, 0.16, 0.4, 0.56],
  },
} as const;

/** Stoppene som brøk av feltets høyde (container-høyde + bleed). */
export function diffusionOffsets(containerHeight: number): number[] {
  const total = containerHeight + DIFFUSION.bleedAbove;
  const b = DIFFUSION.bleedAbove;
  return [
    0,
    b / total,
    (b + CAPSULE.height / 2) / total,
    (b + CAPSULE.height) / total,
    1,
  ];
}

function DiffusionField({
  environment,
  containerHeight,
}: {
  environment: TabBarEnvironment;
  containerHeight: number;
}) {
  const tone = DIFFUSION[environment];
  const offsets = diffusionOffsets(containerHeight);
  return (
    <View
      testID={`tabbar-diffusion-${environment}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.diffusion}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="tbDiff" x1="0" y1="0" x2="0" y2="1">
            {tone.stops.map((alpha, i) => (
              <Stop
                key={i}
                offset={offsets[i]}
                stopColor={tone.color}
                stopOpacity={alpha}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tbDiff)" />
      </Svg>
    </View>
  );
}

/**
 * HAZEN (Brage 2026-09-03, referansen tab-bar-ambient-blur.png): kapselen
 * skal gli inn i skjermen, ikke ligge oppå den. To `boxShadow`-lag på
 * ytterboksen (RN 0.83; iOS tegner fra border-boksen uansett fyll, Android
 * klipper border-boksen ut — derfor ingen overflow: hidden her):
 *   haze    bred, myk, lavmælt: perle (ikke hvitt) med stor blur og liten
 *           spread rundt hele kapselen — diffus uklarhet, ikke glød.
 *   grunn   svak GRØNN grunnskygge under (heia-skyggegrønn #0B3B2A),
 *           samme familie som kortenes `cardResting`.
 * På kampsiden er hazen arenaBottom-toner og grunnen dypere — mørkt glass
 * skal ikke få lys halo. Tallene er justerbare per telefonbilde.
 */
export const CAPSULE_HAZE = {
  light: [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 30,
      spreadDistance: 2,
      color: 'rgba(240, 246, 243, 0.42)',
    },
    {
      offsetX: 0,
      offsetY: 8,
      blurRadius: 20,
      spreadDistance: 0,
      color: 'rgba(11, 59, 42, 0.16)',
    },
  ],
  match: [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 30,
      spreadDistance: 2,
      color: 'rgba(29, 70, 51, 0.42)',
    },
    {
      offsetX: 0,
      offsetY: 8,
      blurRadius: 20,
      spreadDistance: 0,
      color: 'rgba(5, 20, 14, 0.30)',
    },
  ],
} as const;

interface TabBarGlassProps {
  environment: TabBarEnvironment;
  /** Barcontainerens høyde (kapsel + bunnavstand) — feltet regner stopp. */
  containerHeight: number;
}

export function TabBarGlass({environment, containerHeight}: TabBarGlassProps) {
  return (
    <>
      <DiffusionField
        environment={environment}
        containerHeight={containerHeight}
      />
      <View
        testID={`tabbar-capsule-${environment}`}
        pointerEvents="none"
        style={[
          styles.capsule,
          environment === 'match' ? styles.hazeMatch : styles.hazeLight,
        ]}>
        <LiquidGlassSurface
          fill
          variant={environment === 'match' ? 'barMatch' : 'bar'}
          cornerRadius={CAPSULE.radius}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Hele bredden, fra `bleedAbove` over containeren til skjermbunnen.
  // Containeren (bibliotekets bar) klipper ikke — verifisert i BottomTabBar.
  // ⚠️ Aldri overflow: hidden rundt kapselen — en klippekant er en kant.
  diffusion: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -DIFFUSION.bleedAbove,
    bottom: 0,
  },
  capsule: {
    position: 'absolute',
    top: 0,
    left: CAPSULE.inset,
    right: CAPSULE.inset,
    height: CAPSULE.height,
    borderRadius: CAPSULE.radius,
  },
  hazeLight: {
    boxShadow: [...CAPSULE_HAZE.light],
  },
  hazeMatch: {
    boxShadow: [...CAPSULE_HAZE.match],
  },
});
