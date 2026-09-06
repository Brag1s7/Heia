#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * HeiaLiquidGlassView — iOS-prototype (Brage 2026-09-02): ekte systemglass
 * (UIGlassEffect, iOS 26) bak FeedCard. ÉN konsument via
 * `LiquidGlassSurface.tsx`. Eldre iOS / Android / Reduce Transparency går
 * ALDRI hit — JS velger `OpalSurface` der.
 *
 * REFRAKSJON (Brage 2026-09-04, «refraktivt, frostet Liquid Glass»): med
 * `refraction` sampler viewet grunnen bak seg (RN-viewet med
 * `nativeID == backdropSourceID`), og legger et utsnitt av den — forstørret,
 * bøyd gjennom store linsesoner, frostet — BAK systemglasset, som så frosser
 * og kantlinser den deformerte grunnen som om den var den ekte. Utsnittet
 * følger kortets posisjon i skjermen (scroll observeres nativt), så
 * bakgrunnen flytter seg gjennom glasset når man ruller. Rent GPU-arbeid
 * (Core Image → IOSurface), delt frost-tekstur, aldri per-ramme-blur.
 */
@interface HeiaLiquidGlassView : UIView

@property (nonatomic, assign) CGFloat cornerRadius;
/** Nøytral grå/mint tint i glasset (alfa styrer styrken). Aldri hvitt fyll. */
@property (nonatomic, strong, nullable) UIColor *glassTint;
/** Trykktilstand fra Pressable: flytter det delte lyset svakt. */
@property (nonatomic, assign) BOOL pressed;
/** Trykklysets farge (hvitt om nil): hvitt på mørkt glass, mint på lyst. */
@property (nonatomic, strong, nullable) UIColor *pressColor;
/**
 * Kortskyggen INNI viewets lag (alfa i fargen; nil = ingen). Ligger under
 * sublayerTransform, så den krymper med kortet under trykk — en boxShadow
 * på en wrapper utenfor står igjen som en rand når kortet skaleres.
 */
@property (nonatomic, strong, nullable) UIColor *cardShadow;
/** Sheenens toppopasitet (0–1). Kort 0,18, kontrollglass (compose) 0,09. */
@property (nonatomic, assign) CGFloat sheenOpacity;
/**
 * NO = ingen trykkrespons: gjenkjenneren slås av og glasset settes
 * ikke-interaktivt. Compose-boksen — feltet og kameraknappen er kontrollene.
 */
@property (nonatomic, assign) BOOL interactive;
/** «regular» (standard, adaptiv melketint) eller «clear» (klart glass). */
@property (nonatomic, copy, nullable) NSString *glassStyle;

/** Slår på samplingen av grunnen. */
@property (nonatomic, assign) BOOL refraction;
/** `nativeID` på RN-viewet som er grunnen (DaylightGround). */
@property (nonatomic, copy, nullable) NSString *backdropSourceID;
/** Kantlinsens forskyvning, i punkter (6–12). */
@property (nonatomic, assign) CGFloat refractionStrength;
/**
 * Linsesonenes forskyvning gjennom sentrum, i punkter (30–90). Grunnen er en
 * jevn gradient: skal sonene lese som skyer, må prøvepunktet flyttes i
 * gradientens egen skala — 9 pt er usynlig (målt i riggen 2026-09-04).
 */
@property (nonatomic, assign) CGFloat refractionZone;
/** Forstørrelse om kortets sentrum (1,03–1,06). */
@property (nonatomic, assign) CGFloat refractionScale;
/** Frost i den delte grunnteksturen: Gauss-radius i punkter (bakes én gang). */
@property (nonatomic, assign) CGFloat refractionBlur;
/** Metning i den samplede grunnen (1 = urørt; Brage: 0,75–0,85). */
@property (nonatomic, assign) CGFloat refractionSaturation;
/** Største optiske parallakse mot scroll, i punkter (0 = av). */
@property (nonatomic, assign) CGFloat refractionParallax;
/** YES = oppdater per scroll-ramme; NO = kun ved layout og scroll-stopp. */
@property (nonatomic, assign) BOOL refractionLive;

/**
 * FROST (Brage 2026-09-04, «premium flurry/opal/glass-materiale»): materialet
 * BOR I KORTET, for grunnen er en jevn gradient uten noe å bryte (målt:
 * 0,04/255 lokal kontrast). Over systemglasset legges en frostkropp med
 * ujevn tetthet — to skylag (lys og mørk teal) fra delte støyteksturer med
 * eget utsnitt per kort — et topphøylys, en roligere bunn, kantfysikk
 * (lys kant øvre venstre, mørk kant nedre høyre) og en myk Heia Deep-
 * skygge under. Alle tall er props → Fast Refresh. `frost` slår laget på.
 */
