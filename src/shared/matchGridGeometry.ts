import {PixelRatio, useWindowDimensions} from 'react-native';
import {useMemo} from 'react';

/**
 * HENDELSESGRIDDETS GEOMETRI — delt, ikke duplisert.
 *
 * Samme presedens som `headerGeometry.ts`: tallene bor ett sted fordi de
 * deles av `EventNode`, `MatchEventRow` og `MatchTimeline`, og en tredje kopi
 * ville gjort kontrakten umulig å holde.
 *
 * ---------------------------------------------------------------------------
 * PROTOTYPENS TALL ER ÉN KJEDE, IKKE FIRE MAGISKE KONSTANTER
 *
 *   [ railLeft 13.5 ][ node 27 ][ gap1 3.5 ][ minutt 30, høyrestilt ][ gap2 8 ][ innhold … ][ gutter 22 ]
 *           0            13.5→40.5     44 ──────────────── 74          82                    W−22
 *
 *   13.5 + 27 = 40.5  →  +3.5 = 44 (minuttets venstrekant)
 *   44 + 30 = 74 (minuttets høyrekant)  →  +8 = 82 (innholdet starter)
 *   Nodesenter = 13.5 + 13.5 = 27
 *
 * ⚠️ ÉN BEVISST AVVIK FRA PROTOTYPEN: den har `.node{left:26}` og
 * `.thread{left:27}` — altså nodesenter 26 og trådsenter 27.75, 1.75 pt
 * skjevhet. Usynlig i nettleseren, synlig på @3x der noden sitter PÅ linja.
 * Handoff-en sier «node sentrert på x=27», og den er fasit: railLeft er
 * derfor 13.5, ikke 12.5. 44 / 74 / 82 er uendret — bare gap1 tar forskjellen.
 *
 * At det dekomponerer så rent er hele grunnen til at griddet KAN gjøres
 * responsivt uten å røre designet: 82 er ikke et tall noen valgte, det er
 * summen av fire ledd. Komprimerer man leddene, følger 82 etter av seg selv.
 *
 * ---------------------------------------------------------------------------
 * HVA SOM ER LÅST OG HVA SOM KAN GI ETTER (Brage 2026-08-20)
 *
 *   LÅST:    ikonet og minuttkolonnens VERTIKALE FLUKT. Minuttet står alltid
 *            i samme kolonne, optisk sentrert mot noden — ved ALLE
 *            tekststørrelser. Det er dette som gjør at man kan sveipe og bare
 *            lese 34′ · 31′ · 29′ · 25′.
 *   GIR ETTER: innrykk og gap (railLeft, gap1, gap2, gutter).
 *   ALDRI:   klippet tekst.
 *
 * Prototypen er målt på 430 pt (iPhone Pro Max-klassen). Den er fasit for
 * UTTRYKKET, ikke en universell konstant — derfor denne fila.
 */

/**
 * Taket på Dynamic Type. Samme verdi som `TimeField.tsx` og `DayCell.tsx`
 * allerede bruker, så griddet ikke innfører en ny terskel i appen.
 *
 * ⚠️ Denne MÅ settes som `maxFontSizeMultiplier` på HVER `<Text>` i griddet.
 * Klemmer du geometrien men ikke teksten (eller omvendt), åpner det seg et
 * gap som vokser helt til iOS' maksimale ×3.571 — og da klippes teksten,
 * som er det ene som aldri får skje.
 */
export const GRID_FONT_CAP = 1.6;

/**
 * Stadionkrittets strekbredde. Bor her, ikke i tokens: den er geometri, og
 * den skal rundes til fysisk piksel ved bruk — 1.5 pt på @3x er 4.5
 * device-piksler og blir uskarp uten avrunding.
 */
export const CHALK_WIDTH = 1.5;

/** Nodens diameter. Vokser ALDRI med teksten — den er et ikon, ikke et ord. */
export const NODE_SIZE = 27;
/** Ikonet inni noden. */
export const NODE_ICON = 15;
/** Retningsmarkørens lille prikk — samme senterlinje som nodene. */
export const NOW_DOT = 11;

/** Omtrentlig tegnbredde i displayfonten (Nunito ExtraBold), i em. */
const DISPLAY_EM = 0.62;

/** Minuttets fontstørrelse ved fontScale 1 (prototypens `.emin`). */
const MINUTE_FONT = 13.5;
/** Minuttkolonnens bredde ved fontScale 1. «120′» får plass. */
const MINUTE_WIDTH = 30;

export interface MatchGrid {
  /** Skjermbredden geometrien er regnet for. Målswellen og krittlinja tegnes
   *  som svg og trenger et FAKTISK tall, ikke '100%'. */
  width: number;
  /** Venstrekant av nodesporet. */
  railLeft: number;
  nodeSize: number;
  iconSize: number;
  /** Nodens senter — krittlinja og retningsmarkøren avledes av denne. */
  nodeCenter: number;
  /** Krittlinja, rundet til fysisk piksel. */
  threadLeft: number;
  threadWidth: number;
  /** Minuttkolonnen. Høyrestilt innenfor `minuteWidth`. */
  minuteLeft: number;
  minuteWidth: number;
  /** Loddrett forskyvning som sentrerer minuttets tekstlinje mot noden. */
  minuteTop: number;
  minuteFontSize: number;
  /** Innholdets venstrekant — prototypens 82. */
  contentLeft: number;
  /** Faktisk tilgjengelig innholdsbredde. */
  contentWidth: number;
  /** Høyremarg. */
  gutter: number;
  /** MÅL!-ordets størrelse. Det første som brekker, ikke minuttkolonnen. */
  goalFont: number;
  /** Sant når «MÅL!» og stillingen ikke lenger får plass på samme linje. */
  goalStacked: boolean;
  /** Erstatter prototypens CSS `max-width: 33ch` for brødtekst. */
  measureMax: number;
  fontCap: number;
}

