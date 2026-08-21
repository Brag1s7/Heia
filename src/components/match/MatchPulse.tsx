import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, fonts, matchColors, radius, spacing} from '../../theme';
import {
  Ball,
  Camera,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  PauseSolid,
} from '../icons';
import {useReducedMotion} from '../useReducedMotion';
import {
  matchPulseClock,
  matchPulseMomentText,
  matchPulsePhaseText,
  matchPulseResponseText,
  matchPulseSummaryA11y,
  matchPulseValueA11y,
} from '../../shared/matchCopy';
import {
  buildPulseModel,
  buildPulseMoments,
  buildPulseTicks,
  matchPulseTimeline,
  pulseSignature,
  PULSE_BAND,
  PULSE_MARK_R,
  PULSE_MID,
  PULSE_RANK,
  PULSE_TICK_R,
  type PulseCluster,
  type PulseKind,
  type PulsePhoto,
} from '../../shared/matchPulse';
import type {MatchEngagement} from '../../shared/matchEngagement';
import type {MatchEvent} from '../../shared/types';

/**
 * KAMPENS PULS — det tredje rommet, mellom arenaen og forløpet.
 *
 * ---------------------------------------------------------------------------
 * ET KOMPRIMERT KARDIOGRAM, IKKE EN BØLGE
 *
 * Runde 2 av denne skiva var teknisk grønn og ble avvist likevel: kurven var
 * «en tilfeldig bølge basert på antall hendelser». Modellen som erstattet
 * den står i `docs/KAMPENS-PULS-MODELL.md`; regningen i
 * `shared/matchPulse`. Denne fila er FLATEN.
 *
 * Fire ting den skal svare på i løpet av tre sekunder: når skjedde det mye,
 * når var det stille, hvem scoret, og hva slags øyeblikk var det.
 *
 * ---------------------------------------------------------------------------
 * HVORFOR MARKØRENE ER VIEWS OG IKKE SVG-ELEMENTER
 *
 * Ikonene er APPENS EGNE (`Ball`, `MessageCircle`, `Camera`), og Lucide-
 * ikoner rendrer sin egen `<Svg>`. Svg inne i svg er ikke pålitelig i RN, så
 * markørene er absolutt posisjonerte views oppå lerretet. Det er uansett
 * nødvendig: de skal kunne trykkes.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ TO NIVÅER AV KOLLISJON, OG DE ER IKKE DET SAMME
 *
 * Visuell sammenslåing skjer på 12 pt. TRYKKFLATER kan ikke: en 44 pt
 * Pressable overlapper naboen sin for lengst da, og brukeren treffer ikke
 * det hun sikter på. Trykkgruppene legges derfor ut sekvensielt i
 * `buildPulseModel`, og det som ikke får sin egen flate havner i den forrige
 * gruppen — panelet blar mellom øyeblikkene.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ÉN JUSTERBAR TILGJENGELIGHETSENHET, IKKE ET DUSIN STOPP
 *
 * Markørene skal ALDRI bli parallelle VoiceOver-stopp rett før den samme
 * tidslinjen. Hele pulsen er `accessibilityRole="adjustable"`: labelen
 * oppsummerer kampen, sveip opp/ned blar mellom øyeblikkene, `accessibility-
 * Value` leser det valgte, og aktivering viser det i historien.
 *
 * ⚠️ IKKE `MatchPulseCard`. Den er «lagets puls» i varslene.
 */

/** Seksjonens vannrette luft. Samme kant som resten av kampskjermen. */
const PAD_H = spacing.xl;
/** Kurvens eget innrykk, så den runde strekenden ikke klippes. */
const CURVE_PAD = 10;
/** Krittstreken som leder blikket videre ned i kampen. */
const CHALK_W = 54;
const NOW_R = 4;