@property (nonatomic, assign) BOOL frost;
/** Lys frostsky, maks alfa (0,2–0,4). */
@property (nonatomic, assign) CGFloat frostLight;
/** Mørk teal-sky, maks alfa (0,03–0,08). */
@property (nonatomic, assign) CGFloat frostDark;
/** Topphøylys, alfa øverst (0,15–0,3). */
@property (nonatomic, assign) CGFloat frostTop;
/** Roligere bunn, teal-alfa nederst (0,05–0,12). */
@property (nonatomic, assign) CGFloat frostBottom;
/** Kantstrøkenes styrke (0–1). */
@property (nonatomic, assign) CGFloat frostEdge;
/** Skyggens opasitet under kortet (0–0,3). */
@property (nonatomic, assign) CGFloat frostShadow;
/** Skyenes skala: 1 = hele teksturen over kortet, 2 = dobbelt så store skyer. */
@property (nonatomic, assign) CGFloat frostScale;

/**
 * SPEKULAR (Brage 2026-09-04: «bevegelser»): et mykt, diagonalt lysbånd i
 * glasset som glir over kortet når det ruller gjennom skjermen — lyset som
 * treffer et ekte glass fra et fast punkt. Kun en lagposisjon per scroll-
 * ramme (ingen Core Image). Styrke = båndets alfa; 0 = av.
 */
@property (nonatomic, assign) CGFloat specular;

@end

/**
 * HeiaPearlView — SØLVGLASSET (Brage 2026-09-06, «materialretningen er
 * godkjent»): Brages perletekstur (pearl-card.jpeg) som kortets KROPP, tegnet
 * nativt. Én konsument via `LiquidGlassSurface.tsx` (SILVER_MODE 'texture').
 *
 *   · Teksturen dekodes ÉN gang per app-økt (≤ 1200 px bred) og deles av alle
 *     kort som lagets `contents` — ingen JS-onLayout-runde, ingen asynkron
 *     bildelasting per kort, ingen svg. Kroppen står fra første ramme
 *     (flat perlefarge de få ms før første dekoding er ferdig).
 *   · Høye kort: fliser i FAST materialskala med ulike utsnitt, annenhver
 *     speilvendt i x, kryssfadet over `tileOverlap` — ingen strekk, ingen
 *     speilsøm, ingen gjentakelse av hele motivet.
 *   · GRUNNEN I MATERIALET (`ground`): utsnittet av DaylightGround bak kortet
 *     (delt frostet bilde, kortets skjermposisjon per scroll-ramme) bøyes av
 *     et høydefelt utledet fra teksturens egne folder (CIDisplacementDistortion,
 *     R = uskarp luminans) og blandes inn i foldenes DALER (dalmaske fra samme
 *     luminans) — kroppen forblir tett sølvhvit, lyset vandrer i foldene.
 *   · KANTEN (`edge`): 9-delt glansbilde per radius — skarpt lysglimt ytterst,
 *     bredere mykere overgang innover — med varierende styrke rundt formen
 *     (diagonal maske), og lokal sølvgrå dybde ved nedre høyre (radial maske).
 *     Ingen sammenhengende mørk ramme, ingen ensartet hvit kontur.
 * Alle tall er props → Fast Refresh fra glassOptics.PEARL_NATIVE.
 */
@interface HeiaPearlView : UIView

@property (nonatomic, assign) CGFloat cornerRadius;
/** Teksturens URI (Image.resolveAssetSource: Metro-http i dev, file i release). */
@property (nonatomic, copy, nullable) NSString *textureURI;
/** `nativeID` på grunnen (DaylightGround). */
@property (nonatomic, copy, nullable) NSString *backdropSourceID;
/** Teksturens bredde i pt (0 = kortets bredde). Materialskalaen er fast. */
@property (nonatomic, assign) CGFloat textureWidth;
/** Kryssfading mellom fliser, pt. */
@property (nonatomic, assign) CGFloat tileOverlap;

