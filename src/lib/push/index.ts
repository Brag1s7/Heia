import {Platform} from 'react-native';
import {registerDeviceToken, unregisterDeviceToken} from '../api/push';
import {openNotificationTarget} from '../../navigation/deepLink';

// Native modul (@react-native-community/push-notification-ios) leverer APNs-
// token og permission-flyten. Den finnes FØRST etter `npm install` + pod +
// rebuild. Lazy require i try/catch: appen skal ikke krasje på import i en
// build der pod'en ennå ikke er inne (jf. «ikke referer en native modul som
// ikke er bygget inn»). Før rebuild er PNIOS null og alt her er no-op.
let PNIOS: any = null;
try {
  PNIOS = require('@react-native-community/push-notification-ios').default;
} catch {
  PNIOS = null;
}

let lastToken: string | null = null;
let listenersAttached = false;
let initialChecked = false;

/**
 * Nyttelasten i varselet.
 *
 * `sendApns` sprer `payload.data` på TOPPNIVÅ i APNs-JSON-en, og biblioteket
 * legger alle nøkler utenom `aps` i `_data`. Derfor ligger `event_id` flatt i
 * `getData()` — ikke nøstet under `data`. Både lytterens varsel og
 * kaldstart-varselet er `PushNotificationIOS`-instanser, så begge har getData().
 */
function pushData(notification: any): Record<string, any> {
  return notification?.getData?.() ?? notification?.data ?? notification ?? {};
}

/**
 * Åpner målet varselet handler om — samme mapping som Varsler-sidens
 * trykk (klubbdør → Profil-stacken, kamp → EventDetail, post/kommentar →
 * kommentartråden). Varsler uten mål gjør ingenting utover å åpne appen.
 */
function openFromPush(notification: any): void {
  openNotificationTarget(pushData(notification));
}

export type PushPermission =
  | 'authorized'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export function isPushAvailable(): boolean {
  return Platform.OS === 'ios' && PNIOS != null;
}

// try/catch rundt native-kallene fanger vinduet der JS-modulen er npm-
// installert, men pod'en ennå ikke er bygget inn: da resolver require, men
// native-kall kaster «native module is null». Skal ikke krasje appen.
function attachListeners(): void {
  if (listenersAttached || !isPushAvailable()) {
    return;
  }
  listenersAttached = true;
  try {
    // 'register' fyrer når APNs har gitt oss enhetens token.
    PNIOS.addEventListener('register', async (token: string) => {
      lastToken = token;
      try {
        await registerDeviceToken(token, 'ios');
      } catch {
        // Svelges: neste forsøk prøver igjen. Ikke verdt en feilmelding.
      }
    });
    PNIOS.addEventListener('registrationError', () => {
      // Typisk simulator uten APNs, eller manglende capability. Stille.
    });
    PNIOS.addEventListener('notification', (notification: any) => {
      // `userInteraction` (satt til 1 av native-siden) skiller et TRYKK fra
      // en levering. Uten den ville appen hoppet til kampen mens brukeren
      // holdt på med noe helt annet.
      if (pushData(notification).userInteraction) {
        openFromPush(notification);
      }
      // Forgrunns-levering: feeden er live via realtime uansett. Kvitter ut.
      notification.finish?.(
        PNIOS.FetchResult?.NoData ?? 'UIBackgroundFetchResultNoData',
      );
    });
    // Et TRYKK mens appen KJØRER (bakgrunn eller forgrunns-banner) kommer
    // IKKE på 'notification'-kanalen: AppDelegates didReceive-videresending
    // postes av pod'en som kLocalNotificationReceived → JS-eventet
    // 'localNotification' (RNCPushNotificationIOS.m linje 124). Payloaden er
    // UN-formatert, så getData() returnerer userInfo — samme flate nøkler
    // (event_id, screen, …) pluss userInteraction. Kaldstart går utenom
    // begge kanalene (getInitialNotification/launchOptions).
    PNIOS.addEventListener('localNotification', (notification: any) => {
      if (pushData(notification).userInteraction) {
        openFromPush(notification);
      }
    });
  } catch {
    listenersAttached = false;
  }
}

