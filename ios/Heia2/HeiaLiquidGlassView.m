#import "HeiaLiquidGlassView.h"
#import <React/UIView+React.h>
#import <CoreImage/CoreImage.h>
#import <IOSurface/IOSurfaceObjC.h>
#import <Metal/Metal.h>

/**
 * LAGENE, nederst først:
 *   refraksjon `_backdropView` (Brage 2026-09-04, V3.1): et utsnitt av GRUNNEN
 *              bak kortet (RN-viewet med nativeID == backdropSourceID), tatt
 *              som bilde én gang og delt av alle kort, klippet til kortets
 *              rektangel i grunnens koordinater, forstørret (refractionScale)
 *              og bøyd gjennom store, elliptiske linsesoner + én kantlinse
 *              (CIBumpDistortion, forskyvning ≈ refractionStrength pt). Laget
 *              ligger BAK glasset, så systemglasset frosser, tinter og
 *              kantlinser vår deformerte grunn akkurat som det ville gjort
 *              med den ekte — materialet er Apples, bare verden bak er bøyd.
 *   glass      UIVisualEffectView med UIGlassEffect (iOS 26): systemets blur,
 *              adaptive lyshet, kantlinse. `glassStyle` «regular» (standard,
 *              adaptiv — Brage 2026-09-04 etter «Meet Liquid Glass»: Clear er
 *              permanent gjennomsiktig og uten adaptivitet) eller «clear».
 *              Låst til lys appearance.
 *   sheen      ÉN delt CAGradientLayer (i `_sheenView`) i contentView: hvitt
 *              sheenOpacity → 0 diagonalt fra øvre venstre.
 *   frost      `_frostView` i contentView (Brage 2026-09-04, «premium
 *              flurry/opal»): materialet BOR I KORTET, for grunnen er en jevn
 *              gradient uten noe å bryte. To skylag (lys frost + mørk teal)
 *              fra DELTE støyteksturer (CIRandomGenerator → to oktaver
 *              Gauss → normalisert, laget én gang, 512 px) med eget utsnitt
 *              per kort (hash av instansen) → ujevn tetthet; topphøylys;
 *              roligere teal-bunn; kantfysikk som gradientstrøk (lys øvre
 *              venstre, mørk nedre høyre, maskert av CAShapeLayer); Heia
 *              Deep-skygge på self.layer med shadowPath. Alt statiske lag —
 *              null kostnad under scroll.
 *   lys        `_lightView`: hvit flate, alfa 0 i hvile — lyset som «trykkes
 *              inn» i glasset ved touch.
 *   barn       RN-barna monteres over glasset; glasset holdes alltid bakerst
 *              (og refraksjonen bak glasset igjen).
 *
 * HVORFOR SAMPLING AV GRUNNEN OG IKKE AV «ALT BAK»: offentlig iOS-API kan
 * ikke lese og deformere vilkårlige bakgrunnspiksler (det er CABackdropLayer
 * og private CAFilter som UIVisualEffectView bruker). Bak feedkortene ligger
 * derimot BARE DaylightGround, og grunnen står stille mens kortene ruller —
 * så ett bilde av grunnen ER bakgrunnen bak hvert kort til enhver tid.
 *
 * YTELSE (Brage 2026-09-04: «scroll-lag»; V3 gjorde snapshot hvert sekund
 * midt i scrollen, Gauss-blur på 2×-tekstur per kort per ramme og
 * createCGImage med CPU-tilbakelesning):
 *   · ÉN CIContext (Metal, RGBA8 arbeidsformat), opprettet én gang.
 *   · ÉN delt frost-tekstur av grunnen: snapshot (1×) → metning ned →
 *     Gauss-frost, materialisert ÉN gang som CGImage. Blur skjer aldri per
 *     kort per ramme. Tas på nytt kun i ro (aldri under drag/deselerasjon),
 *     etter en kort gjentaksplan (grunnen kan være tegnet sent) og deretter
 *     kun ved størrelsesendring / lang TTL.
 *   · Per kort per ramme: crop + affin forstørrelse + fire linser på et
 *     kortstort 1×-utsnitt — rent GPU-arbeid — rendret asynkront
 *     (CIRenderTask) inn i en av to IOSurfaces per kort, som er lagets
 *     contents direkte. Ingen CGImage, ingen CPU-kopi. Bildet vises når
 *     oppgaven er ferdig (én ramme senere ved scroll — usynlig i et mykt
 *     felt). Hoppes over når kortet ikke har flyttet seg (< 0,25 pt) og for
 *     kort utenfor skjermen. Én oppdatering per runloop-runde uansett hvor
 *     mange scroll-hendelser.
 *
 * TRYKKRESPONSEN (funnet 2026-09-02 på fysisk iPhone: «merkes ikke»):
 *   Årsak 1: `UIGlassEffect.interactive` får ALDRI touch — RN-barna dekker
 *   hele flaten, hit-testen stopper i RN-viewet, og Apple har ingen API for
 *   å utløse responsen manuelt. Årsak 2: `pressed`-propen fra JS finnes
 *   bare på kort med Pressable. Løsning: én UILongPressGestureRecognizer med
 *   minimumPressDuration 0 på dette viewet. RN sin RCTSurfaceTouchHandler har
 *   cancelsTouchesInView NO og hindrer ikke andre gjenkjennere, så pillene/
 *   ⋯/kommentar i kortet fungerer som før. Touch-down → umiddelbart (120 ms);
 *   bevegelse > 12 pt (scroll) eller slipp/avbrudd → tilbake (300 ms).
 *   Alltid BeginFromCurrentState = avbrytbar. Reduce Motion → kun lys
 *   (opacity), ingen gliding. Ingen loop, ingen haptikk.
 */
@interface HeiaLiquidGlassView () <UIGestureRecognizerDelegate>
@end

static void *const kHeiaScrollContext = (void *)&kHeiaScrollContext;

/** Bufret, frostet bilde av grunnen — delt av alle kort (én grunn per skjerm). */
@interface HeiaBackdropSnapshot : NSObject
@property (nonatomic, weak) UIView *source;
@property (nonatomic, strong) CIImage *frosted;
@property (nonatomic, assign) CGRect bounds;
@property (nonatomic, assign) CFTimeInterval takenAt;
@property (nonatomic, assign) NSUInteger retakes;
@property (nonatomic, assign) CGFloat blur;
@property (nonatomic, assign) CGFloat saturation;
@end

@implementation HeiaBackdropSnapshot
@end

/** Intern renderskala: 1× (punkter). Utsnittet frostes av systemglasset uansett. */
static const CGFloat kCaptureScale = 1.0;
/** Gjentaksplan etter første capture (grunnen kan være tegnet sent), så lang TTL. */
static const CFTimeInterval kRetakeAfter[] = {0.4, 1.5, 4.0};
static const NSUInteger kRetakeCount = 3;
static const CFTimeInterval kSnapshotTTL = 6.0;
/** Hopp over rendering når kortet har flyttet seg mindre enn dette (pt). */
static const CGFloat kMoveEpsilon = 0.25;

static HeiaBackdropSnapshot *gSnapshot;
static CIContext *gContext;
static CGColorSpaceRef gColorSpace;

@implementation HeiaLiquidGlassView {
  UIVisualEffectView *_effectView;
  UIView *_sheenView;
  CAGradientLayer *_sheen;
  UIView *_lightView;
  CALayer *_shadowLayer;
  UIView *_backdropView;
  UIView *_frostView;
  CAGradientLayer *_specularLayer;
  CALayer *_cloudLight;
  CALayer *_cloudDark;
  CAGradientLayer *_bottomShade;
  CAGradientLayer *_topLight;
  CAGradientLayer *_edgeLight;
  CAGradientLayer *_edgeDark;
  CAShapeLayer *_edgeLightMask;
  CAShapeLayer *_edgeDarkMask;
  UILongPressGestureRecognizer *_press;
  CGPoint _pressStart;
  BOOL _touchDown;
  BOOL _applied;
  __weak UIView *_sourceView;
  __weak UIScrollView *_scrollView;
  BOOL _refractionScheduled;
  BOOL _flushScheduled;
  // Dobbeltbufring: rendres i den ene mens den andre vises.
  IOSurface *_surfaces[2];
  NSUInteger _surfaceIndex;
  CGSize _surfaceSize;
  CIRenderTask *_pendingTask;
  IOSurface *_pendingSurface;
  CGRect _lastRect;
  __weak CIImage *_lastBackdrop;
  BOOL _lastValid;
}

static const CGFloat kSheenBleed = 28.0;
// Runde 7 (Brage så runde 6 etter ekte bygg: «altfor mye»): midt mellom
// runde 4 (for svak: lys 0,12, ingen skala) og runde 6 (0,30 / 0,96 / 2 pt).
static const CGFloat kPressLight = 0.16;
static const CGFloat kPressScale = 0.98;
static const CGFloat kPressDropY = 1.0;
static const CGFloat kPressSlideX = 18.0;
static const CGFloat kPressSlideY = 10.0;
static const CGFloat kScrollSlop = 12.0;

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.backgroundColor = UIColor.clearColor;
    _cornerRadius = 24.0;
    // Nesten fargeløs perlegrå — JS sender GLASS.*.tint, dette er bare default.
    _glassTint = [UIColor colorWithRed:0.914 green:0.922 blue:0.918 alpha:0.34];
    _sheenOpacity = 0.18;
    _interactive = YES;
    _glassStyle = @"regular";
    _refraction = NO;
    _refractionStrength = 9.0;
    _refractionZone = 72.0;
    _refractionScale = 1.04;
    _refractionBlur = 8.0;
    _refractionSaturation = 0.8;
    _refractionParallax = 0.0;
    _refractionLive = YES;
    _frost = NO;
    _frostLight = 0.36;
    _frostDark = 0.05;
    _frostTop = 0.24;
    _frostBottom = 0.09;
    _frostEdge = 1.0;
    _frostShadow = 0.16;
    _frostScale = 1.8;
    _specular = 0.0;

    // Refraksjonen BAK glasset: en vanlig view med lagets contents = IOSurface.
    _backdropView = [[UIView alloc] initWithFrame:self.bounds];
    _backdropView.userInteractionEnabled = NO;
    _backdropView.backgroundColor = UIColor.clearColor;
    _backdropView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _backdropView.layer.masksToBounds = YES;
    _backdropView.layer.cornerCurve = kCACornerCurveContinuous;
    _backdropView.layer.contentsGravity = kCAGravityResize;
    _backdropView.hidden = YES;
    [self addSubview:_backdropView];

    _effectView = [[UIVisualEffectView alloc] initWithEffect:[self makeEffect]];
    _effectView.frame = self.bounds;
    _effectView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _effectView.userInteractionEnabled = NO;
    _effectView.clipsToBounds = YES;
    // LÅST til lys appearance: Dark Mode på telefonen skal ikke gjøre glasset
    // mørkt mens Heia-blekket forblir mørkt. Appen er lys.
    self.overrideUserInterfaceStyle = UIUserInterfaceStyleLight;
    _effectView.overrideUserInterfaceStyle = UIUserInterfaceStyleLight;
    _effectView.layer.cornerCurve = kCACornerCurveContinuous;
    [self addSubview:_effectView];

    _sheenView = [[UIView alloc] initWithFrame:CGRectZero];
    _sheenView.userInteractionEnabled = NO;
    _sheen = [CAGradientLayer layer];
    [self applySheen];
    _sheen.locations = @[ @0.0, @0.32, @0.62 ];
    _sheen.startPoint = CGPointMake(0.0, 0.0);
    _sheen.endPoint = CGPointMake(0.7, 1.0);
    [_sheenView.layer addSublayer:_sheen];
    [_effectView.contentView addSubview:_sheenView];

    _lightView = [[UIView alloc] initWithFrame:self.bounds];
    _lightView.userInteractionEnabled = NO;
    _lightView.backgroundColor = UIColor.whiteColor;
    _lightView.alpha = 0.0;
    _lightView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    // Frosten ligger over sheen, under trykklyset og RN-barna.
    _frostView = [[UIView alloc] initWithFrame:self.bounds];
    _frostView.userInteractionEnabled = NO;
    _frostView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _frostView.hidden = YES;
    _cloudLight = [CALayer layer];
    _cloudLight.contentsGravity = kCAGravityResizeAspectFill;
    _cloudDark = [CALayer layer];
    _cloudDark.contentsGravity = kCAGravityResizeAspectFill;
    _bottomShade = [CAGradientLayer layer];
    _bottomShade.startPoint = CGPointMake(0.5, 0.62);
    _bottomShade.endPoint = CGPointMake(0.5, 1.0);
    _topLight = [CAGradientLayer layer];
    _topLight.startPoint = CGPointMake(0.0, 0.0);
    _topLight.endPoint = CGPointMake(0.55, 0.75);
    _topLight.locations = @[ @0.0, @0.35, @1.0 ];
    _edgeLight = [CAGradientLayer layer];
    _edgeLight.startPoint = CGPointMake(0.0, 0.0);
    _edgeLight.endPoint = CGPointMake(1.0, 1.0);
    _edgeLight.locations = @[ @0.0, @0.45, @0.75 ];
    _edgeLight.colors = @[
      (id)[UIColor colorWithWhite:1.0 alpha:0.75].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.18].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
    ];
    _edgeLightMask = [CAShapeLayer layer];
    _edgeLightMask.fillColor = nil;
    _edgeLightMask.strokeColor = UIColor.whiteColor.CGColor;
    _edgeLightMask.lineWidth = 1.0;
    _edgeLight.mask = _edgeLightMask;
    _edgeDark = [CAGradientLayer layer];
    _edgeDark.startPoint = CGPointMake(1.0, 1.0);
    _edgeDark.endPoint = CGPointMake(0.0, 0.0);
    _edgeDark.locations = @[ @0.0, @0.5 ];
    _edgeDark.colors = @[
      (id)[UIColor colorWithRed:0.03 green:0.22 blue:0.18 alpha:0.28].CGColor,
      (id)[UIColor colorWithRed:0.03 green:0.22 blue:0.18 alpha:0.0].CGColor,
    ];
    _edgeDarkMask = [CAShapeLayer layer];
    _edgeDarkMask.fillColor = nil;
    _edgeDarkMask.strokeColor = UIColor.whiteColor.CGColor;
    _edgeDarkMask.lineWidth = 1.0;
    _edgeDark.mask = _edgeDarkMask;
    [_frostView.layer addSublayer:_cloudLight];
    [_frostView.layer addSublayer:_cloudDark];
    [_frostView.layer addSublayer:_bottomShade];
    [_frostView.layer addSublayer:_topLight];
    [_frostView.layer addSublayer:_edgeDark];
    [_frostView.layer addSublayer:_edgeLight];
    [_effectView.contentView addSubview:_frostView];
    [self applyFrost];

    // Spekularbåndet: over frosten, under trykklyset. Tre ganger så bredt
    // som kortet; posisjonen følger kortets plass i skjermen (scroll).
    _specularLayer = [CAGradientLayer layer];
    _specularLayer.startPoint = CGPointMake(0.0, 0.0);
    _specularLayer.endPoint = CGPointMake(1.0, 1.0);
    _specularLayer.locations = @[ @0.30, @0.50, @0.70 ];
    _specularLayer.hidden = YES;
    [_effectView.contentView.layer addSublayer:_specularLayer];
    [self applySpecular];

    [_effectView.contentView addSubview:_lightView];

    _press = [[UILongPressGestureRecognizer alloc] initWithTarget:self
                                                           action:@selector(handlePress:)];
    _press.minimumPressDuration = 0.0;
    _press.allowableMovement = CGFLOAT_MAX; // bevegelse håndteres selv (scroll)
    _press.cancelsTouchesInView = NO;
    _press.delaysTouchesBegan = NO;
    _press.delaysTouchesEnded = NO;
    _press.delegate = self;
    [self addGestureRecognizer:_press];

    [self applyCornerRadius];
    [self restack];
  }
  return self;
}

