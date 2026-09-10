/**
 * FEEDGLASS V5 — ARENAGLASS, LYS (Brage 2026-09-04, kveld, «siste sjanse»).
 * Brages referanse: Apples iOS 26-widgets over et foto — glass som er
 * MØRKERE enn verden bak, verden lever gjennom, lyst blekk, lysende rand —
 * og kampkortet (StadiumGlass): «samme fade/stil/lysstyrke som kampkortet,
 * ikke like mørkt; nå popper feedcard for mye». Alt lyst glass over den
 * lyse grunnen har blitt en blek plate (A2, V2, V3, V3.1, V4, V4.1).
 * Retningen snus: feedkortet er kampkortets materiale, lysere.
 *
 * Grunnen er LÅST og jevn (0,04/255 lokal kontrast), så ujevnheten og
 * dybden må bo i kortet. REN MODUL uten React Native: `LiquidGlassSurface`
 * og det native glasset tegner tallene, `__tests__/glassOptics.test.ts`
 * vokter dem.
 *
 * LAGENE (nederst først):
 *   kropp      systemets CLEAR-glass («Meet Liquid Glass»: Clear over rikt
 *              innhold + et dimmende lag) med arena-dimming
 *              (`FEED_GLASS.card`): grunnen lever gjennom, kroppen er
 *              dypere enn den. Kantlinsen er Apples.
 *   fade       tonal reise som kampkortet, 150°: arenaTop → arenaBottom →
 *              timeline, delvis (`fade`) — dypere mot nedre høyre.
 *   skyer      mørk Heia Deep-sky + lys sky (alfa-PNG, eget utsnitt per
 *              kort) → ujevn tetthet, «flurry».
 *   opptak     aqua-lys i øvre venstre hjørne; neon-refleks i nedre høyre
 *              (banen under flomlys) — kampkortets språk.
 *   høylys     1,5 pt under toppkanten, tyngdepunkt venstre.
 *   kant       aqua-hvitt gradientstrøk 1,5 pt (0,40 → 0,16 → 0,06).
 *   spekular   (native, `specular`) et mykt lysbånd som glir over glasset
 *              når kortet ruller gjennom skjermen — bevegelsen i materialet.
 *   skygge     grønn 0,22 (kampkortets), på wrapperen.
 *   blekk      lyst (MATCH_INK) når native-glasset er aktivt; fallbacken
 *              (eldre iOS/Android/Reduce Transparency) er lys opal m/ mørkt.
 */

export type Rgb = readonly [number, number, number];

/** `nativeID` på grunnen — det native glasset finner den i vinduet. */
export const BACKDROP_SOURCE_ID = 'daylight-ground';

/** Tab-barens perle — kroppens tint har samme hue. */
export const BAR_PEARL: Rgb = [244, 246, 245];

/**
 * A/B-BRYTEREN — MIDLERTIDIG (Brage 2026-09-06, materialtest på Hjem).
 *   'silver'  NY KANDIDAT: sølvhvitt, lyst, frostet glass med egen identitet
 *             (spesifikasjonen `SILVER` nederst). Mørkt blekk.
 *   'arena'   DAGENS KORT (FeedGlass V5): Clear + arena-dimming, kampkortets
 *             materiale lysere, lyst blekk. Urørt.
 * Bytt ordet — Fast Refresh — alt annet følger: kroppens tint, materiallaget
 * (`GlassOptics`), skyggen, blekket i FeedCard og spekularbåndet.
 * Fjernes (sammen med den tapende kandidaten) når Brage har dømt på telefon.
 */
export type FeedMaterial = 'arena' | 'silver' | 'frost';
export const FEED_MATERIAL = 'frost' as FeedMaterial;
/** Lyst blekk (MATCH_INK) på feedkortet — kun arenaglasset. */
export const FEED_INK_LIGHT = FEED_MATERIAL === 'silver';

/**
 * KROPPEN, ARENA (V5). Clear-glass med arena-dimming: kortet er dypere enn
 * grunnen. Riggen 2026-09-04 (arena_grid): 0,44 gir 3,8:1 for lyst blekk
 * over neon; 0,54 + fade 0,45 gir 4,4:1 over neon, 4,1 over lys, 5,8 over
 * mørk. 0,56 valgt. Aldri over 0,70 — da dør grunnen. VIKTIG samme.
 */