/**
 * Kaldstart: ble appen startet ved at brukeren trykket på et varsel, ligger
 * det varselet her — og ingen lytter har fyrt, fordi appen ikke levde da det
 * kom. Må derfor leses eksplisitt, og bare én gang per prosess.
 *
 * Målet parkeres av `openNotificationTarget` til navigatoren er klar, som den
 * aldri er så tidlig i oppstarten.
 */
export async function consumeInitialNotification(): Promise<void> {
  if (initialChecked || !isPushAvailable()) {
    return;
  }
  initialChecked = true;
  try {
    const initial = await PNIOS.getInitialNotification();
    if (initial) {
      openFromPush(initial);
    }
  } catch {
    // Ikke linket ennå, eller ingen ventende varsel. Uansett ikke en feil.
  }
}

/**
 * Nåværende varsel-status. Brukes av Profil-siden for å vise av/på og avgjøre
 * om et trykk skal be om tillatelse eller sende brukeren til Innstillinger.
 */
export async function getPushPermission(): Promise<PushPermission> {
  if (!isPushAvailable()) {
    return 'unavailable';
  }
  return new Promise(resolve => {
    try {
      PNIOS.checkPermissions((perms: any) => {
        // authorizationStatus: 0 ikke bestemt, 1 avslått, 2 gitt,
        // 3 provisional, 4 ephemeral. Faller tilbake på `alert` på eldre libs.
        const s = perms?.authorizationStatus;
        if (s === 2 || s === 3 || s === 4) {
          resolve('authorized');
        } else if (s === 1) {
          resolve('denied');
        } else if (s === 0) {
          resolve('undetermined');
        } else {
          resolve(perms?.alert ? 'authorized' : 'undetermined');
        }
      });
    } catch {
      resolve('unavailable');
    }
  });
}

/**
 * Registrerer token STILLE hvis brukeren allerede har sagt ja — uten dialog.
 * Kalles ved innlogging (PushGate). Har brukeren ikke bestemt seg, gjør vi
 * ingenting: vi maser ikke kaldt ved oppstart (iOS lar deg spørre kun én gang).
 */
export async function refreshPushIfGranted(): Promise<void> {
  if (!isPushAvailable()) {
    return;
  }
  if ((await getPushPermission()) !== 'authorized') {
    return;
  }
  attachListeners();
  try {
    // Alt tillatt → dette viser ingen dialog, bare henter/fornyer tokenen.
    await PNIOS.requestPermissions();
  } catch {
    // half-installed / ikke linket ennå.
  }
}

/**
 * Ber aktivt om tillatelse. Viser systemdialogen første gang, og registrerer
 * tokenen ved ja. Kalles fra en bevisst handling — «Skru på varsler» på Profil,
 * ikke kaldt ved oppstart. Returnerer ny status.
 */
export async function enablePush(): Promise<PushPermission> {
  if (!isPushAvailable()) {
    return 'unavailable';
  }
  attachListeners();
  try {
    await PNIOS.requestPermissions();
  } catch {
    // half-installed / ikke linket ennå.
  }
  return getPushPermission();
}

/**
 * Fjerner token og lytterne ved sign-out. MÅ kalles før session-en tømmes,
 * ellers er `auth.uid()` allerede null når RPC-en prøver å slette.
 */
export async function stopPush(): Promise<void> {
  if (!isPushAvailable()) {
    return;
  }
  if (lastToken) {
    try {
      await unregisterDeviceToken(lastToken);
    } catch {
      // Best effort — token blir uansett flyttet ved neste innlogging.
    }
    lastToken = null;
  }
  try {
    PNIOS.removeEventListener?.('register');
    PNIOS.removeEventListener?.('registrationError');
    PNIOS.removeEventListener?.('notification');
    PNIOS.removeEventListener?.('localNotification');
  } catch {
    // ignorer
  }
  listenersAttached = false;
}