/**
 * Ren funksjon — testbar uten å rendre noe. Se `__tests__/matchGrid.test.ts`,
 * som vokter de faktiske tallene på 320 / 375 / 390 / 430 × fontScale.
 */
export function matchGrid(width: number, rawFontScale: number): MatchGrid {
  // KLEM FØRST. Alt under regner på den klemte skalaen, og `GRID_FONT_CAP`
  // sendes tilbake ut så tekstene kan klemmes med nøyaktig samme verdi.
  const fs = Math.min(Math.max(rawFontScale, 1), GRID_FONT_CAP);

  // Tre kompresjonstrinn. 0 = prototypen urørt.
  //   0: 390 pt og opp  (iPhone 14/15/16, Plus, Pro Max)
  //   1: 375-389        (iPhone SE 3, 13 mini)
  //   2: under 375      (SE 1./2. gen — deployment target er 15.1, så de er
  //                      formelt støttet. Heves target til 16.0 forsvinner
  //                      dette trinnet, men det koster ingenting å ha det.)
  const step = width < 375 ? 2 : width < 390 ? 1 : 0;

  const railLeft = [13.5, 11, 9][step];
  const gap1 = [3.5, 3, 3][step];
  const gap2 = [8, 7, 6][step];
  const gutter = [22, 18, 16][step];

  // Minuttet er det ENESTE i skinna som følger fonten. Noden gjør det ikke.
  // Derfor skyves innholdet automatisk til høyre ved stor tekst i stedet for
  // at «120′» spiser innholdet — kolonnen er fast innenfor én enhet og én
  // tekststørrelse, som er nøyaktig det skannbarheten krever.
  const minuteFontSize = MINUTE_FONT;
  const minuteWidth = Math.ceil(MINUTE_WIDTH * fs);
  const minuteLeft = railLeft + NODE_SIZE + gap1;
  const contentLeft = minuteLeft + minuteWidth + gap2;
  const contentWidth = width - contentLeft - gutter;

  const nodeCenter = railLeft + NODE_SIZE / 2;
  const threadWidth = PixelRatio.roundToNearestPixel(CHALK_WIDTH);
  const threadLeft = PixelRatio.roundToNearestPixel(
    nodeCenter - threadWidth / 2,
  );

  // Den låste detaljen: minuttets TEKSTLINJE sentreres mot noden, ikke raden.
  // Absolutt posisjonering på begge, aldri flex — en flex-basert justering
  // flytter seg når linjehøyden vokser, og da vandrer minuttet oppover
  // kolonnen ved stor tekst.
  const minuteLine = Math.ceil(minuteFontSize * 1.25 * fs);
  const minuteTop = Math.max(0, Math.round((NODE_SIZE - minuteLine) / 2));

  const goalFont = step === 2 ? 38 : step === 1 ? 42 : 46;
  // «MÅL!» + stillingen står på én linje med space-between i prototypen.
  // Terskelen må avledes av den FAKTISKE typografien, ikke av et løsrevet
  // tall: «MÅL!» er ~2.6 tegnbredder, stillingen «10–10» ~4.4, og de skiller
  // lag med spacing.md. Ganges opp med fontskalaen, som er det tekstene
  // faktisk rendres i. Under det stables de i stedet for å trunkeres.
  // «MÅL!» er 4 tegn, verste stilling «10–10» er 5. Nunito ExtraBold er bred
  // — ~0.62 em per tegn. `spacing.md` (12) skiller dem.
  const goalNeeds =
    (goalFont * DISPLAY_EM * 4 + goalFont * 0.87 * DISPLAY_EM * 5 + 12) * fs;
  const goalStacked = contentWidth < goalNeeds;
  // ~0.5 em per tegn er en god nok tilnærming til CSS' `ch` for brødtekst.
  const measureMax = Math.round(33 * 0.5 * 16 * fs);

  return {
    width,
    railLeft,
    nodeSize: NODE_SIZE,
    iconSize: NODE_ICON,
    nodeCenter,
    threadLeft,
    threadWidth,
    minuteLeft,
    minuteWidth,
    minuteTop,
    minuteFontSize,
    contentLeft,
    contentWidth,
    gutter,
    goalFont,
    goalStacked,
    measureMax,
    fontCap: GRID_FONT_CAP,
  };
}

/**
 * `useWindowDimensions` gir BÅDE bredde og fontScale, og begge oppdateres
 * live (RCTDeviceInfo sender ny event når brukeren endrer tekststørrelse i
 * Innstillinger mens appen kjører). `Dimensions.get()` ville frosset begge.
 */
export function useMatchGrid(): MatchGrid {
  const {width, fontScale} = useWindowDimensions();
  return useMemo(() => matchGrid(width, fontScale), [width, fontScale]);
}