interface MatchPulseProps {
  matchEvents: MatchEvent[];
  photos: PulsePhoto[];
  startedAt?: Date;
  /**
   * HEIA + kommentarer per øyeblikk, fra `buildMatchEngagement` (skive 4).
   * ⚠️ LEST DERFRA, ALDRI HENTET PÅ NYTT — de samme tallene som
   * engasjementslinjene i forløpet viser.
   */
  engagement: {
    byMatchEvent: Map<string, MatchEngagement>;
    byPost: Map<string, MatchEngagement>;
  };
  phase: 'live' | 'paused' | 'finished';
  /**
   * Kampminuttet NÅ — FAKTISK SPILT TID (P2/00073).
   *
   * ⚠️ EN ETIKETT, IKKE EN POSISJON. Den skrives ut til høyre («NÅ 40′») og
   * rører ikke geometrien i det hele tatt. Etter 00073 er den en ANNEN akse
   * enn kurven: spilt tid hopper ikke over pausen, klokketid gjør det.
   * Bruker man den til å plassere noe, havner det for langt til venstre.
   *
   * ⚠️ PROP, ALDRI EGEN UTREGNING.
   */
  minute?: number;
  /**
   * Klokkeslettet NÅ, fra skjermens tick (P2 — aldri `Date.now()` her inne).
   *
   * ⚠️ DETTE er tidsaksens høyre kant. Hendelsene ligger på klokketid
   * (`created_at`), så nå-prikken må gjøre det samme. Se `matchPulseTimeline`.
   */
  nowMs?: number;
  authorFor?: (userId: string) => {name: string} | undefined;
  /** «Vis i historien» — ruller til øyeblikkets rad i kampforløpet. */
  onShowInHistory?: (target: {eventId?: string; photoId?: string}) => void;
}

