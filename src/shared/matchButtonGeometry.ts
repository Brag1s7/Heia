/**
 * KAMPKNAPPENS GEOMETRI — pillen i tab-barens midtplass (P4, skive 10).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ FANENE ER OG BLIR LIKE BREDE.
 *
 * Prototypen gir midtcella `1.4fr` mot naboenes `1fr`. Den kan ikke arves rått
 * hit: `tabBarItemStyle: {flex: 1.5}` ville gjort de FIRE ANDRE fanene
 * smalere og flyttet dem sidelengs — nøyaktig den bieffekten skive 10 er
 * forbudt å ha. Baren har i dag ingen `tabBarItemStyle` i det hele tatt, og
 * det skal den fortsatt ikke ha.
 *
 * I stedet gjelder prototypens EGEN oppførsel: pillen har `white-space:
 * nowrap` og flyter ut av cella si når ordet er langt. Det gjør vi også — men
 * med et budsjett, og med den ærlige konsekvensen skrevet ned:
 *
 *   TRYKKFLATEN ER FANEELEMENTET, IKKE PILLEN. React Navigation legger
 *   trykket på hele elementet (78 pt bredt på 390 pt, full barhøyde), godt
 *   over 44 pt og sentrert under pillen. De få punktene pillen stikker ut er
 *   DEKOR: et trykk der treffer naboen. Derfor holdes overflyten under
 *   `OVERFLOW_BUDGET`, som igjen er valgt slik at pillen aldri når naboens
 *   ikon (ikonpillen er 56 pt i et 78 pt element ⇒ 11 pt fri marg).
 *
 * ---------------------------------------------------------------------------
 * PROTOTYPENS TALL, OG HVORFOR DE IKKE HOLDER RÅTT
 *
 *   .matchbtn { font-size: 13.5; padding: 11px 16px; gap: 7px; }  (målt på 430 pt)
 *
 * «RAPPORTER» i 13.5 px med 16 pt luft er 116 pt bredt. En fanecelle på en
 * iPhone 14 er 78. Prototypen lar den flyte ut over naboene sine, og det er
 * greit i en statisk demo — her ville den lagt seg over Kalender-etiketten.
 *
 * Derfor er dette en TILPASSER, ikke en tabell: den finner den STØRSTE
 * typen som får plass innenfor budsjettet, ved å gi etter i denne
 * rekkefølgen — først luften, så ikonet, så typen. Teksten klippes aldri;
 * den er hele beskjeden.
 */

/**
 * Taket på Dynamic Type for pillen.
 *
 * ⚠️ LAVERE ENN GRIDDETS 1.6, og det er ikke en forglemmelse: tab-barens
 * `height: 88` er LÅST (P4 — endres den, reflower scenen midt i en push).
 * Griddet kan vokse nedover i en scroll; pillen kan ikke vokse i det hele
 * tatt.
 */
export const MATCH_BUTTON_FONT_CAP = 1.3;

/**
 * Den SOLIDE barens høyde (`styles.tabBar`, `TAB_BAR_GLASS_AB = false`).
 * Glasskapselen har sin egen, faste geometri i `tabBarLayout.ts`; begge er
 * konstante på tvers av kampknappens tilstander — det er P4-poenget.
 */
export const TAB_BAR_HEIGHT = 88;

/** Antall faner. Pillen deler bredde likt med de fire andre. */
export const TAB_COUNT = 5;

/**
 * Hvor mange punkter pillen får stikke ut PER SIDE av faneelementet.
 *
 * ⚠️ Et BUDSJETT, ikke en måling. Testen feiler hvis en tilstand bryter det,
 * og da er svaret å komprimere — ikke å heve tallet. 6 er valgt fordi
 * naboens ikonpille har 11 pt fri marg: pillen kan altså aldri nå den.
 */
export const OVERFLOW_BUDGET = 6;

/** Under denne blir ordet en hvisking. Da har vi et produktproblem, ikke et
 *  geometriproblem — testen sier fra. */
export const MIN_FONT = 10;

/**
 * Hvor mye `adjustsFontSizeToFit` får krympe teksten før den heller skulle
 * vært et kortere ord. Sikkerhetsnett, ikke en designbeslutning.
 */
export const MIN_FONT_SCALE = 0.85;

/**
 * Omtrentlig tegnbredde i displayfonten (Nunito ExtraBold), i em.
 *
 * ⚠️ HØYERE ENN `matchGridGeometry`s 0.62, OG DET ER EN RETTELSE FRA
 * TELEFONEN (Brage 2026-08-21: «teksten inne i knappen kuttes her»).
 * Griddets tall er målt på MINUTTER — sifre og små bokstaver. Pillen er
 * VERSALER, og en versal er merkbart bredere enn snittet i samme font.
 * Med 0.62 trodde tilpasseren at «RAPPORTER» fikk plass, og iOS kuttet den
 * til «RAPPORT…».
 *
 * Anslaget er nå konservativt, og `adjustsFontSizeToFit` i komponenten er
 * sikkerhetsnettet: den måler EKTE glyfer og krymper de siste prosentene
 * om anslaget fortsatt bommer. Estimatet bestemmer utgangspunktet;
 * native bestemmer fasit.
 */
const DISPLAY_EM = 0.72;

/** Prototypens `letter-spacing: .07em`. */
const TRACKING_EM = 0.07;

/** Bredde per tegn, i em, inkludert sporing. */
const PER_CHAR_EM = DISPLAY_EM + TRACKING_EM;

/** Luftkandidater, størst først. Første ledd settes per skjermtrinn. */
const PADDING_STEPS = [12, 9, 6];

