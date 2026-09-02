#import "HeiaLiquidGlassView.h"
#import <React/UIView+React.h>

/**
 * LAGENE, nederst først:
 *   glass   UIVisualEffectView med UIGlassEffect (iOS 26): systemets blur,
 *           refraksjon, optiske kant og adaptive lysing for lesbarhet.
 *           Låst til lys appearance. Under iOS 26 kompileres et
 *           UIBlurEffect-fallback, men JS sender aldri eldre iOS hit.
 *   sheen   ÉN delt CAGradientLayer (i `_sheenView`) i contentView: hvitt
 *           0,18 → 0 diagonalt fra øvre venstre.
 *   lys     `_lightView`: hvit flate, alfa 0 i hvile — lyset som «trykkes
 *           inn» i glasset ved touch.
 *   barn    RN-barna monteres over glasset; glasset holdes alltid bakerst.
 *
 * TRYKKRESPONSEN (funnet 2026-09-02 på fysisk iPhone: «merkes ikke»):
 *   Årsak 1: `UIGlassEffect.interactive` får ALDRI touch — RN-barna dekker
 *   hele flaten, hit-testen stopper i RN-viewet, og Apple har ingen API for
 *   å utløse responsen manuelt. Årsak 2: `pressed`-propen fra JS finnes
 *   bare på kort med Pressable, og i feeden får FeedCard `onPress` KUN for
 *   kampposter (TeamHomeScreen) — vanlige poster har ingen Pressable.
 *   Løsning: én UILongPressGestureRecognizer med minimumPressDuration 0 på
 *   dette viewet. RN sin RCTSurfaceTouchHandler har cancelsTouchesInView NO
 *   og hindrer ikke andre gjenkjennere, så pillene/⋯/kommentar i kortet
 *   fungerer som før. Touch-down → umiddelbart (120 ms); bevegelse > 12 pt
 *   (scroll) eller slipp/avbrudd → tilbake (260 ms). Alltid
 *   BeginFromCurrentState = avbrytbar. Reduce Motion → kun lys (opacity),
 *   ingen gliding. Ingen loop, ingen haptikk. JS-`pressed` (kampkortene)
 *   OR-es inn i samme tilstand.
 */
@interface HeiaLiquidGlassView () <UIGestureRecognizerDelegate>
@end

@implementation HeiaLiquidGlassView {
  UIVisualEffectView *_effectView;
  UIView *_sheenView;
  CAGradientLayer *_sheen;
  UIView *_lightView;
  UILongPressGestureRecognizer *_press;
  CGPoint _pressStart;
  BOOL _touchDown;
  BOOL _applied;
}

static const CGFloat kSheenBleed = 28.0;
// Runde 5 (Brage: «altfor svakt»): lys 0,12 → 0,28, sheen 14/8 → 26/16 pt,
// pluss innoverskyv 0,975 via sublayerTransform (rører ikke RN sin frame).
// Runde 6 (Brage: «boksen burde bevege seg»): skala 0,975 → 0,96 + 2 pt ned.
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
    // Nesten fargeløs perlegrå — JS sender GLASS.tint, dette er bare default.
    _glassTint = [UIColor colorWithRed:0.914 green:0.922 blue:0.918 alpha:0.34];

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
    _sheen.colors = @[
      (id)[UIColor colorWithWhite:1.0 alpha:0.18].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.06].CGColor,
      (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
    ];
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
  }
  return self;
}

- (UIVisualEffect *)makeEffect
{
  if (@available(iOS 26.0, *)) {
    UIGlassEffect *glass = [[UIGlassEffect alloc] init];
    glass.tintColor = _glassTint;
    // Får aldri touch bak RN-barna (se toppen) — står for det tilfellet UIKit
    // en dag videresender; responsen vår er den som faktisk kjører.
    glass.interactive = !UIAccessibilityIsReduceMotionEnabled();
    return glass;
  }
  return [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemThinMaterialLight];
}

- (void)applyCornerRadius
{
  _effectView.layer.cornerRadius = _cornerRadius;
}

- (void)setCornerRadius:(CGFloat)cornerRadius
{
  _cornerRadius = cornerRadius;
  [self applyCornerRadius];
}

- (void)setGlassTint:(UIColor *)glassTint
{
  _glassTint = glassTint;
  _effectView.effect = [self makeEffect];
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
  [self sendSubviewToBack:_effectView];
}

// RN-barna (interop-laget kan bruke begge veiene). Glasset er alltid bakerst.
- (void)didUpdateReactSubviews
{
  for (UIView *subview in self.reactSubviews) {
    [self addSubview:subview];
  }
  [self sendSubviewToBack:_effectView];
}

- (void)didAddSubview:(UIView *)subview
{
  [super didAddSubview:subview];
  [self sendSubviewToBack:_effectView];
}

@end