export const FEED_GLASS_MAX_ALPHA = 0.7;
export const ARENA_DIM: Rgb = [23, 61, 45];
export const ARENA_GLASS = {
  card: {pearl: ARENA_DIM, alpha: 0.56, sheen: 0.06, style: 'clear'},
  /** VIKTIG: samme arenaglass — gullpillen bærer aksenten. */
  important: {pearl: ARENA_DIM, alpha: 0.56, sheen: 0.06, style: 'clear'},
} as const;

/**
 * KROPPEN, SØLV. Clear-glass UTEN tint (alfa 0 → tintColor nil): systemet
 * gir blur og kantlinse, og lar grunnen gjennom uforfalsket — materialet
 * (`SILVER`) legger sølvhvitt oppå med varierende tetthet, så det er
 * materiallaget alene som avgjør hvor mye grunn som slipper gjennom hvor.
 * Regular ble prøvd seks ganger (A2…V4.1): Apples adaptive melketint
 * jevnet alt til én plate. VIKTIG samme; gullpillen bærer aksenten.
 */
export const SILVER_PEARL: Rgb = [230, 234, 237];
export const SILVER_GLASS = {
  card: {pearl: SILVER_PEARL, alpha: 0, sheen: 0.06, style: 'clear'},
  important: {pearl: SILVER_PEARL, alpha: 0, sheen: 0.06, style: 'clear'},
} as const;

/**
 * FROST — PROTOTYPENS KORT (Brage 2026-09-06, vedtatt). Lys mint-frost:
 * regular systemglass med perlegrå tint, én lys kant (topp/venstre) og
 * svak blekk-kant (nede/høyre), myk grønn skygge. Ingen tekstur, ingen
 * skyer, ingen neon. Rammen bærer bylinen; PLATEN (lysere, konsentrisk)
 * bærer innhold OG handlinger. Kampkortet beholder StadiumGlass og får
 * samme plate som tynt lyst lag. Alle tall her er Fast Refresh.
 */
/**
 * RUNDE 2 (telefon 23:13): 0,80 perlegrå ble en dekkende grå plate — grunnen
 * døde og glasset forsvant. Prototypens ramme er GJENNOMSIKTIG: nesten hvit
 * tint på lav dekning, så grunnen gir minten (grå øverst, mint nederst) og
 * sheenen gir lysblomsten. Tallene er de telefongodkjente fra 89e52e7
 * (2026-09-02, «funker veldig bra»): perle 244/246/245 på 0,34, sheen 0,16.
 */
/**
 * RUNDE 4 (telefon 23:26): hvit tint på 0,36 tok fargen fra grunnen alene —
 * nederst på skjermen (krem) ble ramme, plate og piller hvitt på hvitt,
 * «ser ut som noe er feil». Kampkortet holder fordi rammen har EGEN farge
 * som grunnen bare modulerer. Samme grep her: blek mintperle som egen
 * farge, høyere dekning — aldri hvit over krem, mint over neon, lys
 * grågrønn over mørk topp. Platen og pillene er alltid lysere enn rammen.
 */