- (void)dealloc
{
  [self detachScrollObserver];
}

- (UIVisualEffect *)makeEffect
{
  // SENSOR-MODUS («none», Brage 2026-09-06): intet glass — viewet er bare
  // trykkfysikken (gjenkjenner, lys, skala, senk) rundt RN-barna. Brukes av
  // kampkortet, som beholder StadiumGlass som materiale.
  if ([_glassStyle isEqualToString:@"none"]) {
    return nil;
  }
  if (@available(iOS 26.0, *)) {
    UIGlassEffectStyle style = [_glassStyle isEqualToString:@"clear"]
                                   ? UIGlassEffectStyleClear
                                   : UIGlassEffectStyleRegular;
    UIGlassEffect *glass = [UIGlassEffect effectWithStyle:style];
    // Alfa 0 fra JS = «tintColor nil»: systemets egen adaptive kropp.
    CGFloat alpha = 1.0;
    [_glassTint getRed:NULL green:NULL blue:NULL alpha:&alpha];
    glass.tintColor = alpha > 0.005 ? _glassTint : nil;
    // Får aldri touch bak RN-barna (se toppen) — står for det tilfellet UIKit
    // en dag videresender; responsen vår er den som faktisk kjører.
    glass.interactive = _interactive && !UIAccessibilityIsReduceMotionEnabled();
    return glass;
  }
  return [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemThinMaterialLight];
}

// Sheen: hvit topp → 1/3 → 0 diagonalt. `sheenOpacity` skalerer hele stigen,
// så kontrollglasset (0,09) får samme retning, halv styrke.
- (void)applySheen
{
  CGFloat top = _sheenOpacity;
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _sheen.colors = @[
    (id)[UIColor colorWithWhite:1.0 alpha:top].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:top / 3.0].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
  ];
  [CATransaction commit];
}

- (void)setSheenOpacity:(CGFloat)sheenOpacity
{
  _sheenOpacity = sheenOpacity;
  [self applySheen];
}

- (void)setInteractive:(BOOL)interactive
{
  _interactive = interactive;
  _press.enabled = interactive;
  _effectView.effect = [self makeEffect];
  if (!interactive) {
    _touchDown = NO;
    [self refreshPressed];
  }
}

- (void)setGlassStyle:(NSString *)glassStyle
{
  _glassStyle = [glassStyle copy];
  _effectView.effect = [self makeEffect];
  [self restack];
}

- (void)setPressColor:(UIColor *)pressColor
{
  _pressColor = pressColor;
  _lightView.backgroundColor = pressColor ?: UIColor.whiteColor;
}

- (void)setCardShadow:(UIColor *)cardShadow
{
  _cardShadow = cardShadow;
  if (cardShadow == nil) {
    [_shadowLayer removeFromSuperlayer];
    _shadowLayer = nil;
    return;
  }
  if (_shadowLayer == nil) {
    _shadowLayer = [CALayer layer];
    _shadowLayer.backgroundColor = UIColor.clearColor.CGColor;
    _shadowLayer.shadowOffset = CGSizeMake(0.0, 8.0);
    _shadowLayer.shadowRadius = 12.0; // = boxShadow blur 24
    _shadowLayer.shadowOpacity = 1.0; // alfaen bor i fargen
    [self.layer insertSublayer:_shadowLayer atIndex:0];
  }
  _shadowLayer.shadowColor = cardShadow.CGColor;
  [self layoutShadow];
}

/**
 * Skyggen tegnes KUN utenfor kortet (even-odd-maske med hull for kortet):
 * glasset er gjennomsiktig, og skyggen under flaten ville mørknet kroppen.
 */
