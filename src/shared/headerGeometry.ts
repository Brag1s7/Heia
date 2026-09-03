/**
 * Hovedflatenes header-geometri — DELT, ikke duplisert.
 *
 * Hjem, Kalender og Varsler bruker TeamHeader (lagfarget). Profil bruker
 * ProfileHeader (Heias mørkegrønne — Profil er den ene hovedflaten som IKKE
 * er lag-scopet: «Min støtte» er avtalene dine på tvers av lag,
 * «Klubbetalinger» er en juridisk enhet, «Heia Ops» er alle klubber).
 *
 * Det som gjør dem til ÉN familie er formen, ikke fargen: samme ytre høyde,
 * samme safe-area-integrasjon og nøyaktig samme banesirkel. Derfor bor tallene
 * her i stedet for i hver komponent — en tredje kopi ville gjort kontrakten
 * under umulig å holde.
 *
 * ⚠️ BANESIRKELEN DELES OGSÅ MED StadiumSurface (arcOuter/arcInner). Kortenes
 * buer sitter konsentrisk 30 px inn fra høyre og 10 px opp fra bunnen, med
 * radius 100 og 68 og strek 1.5. Headerne bruker de SAMME absolutte verdiene,
 * ikke skalerte: lik radius gir lik krumning, og da leser headeren og
 * kampkortene som samme form — ikke som to som ligner på hverandre.
 * Endrer du disse, endre StadiumSurface tilsvarende.
 */
export const ARC_INSET_RIGHT = 30;
export const ARC_INSET_BOTTOM = 10;
export const ARC_R_OUTER = 100;
export const ARC_R_INNER = 68;
export const ARC_STROKE = 1.5;

/** Litt tydeligere enn kortenes 0.13/0.09 — headeren er en større flate og
 *  tåler mer før det blir dekor. */
export const ARC_OPACITY_OUTER = 0.18;
export const ARC_OPACITY_INNER = 0.11;

/**
 * Høyden på headerens innholdsrad, under safe area.
 *
 * TeamHeader får den fra lagmerket: 38 px merke + 2 px plate på hver side.
 * ProfileHeader treffer den samme tallet med Avatar `md` (40) + 1 px ring.
 * Begge lander på 42 VED KONSTRUKSJON, så fanebytte ikke flytter innholdet
 * en piksel — og TeamHeaders egen høydevakt (neste hendelse-kort skal synes
 * uten scrolling) står urørt.
 */
export const HEADER_CONTENT_HEIGHT = 42;

// ---------------------------------------------------------------------------
// MASTHEAD (Brage 2026-09-03, LÅST): laghodet er gjennomsiktig innhold oppå
// ÉTT lerret (DaylightGround i masthead-modus) som spenner fra statuslinja
// til bunnen. Lagfargen er LYS i toppen — se shared/masthead.ts. Buene er
// én familie: konstant gjennom laghodet, fadet ut i kroppen.
// ---------------------------------------------------------------------------

/** Luften under innholdsraden. Laghodets høyde = insets.top + 42 + 12 =
 *  113 pt på iPhone m/ Dynamic Island — nøyaktig `mastheadHeight`. */
export const HEADER_FOOT_HEIGHT = 12;

/** Buene fades ut over denne andelen av kroppshøyden under laghodet
 *  (≈ 89 pt på 739 pt — der den ytre buen uansett slutter). */
export const ARC_CONTINUATION_FRACTION = 0.12;
