/**
 * TAB-BARENS GEOMETRI — den flytende glasskapselen (Brage 2026-09-03).
 *
 * ---------------------------------------------------------------------------
 * HVA SOM ER LÅST (Brages godkjenning, ordrett i tall):
 *   12 pt inn fra sidene · 64 pt synlig kapselhøyde · full radius ·
 *   bunn ved max(10, safe area − 6) pt fra skjermkanten (runde 3, Brage:
 *   «ligger for høyt, svever» — 8 pt lenger ned enn safe area + 2; på
 *   iPhone m/ hjemindikator 34 → 28 pt, indikatoren (topp ≈ 13 pt) berøres
 *   ikke; uten indikator 10 pt) · skjerminnhold og DaylightGround løper
 *   UNDER.
 *
 * ---------------------------------------------------------------------------
 * REN MODUL. Ingen React, ingen native. Alt som kan regnes ut fra tall
 * regnes ut her, så `__tests__/tabBarLayout.test.ts` kan bevise regnestykket
 * uten å rendre noe — og så navigatoren, kampknappen og skjermene leser
 * SAMME tall fra samme sted.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ SAFE AREA TELLES ÉN GANG. Baren er absolutt og dekker selv safe area
 * (containeren er kapsel + løft + inset høy, og `useBottomTabBarHeight()`
 * rapporterer NØYAKTIG den høyden). En skjerm som padder med
 * `insets.bottom + barhøyde` ville reservert safe area to ganger — det er
 * det `bottomContentPadding` finnes for.
 */

/** Bryteren. `false` = dagens solide bar (høyde 88), skjermene som før. */
export const TAB_BAR_GLASS_AB = true;

export const CAPSULE = {
  /** Punkter inn fra hver skjermkant. */
  inset: 12,
  /** Synlig kapselhøyde — der fanene bor. */
  height: 64,
  /** Minste avstand kapselunderkant → skjermkant (enheter uten indikator). */
  minGap: 10,
  /** Hvor langt kapselen får gå INN i safe area på enheter med indikator. */
  gapIntoInset: 6,
  /** Full radius = halve høyden. Et EKTE tall: native `cornerRadius` kan
   *  ikke ta `radius.full` (9999). */
  radius: 32,
} as const;

/** Rutenavnet der baren er skjult — komponeringslinja skal ikke ligge over
 *  en synlig glassbar (Brage). */
export const TAB_BAR_HIDDEN_ROUTES: ReadonlySet<string> = new Set(['Comments']);

/**
 * Avstanden fra kapselens underkant til skjermkanten (safe-area-bevisst):
 * max(10, inset − 6). Erstatter «safe area + løft» (runde 3, 8 pt ned).
 */
export function capsuleBottomGap(bottomInset: number): number {
  return Math.max(CAPSULE.minGap, bottomInset - CAPSULE.gapIntoInset);
}

/**
 * Barcontainerens totale høyde: det `useBottomTabBarHeight()` kommer til å
 * rapportere, og dermed det skjermene skal reservere (kapsel + bunnavstand;
 * safe area er INNE i bunnavstanden).
 */
export function tabBarTotalHeight(bottomInset: number): number {
  return CAPSULE.height + capsuleBottomGap(bottomInset);
}

/**
 * Bredden fanene deler. Kapselen er 2 × inset smalere enn vinduet, og de
 * fem faneelementene deler DEN bredden likt — kampknappens budsjett måles
 * mot den, ikke mot vinduet.
 */
export function tabBarItemsWidth(windowWidth: number): number {
  return TAB_BAR_GLASS_AB ? windowWidth - CAPSULE.inset * 2 : windowWidth;
}

/**
 * Bunnpadding for scrollflater i en tab-skjerm.
 *
 *   baren montert (høyde > 0):  barhøyde + pust    — safe area er INNE i baren
 *   baren skjult/utenfor tabs:  safe area + pust   — ingen bar å reservere
 *
 * `breathing` er luften mellom siste innhold og kapselens overkant.
 */
export function bottomContentPadding(
  tabBarHeight: number,
  bottomInset: number,
  breathing: number,
): number {
  return (tabBarHeight > 0 ? tabBarHeight : bottomInset) + breathing;
}

/** Skal baren skjules for denne fokuserte ruta i stacken? `undefined` =
 *  stacken har ikke rendret ennå = roten = synlig. */
export function tabBarHiddenFor(focusedRouteName: string | undefined): boolean {
  return (
    focusedRouteName !== undefined &&
    TAB_BAR_HIDDEN_ROUTES.has(focusedRouteName)
  );
}