export function MatchPulse({
  matchEvents,
  photos,
  startedAt,
  engagement,
  phase,
  minute,
  nowMs,
  authorFor,
  onShowInHistory,
}: MatchPulseProps) {
  const [box, setBox] = useState<{w: number; h: number} | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (
      !box ||
      Math.abs(box.w - width) > 0.5 ||
      Math.abs(box.h - height) > 0.5
    ) {
      setBox({w: width, h: height});
    }
  };

  const finished = phase === 'finished';
  // ⚠️ EKTE KAMPTID I SEKUNDER, ingen kvantisering. En ferdig kamp bruker
  // alltid hele bredden: avspark helt til venstre, slutt helt til høyre.
  const timeline = matchPulseTimeline(
    matchEvents,
    engagement.byMatchEvent,
    startedAt,
    nowMs,
    finished,
  );

  // ⚠️ MEMOISERINGSNØKKELEN, LÅST (P-bolken). To trinn med vilje: signaturen
  // regnes på REFERANSENE (billig, og bare når en query har levert nye
  // objekter), modellen på SIGNATUREN. `matchEvents.length` alene ville sagt
  // «ingenting har skjedd» i alle tilfellene der antallet står stille og
  // innholdet ikke gjør det. `span` er med; `minute` er det ALDRI.
  const input = {matchEvents, photos, startedAt, authorFor, ...engagement};
  const signature = useMemo(
    () => pulseSignature(input, timeline),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      matchEvents,
      photos,
      startedAt,
      engagement,
      timeline.origin,
      timeline.span,
    ],
  );

  const model = useMemo(
    () => {
      if (!box) return null;
      return buildPulseModel(
        buildPulseMoments(input, timeline),
        buildPulseTicks(
          matchEvents,
          engagement.byMatchEvent,
          startedAt,
          timeline,
        ),
        timeline,
        {width: box.w - PAD_H * 2, pad: CURVE_PAD},
      );
    },
    // ⚠️ SIGNATUREN, IKKE ARRAYENE — og ingen `minute`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, box?.w],
  );

  // Valget bæres av NØKKELEN, ikke av en indeks: kommer det en ny hendelse
  // midt i kampen, skal markøren du valgte fortsatt være den samme — og
  // forsvinner den (angret mål), skal valget forsvinne med den.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const moments = model?.moments ?? [];
  const selectedIndex = moments.findIndex(m => m.key === selectedKey);
  const selected = selectedIndex >= 0 ? moments[selectedIndex] : undefined;

  const clock = matchPulseClock({phase, minute});
  const reducedMotion = useReducedMotion();

  // ⚠️ MILD OVERGANG NÅR TIDSAKSEN KVANTISERER OM SEG (hvert 5. minutt i en
  // live kamp). Ingen dramatisk animasjon — en kort opacity-overgang, og
  // Reduce Motion bytter direkte.
  const fade = useRef(new Animated.Value(1)).current;
  const lastSpan = useRef(timeline.span);
  useEffect(() => {
    if (lastSpan.current === timeline.span) return;
    lastSpan.current = timeline.span;
    if (reducedMotion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0.55);
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [timeline.span, fade, reducedMotion]);

  const step = (delta: number) => {
    if (moments.length === 0) return;
    const next =
      selectedIndex < 0
        ? delta > 0
          ? 0
          : moments.length - 1
        : Math.max(0, Math.min(moments.length - 1, selectedIndex + delta));
    setSelectedKey(moments[next].key);
  };

  const showSelected = () => {
    if (!selected) return;
    onShowInHistory?.({eventId: selected.eventId, photoId: selected.photoId});
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName;
    if (name === 'increment') step(1);
    else if (name === 'decrement') step(-1);
    else if (name === 'activate') showSelected();
  };

  const inner = box ? box.w - PAD_H * 2 : 0;
  // NÅ-markøren flyttes for seg, oppå den memoiserte kurven.
  // ⚠️ KLOKKETID, ikke `minute`. Se `nowMs` i propsene.
  const nowSeconds =
    nowMs !== undefined ? (nowMs - timeline.origin) / 1000 : timeline.span;
  const nowX =
    box && !finished
      ? CURVE_PAD +
        (Math.min(Math.max(nowSeconds, 0), timeline.span) / timeline.span) *
          (inner - CURVE_PAD * 2)
      : 0;

  return (
    <View
      style={styles.section}
      onLayout={onLayout}
      // ⚠️ HELE PULSEN ER ÉTT ELEMENT. `accessible` her svelger både
      // overskriften, markørene og trykkflatene — som er nøyaktig poenget:
      // ingen parallelle stopp foran den samme tidslinjen.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={matchPulseSummaryA11y({
        clock: clock.a11y,
        count: moments.length,
        phases: model?.phases ?? [],
      })}
      accessibilityValue={
        selected
          ? {
              text: matchPulseValueA11y(selected, {
                index: selectedIndex + 1,
                total: moments.length,
              }),
            }
          : undefined
      }
      accessibilityActions={
        moments.length
          ? [
              {name: 'increment'},
              {name: 'decrement'},
              {name: 'activate', label: 'Vis i historien'},
            ]
          : undefined
      }
      onAccessibilityAction={onAccessibilityAction}>
      {/* DET TREDJE ROMMET. Ingen flate med egen bakgrunnsfarge — en tone
          som toner inn og ut, så seksjonen aldri får en kant. */}
      {box && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={box.w} height={box.h}>
            <Defs>
              <LinearGradient id="pulseRoom" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop
                  offset="0"
                  stopColor={matchColors.pulse}
                  stopOpacity={0}
                />
                <Stop
                  offset="0.14"
                  stopColor={matchColors.pulse}
                  stopOpacity={1}
                />
                <Stop
                  offset="0.86"
                  stopColor={matchColors.pulse}
                  stopOpacity={1}
                />
                <Stop
                  offset="1"
                  stopColor={matchColors.pulse}
                  stopOpacity={0}
                />
              </LinearGradient>
              <LinearGradient id="pulseChalk" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0" stopColor="#EAFFF6" stopOpacity={0.24} />
                <Stop offset="1" stopColor="#EAFFF6" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={box.w}
              height={box.h}
              fill="url(#pulseRoom)"
            />
            <Rect
              x={PAD_H}
              y={box.h - 1}
              width={CHALK_W}
              height={1}
              fill="url(#pulseChalk)"
            />
          </Svg>
        </View>
      )}

      <View style={styles.labelRow}>
        <Text style={styles.title} maxFontSizeMultiplier={1.4}>
          Kampens puls
        </Text>
        <Text style={styles.clock} maxFontSizeMultiplier={1.4}>
          {clock.text}
        </Text>
      </View>

      <Animated.View style={[styles.band, {opacity: fade}]}>
        {box && model && (
          <Svg width={inner} height={PULSE_BAND}>
            <Defs>
              <LinearGradient id="pulseUs" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor={colors.heia} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.heia} stopOpacity={0.02} />
              </LinearGradient>
              <LinearGradient id="pulseThem" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor="#8FA3AC" stopOpacity={0.03} />
                <Stop offset="1" stopColor="#8FA3AC" stopOpacity={0.26} />
              </LinearGradient>
              {/* Gløden regnes mot elementets egen bounding box, så én def
                  gjelder alle radier: HEIA vokser lyset uten en def per
                  markør. En flat skive ville lest som et klistremerke. */}
              <RadialGradient
                id="pulseHaloUs"
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%">
                <Stop offset="0" stopColor={colors.heia} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.heia} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient
                id="pulseHaloThem"
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%">
                <Stop
                  offset="0"
                  stopColor={matchColors.opponentInk}
                  stopOpacity={0.3}
                />
                <Stop
                  offset="1"
                  stopColor={matchColors.opponentInk}
                  stopOpacity={0}
                />
              </RadialGradient>
              <ClipPath id="pulseClipUp">
                <Rect x={0} y={0} width={inner} height={PULSE_MID} />
              </ClipPath>
              <ClipPath id="pulseClipDown">
                <Rect
                  x={0}
                  y={PULSE_MID}
                  width={inner}
                  height={PULSE_BAND - PULSE_MID}
                />
              </ClipPath>
            </Defs>

            {/* Flaten mellom kurven og midtlinja, tonet etter SIDE. Det er
                den som svarer «hvem scoret» før du har lest et eneste ikon. */}
            <Path
              d={model.fill}
              fill="url(#pulseUs)"
              clipPath="url(#pulseClipUp)"
            />
            <Path
              d={model.fill}
              fill="url(#pulseThem)"
              clipPath="url(#pulseClipDown)"
            />

            {/* Midtlinja. En rett, dempet strek betyr nå noe konkret:
                ingen rapporterte hendelser. Derfor ingen falsk bølge. */}
            <Rect
              x={CURVE_PAD}
              y={PULSE_MID - 0.5}
              width={inner - CURVE_PAD * 2}
              height={1}
              fill="rgba(234, 255, 246, 0.2)"
            />

            {/* Båndet: halvbredden følger tettheten — tykkere lys der det
                skjedde mye, tynnest i det stille. */}
            <Path d={model.ribbon} fill={colors.heia} opacity={0.22} />
            <Path
              d={model.line}
              fill="none"
              stroke={matchColors.text}
              strokeOpacity={0.8}
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {model.clusters.map(c => (
              <Circle
                key={`halo${c.key}`}
                cx={c.x}
                cy={c.y}
                r={c.glow}
                fill={
                  c.side === 1 ? 'url(#pulseHaloUs)' : 'url(#pulseHaloThem)'
                }
              />
            ))}

            {!finished && (
              <>
                <Rect
                  x={nowX}
                  y={12}
                  width={1}
                  height={PULSE_BAND - 24}
                  fill="rgba(2, 255, 171, 0.5)"
                />
                <Circle
                  cx={nowX}
                  cy={PULSE_MID}
                  r={NOW_R}
                  fill={matchColors.text}
                />
              </>
            )}
          </Svg>
        )}

        {/* ⚠️ PAUSE ER ÉN LITEN MARKØR PÅ EN SAMMENHENGENDE LINJE. Den var
            en fullhøy strek som delte kurven i to; nå sitter den PÅ
            midtlinja, deler ingenting og nullstiller ingen tid. */}
        {model?.ticks.map((t, i) => (
          <View
            key={`tick${i}`}
            pointerEvents="none"
            style={[
              styles.tick,
              {left: t.x - PULSE_TICK_R, top: PULSE_MID - PULSE_TICK_R},
            ]}>
            <PauseSolid size={7} color={matchColors.dim} />
          </View>
        ))}

        {/* Markørene ligger oppå lerretet og tar ikke imot trykk selv —
            trykkflatene under er grovere og garantert uten overlapp. */}
        {/* ⚠️ MALT I RANG, IKKE I X. Markørene får overlappe litt for at
            typene skal kunne leses i en tett kamp — og da må målet ligge
            øverst, aldri under et bilde. */}
        {model &&
          [...model.clusters]
            .sort((a, b) => PULSE_RANK[a.kind] - PULSE_RANK[b.kind])
            .map(c => (
              <Marker
                key={c.key}
                cluster={c}
                selected={
                  !!selected && c.moments.some(m => m.key === selected.key)
                }
              />
            ))}

        {model?.touch.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setSelectedKey(t.moments[0].key)}
            style={[styles.touch, {left: t.left, width: t.width}]}
          />
        ))}
      </Animated.View>

      <View style={styles.footer}>
        {selected ? (
          <>
            <View style={styles.footerRow}>
              <Text
                style={styles.selection}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}>
                {matchPulseMomentText(selected)}
              </Text>
              {/* ⚠️ NAVIGASJONEN SKAL VÆRE TYDELIG OG TRYKKBAR (Brage). To
                  ekte knapper med krittkant og 46 pt treffflate, ikke to
                  små tegn man må sikte på. */}
              {moments.length > 1 && (
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => step(-1)}
                    hitSlop={8}
                    disabled={selectedIndex <= 0}
                    style={({pressed}) => [
                      styles.stepButton,
                      selectedIndex <= 0 && styles.stepDisabled,
                      pressed && styles.stepPressed,
                    ]}>
                    <ChevronLeft
                      size={16}
                      color={matchColors.text}
                      strokeWidth={2.6}
                    />
                  </Pressable>
                  <Text style={styles.stepCount} maxFontSizeMultiplier={1.2}>
                    {selectedIndex + 1}/{moments.length}
                  </Text>
                  <Pressable
                    onPress={() => step(1)}
                    hitSlop={8}
                    disabled={selectedIndex >= moments.length - 1}
                    style={({pressed}) => [
                      styles.stepButton,
                      selectedIndex >= moments.length - 1 &&
                        styles.stepDisabled,
                      pressed && styles.stepPressed,
                    ]}>
                    <ChevronRight
                      size={16}
                      color={matchColors.text}
                      strokeWidth={2.6}
                    />
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.footerRow}>
              <Text
                style={styles.response}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}>
                {matchPulseResponseText(selected)}
              </Text>
              {/* ⚠️ SYNLIG HANDLING, IKKE EN SKJULT «TRYKK EN GANG TIL».
                  Brukeren skal ikke gjette at et nytt trykk gjør noe annet
                  enn det første. */}
              <Pressable
                onPress={showSelected}
                hitSlop={12}
                style={styles.showRow}>
                <Text style={styles.show} maxFontSizeMultiplier={1.3}>
                  Vis i historien
                </Text>
                <ChevronRight size={13} color={colors.heia} strokeWidth={2.4} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.footerRow}>
            {(model?.phases ?? []).map(p => (
              <Text
                key={p.kind}
                style={[styles.phase, p.kind === 'quiet' && styles.phaseQuiet]}
                maxFontSizeMultiplier={1.3}>
                {matchPulsePhaseText(p)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * ÉN MARKØR.
 *
 * Semantikken er forløpets, ikke en ny: ballen betyr mål og ingenting annet,
 * reporterens stemme er gull, bildet er krem. Retningen og fargen sier hvem
 * målet tilhørte; ikonet sier hva slags øyeblikk det var.
 *
 * ⚠️ Målnoden i `EventNode` er lys mint med mørkt blekk fordi den står i en
 * 32 pt sirkel ved siden av tekst. Her er den 15 pt og skal leses på et
 * halvt sekund — derfor full mint. Samme semantikk, annen skala.
 */
function Marker({
  cluster,
  selected,
}: {
  cluster: PulseCluster;
  selected: boolean;
}) {
  const skin = SKIN[cluster.kind];
  const count = cluster.moments.length;
  // ⚠️ IKONET FØLGER MARKØREN. Sto som `16` mot en 30 pt markør; med 22 pt
  // ville det fylt hele flaten og blitt en klump.
  //
  // ⚠️ HVORFOR IKONENE IKKE BLE FJERNET, selv om de er små nå: fargen alene
  // kan ikke bære betydningen. `photo` (#C6FFE9) og `goalUs` (#02FFAB) er
  // BEGGE mint, og uten glyfen ville et kampbilde og et mål vært to nesten
  // like prikker. Siden + farge sier HVEM; bare ikonet sier HVA.
  const glyphSize = Math.round(PULSE_MARK_R * 1.06);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.mark,
        {
          left: cluster.x - PULSE_MARK_R,
          top: cluster.y - PULSE_MARK_R,
          backgroundColor: skin.bg,
        },
        skin.border ? styles.markBordered : null,
        skin.border ? {borderColor: skin.border} : null,
        selected && styles.markSelected,
        cluster.iReacted && styles.markReacted,
      ]}>
      {cluster.kind === 'update' ? (
        <MessageCircle size={glyphSize} color={skin.ink} strokeWidth={2.4} />
      ) : cluster.kind === 'photo' ? (
        <Camera size={glyphSize} color={skin.ink} strokeWidth={2.2} />
      ) : (
        <Ball size={glyphSize + 2} color={skin.ink} strokeWidth={1.9} />
      )}

      {count > 1 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={1}>
            {count}
          </Text>
        </View>
      )}
      {cluster.comments > 0 && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText} maxFontSizeMultiplier={1}>
            {cluster.comments}
          </Text>
        </View>
      )}
    </View>
  );
}

