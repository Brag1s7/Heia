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

@end

NS_ASSUME_NONNULL_END
