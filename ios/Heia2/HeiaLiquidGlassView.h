#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * HeiaLiquidGlassView — iOS-prototype (Brage 2026-09-02): ekte systemglass
 * (UIGlassEffect, iOS 26) bak FeedCard. ÉN konsument via
 * `LiquidGlassSurface.tsx`. Eldre iOS / Android / Reduce Transparency går
 * ALDRI hit — JS velger `OpalSurface` der.
 */
@interface HeiaLiquidGlassView : UIView

@property (nonatomic, assign) CGFloat cornerRadius;
/** Nøytral grå/mint tint i glasset (alfa styrer styrken). Aldri hvitt fyll. */
@property (nonatomic, strong, nullable) UIColor *glassTint;
/** Trykktilstand fra Pressable: flytter det delte lyset svakt. */
@property (nonatomic, assign) BOOL pressed;
/** Sheenens toppopasitet (0–1). Kort 0,18, kontrollglass (compose) 0,09. */
@property (nonatomic, assign) CGFloat sheenOpacity;
/**
 * NO = ingen trykkrespons: gjenkjenneren slås av og glasset settes
 * ikke-interaktivt. Compose-boksen — feltet og kameraknappen er kontrollene.
 */
@property (nonatomic, assign) BOOL interactive;

@end

NS_ASSUME_NONNULL_END
