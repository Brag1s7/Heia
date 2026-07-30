import {useEffect, useRef} from 'react';
import {useAuth} from '../context';
import {consumeInitialNotification, refreshPushIfGranted} from '../lib/push';

/**
 * Kobler push-registreringen til innloggingstilstanden. Renderer ingenting.
 *
 * Ved innlogging registrerer vi enhetens token STILLE — men kun hvis brukeren
 * allerede har sagt ja til varsler. Vi maser ikke med systemdialogen kaldt ved
 * oppstart; den utløses fra «Skru på varsler» på Profil (iOS lar deg spørre
 * kun én gang, så første spørsmål skal komme når brukeren skjønner hvorfor).
 *
 * Avregistrering skjer i `signOut` (UserContext) — den må kjøre MENS brukeren
 * fortsatt er autentisert, så den kan ikke ligge her.
 *
 * Før native-modulen er bygget inn er alt her en no-op (se lib/push).
 */
export function PushGate() {
  const {session} = useAuth();
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (uid && startedFor.current !== uid) {
      startedFor.current = uid;
      refreshPushIfGranted();
      // Ble appen åpnet ved et trykk på et varsel, ligger målet og venter.
      // Først her vet vi at det finnes en innlogget bruker å vise det til.
      consumeInitialNotification();
    } else if (!uid) {
      startedFor.current = null;
    }
  }, [session?.user?.id]);

  return null;
}