const SKIN: Record<PulseKind, {bg: string; ink: string; border?: string}> = {
  goalUs: {bg: colors.heia, ink: colors.heiaDeep},
  goalThem: {
    bg: matchColors.opponentNode,
    ink: matchColors.opponentInk,
    border: 'rgba(195, 212, 218, 0.5)',
  },
  update: {bg: colors.gold, ink: colors.goldInk},
  photo: {bg: colors.heiaTint, ink: colors.heiaDeep},
};

const styles = StyleSheet.create({
  // ~176 pt. Pulsen fortjener plassen når den faktisk formidler kampen.
  section: {
    position: 'relative',
    paddingHorizontal: PAD_H,
    paddingTop: 10,
    paddingBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: 5,
  },
  // Samme stemme som forløpets eyebrow — kampens seksjoner er ÉN type.
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
  // ⚠️ Aldri `fontWeight` sammen med displayfonten — fila ER vekten.
  clock: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    letterSpacing: 0.5,
    color: matchColors.text,
  },
  band: {
    position: 'relative',
    height: PULSE_BAND,
  },
  mark: {
    position: 'absolute',
    width: PULSE_MARK_R * 2,
    height: PULSE_MARK_R * 2,
    borderRadius: PULSE_MARK_R,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBordered: {
    borderWidth: 1,
  },
  markSelected: {
    borderWidth: 1.6,
    borderColor: matchColors.text,
  },
  // Du har heiet: markøren bærer det, ikke teksten.
  markReacted: {
    shadowColor: colors.heia,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  // ⚠️ MERKET SKALERER MED MARKØREN. Det hadde fast størrelse, og da
  // markøren krympet fra 30 til 22 pt ble ×N-merket STØRRE enn prikken det
  // hang på. Tallene under er avledet av `PULSE_MARK_R`, ikke skrevet av.
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: Math.round(PULSE_MARK_R * 1.24),
    height: Math.round(PULSE_MARK_R * 1.24),
    paddingHorizontal: 3,
    borderRadius: PULSE_MARK_R * 0.62,
    backgroundColor: matchColors.timeline,
    borderWidth: 0.7,
    borderColor: 'rgba(234, 255, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: Math.round(PULSE_MARK_R * 0.72),
    fontWeight: '800',
    color: matchColors.text,
  },
  bubble: {
    position: 'absolute',
    bottom: -3,
    left: -4,
    minWidth: Math.round(PULSE_MARK_R * 1.16),
    height: Math.round(PULSE_MARK_R * 1.16),
    paddingHorizontal: 3,
    borderRadius: PULSE_MARK_R * 0.58,
    backgroundColor: 'rgba(14, 41, 29, 0.94)',
    borderWidth: 0.7,
    borderColor: 'rgba(234, 255, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    fontSize: Math.round(PULSE_MARK_R * 0.66),
    fontWeight: '800',
    color: matchColors.dim,
  },
  // Trykkflatene er FULLHØYDE og garantert uten overlapp — se `buildPulseModel`.
  touch: {
    position: 'absolute',
    top: 0,
    height: PULSE_BAND,
  },
  // Pausen: liten, rund, PÅ midtlinja. Deler ingenting.
  tick: {
    position: 'absolute',
    width: PULSE_TICK_R * 2,
    height: PULSE_TICK_R * 2,
    borderRadius: PULSE_TICK_R,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: matchColors.timeline,
    borderWidth: 1,
    borderColor: matchColors.chalk,
  },
  // Fast høyde uansett tilstand: valget skal ikke dytte kampforløpet nedover.
  footer: {
    height: 48,
    justifyContent: 'center',
    gap: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selection: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: matchColors.text,
  },
  response: {
    flex: 1,
    fontSize: 11,
    color: matchColors.dim,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Krittkant, aldri hvit — samme språk som reporterknappene. 30 pt synlig
  // + 8 pt hitSlop = 46 pt treffflate.
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: matchColors.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: {
    backgroundColor: 'rgba(234, 255, 246, 0.12)',
    borderColor: matchColors.chalkStrong,
  },
  stepDisabled: {
    opacity: 0.35,
  },
  stepCount: {
    fontFamily: fonts.display,
    fontSize: 12,
    minWidth: 30,
    textAlign: 'center',
    color: matchColors.dim,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.sm,
  },
  show: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.heia,
  },
  phase: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.heia,
    opacity: 0.85,
    marginRight: spacing.md,
  },
  phaseQuiet: {
    color: matchColors.dim,
    opacity: 0.6,
  },
});
