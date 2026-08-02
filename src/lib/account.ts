import {Alert} from 'react-native';
import {deleteAccount} from './api';

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
  signOut: () => Promise<void>;
  /** Rydd lokale modul-cacher rett før signOut (f.eks. «Min støtte»). */
  onDeleted?: () => void;
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
                    opts.onDeleted?.();
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
