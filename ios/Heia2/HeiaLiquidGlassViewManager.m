#import <React/RCTViewManager.h>
#import "HeiaLiquidGlassView.h"

/** Legacy view manager — kjører gjennom RN 0.83s interop-lag, ingen codegen. */
@interface HeiaLiquidGlassViewManager : RCTViewManager
@end

@implementation HeiaLiquidGlassViewManager

RCT_EXPORT_MODULE(HeiaLiquidGlassView)

- (UIView *)view
{
  return [HeiaLiquidGlassView new];
}

RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(glassTint, UIColor)
RCT_EXPORT_VIEW_PROPERTY(pressed, BOOL)
RCT_EXPORT_VIEW_PROPERTY(sheenOpacity, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(interactive, BOOL)

@end
