import {Alert} from 'react-native';
import {
  clearOpsAdminCache,
  clearPaymentManagerCache,
  deleteAccount,
} from './api';
import {clearMediaUrlCache} from './media/resolver';

// Skjermnære modul-cacher (f.eks. «Min støtte» i ProfilScreen) registrerer
// seg her ved modul-last. account.ts kan ikke importere fra screens/ selv —
// ProfilScreen importerer allerede herfra, og det ville blitt en sirkel.
const registeredCaches: Array<() => void> = [];

/** Meld inn en modul-cache som skal tømmes ved utlogging/kontosletting. */
export function registerLocalCache(clear: () => void): void {
  registeredCaches.push(clear);
}

/**
 * Rydder ALT lokalt som hører brukeren til: registrerte modul-cacher,
 * api-lagets cacher og de signerte medie-URL-ene (minne + AsyncStorage).
 *
 * Kalles fra selve `signOut` i UserContext — det eneste punktet BEGGE
 * utloggingsinngangene (Profil og velkomstskjermen) passerer. Før bodde
 * ryddingen kun i ProfilScreens handleSignOut, så «Logg ut» fra
 * velkomstskjermen lakk cachene til neste bruker på samme enhet (P1-funn).
 */
export async function clearLocalCaches(): Promise<void> {
  for (const clear of registeredCaches) {
    try {
      clear();
    } catch {
      // Én sta cache skal ikke stoppe resten av ryddingen.
    }
  }
  clearOpsAdminCache();
  clearPaymentManagerCache();
  await clearMediaUrlCache();
}

/**
 * Delt bekreftelsesflyt for kontosletting (Apple 5.1.1(v)).
 *
 * Brukes fra Profil OG fra velkomstskjermen: en innlogget bruker UTEN
 * lag når aldri Profil, og Apple-reviewere tester nettopp med en fersk
 * konto uten lag — slettingen må være nåbar også der. Én kilde til
 * dialogtekstene så de to inngangene aldri glir fra hverandre.
 *
 * Rolig stil utenfor, dramaet bor i dialogene (Heia-språket): to
 * destructive-bekreftelser, så serverflyten (Stripe-kansellering →
 * anonymisering → auth-sletting), så lokal signOut.
 */
export function confirmDeleteAccount(opts: {
  setDeleting: (deleting: boolean) => void;
  /** UserContext-signOut — den rydder også alle lokale cacher. */
  signOut: () => Promise<void>;
}): void {
  Alert.alert(
    'Slette kontoen din?',
    'Dette kan ikke angres. Du fjernes fra lagene dine, aktive ' +
      'støtteavtaler avsluttes, og profilen din anonymiseres. ' +
      'Innlegg du har delt med laget blir stående uten navnet ditt.',
    [
      {text: 'Avbryt', style: 'cancel'},
      {
        text: 'Slett kontoen',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Helt sikker?',
            'Kontoen og påloggingen din slettes for godt.',
            [
              {text: 'Avbryt', style: 'cancel'},
              {
                text: 'Ja, slett kontoen min',
                style: 'destructive',
                onPress: async () => {
                  opts.setDeleting(true);
                  try {
                    await deleteAccount();
                    await opts.signOut();
                  } catch (e: any) {
                    opts.setDeleting(false);
                    Alert.alert(
                      'Kunne ikke slette kontoen',
                      e?.message ?? 'Prøv igjen om litt.',
                    );
                  }
                },
              },
            ],
          );
        },
      },
    ],
  );
}