export const FROST_PEARL: Rgb = [214, 244, 230];
export const FROST_GLASS = {
  card: {pearl: FROST_PEARL, alpha: 0.55, sheen: 0.14, style: 'regular'},
  important: {
    pearl: [246, 240, 226] as Rgb,
    alpha: 0.52,
    sheen: 0.12,
    style: 'regular',
  },
} as const;
export const FROST = {
  /** Rammen: radius, padding-boks. */
  radius: 28,
  padding: 12,
  /** Platen i det lyse kortet. */
  plate: {
    // Runde 3: 0,62 var «altfor hvit». Samme forhold som kampkortet: platen
    // er et tynt lysere lag på rammen, ikke en hvit boks.
    fill: 'rgba(255, 255, 255, 0.3)',
    lip: 'rgba(255, 255, 255, 0.7)',
    radius: 16,
    paddingH: 14,
    paddingV: 12,
  },
  /**
   * Platen i kampkortet — en FORDYPNING, ikke et lyst lag (Brage
   * 2026-09-10: «gjør den heller til en mørkere fordypning i samme
   * familie»).
   *
   * Den var et krittvask på 0,07 som la seg OPPÅ glasset og gjorde flaten
   * flat og lys. Nå senkes den i stedet: ett hakk dypere grønn, så
   * «FRA KAMPEN», kapselen og hendelsesteksten står sterkere på den enn på
   * kortet rundt — og feedkortet blir tydelig roligere enn heroen.
   *
   * Kantene forteller hvilken vei den går: skygge langs TOPPEN (lyset når
   * ikke ned i fordypningen) og et hint av lys langs BUNNEN. Motsatt av en
   * hevet flate, som er hele poenget.
   */
  matchPlate: {
    fill: 'rgba(3, 30, 22, 0.3)',
    lipTop: 'rgba(0, 0, 0, 0.16)',
    lipBottom: 'rgba(234, 255, 246, 0.08)',
    radius: 16,
  },
  /** Kanten (prototypen): lys topp/venstre, svak blekk nede/høyre. */
  /** Kanten (prototypen): hvit rand hele veien, sterkest topp/venstre. */
  edge: {
    top: 'rgba(255, 255, 255, 0.9)',
    left: 'rgba(255, 255, 255, 0.75)',
    right: 'rgba(255, 255, 255, 0.45)',
    bottom: 'rgba(255, 255, 255, 0.4)',
  },
  /** Heia/Kommenter (prototypen): lys frostpille med fin hvit kant. */
  pill: {
    // Runde 3: mer glass — tynt lys lag med fin kant, ingen skygge, så
    // pillene ikke konkurrerer med platen (som kampkortets lyse lag).
    fill: 'rgba(255, 255, 255, 0.34)',
    edge: 'rgba(255, 255, 255, 0.6)',
    ink: '#11241B',
    shadow: {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0,
      color: 'rgba(8, 57, 46, 0)',
    },
  },
  /**
   * Trykklyset i det lyse glasset: mint, ikke hvitt (hvitt 0,16 på lys
   * flate vasket ut kortet, kampkortets hvite lys på mørkt er riktig).
   */
  press: '#02FFAB',
  /** Kampkortets trykklys via sensoren: hvitt × 0,6 ≈ 0,10 (StadiumGlass-nivået). */
  matchPress: 'rgba(255, 255, 255, 0.6)',
  /** Rollemerket på rammen: hvit pille, grønt blekk. */
  role: {fill: 'rgba(255, 255, 255, 0.7)'},
  photoRadius: 12,
} as const;

/** Kroppen som tegnes — følger bryteren. */
export const FEED_GLASS =
  FEED_MATERIAL === 'frost'
    ? FROST_GLASS
    : FEED_MATERIAL === 'silver'
    ? SILVER_GLASS
    : ARENA_GLASS;

/** Materiallaget i JS (`GlassOptics`): PÅ for feedkortet. */
export const FEED_OPTICS_EDGES = true;

/** Spekularbåndet (native, arena): sølvkandidaten har ingen bevegelse i denne runden. */
export const FEED_SPECULAR = FEED_MATERIAL === 'arena' ? 0.12 : 0;

/**
 * MATERIALET i kortet (JS-laget over glasset + native spekular). Alle tall
 * Fast Refresh. Teksturene: src/assets/images/frost-dark.png (Heia Deep)
 * og frost-light.png (hvit), to oktaver støy, eget utsnitt per kort.
 */