/**
 * KROPPEN DERIVERES fra JPEG-en (Brage 2026-09-06, runde 3: snøfølelsen
 * ligger i selve JPEG-en — 18 % nesten hvitt, mintkast). Originalen røres
 * ikke; kroppen regnes én gang (delt) fra dens kart: sølvgrå base som følger
 * de store foldene, lokal foldkontrast, fin frost (begrenset korn), smale
 * lysrygger på kammene med myk glorie, kne mot hvitt, kjølig tint, grønt bare
 * i teksturens egne pools. `material` NO = den rå JPEG-en (sammenligning).
 */
@property (nonatomic, assign) BOOL material;
@property (nonatomic, assign) CGFloat materialBase;
@property (nonatomic, assign) CGFloat materialFold;
@property (nonatomic, assign) CGFloat materialMid;
@property (nonatomic, assign) CGFloat materialFrost;
@property (nonatomic, assign) CGFloat materialRidge;
@property (nonatomic, assign) CGFloat materialHalo;
@property (nonatomic, assign) CGFloat materialKnee;
@property (nonatomic, assign) CGFloat materialGreen;

@property (nonatomic, assign) BOOL ground;
/** CIDisplacementDistortion-skala (forskyvning ≈ 2·skala·∇felt px). */
@property (nonatomic, assign) CGFloat groundStrength;
/**
 * KOMPOSITERINGEN (Brage 2026-09-06, runde 2: «skill mellom bakgrunnens farge
 * og lysstyrke»): tre lag deler den bøyde grunnen —
 *   groundLight  soft light: grunnens lys/farge, matematisk begrenset (maks
 *                ≈ ±10 % på lys flate); skjermet på foldekammene.
 *   groundColor  color-blanding: grunnens kulør på kroppens egen lysstyrke;
 *                gulv + de STORE dalene.
 *   groundGlow   screen i teksturens grønne lysansamlinger (sterkere over neon).
 * Alle 0–1 (lagenes opasitet).
 */
@property (nonatomic, assign) CGFloat groundLight;
@property (nonatomic, assign) CGFloat groundColor;
@property (nonatomic, assign) CGFloat groundGlow;
/** Fargelagets gulv (0–1) og dalrampe i FELT-enheter (0–1; from > to). */
@property (nonatomic, assign) CGFloat groundFloor;
@property (nonatomic, assign) CGFloat groundValleyFrom;
@property (nonatomic, assign) CGFloat groundValleyTo;
/** Frost/metning i det delte grunnbildet. */
@property (nonatomic, assign) CGFloat groundBlur;
@property (nonatomic, assign) CGFloat groundSaturation;
/** Fargelagets blanding: «color» (hoved) | «hue» | «softLight» | «multiply» | «screen» | «overlay» | «luminosity» | «normal». */
@property (nonatomic, copy, nullable) NSString *groundBlend;
/** YES = per scroll-ramme; NO = kun ved layout og scroll-stopp. */
@property (nonatomic, assign) BOOL groundLive;

/**
 * BEVEGELSE (Brage 2026-09-06, tillegg): sheen = lys som vandrer langs
 * foldene: ryggenes glorie tent av et bredt mykt bånd som glir over kortet med
 * skjermposisjonen (én sveip per `sheenPeriod` pt, bredde `sheenBand` pt),
 * forskjøvet langs foldene av scrollens drift. Styrke = sheen + sheenMotion ·
 * energi, der energien er scrollfart / motionVRef (pt/s) med rask anslag og
 * rolig utfading etter stopp. Energien øker også bøyningen (motionBend) og
 * gir grunnen bevegelsesblur (motionBlur, px). Redusert bevegelse: energi 0,
 * båndet står.
 */
@property (nonatomic, assign) CGFloat sheen;
@property (nonatomic, assign) CGFloat sheenMotion;
@property (nonatomic, assign) CGFloat sheenPeriod;
@property (nonatomic, assign) CGFloat sheenBand;
@property (nonatomic, assign) CGFloat motionBend;
@property (nonatomic, assign) CGFloat motionBlur;
@property (nonatomic, assign) CGFloat motionVRef;
/** Dev: rammemåler (Hz, hakk, verste ramme, CI-encode) som etikett i vinduet. */
@property (nonatomic, assign) BOOL frameMeter;

@property (nonatomic, assign) BOOL edge;
/** Lysglimtets styrke (0–1) og dybdens styrke (0–1). */
@property (nonatomic, assign) CGFloat edgeLight;
@property (nonatomic, assign) CGFloat edgeDepth;
/** Hvor mye kantglimtet følger foldene (0 = jevn diagonal, 1 = bare der folder møter kanten). */
@property (nonatomic, assign) CGFloat edgeFollow;

@end

NS_ASSUME_NONNULL_END
