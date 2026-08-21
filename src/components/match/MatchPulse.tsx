import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
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
import {colors, fonts, matchColors, spacing} from '../../theme';
import {useReducedMotion} from '../useReducedMotion';
import {
  matchPulseClock,
  matchPulsePhaseText,
  matchPulseSummaryA11y,
} from '../../shared/matchCopy';
import {
  buildPulseModel,
  buildPulseMoments,
  buildPulseTicks,
  matchPulseTimeline,
  pulseSignature,
  PULSE_BAND,
  PULSE_MID,
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
/** Vårt mål: en litt større mintnode OVER linja. */
const NODE_US_R = 5;
/** Motstanderens: dempet skifer UNDER linja. Mindre, men ekte. */
const NODE_THEM_R = 4;
/**
 * Pausestrekens lengde over og under midtlinja.
 *
 * ⚠️ KORT MED VILJE. En FULLHØY strek ble avvist i skive 5 fordi den delte
 * kampen i to — og riggen viste at den gjør nøyaktig det samme nå, selv på
 * 15 % krittfarge. Den skal krysse kurven, ikke dele den: så lang at man ser
 * at noe skjedde, så kort at blikket ikke stopper.
 */
const TICK_UP = 14;
const TICK_DOWN = 10;

/**
 * Har noen faktisk svart på dette øyeblikket?
 *
 * ⚠️ VAKTEN SOM HOLDER FLATEN REN. `glowFor` gir en basisradius selv på
 * null heier, så uten denne ville HVERT øyeblikk fått en glødeprikk — og da
 * er vi tilbake til en rad med markører, bare uskarpe.
 */
function engasjert(c: {comments: number; moments: {heia: number}[]}): boolean {
  return c.comments > 0 || c.moments.some(m => m.heia > 0);
}

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

  const moments = model?.moments ?? [];
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
      // ⚠️ ÉTT STOPP, ÉN SETNING, INGEN ROLLE.
      // Pulsen var `accessibilityRole="adjustable"` med sveip opp/ned mellom
      // øyeblikkene og «Vis i historien» på dobbelttrykk. Det var en
      // PARALLELL NAVIGASJON gjennom nøyaktig de samme hendelsene som
      // kampforløpet rett under leser opp — én gang for mye. Nå er pulsen en
      // oppsummering man hører, og historien er stedet man går til.
      accessible
      accessibilityLabel={matchPulseSummaryA11y({
        clock: clock.a11y,
        count: moments.length,
        phases: model?.phases ?? [],
      })}>
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

            {/* ⚠️ PAUSE ER ÉN TYNN KRITTSTREK GJENNOM KURVEN.
                Den har vært tre ting: en fullhøy delestrek (avvist — den
                delte kampen i to), et lite pauseikon PÅ midtlinja (avvist
                med ikonene), og nå en krittstrek. Den nullstiller ingen tid
                og deler ingenting: kurven krysser den. */}
            {model.ticks.map((t, i) => (
              <Rect
                key={`tick${i}`}
                x={t.x - 0.5}
                y={PULSE_MID - TICK_UP}
                width={1}
                height={TICK_UP + TICK_DOWN}
                fill={matchColors.chalkFaint}
              />
            ))}

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

            {/* ⚠️ HEIA OG KOMMENTARER ER VARME, IKKE MERKER.
                Halo tegnes KUN der noen faktisk har svart — ellers ville
                hvert øyeblikk fått en prikk, og da er vi tilbake til en rad
                med markører. Radien er HEIA og ingenting annet (`glowFor`);
                kurvens høyde rører den aldri, så pulsen kan ikke bli en
                påstand om hvem som presser. */}
            {model.clusters
              .filter(c => engasjert(c))
              .map(c => (
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

            {/* ⚠️ NODER BARE PÅ MÅL. Oppdateringer og bilder FORMER kurven —
                svaien er der — men de får ikke sitt eget punkt. Vårt mål er
                en litt større mintnode over linja; motstanderens er dempet
                skifer under den. Retningen sier hvem, uten et eneste ikon. */}
            {model.clusters
              .filter(c => c.kind === 'goalUs' || c.kind === 'goalThem')
              .map(c =>
                c.kind === 'goalUs' ? (
                  <Circle
                    key={`node${c.key}`}
                    cx={c.x}
                    cy={c.y}
                    r={NODE_US_R}
                    fill={colors.heia}
                  />
                ) : (
                  <Circle
                    key={`node${c.key}`}
                    cx={c.x}
                    cy={c.y}
                    r={NODE_THEM_R}
                    fill={matchColors.opponentInk}
                    fillOpacity={0.55}
                  />
                ),
              )}

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
      </Animated.View>

      {/* ⚠️ MAKS TO ETIKETTER, OG BARE NÅR DATAGRUNNLAGET BÆRER DEM.
          `pulsePhases` tier i en kort kamp med få hendelser — en «rolig
          periode» i en kamp som varte ett minutt er ikke en observasjon,
          det er støy. Her sto det før et helt valgpanel med stepper og
          «Vis i historien»; det duplisert kamphistorien rett under. */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          {(model?.phases ?? []).slice(0, 2).map(p => (
            <Text
              key={p.kind}
              style={[styles.phase, p.kind === 'quiet' && styles.phaseQuiet]}
              maxFontSizeMultiplier={1.3}>
              {matchPulsePhaseText(p)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

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
  // Fast høyde uansett tilstand: valget skal ikke dytte kampforløpet nedover.
  // ⚠️ VAR 48 pt — plass til valgpanelets TO rader (øyeblikk + stepper,
  // respons + «Vis i historien»). Med bare faseetikettene igjen sto det et
  // tomt felt under kurven og gjorde seksjonen luftig på feil måte.
  footer: {
    height: 20,
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