export interface MatchButtonGeometry {
  /** Bredden på ett faneelement. Uendret fra dagens like fordeling. */
  itemWidth: number;
  /** Største pillebredde vi tillater: `itemWidth + 2 × budsjett`. */
  maxWidth: number;
  fontSize: number;
  /** Bokstavavstand i punkter. */
  letterSpacing: number;
  paddingH: number;
  /** Luft mellom glyf og tekst. */
  gap: number;
  /** Ikonets/prikkens bredde. 0 når ordet er for langt til å ha en. */
  glyphSize: number;
  hasGlyph: boolean;
  /**
   * Etiketten som FAKTISK skal tegnes.
   *
   * ⚠️ Kan være kortformen. På en 320 pt-skjerm er en fanecelle 64 pt, og
   * «RAPPORTER» i versaler får ikke plass ved siden av fire andre faner uten
   * å krympe til en hvisking. Da vinner lesbarheten, og a11y-labelen bærer
   * hele setningen uansett.
   */
  label: string;
  /** Pillens faktiske bredde med denne etiketten. */
  width: number;
  /** Hvor mange punkter den stikker ut per side. 0 når den får plass. */
  overflowPerSide: number;
  /** Pillens høyde. Konstant: barhøyden er det. */
  height: number;
  fontCap: number;
}

/**
 * Ren funksjon — testbar uten å rendre noe.
 * Se `__tests__/matchButtonGeometry.test.ts`, som vokter de faktiske
 * breddene på 320 / 375 / 390 / 393 / 430 pt × fontScale.
 */
export function matchButtonGeometry(
  width: number,
  rawFontScale: number,
  label: string,
  shortLabel?: string,
  hasGlyph = true,
  itemsWidth = width,
): MatchButtonGeometry {
  const full = fitLabel(width, rawFontScale, label, hasGlyph, itemsWidth);
  // Fikk den fulle etiketten plass uten å bli en hvisking? Da vinner den.
  if (!shortLabel || !full.tooSmall) return full;
  return fitLabel(width, rawFontScale, shortLabel, hasGlyph, itemsWidth);
}

/**
 * @param width       vinduets bredde — velger kompresjonstrinnet (typen
 *                    følger telefonklassen, som prototypen)
 * @param itemsWidth  bredden fanene FAKTISK deler. Glasskapselen er 2 × 12 pt
 *                    smalere enn vinduet (`tabBarItemsWidth`), og budsjettet
 *                    måles mot den — ellers hadde pillen trodd den hadde
 *                    4,8 pt mer plass enn den har.
 */
function fitLabel(
  width: number,
  rawFontScale: number,
  label: string,
  hasGlyph: boolean,
  itemsWidth: number,
): MatchButtonGeometry & {tooSmall: boolean} {
  const fs = Math.min(Math.max(rawFontScale, 1), MATCH_BUTTON_FONT_CAP);

  // Tre kompresjonstrinn, samme terskler som griddet — appen skal ikke ha to
  // sett skjermbreddegrenser.
  //   0: 390 pt og opp   1: 375-389   2: under 375
  const step = width < 375 ? 2 : width < 390 ? 1 : 0;

  const itemWidth = itemsWidth / TAB_COUNT;
  const maxWidth = itemWidth + OVERFLOW_BUDGET * 2;

  // Prototypens uttrykk, klemt av Dynamic Type. Dette er TAKET — tilpasseren
  // går aldri over det, bare under.
  const baseFont = [13.5, 12.5, 11.5][step] * fs;
  const gap = [7, 6, 5][step];
  const glyphSize = [17, 16, 15][step];

  const glyph = hasGlyph ? glyphSize + gap : 0;
  const chars = Math.max(label.length, 1);

  // Finn den STØRSTE typen som får plass. Luften gir etter først: en
  // trangere pille med lesbart ord slår en luftig pille med en hvisking.
  // Trinn 2 (under 375 pt) får ETT luftsteg til: i glasskapselen er en
  // fanecelle på 320 pt 59 pt bred, og «HEIA!» med 👏 lå 0,15 pt over
  // budsjettet med 6 pt luft. Luften gir etter, ikke budsjettet (og ikke
  // typen — den står allerede på MIN_FONT der).
  const candidates = [
    [16, 13, 12][step],
    ...PADDING_STEPS,
    ...(step === 2 ? [5] : []),
  ];
  let best = {fontSize: 0, paddingH: candidates[candidates.length - 1]};
  for (const paddingH of candidates) {
    const avail = maxWidth - paddingH * 2 - glyph;
    const fitted = Math.min(baseFont, avail / (chars * PER_CHAR_EM));
    // Større type vinner; ved likhet vinner den luftigste (candidates er
    // sortert størst luft først, så `>` alene gir den oppførselen).
    if (fitted > best.fontSize) {
      best = {fontSize: fitted, paddingH};
    }
  }

  // Under MIN_FONT ville ordet blitt en hvisking. Da klemmer vi IKKE videre —
  // vi sier fra (`tooSmall`), og kallstedet bytter til kortformen.
  const tooSmall = best.fontSize < MIN_FONT;
  const fontSize = Math.max(best.fontSize, MIN_FONT);
  const letterSpacing = fontSize * TRACKING_EM;
  const pillWidth = chars * fontSize * PER_CHAR_EM + best.paddingH * 2 + glyph;

  return {
    tooSmall,
    label,
    itemWidth,
    maxWidth,
    fontSize,
    letterSpacing,
    paddingH: best.paddingH,
    gap,
    glyphSize: hasGlyph ? glyphSize : 0,
    hasGlyph,
    width: pillWidth,
    overflowPerSide: Math.max(0, (pillWidth - itemWidth) / 2),
    // 11 + 11 luft + ~16 innhold i prototypen. Konstant, fordi barhøyden er
    // det — pillen vokser aldri vertikalt.
    height: 38,
    fontCap: MATCH_BUTTON_FONT_CAP,
  };
}
