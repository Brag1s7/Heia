//
//  Heia2-Bridging-Header.h
//  Eksponerer ObjC-pod'en @react-native-community/push-notification-ios for
//  vår Swift-AppDelegate. Uten dette kan ikke Swift kalle RNCPushNotificationIOS.
//
//  Build-setting som må peke hit (settes én gang i Xcode):
//    Target Heia2 → Build Settings → «Objective-C Bridging Header»
//      = Heia2/Heia2-Bridging-Header.h
//
#import <UserNotifications/UserNotifications.h>
#import <Expo/Expo.h>
#import <RNCPushNotificationIOS/RNCPushNotificationIOS.h>