export const FEED_FROST = {
  enabled: true,
  /** Det native frostlaget (V4): AV — JS eier materialet. */
  native: false,
  /** Tonal fade som kampkortet (timeline-stoppets alfa; de to over er 0,4/0,7 av den). */
  fade: 0.45,
  /** Mørk Heia Deep-sky, opasitet — ujevnheten. */
  dark: 0.24,
  /** Lys sky, opasitet — svak, løfter flekkvis. */
  light: 0.1,
  /** Aqua-opptak i øvre venstre hjørne. */
  uptake: 0.1,
  uptakeColor: '#8FFFE0',
  /** Neon-refleks i nedre høyre hjørne (banen under flomlys). */
  neon: 0.14,
  /** Indre topphøylys 1,5 pt under kanten. */
  highlight: 0.16,
  /** Kantstrøkene (FEED_EDGES) — 0–1. */
  edge: 1,
  /** Spekularbåndet som glir med scrollen (native). 0 = av. Se FEED_SPECULAR. */
  specular: FEED_SPECULAR,
  /** Skyggen (FEED_SHADOW) — bor på wrapperen. */
  shadow: 0.22,
  /** Teksturens størrelse relativt til kortet: 1,9 = store, myke skyer. */
  scale: 1.9,
} as const;

/** Riggens intervaller — vaktes i testen. */
export const FROST_RANGES = {
  fade: [0.3, 0.6],
  dark: [0.15, 0.35],
  light: [0.05, 0.16],
  uptake: [0.05, 0.16],
  neon: [0.08, 0.2],
  highlight: [0.1, 0.24],
  specular: [0, 0.2],
  shadow: [0.15, 0.3],
  scale: [1, 2.5],
} as const;

/**
 * Refraksjonen (native). Alle tall i punkter; justerbare via Fast Refresh.
 * AV (2026-09-04 kveld): over den jevne grunnen er refraksjonen usynlig
 * (0,04 → 3/255), og den koster GPU per scroll-ramme. Knapp for senere —
 * blir synlig den dagen grunnen får struktur.
 */
export const FEED_REFRACTION = {
  enabled: false,
  /** Kantlinsens forskyvning (Brage: 6–12). */
  strength: 9,
  /**
   * Linsesonenes forskyvning gjennom sentrum. Grunnen er en jevn gradient:
   * 9 pt er usynlig (riggmålt 2026-09-04); skyer krever titalls punkter.
   */
  zone: 72,
  /** Forstørrelse om kortets sentrum (Brage: 1,03–1,06). */
  scale: 1.04,
  /** Frost bakt inn i den delte grunnteksturen (én gang), Gauss-radius. */
  blur: 8,
  /** Metning i den samplede grunnen (Brage: 0,75–0,85). */
  saturation: 0.8,
  /** Optisk parallakse mot scroll — 0 = av mens laggingen isoleres (Brage). */
  parallax: 0,
  /** Oppdater per scroll-ramme (NO = kun layout + scroll-stopp). */
  live: true,
} as const;

/** Brages intervaller for refraksjonen — vaktes i testen. */
export const REFRACTION_RANGES = {
  strength: [6, 12],
  zone: [30, 90],
  scale: [1.03, 1.06],
  saturation: [0.75, 0.85],
  parallax: [0, 8],
} as const;

/** Kantfysikken — kampkortets kantlys på et lysere kort. `width` = synlig pt. */
export const FEED_EDGES = {
  /** Aqua-hvitt gradientstrøk: lyset som treffer materialet, ikke en ramme. */
  light: {
    color: '#D6FFF1',
    width: 1.5,
    stops: [
      [0, 0.4],
      [0.5, 0.16],
      [1, 0.06],
    ],
  },
  /** Smalt indre høylys (caustic) i øvre venstre hjørne, 1,5 pt innenfor. */
  glint: {
    color: '#FFFFFF',
    width: 1,
    inset: 1.5,
    reach: 0.38,
    stops: [
      [0, 0.28],
      [1, 0],
    ],
  },
  /** Svak mørk indre kant fra nedre høyre hjørne — tykkelse. */
  dark: {
    color: '#08392E',
    width: 1.5,
    stops: [
      [0, 0.18],
      [0.48, 0],
    ],
  },
} as const;

/** Kampkortets grønne skygge, myk, under kortet. */
export const FEED_SHADOW = {
  offsetX: 0,
  offsetY: 8,
  blurRadius: 24,
  spreadDistance: 0,
  color: 'rgba(11, 59, 42, 0.22)',
} as const;

// ---------------------------------------------------------------------------
// Farge (delt av testene)
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

