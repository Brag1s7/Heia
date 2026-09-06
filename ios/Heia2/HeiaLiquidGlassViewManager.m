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
RCT_EXPORT_VIEW_PROPERTY(pressColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(cardShadow, UIColor)
RCT_EXPORT_VIEW_PROPERTY(sheenOpacity, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(interactive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(glassStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(refraction, BOOL)
RCT_EXPORT_VIEW_PROPERTY(backdropSourceID, NSString)
RCT_EXPORT_VIEW_PROPERTY(refractionStrength, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionZone, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionScale, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionBlur, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionSaturation, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionParallax, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(refractionLive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(frost, BOOL)
RCT_EXPORT_VIEW_PROPERTY(frostLight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostDark, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostTop, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostBottom, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostEdge, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostShadow, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frostScale, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(specular, CGFloat)

@end

/** Sølvglassets kropp — se HeiaPearlView i HeiaLiquidGlassView.h. */
@interface HeiaPearlViewManager : RCTViewManager
@end

@implementation HeiaPearlViewManager

RCT_EXPORT_MODULE(HeiaPearlView)

- (UIView *)view
{
  return [HeiaPearlView new];
}

RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(textureURI, NSString)
RCT_EXPORT_VIEW_PROPERTY(backdropSourceID, NSString)
RCT_EXPORT_VIEW_PROPERTY(textureWidth, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(tileOverlap, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(material, BOOL)
RCT_EXPORT_VIEW_PROPERTY(materialBase, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialFold, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialMid, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialFrost, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialRidge, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialHalo, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialKnee, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(materialGreen, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(ground, BOOL)
RCT_EXPORT_VIEW_PROPERTY(groundStrength, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundLight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundColor, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundGlow, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundFloor, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundValleyFrom, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundValleyTo, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundBlur, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundSaturation, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(groundBlend, NSString)
RCT_EXPORT_VIEW_PROPERTY(groundLive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(sheen, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(sheenMotion, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(sheenPeriod, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(sheenBand, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(motionBend, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(motionBlur, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(motionVRef, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(edge, BOOL)
RCT_EXPORT_VIEW_PROPERTY(edgeLight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(edgeDepth, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(edgeFollow, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(frameMeter, BOOL)

@end
