import React from 'react';
import {useNotifications} from '../context';
import {SimulatedPush} from './SimulatedPush';

/**
 * Appens ene varselbanner. Rendres én gang over fanene, ikke per skjerm — en
 * forelder skal få vite at det står 2-1 uansett hvor i appen hun er, ikke bare
 * hvis hun tilfeldigvis står på kampsiden.
 *
 * Mottakerlisten er allerede avgjort i databasen (00023 skriver rader til alle
 * aktive lagmedlemmer unntatt forfatteren), så her finnes ingen «er dette til
 * meg?»-logikk å ta feil av.
 */
export function NotificationBanner() {
  const {banner, dismissBanner} = useNotifications();

  return (
    <SimulatedPush
      title={banner?.title ?? ''}
      message={banner?.body ?? ''}
      visible={banner !== null}
      onHide={dismissBanner}
    />
  );
}