export function parseHex(hex: string): Rgb {
  if (!HEX.test(hex)) throw new Error(`Ikke en #rrggbb-farge: ${hex}`);
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** `rgba(r, g, b, a)` slik GLASS-tintene skrives. */
export function parseRgba(s: string): {rgb: Rgb; alpha: number} {
  const m = s.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/,
  );
  if (!m) throw new Error(`Ikke en rgba(): ${s}`);
  return {rgb: [+m[1], +m[2], +m[3]], alpha: +m[4]};
}

export function rgbaString(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// SØLVGLASSET R3 — SILKEFOLDER (Brage 2026-09-06, referansebildet GODKJENT)
// ---------------------------------------------------------------------------

/**
 * SØLVGLASS R3 — materialet i det godkjente referansebildet: tett sølvhvit
 * kropp, ORGANISKE LYSBØLGER (silkefolder), varierende frost, få FOKUSERTE
 * refleksjoner og Heia-grønne lysansamlinger ved kanten. R2s metallramme
 * (skulderrampe + skarp leppe) og rette glansstriper er FJERNET.
 *
 * TEKNIKK (denne runden = utseendet i stillstand, Brages arbeidsrekkefølge):
 *   · utformede MATERIALKART: `silk-wave.png` (diffuse folder: hvit alfa =
 *     lys, sølvgrå alfa = skygge, Gauss 11 px) og `silk-spec.png` (smale
 *     høylys langs foldtoppene, i segmenter). 420 pt-fliser, SØMLØSE i y,
 *     `resizeMode: 'repeat'` med eget utsnitt per kort — så et 600 pt
 *     bildekort får samme foldstørrelse som et 150 pt tekstkort. Generert av
 *     scratchpad/silk2.py (numpy) — deterministisk, kan regenereres.
 *     Kartene er laget for å bli forskyvningsfelt i neste steg (grunnen bak
 *     kortet bøyes av de samme foldene).
 *   · tegnet i PIKSELROM (onLayout): frost (blur), grønne lysansamlinger
 *     (blur), myk skulder = indre frostbånd (blur) + 1,5 pt lys ytterkant +
 *     myk mørk skygge innenfor nede/høyre, grønn kantglød nede/venstre.
 *
 * REAGERER PÅ GRUNNEN (ekte, i dag): alt under `base` gjennom systemets
 * Clear-glass. Forskyvningen av grunnen gjennom foldene er NESTE steg
 * (native `_backdropView` finnes allerede — se STATUS-HANDOFF).
 *
 * Alle tall Fast Refresh. Blekk = mørkt (OPAL.ink*, kontrastporten).
 */
export type FieldStop = readonly [number, string, number];
export interface GlassField {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate?: number;
  stops: ReadonlyArray<FieldStop>;
}

/**
 * Et ankret felt i pikselrom. `ax`/`ay` = anker i 0–1 av kortet; `dx`/`dy`
 * = forskyvning i punkter; `rx`/`ry` = radier i PUNKTER (strekkes aldri).
 * `ryGrow` lar en ellipse vokse med kortet uten å bli mindre.
 */
export interface AnchoredBlob {
  ax: number;
  ay: number;
  dx?: number;
  dy?: number;
  rx: number;
  ry: number;
  ryGrow?: number;
  rotate?: number;
  color: string;
  alpha: number;
}

const WHITE = '#FFFFFF';
const SILVER_PEARL_HEX = '#E6EAED';
/** Sølvgrå (fintech-kortets kjølige grå). */
const SILVER_GREY = '#A6B2BB';
const HEIA_NEON = '#02FFAB';
const INK_DEEP = '#08392E';

export const SILVER = {
  pearl: SILVER_PEARL_HEX,
  /** Kroppens tetthet — kortet er lyst og massivt; grunnen lever under. */
  base: 0.86,
  /** Silkekartene: flisstørrelse (pt) og opasitet. */
  silk: {tile: 420, wave: 0.95, spec: 1},
  /** Blur-radiene (stdDeviation, punkter). */
  blur: {depth: 24, frost: 14, rim: 9, shade: 7},
  /** DYBDEN — uskarpe felt inne i materialet. */
  depth: [
    {ax: 0.2, ay: 0, dy: 10, rx: 190, ry: 110, color: WHITE, alpha: 0.4},
    {
      ax: 0.62,
      ay: 1,
      dy: -20,
      rx: 200,
      ry: 100,
      color: SILVER_GREY,
      alpha: 0.3,
    },
    {
      ax: 1,
      ay: 0.45,
      dx: 40,
      rx: 150,
      ry: 120,
      ryGrow: 0.3,
      color: SILVER_GREY,
      alpha: 0.32,
    },
  ] as ReadonlyArray<AnchoredBlob>,
  /**
   * HEIA-LYSET — ansamlinger ved kanten som i referansen: sterkest langs
   * VENSTRE kant i nedre halvdel, nedre venstre hjørne, svakere øverst til
   * høyre og ved høyre kant nede (pillene).
   */
  heia: [
    {ax: 0, ay: 0.78, dx: -25, rx: 95, ry: 130, color: HEIA_NEON, alpha: 0.62},
    {ax: 0.14, ay: 1, dy: 24, rx: 150, ry: 60, color: HEIA_NEON, alpha: 0.5},
    {ax: 1, ay: 0.1, dx: 25, rx: 90, ry: 75, color: HEIA_NEON, alpha: 0.32},
    {ax: 1, ay: 0.85, dx: 20, rx: 80, ry: 100, color: HEIA_NEON, alpha: 0.3},
  ] as ReadonlyArray<AnchoredBlob>,
  /** FROSTEN — melkehvite flak, speilvendt per kort (seed). */
  frost: [
    {
      ax: 0,
      ay: 0,
      dx: 10,
      dy: 10,
      rx: 150,
      ry: 80,
      rotate: 20,
      color: WHITE,
      alpha: 0.4,
    },
    {
      ax: 0.86,
      ay: 0.3,
      rx: 110,
      ry: 60,
      rotate: -16,
      color: WHITE,
      alpha: 0.35,
    },
    {
      ax: 0.55,
      ay: 1,
      dy: -30,
      rx: 120,
      ry: 44,
      rotate: -5,
      color: WHITE,
      alpha: 0.35,
    },
    {ax: 1, ay: 1, dx: -20, dy: -20, rx: 90, ry: 90, color: WHITE, alpha: 0.3},
  ] as ReadonlyArray<AnchoredBlob>,
  /** Skyene (mikrostruktur): frost-light.png, 190 %. */
  cloud: {light: 0.12, scale: 1.9},
  /**
   * MYK SKULDER — ingen ramme. Frosten bygger seg opp mot kanten (indre
   * bånd, blur), 1,5 pt lys ytterkant (skarp), mørk skygge innenfor nede/
   * høyre (blur) og grønn kantglød nede/venstre (blur).
   */
  rim: {
    /** Indre frostbånd: synlig bredde pt, alfa (blur `rim`). */
    band: {width: 12, alpha: 0.35},
    /** Ytterkant 1,5 pt, gradient TL→BR. */
    edge: {
      width: 1.5,
      stops: [
        [0, WHITE, 0.95],
        [0.6, WHITE, 0.55],
        [1, WHITE, 0.4],
      ] as ReadonlyArray<FieldStop>,
    },
    /** Mørk skygge innenfor kanten fra nedre høyre (blur `shade`). */
    shade: {
      width: 10,
      stops: [
        [0, INK_DEEP, 0.1],
        [0.5, INK_DEEP, 0],
      ] as ReadonlyArray<FieldStop>,
    },
    /** Grønn kantglød fra nedre venstre (blur `shade`). */
    glow: {
      width: 8,
      stops: [
        [0, HEIA_NEON, 0.85],
        [0.42, HEIA_NEON, 0],
      ] as ReadonlyArray<FieldStop>,
    },
  },
  /** Høylyslinje 1,5 pt under toppkanten. */
  highlight: {width: 1.5, peak: 0.7, at: 0.3},
  /** Skyggen: ambient + kontakt. */
  shadow: [
    {
      offsetX: 0,
      offsetY: 10,
      blurRadius: 28,
      spreadDistance: 0,
      color: 'rgba(11, 59, 42, 0.22)',
    },
    {
      offsetX: 0,
      offsetY: 2,
      blurRadius: 6,
      spreadDistance: 0,
      color: 'rgba(11, 59, 42, 0.12)',
    },
  ],
  /**
   * PILLENE (rollemerke + handlinger): frostet hvit kropp med myk lys
   * leppe; aktiv Heia holder heiaTint og får en grønn glød (referansen).
   */
  pill: {
    fill: 'rgba(255, 255, 255, 0.62)',
    lipLight: 'rgba(255, 255, 255, 0.95)',
    lipDark: 'rgba(8, 57, 46, 0.1)',
    roleFill: 'rgba(255, 255, 255, 0.7)',
    glow: '0 0 14px rgba(2, 255, 171, 0.55)',
  },
} as const;

/**
 * MATERIALMODUS (Brage 2026-09-06, «vis materialet rent på ett kort»):
 *   'texture'  Brages heldekkende materialtekstur
 *              (src/assets/images/pearl-card.jpeg, 1916×821) som bildeflate bak ekte tekst
 *              og knapper, klippet til radiusen. INGEN tegnede lag, ingen
 *              innvendige skygger, INTET systemglass på kortet.
 *   'layers'   R3-lagene (SilverOptics) over systemglasset.
 * Fast Refresh. Byttes til 'texture' når filen ligger der.
 */
export type SilverMode = 'texture' | 'layers';
export const SILVER_MODE = 'texture' as SilverMode;

/**
 * NATIVE KROPP (Brage 2026-09-06, «fortsett med bakgrunnspåvirkning på ett
 * kort» + «form kantene»): `HeiaPearlView` tegner teksturen nativt — dekodet
 * ÉN gang og delt, ingen JS-onLayout, ingen asynkron bildelasting per kort,
 * ingen svg. Alle tall her er props → Fast Refresh (ingen rebuild). Se
 * HeiaLiquidGlassView.h for hva hvert tall gjør. `enabled: false` = den
 * gamle JS-flisingen (PearlTexture) — Android/jest bruker den uansett.
 */
export const PEARL_NATIVE = {
  enabled: true,
  props: {
    /** Teksturbredde i pt (0 = kortets bredde) og kryssfading mellom fliser. */
    textureWidth: 0,
    tileOverlap: 56,
    /**
     * KROPPEN DERIVERT FRA JPEG-EN (runde 3, Brage: «snøfølelsen»; målt:
     * 18 % nesten hvitt og mintkast i selve JPEG-en). Originalen røres ikke.
     * Oppskrift 4 (rig 2026-09-06): base + fold·felt + mid·lokal kontrast +
     * frost (begrenset) + ridge·kammer + halo·glorie, kne mot hvitt, kjølig
     * tint, grønt bare i pools. `material: false` = rå JPEG (sammenligning).
     */
    material: true,
    materialBase: 0.85,
    materialFold: 0.07,
    materialMid: 0.9,
    materialFrost: 0.6,
    materialRidge: 0.24,
    materialHalo: 0.09,
    materialKnee: 0.925,
    materialGreen: 1.0,
    /**
     * GRUNNEN I FOLDENE (runde 2, Brage: «skill mellom bakgrunnens farge og
     * lysstyrke; ikke multiply»): bøyningsstyrke, så tre lag som deler den
     * bøyde grunnen — lys (soft light, begrenset ±10 %, skjermet på kammene),
     * farge (color-blanding: kulør på kroppens lysstyrke, gulv + store daler),
     * glød (screen i de grønne lysansamlingene). Dalrampen er i FELT-enheter
     * (sterkt glattet luminans 0–1; from > to).
     */
    ground: true,
    groundStrength: 260,
    groundLight: 0.5,
    groundColor: 0.45,
    groundGlow: 0.35,
    groundFloor: 0.08,
    groundValleyFrom: 0.55,
    groundValleyTo: 0.2,
    groundBlur: 9,
    groundSaturation: 0.95,
    groundBlend: 'color' as
      | 'color'
      | 'hue'
      | 'softLight'
      | 'multiply'
      | 'screen'
      | 'overlay'
      | 'luminosity'
      | 'normal',
    groundLive: true,
    /**
     * BEVEGELSE (tillegg): sheen = lys som vandrer langs foldene (grunnstyrke,
     * fart-tillegg, sveipperiode pt, båndbredde pt); energien fra scrollfart
     * (motionVRef pt/s = full) øker bøyningen (motionBend) og gir grunnen
     * bevegelsesblur (px). Utfading ~0,35 s etter stopp. Redusert bevegelse:
     * energi 0, båndet står.
     */
    sheen: 0.35,
    sheenMotion: 0.6,
    sheenPeriod: 700,
    sheenBand: 90,
    motionBend: 0.6,
    motionBlur: 2.5,
    motionVRef: 1200,
    /** Dev: rammemåler på telefonen (Hz, hakk, verste ramme, CI-encode). */
    frameMeter: false,
    /** KANTEN: lysglimtets og den lokale dybdens styrke. */
    edge: true,
    edgeLight: 0.9,
    edgeDepth: 0.5,
    /** Kantglimtet følger foldene (0 = jevn diagonal, 1 = bare ved folder). */
    edgeFollow: 0.6,
  },
} as const;

/**
 * Teksturens bredde/høyde-forhold (1916×821). Teksturen tegnes i kortets
 * bredde, ankret i toppen; høyere kort får speilvendte kopier under (sømløst
 * i skjøten) — FORELØPIG, til den tilpassede komposisjonen for bildekort.
 */
export const PEARL_ASPECT = 1916 / 821;

/**
 * KANT OG HJØRNEGLANS RUNDT TEKSTUREN (SILVER_MODE 'texture'). JPEG-en gir
 * materialflaten; dette er det eneste som tegnes oppå: ett 1 pt kantlys som
 * VARIERER rundt formen (aldri en jevn hvit ring), to konsentrerte hvite
 * hjørnehøylys (buer langs radiusen, skarpe) og lokal sølvgrå dybde ved de to
 * andre hjørnene (radiale gradienter, INGEN filtre). Fast Refresh.
 */
export const PEARL_EDGE = {
  enabled: true,
  /** 1 pt kantlys: stopp langs diagonalen TL→BR, alfa varierer rundt formen. */
  edge: {
    width: 1,
    stops: [
      [0, '#FFFFFF', 0.9],
      [0.22, '#FFFFFF', 0.25],
      [0.5, '#FFFFFF', 0.6],
      [0.72, '#9CFFDF', 0.3],
      [1, '#FFFFFF', 0.8],
    ] as ReadonlyArray<FieldStop>,
  },
  /** Hjørnehøylys: bue langs radiusen (andel av kvartsirkelen), pt, alfa. */
  gloss: {width: 1.5, reach: 0.9, alpha: 0.85, inset: 2},
  /** Lokal sølvgrå dybde ved TR og BL: radius pt, alfa. */
  depth: {color: '#A6B2BB', radius: 120, alpha: 0.3},
} as const;

/**
 * LAGMASKEN — DIAGNOSE (Brage 2026-09-06: «finn laget som skaper den svarte
 * rammen; aktiver lagene enkeltvis»). Fast Refresh. `glass` = systemets
 * native glass under kortet; resten er SilverOptics' lag i tegnerekkefølge.
 * Alt PÅ = R3 slik den tegnes. Fjernes når årsaken er funnet og rettet.
 */
export const SILVER_LAYERS = {
  glass: true,
  base: true,
  depth: true,
  silk: true,
  cloud: true,
  heia: true,
  frost: true,
  rimBand: true,
  rimShade: true,
  rimGlow: true,
  spec: true,
  highlight: true,
  edge: true,
} as const;

/** Kortets alfa-nivåer slik testen regner dem (uten kart/blur). */
export const SILVER_LEVELS = {
  /** Sølvbassenget: base alene — der grunnen slipper mest gjennom. */
  pocketMin: SILVER.base,
  /** Tekstsonen: base + perlelyset øverst til venstre. */
  textZone: Math.min(
    1,
    SILVER.base + SILVER.depth[0].alpha * (1 - SILVER.base),
  ),
  /** Kanten: kroppen + frostbåndet. */
  edge: Math.min(1, SILVER.base + SILVER.rim.band.alpha * (1 - SILVER.base)),
} as const;