- (void)layoutShadow
{
  if (_shadowLayer == nil || CGRectIsEmpty(self.bounds)) {
    return;
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  CGRect b = self.bounds;
  _shadowLayer.frame = b;
  UIBezierPath *card = [UIBezierPath bezierPathWithRoundedRect:b cornerRadius:_cornerRadius];
  _shadowLayer.shadowPath = card.CGPath;
  CGFloat pad = 80.0;
  CAShapeLayer *mask = [CAShapeLayer layer];
  mask.frame = CGRectInset(b, -pad, -pad);
  CGRect inner = CGRectMake(pad, pad, b.size.width, b.size.height);
  UIBezierPath *outer = [UIBezierPath bezierPathWithRect:CGRectMake(0, 0, b.size.width + 2 * pad,
                                                                       b.size.height + 2 * pad)];
  [outer appendPath:[UIBezierPath bezierPathWithRoundedRect:inner cornerRadius:_cornerRadius]];
  mask.path = outer.CGPath;
  mask.fillRule = kCAFillRuleEvenOdd;
  _shadowLayer.mask = mask;
  [CATransaction commit];
}

- (void)applyCornerRadius
{
  _effectView.layer.cornerRadius = _cornerRadius;
  _backdropView.layer.cornerRadius = _cornerRadius;
  [self layoutShadow];
}

- (void)setCornerRadius:(CGFloat)cornerRadius
{
  _cornerRadius = cornerRadius;
  [self applyCornerRadius];
  [self layoutFrost];
}

- (void)setGlassTint:(UIColor *)glassTint
{
  _glassTint = glassTint;
  _effectView.effect = [self makeEffect];
}

/** Rekkefølgen nederst: refraksjon, så glass, så RN-barna. */
- (void)restack
{
  [self sendSubviewToBack:_effectView];
  [self sendSubviewToBack:_backdropView];
  // Sensor-modus («none»): RN-barna er materialet (StadiumGlass), så lyset
  // må ligge FORAN dem — ellers bor det bak dem i effektviewet.
  if ([_glassStyle isEqualToString:@"none"]) {
    if (_lightView.superview != self) {
      _lightView.frame = self.bounds;
      _lightView.layer.cornerCurve = kCACornerCurveContinuous;
      _lightView.layer.masksToBounds = YES;
      [self addSubview:_lightView];
    }
    _lightView.layer.cornerRadius = _cornerRadius;
    [self bringSubviewToFront:_lightView];
  }
}

#pragma mark - Frost

static CGImageRef gCloudWhite;
static CGImageRef gCloudTeal;
static const CGFloat kCloudSize = 512.0;

/** Én oktav-blanding av støy, normalisert til 0…1 gråtone. Kjøres én gang. */
static CIImage *HeiaCloudNoise(CGFloat seed, CGFloat bigSigma, CGFloat smallSigma)
{
  CGRect r = CGRectMake(0, 0, kCloudSize, kCloudSize);
  CIImage *noise = [[[CIFilter filterWithName:@"CIRandomGenerator"] outputImage]
      imageByApplyingTransform:CGAffineTransformMakeTranslation(seed * 977.0, seed * 311.0)];
  noise = [noise imageByCroppingToRect:CGRectInset(r, -200, -200)];
  CIImage *gray = [noise imageByApplyingFilter:@"CIColorControls"
                           withInputParameters:@{kCIInputSaturationKey : @0.0}];
  CIImage *o1 = [gray imageByApplyingGaussianBlurWithSigma:bigSigma];
  CIImage *o2 = [[gray imageByApplyingTransform:CGAffineTransformMakeTranslation(300, -180)]
      imageByApplyingGaussianBlurWithSigma:smallSigma];
  CIImage *a = [o1 imageByApplyingFilter:@"CIColorMatrix"
                     withInputParameters:@{
                       @"inputRVector" : [CIVector vectorWithX:0.65 Y:0 Z:0 W:0],
                       @"inputGVector" : [CIVector vectorWithX:0 Y:0.65 Z:0 W:0],
                       @"inputBVector" : [CIVector vectorWithX:0 Y:0 Z:0.65 W:0],
                     }];
  CIImage *b = [o2 imageByApplyingFilter:@"CIColorMatrix"
                     withInputParameters:@{
                       @"inputRVector" : [CIVector vectorWithX:0.35 Y:0 Z:0 W:0],
                       @"inputGVector" : [CIVector vectorWithX:0 Y:0.35 Z:0 W:0],
                       @"inputBVector" : [CIVector vectorWithX:0 Y:0 Z:0.35 W:0],
                     }];
  CIImage *sum = [[a imageByApplyingFilter:@"CIAdditionCompositing"
                       withInputParameters:@{kCIInputBackgroundImageKey : b}]
      imageByCroppingToRect:r];
  // Normaliser: mål min/maks i en liten nedskalert kopi.
  enum { n = 64 };
  uint8_t buf[n * n * 4];
  CIImage *small = [sum imageByApplyingTransform:CGAffineTransformMakeScale(n / kCloudSize, n / kCloudSize)];
  [[HeiaLiquidGlassView context] render:small
                               toBitmap:buf
                               rowBytes:n * 4
                                 bounds:CGRectMake(0, 0, n, n)
                                 format:kCIFormatRGBA8
                             colorSpace:gColorSpace];
  int lo = 255, hi = 0;
  for (int i = 0; i < n * n * 4; i += 4) {
    lo = MIN(lo, buf[i]);
    hi = MAX(hi, buf[i]);
  }
  CGFloat scale = 255.0 / MAX(1, hi - lo);
  CGFloat bias = -lo / 255.0 * scale;
  return [sum imageByApplyingFilter:@"CIColorMatrix"
                withInputParameters:@{
                  @"inputRVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputGVector" : [CIVector vectorWithX:0 Y:scale Z:0 W:0],
                  @"inputBVector" : [CIVector vectorWithX:0 Y:0 Z:scale W:0],
                  @"inputBiasVector" : [CIVector vectorWithX:bias Y:bias Z:bias W:0],
                }];
}

/** Gråtone → farge med alfa = gråtone (premultiplisert), som CGImage. */
static CGImageRef HeiaCloudImage(CIImage *gray, CGFloat r, CGFloat g, CGFloat b)
{
  CIImage *tinted = [gray imageByApplyingFilter:@"CIColorMatrix"
                            withInputParameters:@{
                              @"inputRVector" : [CIVector vectorWithX:r Y:0 Z:0 W:0],
                              @"inputGVector" : [CIVector vectorWithX:g Y:0 Z:0 W:0],
                              @"inputBVector" : [CIVector vectorWithX:b Y:0 Z:0 W:0],
                              @"inputAVector" : [CIVector vectorWithX:1 Y:0 Z:0 W:0],
                              @"inputBiasVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:0],
                            }];
  return [[HeiaLiquidGlassView context] createCGImage:tinted
                                             fromRect:CGRectMake(0, 0, kCloudSize, kCloudSize)
                                               format:kCIFormatRGBA8
                                           colorSpace:gColorSpace];
}

+ (void)ensureCloudTextures
{
  if (gCloudWhite != NULL) {
    return;
  }
  (void)[self context]; // sikrer gColorSpace
  gCloudWhite = HeiaCloudImage(HeiaCloudNoise(1.0, 55.0, 22.0), 1.0, 1.0, 1.0);
  gCloudTeal = HeiaCloudImage(HeiaCloudNoise(7.0, 70.0, 30.0), 0.03, 0.22, 0.18);
}

/** Per-kort utsnitt av den delte teksturen — deterministisk av instansen. */
- (CGRect)cloudRectWithSalt:(NSUInteger)salt
{
  uintptr_t hsh = (uintptr_t)(__bridge void *)self;
  hsh = (hsh >> 4) * 2654435761u + salt * 40503u;
  CGFloat ox = (hsh & 0xFF) / 255.0;
  CGFloat oy = ((hsh >> 8) & 0xFF) / 255.0;
  CGFloat frac = MAX(0.3, MIN(1.0, 1.0 / MAX(0.5, _frostScale)));
  return CGRectMake(ox * (1.0 - frac), oy * (1.0 - frac), frac, frac);
}

- (void)applyFrost
{
  _frostView.hidden = !_frost;
  if (_frost) {
    [HeiaLiquidGlassView ensureCloudTextures];
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _cloudLight.contents = _frost ? (__bridge id)gCloudWhite : nil;
  _cloudLight.contentsRect = [self cloudRectWithSalt:1];
  _cloudLight.opacity = MAX(0.0, MIN(1.0, _frostLight));
  _cloudDark.contents = _frost ? (__bridge id)gCloudTeal : nil;
  _cloudDark.contentsRect = [self cloudRectWithSalt:2];
  _cloudDark.opacity = MAX(0.0, MIN(1.0, _frostDark));
  _cloudDark.transform = CATransform3DMakeScale(-1.0, 1.0, 1.0); // speilet: ulik form
  _bottomShade.colors = @[
    (id)[UIColor colorWithRed:0.03 green:0.22 blue:0.18 alpha:0.0].CGColor,
    (id)[UIColor colorWithRed:0.03 green:0.22 blue:0.18 alpha:MAX(0.0, _frostBottom)].CGColor,
  ];
  _topLight.colors = @[
    (id)[UIColor colorWithWhite:1.0 alpha:MAX(0.0, _frostTop)].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:MAX(0.0, _frostTop) * 0.35].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
  ];
  _edgeLight.opacity = MAX(0.0, MIN(1.0, _frostEdge));
  _edgeDark.opacity = MAX(0.0, MIN(1.0, _frostEdge));
  self.layer.shadowColor = [UIColor colorWithRed:0.03 green:0.22 blue:0.18 alpha:1.0].CGColor;
  self.layer.shadowOpacity = _frost ? MAX(0.0, MIN(1.0, _frostShadow)) : 0.0;
  self.layer.shadowRadius = 12.0;
  self.layer.shadowOffset = CGSizeMake(0.0, 8.0);
  [CATransaction commit];
}

- (void)layoutFrost
{
  CGRect b = self.bounds;
  if (b.size.width < 1 || b.size.height < 1) {
    return;
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _cloudLight.frame = b;
  _cloudDark.frame = b;
  _bottomShade.frame = b;
  _topLight.frame = b;
  _edgeLight.frame = b;
  _edgeDark.frame = b;
  _edgeLightMask.frame = b;
  _edgeDarkMask.frame = b;
  CGPathRef stroke = CGPathCreateWithRoundedRect(CGRectInset(b, 0.5, 0.5),
                                                 MAX(0.5, _cornerRadius - 0.5),
                                                 MAX(0.5, _cornerRadius - 0.5), NULL);
  _edgeLightMask.path = stroke;
  _edgeDarkMask.path = stroke;
  CGPathRelease(stroke);
  CGPathRef shadow = CGPathCreateWithRoundedRect(b, _cornerRadius, _cornerRadius, NULL);
  self.layer.shadowPath = shadow;
  CGPathRelease(shadow);
  [CATransaction commit];
}

- (void)setFrost:(BOOL)v
{
  _frost = v;
  [self applyFrost];
}

- (void)setFrostLight:(CGFloat)v
{
  _frostLight = v;
  [self applyFrost];
}

- (void)setFrostDark:(CGFloat)v
{
  _frostDark = v;
  [self applyFrost];
}

- (void)setFrostTop:(CGFloat)v
{
  _frostTop = v;
  [self applyFrost];
}

- (void)setFrostBottom:(CGFloat)v
{
  _frostBottom = v;
  [self applyFrost];
}

- (void)setFrostEdge:(CGFloat)v
{
  _frostEdge = v;
  [self applyFrost];
}

- (void)setFrostShadow:(CGFloat)v
{
  _frostShadow = v;
  [self applyFrost];
}

- (void)setFrostScale:(CGFloat)v
{
  _frostScale = v;
  [self applyFrost];
}

#pragma mark - Spekular

- (void)applySpecular
{
  CGFloat a = MAX(0.0, MIN(1.0, _specular));
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _specularLayer.colors = @[
    (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:a].CGColor,
    (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
  ];
  _specularLayer.hidden = a <= 0.001;
  [CATransaction commit];
  if (a > 0.001) {
    [self attachScrollObserver];
    [self updateSpecular];
  }
}

/** Båndet glir fra høyre til venstre mens kortet går fra bunn til topp. */
- (void)updateSpecular
{
  if (_specularLayer.hidden || self.window == nil) {
    return;
  }
  CGRect b = self.bounds;
  if (b.size.width < 1 || b.size.height < 1) {
    return;
  }
  CGRect onScreen = [self convertRect:b toView:nil];
  CGFloat screenH = MAX(1.0, self.window.bounds.size.height);
  CGFloat progress = CGRectGetMidY(onScreen) / screenH; // 0 topp … 1 bunn
  progress = MAX(-0.5, MIN(1.5, progress));
  CGFloat travel = b.size.width * 1.4;
  CGFloat x = CGRectGetMidX(b) + (progress - 0.5) * travel;
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _specularLayer.bounds = CGRectMake(0, 0, b.size.width * 1.6, b.size.height * 1.6);
  _specularLayer.position = CGPointMake(x, CGRectGetMidY(b));
  [CATransaction commit];
}

- (void)setSpecular:(CGFloat)v
{
  _specular = v;
  [self applySpecular];
}

#pragma mark - Refraksjon: props

- (void)setRefraction:(BOOL)refraction
{
  _refraction = refraction;
  if (refraction) {
    [self attachScrollObserver];
    [self scheduleRefraction];
  } else {
    if (_specular <= 0.001) {
      [self detachScrollObserver];
    }
    _backdropView.hidden = YES;
    _backdropView.layer.contents = nil;
    _lastValid = NO;
  }
}

- (void)setBackdropSourceID:(NSString *)backdropSourceID
{
  _backdropSourceID = [backdropSourceID copy];
  _sourceView = nil;
  [self invalidateAndSchedule];
}

- (void)setRefractionStrength:(CGFloat)v
{
  _refractionStrength = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionZone:(CGFloat)v
{
  _refractionZone = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionScale:(CGFloat)v
{
  _refractionScale = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionBlur:(CGFloat)v
{
  _refractionBlur = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionSaturation:(CGFloat)v
{
  _refractionSaturation = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionParallax:(CGFloat)v
{
  _refractionParallax = v;
  [self invalidateAndSchedule];
}

- (void)setRefractionLive:(BOOL)v
{
  _refractionLive = v;
}

- (void)invalidateAndSchedule
{
  _lastValid = NO;
  [self scheduleRefraction];
}

#pragma mark - Refraksjon: grunnen

/** RN-viewet med `nativeId == backdropSourceID` (Fabric: RCTViewComponentView.nativeId). */
+ (UIView *)findViewWithNativeID:(NSString *)nativeID from:(UIView *)root
{
  if (root == nil || nativeID.length == 0) {
    return nil;
  }
  if ([root respondsToSelector:@selector(nativeId)]) {
    NSString *candidate = [root performSelector:@selector(nativeId)];
    if ([candidate isKindOfClass:[NSString class]] && [candidate isEqualToString:nativeID]) {
      return root;
    }
  }
  for (UIView *child in root.subviews) {
    UIView *hit = [self findViewWithNativeID:nativeID from:child];
    if (hit != nil) {
      return hit;
    }
  }
  return nil;
}

- (UIView *)resolveSource
{
  UIView *src = _sourceView;
  if (src != nil && src.window == self.window) {
    return src;
  }
  src = [HeiaLiquidGlassView findViewWithNativeID:_backdropSourceID from:self.window];
  _sourceView = src;
  return src;
}

/** ÉN CIContext for alle kort, Metal, RGBA8 — opprettes én gang (Apple: tungt). */
+ (CIContext *)context
{
  if (gContext == nil) {
    gColorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    NSDictionary *options = @{
      kCIContextWorkingFormat : @(kCIFormatRGBA8),
      kCIContextWorkingColorSpace : (__bridge id)gColorSpace,
      kCIContextOutputColorSpace : (__bridge id)gColorSpace,
      kCIContextCacheIntermediates : @NO,
      kCIContextPriorityRequestLow : @NO,
    };
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();
    gContext = device != nil ? [CIContext contextWithMTLDevice:device options:options]
                             : [CIContext contextWithOptions:options];
  }
  return gContext;
}

/**
 * Den delte frost-teksturen: grunnen som bilde (1×), metning ned, Gauss-frost,
 * materialisert som CGImage ÉN gang. `idle` = ingen scroll pågår; grunnen tas
 * aldri på nytt midt i en scroll (det var V3s sekund-hakk).
 */
+ (CIImage *)frostedBackdropFor:(UIView *)source
                           blur:(CGFloat)blur
                     saturation:(CGFloat)saturation
                           idle:(BOOL)idle
{
  CFTimeInterval now = CACurrentMediaTime();
  HeiaBackdropSnapshot *snap = gSnapshot;
  BOOL sameSource = snap != nil && snap.source == source &&
                    CGRectEqualToRect(snap.bounds, source.bounds) &&
                    fabs(snap.blur - blur) < 0.01 && fabs(snap.saturation - saturation) < 0.001;
  if (sameSource) {
    CFTimeInterval age = now - snap.takenAt;
    BOOL due = snap.retakes < kRetakeCount ? age > kRetakeAfter[snap.retakes]
                                           : age > kSnapshotTTL;
    if (!due || !idle) {
      return snap.frosted;
    }
  }
  CGRect bounds = source.bounds;
  if (bounds.size.width < 1 || bounds.size.height < 1) {
    return sameSource ? snap.frosted : nil;
  }
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = kCaptureScale;
  format.opaque = YES;
  UIGraphicsImageRenderer *renderer =
      [[UIGraphicsImageRenderer alloc] initWithSize:bounds.size format:format];
  UIImage *shot = [renderer imageWithActions:^(UIGraphicsImageRendererContext *ctx) {
    [source drawViewHierarchyInRect:bounds afterScreenUpdates:NO];
  }];
  if (shot.CGImage == NULL) {
    return sameSource ? snap.frosted : nil;
  }
  CIImage *raw = [CIImage imageWithCGImage:shot.CGImage];
  CGRect extent = raw.extent;
  CIImage *img = [raw imageByApplyingFilter:@"CIColorControls"
                        withInputParameters:@{kCIInputSaturationKey : @(MAX(0.0, saturation))}];
  CGFloat blurPx = MAX(0.0, blur) * kCaptureScale;
  if (blurPx > 0.05) {
    img = [[[img imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:blurPx]
        imageByCroppingToRect:extent];
  }
  CGImageRef cg = [[self context] createCGImage:img fromRect:extent];
  if (cg == NULL) {
    return sameSource ? snap.frosted : nil;
  }
  HeiaBackdropSnapshot *next = [HeiaBackdropSnapshot new];
  next.source = source;
  next.frosted = [CIImage imageWithCGImage:cg];
  CGImageRelease(cg);
  next.bounds = bounds;
  next.takenAt = now;
  next.retakes = sameSource ? snap.retakes + 1 : 0;
  next.blur = blur;
  next.saturation = saturation;
  gSnapshot = next;
  return next.frosted;
}

#pragma mark - Refraksjon: scroll

- (UIScrollView *)enclosingScrollView
{
  UIView *v = self.superview;
  while (v != nil) {
    if ([v isKindOfClass:[UIScrollView class]]) {
      return (UIScrollView *)v;
    }
    v = v.superview;
  }
  return nil;
}

- (void)attachScrollObserver
{
  UIScrollView *sv = [self enclosingScrollView];
  if (sv == _scrollView) {
    return;
  }
  [self detachScrollObserver];
  if (sv != nil) {
    [sv addObserver:self
         forKeyPath:@"contentOffset"
            options:NSKeyValueObservingOptionNew
            context:kHeiaScrollContext];
    _scrollView = sv;
  }
}

- (void)detachScrollObserver
{
  UIScrollView *sv = _scrollView;
  if (sv != nil) {
    @try {
      [sv removeObserver:self forKeyPath:@"contentOffset" context:kHeiaScrollContext];
    } @catch (NSException *__unused e) {
    }
  }
  _scrollView = nil;
  [NSObject cancelPreviousPerformRequestsWithTarget:self];
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary *)change
                       context:(void *)context
{
  if (context != kHeiaScrollContext) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }
  [self updateSpecular];
  if (!_refraction) {
    return;
  }
  if (_refractionLive) {
    [self scheduleRefraction];
  } else {
    // Kun ved scroll-stopp: siste hendelse vinner.
    [NSObject cancelPreviousPerformRequestsWithTarget:self
                                             selector:@selector(updateRefraction)
                                               object:nil];
    [self performSelector:@selector(updateRefraction) withObject:nil afterDelay:0.12];
  }
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  _sourceView = nil;
  _lastValid = NO;
  if (self.window != nil && (_refraction || _specular > 0.001)) {
    [self attachScrollObserver];
    if (_refraction) {
      [self scheduleRefraction];
    }
    [self updateSpecular];
  } else {
    [self detachScrollObserver];
  }
}

/** Én oppdatering per runloop-runde, uansett hvor mange hendelser. */
- (void)scheduleRefraction
{
  if (!_refraction || _refractionScheduled) {
    return;
  }
  _refractionScheduled = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    self->_refractionScheduled = NO;
    [self updateRefraction];
  });
}

#pragma mark - Refraksjon: bildet

/**
 * Én elliptisk linsesone: CIBumpDistortion i pikselrom, strukket med `aspect`
 * (høyde/bredde) om sitt eget senter. `scale` i −1…1: + løfter/forstørrer,
 * − senker/komprimerer. Affinene er late og faller sammen i samme kjerne.
 */
static CIImage *HeiaLens(CIImage *image, CGPoint center, CGFloat radius, CGFloat scale, CGFloat aspect)
{
  CGAffineTransform squash = CGAffineTransformMakeTranslation(center.x, center.y);
  squash = CGAffineTransformScale(squash, 1.0, 1.0 / MAX(0.2, aspect));
  squash = CGAffineTransformTranslate(squash, -center.x, -center.y);
  CIImage *img = [image imageByApplyingTransform:squash];
  CIFilter *bump = [CIFilter filterWithName:@"CIBumpDistortion"];
  [bump setValue:img forKey:kCIInputImageKey];
  [bump setValue:[CIVector vectorWithX:center.x Y:center.y] forKey:kCIInputCenterKey];
  [bump setValue:@(radius) forKey:kCIInputRadiusKey];
  [bump setValue:@(scale) forKey:kCIInputScaleKey];
  CIImage *out = bump.outputImage;
  if (out == nil) {
    return image;
  }
  return [out imageByApplyingTransform:CGAffineTransformInvert(squash)];
}

- (IOSurface *)makeSurface:(CGSize)size
{
  NSDictionary *props = @{
    IOSurfacePropertyKeyWidth : @((NSUInteger)size.width),
    IOSurfacePropertyKeyHeight : @((NSUInteger)size.height),
    IOSurfacePropertyKeyBytesPerElement : @4,
    IOSurfacePropertyKeyPixelFormat : @((uint32_t)'BGRA'),
  };
  return [[IOSurface alloc] initWithProperties:props];
}

/** Viser forrige rammes render når GPU-en er ferdig med den. */
- (void)flushPending
{
  _flushScheduled = NO;
  if (_pendingTask == nil) {
    return;
  }
  [_pendingTask waitUntilCompletedAndReturnError:nil];
  _pendingTask = nil;
  IOSurface *surface = _pendingSurface;
  _pendingSurface = nil;
  if (surface == nil || !_refraction) {
    return;
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _backdropView.layer.contents = surface;
  _backdropView.hidden = NO;
  [CATransaction commit];
}

- (void)scheduleFlush
{
  if (_flushScheduled) {
    return;
  }
  _flushScheduled = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    [self flushPending];
  });
}

- (void)updateRefraction
{
  if (!_refraction || self.window == nil) {
    return;
  }
  CGRect onScreen = [self convertRect:self.bounds toView:nil];
  if (!CGRectIntersectsRect(onScreen, self.window.bounds)) {
    return; // utenfor skjermen (FlatList-vinduet monterer mer enn det synlige)
  }
  UIView *source = [self resolveSource];
  if (source == nil) {
    return;
  }
  UIScrollView *sv = _scrollView;
  BOOL idle = sv == nil || (!sv.isDragging && !sv.isDecelerating);
  CIImage *backdrop = [HeiaLiquidGlassView frostedBackdropFor:source
                                                          blur:_refractionBlur
                                                    saturation:_refractionSaturation
                                                          idle:idle];
  if (backdrop == nil) {
    return;
  }
  HeiaBackdropSnapshot *snap = gSnapshot;
  if (snap.retakes < kRetakeCount) {
    // Grunnen kan være tegnet etter første capture: hent den igjen etter planen.
    [NSObject cancelPreviousPerformRequestsWithTarget:self
                                             selector:@selector(invalidateAndSchedule)
                                               object:nil];
    [self performSelector:@selector(invalidateAndSchedule)
               withObject:nil
               afterDelay:kRetakeAfter[snap.retakes] + 0.05];
  }

  CGRect inSource = [self convertRect:self.bounds toView:source];
  if (_lastValid && snap.frosted == _lastBackdrop &&
      fabs(inSource.origin.x - _lastRect.origin.x) < kMoveEpsilon &&
      fabs(inSource.origin.y - _lastRect.origin.y) < kMoveEpsilon &&
      CGSizeEqualToSize(inSource.size, _lastRect.size)) {
    return; // ikke flyttet: forrige render står
  }

  const CGFloat s = kCaptureScale;
  CGFloat H = backdrop.extent.size.height;
  CGFloat w = floor(inSource.size.width * s);
  CGFloat h = floor(inSource.size.height * s);
  if (w < 2 || h < 2) {
    return;
  }
  // Core Image har origo nede til venstre: snu y.
  CGRect rect = CGRectMake(inSource.origin.x * s, H - inSource.origin.y * s - h, w, h);
  CGFloat strengthPx = MAX(0.0, _refractionStrength) * s;
  CGFloat zonePx = MAX(0.0, _refractionZone) * s;
  CGFloat pad = MAX(strengthPx, zonePx) * 3.0 + 8.0;

  // Klemming: utenfor grunnen gjentas kantpikselen, så et kort som stikker
  // utenfor skjermen ikke får svart kant.
  CIImage *img = [[backdrop imageByClampingToExtent]
      imageByCroppingToRect:CGRectInset(rect, -pad, -pad)];

  // 1. Forstørrelse om kortets sentrum.
  CGPoint c = CGPointMake(CGRectGetMidX(rect), CGRectGetMidY(rect));
  CGFloat zoom = MAX(1.0, _refractionScale);
  CGAffineTransform t = CGAffineTransformMakeTranslation(c.x, c.y);
  t = CGAffineTransformScale(t, zoom, zoom);
  t = CGAffineTransformTranslate(t, -c.x, -c.y);
  img = [img imageByApplyingTransform:t];

  // 2. Linsesonene — store, myke, elliptiske, gjennom sentrum (Brage: «to
  //    eller tre store, myke og uregelmessige brytningssoner»), og én
  //    kantlinse som er sterkest mot randen. Valgfri parallakse (0 = av).
  CGFloat parallax = 0.0;
  if (sv != nil && _refractionParallax > 0) {
    parallax = MAX(-_refractionParallax, MIN(_refractionParallax, sv.contentOffset.y * 0.03)) * s;
  }
  CGFloat R = MAX(w, h);
  // Forskyvningen i en bule er ≈ scale · radius · 0,4 nær halv radius.
  CGFloat kz = MAX(0.0, MIN(0.95, zonePx / (R * 0.75 * 0.4)));    // sonene
  CGFloat k = MAX(0.0, MIN(0.7, strengthPx / (R * 0.75 * 0.4)));  // kantlinsen
  // Punkter i kortets brøk (UIKit-topp-venstre) → CI (y opp).
  CGPoint (^at)(CGFloat, CGFloat) = ^CGPoint(CGFloat fx, CGFloat fy) {
    return CGPointMake(rect.origin.x + fx * w, rect.origin.y + (1.0 - fy) * h - parallax);
  };
  img = HeiaLens(img, at(0.30, 0.30), R * 0.80, kz, 0.62);          // lys sky øvre venstre
  img = HeiaLens(img, at(0.74, 0.70), R * 0.75, -kz * 0.85, 0.80);  // dyp sone nedre høyre
  img = HeiaLens(img, at(0.52, 0.94), R * 0.60, kz * 0.70, 0.48);   // bred brytning nederst
  img = HeiaLens(img, c, R * 0.95, k * 0.45, h / MAX(1.0, w));     // kantlinsen: sterkest mot randen

  // 3. Kortets utsnitt → (0,0) i overflaten.
  img = [[img imageByCroppingToRect:rect]
      imageByApplyingTransform:CGAffineTransformMakeTranslation(-rect.origin.x, -rect.origin.y)];

  // Dobbeltbufrede IOSurfaces per kortstørrelse.
  CGSize size = CGSizeMake(w, h);
  if (!CGSizeEqualToSize(size, _surfaceSize) || _surfaces[0] == nil) {
    [_pendingTask waitUntilCompletedAndReturnError:nil];
    _pendingTask = nil;
    _pendingSurface = nil;
    _surfaces[0] = [self makeSurface:size];
    _surfaces[1] = [self makeSurface:size];
    _surfaceSize = size;
    _surfaceIndex = 0;
    if (_surfaces[0] == nil || _surfaces[1] == nil) {
      return;
    }
  }
  // Forrige render vises først (GPU-en er ferdig for lengst), så tegnes neste
  // i den andre overflaten — aldri i den som vises.
  [self flushPending];
  IOSurface *target = _surfaces[_surfaceIndex];
  _surfaceIndex = (_surfaceIndex + 1) % 2;

  CIRenderDestination *dest = [[CIRenderDestination alloc] initWithIOSurface:target];
  dest.colorSpace = gColorSpace;
  dest.alphaMode = CIRenderDestinationAlphaNone;
  NSError *error = nil;
  CIRenderTask *task = [[HeiaLiquidGlassView context] startTaskToRender:img
                                                              toDestination:dest
                                                                      error:&error];
  if (task == nil) {
    return;
  }
  _pendingTask = task;
  _pendingSurface = target;
  _lastRect = inSource;
  _lastBackdrop = snap.frosted;
  _lastValid = YES;
  [self scheduleFlush];
}

#pragma mark - Trykk

- (void)setPressed:(BOOL)pressed
{
  _pressed = pressed;
  [self refreshPressed];
}

- (void)handlePress:(UILongPressGestureRecognizer *)recognizer
{
  switch (recognizer.state) {
    case UIGestureRecognizerStateBegan:
      _pressStart = [recognizer locationInView:self];
      _touchDown = YES;
      break;
    case UIGestureRecognizerStateChanged: {
      CGPoint p = [recognizer locationInView:self];
      if (hypot(p.x - _pressStart.x, p.y - _pressStart.y) > kScrollSlop) {
        _touchDown = NO; // fingeren scroller — slipp glasset
      }
      break;
    }
    default:
      _touchDown = NO; // Ended / Cancelled / Failed
      break;
  }
  [self refreshPressed];
}

- (void)refreshPressed
{
  BOOL down = _touchDown || _pressed;
  if (down == _applied) {
    return;
  }
  _applied = down;
  BOOL reduceMotion = UIAccessibilityIsReduceMotionEnabled();
  NSTimeInterval duration = down ? 0.12 : 0.30;
  UIViewAnimationOptions options = UIViewAnimationOptionBeginFromCurrentState |
                                   UIViewAnimationOptionAllowUserInteraction |
                                   UIViewAnimationOptionCurveEaseOut;
  [UIView animateWithDuration:duration
                        delay:0.0
                      options:options
                   animations:^{
                     self->_lightView.alpha = down ? kPressLight : 0.0;
                     if (!reduceMotion) {
                       self->_sheenView.transform =
                           down ? CGAffineTransformMakeTranslation(kPressSlideX, kPressSlideY)
                                : CGAffineTransformIdentity;
                       // Skalerer alle sublag (glass + RN-barn) rundt senter uten
                       // å røre viewets egen frame, som interop-laget eier.
                       CATransform3D pressIn = CATransform3DMakeTranslation(0.0, kPressDropY, 0.0);
                       pressIn = CATransform3DScale(pressIn, kPressScale, kPressScale, 1.0);
                       self.layer.sublayerTransform = down ? pressIn : CATransform3DIdentity;
                     }
                   }
                   completion:nil];
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other
{
  return YES; // lever ved siden av RN sin touch-handler og ScrollView-pan
}

#pragma mark - Layout

- (void)layoutSubviews
{
  [super layoutSubviews];
  // bounds/center (ikke frame): trygt selv om sheen-viewet er transformert.
  CGRect sheenBounds = CGRectInset(self.bounds, -kSheenBleed, -kSheenBleed);
  _sheenView.bounds = CGRectMake(0, 0, sheenBounds.size.width, sheenBounds.size.height);
  _sheenView.center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _sheen.frame = _sheenView.bounds;
  [CATransaction commit];
  [self layoutFrost];
  [self updateSpecular];
  [self layoutShadow];
  [self restack];
  if (_specular > 0.001) {
    [self attachScrollObserver];
  }
  if (_refraction) {
    [self attachScrollObserver];
    [self scheduleRefraction];
  }
}

// RN-barna (interop-laget kan bruke begge veiene). Glasset er alltid bakerst.
- (void)didUpdateReactSubviews
{
  for (UIView *subview in self.reactSubviews) {
    [self addSubview:subview];
  }
  [self restack];
}

- (void)didAddSubview:(UIView *)subview
{
  [super didAddSubview:subview];
  [self restack];
}

@end

#pragma mark - HeiaPearlView (sølvglassets kropp)

/**
 * SØLVGLASSET — se HeiaLiquidGlassView.h. Lagene, nederst først:
 *   kropp      fliser av den DERIVERTE kroppen (CALayer.contents = ett delt
 *              CGImage; utsnitt via contentsRect, speilvending, kryssfading).
 *              Kroppen regnes én gang fra Brages JPEG (originalen røres
 *              ikke): sølvgrå base som følger de store foldene, lokal
 *              foldkontrast, fin frost med begrenset korn, smale lysrygger
 *              på kammene med myk glorie, kne mot hvitt, kjølig tint, grønt
 *              bare i teksturens egne pools. Fliser etter den første bruker
 *              variant B (svakere rygger/glorie, halv grønn) — samme folder,
 *              ikke samme lysbuer.
 *   lys        den bøyde grunnen i SOFT LIGHT (begrenset ±10 %), skjermet på
 *              kammene.  farge  COLOR-blanding: grunnens kulør på kroppens
 *              lysstyrke, gulv + store daler.  glød  SCREEN i lysansamlingene.
 *   sheen      lys som VANDRER (Brage 2026-09-06, tillegg): ryggenes glorie
 *              tent av et bredt, mykt bånd som glir diagonalt over kortet
 *              med kortets skjermposisjon, forskjøvet langs foldene av
 *              scrollens drift, sterkere med scrollfart (energi med rask
 *              anslag og rolig utfading), SCREEN.
 *   dybde / lysglimt  9-delte kantbilder; glimtet følger foldene (maske =
 *              diagonal × glorie) — ingen egen ramme.
 * Per synlig kort per scroll-ramme: ÉN Core Image-render til ÉN IOSurface
 * (venstre halvdel grunnen, høyre halvdel sheen) som fire CA-lag deler via
 * contentsRect. Felt, masker og glorie er statiske per kortstørrelse.
 */

static const CGFloat kPearlMaxPx = 1200.0;
/** Feltet (de store foldene): σ og normalisering (persentil 1/99) målt på JPEG-en. */
static const CGFloat kPearlFieldSigma = 36.0;
static const CGFloat kPearlFieldLo = 0.784;
static const CGFloat kPearlFieldHi = 0.976;
/** Mellomskala (lokal foldkontrast) og frost. */
static const CGFloat kPearlMidSigma = 5.0;
static const CGFloat kPearlFrostLim = 0.02;
/** Kammer = lokal kontrast over foldsnittet: terskel, bredde, kurve; rygg/glorie-σ. */
static const CGFloat kPearlCrestT = 0.02;
static const CGFloat kPearlCrestW = 0.05;
static const CGFloat kPearlCrestP = 1.3;
static const CGFloat kPearlRidgeSigma = 2.0;
static const CGFloat kPearlHaloSigma = 10.0;
/** Lysansamlingene: grønn kroma ×3, σ 12 px, rampe 0,15 → 0,5. */
static const CGFloat kPearlAccumSigma = 12.0;
static const CGFloat kPearlAccumLo = 0.15;
static const CGFloat kPearlAccumHi = 0.50;
/** Kjølig sølvtint og pool-fargen (trekkes fra R/B, legges til G). */
static const CGFloat kPearlTint[3] = {0.955, 0.985, 1.0};
static const CGFloat kPearlPoolNeg[3] = {0.13, 0.0, 0.02};
static const CGFloat kPearlPoolPos[3] = {0.0, 0.03, 0.0};
/** Komprimert regnedomene: alle ledd delt på dette så summen holder seg ≤ 1. */
static const CGFloat kPearlDomain = 1.3;
/** Flis B (høye kort). */
static const CGFloat kPearlTileBRidge = 0.35;
static const CGFloat kPearlTileBHalo = 0.6;
static const CGFloat kPearlTileBGreen = 0.5;
/** Foldekammene (felt-enheter) som lyslaget skjermer, og hvor mye. */
static const CGFloat kPearlCrestFrom = 0.70;
static const CGFloat kPearlCrestTo = 0.95;
static const CGFloat kPearlCrestProtect = 0.70;
/** Flat perlefarge før første dekoding er ferdig. */
static const CGFloat kPearlFlat[3] = {0.86, 0.885, 0.90};
/** Flisenes utsnitt (topp-andel, høyde-andel) etter den første — sykles. */
static const CGFloat kPearlCrops[3][2] = {{0.30, 0.70}, {0.10, 0.80}, {0.25, 0.75}};
/** Bevegelse: anslag/utfading (s), drift langs foldene (px per pt scroll), maks drift (px). */
static const CFTimeInterval kMotionAttack = 0.08;
static const CFTimeInterval kMotionRelease = 0.35;
static const CGFloat kMotionDriftK = 0.05;
static const CGFloat kMotionDriftMax = 12.0;

typedef struct {
  BOOL processed;
  CGFloat base, fold, mid, frost, ridge, halo, knee, green;
} HeiaPearlMaterial;

typedef struct {
  CGFloat y;      // pt, topp i kortet
  CGFloat height; // pt
  CGFloat cropY;  // andel av teksturhøyden
  CGFloat cropH;
  BOOL flip;
} HeiaPearlTile;

static CIImage *gPearlRaw;           // dekodet JPEG (≤ kPearlMaxPx bred)
static CGImageRef gPearlRawCG;
static CGSize gPearlSize;
static NSString *gPearlURI;
static BOOL gPearlLoading;
// Delte kart (materialisert én gang): felt, lysansamlinger, glorie + kroppens ledd.
static CIImage *gPearlField, *gPearlAccum, *gPearlHalo, *gPearlRidge;
static CIImage *gPearlPosLocal, *gPearlNegLocal, *gPearlPosFrost, *gPearlNegFrost;
// Den deriverte kroppen (A = første flis, B = resten) og nøkkelen den ble laget for.
static CGImageRef gPearlBodyA, gPearlBodyB;
static NSString *gPearlBodyKey;
static NSString *gPearlPendingKey;
static BOOL gPearlDeriving;
static NSHashTable<HeiaPearlView *> *gPearlViews;
static NSMutableDictionary<NSString *, id> *gEdgeImages;
static double gPearlEncodeSum, gPearlEncodeMax;
static NSUInteger gPearlEncodeN;
static CADisplayLink *gMotionLink;
static NSHashTable<HeiaPearlView *> *gMotionViews;

#pragma mark Core Image-hjelpere (gråkart, alfa 1)

static CIImage *HeiaGray(CIImage *img, CGFloat scale, CGFloat bias)
{
  return [img imageByApplyingFilter:@"CIColorMatrix"
                withInputParameters:@{
                  @"inputRVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputGVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputBVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputAVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:1],
                  @"inputBiasVector" : [CIVector vectorWithX:bias Y:bias Z:bias W:0],
                }];
}

static CIImage *HeiaClamp(CIImage *img, CGFloat lo, CGFloat hi)
{
  return [img imageByApplyingFilter:@"CIColorClamp"
                withInputParameters:@{
                  @"inputMinComponents" : [CIVector vectorWithX:lo Y:lo Z:lo W:1],
                  @"inputMaxComponents" : [CIVector vectorWithX:hi Y:hi Z:hi W:1],
                }];
}

static CIImage *HeiaRamp(CIImage *img, CGFloat lo, CGFloat hi)
{
  CGFloat g = 1.0 / (hi - lo);
  return HeiaClamp(HeiaGray(img, g, -lo * g), 0.0, 1.0);
}

/** a + b (CIAdditionCompositing, klipper ikke under 1). */
static CIImage *HeiaAdd(CIImage *a, CIImage *b)
{
  return [a imageByApplyingFilter:@"CIAdditionCompositing" withInputParameters:@{kCIInputBackgroundImageKey : b}];
}

/** bg − src, klemt i 0 (CISubtractBlendMode: bakgrunn minus input). */
static CIImage *HeiaSub(CIImage *bg, CIImage *src)
{
  return [src imageByApplyingFilter:@"CISubtractBlendMode" withInputParameters:@{kCIInputBackgroundImageKey : bg}];
}

static CIImage *HeiaMul(CIImage *a, CIImage *b)
{
  return [a imageByApplyingFilter:@"CIMultiplyCompositing" withInputParameters:@{kCIInputBackgroundImageKey : b}];
}

static CIImage *HeiaBlur(CIImage *img, CGFloat sigma, CGRect ext)
{
  if (sigma < 0.05) {
    return img;
  }
  return [[[img imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:sigma] imageByCroppingToRect:ext];
}

static CIImage *HeiaConst(CGFloat v, CGFloat alpha, CGRect ext)
{
  return [[CIImage imageWithColor:[CIColor colorWithRed:v green:v blue:v alpha:alpha]] imageByCroppingToRect:ext];
}

/** Gråverdi i R → RGBA = (a, a, a, a) (premultiplisert grå med alfa = verdien). */
static CIImage *HeiaAlphaFromRed(CIImage *img, CGFloat scale, CGFloat bias)
{
  return [img imageByApplyingFilter:@"CIColorMatrix"
                withInputParameters:@{
                  @"inputRVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputGVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputBVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputAVector" : [CIVector vectorWithX:scale Y:0 Z:0 W:0],
                  @"inputBiasVector" : [CIVector vectorWithX:bias Y:bias Z:bias W:bias],
                }];
}

static CIImage *HeiaMaterialize(CIImage *img, CGRect ext)
{
  CGImageRef cg = [[HeiaLiquidGlassView context] createCGImage:img fromRect:ext];
  if (cg == NULL) {
    return nil;
  }
  CIImage *out = [CIImage imageWithCGImage:cg];
  CGImageRelease(cg);
  return out;
}

static NSString *HeiaMaterialKey(HeiaPearlMaterial m)
{
  return [NSString stringWithFormat:@"%d|%.3f|%.3f|%.3f|%.3f|%.3f|%.3f|%.3f|%.3f", m.processed, m.base, m.fold,
                                    m.mid, m.frost, m.ridge, m.halo, m.knee, m.green];
}

#pragma mark Frame-måler (dev)

/**
 * RAMMEMÅLEREN (Brage 2026-09-06): CADisplayLink på hovedtråden i skjermens
 * egen takt. En ramme er et hakk når avstanden til forrige er > 1,5 × den
 * forventede. Viser Hz, tapt tid i hakk (%), antall, verste ramme og snitt
 * CI-encode per render. Selvhelende: stopper når ingen synlig visning ber om den.
 */
@interface HeiaFrameMeter : NSObject
+ (void)noteView:(HeiaPearlView *)view;
+ (void)setEnabled:(BOOL)enabled inWindow:(UIWindow *)window;
@end

static HeiaFrameMeter *gMeter;
static NSHashTable<HeiaPearlView *> *gMeterViews;

@implementation HeiaFrameMeter {
  CADisplayLink *_link;
  UILabel *_label;
  CFTimeInterval _last;
  CFTimeInterval _expected;
  CFTimeInterval _windowStart;
  NSUInteger _frames;
  NSUInteger _hitches;
  double _hitchTime;
  double _worst;
  double _worstTotal;
  NSUInteger _hitchesTotal;
}

+ (void)noteView:(HeiaPearlView *)view
{
  if (gMeterViews == nil) {
    gMeterViews = [NSHashTable weakObjectsHashTable];
  }
  [gMeterViews addObject:view];
}

+ (BOOL)anyViewWantsMeter
{
  for (HeiaPearlView *v in gMeterViews) {
    if (v.frameMeter && v.window != nil) {
      return YES;
    }
  }
  return NO;
}

+ (void)setEnabled:(BOOL)enabled inWindow:(UIWindow *)window
{
  if (!enabled) {
    [gMeter stop];
    gMeter = nil;
    return;
  }
  if (gMeter == nil) {
    gMeter = [HeiaFrameMeter new];
  }
  [gMeter startInWindow:window];
}

- (void)startInWindow:(UIWindow *)window
{
  if (window == nil) {
    return;
  }
  if (_label == nil) {
    _label = [[UILabel alloc] initWithFrame:CGRectZero];
    _label.font = [UIFont monospacedDigitSystemFontOfSize:11.0 weight:UIFontWeightSemibold];
    _label.textColor = UIColor.whiteColor;
    _label.backgroundColor = [UIColor colorWithWhite:0.0 alpha:0.72];
    _label.numberOfLines = 2;
    _label.userInteractionEnabled = NO;
    _label.layer.cornerRadius = 6.0;
    _label.layer.masksToBounds = YES;
    _label.textAlignment = NSTextAlignmentCenter;
  }
  if (_label.superview != window) {
    [_label removeFromSuperview];
    [window addSubview:_label];
  }
  CGFloat top = window.safeAreaInsets.top;
  _label.frame = CGRectMake(8.0, top + 2.0, window.bounds.size.width - 16.0, 32.0);
  _label.text = @"måler …";
  if (_link == nil) {
    _link = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    [_link addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
  }
  _last = 0;
  _windowStart = 0;
  _frames = _hitches = _hitchesTotal = 0;
  _hitchTime = _worst = _worstTotal = 0;
}

- (void)stop
{
  [_link invalidate];
  _link = nil;
  [_label removeFromSuperview];
}

- (void)tick:(CADisplayLink *)link
{
  if (![HeiaFrameMeter anyViewWantsMeter]) {
    [self stop];
    if (gMeter == self) {
      gMeter = nil;
    }
    return;
  }
  CFTimeInterval now = link.timestamp;
  if (_last > 0) {
    CFTimeInterval dt = now - _last;
    if (_expected > 0 && _expected < 0.025 && dt < 0.5) {
      _frames++;
      if (dt > _expected * 1.5 + 0.002) {
        _hitches++;
        _hitchesTotal++;
        _hitchTime += dt - _expected;
      }
      _worst = MAX(_worst, dt);
      _worstTotal = MAX(_worstTotal, dt);
      if (_windowStart == 0) {
        _windowStart = _last;
      }
    }
  }
  _expected = link.targetTimestamp - link.timestamp;
  _last = now;
  if (_windowStart > 0 && now - _windowStart >= 0.5) {
    double elapsed = now - _windowStart;
    double hz = _frames / elapsed;
    double ci = gPearlEncodeN > 0 ? gPearlEncodeSum / gPearlEncodeN : 0.0;
    _label.text = [NSString stringWithFormat:@"%.0f Hz · hakk %.1f %% (%lu) · verste %.0f ms\nCI %.1f ms/kort (maks %.0f) · totalt %lu hakk, verste %.0f ms",
                                             hz, _hitchTime / elapsed * 100.0, (unsigned long)_hitches,
                                             _worst * 1000.0, ci, gPearlEncodeMax, (unsigned long)_hitchesTotal,
                                             _worstTotal * 1000.0];
    _windowStart = 0;
    _frames = _hitches = 0;
    _hitchTime = _worst = 0;
    gPearlEncodeSum = 0;
    gPearlEncodeN = 0;
    gPearlEncodeMax = 0;
  }
}

@end

#pragma mark - HeiaPearlView

/** Et grunnlag: deler den per-ramme-rendrede overflaten som contents, egen blanding, egen maske. */
static CALayer *HeiaGroundLayer(NSString *blend, BOOL masked)
{
  CALayer *l = [CALayer layer];
  l.contentsGravity = kCAGravityResize;
  l.hidden = YES;
  l.compositingFilter = blend;
  if (masked) {
    CALayer *m = [CALayer layer];
    m.contentsGravity = kCAGravityResize;
    l.mask = m;
  }
  return l;
}

@interface HeiaPearlView ()
- (void)motionTick:(CFTimeInterval)dt;
- (void)applyTexture;
@end

@implementation HeiaPearlView {
  CALayer *_bodyHost;
  NSMutableArray<CALayer *> *_tiles;
  CALayer *_lightLayer;
  CALayer *_lightMask;
  CALayer *_tintLayer;
  CALayer *_tintMask;
  CALayer *_glowLayer;
  CALayer *_glowMask;
  CALayer *_sheenLayer;
  CALayer *_edgeDepthLayer;
  CAGradientLayer *_edgeDepthMask;
  CALayer *_edgeLightLayer;
  CALayer *_edgeLightMask;
  __weak UIView *_sourceView;
  __weak UIScrollView *_scrollView;
  BOOL _scheduled;
  BOOL _flushScheduled;
  IOSurface *_surfaces[2];
  NSUInteger _surfaceIndex;
  CGSize _surfaceSize;
  CIRenderTask *_pendingTask;
  IOSurface *_pendingSurface;
  CGRect _lastRect;
  __weak CIImage *_lastBackdrop;
  BOOL _lastValid;
  CGFloat _lastEnergy;
  CGFloat _lastDrift;
  CIImage *_field;
  CIImage *_halo;
  CGSize _mapsSize;
  CGFloat _mapsFrom, _mapsTo, _mapsFloor, _mapsFollow;
  HeiaPearlMaterial _material;
  BOOL _materialDirty;
  // Bevegelse
  CFTimeInterval _lastScrollT;
  CGFloat _lastScrollY;
  CGFloat _energy;
  CGFloat _drift;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.userInteractionEnabled = NO;
    self.backgroundColor = [UIColor colorWithRed:kPearlFlat[0] green:kPearlFlat[1] blue:kPearlFlat[2] alpha:1.0];
    self.layer.masksToBounds = YES;
    self.layer.cornerCurve = kCACornerCurveContinuous;
    _cornerRadius = 24.0;
    _textureWidth = 0.0;
    _tileOverlap = 56.0;
    _material = (HeiaPearlMaterial){YES, 0.85, 0.07, 0.9, 0.6, 0.24, 0.09, 0.925, 1.0};
    _materialDirty = YES;
    _ground = NO;
    _groundStrength = 260.0;
    _groundLight = 0.5;
    _groundColor = 0.45;
    _groundGlow = 0.35;
    _groundFloor = 0.08;
    _groundValleyFrom = 0.55;
    _groundValleyTo = 0.2;
    _groundBlur = 9.0;
    _groundSaturation = 0.95;
    _groundBlend = @"color";
    _groundLive = YES;
    _sheen = 0.35;
    _sheenMotion = 0.6;
    _sheenPeriod = 700.0;
    _sheenBand = 90.0;
    _motionBend = 0.6;
    _motionBlur = 2.5;
    _motionVRef = 1200.0;
    _edge = YES;
    _edgeLight = 0.9;
    _edgeDepth = 0.5;
    _edgeFollow = 0.6;
    _frameMeter = NO;

    if (gPearlViews == nil) {
      gPearlViews = [NSHashTable weakObjectsHashTable];
    }
    [gPearlViews addObject:self];

    _bodyHost = [CALayer layer];
    _tiles = [NSMutableArray new];
    [self.layer addSublayer:_bodyHost];

    _lightLayer = HeiaGroundLayer(@"softLightBlendMode", YES);
    _lightMask = _lightLayer.mask;
    _tintLayer = HeiaGroundLayer(@"colorBlendMode", YES);
    _tintMask = _tintLayer.mask;
    _glowLayer = HeiaGroundLayer(@"screenBlendMode", YES);
    _glowMask = _glowLayer.mask;
    _sheenLayer = HeiaGroundLayer(@"screenBlendMode", NO);
    CGRect left = CGRectMake(0, 0, 0.5, 1);
    _lightLayer.contentsRect = left;
    _tintLayer.contentsRect = left;
    _glowLayer.contentsRect = left;
    _sheenLayer.contentsRect = CGRectMake(0.5, 0, 0.5, 1);
    [self.layer addSublayer:_lightLayer];
    [self.layer addSublayer:_tintLayer];
    [self.layer addSublayer:_glowLayer];
    [self.layer addSublayer:_sheenLayer];

    _edgeDepthLayer = [CALayer layer];
    _edgeDepthMask = [CAGradientLayer layer];
    _edgeDepthMask.type = kCAGradientLayerRadial;
    _edgeDepthMask.startPoint = CGPointMake(1.0, 1.0);
    _edgeDepthMask.endPoint = CGPointMake(0.25, 0.25);
    _edgeDepthMask.colors = @[
      (id)[UIColor colorWithWhite:1.0 alpha:1.0].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.55].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
    ];
    _edgeDepthMask.locations = @[ @0.0, @0.45, @1.0 ];
    _edgeDepthLayer.mask = _edgeDepthMask;
    [self.layer addSublayer:_edgeDepthLayer];

    _edgeLightLayer = [CALayer layer];
    // Masken lages per kort (diagonal × foldenes glorie) — se rebuildMaps.
    _edgeLightMask = [CALayer layer];
    _edgeLightMask.contentsGravity = kCAGravityResize;
    _edgeLightLayer.mask = _edgeLightMask;
    [self.layer addSublayer:_edgeLightLayer];

    [self applyStrengths];
    [self applyBlend];
    [self applyCorner];
  }
  return self;
}

- (void)dealloc
{
  [self detachScroll];
}

#pragma mark Props

- (void)setCornerRadius:(CGFloat)cornerRadius
{
  _cornerRadius = cornerRadius;
  [self applyCorner];
  [self setNeedsLayout];
}

- (void)applyCorner
{
  self.layer.cornerRadius = _cornerRadius;
}

- (void)setTextureURI:(NSString *)textureURI
{
  _textureURI = [textureURI copy];
  if (textureURI.length > 0) {
    [HeiaPearlView ensureTexture:textureURI for:self];
  }
}

- (void)setTextureWidth:(CGFloat)v { _textureWidth = v; [self setNeedsLayout]; }
- (void)setTileOverlap:(CGFloat)v { _tileOverlap = v; [self setNeedsLayout]; }
- (void)setMaterial:(BOOL)v { _material.processed = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialBase:(CGFloat)v { _material.base = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialFold:(CGFloat)v { _material.fold = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialMid:(CGFloat)v { _material.mid = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialFrost:(CGFloat)v { _material.frost = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialRidge:(CGFloat)v { _material.ridge = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialHalo:(CGFloat)v { _material.halo = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialKnee:(CGFloat)v { _material.knee = v; _materialDirty = YES; [self setNeedsLayout]; }
- (void)setMaterialGreen:(CGFloat)v { _material.green = v; _materialDirty = YES; [self setNeedsLayout]; }
- (BOOL)material { return _material.processed; }
- (CGFloat)materialBase { return _material.base; }
- (CGFloat)materialFold { return _material.fold; }
- (CGFloat)materialMid { return _material.mid; }
- (CGFloat)materialFrost { return _material.frost; }
- (CGFloat)materialRidge { return _material.ridge; }
- (CGFloat)materialHalo { return _material.halo; }
- (CGFloat)materialKnee { return _material.knee; }
- (CGFloat)materialGreen { return _material.green; }
- (void)setGround:(BOOL)v
{
  _ground = v;
  if (v) {
    [self attachScroll];
    [self invalidateAndSchedule];
  } else {
    _lastValid = NO;
    _lightLayer.hidden = _tintLayer.hidden = _glowLayer.hidden = _sheenLayer.hidden = YES;
  }
}
- (void)setGroundStrength:(CGFloat)v { _groundStrength = v; [self invalidateAndSchedule]; }
- (void)setGroundLight:(CGFloat)v { _groundLight = v; [self applyStrengths]; }
- (void)setGroundColor:(CGFloat)v { _groundColor = v; [self applyStrengths]; }
- (void)setGroundGlow:(CGFloat)v { _groundGlow = v; [self applyStrengths]; }
- (void)setGroundFloor:(CGFloat)v { _groundFloor = v; _mapsSize = CGSizeZero; [self setNeedsLayout]; }
- (void)setGroundValleyFrom:(CGFloat)v { _groundValleyFrom = v; _mapsSize = CGSizeZero; [self setNeedsLayout]; }
- (void)setGroundValleyTo:(CGFloat)v { _groundValleyTo = v; _mapsSize = CGSizeZero; [self setNeedsLayout]; }
- (void)setGroundBlur:(CGFloat)v { _groundBlur = v; [self invalidateAndSchedule]; }
- (void)setGroundSaturation:(CGFloat)v { _groundSaturation = v; [self invalidateAndSchedule]; }
- (void)setGroundBlend:(NSString *)v { _groundBlend = [v copy]; [self applyBlend]; }
- (void)setGroundLive:(BOOL)v { _groundLive = v; }
- (void)setSheen:(CGFloat)v { _sheen = v; [self invalidateAndSchedule]; }
- (void)setSheenMotion:(CGFloat)v { _sheenMotion = v; [self invalidateAndSchedule]; }
- (void)setSheenPeriod:(CGFloat)v { _sheenPeriod = v; [self invalidateAndSchedule]; }
- (void)setSheenBand:(CGFloat)v { _sheenBand = v; [self invalidateAndSchedule]; }
- (void)setMotionBend:(CGFloat)v { _motionBend = v; }
- (void)setMotionBlur:(CGFloat)v { _motionBlur = v; }
- (void)setMotionVRef:(CGFloat)v { _motionVRef = v; }
- (void)setEdge:(BOOL)v { _edge = v; _edgeLightLayer.hidden = !v; _edgeDepthLayer.hidden = !v; }
- (void)setEdgeLight:(CGFloat)v { _edgeLight = v; _edgeLightLayer.opacity = (float)MAX(0.0, MIN(1.0, v)); }
- (void)setEdgeDepth:(CGFloat)v { _edgeDepth = v; _edgeDepthLayer.opacity = (float)MAX(0.0, MIN(1.0, v)); }
- (void)setEdgeFollow:(CGFloat)v { _edgeFollow = v; _mapsSize = CGSizeZero; [self setNeedsLayout]; }
- (void)setBackdropSourceID:(NSString *)v { _backdropSourceID = [v copy]; _sourceView = nil; [self invalidateAndSchedule]; }
- (void)setFrameMeter:(BOOL)v
{
  _frameMeter = v;
  [HeiaFrameMeter noteView:self];
  if (v && self.window != nil) {
    [HeiaFrameMeter setEnabled:YES inWindow:self.window];
  }
}

- (void)applyStrengths
{
  _lightLayer.opacity = (float)MAX(0.0, MIN(1.0, _groundLight));
  _tintLayer.opacity = (float)MAX(0.0, MIN(1.0, _groundColor));
  _glowLayer.opacity = (float)MAX(0.0, MIN(1.0, _groundGlow));
  _sheenLayer.opacity = 1.0f; // styrken ligger i renderet (sheen + sheenMotion·energi)
}

/** Fargelagets blanding — «color» er hovedvalget; resten er til sammenligning. */
- (void)applyBlend
{
  NSDictionary *names = @{
    @"color" : @"colorBlendMode",
    @"hue" : @"hueBlendMode",
    @"multiply" : @"multiplyBlendMode",
    @"softLight" : @"softLightBlendMode",
    @"screen" : @"screenBlendMode",
    @"overlay" : @"overlayBlendMode",
    @"luminosity" : @"luminosityBlendMode",
  };
  _tintLayer.compositingFilter = _groundBlend != nil ? names[_groundBlend] : nil;
}

#pragma mark Teksturen (delt) og den deriverte kroppen

+ (void)ensureTexture:(NSString *)uri for:(HeiaPearlView *)view
{
  if (gPearlRaw != nil && [gPearlURI isEqualToString:uri]) {
    [view applyTexture];
    return;
  }
  if (gPearlLoading) {
    return;
  }
  NSURL *url = [NSURL URLWithString:uri];
  if (url == nil) {
    return;
  }
  [HeiaLiquidGlassView context]; // opprettes på hovedtråden
  gPearlLoading = YES;
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithURL:url
    completionHandler:^(NSData *data, NSURLResponse *__unused response, NSError *__unused error) {
      CGImageRef raw = NULL;
      if (data.length > 0) {
        CGImageSourceRef src = CGImageSourceCreateWithData((__bridge CFDataRef)data, NULL);
        if (src != NULL) {
          NSDictionary *opts = @{
            (id)kCGImageSourceCreateThumbnailFromImageAlways : @YES,
            (id)kCGImageSourceThumbnailMaxPixelSize : @(kPearlMaxPx),
            (id)kCGImageSourceShouldCacheImmediately : @YES,
            (id)kCGImageSourceCreateThumbnailWithTransform : @YES,
          };
          raw = CGImageSourceCreateThumbnailAtIndex(src, 0, (__bridge CFDictionaryRef)opts);
          CFRelease(src);
        }
      }
      NSDictionary<NSString *, CIImage *> *maps = raw != NULL ? [HeiaPearlView deriveMapsFrom:raw] : nil;
      dispatch_async(dispatch_get_main_queue(), ^{
        gPearlLoading = NO;
        if (raw != NULL && maps != nil) {
          if (gPearlRawCG != NULL) {
            CGImageRelease(gPearlRawCG);
          }
          gPearlRawCG = raw;
          gPearlRaw = [CIImage imageWithCGImage:raw];
          gPearlSize = CGSizeMake(CGImageGetWidth(raw), CGImageGetHeight(raw));
          gPearlURI = [uri copy];
          gPearlField = maps[@"field"];
          gPearlAccum = maps[@"accum"];
          gPearlHalo = maps[@"halo"];
          gPearlRidge = maps[@"ridge"];
          gPearlPosLocal = maps[@"posLocal"];
          gPearlNegLocal = maps[@"negLocal"];
          gPearlPosFrost = maps[@"posFrost"];
          gPearlNegFrost = maps[@"negFrost"];
          gPearlBodyKey = nil;
          [HeiaPearlView requestBody:view->_material];
        } else if (raw != NULL) {
          CGImageRelease(raw);
        }
      });
    }];
  [task resume];
}

/**
 * De delte kartene fra den dekodede JPEG-en (bakgrunnstråd, materialisert):
 *   field     luminans σ 36 → de store foldene, 0–1
 *   posLocal/negLocal  M − F og F − M (lokal foldkontrast, klemt i 0)
 *   posFrost/negFrost  L − M og M − L, begrenset (fin frost, ikke korn)
 *   ridge/halo  kammene (lokal kontrast over terskel, kurve) σ 2 / σ 10
 *   accum     grønn kroma → lysansamlingene
 */
+ (NSDictionary<NSString *, CIImage *> *)deriveMapsFrom:(CGImageRef)raw
{
  CIImage *img = [CIImage imageWithCGImage:raw];
  CGRect ext = img.extent;
  CGFloat s = ext.size.width / 1916.0;
  CIVector *lumV = [CIVector vectorWithX:0.2126 Y:0.7152 Z:0.0722 W:0];
  CIImage *lum = [img imageByApplyingFilter:@"CIColorMatrix"
                        withInputParameters:@{
                          @"inputRVector" : lumV,
                          @"inputGVector" : lumV,
                          @"inputBVector" : lumV,
                          @"inputAVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:1],
                        }];
  lum = HeiaMaterialize(lum, ext);
  CIImage *fraw = HeiaMaterialize(HeiaBlur(lum, kPearlFieldSigma * s, ext), ext);
  CIImage *mid = HeiaMaterialize(HeiaBlur(lum, kPearlMidSigma * s, ext), ext);
  if (lum == nil || fraw == nil || mid == nil) {
    return nil;
  }
  CIImage *field = HeiaRamp(fraw, kPearlFieldLo, kPearlFieldHi);
  CIImage *posLocal = HeiaSub(mid, fraw);
  CIImage *negLocal = HeiaSub(fraw, mid);
  CIImage *posFrost = HeiaClamp(HeiaSub(lum, mid), 0.0, kPearlFrostLim);
  CIImage *negFrost = HeiaClamp(HeiaSub(mid, lum), 0.0, kPearlFrostLim);
  CIImage *crest = HeiaRamp(posLocal, kPearlCrestT, kPearlCrestT + kPearlCrestW);
  crest = [crest imageByApplyingFilter:@"CIGammaAdjust" withInputParameters:@{@"inputPower" : @(kPearlCrestP)}];
  crest = HeiaMaterialize(crest, ext);
  if (crest == nil) {
    return nil;
  }
  CIImage *ridge = HeiaBlur(crest, kPearlRidgeSigma * s, ext);
  CIImage *halo = HeiaBlur(crest, kPearlHaloSigma * s, ext);
  CIVector *chromaV = [CIVector vectorWithX:-1.5 Y:3.0 Z:-1.5 W:0];
  CIImage *chroma = [img imageByApplyingFilter:@"CIColorMatrix"
                           withInputParameters:@{
                             @"inputRVector" : chromaV,
                             @"inputGVector" : chromaV,
                             @"inputBVector" : chromaV,
                             @"inputAVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:1],
                           }];
  CIImage *accum = HeiaRamp(HeiaBlur(HeiaClamp(chroma, 0.0, 1.0), kPearlAccumSigma * s, ext), kPearlAccumLo, kPearlAccumHi);
  NSMutableDictionary *out = [NSMutableDictionary new];
  NSDictionary *lazy = @{
    @"field" : field, @"posLocal" : posLocal, @"negLocal" : negLocal, @"posFrost" : posFrost,
    @"negFrost" : negFrost, @"ridge" : ridge, @"halo" : halo, @"accum" : accum,
  };
  for (NSString *key in lazy) {
    CIImage *m = HeiaMaterialize(lazy[key], ext);
    if (m == nil) {
      return nil;
    }
    out[key] = m;
  }
  return out;
}

/** Kroppen fra kartene (bakgrunnstråd). ridge/halo/green skaleres for flis B. */
+ (CGImageRef)deriveBody:(HeiaPearlMaterial)m ridgeScale:(CGFloat)rs haloScale:(CGFloat)hs greenScale:(CGFloat)gs
{
  CGRect ext = gPearlRaw.extent;
  if (!m.processed) {
    return [[HeiaLiquidGlassView context] createCGImage:gPearlRaw fromRect:ext];
  }
  const CGFloat D = kPearlDomain;
  CIImage *img = HeiaGray(gPearlField, m.fold / D, m.base / D);
  img = HeiaAdd(HeiaGray(gPearlPosLocal, m.mid / D, 0), img);
  img = HeiaSub(img, HeiaGray(gPearlNegLocal, m.mid / D, 0));
  img = HeiaAdd(HeiaGray(gPearlPosFrost, m.frost / D, 0), img);
  img = HeiaSub(img, HeiaGray(gPearlNegFrost, m.frost / D, 0));
  img = HeiaAdd(HeiaGray(gPearlRidge, m.ridge * rs / D, 0), img);
  img = HeiaAdd(HeiaGray(gPearlHalo, m.halo * hs / D, 0), img);
  // Kne mot hvitt: tonekurve i det komprimerte domenet (x = L/D).
  CGFloat k = MAX(0.5, MIN(0.99, m.knee));
  CGFloat y3 = k + (1 - k) * tanh(1.0);
  CGFloat y4 = k + (1 - k) * tanh((D - k) / (1 - k));
  CIFilter *tone = [CIFilter filterWithName:@"CIToneCurve"];
  [tone setValue:img forKey:kCIInputImageKey];
  [tone setValue:[CIVector vectorWithX:0 Y:0] forKey:@"inputPoint0"];
  [tone setValue:[CIVector vectorWithX:0.5 / D Y:0.5] forKey:@"inputPoint1"];
  [tone setValue:[CIVector vectorWithX:k / D Y:k] forKey:@"inputPoint2"];
  [tone setValue:[CIVector vectorWithX:1.0 / D Y:y3] forKey:@"inputPoint3"];
  [tone setValue:[CIVector vectorWithX:1.0 Y:y4] forKey:@"inputPoint4"];
  img = tone.outputImage ?: img;
  // Kjølig sølvtint, så grønt bare i pools.
  img = [img imageByApplyingFilter:@"CIColorMatrix"
              withInputParameters:@{
                @"inputRVector" : [CIVector vectorWithX:kPearlTint[0] Y:0 Z:0 W:0],
                @"inputGVector" : [CIVector vectorWithX:0 Y:kPearlTint[1] Z:0 W:0],
                @"inputBVector" : [CIVector vectorWithX:0 Y:0 Z:kPearlTint[2] W:0],
              }];
  CGFloat g = m.green * gs;
  CIImage *poolNeg = [gPearlAccum imageByApplyingFilter:@"CIColorMatrix"
                                    withInputParameters:@{
                                      @"inputRVector" : [CIVector vectorWithX:kPearlPoolNeg[0] * g Y:0 Z:0 W:0],
                                      @"inputGVector" : [CIVector vectorWithX:kPearlPoolNeg[1] * g Y:0 Z:0 W:0],
                                      @"inputBVector" : [CIVector vectorWithX:kPearlPoolNeg[2] * g Y:0 Z:0 W:0],
                                      @"inputAVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:1],
                                    }];
  CIImage *poolPos = [gPearlAccum imageByApplyingFilter:@"CIColorMatrix"
                                    withInputParameters:@{
                                      @"inputRVector" : [CIVector vectorWithX:kPearlPoolPos[0] * g Y:0 Z:0 W:0],
                                      @"inputGVector" : [CIVector vectorWithX:kPearlPoolPos[1] * g Y:0 Z:0 W:0],
                                      @"inputBVector" : [CIVector vectorWithX:kPearlPoolPos[2] * g Y:0 Z:0 W:0],
                                      @"inputAVector" : [CIVector vectorWithX:0 Y:0 Z:0 W:1],
                                    }];
  img = HeiaSub(img, poolNeg);
  img = HeiaAdd(poolPos, img);
  return [[HeiaLiquidGlassView context] createCGImage:[img imageByCroppingToRect:ext] fromRect:ext];
}

/** Lag kroppen for et materialsett (deduplisert på nøkkel, én derivasjon om gangen). */
+ (void)requestBody:(HeiaPearlMaterial)m
{
  if (gPearlRaw == nil) {
    return;
  }
  NSString *key = HeiaMaterialKey(m);
  if ([key isEqualToString:gPearlBodyKey]) {
    return;
  }
  if (gPearlDeriving) {
    gPearlPendingKey = key;
    return;
  }
  gPearlDeriving = YES;
  gPearlPendingKey = nil;
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    CGImageRef a = [HeiaPearlView deriveBody:m ridgeScale:1.0 haloScale:1.0 greenScale:1.0];
    CGImageRef b = m.processed ? [HeiaPearlView deriveBody:m
                                                 ridgeScale:kPearlTileBRidge
                                                  haloScale:kPearlTileBHalo
                                                 greenScale:kPearlTileBGreen]
                               : (a != NULL ? CGImageRetain(a) : NULL);
    dispatch_async(dispatch_get_main_queue(), ^{
      gPearlDeriving = NO;
      if (a != NULL && b != NULL) {
        if (gPearlBodyA != NULL) {
          CGImageRelease(gPearlBodyA);
        }
        if (gPearlBodyB != NULL) {
          CGImageRelease(gPearlBodyB);
        }
        gPearlBodyA = a;
        gPearlBodyB = b;
        gPearlBodyKey = key;
        for (HeiaPearlView *v in [gPearlViews allObjects]) {
          [v applyTexture];
        }
      } else {
        if (a != NULL) {
          CGImageRelease(a);
        }
        if (b != NULL) {
          CGImageRelease(b);
        }
      }
      if (gPearlPendingKey != nil && ![gPearlPendingKey isEqualToString:gPearlBodyKey]) {
        // Et nyere materialsett kom mens vi regnet: den som ba om det, ber igjen ved layout.
        for (HeiaPearlView *v in [gPearlViews allObjects]) {
          v->_materialDirty = YES;
          [v setNeedsLayout];
        }
      }
    });
  });
}

- (void)applyTexture
{
  if (gPearlBodyA == NULL) {
    return;
  }
  _mapsSize = CGSizeZero;
  [self setNeedsLayout];
  [self layoutIfNeeded];
}

#pragma mark Fliser

- (NSArray<NSValue *> *)tilesForSize:(CGSize)size
{
  NSMutableArray *out = [NSMutableArray new];
  if (gPearlSize.width < 1 || size.width < 1 || size.height < 1) {
    return out;
  }
  CGFloat texW = _textureWidth > 0 ? _textureWidth : size.width;
  CGFloat texH = texW * gPearlSize.height / gPearlSize.width;
  CGFloat overlap = MAX(0.0, MIN(_tileOverlap, texH * 0.4));
  HeiaPearlTile first = {0.0, texH, 0.0, 1.0, NO};
  [out addObject:[NSValue valueWithBytes:&first objCType:@encode(HeiaPearlTile)]];
  CGFloat y = texH;
  NSUInteger i = 0;
  while (y < size.height && out.count < 12) {
    const CGFloat *crop = kPearlCrops[i % 3];
    HeiaPearlTile t = {y - overlap, texH * crop[1], crop[0], crop[1], (i % 2) == 0};
    [out addObject:[NSValue valueWithBytes:&t objCType:@encode(HeiaPearlTile)]];
    y = t.y + t.height;
    i++;
  }
  return out;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (_materialDirty) {
    _materialDirty = NO;
    [HeiaPearlView requestBody:_material];
  }
  CGRect b = self.bounds;
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _bodyHost.frame = b;
  for (CALayer *l in @[ _lightLayer, _lightMask, _tintLayer, _tintMask, _glowLayer, _glowMask, _sheenLayer,
                        _edgeDepthLayer, _edgeDepthMask, _edgeLightLayer, _edgeLightMask ]) {
    l.frame = b;
  }
  [self layoutTiles];
  [self layoutEdge];
  [CATransaction commit];
  if (!CGSizeEqualToSize(b.size, _mapsSize) || fabs(_mapsFrom - _groundValleyFrom) > 0.0001 ||
      fabs(_mapsTo - _groundValleyTo) > 0.0001 || fabs(_mapsFloor - _groundFloor) > 0.0001 ||
      fabs(_mapsFollow - _edgeFollow) > 0.0001) {
    [self rebuildMaps];
  }
  if (_ground) {
    [self attachScroll];
    [self invalidateAndSchedule];
  }
}

- (void)layoutTiles
{
  NSArray<NSValue *> *tiles = gPearlBodyA != NULL ? [self tilesForSize:self.bounds.size] : @[];
  while (_tiles.count > tiles.count) {
    [_tiles.lastObject removeFromSuperlayer];
    [_tiles removeLastObject];
  }
  while (_tiles.count < tiles.count) {
    CALayer *l = [CALayer layer];
    l.contentsGravity = kCAGravityResize;
    l.anchorPoint = CGPointMake(0.5, 0.5);
    [_bodyHost addSublayer:l];
    [_tiles addObject:l];
  }
  CGFloat w = self.bounds.size.width;
  CGFloat texW = _textureWidth > 0 ? _textureWidth : w;
  [tiles enumerateObjectsUsingBlock:^(NSValue *v, NSUInteger i, BOOL *__unused stop) {
    HeiaPearlTile t;
    [v getValue:&t];
    CALayer *l = self->_tiles[i];
    l.contents = (__bridge id)(i == 0 || gPearlBodyB == NULL ? gPearlBodyA : gPearlBodyB);
    l.contentsRect = CGRectMake(0, t.cropY, 1, t.cropH);
    l.transform = CATransform3DIdentity;
    l.frame = CGRectMake(0, t.y, texW, t.height);
    l.transform = t.flip ? CATransform3DMakeScale(-1, 1, 1) : CATransform3DIdentity;
    if (i == 0) {
      l.mask = nil;
    } else {
      CAGradientLayer *m = [l.mask isKindOfClass:[CAGradientLayer class]] ? (CAGradientLayer *)l.mask
                                                                           : [CAGradientLayer layer];
      m.frame = l.bounds;
      m.startPoint = CGPointMake(0.5, 0.0);
      m.endPoint = CGPointMake(0.5, 1.0);
      CGFloat fade = MIN(1.0, MAX(0.0, MIN(self->_tileOverlap, t.height * 0.4)) / MAX(1.0, t.height));
      m.colors = @[
        (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
        (id)[UIColor colorWithWhite:1.0 alpha:1.0].CGColor,
      ];
      m.locations = @[ @0.0, @(fade) ];
      l.mask = m;
    }
  }];
}

/** Ett flisekomponert kart (samme utsnitt, speiling og kryssfading som kroppen), 1× px. */
- (CIImage *)tiledMap:(CIImage *)map tiles:(NSArray<NSValue *> *)tiles size:(CGSize)size base:(CGFloat)base
{
  CGFloat w = size.width, h = size.height;
  CGFloat W = gPearlSize.width, H = gPearlSize.height;
  CGFloat texW = _textureWidth > 0 ? _textureWidth : w;
  CGRect full = CGRectMake(0, 0, w, h);
  CIImage *out = HeiaConst(base, 1.0, full);
  CGFloat overlap = MAX(0.0, MIN(_tileOverlap, (texW * H / W) * 0.4));
  for (NSUInteger i = 0; i < tiles.count; i++) {
    HeiaPearlTile t;
    [tiles[i] getValue:&t];
    CGRect src = CGRectMake(0, H * (1.0 - t.cropY - t.cropH), W, H * t.cropH);
    CGFloat sx = texW / W, sy = t.height / src.size.height;
    CGFloat top = h - t.y; // flisens overkant i CI (y opp)
    CGAffineTransform m = CGAffineTransformIdentity;
    m = CGAffineTransformTranslate(m, t.flip ? texW : 0.0, top - t.height);
    m = CGAffineTransformScale(m, t.flip ? -sx : sx, sy);
    m = CGAffineTransformTranslate(m, 0.0, -src.origin.y);
    CIImage *part = [[map imageByCroppingToRect:src] imageByApplyingTransform:m];
    if (i == 0 || overlap < 1.0) {
      out = [part imageByCompositingOverImage:out];
      continue;
    }
    CIFilter *grad = [CIFilter filterWithName:@"CILinearGradient"];
    [grad setValue:[CIVector vectorWithX:0 Y:top - overlap] forKey:@"inputPoint0"];
    [grad setValue:[CIVector vectorWithX:0 Y:top] forKey:@"inputPoint1"];
    [grad setValue:[CIColor colorWithRed:1 green:1 blue:1] forKey:@"inputColor0"];
    [grad setValue:[CIColor colorWithRed:0 green:0 blue:0] forKey:@"inputColor1"];
    CIImage *mask = [grad.outputImage imageByCroppingToRect:full];
    out = [part imageByApplyingFilter:@"CIBlendWithMask"
                 withInputParameters:@{kCIInputBackgroundImageKey : out, kCIInputMaskImageKey : mask}];
  }
  return [out imageByCroppingToRect:full];
}

/**
 * Per kortstørrelse, materialisert én gang: feltet (bøyningen), glorien
 * (sheen) og maskene —
 *   farge  gulv + de store dalene (felt lavt)
 *   lys    1 − beskyttelse · kammene (felt høyt)
 *   glød   lysansamlingene
 *   glimt  diagonal (skarpt TL, svakt midt, nytt glimt BR) × (1 − f + f · glorie):
 *          kantlyset lyser der en fold møter kanten, ikke som en ring.
 */
- (void)rebuildMaps
{
  CGSize size = self.bounds.size;
  _mapsSize = size;
  _mapsFrom = _groundValleyFrom;
  _mapsTo = _groundValleyTo;
  _mapsFloor = _groundFloor;
  _mapsFollow = _edgeFollow;
  _field = nil;
  _halo = nil;
  _lightMask.contents = _tintMask.contents = _glowMask.contents = _edgeLightMask.contents = nil;
  _lastValid = NO;
  if (gPearlField == nil || gPearlAccum == nil || gPearlHalo == nil || size.width < 2 || size.height < 2) {
    return;
  }
  NSArray<NSValue *> *tiles = [self tilesForSize:size];
  CGFloat w = size.width, h = size.height;
  CGRect full = CGRectMake(0, 0, w, h);
  CIImage *field = [self tiledMap:gPearlField tiles:tiles size:size base:0.5];
  CIImage *accum = [self tiledMap:gPearlAccum tiles:tiles size:size base:0.0];
  CIImage *halo = [self tiledMap:gPearlHalo tiles:tiles size:size base:0.0];

  CGFloat from = _groundValleyFrom, to = _groundValleyTo;
  CIImage *valley = HeiaRamp(field, from, MIN(to, from - 0.001));
  CGFloat fl = MAX(0.0, MIN(1.0, _groundFloor));
  CIImage *tint = HeiaAlphaFromRed(valley, 1.0 - fl, fl);
  CIImage *crest = HeiaRamp(field, kPearlCrestFrom, kPearlCrestTo);
  CIImage *light = HeiaAlphaFromRed(crest, -kPearlCrestProtect, 1.0);
  CIImage *glow = HeiaAlphaFromRed(accum, 1.0, 0.0);
  // Kantglimtets maske: diagonal t (TL 0 → BR 1) gjennom en fempunkts kurve, × foldenes glorie.
  CIFilter *diag = [CIFilter filterWithName:@"CILinearGradient"];
  [diag setValue:[CIVector vectorWithX:0 Y:h] forKey:@"inputPoint0"];
  [diag setValue:[CIVector vectorWithX:w Y:0] forKey:@"inputPoint1"];
  [diag setValue:[CIColor colorWithRed:0 green:0 blue:0] forKey:@"inputColor0"];
  [diag setValue:[CIColor colorWithRed:1 green:1 blue:1] forKey:@"inputColor1"];
  CIFilter *curve = [CIFilter filterWithName:@"CIToneCurve"];
  [curve setValue:[diag.outputImage imageByCroppingToRect:full] forKey:kCIInputImageKey];
  [curve setValue:[CIVector vectorWithX:0.0 Y:1.0] forKey:@"inputPoint0"];
  [curve setValue:[CIVector vectorWithX:0.28 Y:0.40] forKey:@"inputPoint1"];
  [curve setValue:[CIVector vectorWithX:0.55 Y:0.14] forKey:@"inputPoint2"];
  [curve setValue:[CIVector vectorWithX:0.82 Y:0.50] forKey:@"inputPoint3"];
  [curve setValue:[CIVector vectorWithX:1.0 Y:0.85] forKey:@"inputPoint4"];
  CGFloat f = MAX(0.0, MIN(1.0, _edgeFollow));
  CIImage *follow = HeiaClamp(HeiaGray(halo, f * 1.6, 1.0 - f), 0.0, 1.0);
  CIImage *edgeMask = HeiaAlphaFromRed(HeiaMul(curve.outputImage ?: HeiaConst(1, 1, full), follow), 1.0, 0.0);

  _field = HeiaMaterialize([field imageByCroppingToRect:full], full);
  _halo = HeiaMaterialize([halo imageByCroppingToRect:full], full);
  CIContext *ctx = [HeiaLiquidGlassView context];
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  CALayer *masks[4] = {_tintMask, _lightMask, _glowMask, _edgeLightMask};
  CIImage *images[4] = {tint, light, glow, edgeMask};
  for (int i = 0; i < 4; i++) {
    CGImageRef cg = [ctx createCGImage:[images[i] imageByCroppingToRect:full] fromRect:full];
    if (cg != NULL) {
      masks[i].contents = (__bridge id)cg;
      CGImageRelease(cg);
    }
  }
  [CATransaction commit];
}

#pragma mark Kanten

/** 9-delt glans/dybde-bilde for en radius — delt av alle kort med samme radius. */
+ (CGImageRef)edgeImageForRadius:(CGFloat)r depth:(BOOL)depth
{
  NSString *key = [NSString stringWithFormat:@"%@%.1f", depth ? @"d" : @"l", r];
  if (gEdgeImages == nil) {
    gEdgeImages = [NSMutableDictionary new];
  }
  id cached = gEdgeImages[key];
  if (cached != nil) {
    return (__bridge CGImageRef)cached;
  }
  const CGFloat scale = 3.0;
  CGFloat S = 2.0 * r + 48.0;
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = scale;
  format.opaque = NO;
  UIGraphicsImageRenderer *renderer =
      [[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(S, S) format:format];
  UIImage *img = [renderer imageWithActions:^(UIGraphicsImageRendererContext *ctx) {
    CGContextRef c = ctx.CGContext;
    void (^ring)(CGFloat, CGFloat, UIColor *) = ^(CGFloat inset, CGFloat width, UIColor *color) {
      CGFloat d = inset + width / 2.0;
      CGRect rect = CGRectInset(CGRectMake(0, 0, S, S), d, d);
      UIBezierPath *p = [UIBezierPath bezierPathWithRoundedRect:rect cornerRadius:MAX(0.5, r - d)];
      CGContextSetStrokeColorWithColor(c, color.CGColor);
      CGContextSetLineWidth(c, width);
      CGContextAddPath(c, p.CGPath);
      CGContextStrokePath(c);
    };
    if (depth) {
      UIColor *grey = [UIColor colorWithRed:0.65 green:0.70 blue:0.73 alpha:1.0];
      ring(2.5, 9.0, [grey colorWithAlphaComponent:0.34]);
      ring(1.5, 3.0, [grey colorWithAlphaComponent:0.22]);
    } else {
      // Smal leppe ytterst → bredere, mykere overgang innover.
      ring(0.5, 1.0, [UIColor colorWithWhite:1.0 alpha:0.96]);
      ring(1.5, 2.0, [UIColor colorWithWhite:1.0 alpha:0.30]);
      ring(3.0, 4.0, [UIColor colorWithWhite:1.0 alpha:0.12]);
      ring(6.0, 7.0, [UIColor colorWithWhite:1.0 alpha:0.05]);
    }
  }];
  CGImageRef out = NULL;
  if (img.CGImage != NULL) {
    CIImage *ci = [CIImage imageWithCGImage:img.CGImage];
    CGRect ext = ci.extent;
    CGFloat sigma = depth ? 3.5 * scale : 0.6 * scale;
    CIImage *soft = HeiaBlur(ci, sigma, ext);
    out = [[HeiaLiquidGlassView context] createCGImage:soft fromRect:ext];
  }
  if (out != NULL) {
    gEdgeImages[key] = (__bridge_transfer id)out;
  }
  return out;
}

- (void)layoutEdge
{
  CGFloat r = MAX(1.0, _cornerRadius);
  CGFloat S = 2.0 * r + 48.0;
  CGRect center = CGRectMake((r + 23.0) / S, (r + 23.0) / S, 2.0 / S, 2.0 / S);
  CGImageRef light = [HeiaPearlView edgeImageForRadius:r depth:NO];
  CGImageRef depth = [HeiaPearlView edgeImageForRadius:r depth:YES];
  _edgeLightLayer.contentsScale = 3.0;
  _edgeLightLayer.contentsCenter = center;
  _edgeLightLayer.contentsGravity = kCAGravityResize;
  _edgeLightLayer.contents = light != NULL ? (__bridge id)light : nil;
  _edgeDepthLayer.contentsScale = 3.0;
  _edgeDepthLayer.contentsCenter = center;
  _edgeDepthLayer.contentsGravity = kCAGravityResize;
  _edgeDepthLayer.contents = depth != NULL ? (__bridge id)depth : nil;
  _edgeLightLayer.hidden = !_edge;
  _edgeDepthLayer.hidden = !_edge;
  _edgeLightLayer.opacity = (float)MAX(0.0, MIN(1.0, _edgeLight));
  _edgeDepthLayer.opacity = (float)MAX(0.0, MIN(1.0, _edgeDepth));
}

#pragma mark Grunnen: scroll og bevegelse

- (UIScrollView *)enclosingScrollView
{
  UIView *v = self.superview;
  while (v != nil) {
    if ([v isKindOfClass:[UIScrollView class]]) {
      return (UIScrollView *)v;
    }
    v = v.superview;
  }
  return nil;
}

- (void)attachScroll
{
  UIScrollView *sv = [self enclosingScrollView];
  if (sv == _scrollView) {
    return;
  }
  [self detachScroll];
  if (sv != nil) {
    [sv addObserver:self forKeyPath:@"contentOffset" options:NSKeyValueObservingOptionNew context:kHeiaScrollContext];
    _scrollView = sv;
    _lastScrollT = 0;
  }
}

- (void)detachScroll
{
  UIScrollView *sv = _scrollView;
  if (sv != nil) {
    @try {
      [sv removeObserver:self forKeyPath:@"contentOffset" context:kHeiaScrollContext];
    } @catch (NSException *__unused e) {
    }
  }
  _scrollView = nil;
  [gMotionViews removeObject:self];
  [NSObject cancelPreviousPerformRequestsWithTarget:self];
}

/**
 * ENERGIEN: scrollfart → 0–1 med rask anslag og rolig utfading, driften langs
 * foldene akkumuleres av forflytningen. Etter scroll-stopp fader energien ut
 * gjennom motionTick (delt CADisplayLink) — ingen brå landing. Redusert
 * bevegelse: alltid 0.
 */
- (void)feedScrollY:(CGFloat)y
{
  CFTimeInterval now = CACurrentMediaTime();
  if (_lastScrollT > 0) {
    CFTimeInterval dt = MAX(1.0 / 240.0, MIN(0.25, now - _lastScrollT));
    CGFloat dy = y - _lastScrollY;
    CGFloat v = dy / dt;
    if (UIAccessibilityIsReduceMotionEnabled()) {
      _energy = 0;
    } else {
      CGFloat target = MIN(1.0, fabs(v) / MAX(1.0, _motionVRef));
      CFTimeInterval tau = target > _energy ? kMotionAttack : kMotionRelease;
      CGFloat a = 1.0 - exp(-dt / tau);
      _energy += (target - _energy) * a;
      _drift += dy * kMotionDriftK;
      if (_energy > 0.005) {
        [HeiaPearlView startMotionFor:self];
      }
    }
  }
  _lastScrollT = now;
  _lastScrollY = y;
}

+ (void)startMotionFor:(HeiaPearlView *)view
{
  if (gMotionViews == nil) {
    gMotionViews = [NSHashTable weakObjectsHashTable];
  }
  [gMotionViews addObject:view];
  if (gMotionLink == nil) {
    gMotionLink = [CADisplayLink displayLinkWithTarget:[HeiaPearlView class] selector:@selector(motionLinkTick:)];
    [gMotionLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
  }
}

+ (void)motionLinkTick:(CADisplayLink *)link
{
  CFTimeInterval dt = MAX(0.001, MIN(0.1, link.targetTimestamp - link.timestamp));
  NSArray *views = [gMotionViews allObjects];
  for (HeiaPearlView *v in views) {
    [v motionTick:dt];
  }
  if (gMotionViews.count == 0) {
    [gMotionLink invalidate];
    gMotionLink = nil;
  }
}

- (void)motionTick:(CFTimeInterval)dt
{
  UIScrollView *sv = _scrollView;
  BOOL scrolling = sv != nil && (sv.isDragging || sv.isDecelerating);
  CFTimeInterval sinceScroll = CACurrentMediaTime() - _lastScrollT;
  if (!scrolling || sinceScroll > 0.08) {
    _energy *= exp(-dt / kMotionRelease);
  }
  if (_energy < 0.005 || self.window == nil || !_ground) {
    _energy = 0;
    [gMotionViews removeObject:self];
  }
  if (fabs(_energy - _lastEnergy) > 0.003) {
    _lastValid = NO;
    [self scheduleGround];
  }
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary *)change
                       context:(void *)context
{
  if (context != kHeiaScrollContext) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }
  if (!_ground) {
    return;
  }
  UIScrollView *sv = _scrollView;
  if (sv != nil) {
    [self feedScrollY:sv.contentOffset.y];
  }
  if (_groundLive) {
    [self scheduleGround];
  } else {
    [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(updateGround) object:nil];
    [self performSelector:@selector(updateGround) withObject:nil afterDelay:0.12];
  }
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  _sourceView = nil;
  _lastValid = NO;
  if (self.window != nil && _ground) {
    [self attachScroll];
    [self scheduleGround];
  } else {
    [self detachScroll];
  }
  if (self.window != nil && _frameMeter) {
    [HeiaFrameMeter noteView:self];
    [HeiaFrameMeter setEnabled:YES inWindow:self.window];
  }
}

- (void)invalidateAndSchedule
{
  _lastValid = NO;
  [self scheduleGround];
}

- (void)scheduleGround
{
  if (!_ground || _scheduled) {
    return;
  }
  _scheduled = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    self->_scheduled = NO;
    [self updateGround];
  });
}

- (UIView *)resolveSource
{
  UIView *src = _sourceView;
  if (src != nil && src.window == self.window) {
    return src;
  }
  src = [HeiaLiquidGlassView findViewWithNativeID:_backdropSourceID from:self.window];
  _sourceView = src;
  return src;
}

#pragma mark Grunnen: bildet

- (IOSurface *)makeSurface:(CGSize)size
{
  NSDictionary *props = @{
    IOSurfacePropertyKeyWidth : @((NSUInteger)size.width),
    IOSurfacePropertyKeyHeight : @((NSUInteger)size.height),
    IOSurfacePropertyKeyBytesPerElement : @4,
    IOSurfacePropertyKeyPixelFormat : @((uint32_t)'BGRA'),
  };
  return [[IOSurface alloc] initWithProperties:props];
}

- (void)flushPending
{
  _flushScheduled = NO;
  if (_pendingTask == nil) {
    return;
  }
  [_pendingTask waitUntilCompletedAndReturnError:nil];
  _pendingTask = nil;
  IOSurface *surface = _pendingSurface;
  _pendingSurface = nil;
  if (surface == nil || !_ground) {
    return;
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _lightLayer.contents = surface;
  _tintLayer.contents = surface;
  _glowLayer.contents = surface;
  _sheenLayer.contents = surface;
  _lightLayer.hidden = _tintLayer.hidden = _glowLayer.hidden = _sheenLayer.hidden = NO;
  [CATransaction commit];
}

- (void)scheduleFlush
{
  if (_flushScheduled) {
    return;
  }
  _flushScheduled = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    [self flushPending];
  });
}

/**
 * ÉN render per synlig kort per ramme: [ grunnen bøyd gjennom feltet | sheen ]
 *   grunnen  utsnitt av den delte frostede grunnen (kortets plass i grunnen),
 *            bevegelsesblur ∝ energi, CIDisplacementDistortion med feltet
 *            (styrke · (1 + bend·energi))
 *   sheen    foldenes glorie, forskjøvet langs foldene av driften, tent av et
 *            bredt mykt diagonalt bånd som vandrer med kortets skjermposisjon
 *            (én sveip per `sheenPeriod` pt), styrke sheen + sheenMotion·energi.
 *            Redusert bevegelse: båndet står, energien er 0.
 */
- (void)updateGround
{
  if (!_ground || self.window == nil || _field == nil) {
    return;
  }
  CGRect onScreen = [self convertRect:self.bounds toView:nil];
  if (!CGRectIntersectsRect(onScreen, self.window.bounds)) {
    return;
  }
  UIView *source = [self resolveSource];
  if (source == nil) {
    return;
  }
  UIScrollView *sv = _scrollView;
  BOOL idle = sv == nil || (!sv.isDragging && !sv.isDecelerating);
  CIImage *backdrop = [HeiaLiquidGlassView frostedBackdropFor:source
                                                          blur:_groundBlur
                                                    saturation:_groundSaturation
                                                          idle:idle];
  if (backdrop == nil) {
    return;
  }
  HeiaBackdropSnapshot *snap = gSnapshot;
  if (snap.retakes < kRetakeCount) {
    [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(invalidateAndSchedule) object:nil];
    [self performSelector:@selector(invalidateAndSchedule)
               withObject:nil
               afterDelay:kRetakeAfter[snap.retakes] + 0.05];
  }
  CGRect inSource = [self convertRect:self.bounds toView:source];
  BOOL reduceMotion = UIAccessibilityIsReduceMotionEnabled();
  CGFloat energy = reduceMotion ? 0.0 : _energy;
  CGFloat drift = reduceMotion ? 0.0 : kMotionDriftMax * sin(_drift / kMotionDriftMax);
  if (_lastValid && snap.frosted == _lastBackdrop &&
      fabs(inSource.origin.x - _lastRect.origin.x) < kMoveEpsilon &&
      fabs(inSource.origin.y - _lastRect.origin.y) < kMoveEpsilon &&
      CGSizeEqualToSize(inSource.size, _lastRect.size) && fabs(energy - _lastEnergy) < 0.003 &&
      fabs(drift - _lastDrift) < 0.1) {
    return;
  }
  CFTimeInterval t0 = CACurrentMediaTime();
  const CGFloat s = kCaptureScale;
  CGFloat H = backdrop.extent.size.height;
  CGFloat w = floor(inSource.size.width * s);
  CGFloat h = floor(inSource.size.height * s);
  if (w < 2 || h < 2) {
    return;
  }
  CGRect full = CGRectMake(0, 0, w, h);
  // 1. Grunnen.
  CGRect rect = CGRectMake(inSource.origin.x * s, H - inSource.origin.y * s - h, w, h);
  CGFloat strength = MAX(0.0, _groundStrength) * (1.0 + MAX(0.0, _motionBend) * energy);
  CGFloat pad = 0.25 * strength + 8.0;
  CIImage *img = [[backdrop imageByClampingToExtent] imageByCroppingToRect:CGRectInset(rect, -pad, -pad)];
  CGFloat blurPx = MAX(0.0, _motionBlur) * energy * s;
  if (blurPx > 0.15) {
    img = [[[img imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:blurPx]
        imageByCroppingToRect:CGRectInset(rect, -pad, -pad)];
  }
  CIImage *field = [[_field imageByApplyingTransform:CGAffineTransformMakeTranslation(rect.origin.x, rect.origin.y)]
      imageByClampingToExtent];
  CIFilter *disp = [CIFilter filterWithName:@"CIDisplacementDistortion"];
  [disp setValue:img forKey:kCIInputImageKey];
  [disp setValue:field forKey:@"inputDisplacementImage"];
  [disp setValue:@(strength) forKey:kCIInputScaleKey];
  CIImage *ground = disp.outputImage ?: img;
  ground = [[ground imageByCroppingToRect:rect]
      imageByApplyingTransform:CGAffineTransformMakeTranslation(-rect.origin.x, -rect.origin.y)];

  // 2. Sheen (høyre halvdel).
  CIImage *sheen = nil;
  CGFloat amp = MAX(0.0, _sheen) + MAX(0.0, _sheenMotion) * energy;
  if (_halo != nil && amp > 0.005) {
    CIImage *halo = [[[_halo imageByApplyingTransform:CGAffineTransformMakeTranslation(drift * s, 0)]
        imageByClampingToExtent] imageByCroppingToRect:full];
    CIImage *lit = halo;
    if (!reduceMotion) {
      CGFloat band = MAX(10.0, _sheenBand) * s;
      CGFloat period = MAX(50.0, _sheenPeriod);
      CGFloat phase = fmod(onScreen.origin.y / period + 10.0, 1.0);
      CGFloat span = w + h + 2.0 * band;
      CGFloat u = -band + phase * span; // langs diagonalen fra øvre venstre (CI: (0,h)) mot nedre høyre (w,0)
      CGPoint c = CGPointMake(u / M_SQRT2, h - u / M_SQRT2);
      CIFilter *rad = [CIFilter filterWithName:@"CIRadialGradient"];
      [rad setValue:[CIVector vectorWithX:c.x Y:c.y] forKey:@"inputCenter"];
      [rad setValue:@0.0 forKey:@"inputRadius0"];
      [rad setValue:@(band) forKey:@"inputRadius1"];
      [rad setValue:[CIColor colorWithRed:1 green:1 blue:1 alpha:1] forKey:@"inputColor0"];
      [rad setValue:[CIColor colorWithRed:1 green:1 blue:1 alpha:0] forKey:@"inputColor1"];
      // Strekk glorien 8× langs båndets lengderetning (1,1)/√2 om senteret.
      CGAffineTransform t = CGAffineTransformMakeTranslation(c.x, c.y);
      t = CGAffineTransformRotate(t, M_PI_4);
      t = CGAffineTransformScale(t, 8.0, 1.0);
      t = CGAffineTransformRotate(t, -M_PI_4);
      t = CGAffineTransformTranslate(t, -c.x, -c.y);
      CIImage *bandImg = [[rad.outputImage imageByApplyingTransform:t] imageByCroppingToRect:full];
      lit = HeiaMul(halo, bandImg);
    }
    sheen = HeiaAlphaFromRed(lit, MIN(1.5, amp), 0.0);
    sheen = [[sheen imageByCroppingToRect:full] imageByApplyingTransform:CGAffineTransformMakeTranslation(w, 0)];
  }
  CGRect both = CGRectMake(0, 0, 2 * w, h);
  CIImage *out = [ground imageByCompositingOverImage:HeiaConst(0.0, 0.0, both)];
  if (sheen != nil) {
    out = [sheen imageByCompositingOverImage:out];
  }
  out = [out imageByCroppingToRect:both];

  CGSize size = CGSizeMake(2 * w, h);
  if (!CGSizeEqualToSize(size, _surfaceSize) || _surfaces[0] == nil) {
    [_pendingTask waitUntilCompletedAndReturnError:nil];
    _pendingTask = nil;
    _pendingSurface = nil;
    _surfaces[0] = [self makeSurface:size];
    _surfaces[1] = [self makeSurface:size];
    _surfaceSize = size;
    _surfaceIndex = 0;
    if (_surfaces[0] == nil || _surfaces[1] == nil) {
      return;
    }
  }
  [self flushPending];
  IOSurface *target = _surfaces[_surfaceIndex];
  _surfaceIndex = (_surfaceIndex + 1) % 2;
  CIRenderDestination *dest = [[CIRenderDestination alloc] initWithIOSurface:target];
  dest.colorSpace = gColorSpace;
  dest.alphaMode = CIRenderDestinationAlphaPremultiplied;
  NSError *error = nil;
  CIRenderTask *task = [[HeiaLiquidGlassView context] startTaskToRender:out toDestination:dest error:&error];
  if (task == nil) {
    return;
  }
  _pendingTask = task;
  _pendingSurface = target;
  _lastRect = inSource;
  _lastBackdrop = snap.frosted;
  _lastEnergy = energy;
  _lastDrift = drift;
  _lastValid = YES;
  [self scheduleFlush];
  double ms = (CACurrentMediaTime() - t0) * 1000.0;
  gPearlEncodeSum += ms;
  gPearlEncodeMax = MAX(gPearlEncodeMax, ms);
  gPearlEncodeN++;
#if DEBUG
  if (gPearlEncodeN % 120 == 0 && gMeter == nil) {
    NSLog(@"[pearl] %lu renders: encode avg %.2f ms, max %.2f ms — %.0f×%.0f px",
          (unsigned long)gPearlEncodeN, gPearlEncodeSum / gPearlEncodeN, gPearlEncodeMax, 2 * w, h);
    gPearlEncodeSum = 0;
    gPearlEncodeMax = 0;
    gPearlEncodeN = 0;
  }
#endif
}

@end
