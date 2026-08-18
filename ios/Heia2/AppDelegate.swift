import UIKit
internal import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Heia2",
      in: window,
      launchOptions: launchOptions
    )

    // Push: la RN-modulen håndtere forgrunns-visning og trykk på varsler.
    UNUserNotificationCenter.current().delegate = self

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Deep links (heia://-skjemaet + Universal Links fra heiaapp.no)

  // heia:// — «Åpne Heia-appen»-knappen på landingssidene (web/betaling).
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links — krever applinks:heiaapp.no i entitlements + AASA på domenet.
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }

  // MARK: - Push notifications (APNs → @react-native-community/push-notification-ios)
  //
  // De tre RNCPushNotificationIOS-kallene under speiler klassemetodene i
  // pod'ens RNCPushNotificationIOS.h. Skulle Xcode klage på et navn ved
  // rebuild: skriv `RNCPushNotificationIOS.` og la autofullfør vise riktig
  // signatur (Swift-bro-navnene kan variere litt mellom versjoner).

  // 'register'-eventet i JS: APNs ga oss enhetens token.
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    RNCPushNotificationIOS.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
  }

  // (Metoden for registreringsfeil er utelatt med vilje: Swift importerer
  // RNCPushNotificationIOS' `...WithError:`-klassemetode under et navn som
  // ikke lot seg bygge, og 'registrationError'-eventet er ikke-essensielt —
  // JS-siden håndterer fraværet stille. Kan legges til igjen senere.)

  // Innkommende remote-varsel (app i bakgrunn/oppe). Må kalle completion.
  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    RNCPushNotificationIOS.didReceiveRemoteNotification(userInfo, fetchCompletionHandler: completionHandler)
  }

  // Brukeren TRYKKET på et varsel (fra bakgrunn, lukket app eller banneret i
  // forgrunn). Uten denne videresendingen når trykket aldri JS: appen åpnes
  // bare der den sto, og 'notification'-lytteren (userInteraction) tier —
  // nøyaktig symptomet «push åpner appen, men navigerer ikke».
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    RNCPushNotificationIOS.didReceive(response)
    completionHandler()
  }

  // Varsel levert mens appen er i forgrunn → vis banner + lyd likevel.
  // (Ren iOS-API, trenger ikke RN-modulen.)
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
